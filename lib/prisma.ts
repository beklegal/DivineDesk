import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __divinedeskPrisma?: PrismaClient;
};

export function getPrismaDatabaseUrl() {
  return (
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    null
  );
}

export function getPrismaClient() {
  if (globalForPrisma.__divinedeskPrisma) {
    return globalForPrisma.__divinedeskPrisma;
  }

  const databaseUrl = getPrismaDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      "Prisma requires DIRECT_URL, DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL.",
    );
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__divinedeskPrisma = prisma;
  }

  return prisma;
}
