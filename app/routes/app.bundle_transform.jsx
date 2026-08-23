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

// The cart transform extension's handle, from its shopify.extension.toml.
// Registering by handle rather than id matters: a CartTransform is resolved
// against the CALLING app's own functions, so a handle both identifies the
// function and proves ownership. Creating one from an outside client with the
// deprecated functionId parameter is accepted and then never executes.
const FUNCTION_HANDLE = "bundle-set-price";

const FUNCTIONS_QUERY = `#graphql
  query ShopifyFunctions {
    shopifyFunctions(first: 50) {
      nodes {
        id
        title
        apiType
        app { title }
      }
    }
  }`;

const TRANSFORMS_QUERY = `#graphql
  query CartTransforms {
    cartTransforms(first: 10) {
      nodes { id functionId blockOnFailure }
    }
  }`;

async function runQuery(admin, query) {
  try {
    const response = await admin.graphql(query);
    const body = await response.json();
    const errors = (body?.errors || []).map((e) => e.message).join(" | ");
    return { data: body?.data, error: errors || null };
  } catch (e) {
    return { data: null, error: String((e && e.message) || e) };
  }
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const fns = await runQuery(admin, FUNCTIONS_QUERY);
  const transforms = await runQuery(admin, TRANSFORMS_QUERY);

  return json({
    handle: FUNCTION_HANDLE,
    functions: fns.data?.shopifyFunctions?.nodes ?? [],
    transforms: transforms.data?.cartTransforms?.nodes ?? [],
    loadError: fns.error || transforms.error || null,
  });
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

  // functionId is deprecated; functionHandle resolves against this app's own
  // functions, which is exactly the ownership guarantee a cart transform needs.
  const response = await admin.graphql(
    `#graphql
    mutation CartTransformCreate($handle: String!) {
      cartTransformCreate(functionHandle: $handle, blockOnFailure: false) {
        cartTransform { id functionId }
        userErrors { field message }
      }
    }`,
    { variables: { handle: FUNCTION_HANDLE } }
  );
  const body = await response.json();
  return json({
    result: body?.data?.cartTransformCreate,
    topLevelErrors: (body?.errors || []).map((e) => e.message),
  });
}

export default function BundleTransformPage() {
  const { handle, functions, transforms, loadError } = useLoaderData();
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

  const errors = [
    ...(actionData?.result?.userErrors ?? []).map((e) => e.message),
    ...(actionData?.topLevelErrors ?? []),
  ];

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
                Registers the <code>{handle}</code> function so bundles built on the
                storefront are charged their fixed bundle price. This must be run
                from inside this app — a cart transform created by any other client
                is accepted but never runs.
              </Text>

              {loadError && (
                <Banner tone="warning" title="Could not read functions or transforms">
                  <Text as="p" variant="bodyMd">{loadError}</Text>
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
                    {errors.map((m, i) => (
                      <List.Item key={i}>{m}</List.Item>
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
                Functions visible to this app
              </Text>
              {functions.length === 0 && (
                <Text as="p" variant="bodyMd" tone="subdued">None returned.</Text>
              )}
              {functions.map((f) => (
                <BlockStack key={f.id} gap="050">
                  <Text as="p" variant="bodyMd">
                    {f.title} — {f.apiType}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {f.id} · app: {f.app?.title || "unknown"}
                  </Text>
                </BlockStack>
              ))}
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
                <Text as="p" variant="bodyMd" tone="subdued">None registered.</Text>
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
