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

export const SUBSCRIPTION_PLAN_KEYS = ["starter", "growth", "enterprise", "custom"] as const;
export type SubscriptionPlanKey = (typeof SUBSCRIPTION_PLAN_KEYS)[number];
export type BillingCurrency = "USD" | "NGN";

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

export interface BillingPlan {
  key: SubscriptionPlanKey;
  name: string;
  amount: number;
  currency: BillingCurrency;
  interval: BillingInterval;
  description: string;
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    amount: DEFAULT_MONTHLY_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "First month free, then $10/month for a clean church admin workspace.",
  },
  {
    key: "growth",
    name: "Growth",
    amount: DEFAULT_MONTHLY_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "First month free, then $10/month with room for branch-ready operations.",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    amount: DEFAULT_MONTHLY_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "First month free, then $10/month for larger ministry coordination.",
  },
  {
    key: "custom",
    name: "Custom",
    amount: DEFAULT_MONTHLY_SUBSCRIPTION_AMOUNT,
    currency: "USD",
    interval: "monthly",
    description: "First month free, then a tailored plan that starts at $10/month.",
  },
];

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
  isConfigured: boolean;
}

export interface CreatePaystackCheckoutRequest {
  planKey: SubscriptionPlanKey;
  callbackUrl?: string;
  billingEmail?: string;
}

export interface PaystackCheckoutResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}
