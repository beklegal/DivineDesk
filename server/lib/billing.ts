import crypto from "crypto";
import type {
  AdminBillingPlan,
  BillingPlan,
  Church,
  ChurchBilling,
  CreatePaystackCheckoutRequest,
  PaystackCheckoutResponse,
  SubscriptionPlanKey,
  SubscriptionStatus,
  UpdateChurchBillingRequest,
} from "../../shared/api.js";
import {
  BILLING_PLANS,
  DEFAULT_BILLING_TRIAL_DAYS,
  isChurchWorkspaceLocked,
} from "../../shared/api.js";

const PAYSTACK_API_BASE_URL = "https://api.paystack.co";
const DEFAULT_APP_URL = "http://localhost:8080";
const DEFAULT_TRIAL_DAYS = DEFAULT_BILLING_TRIAL_DAYS;

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function parseOptionalDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFutureDate(value?: string, now = new Date()) {
  const parsed = parseOptionalDate(value);
  return parsed ? parsed.getTime() > now.getTime() : false;
}

function hasDatePassed(value?: string, now = new Date()) {
  const parsed = parseOptionalDate(value);
  return parsed ? parsed.getTime() <= now.getTime() : false;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalEmail(value: unknown) {
  return normalizeOptionalString(value)?.toLowerCase();
}

function toPositiveNumber(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function resolveRenewalDate(billing?: Partial<ChurchBilling> | null) {
  const existingRenewalDate = normalizeOptionalString(billing?.renewalDate);
  if (existingRenewalDate) {
    return existingRenewalDate;
  }

  const lastPaymentAt = normalizeOptionalString(billing?.lastPaymentAt);
  if (lastPaymentAt) {
    return addDays(lastPaymentAt, 30);
  }

  return undefined;
}

function resolveBillingStatus(options: {
  status?: SubscriptionStatus;
  trialEndsAt?: string;
  renewalDate?: string;
}) {
  const { status, trialEndsAt, renewalDate } = options;

  if (status === "canceled" || status === "suspended") {
    return status;
  }

  if (status === "trialing") {
    if (isFutureDate(trialEndsAt)) {
      return "trialing";
    }

    if (isFutureDate(renewalDate)) {
      return "active";
    }

    return "past_due";
  }

  if (status === "past_due") {
    return isFutureDate(renewalDate) ? "active" : "past_due";
  }

  if (status === "active") {
    if (hasDatePassed(renewalDate)) {
      return "past_due";
    }

    if (isFutureDate(renewalDate)) {
      return "active";
    }

    if (isFutureDate(trialEndsAt)) {
      return "trialing";
    }

    return "past_due";
  }

  if (isFutureDate(renewalDate)) {
    return "active";
  }

  if (isFutureDate(trialEndsAt)) {
    return "trialing";
  }

  return "past_due";
}

function getPlanAmount(plan: BillingPlan, amount?: number) {
  const normalizedAmount = toPositiveNumber(amount);

  if (plan.key === "custom") {
    return normalizedAmount ?? plan.amount;
  }

  return plan.amount;
}

export function inferPlanKeyFromChurchSize(size: Church["size"]): SubscriptionPlanKey {
  if (size === "large") {
    return "enterprise";
  }

  if (size === "medium") {
    return "growth";
  }

  return "starter";
}

export function getBillingPlan(planKey?: SubscriptionPlanKey): BillingPlan {
  return (
    BILLING_PLANS.find((plan) => plan.key === planKey) ??
    BILLING_PLANS[0]
  );
}

export function getPaystackPlanCode(planKey: SubscriptionPlanKey) {
  const envMap: Record<SubscriptionPlanKey, string | undefined> = {
    starter: process.env.PAYSTACK_STARTER_PLAN_CODE,
    growth: process.env.PAYSTACK_GROWTH_PLAN_CODE,
    enterprise: process.env.PAYSTACK_ENTERPRISE_PLAN_CODE,
    custom: process.env.PAYSTACK_CUSTOM_PLAN_CODE,
  };

  return normalizeOptionalString(envMap[planKey]);
}

export function getAdminBillingPlans(): AdminBillingPlan[] {
  return BILLING_PLANS.map((plan) => {
    const paystackPlanCode = getPaystackPlanCode(plan.key);

    return {
      ...plan,
      paystackPlanCode,
      isConfigured: Boolean(paystackPlanCode),
    };
  });
}

export function isChurchBillingBlocked(church: Pick<Church, "billing" | "status">) {
  return isChurchWorkspaceLocked(church);
}

export function createChurchBilling(options: {
  size?: Church["size"];
  planKey?: SubscriptionPlanKey;
  status?: SubscriptionStatus;
  startedAt?: string;
  billingEmail?: string;
  trialDays?: number;
  renewalDate?: string;
  trialEndsAt?: string;
  amount?: number;
  customerCode?: string;
  subscriptionCode?: string;
  planCode?: string;
  authorizationCode?: string;
  lastPaymentReference?: string;
  lastPaymentAt?: string;
} = {}): ChurchBilling {
  const startedAt = options.startedAt ?? new Date().toISOString();
  const inferredPlanKey = options.planKey ?? inferPlanKeyFromChurchSize(options.size ?? "small");
  const plan = getBillingPlan(inferredPlanKey);
  const status = options.status ?? "trialing";
  const trialDays = options.trialDays ?? DEFAULT_TRIAL_DAYS;

  return {
    provider: "paystack",
    planKey: plan.key,
    planName: plan.name,
    amount: getPlanAmount(plan, options.amount),
    currency: plan.currency,
    interval: plan.interval,
    status,
    billingEmail: normalizeOptionalEmail(options.billingEmail),
    startedAt,
    renewalDate:
      options.renewalDate ??
      (status === "active" || status === "past_due" ? addDays(startedAt, 30) : undefined),
    trialEndsAt:
      options.trialEndsAt ??
      (status === "trialing" ? addDays(startedAt, trialDays) : undefined),
    customerCode: normalizeOptionalString(options.customerCode),
    subscriptionCode: normalizeOptionalString(options.subscriptionCode),
    planCode: normalizeOptionalString(options.planCode) ?? getPaystackPlanCode(plan.key),
    authorizationCode: normalizeOptionalString(options.authorizationCode),
    lastPaymentReference: normalizeOptionalString(options.lastPaymentReference),
    lastPaymentAt: normalizeOptionalString(options.lastPaymentAt),
  };
}

export function ensureChurchBilling(
  church: Partial<Church> & Pick<Church, "size" | "createdAt">,
): ChurchBilling {
  const now = new Date();
  const createdAt = church.createdAt ?? now.toISOString();
  const existingBilling = church.billing;
  const startedAt = existingBilling?.startedAt ?? createdAt;
  const inferredPlanKey =
    existingBilling?.planKey ?? inferPlanKeyFromChurchSize(church.size ?? "small");
  const plan = getBillingPlan(inferredPlanKey);
  const trialEndsAt =
    normalizeOptionalString(existingBilling?.trialEndsAt) ?? addDays(startedAt, DEFAULT_TRIAL_DAYS);
  const renewalDate = resolveRenewalDate(existingBilling);
  const inferredStatus = resolveBillingStatus({
    status: existingBilling?.status,
    trialEndsAt,
    renewalDate,
  });

  return {
    provider: "paystack",
    planKey: plan.key,
    planName: plan.name,
    amount: getPlanAmount(plan, existingBilling?.amount),
    currency: plan.currency,
    interval: plan.interval,
    status: inferredStatus,
    billingEmail:
      normalizeOptionalEmail(existingBilling?.billingEmail) ??
      normalizeOptionalEmail(church.adminEmail) ??
      normalizeOptionalEmail(church.email),
    startedAt,
    renewalDate,
    trialEndsAt,
    customerCode: normalizeOptionalString(existingBilling?.customerCode),
    subscriptionCode: normalizeOptionalString(existingBilling?.subscriptionCode),
    planCode:
      normalizeOptionalString(existingBilling?.planCode) ?? getPaystackPlanCode(plan.key),
    authorizationCode: normalizeOptionalString(existingBilling?.authorizationCode),
    lastPaymentReference: normalizeOptionalString(existingBilling?.lastPaymentReference),
    lastPaymentAt: normalizeOptionalString(existingBilling?.lastPaymentAt),
  };
}

export function mergeChurchBilling(
  existingBilling: ChurchBilling,
  update?: UpdateChurchBillingRequest,
): ChurchBilling {
  if (!update) {
    const plan = getBillingPlan(existingBilling.planKey);

    return {
      ...existingBilling,
      planName: plan.name,
      amount: getPlanAmount(plan, existingBilling.amount),
      currency: plan.currency,
      interval: plan.interval,
      planCode: existingBilling.planCode ?? getPaystackPlanCode(plan.key),
    };
  }

  const plan = getBillingPlan(update.planKey ?? existingBilling.planKey);
  const planChanged = Boolean(update.planKey) && update.planKey !== existingBilling.planKey;

  return {
    ...existingBilling,
    planKey: plan.key,
    planName: plan.name,
    amount:
      toPositiveNumber(update.amount) ??
      (planChanged
        ? plan.amount
        : getPlanAmount(plan, existingBilling.amount)),
    currency: plan.currency,
    interval: plan.interval,
    status: update.status ?? existingBilling.status,
    billingEmail:
      normalizeOptionalEmail(update.billingEmail) ??
      existingBilling.billingEmail,
    renewalDate:
      normalizeOptionalString(update.renewalDate) ??
      existingBilling.renewalDate,
    trialEndsAt:
      normalizeOptionalString(update.trialEndsAt) ??
      existingBilling.trialEndsAt,
    customerCode:
      normalizeOptionalString(update.customerCode) ??
      existingBilling.customerCode,
    subscriptionCode:
      normalizeOptionalString(update.subscriptionCode) ??
      existingBilling.subscriptionCode,
    planCode:
      normalizeOptionalString(update.planCode) ??
      existingBilling.planCode ??
      getPaystackPlanCode(plan.key),
    authorizationCode:
      normalizeOptionalString(update.authorizationCode) ??
      existingBilling.authorizationCode,
    lastPaymentReference:
      normalizeOptionalString(update.lastPaymentReference) ??
      existingBilling.lastPaymentReference,
    lastPaymentAt:
      normalizeOptionalString(update.lastPaymentAt) ??
      existingBilling.lastPaymentAt,
  };
}

export function getBillingSnapshot(churches: Church[]) {
  const subscriptionsByPlan = BILLING_PLANS.map((plan) => {
    const churchesOnPlan = churches.filter((church) => church.billing.planKey === plan.key);

    return {
      planKey: plan.key,
      planName: plan.name,
      churches: churchesOnPlan.length,
      monthlyRevenue: churchesOnPlan.reduce(
        (total, church) =>
          ["active", "past_due"].includes(church.billing.status)
            ? total + church.billing.amount
            : total,
        0,
      ),
    };
  });

  return {
    monthlyRecurringRevenue: churches.reduce(
      (total, church) =>
        ["active", "past_due"].includes(church.billing.status)
          ? total + church.billing.amount
          : total,
      0,
    ),
    trialChurches: churches.filter((church) => church.billing.status === "trialing").length,
    pastDueChurches: churches.filter((church) => church.billing.status === "past_due").length,
    canceledChurches: churches.filter((church) =>
      ["canceled", "suspended"].includes(church.billing.status),
    ).length,
    subscriptionsByPlan,
  };
}

function getPaystackSecretKey() {
  return normalizeOptionalString(process.env.PAYSTACK_SECRET_KEY);
}

export function getAppBaseUrl() {
  return normalizeOptionalString(process.env.APP_URL) ?? DEFAULT_APP_URL;
}

async function callPaystack<T>(path: string, init?: RequestInit): Promise<T> {
  const secretKey = getPaystackSecretKey();
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const response = await fetch(`${PAYSTACK_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json();

  if (!response.ok || payload.status === false) {
    throw new Error(payload.message || "Paystack request failed");
  }

  return payload as T;
}

export async function createPaystackCheckoutSession(options: {
  church: Church;
  request: CreatePaystackCheckoutRequest;
  source?: "divinedesk_admin" | "divinedesk_church";
  cancelAction?: string;
}): Promise<PaystackCheckoutResponse> {
  const plan = getBillingPlan(options.request.planKey);
  const amount = getPlanAmount(plan, options.church.billing.amount);
  const paystackPlanCode = getPaystackPlanCode(plan.key);

  if (!paystackPlanCode) {
    throw new Error(`No Paystack plan code configured for the ${plan.name} plan`);
  }

  const billingEmail =
    normalizeOptionalString(options.request.billingEmail) ??
    normalizeOptionalString(options.church.billing.billingEmail) ??
    normalizeOptionalString(options.church.adminEmail) ??
    normalizeOptionalString(options.church.email);

  if (!billingEmail) {
    throw new Error("A billing email is required before starting checkout");
  }

  const reference = `dd_${options.church.id}_${Date.now()}`;
  const source = options.source ?? "divinedesk_admin";
  const callbackUrl =
    normalizeOptionalString(options.request.callbackUrl) ??
    (source === "divinedesk_church"
      ? `${getAppBaseUrl()}/subscription`
      : `${getAppBaseUrl()}/admin/churches/${options.church.id}`);
  const cancelAction =
    normalizeOptionalString(options.cancelAction) ??
    (source === "divinedesk_church"
      ? `${getAppBaseUrl()}/subscription`
      : `${getAppBaseUrl()}/admin/churches/${options.church.id}`);

  const payload = await callPaystack<{
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: billingEmail,
      amount: amount * 100,
      plan: paystackPlanCode,
      reference,
      callback_url: callbackUrl,
      metadata: {
        churchId: options.church.id,
        churchName: options.church.name,
        planKey: plan.key,
        planName: plan.name,
        source,
        cancel_action: cancelAction,
      },
    }),
  });

  return {
    authorizationUrl: payload.data.authorization_url,
    accessCode: payload.data.access_code,
    reference: payload.data.reference,
  };
}

export async function verifyPaystackTransaction(reference: string) {
  return callPaystack<any>(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  });
}

export function verifyPaystackSignature(body: unknown, signature?: string | string[]) {
  const secretKey = getPaystackSecretKey();
  if (!secretKey || typeof signature !== "string") {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha512", secretKey)
    .update(JSON.stringify(body))
    .digest("hex");

  return expectedSignature === signature;
}
