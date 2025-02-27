import { useState, useEffect } from 'react';
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useLocation, useParams } from 'react-router-dom';

import { convertToDateTime } from './common/date-conversion';
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
  Button,
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
  const startsAt = formData.get("startsAt") ?? "2024-12-12T17:09:21Z";
  const endsAt = formData.get("endsAt");

  const combineWithOrderDiscounts = JSON.parse(formData.get("combineWithOrderDiscounts"));
  const combineWithProductDiscounts = JSON.parse(formData.get("combineWithProductDiscounts"));
  const combineWithShippingDiscounts = JSON.parse(formData.get("combineWithShippingDiscounts"));
  const tags = formData.get("tags");
  const onlytags= JSON.parse(tags).map((tag)=>tag.tag) ;

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
          key: "tags",
          namespace: "$app:product-discount",
          type: "string",
          value: JSON.stringify({tags}),
        },
        {
          key: "JsonTags",  
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({ JsonTags: onlytags }),
        },
        {
          key: "configuration",
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({
            discountType: discountType,
            tags: tags
          }),
        },
      ],
    };
    if (endsAt != "null") {
      codeAppDiscount.endsAt = endsAt;
    }







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
          key: "tags",
          namespace: "$app:product-discount",
          type: "string",
          value: tags,
        },
        {
          key: "JsonTag",
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({ JsonTags: onlytags }),
        },


        {
          key: "configuration",
          namespace: "$app:product-discount",
          type: "json",
          value: JSON.stringify({
            discountType: discountType,
            tags: tags
          }),
        },
      ],
      startsAt: startsAt,
      title: title
    }
    if (endsAt != "null") {
      automaticAppDiscount.endsAt = endsAt;
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
function validateData(tags) {

  if (tags.length==0) {
    return { valid: false, Errormessage: `tags are required` };
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
  const [tags, setTags] = useState([]);
  const [combineWithOrderDiscounts, setCombineWithOrderDiscounts] = useState(false);
  const [combineWithProductDiscounts, setCombineWithProductDiscounts] = useState(false);
  const [combineWithShippingDiscounts, setCombineWithShippingDiscounts] = useState(false);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [endTime, setEndTime] = useState("23:00");
  const [showEndDate, setShowEndDate] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("06:00");


  const addTag = () => setTags([...tags, { tag: "" }]);
  const updateTag = (index, key, value) => {
    const newTags = [...tags];
    newTags[index][key] = value;
    setTags(newTags);
  };
  const removeTag = (index) => {
    const updatedTags = [...tags];
    updatedTags.splice(index, 1);
    setTags(updatedTags);
  };



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
              // redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
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
              // redirect.dispatch(Redirect.Action.REMOTE, discountsURL);
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
  formData.append("tags", JSON.stringify(tags));
  formData.append("combineWithOrderDiscounts", combineWithOrderDiscounts);
  formData.append("combineWithProductDiscounts", combineWithProductDiscounts);
  formData.append("combineWithShippingDiscounts", combineWithShippingDiscounts);
  let StartDate = convertToDateTime(startDate, startTime);
  let EndDate = convertToDateTime(endDate, endTime);
  formData.append('startsAt', StartDate ? StartDate : "");
  if (showEndDate == true) {
    formData.append('endsAt', EndDate ? EndDate : "");
  } else {
    formData.append('endsAt', null);
  }


  const CreateDiscount = () => {

    const { valid, Errormessage } = validateData(tags);
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
                    
                      {tags.map((tag, index) => (
                        <Grid key={index}>
                          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                            <TextField
                              label="tags"
                              type="text"
                              value={tag.tag}
                              onChange={(value) => updateTag(index, "tag", value)}
                            />
                          </Grid.Cell>
                          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                            <div style={{ marginTop: "30px" }}>
                              <Button variant="plain" onClick={() => removeTag(index)} tone="critical">Remove </Button>
                            </div>
                          </Grid.Cell>
                        </Grid>
                      ))}
                      <div style={{ marginTop: "20px" }}>
                        <Button onClick={addTag} >Add Tag</Button>
                      </div>

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
