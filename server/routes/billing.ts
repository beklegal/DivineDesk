import { RequestHandler } from "express";
import type {
  Church,
  ChurchSubscriptionPaymentRecord,
  CreateChurchSubscriptionPaymentRecordRequest,
  CreatePaystackCheckoutRequest,
  SubscriptionPaymentMethod,
  UpdateChurchBillingRequest,
} from "../../shared/api";
import {
  SUBSCRIPTION_PAYMENT_METHODS,
} from "../../shared/api";
import {
  createPaystackCheckoutSession,
  ensureChurchBilling,
  getAppBaseUrl,
  getAdminBillingPlans,
  getBillingPlan,
  getPaystackPlanCode,
  mergeChurchBilling,
  verifyPaystackSignature,
  verifyPaystackTransaction,
} from "../lib/billing";
import { createId, type DivineDeskDatabase, readDatabase, updateDatabase } from "../data/database";

const BILLING_CYCLE_DAYS = 30;

function requireSuperAdmin(req: any, res: any) {
  if (req.user?.role !== "super_admin") {
    res.status(403).json({ success: false, error: "Super admin access required" });
    return false;
  }

  return true;
}

function requireChurchBillingUser(req: any, res: any) {
  if (!req.user || !req.churchId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return null;
  }

  return req.churchId as string;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toPositiveAmount(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normalizeDateTime(value?: string, fallback?: string) {
  const candidate = value ?? fallback;
  if (!candidate) {
    return undefined;
  }

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function isSubscriptionPaymentMethod(value: unknown): value is SubscriptionPaymentMethod {
  return SUBSCRIPTION_PAYMENT_METHODS.includes(value as SubscriptionPaymentMethod);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNestedValue(value: unknown, ...path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function getNestedString(value: unknown, ...path: string[]) {
  return toOptionalString(getNestedValue(value, ...path));
}

function findPlanKeyByPlanCode(planCode?: string) {
  if (!planCode) {
    return undefined;
  }

  return getAdminBillingPlans().find((plan) => plan.paystackPlanCode === planCode)?.key;
}

function normalizePlanKey(value?: string) {
  if (!value) {
    return undefined;
  }

  return getAdminBillingPlans().find((plan) => plan.key === value)?.key;
}

function findChurchFromPayload(churches: Church[], payload: unknown) {
  const churchId = getNestedString(payload, "data", "metadata", "churchId");
  if (churchId) {
    return churches.find((church) => church.id === churchId);
  }

  const customerCode =
    getNestedString(payload, "data", "customer", "customer_code") ??
    getNestedString(payload, "data", "customer_code");
  if (customerCode) {
    return churches.find((church) => church.billing.customerCode === customerCode);
  }

  const subscriptionCode =
    getNestedString(payload, "data", "subscription_code") ??
    getNestedString(payload, "data", "subscription", "subscription_code");
  if (subscriptionCode) {
    return churches.find((church) => church.billing.subscriptionCode === subscriptionCode);
  }

  const billingEmail =
    getNestedString(payload, "data", "customer", "email") ??
    getNestedString(payload, "data", "email");
  if (billingEmail) {
    const normalizedEmail = billingEmail.toLowerCase();

    return churches.find((church) =>
      [
        church.billing.billingEmail,
        church.adminEmail,
        church.email,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase() === normalizedEmail),
    );
  }

  return undefined;
}

function sortSubscriptionPayments(records: ChurchSubscriptionPaymentRecord[]) {
  return [...records].sort((left, right) => {
    const paidAtDiff = new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime();

    if (paidAtDiff !== 0) {
      return paidAtDiff;
    }

    return (
      new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime()
    );
  });
}

function getChurchSubscriptionPayments(
  database: DivineDeskDatabase,
  churchId: string,
) {
  return sortSubscriptionPayments(
    database.subscriptionPayments.filter((payment) => payment.churchId === churchId),
  );
}

function upsertChurchSubscriptionPayment(
  database: DivineDeskDatabase,
  payment: ChurchSubscriptionPaymentRecord,
) {
  const existingIndex =
    payment.reference
      ? database.subscriptionPayments.findIndex(
          (candidate) =>
            candidate.churchId === payment.churchId &&
            candidate.reference === payment.reference,
        )
      : -1;

  if (existingIndex >= 0) {
    const existing = database.subscriptionPayments[existingIndex];
    const nextPayment = {
      ...existing,
      ...payment,
      id: existing.id,
    };

    database.subscriptionPayments[existingIndex] = nextPayment;
    return nextPayment;
  }

  database.subscriptionPayments.push(payment);
  return payment;
}

function buildManualSubscriptionPaymentRecord(options: {
  church: Church;
  request: CreateChurchSubscriptionPaymentRecordRequest;
  recordedByUserId: string;
  recordedByName?: string;
}) {
  const recordedAt = new Date().toISOString();
  const paidAt =
    normalizeDateTime(options.request.paidAt, recordedAt) ?? recordedAt;
  const periodStart =
    normalizeDateTime(options.request.periodStart, paidAt) ?? paidAt;
  const periodEnd =
    normalizeDateTime(options.request.periodEnd, addDays(periodStart, BILLING_CYCLE_DAYS)) ??
    addDays(periodStart, BILLING_CYCLE_DAYS);

  return {
    id: createId("subpay"),
    churchId: options.church.id,
    amount: toPositiveAmount(options.request.amount) ?? options.church.billing.amount,
    currency: options.church.billing.currency,
    method: options.request.method,
    source: "manual" as const,
    paidAt,
    periodStart,
    periodEnd,
    reference: toOptionalString(options.request.reference),
    notes: toOptionalString(options.request.notes),
    recordedAt,
    recordedByUserId: options.recordedByUserId,
    recordedByName: toOptionalString(options.recordedByName),
  } satisfies ChurchSubscriptionPaymentRecord;
}

function buildVerifiedSubscriptionPaymentRecord(options: {
  church: Church;
  payload: unknown;
  source: ChurchSubscriptionPaymentRecord["source"];
  recordedByUserId: string;
  recordedByName?: string;
  notes: string;
}) {
  const recordedAt = new Date().toISOString();
  const paidAt =
    normalizeDateTime(
      getNestedString(options.payload, "data", "paid_at") ??
        getNestedString(options.payload, "data", "transaction_date"),
      recordedAt,
    ) ?? recordedAt;
  const periodEnd =
    normalizeDateTime(
      getNestedString(options.payload, "data", "next_payment_date") ??
        getNestedString(options.payload, "data", "subscription", "next_payment_date"),
      addDays(paidAt, BILLING_CYCLE_DAYS),
    ) ?? addDays(paidAt, BILLING_CYCLE_DAYS);
  const paystackAmount = getNestedValue(options.payload, "data", "amount");

  return {
    id: createId("subpay"),
    churchId: options.church.id,
    amount:
      (typeof paystackAmount === "number" && paystackAmount > 0
        ? paystackAmount / 100
        : options.church.billing.amount) || options.church.billing.amount,
    currency: options.church.billing.currency,
    method: "paystack",
    source: options.source,
    paidAt,
    periodStart: paidAt,
    periodEnd,
    reference:
      getNestedString(options.payload, "data", "reference") ??
      options.church.billing.lastPaymentReference,
    notes: options.notes,
    recordedAt,
    recordedByUserId: options.recordedByUserId,
    recordedByName: toOptionalString(options.recordedByName),
  } satisfies ChurchSubscriptionPaymentRecord;
}

function buildBillingUpdateFromPayload(
  church: Church,
  payload: unknown,
  status?: UpdateChurchBillingRequest["status"],
): UpdateChurchBillingRequest {
  const paystackPlanCode =
    getNestedString(payload, "data", "plan", "plan_code") ??
    getNestedString(payload, "data", "plan_code") ??
    church.billing.planCode;
  const planKey =
    normalizePlanKey(getNestedString(payload, "data", "metadata", "planKey")) ??
    findPlanKeyByPlanCode(paystackPlanCode) ??
    church.billing.planKey;
  const plan = getBillingPlan(planKey);

  return {
    planKey: plan.key,
    status,
    billingEmail:
      getNestedString(payload, "data", "customer", "email") ??
      church.billing.billingEmail,
    customerCode:
      getNestedString(payload, "data", "customer", "customer_code") ??
      church.billing.customerCode,
    subscriptionCode:
      getNestedString(payload, "data", "subscription_code") ??
      getNestedString(payload, "data", "subscription", "subscription_code") ??
      church.billing.subscriptionCode,
    authorizationCode:
      getNestedString(payload, "data", "authorization", "authorization_code") ??
      church.billing.authorizationCode,
    planCode: paystackPlanCode ?? getPaystackPlanCode(plan.key),
    renewalDate:
      getNestedString(payload, "data", "next_payment_date") ??
      getNestedString(payload, "data", "subscription", "next_payment_date") ??
      church.billing.renewalDate,
    lastPaymentReference:
      getNestedString(payload, "data", "reference") ??
      church.billing.lastPaymentReference,
    lastPaymentAt:
      getNestedString(payload, "data", "paid_at") ??
      getNestedString(payload, "data", "transaction_date") ??
      church.billing.lastPaymentAt,
    amount: plan.key === "custom" ? church.billing.amount || plan.amount : plan.amount,
  };
}

export const handleGetAdminBillingPlans: RequestHandler = async (req: any, res) => {
  if (!requireSuperAdmin(req, res)) {
    return;
  }

  res.json({ success: true, data: getAdminBillingPlans() });
};

export const handleGetChurchSubscriptionPayments: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const churchId = req.params.churchId;
    const database = await readDatabase();
    const church = database.churches.find((candidate) => candidate.id === churchId);

    if (!church) {
      res.status(404).json({ success: false, error: "Church not found" });
      return;
    }

    res.json({
      success: true,
      data: getChurchSubscriptionPayments(database, churchId),
    });
  } catch {
    res.status(500).json({
      success: false,
      error: "Failed to load church subscription payments",
    });
  }
};

export const handleRecordChurchSubscriptionPayment: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const churchId = req.params.churchId;
    const request = (req.body ?? {}) as CreateChurchSubscriptionPaymentRecordRequest;

    if (!isSubscriptionPaymentMethod(request.method)) {
      res.status(400).json({ success: false, error: "A valid payment method is required" });
      return;
    }

    if (typeof request.amount === "number" && !toPositiveAmount(request.amount)) {
      res.status(400).json({ success: false, error: "Payment amount must be greater than zero" });
      return;
    }

    const result = await updateDatabase((database) => {
      const church = database.churches.find((candidate) => candidate.id === churchId);

      if (!church) {
        return { error: "Church not found" as const, statusCode: 404 };
      }

      const manualRecord = buildManualSubscriptionPaymentRecord({
        church,
        request,
        recordedByUserId: req.userId ?? "system",
        recordedByName: req.user?.name,
      });

      if (
        manualRecord.reference &&
        database.subscriptionPayments.some(
          (payment) =>
            payment.churchId === churchId &&
            payment.reference === manualRecord.reference,
        )
      ) {
        return {
          error: "A payment record with this reference already exists" as const,
          statusCode: 409,
        };
      }

      const billing = ensureChurchBilling(church);
      church.billing = mergeChurchBilling(billing, {
        status: "active",
        lastPaymentAt: manualRecord.paidAt,
        lastPaymentReference: manualRecord.reference,
        renewalDate: manualRecord.periodEnd,
      });

      const record = upsertChurchSubscriptionPayment(database, manualRecord);

      return {
        data: {
          church,
          record,
          records: getChurchSubscriptionPayments(database, churchId),
        },
      };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({
      success: false,
      error: "Failed to record church subscription payment",
    });
  }
};

export const handleCreateAdminPaystackCheckout: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const churchId = req.params.churchId;
    const request = req.body as CreatePaystackCheckoutRequest;

    if (!request?.planKey) {
      res.status(400).json({ success: false, error: "A billing plan is required" });
      return;
    }

    const database = await readDatabase();
    const church = database.churches.find((candidate) => candidate.id === churchId);

    if (!church) {
      res.status(404).json({ success: false, error: "Church not found" });
      return;
    }

    const checkout = await createPaystackCheckoutSession({
      church,
      request,
      source: "divinedesk_admin",
    });

    await updateDatabase((workingCopy) => {
      const targetChurch = workingCopy.churches.find((candidate) => candidate.id === churchId);

      if (!targetChurch) {
        return;
      }

      targetChurch.billing = mergeChurchBilling(ensureChurchBilling(targetChurch), {
        planKey: request.planKey,
        billingEmail: request.billingEmail,
        planCode: getPaystackPlanCode(request.planKey),
        lastPaymentReference: checkout.reference,
      });
    });

    res.status(201).json({ success: true, data: checkout });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to initialize Paystack checkout",
    });
  }
};

