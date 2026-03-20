import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureChurchBilling, isChurchBillingBlocked } from "./billing";

describe("billing lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps new churches in their 30-day free trial", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));

    const billing = ensureChurchBilling({
      size: "small",
      createdAt: "2026-03-20T00:00:00.000Z",
    });

    expect(billing.status).toBe("trialing");
    expect(billing.trialEndsAt).toBe("2026-04-19T00:00:00.000Z");
    expect(isChurchBillingBlocked({ status: "active", billing })).toBe(false);
  });

  it("locks the workspace when the free trial expires without payment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00.000Z"));

    const billing = ensureChurchBilling({
      size: "small",
      createdAt: "2026-03-20T00:00:00.000Z",
      billing: {
        provider: "paystack",
        planKey: "starter",
        planName: "Starter",
        amount: 10,
        currency: "USD",
        interval: "monthly",
        status: "trialing",
        startedAt: "2026-03-20T00:00:00.000Z",
      },
    });

    expect(billing.status).toBe("past_due");
    expect(isChurchBillingBlocked({ status: "active", billing })).toBe(true);
  });

  it("keeps paid subscriptions active until the renewal date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T00:00:00.000Z"));

    const billing = ensureChurchBilling({
      size: "medium",
      createdAt: "2026-03-01T00:00:00.000Z",
      billing: {
        provider: "paystack",
        planKey: "growth",
        planName: "Growth",
        amount: 10,
        currency: "USD",
        interval: "monthly",
        status: "active",
        startedAt: "2026-03-01T00:00:00.000Z",
        renewalDate: "2026-04-30T00:00:00.000Z",
      },
    });

    expect(billing.status).toBe("active");
    expect(isChurchBillingBlocked({ status: "active", billing })).toBe(false);
  });

  it("marks subscriptions past due after the monthly renewal date passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T00:00:00.000Z"));

    const billing = ensureChurchBilling({
      size: "medium",
      createdAt: "2026-03-01T00:00:00.000Z",
      billing: {
        provider: "paystack",
        planKey: "growth",
        planName: "Growth",
        amount: 10,
        currency: "USD",
        interval: "monthly",
        status: "active",
        startedAt: "2026-03-01T00:00:00.000Z",
        renewalDate: "2026-05-01T00:00:00.000Z",
      },
    });

    expect(billing.status).toBe("past_due");
    expect(isChurchBillingBlocked({ status: "active", billing })).toBe(true);
  });

  it("reactivates a past-due church after a successful payment updates the next cycle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T00:00:00.000Z"));

    const billing = ensureChurchBilling({
      size: "large",
      createdAt: "2026-03-01T00:00:00.000Z",
      billing: {
        provider: "paystack",
        planKey: "enterprise",
        planName: "Enterprise",
        amount: 10,
        currency: "USD",
        interval: "monthly",
        status: "past_due",
        startedAt: "2026-03-01T00:00:00.000Z",
        lastPaymentAt: "2026-04-15T00:00:00.000Z",
      },
    });

    expect(billing.status).toBe("active");
    expect(billing.renewalDate).toBe("2026-05-15T00:00:00.000Z");
  });
});
