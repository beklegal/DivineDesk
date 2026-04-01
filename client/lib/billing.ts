import {
  billingHasFeature,
  billingHasReportAccess,
  DEFAULT_BILLING_TRIAL_DAYS,
  type BillingPlanFeature,
  type BillingReportAccessLevel,
  type Church,
  type BillingPlan,
  type SubscriptionPlanKey,
  getEffectiveBillingMemberLimit,
  getBillingPlanByKey,
  isChurchWorkspaceLocked as isSharedChurchWorkspaceLocked,
} from "@shared/api";
import { formatAdminCurrency } from "@/lib/currency";

export function formatSubscriptionAmount(amount: number) {
  return formatAdminCurrency(amount, { compact: true });
}

export function getBillingPlanSummary(plan: Pick<BillingPlan, "name" | "amount">) {
  const priceLabel =
    "publicPriceLabel" in plan && typeof plan.publicPriceLabel === "string"
      ? plan.publicPriceLabel
      : `${formatSubscriptionAmount(plan.amount)}/month`;

  return `${plan.name} - ${priceLabel}`;
}

export function getBillingTrialLabel() {
  return `${DEFAULT_BILLING_TRIAL_DAYS}-day free trial`;
}

export function findBillingPlan(planKey?: SubscriptionPlanKey | null) {
  return getBillingPlanByKey(planKey);
}

export function getChurchMemberLimit(church?: Pick<Church, "billing"> | null) {
  return getEffectiveBillingMemberLimit(church?.billing);
}

export function churchHasBillingFeature(
  church: Pick<Church, "billing"> | null | undefined,
  feature: BillingPlanFeature,
) {
  return billingHasFeature(church?.billing, feature);
}

export function churchHasReportAccess(
  church: Pick<Church, "billing"> | null | undefined,
  requiredAccess: BillingReportAccessLevel,
) {
  return billingHasReportAccess(church?.billing, requiredAccess);
}

export function isChurchWorkspaceLocked(church?: Pick<Church, "billing" | "status"> | null) {
  return isSharedChurchWorkspaceLocked(church);
}

export function formatSubscriptionStatusLabel(value?: string) {
  return value ? value.replace(/_/g, " ") : "unknown";
}

export function formatBillingDate(value?: string) {
  if (!value) {
    return "Pending";
  }

  return new Date(value).toLocaleDateString();
}
