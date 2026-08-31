import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "~/generated/prisma/client";
import env from "~/env";
import logger from "~/lib/logger";
import { createEncryptedPrismaClient } from "~/lib/prisma-encryption-extension";

const globalForDb = globalThis as typeof globalThis & {
  prisma?: ReturnType<typeof createEncryptedPrismaClient>;
  pgPool?: Pool;
};

function createPool() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  pool.on("error", (error) => {
    logger.error(`PostgreSQL pool error: ${error.message}`);
  });

  return pool;
}

const pool = globalForDb.pgPool ?? createPool();

const baseClient = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const prisma = globalForDb.prisma ?? createEncryptedPrismaClient(baseClient);

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
  globalForDb.prisma = prisma;
}

export default prisma;
