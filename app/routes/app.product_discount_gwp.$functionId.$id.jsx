import { useState, useEffect, useCallback } from 'react';
import { json } from "@remix-run/node";
import {  useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useLocation, useParams } from 'react-router-dom';

import {
    Text,
    Page,
    Layout,
    BlockStack,
    TextField,
    PageActions,
    AppProvider as PolarisProvider,
    Card,
    Grid,
    Checkbox,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { createApp } from '@shopify/app-bridge';
import { Redirect } from '@shopify/app-bridge/actions';


export const loader = async ({ request, params }) => {
    await authenticate.admin(request);
    const { id } = params;
 
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
        `#graphql
     query discountAutomaticApp($id: ID!) {
            shop {
              name
              primaryDomain {
                url
                host
              }
            }
            automaticDiscountNode(id: $id) {
                  id 
                  metafields(first:100){
                      nodes{
                          key
                          value
                      }                   
                  }
              automaticDiscount {
                ... on DiscountAutomaticApp {
                  title
                  startsAt
                  endsAt
                  combinesWith {
                    orderDiscounts
                    productDiscounts
                    shippingDiscounts
                  }
                  appDiscountType {
                    functionId
                  }
                }
              }
            }
          }
    `,
        {
            variables: {
                id: "gid://shopify/DiscountAutomaticNode/" + id,
            },
        }
    );

    let currentDiscount = await response.json();



    let discountNode = currentDiscount.data.automaticDiscountNode;



    const combination = discountNode.automaticDiscount.combinesWith;
    const { orderDiscounts, productDiscounts, shippingDiscounts } = combination;
    const withorderDiscounts = orderDiscounts;
    const withproductDiscounts = productDiscounts;
    const withshippingDiscounts = shippingDiscounts;

    return json({
        apiKey: process.env.SHOPIFY_API_KEY || "",
        host: process.env.SHOPIFY_APP_URL || "",
        currentDiscount: currentDiscount,
        discountsURL: currentDiscount.data.shop.primaryDomain.url + "/admin/discounts",
        withorderDiscounts,
        withproductDiscounts,
        withshippingDiscounts,

    });
};


export const action = async ({ request }) => {

    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const Title = formData.get("title");
    const functionId = formData.get("functionId");

    let id = formData.get("id");
    const title = formData.get("title");
    const startsAt = "2024-12-12T17:09:21Z";
    const combineWithOrderDiscounts = JSON.parse(formData.get("combineWithOrderDiscounts"));
    const combineWithProductDiscounts = JSON.parse(formData.get("combineWithProductDiscounts"));
    const combineWithShippingDiscounts = JSON.parse(formData.get("combineWithShippingDiscounts"));


    const automaticAppDiscount = {
        combinesWith: {
            orderDiscounts: combineWithOrderDiscounts,
            productDiscounts: combineWithProductDiscounts,
            shippingDiscounts: combineWithShippingDiscounts
        },
        startsAt: startsAt,
        functionId: functionId,
        title: Title
    };

    let DiscountCodeNode = "gid://shopify/DiscountAutomaticNode/" + id
    const response = await admin.graphql(
        `#graphql
    mutation discountAutomaticAppUpdate2($automaticAppDiscount: DiscountAutomaticAppInput!, $id: ID!) 
  
    {
      discountAutomaticAppUpdate(automaticAppDiscount: $automaticAppDiscount, id: $id) {
        automaticAppDiscount {
        discountId
        }
        userErrors {
          field
          message
        }
      }
    
    }
    `,
        {
            variables: {
                id: DiscountCodeNode,
                automaticAppDiscount,

                title: title
            }

        },

    );

    const responseJson = await response.json();


    return json({
        resp: responseJson,
    });

};

