// confiq/prismaClient.js

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
// Do not pass any objects inside here.
// Prisma 7 will look for the DATABASE_URL in your environment variables automatically.

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
