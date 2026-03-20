import { RequestHandler } from "express";
import type {
  AdminDashboardStats,
  AdminUserSummary,
  ChurchBranch,
  Church,
  ChurchStatus,
  ChurchAdmin,
  CreateChurchRequest,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
  UpdateChurchRequest,
} from "../../shared/api";
import {
  SUBSCRIPTION_PLAN_KEYS,
  SUBSCRIPTION_STATUSES,
} from "../../shared/api";
import {
  createId,
  readDatabase,
  StoredChurch,
  StoredUser,
  updateDatabase,
} from "../data/database";
import {
  createChurchBilling,
  ensureChurchBilling,
  getBillingSnapshot,
  mergeChurchBilling,
} from "../lib/billing";

const DAYS_IN_MS = 24 * 60 * 60 * 1000;
const CHURCH_SIZES = ["small", "medium", "large"] as const;
const CHURCH_STATUSES = ["active", "inactive", "suspended"] as const;
const USER_STATUSES = ["active", "inactive", "suspended"] as const;

function hasOwnProperty(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
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

function isChurchSize(value: unknown): value is CreateChurchRequest["size"] {
  return CHURCH_SIZES.includes(value as CreateChurchRequest["size"]);
}

function isChurchStatus(value: unknown): value is ChurchStatus {
  return CHURCH_STATUSES.includes(value as ChurchStatus);
}

function isUserStatus(value: unknown): value is StoredUser["status"] {
  return USER_STATUSES.includes(value as StoredUser["status"]);
}

function isSubscriptionPlanKey(value: unknown) {
  return SUBSCRIPTION_PLAN_KEYS.includes(value as any);
}

function isSubscriptionStatus(value: unknown) {
  return SUBSCRIPTION_STATUSES.includes(value as any);
}

function requireSuperAdmin(req: any, res: any) {
  if (req.user?.role !== "super_admin") {
    res.status(403).json({ success: false, error: "Super admin access required" });
    return false;
  }

  return true;
}

function isRecentlyActive(value?: string, days = 30) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return Date.now() - parsed.getTime() <= days * DAYS_IN_MS;
}

function findChurchAdmin(church: StoredChurch, users: StoredUser[]) {
  return (
    users.find(
      (user) => user.role === "admin" && user.churchId === church.id && user.status === "active",
    ) ?? null
  );
}

function mapChurchToAdminSummary(
  church: StoredChurch,
  users: StoredUser[],
): ChurchAdmin {
  const admin = findChurchAdmin(church, users);
  const billing = ensureChurchBilling(church);

  return {
    id: church.id,
    churchId: church.id,
    churchName: church.name,
    adminName: admin?.name ?? church.adminName ?? "Pending assignment",
    adminEmail:
      admin?.email ?? church.adminEmail ?? church.email ?? "Not assigned",
    memberCount: church.totalMembers,
    status: church.status ?? "active",
    createdAt: church.createdAt,
    monthlyDonations: church.monthlyDonations,
    subscriptionPlanKey: billing.planKey,
    subscriptionPlanName: billing.planName,
    subscriptionStatus: billing.status,
    subscriptionAmount: billing.amount,
    renewalDate: billing.renewalDate,
  };
}

function countActiveSuperAdmins(users: StoredUser[], excludedUserId?: string) {
  return users.filter(
    (user) =>
      user.role === "super_admin" &&
      user.status === "active" &&
      user.id !== excludedUserId,
  ).length;
}

function syncChurchAdminAssignment(
  churches: StoredChurch[],
  users: StoredUser[],
  churchId: string,
) {
  const church = churches.find((candidate) => candidate.id === churchId);
  if (!church) {
    return;
  }

  const activeAdmin =
    users.find(
      (user) =>
        user.role === "admin" &&
        user.churchId === churchId &&
        user.status === "active",
    ) ?? null;

  church.adminName = activeAdmin?.name;
  church.adminEmail = activeAdmin?.email;
  church.lastUpdated = new Date().toISOString();
}

