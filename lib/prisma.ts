import * as PrismaClientModule from "@prisma/client";

export interface PrismaUserRecord {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  churchId: string | null;
  branchId: string | null;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface PrismaUserDelegate {
  findMany(args?: unknown): Promise<PrismaUserRecord[]>;
  create(args: unknown): Promise<PrismaUserRecord>;
  upsert(args: unknown): Promise<PrismaUserRecord>;
  deleteMany(args?: unknown): Promise<unknown>;
}

export interface PrismaClientLike {
  user: PrismaUserDelegate;
}

const PrismaClientConstructor = (
  PrismaClientModule as unknown as {
    PrismaClient?: new (options?: unknown) => PrismaClientLike;
  }
).PrismaClient;

const globalForPrisma = globalThis as typeof globalThis & {
  __divinedeskPrisma?: PrismaClientLike;
};

export function getPrismaDatabaseUrl() {
  return (
    process.env.DIRECT_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
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

  if (!PrismaClientConstructor) {
    throw new Error(
      "PrismaClient is unavailable. Ensure `pnpm prisma:generate` runs before starting the server.",
    );
  }

  const databaseUrl = getPrismaDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      "Prisma requires DIRECT_URL, POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, DATABASE_URL, or POSTGRES_URL.",
    );
  }

  const prisma = new PrismaClientConstructor({
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
