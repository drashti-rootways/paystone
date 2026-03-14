// import { authenticate } from "../shopify.server";
// import prisma from "../db.server";

// export async function action({ request }) {
//   const { session } = await authenticate.admin(request);

//   // Find shop from DB
//   const shop = await prisma.shop.findUnique({
//     where: { shopDomain: session.shop },
//   });

//   if (!shop) {
//     return new Response(JSON.stringify({ error: "Shop not found" }), {
//       status: 400,
//     });
//   }

//   const formData = await request.formData();

//    const pinValue = formData.get("skipPinVerification");

//   const skipPinVerification =
//     pinValue === "yes" ||
//     pinValue === "true" ||    // ✔️ added support
//     pinValue === true;        // ✔️ added support

//   console.log("Raw submitted:", pinValue);
//   console.log("Converted Boolean:", skipPinVerification);


// const data = {
//   shopId: BigInt(shop.id),
//   merchantUniqueId: formData.get("merchantUniqueId"),
//   merchantPassword: formData.get("merchantPassword"),
//   clientAccessKey: formData.get("clientAccessKey"),
//   gatewayUrl: formData.get("gatewayUrl"),
//   apiVersion: formData.get("apiVersion"),
//   preAuthTimeoutMinutes: parseInt(formData.get("preAuthTimeoutMinutes")),
//   skipPinVerification,   // ← REAL BOOLEAN
// };
//   console.log("Inserted Data:",data);

//   // Check if config exists
//   const existing = await prisma.paystoneConfig.findUnique({
//     where: { shopId: BigInt(shop.id) },
//   });

//   let result;

//   if (!existing) {
//     result = await prisma.paystoneConfig.create({ data });
//   } else {
//     result = await prisma.paystoneConfig.update({
//       where: { shopId: BigInt(shop.id) },
//       data,
//     });
//   }

//   // Convert BigInt → string before returning JSON
//   const safeResult = {
//     ...result,
//     shopId: result.shopId.toString(),
//   };

//   return new Response(JSON.stringify({ success: true, data: safeResult }), {
//     headers: { "Content-Type": "application/json" },
//   });
// }
// app/routes/paystoneapi.jsx
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  // Find shop from DB
  const shop = await prisma.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!shop) {
    return new Response(JSON.stringify({ error: "Shop not found" }), {
      status: 400,
    });
  }

  const formData = await request.formData();

  // NOTE: your form sends "true" or "false" strings from the select.
  // Convert to real boolean:
  const pinValue = formData.get("skipPinVerification");
  const skipPinVerification = pinValue === "true";

  // Parse numeric value safely, fallback to 5 (or any default)
  const preAuthTimeoutMinutesRaw = formData.get("preAuthTimeoutMinutes");
  const preAuthTimeoutMinutes = Number.isFinite(Number(preAuthTimeoutMinutesRaw))
    ? parseInt(preAuthTimeoutMinutesRaw, 10)
    : 5;

  // Build record for DB. IMPORTANT: adapt shopId type to your Prisma schema:
  // - If your paystoneConfig.shopId is an Int in Prisma, use Number(shop.id)
  // - If your paystoneConfig.shopId is BigInt, use BigInt(shop.id) *only if shop.id is convertible*
  // Here we assume Int (most common with MySQL + Prisma). Change as needed.
  const shopIdForPrisma = Number(shop.id);

  const data = {
    shopId: shopIdForPrisma,
    merchantUniqueId: formData.get("merchantUniqueId") || null,
    merchantPassword: formData.get("merchantPassword") || null,
    clientAccessKey: formData.get("clientAccessKey") || null,
    gatewayUrl: formData.get("gatewayUrl") || null,
    apiVersion: formData.get("apiVersion") || null,
    preAuthTimeoutMinutes,
    skipPinVerification,
  };

  console.log("Inserted Data (server):", data);

  // Check if config exists
  const existing = await prisma.paystoneConfig.findUnique({
    where: { shopId: shopIdForPrisma },
  });

  let result;
  if (!existing) {
    result = await prisma.paystoneConfig.create({ data });
  } else {
    result = await prisma.paystoneConfig.update({
      where: { shopId: shopIdForPrisma },
      data,
    });
  }

  // Convert any BigInt fields to string before returning JSON (if present)
  const safeResult = {
    ...result,
    shopId: result.shopId && typeof result.shopId === "bigint" ? result.shopId.toString() : result.shopId,
  };

  return new Response(JSON.stringify({ success: true, data: safeResult }), {
    headers: { "Content-Type": "application/json" },
  });
}