export const handleVerifyAdminPaystackPayment: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const churchId = req.params.churchId;
    const reference = toOptionalString(req.body?.reference);

    if (!reference) {
      res.status(400).json({ success: false, error: "A Paystack reference is required" });
      return;
    }

    const verification = await verifyPaystackTransaction(reference);

    if (verification?.data?.status !== "success") {
      res.status(400).json({ success: false, error: "Payment has not been completed yet" });
      return;
    }

    const result = await updateDatabase((database) => {
      const church = database.churches.find((candidate) => candidate.id === churchId);

      if (!church) {
        return { error: "Church not found" as const };
      }

      if (!findChurchFromPayload([church], verification)) {
        return {
          error: "This Paystack reference does not belong to the selected church" as const,
          statusCode: 400,
        };
      }

      church.billing = mergeChurchBilling(ensureChurchBilling(church), {
        ...buildBillingUpdateFromPayload(church, verification, "active"),
        lastPaymentReference: reference,
      });

      upsertChurchSubscriptionPayment(
        database,
        buildVerifiedSubscriptionPaymentRecord({
          church,
          payload: verification,
          source: "paystack_verify",
          recordedByUserId: req.userId ?? "system",
          recordedByName: req.user?.name,
          notes: "Subscription payment verified from Paystack.",
        }),
      );

      return { data: church };
    });

    if ("error" in result) {
      res.status(result.statusCode ?? 404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify Paystack payment",
    });
  }
};

