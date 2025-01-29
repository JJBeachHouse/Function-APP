import { useState, useEffect } from 'react';
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
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

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
          query discountAutomaticApp{
            shop {
            name
            primaryDomain {
              url
              host
            }
        }
      }`
  );

  const currentDiscount = await response.json();

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    host: process.env.SHOPIFY_APP_URL || "",
    currentDiscount: currentDiscount,
    discountsURL: currentDiscount.data.shop.primaryDomain.url + "/admin/discounts"
  });
};

export const action = async ({ request }) => {


  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const functionId = formData.get("functionId");

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
    functionId: functionId,

    startsAt: startsAt,
    title: title
  }

  const response = await admin.graphql(
    `#graphql
      mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
          automaticAppDiscount {
          discountId
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        automaticAppDiscount
      },
    }
  );
  const responseJson = await response.json();
  return json({
    resp: responseJson,
  });

};

export default function Index() {
  const { functionId } = useParams();
  const nav = useNavigation();
  const actionData = useActionData();
  const { discountsURL } = useLoaderData();
  const location = useLocation();
  const { apiKey } = useLoaderData();
  const isLoading = ["loading", "submitting"].includes(nav.state) && nav.formMethod === "POST";
  const resp = actionData;

  const config = {
    apiKey: apiKey,
    host: new URLSearchParams(location.search).get("host"),
    forceRedirect: true
  };
  const app = createApp(config);
  const redirect = Redirect.create(app);


  const [title, setTitle] = useState("");


  const [combineWithOrderDiscounts, setCombineWithOrderDiscounts] = useState(false);
  const [combineWithProductDiscounts, setCombineWithProductDiscounts] = useState(false);
  const [combineWithShippingDiscounts, setCombineWithShippingDiscounts] = useState(false);





  useEffect(() => {
    if (resp) {

      if (resp.resp?.data.discountAutomaticAppCreate?.userErrors.length > 0) {
        let error = resp.resp.data.discountAutomaticAppCreate.userErrors[0]
        shopify.toast.show("Error: " + error.field[1] + " " + error.message, {
          autoClose: 2000,
          hideProgressBar: true,
          isError: true,
        });
      }else {
        if (resp.resp?.data.discountCodeAppCreate?.userErrors.length < 1 || !resp.resp?.data.discountCodeAppCreate) {
          shopify.toast.show("Discount Created!");
          redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
        }
      }
    }
  }, [resp, redirect, discountsURL]);



  // Variables 


  // ----------------------------- Form Data 
  const formData = new FormData();
  formData.append("functionId", functionId);
  formData.append("title", title);
  formData.append("combineWithOrderDiscounts", combineWithOrderDiscounts);
  formData.append("combineWithProductDiscounts", combineWithProductDiscounts);
  formData.append("combineWithShippingDiscounts", combineWithShippingDiscounts);



  const CreateDiscount = () => {

    submit(formData, { replace: true, method: "POST" })
  };
  const discard = () => {

    redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
  }
  // ------------------------- End Form Data

  const submit = useSubmit(formData);
  return (
    <Page

      title="GWP"
      breadcrumbs={[
        {
          content: "GWP",

        },
      ]}
    >
      <PolarisProvider i18n={{}} linkComponent={({ children, ...props }) => <a {...props}>{children}</a>}>
        <BlockStack gap="500">
          <Layout>
            <Layout.Section>
              <form onSubmit={submit}>
                <div style={{ marginBottom: '20px' }}>
                  <Card>
                    <div style={{ marginTop: "20px" }}>
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
                    </div>
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
