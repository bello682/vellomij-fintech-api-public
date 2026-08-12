require("dotenv/config");

const prisma = require("./confiq/prismaClient");

async function testPrisma() {
  try {
    console.log("Testing Prisma connection...");

    const result = await prisma.$queryRaw`SELECT NOW()`;

    console.log("✅ PRISMA CONNECTION SUCCESSFUL");
    console.log(result);
  } catch (error) {
    console.error("❌ PRISMA CONNECTION FAILED");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();
