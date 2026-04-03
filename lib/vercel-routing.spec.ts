import { describe, expect, it } from "vitest";
import { normalizeVercelFunctionUrl } from "./vercel-routing.js";

describe("normalizeVercelFunctionUrl", () => {
  it("adds the api prefix for root-level function routes", () => {
    expect(normalizeVercelFunctionUrl("/ping", "/api")).toBe("/api/ping");
  });

  it("keeps fully qualified api URLs unchanged", () => {
    expect(normalizeVercelFunctionUrl("/api/debug-env?verbose=1", "/api")).toBe("/api/debug-env?verbose=1");
  });

  it("rebuilds nested auth function URLs from the matched subpath", () => {
    expect(normalizeVercelFunctionUrl("/signup?plan=starter", "/api/auth")).toBe(
      "/api/auth/signup?plan=starter",
    );
  });

  it("adds only the missing api prefix when the namespace is already present", () => {
    expect(normalizeVercelFunctionUrl("/auth/me", "/api/auth")).toBe("/api/auth/me");
  });

  it("supports deeper nested namespaces such as church billing routes", () => {
    expect(normalizeVercelFunctionUrl("/billing/verify", "/api/church")).toBe(
      "/api/church/billing/verify",
    );
  });
});
