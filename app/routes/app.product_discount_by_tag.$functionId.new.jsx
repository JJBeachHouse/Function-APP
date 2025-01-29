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
  Select,
  Grid,
  Box,
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
  const discountType = formData.get("discountType");
  const discountCode = formData.get("discountCode");
  const startsAt =  "2024-12-12T17:09:21Z";
 
  const combineWithOrderDiscounts = JSON.parse(formData.get("combineWithOrderDiscounts"));
  const combineWithProductDiscounts = JSON.parse(formData.get("combineWithProductDiscounts"));
  const combineWithShippingDiscounts = JSON.parse(formData.get("combineWithShippingDiscounts"));
  const tag = formData.get("tag");
  const amount = formData.get("amount");
  const amountType = formData.get("amountType");
  const message = formData.get("message");


  if (discountType == "code") {

    const codeAppDiscount = {
      code: discountCode,
      title: title,
      functionId: functionId,
      combinesWith: {
        orderDiscounts: combineWithOrderDiscounts,
        productDiscounts: combineWithProductDiscounts,
        shippingDiscounts: combineWithShippingDiscounts,
      },
      startsAt: startsAt,
      metafields: [
        {
          key: "tag",
          namespace: "$app:product-discount",
          type: "string",
          value: tag,
        },
        { 
          key: "JsonTag",
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({JsonTag:tag}),
        },
        {
          key: "amountType",
          namespace: "$app:product-discount",
          type: "string",
          value: amountType,
        },
        {
          key: "amount",
          namespace: "$app:product-discount",
          type: "float",
          value: amount,
        },
        {
          key: "message",
          namespace: "$app:product-discount",
          type: "string",
          value: message,
        },
        {
          key: "configuration",
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({
            discountType: discountType,
            tag: tag,
            amountType: amountType,
            amount: amount,
            message: message
          }),
        },
      ],
    };



     


    // Execute the mutation
    const response = await admin.graphql(
      `#graphql
  mutation discountCodeAppCreate($codeAppDiscount: DiscountCodeAppInput!) {
    discountCodeAppCreate(codeAppDiscount: $codeAppDiscount) {
      codeAppDiscount {
        discountId
        title
        appDiscountType {
          description
          functionId
        }
        combinesWith {
          orderDiscounts
          productDiscounts
          shippingDiscounts
        }
        codes(first: 100) {
          nodes {
            code
          }
        }
        status
        usageLimit
      }
      userErrors {
        field
        message
      }
    }
  }`,
      {
        variables: {
          codeAppDiscount,
        },
      }
    );


    const responseJson = await response.json();
    return json({
      resp: responseJson,
    });
  }
  if (discountType == "automatic") {
    const automaticAppDiscount = {
      combinesWith: {
        orderDiscounts: combineWithOrderDiscounts,
        productDiscounts: combineWithProductDiscounts,
        shippingDiscounts: combineWithShippingDiscounts
      },
      functionId: functionId,
      metafields: [
        {
          key: "tag",
          namespace: "$app:product-discount",
          type: "string",
          value: tag,
        },
        { 
          key: "JsonTag",
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({JsonTag:tag}),
        },
        {
          key: "amountType",
          namespace: "$app:product-discount",
          type: "string",
          value: amountType,
        },
        {
          key: "amount",
          namespace: "$app:product-discount",
          type: "float",
          value: amount,
        },
        {
          key: "message",
          namespace: "$app:product-discount",
          type: "string",
          value: message,
        },
        {
          key: "configuration",
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({
            discountType: discountType,
            tag: tag,
            amountType: amountType,
            amount: amount,
            message: message
          }),
        },
      ],
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
  }
};
function validateData(tag, amount, amountType, message) {

  if (isNaN(amount) || amount == 0 || amount < 0) {
    return { valid: false, Errormessage: `Invalid entred amount` };
  }
  if (tag == "") {
    return { valid: false, Errormessage: `tag is required` };
  }
  if (message == "") {
    return { valid: false, Errormessage: `message is required` };
  }
  return { valid: true, Errormessage: `` };

}
export default function Index() {
  const { functionId } = useParams();
  const nav = useNavigation();
  const actionData = useActionData();
  const { discountsURL } = useLoaderData();
  const location = useLocation();
  const { apiKey } = useLoaderData();
  const [discountType, setDiscountType] = useState("automatic");
  const [discountCode, setDiscountCode] = useState("");
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
  const [tag, setTag] = useState("");
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState("fixed");
  const [message, setMessage] = useState("");
 

  const [combineWithOrderDiscounts, setCombineWithOrderDiscounts] = useState(false);
  const [combineWithProductDiscounts, setCombineWithProductDiscounts] = useState(false);
  const [combineWithShippingDiscounts, setCombineWithShippingDiscounts] = useState(false);





  useEffect(() => {
    if (resp) {
      if (discountType == "code") {
        if (resp.resp) {
          if (resp.resp?.data.discountCodeAppCreate?.userErrors.length > 0) {
            let error = resp.resp.data.discountCodeAppCreate.userErrors[0]
            shopify.toast.show("Error: " + error.field[1] + " " + error.message, {
              autoClose: 2000,
              hideProgressBar: true,
              isError: true,
            });
          } else {
            shopify.toast.show("Discount Created!");
            console.log(resp.resp?.data.discountAutomaticAppCreate?.userErrors.length)
            if (resp.resp?.data.discountAutomaticAppCreate?.userErrors.length < 1 || !resp.resp?.data.discountAutomaticAppCreate) {

              shopify.toast.show("Discount Created!");
              redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
            }
          }
        }

      }
      if (discountType == "automatic") {
        // discountAutomaticAppCreate
        if (resp.resp) {
          if (resp.resp?.data.discountAutomaticAppCreate?.userErrors.length > 0) {
            let error = resp.resp.data.discountAutomaticAppCreate.userErrors[0]
            shopify.toast.show("Error: " + error.field[1] + " " + error.message, {
              autoClose: 2000,
              hideProgressBar: true,
              isError: true,
            });
          }
          else {
            if (resp.resp?.data.discountCodeAppCreate?.userErrors.length < 1 || !resp.resp?.data.discountCodeAppCreate) {
              shopify.toast.show("Discount Created!");
              redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
            }
          }
        }
      }
      if (resp.fetchedCustomers) {
        setFetchedCustomers(resp.fetchedCustomers)
      }
      if (resp.fetchedSegments) {
        setFetchedSegments(resp.fetchedSegments)
      }


    }
  }, [resp, redirect, discountsURL]);



  // Variables 

 
  // ----------------------------- Form Data 
  const formData = new FormData();
  formData.append("functionId", functionId);
  formData.append("title", title);
  formData.append("discountType", discountType);
  formData.append("discountCode", discountCode);
  formData.append("tag", tag);
  formData.append("amount", amount);
  formData.append("amountType", amountType);
  formData.append("message", message);
  formData.append("combineWithOrderDiscounts", combineWithOrderDiscounts);
  formData.append("combineWithProductDiscounts", combineWithProductDiscounts);
  formData.append("combineWithShippingDiscounts", combineWithShippingDiscounts);
  
   
 
  const CreateDiscount = () => {
    const { valid, Errormessage } = validateData(tag, amount, amountType, message);
    if (valid == false) {
      shopify.toast.show(`${Errormessage}`, {
        autoClose: 2000,
        hideProgressBar: true,
        isError: true,
      });
      return false;
    }
    submit(formData, { replace: true, method: "POST" })
  };
  const discard = () => {

    redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
  }
  // ------------------------- End Form Data

  const submit = useSubmit(formData);
  return (
    <Page

      title="Create Function linked to discount code"
      breadcrumbs={[
        {
          content: "Functions linked to discount code",

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
                    <Grid>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                        <Select
                          value={discountType}
                          label="Discount Type"
                          onChange={(value) => setDiscountType(value)}
                          options={[
                            { label: "Automatic", value: "automatic" },
                            { label: "Code", value: "code" },
                          ]}
                        />
                      </Grid.Cell>

                      {discountType == "code" ? (

                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                          <TextField
                            value={discountCode}
                            label="Discount Code"
                            onChange={(value) => setDiscountCode(value)}

                          />
                        </Grid.Cell>
                      ) : ""}  </Grid>
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


                  <Card roundedAbove="sm">
                    <Text as="h2" variant="headingSm">

                    </Text>
                    <Box paddingBlockStart="200">
                      <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                          <TextField
                            label="Tag"
                            type="text"
                            value={tag}
                            onChange={(value) => setTag(value)}
                          />
                        </Grid.Cell>
                      </Grid>
                      <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                          <TextField
                            label="Discount Amount"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={amount}
                            onChange={(value) => setAmount(value)}
                          />
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                          <Select
                            label="Amount Type"
                            select
                            options={[
                              { label: "Fixed", value: "fixed" },
                              { label: "Percent", value: "percent" },
                            ]}
                            value={amountType}
                            onChange={(value) => setAmountType(value)}
                          />
                        </Grid.Cell>
                      </Grid>
                      <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                          <TextField
                            label="Message"
                            type="text"
                            value={message}
                            onChange={(value) => setMessage(value)}
                          />
                        </Grid.Cell>
                      </Grid>
                    </Box>
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
