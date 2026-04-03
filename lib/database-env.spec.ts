import { describe, expect, it } from "vitest";
import { getPrismaDatabaseUrl, getRuntimeDatabaseUrl } from "./database-env.js";

describe("database env resolution", () => {
  it("prefers runtime-oriented Neon URLs before direct Prisma URLs", () => {
    expect(
      getRuntimeDatabaseUrl({
        DATABASE_URL: "postgres://runtime-pooled",
        POSTGRES_PRISMA_URL: "postgres://prisma-direct",
        DIRECT_URL: "postgres://manual-direct",
      }),
    ).toBe("postgres://runtime-pooled");
  });

  it("falls back to direct URLs for runtime when pooled URLs are missing", () => {
    expect(
      getRuntimeDatabaseUrl({
        POSTGRES_PRISMA_URL: "postgres://prisma-direct",
        DIRECT_URL: "postgres://manual-direct",
      }),
    ).toBe("postgres://prisma-direct");
  });

  it("prefers direct URLs for Prisma and trims whitespace", () => {
    expect(
      getPrismaDatabaseUrl({
        DIRECT_URL: "  postgres://manual-direct  ",
        DATABASE_URL: "postgres://runtime-pooled",
      }),
    ).toBe("postgres://manual-direct");
  });

  it("ignores placeholder example URLs", () => {
    expect(
      getRuntimeDatabaseUrl({
        DATABASE_URL: "postgres://username:password@your-neon-host-pooler.neon.tech/neondb",
        DIRECT_URL: "postgres://username:password@your-neon-host.neon.tech/neondb",
      }),
    ).toBeNull();
  });

  it("ignores invalid database URL strings", () => {
    expect(
      getPrismaDatabaseUrl({
        DIRECT_URL: "not-a-url",
        DATABASE_URL: "still-not-a-url",
      }),
    ).toBeNull();
  });
});
