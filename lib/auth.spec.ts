import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  getSessionTokenFromHeaders,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from "./auth.js";

describe("auth utilities", () => {
  it("hashes passwords before verification", async () => {
    const hashedPassword = await hashPassword("secret123");

    expect(hashedPassword).not.toBe("secret123");
    await expect(verifyPassword("secret123", hashedPassword)).resolves.toBe(true);
    await expect(verifyPassword("wrong-secret", hashedPassword)).resolves.toBe(false);
  });

  it("creates and verifies a signed session token", () => {
    process.env.JWT_SECRET = "test-jwt-secret";

    const token = createSessionToken({
      userId: "user-1",
      churchId: "church-1",
      branchId: "branch-1",
      role: "admin",
    });

    expect(
      verifySessionToken(token),
    ).toMatchObject({
      userId: "user-1",
      churchId: "church-1",
      branchId: "branch-1",
      role: "admin",
    });
  });

  it("extracts the session token from bearer and cookie headers", () => {
    const token = "session-token";

    expect(
      getSessionTokenFromHeaders({
        authorization: `Bearer ${token}`,
      }),
    ).toBe(token);

    expect(
      getSessionTokenFromHeaders({
        cookie: `divinedesk_session=${token}; theme=dark`,
      }),
    ).toBe(token);
  });
});
