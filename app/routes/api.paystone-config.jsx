// app/routes/api.paystone-config.jsx
import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const voucher = url.searchParams.get("voucher");

  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  const config = await prisma.paystoneConfig.findUnique({
    where: { shopId: shopRecord.id },
  });

  return new Response(
    JSON.stringify({ success: true, config }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}