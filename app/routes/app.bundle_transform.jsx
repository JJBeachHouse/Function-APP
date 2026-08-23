import { useState } from "react";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// The cart transform function that gives the theme's bundle builder a fixed
// bundle price. Registering it has to happen from THIS app: a CartTransform is
// resolved against the calling app's own functions, so creating one from an
// outside client (the GraphiQL app, say) produces a record that never executes.
const FUNCTION_ID = "019fe8f4-1220-7c93-9410-8e228ec94376";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  // Listing cart transforms needs the write_cart_transforms scope. If the app
  // has not been reauthorized since that scope was added, this throws -- so
  // surface the message on the page rather than 500ing to a blank screen.
  try {
    const response = await admin.graphql(
      `#graphql
      query CartTransforms {
        cartTransforms(first: 10) {
          nodes { id functionId blockOnFailure }
        }
      }`
    );
    const body = await response.json();

    const gqlErrors = (body?.errors || []).map((e) => e.message).join(' | ');

    return json({
      functionId: FUNCTION_ID,
      transforms: body?.data?.cartTransforms?.nodes ?? [],
      loadError: gqlErrors || null,
    });
  } catch (e) {
    return json({
      functionId: FUNCTION_ID,
      transforms: [],
      loadError: String((e && e.message) || e),
    });
  }
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    const response = await admin.graphql(
      `#graphql
      mutation CartTransformDelete($id: ID!) {
        cartTransformDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }`,
      { variables: { id: form.get("id") } }
    );
    const body = await response.json();
    return json({ result: body?.data?.cartTransformDelete });
  }

  const response = await admin.graphql(
    `#graphql
    mutation CartTransformCreate($functionId: String!) {
      cartTransformCreate(functionId: $functionId, blockOnFailure: false) {
        cartTransform { id functionId }
        userErrors { field message }
      }
    }`,
    { variables: { functionId: FUNCTION_ID } }
  );
  const body = await response.json();
  return json({ result: body?.data?.cartTransformCreate });
}

export default function BundleTransformPage() {
  const { functionId, transforms, loadError } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const [lastIntent, setLastIntent] = useState(null);

  const run = (intent, id) => {
    setLastIntent(intent);
    const data = new FormData();
    data.set("intent", intent);
    if (id) data.set("id", id);
    submit(data, { method: "post" });
  };

  const errors = actionData?.result?.userErrors ?? [];

  return (
    <Page>
      <TitleBar title="Bundle set price" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Cart transform registration
              </Text>
              <Text as="p" variant="bodyMd">
                Registers the <code>bundle-set-price</code> function so bundles built
                on the storefront are charged their fixed bundle price. This must be
                run from inside this app — a cart transform created by any other
                client is accepted but never runs.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Function id: {functionId}
              </Text>

              {loadError && (
                <Banner tone="warning" title="Could not read cart transforms">
                  <Text as="p" variant="bodyMd">{loadError}</Text>
                  <Text as="p" variant="bodySm">
                    Usually means the app has not been reauthorized since
                    write_cart_transforms was added to its scopes.
                  </Text>
                </Banner>
              )}

              {actionData?.result && errors.length === 0 && (
                <Banner tone="success">
                  {lastIntent === "delete" ? "Cart transform deleted." : "Cart transform registered."}
                </Banner>
              )}
              {errors.length > 0 && (
                <Banner tone="critical">
                  <List>
                    {errors.map((e, i) => (
                      <List.Item key={i}>{e.message}</List.Item>
                    ))}
                  </List>
                </Banner>
              )}

              <InlineStack gap="300">
                <Button variant="primary" loading={busy} onClick={() => run("create")}>
                  Register cart transform
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Registered cart transforms
              </Text>
              {transforms.length === 0 && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  None registered for this app.
                </Text>
              )}
              {transforms.map((t) => (
                <InlineStack key={t.id} gap="300" align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text as="p" variant="bodyMd">{t.id}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      function {t.functionId} · blockOnFailure {String(t.blockOnFailure)}
                    </Text>
                  </BlockStack>
                  <Button tone="critical" loading={busy} onClick={() => run("delete", t.id)}>
                    Delete
                  </Button>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
