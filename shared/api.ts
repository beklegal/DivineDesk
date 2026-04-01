/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

// ============= Authentication =============
export interface LoginRequest {
  email: string;
  password: string;
}

export type UserRole = "super_admin" | "admin" | "branch_admin" | "staff" | "member";

export interface SignUpRequest {
  churchName: string;
  adminName: string;
  email: string;
  password: string;
  churchSize: "small" | "medium" | "large";
  billingPlanKey: SubscriptionPlanKey;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  church: Church | null;
  branch?: ChurchBranch | null;
  token: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  churchId?: string;
  branchId?: string;
  branchName?: string;
}

// ============= Billing =============
export const BILLING_INTERVALS = ["monthly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const DEFAULT_BILLING_TRIAL_DAYS = 30;
export const DEFAULT_MONTHLY_SUBSCRIPTION_AMOUNT = 10;
export const GROWTH_MONTHLY_SUBSCRIPTION_AMOUNT = 25;
export const ENTERPRISE_MONTHLY_SUBSCRIPTION_AMOUNT = 50;
export const DEFAULT_CUSTOM_SUBSCRIPTION_AMOUNT = ENTERPRISE_MONTHLY_SUBSCRIPTION_AMOUNT;

export const SUBSCRIPTION_PLAN_KEYS = ["starter", "growth", "enterprise", "custom"] as const;
export type SubscriptionPlanKey = (typeof SUBSCRIPTION_PLAN_KEYS)[number];
export type BillingCurrency = "USD" | "NGN";
export const BILLING_REPORT_ACCESS_LEVELS = ["basic", "advanced", "full"] as const;
export type BillingReportAccessLevel = (typeof BILLING_REPORT_ACCESS_LEVELS)[number];
export const BILLING_PLAN_FEATURES = [
  "giving",
  "delegated_access",
  "multi_branch_management",
  "priority_support",
  "integrations",
] as const;
export type BillingPlanFeature = (typeof BILLING_PLAN_FEATURES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "suspended",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const SUBSCRIPTION_PAYMENT_METHODS = [
  "paystack",
  "bank_transfer",
  "mobile_money",
  "cash",
  "manual",
] as const;
export type SubscriptionPaymentMethod =
  (typeof SUBSCRIPTION_PAYMENT_METHODS)[number];
export const SUBSCRIPTION_PAYMENT_SOURCES = [
  "manual",
  "paystack_verify",
  "paystack_webhook",
] as const;
export type SubscriptionPaymentSource =
  (typeof SUBSCRIPTION_PAYMENT_SOURCES)[number];
export const LOCKED_SUBSCRIPTION_STATUSES = [
  "past_due",
  "canceled",
  "suspended",
] as const;

export interface ChurchBillingEntitlementOverrides {
  memberLimit?: number | null;
  reportAccess?: BillingReportAccessLevel;
  enabledFeatures?: BillingPlanFeature[];
  disabledFeatures?: BillingPlanFeature[];
}

export interface EffectiveBillingEntitlements {
  memberLimit: number | null;
  reportAccess: BillingReportAccessLevel;
  features: BillingPlanFeature[];
}

export interface BillingPlan {
  key: SubscriptionPlanKey;
  name: string;
  amount: number;
  currency: BillingCurrency;
  interval: BillingInterval;
  description: string;
  targetProfile: string;
  highlights: string[];
  publicPriceLabel: string;
  selfServeEnabled: boolean;
  memberLimit: number | null;
  reportAccess: BillingReportAccessLevel;
  features: BillingPlanFeature[];
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    amount: DEFAULT_MONTHLY_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "Built for small churches that want a clean, dependable admin workspace.",
    targetProfile: "For small churches",
    highlights: [
      "Up to 100 members",
      "Basic member management and attendance tracking",
      "Simple reporting for weekly admin work",
    ],
    publicPriceLabel: "$10/month",
    selfServeEnabled: true,
    memberLimit: 100,
    reportAccess: "basic",
    features: [],
  },
  {
    key: "growth",
    name: "Growth",
    amount: GROWTH_MONTHLY_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "Built for growing churches that need stronger giving, event, and team workflows.",
    targetProfile: "For growing churches",
    highlights: [
      "Up to 500 members",
      "Giving, donations, and event management",
      "Advanced reports and role-based access",
    ],
    publicPriceLabel: "$25/month",
    selfServeEnabled: true,
    memberLimit: 500,
    reportAccess: "advanced",
    features: ["giving", "delegated_access"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    amount: ENTERPRISE_MONTHLY_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "Built for large or multi-branch churches that need deeper visibility and support.",
    targetProfile: "For big or multi-branch churches",
    highlights: [
      "Unlimited members",
      "Multi-branch management and financial dashboards",
      "Full analytics and priority support",
    ],
    publicPriceLabel: "$50/month",
    selfServeEnabled: true,
    memberLimit: null,
    reportAccess: "full",
    features: ["giving", "delegated_access", "multi_branch_management", "priority_support"],
  },
  {
    key: "custom",
    name: "Custom",
    amount: DEFAULT_CUSTOM_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "Built for mega churches and ministry networks that need a tailored rollout.",
    targetProfile: "For mega churches",
    highlights: [
      "Custom features and implementation planning",
      "Dedicated support and guided onboarding",
      "Integrations such as SMS, payments, and ministry workflows",
    ],
    publicPriceLabel: "Custom pricing",
    selfServeEnabled: false,
    memberLimit: null,
    reportAccess: "full",
    features: [
      "giving",
      "delegated_access",
      "multi_branch_management",
      "priority_support",
      "integrations",
    ],
  },
];

export function getBillingPlanByKey(planKey?: SubscriptionPlanKey | null) {
  return BILLING_PLANS.find((plan) => plan.key === planKey) ?? BILLING_PLANS[0];
}

export function getSelfServeBillingPlans() {
  return BILLING_PLANS.filter((plan) => plan.selfServeEnabled);
}

export function getBillingPlanMemberLimit(planKey?: SubscriptionPlanKey | null) {
  return getBillingPlanByKey(planKey).memberLimit;
}

function normalizeBillingFeatureList(features?: BillingPlanFeature[]) {
  return Array.from(new Set(features ?? []));
}

export function hasBillingPlanFeature(
  planKey: SubscriptionPlanKey | null | undefined,
  feature: BillingPlanFeature,
) {
  return getBillingPlanByKey(planKey).features.includes(feature);
}

export function hasBillingPlanReportAccess(
  planKey: SubscriptionPlanKey | null | undefined,
  requiredAccess: BillingReportAccessLevel,
) {
  const reportAccessRank: Record<BillingReportAccessLevel, number> = {
    basic: 0,
    advanced: 1,
    full: 2,
  };

  const plan = getBillingPlanByKey(planKey);
  return reportAccessRank[plan.reportAccess] >= reportAccessRank[requiredAccess];
}

export function getEffectiveBillingEntitlements(
  billing?: Pick<ChurchBilling, "planKey" | "entitlementOverrides"> | null,
): EffectiveBillingEntitlements {
  const plan = getBillingPlanByKey(billing?.planKey);
  const overrides = billing?.entitlementOverrides;
  const disabledFeatures = new Set(normalizeBillingFeatureList(overrides?.disabledFeatures));
  const enabledFeatures = normalizeBillingFeatureList(overrides?.enabledFeatures).filter(
    (feature) => !disabledFeatures.has(feature),
  );
  const hasMemberLimitOverride = Boolean(
    overrides && Object.prototype.hasOwnProperty.call(overrides, "memberLimit"),
  );

  return {
    memberLimit: hasMemberLimitOverride ? overrides?.memberLimit ?? null : plan.memberLimit,
    reportAccess: overrides?.reportAccess ?? plan.reportAccess,
    features: [
      ...plan.features.filter((feature) => !disabledFeatures.has(feature)),
      ...enabledFeatures.filter((feature) => !plan.features.includes(feature)),
    ],
  };
}

export function getEffectiveBillingMemberLimit(
  billing?: Pick<ChurchBilling, "planKey" | "entitlementOverrides"> | null,
) {
  return getEffectiveBillingEntitlements(billing).memberLimit;
}

export function billingHasFeature(
  billing: Pick<ChurchBilling, "planKey" | "entitlementOverrides"> | null | undefined,
  feature: BillingPlanFeature,
) {
  return getEffectiveBillingEntitlements(billing).features.includes(feature);
}

export function billingHasReportAccess(
  billing: Pick<ChurchBilling, "planKey" | "entitlementOverrides"> | null | undefined,
  requiredAccess: BillingReportAccessLevel,
) {
  const reportAccessRank: Record<BillingReportAccessLevel, number> = {
    basic: 0,
    advanced: 1,
    full: 2,
  };
  const entitlements = getEffectiveBillingEntitlements(billing);

  return reportAccessRank[entitlements.reportAccess] >= reportAccessRank[requiredAccess];
}

export function isSubscriptionPlanKey(value: unknown): value is SubscriptionPlanKey {
  return BILLING_PLANS.some((plan) => plan.key === value);
}

export function isSelfServeBillingPlanKey(value: unknown): value is SubscriptionPlanKey {
  return BILLING_PLANS.some((plan) => plan.key === value && plan.selfServeEnabled);
}

export interface ChurchBilling {
  provider: "paystack";
  planKey: SubscriptionPlanKey;
  planName: string;
  amount: number;
  currency: BillingCurrency;
  interval: BillingInterval;
  status: SubscriptionStatus;
  billingEmail?: string;
  startedAt: string;
  renewalDate?: string;
  trialEndsAt?: string;
  customerCode?: string;
  subscriptionCode?: string;
  planCode?: string;
  authorizationCode?: string;
  lastPaymentReference?: string;
  lastPaymentAt?: string;
  entitlementOverrides?: ChurchBillingEntitlementOverrides;
}

export interface ChurchSubscriptionPaymentRecord {
  id: string;
  churchId: string;
  amount: number;
  currency: BillingCurrency;
  method: SubscriptionPaymentMethod;
  source: SubscriptionPaymentSource;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  reference?: string;
  notes?: string;
  recordedAt: string;
  recordedByUserId: string;
  recordedByName?: string;
}

export function isChurchWorkspaceLocked(
  church?: Pick<Church, "billing" | "status"> | null,
) {
  if (!church) {
    return false;
  }

  if (church.status !== "active") {
    return true;
  }

  return LOCKED_SUBSCRIPTION_STATUSES.includes(
    church.billing.status as (typeof LOCKED_SUBSCRIPTION_STATUSES)[number],
  );
}

export interface ChurchBranch {
  id: string;
  churchId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  isPrimary: boolean;
  status: "active" | "inactive";
  createdAt: string;
  createdByUserId?: string;
}

// ============= Church =============
export interface Church {
  id: string;
  name: string;
  size: "small" | "medium" | "large";
  totalMembers: number;
  monthlyDonations: number;
  weeklyAttendance: number;
  createdAt: string;
  lastUpdated: string;
  status?: "active" | "inactive" | "suspended";
  adminName?: string;
  adminEmail?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  primaryBranchId?: string;
  billing: ChurchBilling;
}

export type ChurchSize = Church["size"];
export type ChurchStatus = NonNullable<Church["status"]>;

export interface CreateChurchRequest {
  name: string;
  size: ChurchSize;
  adminName?: string;
  adminEmail?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  billingPlanKey?: SubscriptionPlanKey;
  trialDays?: number;
}

export interface UpdateChurchBillingRequest {
  planKey?: SubscriptionPlanKey;
  status?: SubscriptionStatus;
  amount?: number;
  billingEmail?: string;
  renewalDate?: string;
  trialEndsAt?: string;
  customerCode?: string;
  subscriptionCode?: string;
  planCode?: string;
  authorizationCode?: string;
  lastPaymentReference?: string;
  lastPaymentAt?: string;
  entitlementOverrides?: ChurchBillingEntitlementOverrides | null;
}

export interface CreateChurchSubscriptionPaymentRecordRequest {
  amount?: number;
  paidAt?: string;
  method: SubscriptionPaymentMethod;
  reference?: string;
  notes?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface UpdateChurchRequest {
  name?: string;
  size?: ChurchSize;
  adminName?: string;
  adminEmail?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  status?: ChurchStatus;
  billing?: UpdateChurchBillingRequest;
}

export interface UpdateChurchProfileRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}

export interface CreateChurchBranchRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CreateBranchAdminRequest {
  name: string;
  email: string;
  password: string;
  branchId: string;
}

export interface BranchAdminSummary {
  id: string;
  name: string;
  email: string;
  role: "admin" | "branch_admin";
  churchId: string;
  branchId: string;
  branchName: string;
  status: "active" | "inactive" | "suspended";
  lastLoginAt?: string;
  createdAt: string;
}

export interface ChurchWorkspace {
  church: Church;
  currentBranch: ChurchBranch | null;
  branches: ChurchBranch[];
  branchAdmins: BranchAdminSummary[];
}

// ============= Members =============
export interface Member {
  id: string;
  churchId: string;
  branchId?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  ministryGroup: string;
  joinDate: string;
  status: "active" | "inactive" | "visitor";
  notes: string;
}

export interface CreateMemberRequest {
  branchId?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  ministryGroup: string;
  status: "active" | "inactive" | "visitor";
  notes: string;
}

// ============= Donations =============
export interface Donation {
  id: string;
  churchId: string;
  branchId?: string;
  memberId: string;
  memberName: string;
  amount: number;
  type: "tithe" | "offering" | "special_gift";
  date: string;
  notes: string;
}

export interface CreateDonationRequest {
  memberId: string;
  amount: number;
  type: "tithe" | "offering" | "special_gift";
  notes: string;
}

export interface DonationStats {
  totalDonations: number;
  monthlyTotal: number;
  topDonors: Array<{ name: string; amount: number }>;
  byType: Record<string, number>;
}

// ============= Events =============
export interface ChurchEvent {
  id: string;
  churchId: string;
  branchId?: string;
  name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  type: "service" | "event" | "meeting";
  status: "scheduled" | "completed" | "cancelled";
  maxAttendees?: number;
  registeredAttendees: number;
}

export interface CreateEventRequest {
  branchId?: string;
  name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  type: "service" | "event" | "meeting";
  maxAttendees?: number;
}

// ============= Attendance =============
export interface AttendanceRecord {
  id: string;
  churchId: string;
  branchId?: string;
  eventId: string;
  memberId: string;
  memberName: string;
  attended: boolean;
  checkinTime?: string;
  checkoutTime?: string;
}

export interface MarkAttendanceRequest {
  eventId: string;
  memberId: string;
  attended: boolean;
}

export interface AttendanceStats {
  totalServices: number;
  averageAttendance: number;
  monthlyTrend: Array<{ date: string; count: number }>;
}

// ============= Dashboard Data =============
export interface DashboardData {
  church: Church;
  recentMembers: Member[];
  recentDonations: Donation[];
  upcomingEvents: ChurchEvent[];
  weeklyAttendance: number;
  donationTrend: Array<{ date: string; amount: number }>;
  memberGrowth: Array<{ date: string; count: number }>;
}

// ============= Real-time Updates =============
export interface RealtimeUpdate {
  type: "member_added" | "donation_added" | "event_created" | "attendance_marked";
  data: any;
  timestamp: string;
}

// ============= API Responses =============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DemoResponse {
  message: string;
}

// ============= Super Admin Management =============
export interface AdminDashboardStats {
  totalChurches: number;
  totalMembers: number;
  totalDonations: number;
  activeChurches: number;
  monthlyRecurringRevenue: number;
  trialChurches: number;
  pastDueChurches: number;
  canceledChurches: number;
  recentChurches: Church[];
  subscriptionsByPlan: Array<{
    planKey: SubscriptionPlanKey;
    planName: string;
    churches: number;
    monthlyRevenue: number;
  }>;
  systemHealth: {
    uptime: number;
    activeUsers: number;
    dailyActiveChurches: number;
  };
}

export interface ChurchAdmin {
  id: string;
  churchId: string;
  churchName: string;
  adminName: string;
  adminEmail: string;
  memberCount: number;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  monthlyDonations: number;
  subscriptionPlanKey: SubscriptionPlanKey;
  subscriptionPlanName: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionAmount: number;
  renewalDate?: string;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  churchId?: string;
  churchName?: string;
  branchId?: string;
  branchName?: string;
  scope?: "platform" | "church" | "branch";
  status: "active" | "inactive" | "suspended";
  lastLoginAt?: string;
  createdAt: string;
}

export interface CreateAdminUserRequest {
  name: string;
  email: string;
  role: "super_admin" | "admin";
  churchId?: string;
}

export interface UpdateAdminUserRequest {
  name?: string;
  status?: AdminUserSummary["status"];
  password?: string;
}

export interface AdminAuthResponse {
  success: boolean;
  user: User;
  token: string;
  isSystemAdmin: boolean;
  churches?: Church[];
  stats?: AdminDashboardStats;
}

export interface AdminBillingPlan extends BillingPlan {
  paystackPlanCode?: string;
  paystackCheckoutUrl?: string;
  isConfigured: boolean;
}

export interface CreatePaystackCheckoutRequest {
  planKey: SubscriptionPlanKey;
  callbackUrl?: string;
  billingEmail?: string;
}

export interface PaystackCheckoutResponse {
  authorizationUrl: string;
  accessCode?: string;
  reference?: string;
}
