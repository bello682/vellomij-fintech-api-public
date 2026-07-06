// // confiq/prismaClient.js

// const { PrismaClient } = require("@prisma/client");
// const { PrismaPg } = require("@prisma/adapter-pg");
// const { Pool } = require("pg");

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// const adapter = new PrismaPg(pool);
// // Do not pass any objects inside here.
// // Prisma 7 will look for the DATABASE_URL in your environment variables automatically.

// // const prisma = new PrismaClient({ adapter });
// // Use a global variable to prevent creating new instances during hot reloads
// const globalForPrisma = global;
// const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

// if (process.env.NODE_ENV !== "production") {
//   globalForPrisma.prisma = prisma;
// }

// module.exports = prisma;

const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

// 1. Initialize the Pool with aggressive error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000, // Wait longer for a connection
  idleTimeoutMillis: 30000, // Close idle connections
});

// 2. Add an error listener to the pool to prevent it from crashing the app
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client", err);
});

const adapter = new PrismaPg(pool);

// 3. Keep the instance in a global object
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