export const handleCreateChurchPaystackCheckout: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchBillingUser(req, res);
    if (!churchId) {
      return;
    }

    const request = (req.body ?? {}) as Partial<CreatePaystackCheckoutRequest>;
    const database = await readDatabase();
    const church = database.churches.find((candidate) => candidate.id === churchId);

    if (!church) {
      res.status(404).json({ success: false, error: "Church not found" });
      return;
    }

    const billing = ensureChurchBilling(church);
    if (church.status !== "active" || billing.status === "suspended") {
      res.status(403).json({
        success: false,
        error: "This workspace is suspended. Contact the platform administrator.",
      });
      return;
    }

    const planKey = normalizePlanKey(request.planKey) ?? billing.planKey;
    const billingEmail =
      toOptionalString(request.billingEmail) ??
      billing.billingEmail ??
      church.adminEmail ??
      church.email;
    const callbackUrl =
      toOptionalString(request.callbackUrl) ?? `${getAppBaseUrl()}/subscription`;

    const checkout = await createPaystackCheckoutSession({
      church: {
        ...church,
        billing,
      },
      request: {
        planKey,
        billingEmail,
        callbackUrl,
      },
      source: "divinedesk_church",
      cancelAction: callbackUrl,
    });

    await updateDatabase((workingCopy) => {
      const targetChurch = workingCopy.churches.find((candidate) => candidate.id === churchId);

      if (!targetChurch) {
        return;
      }

      targetChurch.billing = mergeChurchBilling(ensureChurchBilling(targetChurch), {
        planKey,
        billingEmail,
        planCode: getPaystackPlanCode(planKey),
        lastPaymentReference: checkout.reference,
      });
    });

    res.status(201).json({ success: true, data: checkout });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to initialize Paystack checkout",
    });
  }
};