export default function Index() {
    const { functionId, id } = useParams();
    const nav = useNavigation();
    const actionData = useActionData();
    const {
        discountsURL,
        withorderDiscounts,
        withproductDiscounts,
        withshippingDiscounts } = useLoaderData();



    const isLoading = ["loading", "submitting"].includes(nav.state) && nav.formMethod === "POST";
    const resp = actionData
    const { apiKey, currentDiscount } = useLoaderData();
    const location = useLocation();
    const config = {
        apiKey: apiKey,
        host: new URLSearchParams(location.search).get("host"),
        forceRedirect: true
    };
    const app = createApp(config);
    const redirect = Redirect.create(app);
    useEffect(() => {
        if (resp) {
            if (resp.resp) {
                if (resp.resp.data.discountAutomaticAppUpdate.userErrors.length > 0) {
                    let error = resp.resp.data.discountAutomaticAppUpdate.userErrors[0]
                    shopify.toast.show("Error: " + error.field[1] + " " + error.message, {
                        autoClose: 2000,
                        hideProgressBar: true,
                        isError: true,
                    });
                } else {
                    shopify.toast.show("Discount Updated!");
                    redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
                }
            }
        }
    }, [resp, redirect, currentDiscount]);
    const [title, setTitle] = useState(currentDiscount.data.automaticDiscountNode?.automaticDiscount.title);
    const [combineWithOrderDiscounts, setCombineWithOrderDiscounts] = useState(withorderDiscounts);
    const [combineWithProductDiscounts, setCombineWithProductDiscounts] = useState(withproductDiscounts);
    const [combineWithShippingDiscounts, setCombineWithShippingDiscounts] = useState(withshippingDiscounts);
    // endActions
    const formData = new FormData();
    formData.append("functionId", functionId);
    formData.append("title", title);
    formData.append("id", id);
    formData.append("combineWithOrderDiscounts", combineWithOrderDiscounts);
    formData.append("combineWithProductDiscounts", combineWithProductDiscounts);
    formData.append("combineWithShippingDiscounts", combineWithShippingDiscounts);


    const CreateDiscount = () => {

        submit(formData, { replace: true, method: "POST" })
    };
    const submit = useSubmit(formData);

    const discard = () => {

        redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
    }
    return (
        <Page
            title="GWP"
            breadcrumbs={[{ content: "GWP", },]}>

            <PolarisProvider i18n={{}} linkComponent={({ children, ...props }) => <a {...props}>{children}</a>}>


                <BlockStack gap="500">
                    <Layout>
                        <Layout.Section>
                            <form onSubmit={submit}>

                                <div style={{ marginBottom: '20px' }}>
                                    <Card>

                                        <Grid>
                                            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>

                                                <TextField
                                                    label="Title"
                                                    type="text"
                                                    value={title}
                                                    onChange={(value) => setTitle(value)}
                                                />
                                            </Grid.Cell>
                                        </Grid>
                                    </Card>

                                </div>




                                <div style={{ marginTop: "20px" }}>
                                    <Card>
                                        <Checkbox
                                            label="Combine with Order Discounts"
                                            checked={combineWithOrderDiscounts}
                                            onChange={(value) => setCombineWithOrderDiscounts(value)}
                                        />

                                        {/* Combine with Product Discounts */}
                                        <br />
                                        <Checkbox
                                            label="Combine with Product Discounts"
                                            checked={combineWithProductDiscounts}
                                            onChange={(value) => setCombineWithProductDiscounts(value)}
                                        />
                                        <br />
                                        <Checkbox
                                            label="Combine with shipping Discounts"
                                            checked={combineWithShippingDiscounts}
                                            onChange={(value) => setCombineWithShippingDiscounts(value)}
                                        />
                                    </Card>
                                </div>


                            </form>
                        </Layout.Section>
                        <Layout.Section>
                            <PageActions
                                config={config}
                                primaryAction={{
                                    content: "Save ",
                                    onAction: CreateDiscount,
                                    disabled: false,
                                }}
                                secondaryActions={[
                                    {
                                        content: "Discard",
                                        onAction: discard
                                    },
                                ]}

                            />
                        </Layout.Section>
                    </Layout>
                </BlockStack>
            </PolarisProvider>
            <BlockStack>
                {isLoading && (<Text><center>Loading ...</center></Text>)}
            </BlockStack>
        </Page>
    );
}
