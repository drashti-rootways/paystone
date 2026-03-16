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
export async function loader({ request }) { 
 const url = new URL(request.url);
 const shopDomain = url.searchParams.get("shop"); 
 const voucher = url.searchParams.get("voucher"); 
 console.log("API CALLED WITH:", shopDomain, voucher); 
 if (!shopDomain)
 return new Response(JSON.stringify({ 
 error: "Missing shop" 
 }), 
 { status: 400, }); 
 const shop = await prisma.shop.findUnique({ where: { shopDomain }, }); 
 if (!shop) 
 return new Response(JSON.stringify({ error: "Shop not found" }), 
 { status: 404, });
 
 const config = await prisma.paystoneConfig.findUnique({ where: { shopId: shop.id }, }); 
 console.log("Loaded Paystone Config:", config); 
 return Response.json({ success: true, voucher, config, }); }