export const handleVerifyChurchPaystackPayment: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchBillingUser(req, res);
    if (!churchId) {
      return;
    }

    const database = await readDatabase();
    const church = database.churches.find((candidate) => candidate.id === churchId);

    if (!church) {
      res.status(404).json({ success: false, error: "Church not found" });
      return;
    }

    if (church.status !== "active") {
      res.status(403).json({
        success: false,
        error: "This workspace is suspended. Contact the platform administrator.",
      });
      return;
    }

    const reference =
      toOptionalString(req.body?.reference) ?? ensureChurchBilling(church).lastPaymentReference;

    if (!reference) {
      res.status(400).json({ success: false, error: "A Paystack reference is required" });
      return;
    }

    const verification = await verifyPaystackTransaction(reference);

    if (verification?.data?.status !== "success") {
      res.status(400).json({ success: false, error: "Payment has not been completed yet" });
      return;
    }

    if (!findChurchFromPayload([church], verification)) {
      res.status(400).json({
        success: false,
        error: "This Paystack reference does not belong to your church workspace",
      });
      return;
    }

    const result = await updateDatabase((workingCopy) => {
      const targetChurch = workingCopy.churches.find((candidate) => candidate.id === churchId);

      if (!targetChurch) {
        return { error: "Church not found" as const };
      }

      targetChurch.billing = mergeChurchBilling(ensureChurchBilling(targetChurch), {
        ...buildBillingUpdateFromPayload(targetChurch, verification, "active"),
        lastPaymentReference: reference,
      });

      upsertChurchSubscriptionPayment(
        workingCopy,
        buildVerifiedSubscriptionPaymentRecord({
          church: targetChurch,
          payload: verification,
          source: "paystack_verify",
          recordedByUserId: req.userId ?? "system",
          recordedByName: req.user?.name,
          notes: "Subscription payment verified from the church workspace.",
        }),
      );

      return { data: targetChurch };
    });

    if ("error" in result) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify Paystack payment",
    });
  }
};

