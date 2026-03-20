import { RequestHandler } from "express";
import { z } from "zod";
import type {
  AuthResponse,
  ChurchBranch,
  LoginRequest,
  SignUpRequest,
  SubscriptionPlanKey,
  User,
} from "../../shared/api.js";
import { BILLING_PLANS } from "../../shared/api.js";
import {
  createId,
  readDatabase,
  StoredChurch,
  StoredUser,
  toPublicChurch,
  toPublicUser,
  updateDatabase,
} from "../data/database.js";
import { createPrimaryBranch, findChurchBranch } from "../lib/branches.js";
import { createChurchBilling, ensureChurchBilling, isChurchBillingBlocked } from "../lib/billing.js";
import {
  clearAuthCookie,
  createSessionToken,
  getSessionTokenFromHeaders,
  setAuthCookie,
  verifyPassword,
  verifySessionToken,
} from "../../lib/auth.js";

const loginRequestSchema = z.object({
  email: z.string().trim().email("A valid email address is required"),
  password: z.string().trim().min(1, "Password is required"),
});

const signUpRequestSchema = z.object({
  churchName: z.string().trim().min(1, "Church name is required"),
  adminName: z.string().trim().min(1, "Admin name is required"),
  email: z.string().trim().email("A valid email address is required"),
  password: z
    .string()
    .trim()
    .min(6, "Password must be at least 6 characters"),
  churchSize: z.enum(["small", "medium", "large"]),
  billingPlanKey: z.enum(["starter", "growth", "enterprise", "custom"]),
});

function isSubscriptionPlanKey(value: unknown): value is SubscriptionPlanKey {
  return BILLING_PLANS.some((plan) => plan.key === value);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function logAuthError(scope: string, error: unknown) {
  console.error(`[auth] ${scope}`, error);
}

function hasActiveChurchAccess(user: StoredUser, church: StoredChurch | null) {
  if (user.role === "super_admin") {
    return true;
  }

  if (!user.churchId) {
    return true;
  }

  if (!church) {
    return false;
  }

  return !isChurchBillingBlocked({
    ...church,
    billing: ensureChurchBilling(church),
  });
}

function toAuthenticatedUser(user: StoredUser, branch?: ChurchBranch | null) {
  return {
    ...toPublicUser(user),
    ...(branch?.name ? { branchName: branch.name } : {}),
  };
}

function buildAuthResponse(options: {
  user: StoredUser;
  church: StoredChurch | null;
  branch?: ChurchBranch | null;
}): AuthResponse {
  const token = createSessionToken({
    userId: options.user.id,
    churchId: options.user.churchId ?? null,
    branchId: options.user.branchId ?? null,
    role: options.user.role,
  });

  return {
    success: true,
    user: toAuthenticatedUser(options.user, options.branch),
    church: toPublicChurch(options.church),
    branch: options.branch ?? null,
    token,
  };
}

export async function getAuthContextFromToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const verified = verifySessionToken(token);
  if (!verified) {
    return null;
  }

  const database = await readDatabase();
  const user = database.users.find(
    (candidate) =>
      candidate.id === verified.userId && candidate.status === "active",
  );

  if (!user) {
    return null;
  }

  const church = user.churchId
    ? database.churches.find((candidate) => candidate.id === user.churchId) ?? null
    : null;
  const branch =
    user.churchId && user.branchId
      ? findChurchBranch(database.branches, user.churchId, user.branchId) ?? null
      : null;

  if (user.branchId && !branch) {
    return null;
  }

  return {
    user,
    church,
    branch,
  };
}

export const authenticate: RequestHandler = async (req: any, _res, next) => {
  try {
    const token = getSessionTokenFromHeaders(req.headers);
    const authContext = await getAuthContextFromToken(token);
    const hasChurchWorkspaceAccess = authContext
      ? hasActiveChurchAccess(authContext.user, authContext.church)
      : false;

    req.user = authContext ? toAuthenticatedUser(authContext.user, authContext.branch) : null;
    req.userId = authContext?.user.id ?? null;
    req.churchId = authContext?.user.churchId ?? null;
    req.branchId = authContext?.user.branchId ?? null;
    req.church = authContext ? toPublicChurch(authContext.church) : null;
    req.branch = authContext?.branch ?? null;
    req.isSuperAdmin = authContext?.user.role === "super_admin";
    req.hasChurchWorkspaceAccess = hasChurchWorkspaceAccess;
    req.isChurchWorkspaceLocked = Boolean(authContext?.church) && !hasChurchWorkspaceAccess;
  } catch {
    req.user = null;
    req.userId = null;
    req.churchId = null;
    req.branchId = null;
    req.church = null;
    req.branch = null;
    req.isSuperAdmin = false;
    req.hasChurchWorkspaceAccess = false;
    req.isChurchWorkspaceLocked = false;
  } finally {
    next();
  }
};

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const parsed = loginRequestSchema.safeParse(req.body as LoginRequest);

    if (!parsed.success) {
      res
        .status(400)
        .json({ success: false, error: parsed.error.issues[0]?.message ?? "Email and password are required" });
      return;
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const result = await updateDatabase(async (database) => {
      const user = database.users.find(
        (candidate) => candidate.email.toLowerCase() === normalizedEmail,
      );

      const passwordMatches = user
        ? await verifyPassword(password, user.password)
        : false;

      if (!user || !passwordMatches || user.status !== "active") {
        return { error: "Invalid email or password" as const, statusCode: 401 };
      }

      const church = user.churchId
        ? database.churches.find((candidate) => candidate.id === user.churchId) ?? null
        : null;
      const branch =
        user.churchId && user.branchId
          ? findChurchBranch(database.branches, user.churchId, user.branchId) ?? null
          : null;

      user.lastLoginAt = new Date().toISOString();

      return { data: { user, church, branch } };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    const authResponse = buildAuthResponse(result.data);
    setAuthCookie(res, authResponse.token);
    res.json(authResponse);
  } catch (error) {
    logAuthError("login failed", error);
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, "Login failed"),
    });
  }
};