function mapUserSummary(
  user: StoredUser,
  churches: StoredChurch[],
  branches: ChurchBranch[],
): AdminUserSummary {
  const church = user.churchId
    ? churches.find((candidate) => candidate.id === user.churchId)
    : undefined;
  const branch = user.churchId && user.branchId
    ? branches.find(
        (candidate) =>
          candidate.churchId === user.churchId && candidate.id === user.branchId,
      )
    : undefined;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    churchId: user.churchId ?? undefined,
    churchName: church?.name,
    branchId: user.branchId ?? undefined,
    branchName: branch?.name,
    scope:
      user.role === "super_admin" || !user.churchId
        ? "platform"
        : user.branchId
          ? "branch"
          : "church",
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export const handleGetAdminDashboard: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const database = await readDatabase();
    const churches = [...database.churches].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    const billingSnapshot = getBillingSnapshot(churches);

    const stats: AdminDashboardStats = {
      totalChurches: churches.length,
      totalMembers: churches.reduce((total, church) => total + church.totalMembers, 0),
      totalDonations: churches.reduce(
        (total, church) => total + church.monthlyDonations,
        0,
      ),
      activeChurches: churches.filter((church) => church.status === "active").length,
      monthlyRecurringRevenue: billingSnapshot.monthlyRecurringRevenue,
      trialChurches: billingSnapshot.trialChurches,
      pastDueChurches: billingSnapshot.pastDueChurches,
      canceledChurches: billingSnapshot.canceledChurches,
      recentChurches: churches.slice(0, 5) as Church[],
      subscriptionsByPlan: billingSnapshot.subscriptionsByPlan,
      systemHealth: {
        uptime: 99.98,
        activeUsers: database.users.filter((user) => user.status === "active").length,
        dailyActiveChurches: churches.filter((church) =>
          isRecentlyActive(church.lastUpdated, 30),
        ).length,
      },
    };

    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get admin dashboard" });
  }
};

export const handleGetAllChurches: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const database = await readDatabase();
    const churches = database.churches
      .map((church) => mapChurchToAdminSummary(church, database.users))
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );

    res.json({ success: true, data: churches });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get churches" });
  }
};

export const handleGetChurchDetails: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const database = await readDatabase();
    const church = database.churches.find(
      (candidate) => candidate.id === req.params.churchId,
    );

    if (!church) {
      res.status(404).json({ success: false, error: "Church not found" });
      return;
    }

    res.json({ success: true, data: church });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get church details" });
  }
};

export const handleCreateChurch: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const {
      name,
      size,
      adminName,
      adminEmail,
      email,
      phone,
      address,
      website,
      billingPlanKey,
      trialDays,
    } = req.body as CreateChurchRequest;
    const churchName = normalizeOptionalString(name);

    if (!churchName || !isChurchSize(size)) {
      res.status(400).json({ success: false, error: "Valid church name and size required" });
      return;
    }

    const church = await updateDatabase((database) => {
      const createdAt = new Date().toISOString();
      const newChurch: StoredChurch = {
        id: createId("church"),
        name: churchName,
        size,
        totalMembers: 0,
        monthlyDonations: 0,
        weeklyAttendance: 0,
        createdAt,
        lastUpdated: createdAt,
        status: "active",
        adminName: normalizeOptionalString(adminName),
        adminEmail: normalizeOptionalEmail(adminEmail),
        email: normalizeOptionalEmail(email) ?? normalizeOptionalEmail(adminEmail),
        phone: normalizeOptionalString(phone),
        address: normalizeOptionalString(address),
        website: normalizeOptionalString(website),
        billing: createChurchBilling({
          size,
          planKey: isSubscriptionPlanKey(billingPlanKey) ? billingPlanKey : undefined,
          status: "trialing",
          startedAt: createdAt,
          billingEmail:
            normalizeOptionalEmail(email) ??
            normalizeOptionalEmail(adminEmail),
          trialDays,
        }),
      };

      database.churches.push(newChurch);
      return newChurch;
    });

    res.status(201).json({ success: true, data: church });
  } catch {
    res.status(500).json({ success: false, error: "Failed to create church" });
  }
};

