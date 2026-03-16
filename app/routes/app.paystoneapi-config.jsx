// // app/routes/paystoneapi.get.jsx
// import { authenticate } from "../shopify.server";
// import prisma from "../db.server";

// export async function loader({ request }) {
//   const { session } = await authenticate.admin(request);

//   // Find the shop
//   const shop = await prisma.shop.findUnique({
//     where: { shopDomain: session.shop },
//   });

//   if (!shop) {
//     return new Response(
//       JSON.stringify({ error: "Shop not found" }),
//       { status: 400 }
//     );
//   }

//   // Fetch Paystone config
//   const config = await prisma.paystoneConfig.findUnique({
//     where: { shopId: BigInt(shop.id) },
//   });

//   if (!config) {
//     return new Response(
//       JSON.stringify({ error: "No config found" }),
//       { status: 404 }
//     );
//   }

//   // Convert BigInt → string for JSON
//   const safeConfig = { ...config, shopId: config.shopId.toString() };

//   return new Response(JSON.stringify(safeConfig), {
//     headers: { "Content-Type": "application/json" },
//   });
// }
// app/routes/api/paystone-config.jsx
// app/routes/app.paystoneapi-config.jsx

// app/routes/app.paystoneapi-config.jsx

import prisma from "../db.server";

/* =========================
   CORS HEADERS
========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* =========================
   OPTIONS (Preflight)
========================= */
export function options() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/* =========================
   LOADER
========================= */
export async function loader({ request }) {
  try {
    const url = new URL(request.url);

    const shopDomain = url.searchParams.get("shop");
    const voucher = url.searchParams.get("voucher");

    console.log("API CALLED WITH:", shopDomain, voucher);

    if (!shopDomain) {
      return new Response(
        JSON.stringify({ error: "Missing shop parameter" }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    /* =========================
       FIND SHOP
    ========================= */
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    /* =========================
       LOAD PAYSTONE CONFIG
    ========================= */
    const config = await prisma.paystoneConfig.findUnique({
      where: { shopId: shop.id },
    });

    console.log("Loaded Paystone Config:", config);

    /* =========================
       RETURN RESPONSE
    ========================= */
    return new Response(
      JSON.stringify({
        success: true,
        voucher,
        config,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Paystone API Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal Server Error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}