export const handlePaystackWebhook: RequestHandler = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!verifyPaystackSignature(req.body, signature)) {
      res.status(401).json({ success: false, error: "Invalid Paystack signature" });
      return;
    }

    const event = toOptionalString(req.body?.event);
    const nextStatusMap: Record<string, UpdateChurchBillingRequest["status"] | undefined> = {
      "charge.success": "active",
      "subscription.create": "active",
      "invoice.update": getNestedString(req.body, "data", "status") === "success" ? "active" : undefined,
      "invoice.payment_failed": "past_due",
      "subscription.disable": "canceled",
      "subscription.not_renew": "canceled",
    };
    const nextStatus = event ? nextStatusMap[event] : undefined;

    if (!nextStatus) {
      res.json({ received: true });
      return;
    }

    await updateDatabase((database) => {
      const church = findChurchFromPayload(database.churches, req.body);
      if (!church) {
        return;
      }

      church.billing = mergeChurchBilling(
        ensureChurchBilling(church),
        buildBillingUpdateFromPayload(church, req.body, nextStatus),
      );

      if (nextStatus === "active") {
        upsertChurchSubscriptionPayment(
          database,
          buildVerifiedSubscriptionPaymentRecord({
            church,
            payload: req.body,
            source: "paystack_webhook",
            recordedByUserId: "paystack-webhook",
            recordedByName: "Paystack webhook",
            notes: "Subscription payment captured from the Paystack webhook.",
          }),
        );
      }
    });

    res.json({ received: true });
  } catch {
    res.status(500).json({ success: false, error: "Failed to process Paystack webhook" });
  }
};