export const handleUpdateChurch: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const churchId = req.params.churchId;
    const payload = (req.body ?? {}) as UpdateChurchRequest;
    const hasName = hasOwnProperty(payload, "name");
    const hasSize = hasOwnProperty(payload, "size");
    const hasStatus = hasOwnProperty(payload, "status");
    const billingUpdate =
      hasOwnProperty(payload, "billing") && payload.billing && typeof payload.billing === "object"
        ? payload.billing
        : undefined;
    const nextName = hasName ? normalizeOptionalString(payload.name) : undefined;

    if (hasName && !nextName) {
      res.status(400).json({ success: false, error: "Church name is required" });
      return;
    }

    if (hasSize && !isChurchSize(payload.size)) {
      res.status(400).json({ success: false, error: "Invalid church size" });
      return;
    }

    if (hasStatus && !isChurchStatus(payload.status)) {
      res.status(400).json({ success: false, error: "Invalid church status" });
      return;
    }

    if (billingUpdate?.planKey && !isSubscriptionPlanKey(billingUpdate.planKey)) {
      res.status(400).json({ success: false, error: "Invalid subscription plan" });
      return;
    }

    if (billingUpdate?.status && !isSubscriptionStatus(billingUpdate.status)) {
      res.status(400).json({ success: false, error: "Invalid subscription status" });
      return;
    }

    if (
      typeof billingUpdate?.amount === "number" &&
      (!Number.isFinite(billingUpdate.amount) || billingUpdate.amount <= 0)
    ) {
      res.status(400).json({ success: false, error: "Invalid subscription amount" });
      return;
    }

    const result = await updateDatabase((database) => {
      const church = database.churches.find((candidate) => candidate.id === churchId);

      if (!church) {
        return { error: "Church not found" as const };
      }

      const assignedAdmin = findChurchAdmin(church, database.users);
      const nextAdminName = hasOwnProperty(payload, "adminName")
        ? normalizeOptionalString(payload.adminName)
        : undefined;
      const nextAdminEmail = hasOwnProperty(payload, "adminEmail")
        ? normalizeOptionalEmail(payload.adminEmail)
        : undefined;

      if (assignedAdmin && nextAdminEmail) {
        const emailTaken = database.users.some(
          (user) =>
            user.id !== assignedAdmin.id && user.email.toLowerCase() === nextAdminEmail,
        );

        if (emailTaken) {
          return { error: "Admin email already registered" as const, statusCode: 409 };
        }
      }

      if (hasName && nextName) {
        church.name = nextName;
      }

      if (hasSize && payload.size) {
        church.size = payload.size;
      }

      if (hasOwnProperty(payload, "adminName")) {
        if (assignedAdmin && nextAdminName) {
          assignedAdmin.name = nextAdminName;
          church.adminName = nextAdminName;
        } else if (assignedAdmin) {
          church.adminName = assignedAdmin.name;
        } else {
          church.adminName = nextAdminName;
        }
      }

      if (hasOwnProperty(payload, "adminEmail")) {
        if (assignedAdmin && nextAdminEmail) {
          assignedAdmin.email = nextAdminEmail;
          church.adminEmail = nextAdminEmail;
        } else if (assignedAdmin) {
          church.adminEmail = assignedAdmin.email;
        } else {
          church.adminEmail = nextAdminEmail;
        }
      }

      if (hasOwnProperty(payload, "email")) {
        church.email = normalizeOptionalEmail(payload.email);
      }

      if (hasOwnProperty(payload, "phone")) {
        church.phone = normalizeOptionalString(payload.phone);
      }

      if (hasOwnProperty(payload, "address")) {
        church.address = normalizeOptionalString(payload.address);
      }

      if (hasOwnProperty(payload, "website")) {
        church.website = normalizeOptionalString(payload.website);
      }

      if (hasStatus && payload.status) {
        church.status = payload.status;
      }

      if (billingUpdate) {
        church.billing = mergeChurchBilling(ensureChurchBilling(church), {
          ...billingUpdate,
          billingEmail: hasOwnProperty(billingUpdate, "billingEmail")
            ? normalizeOptionalEmail(billingUpdate.billingEmail)
            : undefined,
          customerCode: hasOwnProperty(billingUpdate, "customerCode")
            ? normalizeOptionalString(billingUpdate.customerCode)
            : undefined,
          subscriptionCode: hasOwnProperty(billingUpdate, "subscriptionCode")
            ? normalizeOptionalString(billingUpdate.subscriptionCode)
            : undefined,
          planCode: hasOwnProperty(billingUpdate, "planCode")
            ? normalizeOptionalString(billingUpdate.planCode)
            : undefined,
          authorizationCode: hasOwnProperty(billingUpdate, "authorizationCode")
            ? normalizeOptionalString(billingUpdate.authorizationCode)
            : undefined,
          lastPaymentReference: hasOwnProperty(billingUpdate, "lastPaymentReference")
            ? normalizeOptionalString(billingUpdate.lastPaymentReference)
            : undefined,
          renewalDate: hasOwnProperty(billingUpdate, "renewalDate")
            ? normalizeOptionalString(billingUpdate.renewalDate)
            : undefined,
          trialEndsAt: hasOwnProperty(billingUpdate, "trialEndsAt")
            ? normalizeOptionalString(billingUpdate.trialEndsAt)
            : undefined,
          lastPaymentAt: hasOwnProperty(billingUpdate, "lastPaymentAt")
            ? normalizeOptionalString(billingUpdate.lastPaymentAt)
            : undefined,
        });
      }

      church.lastUpdated = new Date().toISOString();

      return { data: church };
    });

    if ("error" in result) {
      res.status(result.statusCode ?? 404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to update church" });
  }
};

