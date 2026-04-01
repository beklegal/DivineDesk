import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BILLING_PLANS,
  billingHasFeature,
  billingHasReportAccess,
  getBillingPlanMemberLimit,
  getEffectiveBillingEntitlements,
  getSelfServeBillingPlans,
  hasBillingPlanFeature,
  hasBillingPlanReportAccess,
  isSelfServeBillingPlanKey,
} from "../../shared/api.js";
import {
  createChurchBilling,
  ensureChurchBilling,
  getAdminBillingPlans,
  isChurchBillingBlocked,
  mergeChurchBilling,
} from "./billing.js";

describe("billing plan metadata", () => {
  it("publishes the new pricing ladder and public labels", () => {
    expect(
      BILLING_PLANS.map((plan) => ({
        key: plan.key,
        amount: plan.amount,
        publicPriceLabel: plan.publicPriceLabel,
        selfServeEnabled: plan.selfServeEnabled,
        memberLimit: plan.memberLimit,
        reportAccess: plan.reportAccess,
      })),
    ).toEqual([
      {
        key: "starter",
        amount: 10,
        publicPriceLabel: "$10/month",
        selfServeEnabled: true,
        memberLimit: 100,
        reportAccess: "basic",
      },
      {
        key: "growth",
        amount: 25,
        publicPriceLabel: "$25/month",
        selfServeEnabled: true,
        memberLimit: 500,
        reportAccess: "advanced",
      },
      {
        key: "enterprise",
        amount: 50,
        publicPriceLabel: "$50/month",
        selfServeEnabled: true,
        memberLimit: null,
        reportAccess: "full",
      },
      {
        key: "custom",
        amount: 50,
        publicPriceLabel: "Custom pricing",
        selfServeEnabled: false,
        memberLimit: null,
        reportAccess: "full",
      },
    ]);
    expect(getSelfServeBillingPlans().map((plan) => plan.key)).toEqual([
      "starter",
      "growth",
      "enterprise",
    ]);
    expect(isSelfServeBillingPlanKey("custom")).toBe(false);
    expect(getBillingPlanMemberLimit("starter")).toBe(100);
    expect(getBillingPlanMemberLimit("enterprise")).toBeNull();
    expect(hasBillingPlanFeature("starter", "giving")).toBe(false);
    expect(hasBillingPlanFeature("growth", "giving")).toBe(true);
    expect(hasBillingPlanFeature("growth", "multi_branch_management")).toBe(false);
    expect(hasBillingPlanFeature("enterprise", "multi_branch_management")).toBe(true);
    expect(hasBillingPlanReportAccess("starter", "basic")).toBe(true);
    expect(hasBillingPlanReportAccess("growth", "advanced")).toBe(true);
    expect(hasBillingPlanReportAccess("growth", "full")).toBe(false);
  });

  it("uses new list pricing for new churches while preserving stored amounts for existing ones", () => {
    expect(createChurchBilling({ size: "small" }).amount).toBe(10);
    expect(createChurchBilling({ size: "medium" }).amount).toBe(25);
    expect(createChurchBilling({ size: "large" }).amount).toBe(50);

    const existingBilling = ensureChurchBilling({
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

    expect(existingBilling.amount).toBe(10);
  });

  it("treats hosted checkout urls as valid self-serve billing configuration", () => {
    const previousStarterCheckoutUrl = process.env.PAYSTACK_STARTER_CHECKOUT_URL;

    process.env.PAYSTACK_STARTER_CHECKOUT_URL = "https://paystack.shop/pay/starter-link";

    try {
      const starterPlan = getAdminBillingPlans().find((plan) => plan.key === "starter");

      expect(starterPlan?.paystackCheckoutUrl).toBe("https://paystack.shop/pay/starter-link");
      expect(starterPlan?.isConfigured).toBe(true);
    } finally {
      if (previousStarterCheckoutUrl === undefined) {
        delete process.env.PAYSTACK_STARTER_CHECKOUT_URL;
      } else {
        process.env.PAYSTACK_STARTER_CHECKOUT_URL = previousStarterCheckoutUrl;
      }
    }
  });

  it("applies super-admin entitlement overrides on top of plan defaults", () => {
    const billing = mergeChurchBilling(createChurchBilling({ planKey: "starter" }), {
      entitlementOverrides: {
        memberLimit: 250,
        reportAccess: "full",
        enabledFeatures: ["giving", "priority_support"],
      },
    });

    expect(getEffectiveBillingEntitlements(billing)).toEqual({
      memberLimit: 250,
      reportAccess: "full",
      features: ["giving", "priority_support"],
    });
    expect(billingHasFeature(billing, "giving")).toBe(true);
    expect(billingHasReportAccess(billing, "advanced")).toBe(true);
  });

  it("lets super admins remove included plan access or clear overrides later", () => {
    const growthBilling = mergeChurchBilling(createChurchBilling({ planKey: "growth" }), {
      entitlementOverrides: {
        disabledFeatures: ["giving"],
        memberLimit: null,
      },
    });

    expect(getEffectiveBillingEntitlements(growthBilling)).toEqual({
      memberLimit: null,
      reportAccess: "advanced",
      features: ["delegated_access"],
    });
    expect(billingHasFeature(growthBilling, "giving")).toBe(false);

    const clearedBilling = mergeChurchBilling(growthBilling, {
      entitlementOverrides: null,
    });

    expect(getEffectiveBillingEntitlements(clearedBilling)).toEqual({
      memberLimit: 500,
      reportAccess: "advanced",
      features: ["giving", "delegated_access"],
    });
  });
});

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
