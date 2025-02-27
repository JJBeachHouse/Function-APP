import { useState, useEffect, useCallback } from 'react';
import { json } from "@remix-run/node";
import { Link, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useLocation, useParams } from 'react-router-dom';
import { convertToDateTime,convertToEST } from './common/date-conversion';

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
  Button,
  Grid,
  Box,
  Checkbox,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { createApp } from '@shopify/app-bridge';
import { Redirect, ResourcePicker } from '@shopify/app-bridge/actions';


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

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);
  const { id } = params;
  let discountType = "automatic";
  let discountCode = "";
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

  if (currentDiscount.data.automaticDiscountNode == null) {
    discountType = "code";
    const response = await admin.graphql(
      `#graphql
       query discountCodeApp($id: ID!) {
        shop {
          name
          primaryDomain {
            url
            host
          }
        }
        codeDiscountNode(id: $id) {
              id
              metafields(first:100){
                  nodes{
                      key
                      value
                  }                   
              }
          codeDiscount {
            ... on DiscountCodeApp { 
              codes(first:2)
              {
                nodes
                {
                  code
                }
              }
              title
              startsAt
              endsAt
              customerSelection {
                __typename
              ... on DiscountCustomerAll {
                allCustomers
              }
              ... on DiscountCustomerSegments {
                segments {
                  id
                  name
                }
              }
              ... on DiscountCustomers {
                customers {
                  id
                  email
                  displayName
                }
              }
            }
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
          id: "gid://shopify/DiscountCodeNode/" + id,
        },
      }
    );
    currentDiscount = await response.json();
    discountCode = currentDiscount.data.codeDiscountNode?.codeDiscount?.codes?.nodes[0]?.code;

  }


  let discountNode = discountType == "automatic" ? currentDiscount.data.automaticDiscountNode : currentDiscount.data.codeDiscountNode;
 
  let tag = discountNode.metafields.nodes.find((node) => node.key === "tag")?.value || null;
  let amountType = discountNode.metafields.nodes.find((node) => node.key === "amountType")?.value || null;
  let amount = discountNode.metafields.nodes.find((node) => node.key === "amount")?.value || null;
  let message = discountNode.metafields.nodes.find((node) => node.key === "message")?.value || null;
  let selectedStartsAt = discountType == "automatic" ? discountNode.automaticDiscount.startsAt : discountNode.codeDiscount.startsAt;
  let selectedEndsAt = discountType == "automatic" ? discountNode.automaticDiscount.endsAt : discountNode.codeDiscount.endsAt;
  selectedStartsAt = convertToEST(selectedStartsAt);
  selectedEndsAt = selectedEndsAt ? convertToEST(selectedEndsAt) : null;


  const combination = discountType == "code" ? discountNode.codeDiscount.combinesWith : discountNode.automaticDiscount.combinesWith;
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
    discountType: discountType,
    SelectedDiscountCode: discountCode,
    SelectedTag: tag,
    SelectedAmountType: amountType,
    SelectedAmount: amount,
    SelectedMessage: message,
    selectedStartsAt,
    selectedEndsAt

  });
};


export const action = async ({ request }) => {

  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const Title = formData.get("title");
  const functionId = formData.get("functionId");
  let id = formData.get("id");
  const discountCode = formData.get("discountCode");
  const title = formData.get("title");
  const discountType = formData.get("discountType");
  const startsAt = formData.get("startsAt") ?? "2024-12-12T17:09:21Z";
  const endsAt = formData.get("endsAt");
  const combineWithOrderDiscounts = JSON.parse(formData.get("combineWithOrderDiscounts"));
  const combineWithProductDiscounts = JSON.parse(formData.get("combineWithProductDiscounts"));
  const combineWithShippingDiscounts = JSON.parse(formData.get("combineWithShippingDiscounts"));
  const tag = formData.get("tag");
  const amount = formData.get("amount");
  const amountType = formData.get("amountType");
  const message = formData.get("message");

  // // return false;

  if (discountType == "code") {
    const codeAppDiscount = {
      "code": discountCode,
      "title": title,
      startsAt: startsAt,
      combinesWith: {
        orderDiscounts: combineWithOrderDiscounts,
        productDiscounts: combineWithProductDiscounts,
        shippingDiscounts: combineWithShippingDiscounts
      },
    };
    if (endsAt != "null") {
      codeAppDiscount.endsAt = endsAt;
    }
 
    let DiscountCodeNode = `gid://shopify/DiscountCodeNode/${id}`;
    const response = await admin.graphql(
      `#graphql
      mutation discountCodeAppUpdate2($codeAppDiscount: DiscountCodeAppInput!, $id: ID!,$metafields: [MetafieldsSetInput!]!) {
        discountCodeAppUpdate(codeAppDiscount: $codeAppDiscount, id: $id) {
          codeAppDiscount {
            discountId
            title
            endsAt
          }
          userErrors {
            field
            message
          }
        }
        metafieldsSet(metafields: $metafields) {
            metafields {
              id
              ownerType
              value
            }
            userErrors {
              field
              message
            }
          }
      }`,
      {
        variables: {
          "id": DiscountCodeNode,
          codeAppDiscount,
         metafields: [
            {
              ownerId: DiscountCodeNode,
              key: "tag",
              namespace: "$app:product-discount",
              type: "string",
              value: tag,
            },
            {
              ownerId: DiscountCodeNode,
              key: "JsonTag",
              namespace: "$app:product-discount",
              type: "json",
              value: JSON.stringify({JsonTag:tag}),
            },
            {
              ownerId: DiscountCodeNode,
              key: "amountType",
              namespace: "$app:product-discount",
              type: "string",
              value: amountType,
            },
            {
              ownerId: DiscountCodeNode,
              key: "amount",
              namespace: "$app:product-discount",
              type: "float",
              value: amount,
            },
            {
              ownerId: DiscountCodeNode,
              key: "message",
              namespace: "$app:product-discount",
              type: "string",
              value: message,
            },
            {
              ownerId: DiscountCodeNode,
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

        },
      },
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
      startsAt: startsAt,
      functionId: functionId,
      title: Title
    };
    if (endsAt != "null") {
      automaticAppDiscount.endsAt = endsAt;
    }
   
    let DiscountCodeNode = "gid://shopify/DiscountAutomaticNode/" + id
    const response = await admin.graphql(
      `#graphql
    mutation discountAutomaticAppUpdate2($automaticAppDiscount: DiscountAutomaticAppInput!, $id: ID!,$metafields: [MetafieldsSetInput!]!) 
  
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
      	metafieldsSet(metafields: $metafields) {
		metafields {
			id
			ownerType
			value
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
          metafields: [
            {
              ownerId: DiscountCodeNode,
              key: "tag",
              namespace: "$app:product-discount",
              type: "string",
              value: tag,
            },
            {
              ownerId: DiscountCodeNode,
              key: "JsonTag",
              namespace: "$app:product-discount",
              type: "json",
              value: JSON.stringify({JsonTag:tag}),
            },
            {
              ownerId: DiscountCodeNode,
              key: "amountType",
              namespace: "$app:product-discount",
              type: "string",
              value: amountType,
            },
            {
              ownerId: DiscountCodeNode,
              key: "amount",
              namespace: "$app:product-discount",
              type: "float",
              value: amount,
            },
            {
              ownerId: DiscountCodeNode,
              key: "message",
              namespace: "$app:product-discount",
              type: "string",
              value: message,
            },
            {
              ownerId: DiscountCodeNode,
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
          title: title
        }

      },

    );

    const responseJson = await response.json();


    return json({
      resp: responseJson,
    });
  }
};

export default function Index() {
  const { functionId, id } = useParams();
  const nav = useNavigation();
  const actionData = useActionData();
  const {
    discountsURL,
    withorderDiscounts,
    withproductDiscounts,
    withshippingDiscounts,
    discountType,
    SelectedDiscountCode,
    selectedStartsAt,
    selectedEndsAt,
    SelectedTag,
    SelectedAmountType,
    SelectedAmount,
    SelectedMessage

  } = useLoaderData();



  const isLoading =["loading", "submitting"].includes(nav.state) && nav.formMethod === "POST";
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
        if (discountType == "code") {

          if (resp.resp.data.discountCodeAppUpdate.userErrors.length > 0) {
            let error = resp.resp.data.discountCodeAppUpdate.userErrors[0]
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

        if (discountType == "automatic") {

          // discountAutomaticAppCreate
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
    }
  }, [resp, redirect, currentDiscount]);

  useEffect(() => {

    if (currentDiscount) {
      setTitle(discountType == "automatic" ? currentDiscount.data.automaticDiscountNode?.automaticDiscount.title : currentDiscount.data.codeDiscountNode?.codeDiscount.title);
    }
  }, [currentDiscount]);




  const [title, setTitle] = useState("");
  const [combineWithOrderDiscounts, setCombineWithOrderDiscounts] = useState(withorderDiscounts);
  const [combineWithProductDiscounts, setCombineWithProductDiscounts] = useState(withproductDiscounts);
  const [combineWithShippingDiscounts, setCombineWithShippingDiscounts] = useState(withshippingDiscounts);
  const [discountCode, setDiscountCode] = useState(SelectedDiscountCode);
  const [tag, setTag] = useState(SelectedTag);
  const [amount, setAmount] = useState(SelectedAmount);
  const [amountType, setAmountType] = useState(SelectedAmountType);
  const [message, setMessage] = useState(SelectedMessage);
  const [endDate, setEndDate] = useState(selectedEndsAt ? selectedEndsAt?.split("T")[0] : new Date().toISOString().split("T")[0]);
  const [endTime, setEndTime] = useState(selectedEndsAt ? selectedEndsAt?.split("T")[1].slice(0, 5) : "23:00");
  const [showEndDate, setShowEndDate] = useState(selectedEndsAt ? true : false);
  const [startDate, setStartDate] = useState(selectedStartsAt.split("T")[0]);
  const [startTime, setStartTime] = useState(selectedStartsAt.split("T")[1].slice(0, 5));
 

  // endActions
  const formData = new FormData();
  formData.append("functionId", functionId);
  formData.append("title", title);
  formData.append("id", id);
  formData.append("combineWithOrderDiscounts", combineWithOrderDiscounts);
  formData.append("combineWithProductDiscounts", combineWithProductDiscounts);
  formData.append("combineWithShippingDiscounts", combineWithShippingDiscounts);
  formData.append('discountType', discountType);
  formData.append('discountCode', discountCode);
  formData.append("tag", tag);
  formData.append("amount", amount);
  formData.append("amountType", amountType);
  formData.append("message", message);
  let StartDate = convertToDateTime(startDate, startTime);
  let EndDate = convertToDateTime(endDate, endTime);
  console.log("StartDate", StartDate)
  formData.append('startsAt', StartDate ? StartDate : "");
  if (showEndDate == true) {
    formData.append('endsAt', EndDate ? EndDate : "");
  } else {
    formData.append('endsAt', null);
  }

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
  const submit = useSubmit(formData);

  const discard = () => {

    redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
  }
  return (
    <Page
      title="Threshold discount"
      breadcrumbs={[
        {
          content: "Threshold Discount",

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
                          disabled={true}
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
                    <Grid>

                      <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                        <TextField
                          label="Start date "
                          type="date"
                          value={startDate}
                          onChange={(value) => setStartDate(value)}
                        />
                      </Grid.Cell>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2, xl: 2 }}>
                        <TextField
                          label="Start time (PST) "
                          type="time"
                          value={startTime}
                          onChange={(value) => setStartTime(value)}
                        />
                      </Grid.Cell>

                    </Grid>
                    <Checkbox
                      label="Set end date"
                      checked={showEndDate}
                      onChange={(value) => setShowEndDate(value)}
                    />

                    {showEndDate == true ? (<Grid>

                      <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                        <TextField
                          label="End date "
                          type="date"
                          value={endDate}
                          onChange={(value) => setEndDate(value)}
                        />
                      </Grid.Cell>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 2, lg: 2, xl: 2 }}>
                        <TextField
                          label="End time (PST) "
                          type="time"
                          value={endTime}
                          onChange={(value) => setEndTime(value)}
                        />
                      </Grid.Cell>

                    </Grid>) : ""}


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