export const handleDeleteChurch: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const churchId = req.params.churchId;

    const result = await updateDatabase((database) => {
      const exists = database.churches.some((church) => church.id === churchId);

      if (!exists) {
        return { error: "Church not found" as const };
      }

      database.churches = database.churches.filter((church) => church.id !== churchId);
      database.members = database.members.filter((member) => member.churchId !== churchId);
      database.donations = database.donations.filter(
        (donation) => donation.churchId !== churchId,
      );
      database.events = database.events.filter((event) => event.churchId !== churchId);
      database.attendance = database.attendance.filter(
        (entry) => entry.churchId !== churchId,
      );
      database.subscriptionPayments = database.subscriptionPayments.filter(
        (payment) => payment.churchId !== churchId,
      );
      database.users = database.users.filter((user) => user.churchId !== churchId);

      return { success: true };
    });

    if ("error" in result) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, message: "Church deleted" });
  } catch {
    res.status(500).json({ success: false, error: "Failed to delete church" });
  }
};

export const handleGetAdminUsers: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const database = await readDatabase();
    const users = database.users
      .map((user) => mapUserSummary(user, database.churches, database.branches))
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );

    res.json({ success: true, data: users });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get admin users" });
  }
};

export const handleCreateAdminUser: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const { name, email, role, churchId } = req.body as CreateAdminUserRequest;

    if (!name || !email || !role) {
      res.status(400).json({ success: false, error: "Name, email, and role are required" });
      return;
    }

    if (role === "admin" && !churchId) {
      res.status(400).json({ success: false, error: "Church assignment is required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await updateDatabase((database) => {
      const emailTaken = database.users.some(
        (user) => user.email.toLowerCase() === normalizedEmail,
      );

      if (emailTaken) {
        return { error: "Email already registered" as const };
      }

      const assignedChurch = churchId
        ? database.churches.find((church) => church.id === churchId)
        : undefined;

      if (role === "admin" && !assignedChurch) {
        return { error: "Assigned church not found" as const };
      }

      const temporaryPassword = "welcome123";
      const user: StoredUser = {
        id: createId("user"),
        name: name.trim(),
        email: normalizedEmail,
        password: temporaryPassword,
        role,
        churchId: role === "admin" ? churchId : null,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      database.users.push(user);

      if (role === "admin" && assignedChurch) {
        assignedChurch.adminName = user.name;
        assignedChurch.adminEmail = user.email;
        assignedChurch.lastUpdated = new Date().toISOString();
      }

      return {
        data: mapUserSummary(user, database.churches, database.branches),
        temporaryPassword,
      };
    });

    if ("error" in result) {
      res.status(409).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, ...result });
  } catch {
    res.status(500).json({ success: false, error: "Failed to create admin user" });
  }
};

