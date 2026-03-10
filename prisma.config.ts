// prisma.config.ts
import "dotenv/config";
import type { PrismaConfig } from "prisma";

const config: PrismaConfig = {
  datasource: {
    url: process.env.DATABASE_URL!, // provider is inferred
  },
};

export default config;
