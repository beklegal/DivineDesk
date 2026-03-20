import {
  BILLING_PLANS,
  DEFAULT_BILLING_TRIAL_DAYS,
  type Church,
  type BillingPlan,
  type SubscriptionPlanKey,
  isChurchWorkspaceLocked as isSharedChurchWorkspaceLocked,
} from "@shared/api";
import { formatAdminCurrency } from "@/lib/currency";

export function formatSubscriptionAmount(amount: number) {
  return formatAdminCurrency(amount, { compact: true });
}

export function getBillingPlanSummary(plan: Pick<BillingPlan, "name" | "amount">) {
  return `${plan.name} - ${formatSubscriptionAmount(plan.amount)}/month`;
}

export function getBillingTrialLabel() {
  return `${DEFAULT_BILLING_TRIAL_DAYS}-day free trial`;
}

export function findBillingPlan(planKey?: SubscriptionPlanKey | null) {
  return BILLING_PLANS.find((plan) => plan.key === planKey) ?? BILLING_PLANS[0];
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