export const handleUpdateAdminUser: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const userId = req.params.userId;
    const payload = (req.body ?? {}) as UpdateAdminUserRequest;
    const hasName = hasOwnProperty(payload, "name");
    const hasStatus = hasOwnProperty(payload, "status");
    const hasPassword = hasOwnProperty(payload, "password");
    const nextName = hasName ? normalizeOptionalString(payload.name) : undefined;
    const nextPassword =
      hasPassword && typeof payload.password === "string"
        ? payload.password.trim()
        : undefined;

    if (!hasName && !hasStatus && !hasPassword) {
      res.status(400).json({ success: false, error: "No account changes were provided" });
      return;
    }

    if (hasName && !nextName) {
      res.status(400).json({ success: false, error: "User name is required" });
      return;
    }

    if (hasStatus && !isUserStatus(payload.status)) {
      res.status(400).json({ success: false, error: "Invalid account status" });
      return;
    }

    if (hasPassword && (!nextPassword || nextPassword.length < 6)) {
      res.status(400).json({
        success: false,
        error: "Temporary password must be at least 6 characters",
      });
      return;
    }

    const result = await updateDatabase((database) => {
      const user = database.users.find((candidate) => candidate.id === userId);
      if (!user) {
        return { error: "User not found" as const, statusCode: 404 };
      }

      if (user.id === req.userId && hasStatus && payload.status !== "active") {
        return {
          error: "You cannot deactivate the super admin account you are currently using" as const,
          statusCode: 400,
        };
      }

      if (
        user.role === "super_admin" &&
        hasStatus &&
        payload.status !== "active" &&
        countActiveSuperAdmins(database.users, user.id) === 0
      ) {
        return {
          error: "At least one active super admin account must remain" as const,
          statusCode: 400,
        };
      }

      if (hasName && nextName) {
        user.name = nextName;
      }

      if (hasStatus && payload.status) {
        user.status = payload.status;
      }

      if (hasPassword && nextPassword) {
        user.password = nextPassword;
      }

      if (user.role === "admin" && user.churchId) {
        syncChurchAdminAssignment(database.churches, database.users, user.churchId);
      }

      return {
        data: mapUserSummary(user, database.churches, database.branches),
      };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to update user account" });
  }
};

export const handleDeleteAdminUser: RequestHandler = async (req: any, res) => {
  try {
    if (!requireSuperAdmin(req, res)) {
      return;
    }

    const userId = req.params.userId;

    if (userId === req.userId) {
      res.status(400).json({
        success: false,
        error: "You cannot delete the super admin account you are currently using",
      });
      return;
    }

    const result = await updateDatabase((database) => {
      const userIndex = database.users.findIndex((candidate) => candidate.id === userId);
      if (userIndex === -1) {
        return { error: "User not found" as const, statusCode: 404 };
      }

      const [user] = database.users.splice(userIndex, 1);

      if (
        user.role === "super_admin" &&
        countActiveSuperAdmins(database.users) === 0
      ) {
        database.users.splice(userIndex, 0, user);
        return {
          error: "At least one active super admin account must remain" as const,
          statusCode: 400,
        };
      }

      if (user.role === "admin" && user.churchId) {
        syncChurchAdminAssignment(database.churches, database.users, user.churchId);
      }

      return {
        data: { id: user.id },
      };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to delete user account" });
  }
};
