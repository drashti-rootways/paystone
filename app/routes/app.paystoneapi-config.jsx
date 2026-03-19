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
import prisma from "../db.server";

/* =========================
   SAFE JSON (BigInt fix)
========================= */
function safeJson(data) {
  return JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

/* =========================
   CORS HEADERS
========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* =========================
   OPTIONS
========================= */
export function options() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/* =========================
   HELPER FUNCTIONS
========================= */
function getGeneralUrl(pin, config) {
  return (
    `https://rootways.dcuat.com/ms2v2/trx/${config.clientAccessKey}/fit/` +
    `?MID=${config.merchantUniqueId}` +
    `&MPW=${config.merchantPassword}` +
    `&PRG=ppd` +
    `&VDP=TRUE` +
    `&PIN=${encodeURIComponent(pin)}`
    `&TRX=bal`
  );
}

function getGeneralUrlSecondPart(cid) {
  return (
    `&VER=2010-01-06` +
    `&LNG=en` +
    `&WAN=1` +
    `&WSN=1` +
    `&CID=${encodeURIComponent(cid)}` +
    `&DAT=`
  );
}

/* =========================
   LOADER
========================= */
export async function loader({ request }) {
  try {
    const url = new URL(request.url);

    const shopDomain = url.searchParams.get("shop");
    const voucher = url.searchParams.get("voucher"); // CID
    const pin = url.searchParams.get("pin");         // PIN

    if (!shopDomain) {
      return new Response(
        safeJson({ error: "Missing shop parameter" }),
        { status: 400, headers: corsHeaders }
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
        safeJson({ error: "Shop not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    /* =========================
       LOAD CONFIG
    ========================= */
    const config = await prisma.paystoneConfig.findUnique({
      where: { shopId: shop.id },
    });

    if (!config) {
      return new Response(
        safeJson({ error: "Config not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    /* =========================
       BUILD FINAL URL
    ========================= */
    let finalUrl = null;

    if (voucher) {
      finalUrl =
        getGeneralUrl(pin || "", config) +
        getGeneralUrlSecondPart(voucher);
    }
    console.log("PIN:", pin);
    console.log("Voucher:", voucher);
    console.log("Final Paystone URL:", finalUrl);

    /* =========================
       RETURN RESPONSE
    ========================= */
    return new Response(
      safeJson({
        success: true,
        voucher,
        pin,
        config,
        paystoneUrl: finalUrl,
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
      safeJson({
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