export const handleSignUp: RequestHandler = async (req, res) => {
  try {
    const parsed = signUpRequestSchema.safeParse(req.body as SignUpRequest);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message ?? "All required fields must be completed",
      });
      return;
    }

    const { churchName, adminName, email, password, churchSize, billingPlanKey } = parsed.data;

    if (!isSubscriptionPlanKey(billingPlanKey)) {
      res.status(400).json({ success: false, error: "Invalid billing plan selected" });
      return;
    }

    const normalizedEmail = email.toLowerCase();
    const now = new Date();
    const createdAt = now.toISOString();
    const joinDate = createdAt.split("T")[0];

    const result = await updateDatabase((database) => {
      const alreadyExists = database.users.some(
        (candidate) => candidate.email.toLowerCase() === normalizedEmail,
      );

      if (alreadyExists) {
        return { error: "User already exists" as const };
      }

      const churchId = createId("church");
      const primaryBranch = createPrimaryBranch({
        churchId,
        createdAt,
        email: normalizedEmail,
      });
      const userId = createId("user");
      const memberId = createId("member");

      const church: StoredChurch = {
        id: churchId,
        name: churchName.trim(),
        size: churchSize,
        totalMembers: 0,
        monthlyDonations: 0,
        weeklyAttendance: 0,
        createdAt,
        lastUpdated: createdAt,
        status: "active",
        adminName: adminName.trim(),
        adminEmail: normalizedEmail,
        email: normalizedEmail,
        primaryBranchId: primaryBranch.id,
        billing: createChurchBilling({
          size: churchSize,
          planKey: billingPlanKey,
          status: "trialing",
          startedAt: createdAt,
          billingEmail: normalizedEmail,
        }),
      };

      const user: StoredUser = {
        id: userId,
        name: adminName.trim(),
        email: normalizedEmail,
        password,
        role: "admin",
        churchId,
        status: "active",
        createdAt,
        lastLoginAt: createdAt,
      };

      database.churches.push(church);
      database.branches.push({
        ...primaryBranch,
        createdByUserId: userId,
      });
      database.users.push(user);
      database.members.push({
        id: memberId,
        churchId,
        branchId: primaryBranch.id,
        name: adminName.trim(),
        email: normalizedEmail,
        phone: "",
        address: "",
        ministryGroup: "Leadership",
        joinDate,
        status: "active",
        notes: "Created during church onboarding.",
      });

      return { user, church };
    });

    if ("error" in result) {
      res.status(409).json({ success: false, error: result.error });
      return;
    }

    const authResponse = buildAuthResponse({
      user: result.user,
      church: result.church,
      branch: null,
    });

    setAuthCookie(res, authResponse.token);
    res.status(201).json(authResponse);
  } catch (error) {
    logAuthError("signup failed", error);
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, "Sign up failed"),
    });
  }
};

export const handleLogout: RequestHandler = (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: "Logged out successfully" });
};

export const handleGetMe: RequestHandler = async (req, res) => {
  try {
    const token = getSessionTokenFromHeaders(req.headers);
    const authContext = await getAuthContextFromToken(token);

    if (!authContext) {
      res.status(401).json({ success: false, error: "Invalid token" });
      return;
    }

    res.json({
      success: true,
      token: buildAuthResponse(authContext).token,
      data: {
        user: toAuthenticatedUser(authContext.user, authContext.branch),
        church: toPublicChurch(authContext.church),
        branch: authContext.branch,
      },
    });
  } catch (error) {
    logAuthError("get current user failed", error);
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, "Failed to get user"),
    });
  }
};

export function isSuperAdminUser(user?: User | null) {
  return user?.role === "super_admin";
}
