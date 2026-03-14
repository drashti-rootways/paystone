import prisma from "../db.server.js"

export async function getOrCreateShop(shopDomain) {
  console.log("🟡 getOrCreateShop called with:", shopDomain);

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    console.log("🆕 Creating shop entry for:", shopDomain);
    const newShop = await prisma.shop.create({
      data: { shopDomain },
    });
    console.log("✅ Created shop:", newShop);
    return newShop;
  }

  console.log("✅ Shop already exists:", shop);
  return shop;
}
