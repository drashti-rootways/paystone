export async function ensureVoucherDiscount(admin) {
  const TITLE = "Paystone Voucher Discount";

  // 1️⃣ Check if already exists
  const query = `
    query {
      discountNodes(first: 20) {
        edges {
          node {
            id
            discount {
              __typename
              ... on DiscountAutomaticApp {
                title
              }
            }
          }
        }
      }
    }
  `;

  const res = await admin.graphql(query);
  const json = await res.json();

  const existing = json.data.discountNodes.edges.find(
    (e) =>
      e.node.discount?.__typename === "DiscountAutomaticApp" &&
      e.node.discount.title === TITLE
  );

  if (existing) {
    console.log("✅ Voucher discount already exists");
    return existing.node.id;
  }

  // 2️⃣ Create new automatic discount
  const mutation = `
    mutation {
      discountAutomaticAppCreate(
        automaticAppDiscount: {
          title: "${TITLE}"
          startsAt: "${new Date().toISOString()}"
          functionId: "${process.env.SHOPIFY_DISCOUNT_FUNCTION_ID}"
          discountClasses: [ORDER]
          combinesWith: {
            productDiscounts: true
            orderDiscounts: true
            shippingDiscounts: false
          }
        }
      ) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const createRes = await admin.graphql(mutation);
  const createJson = await createRes.json();

  const errors = createJson.data.discountAutomaticAppCreate.userErrors;
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  console.log("✅ Voucher discount created");

  // 3️⃣ Refetch ID
  const refetchRes = await admin.graphql(query);
  const refetchJson = await refetchRes.json();

  const created = refetchJson.data.discountNodes.edges.find(
    (e) =>
      e.node.discount?.__typename === "DiscountAutomaticApp" &&
      e.node.discount.title === TITLE
  );

  if (!created) {
    throw new Error("Voucher discount created but not found");
  }

  return created.node.id;
}