import { RequestHandler } from "express";
import type {
  AuthResponse,
  ChurchBranch,
  LoginRequest,
  SignUpRequest,
  SubscriptionPlanKey,
  User,
} from "../../shared/api";
import { BILLING_PLANS } from "../../shared/api";
import {
  createId,
  readDatabase,
  StoredChurch,
  StoredUser,
  toPublicChurch,
  toPublicUser,
  updateDatabase,
} from "../data/database";
import { createPrimaryBranch, findChurchBranch } from "../lib/branches";
import { createChurchBilling, ensureChurchBilling, isChurchBillingBlocked } from "../lib/billing";

function isSubscriptionPlanKey(value: unknown): value is SubscriptionPlanKey {
  return BILLING_PLANS.some((plan) => plan.key === value);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function logAuthError(scope: string, error: unknown) {
  console.error(`[auth] ${scope}`, error);
}

interface TokenPayload {
  userId: string;
  churchId: string | null;
  branchId: string | null;
}

function generateToken(
  userId: string,
  churchId?: string | null,
  branchId?: string | null,
) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      churchId: churchId ?? null,
      branchId: branchId ?? null,
    }),
    "utf8",
  ).toString("base64url");

  return `token.${payload}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    if (token.startsWith("token.")) {
      const [, payload] = token.split(".");
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

      if (typeof decoded.userId !== "string") {
        return null;
      }

      return {
        userId: decoded.userId,
        churchId: typeof decoded.churchId === "string" ? decoded.churchId : null,
        branchId: typeof decoded.branchId === "string" ? decoded.branchId : null,
      };
    }

    if (token.startsWith("token_")) {
      const [, userId, churchId, branchId] = token.split("_");
      if (!userId) {
        return null;
      }

      return {
        userId,
        churchId: churchId || null,
        branchId: branchId || null,
      };
    }
  } catch {
    return null;
  }

  return null;
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
  return {
    success: true,
    user: toAuthenticatedUser(options.user, options.branch),
    church: toPublicChurch(options.church),
    branch: options.branch ?? null,
    token: generateToken(options.user.id, options.user.churchId, options.user.branchId),
  };
}

export async function getAuthContextFromToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const verified = verifyToken(token);
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
    const token = req.headers.authorization?.replace("Bearer ", "");
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
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      res
        .status(400)
        .json({ success: false, error: "Email and password required" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await updateDatabase((database) => {
      const user = database.users.find(
        (candidate) => candidate.email.toLowerCase() === normalizedEmail,
      );

      if (!user || user.password !== password || user.status !== "active") {
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

    res.json(buildAuthResponse(result.data));
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
    const { churchName, adminName, email, password, churchSize, billingPlanKey } =
      req.body as SignUpRequest;

    if (!churchName || !adminName || !email || !password || !churchSize || !billingPlanKey) {
      res.status(400).json({ success: false, error: "All fields and a billing plan are required" });
      return;
    }

    if (!isSubscriptionPlanKey(billingPlanKey)) {
      res.status(400).json({ success: false, error: "Invalid billing plan selected" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();
    const createdAt = now.toISOString();
    const joinDate = createdAt.split("T")[0];

    const result = await updateDatabase((database) => {
      const alreadyExists = database.users.some(
        (candidate) => candidate.email.toLowerCase() === normalizedEmail,
      );

      if (alreadyExists) {
        return { error: "Email already registered" as const };
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

    res.status(201).json(
      buildAuthResponse({
        user: result.user,
        church: result.church,
        branch: null,
      }),
    );
  } catch (error) {
    logAuthError("signup failed", error);
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, "Sign up failed"),
    });
  }
};

export const handleLogout: RequestHandler = (_req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
};

export const handleGetMe: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const authContext = await getAuthContextFromToken(token);

    if (!authContext) {
      res.status(401).json({ success: false, error: "Invalid token" });
      return;
    }

    res.json({
      success: true,
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
