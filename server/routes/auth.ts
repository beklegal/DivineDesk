import { RequestHandler } from "express";
import { z } from "zod";
import type {
  AuthResponse,
  ChurchBranch,
  ChurchEvent,
  Donation,
  LoginRequest,
  Member,
  SignUpRequest,
  SubscriptionPlanKey,
  User,
} from "../../shared/api.js";
import { isSelfServeBillingPlanKey, isSubscriptionPlanKey } from "../../shared/api.js";
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
import {
  getPrismaDatabaseUrl,
  getResolvedPrismaDatabaseConfig,
  getResolvedRuntimeDatabaseConfig,
  getRuntimeDatabaseUrl,
} from "../../lib/database-env.js";

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

const DEMO_CHURCH_ID = "church-shared-demo";
const DEMO_USER_ID = "user-shared-demo-admin";
const DEMO_EMAIL = "demo@divinedesk.app";

function shiftDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(value: Date) {
  return value.toISOString().split("T")[0];
}

function buildDemoWorkspace() {
  const now = new Date();
  const createdAt = shiftDays(now, -21).toISOString();
  const primaryBranch = createPrimaryBranch({
    churchId: DEMO_CHURCH_ID,
    createdAt,
    createdByUserId: DEMO_USER_ID,
    email: DEMO_EMAIL,
    phone: "+233 20 555 0199",
    address: "Airport Residential, Accra",
  });

  const church: StoredChurch = {
    id: DEMO_CHURCH_ID,
    name: "DivineDesk Demo Church",
    size: "medium",
    totalMembers: 0,
    monthlyDonations: 0,
    weeklyAttendance: 0,
    createdAt,
    lastUpdated: new Date().toISOString(),
    status: "active",
    adminName: "Demo Pastor",
    adminEmail: DEMO_EMAIL,
    email: DEMO_EMAIL,
    phone: "+233 20 555 0199",
    address: "Airport Residential, Accra",
    website: "https://divinedesk.app/demo",
    primaryBranchId: primaryBranch.id,
    billing: createChurchBilling({
      size: "medium",
      planKey: "growth",
      status: "trialing",
      startedAt: shiftDays(now, -7).toISOString(),
      billingEmail: DEMO_EMAIL,
    }),
  };

  const user: StoredUser = {
    id: DEMO_USER_ID,
    name: "Demo Pastor",
    email: DEMO_EMAIL,
    password: "demo-access",
    role: "admin",
    churchId: DEMO_CHURCH_ID,
    branchId: primaryBranch.id,
    status: "active",
    createdAt,
    lastLoginAt: now.toISOString(),
  };

  const members: Member[] = [
    {
      id: "member-shared-demo-admin",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      name: "Demo Pastor",
      email: DEMO_EMAIL,
      phone: "+233 20 555 0199",
      address: "Airport Residential, Accra",
      ministryGroup: "Leadership",
      joinDate: toIsoDate(shiftDays(now, -21)),
      status: "active",
      notes: "Primary admin account for the shared demo workspace.",
    },
    {
      id: "member-shared-demo-ama",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      name: "Ama Boateng",
      email: "ama.demo@divinedesk.app",
      phone: "+233 24 111 2233",
      address: "East Legon, Accra",
      ministryGroup: "Worship",
      joinDate: toIsoDate(shiftDays(now, -14)),
      status: "active",
      notes: "Demo member seeded for walkthroughs.",
    },
    {
      id: "member-shared-demo-kwame",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      name: "Kwame Asare",
      email: "kwame.demo@divinedesk.app",
      phone: "+233 50 444 5566",
      address: "Tema Community 5",
      ministryGroup: "Ushering",
      joinDate: toIsoDate(shiftDays(now, -9)),
      status: "active",
      notes: "Demo member seeded for giving and attendance examples.",
    },
    {
      id: "member-shared-demo-linda",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      name: "Linda Mensah",
      email: "linda.demo@divinedesk.app",
      phone: "+233 27 777 8899",
      address: "Spintex Road, Accra",
      ministryGroup: "Children",
      joinDate: toIsoDate(shiftDays(now, -4)),
      status: "visitor",
      notes: "Recent visitor record for the demo dashboard.",
    },
  ];

  const donations: Donation[] = [
    {
      id: "donation-shared-demo-ama",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      memberId: "member-shared-demo-ama",
      memberName: "Ama Boateng",
      amount: 120,
      type: "tithe",
      date: toIsoDate(shiftDays(now, -6)),
      notes: "Seeded demo tithe entry.",
    },
    {
      id: "donation-shared-demo-kwame",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      memberId: "member-shared-demo-kwame",
      memberName: "Kwame Asare",
      amount: 50,
      type: "offering",
      date: toIsoDate(shiftDays(now, -2)),
      notes: "Seeded demo offering entry.",
    },
  ];

  const events: ChurchEvent[] = [
    {
      id: "event-shared-demo-sunday",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      name: "Sunday Celebration Service",
      date: toIsoDate(shiftDays(now, -3)),
      time: "09:00",
      location: "Main Auditorium",
      description: "A completed service in the demo workspace with attendance data.",
      type: "service",
      status: "completed",
      registeredAttendees: 42,
    },
    {
      id: "event-shared-demo-prayer",
      churchId: DEMO_CHURCH_ID,
      branchId: primaryBranch.id,
      name: "Midweek Prayer Gathering",
      date: toIsoDate(shiftDays(now, 3)),
      time: "18:30",
      location: "Main Campus Prayer Hall",
      description: "An upcoming event so new users can preview the calendar flow.",
      type: "meeting",
      status: "scheduled",
      registeredAttendees: 0,
    },
  ];

  return {
    church,
    branch: primaryBranch,
    user,
    members,
    donations,
    events,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function logAuthError(scope: string, error: unknown) {
  console.error(`[auth] ${scope}`, error);
}

function logAuthInfo(scope: string, details: Record<string, unknown>) {
  console.info(`[auth] ${scope} ${JSON.stringify(details)}`);
}

function logAuthWarn(scope: string, details: Record<string, unknown>) {
  console.warn(`[auth] ${scope} ${JSON.stringify(details)}`);
}

export const handleDebugEnv: RequestHandler = (req, res) => {
  const runtimeDatabaseUrl = getRuntimeDatabaseUrl();
  const prismaDatabaseUrl = getPrismaDatabaseUrl();
  const runtimeDatabaseConfig = getResolvedRuntimeDatabaseConfig();
  const prismaDatabaseConfig = getResolvedPrismaDatabaseConfig();

  console.info(`[debug-env] hit path=${req.path} url=${req.originalUrl}`);
  res.json({
    ok: true,
    nodeEnv: process.env.NODE_ENV ?? null,
    databaseMode: runtimeDatabaseUrl ? "external" : "file_fallback",
    hasDatabaseUrl: Boolean(runtimeDatabaseUrl),
    hasPrismaDatabaseUrl: Boolean(prismaDatabaseUrl),
    runtimeDatabaseSource: runtimeDatabaseConfig?.key ?? null,
    prismaDatabaseSource: prismaDatabaseConfig?.key ?? null,
    databaseUrl: process.env.DATABASE_URL ? "set" : "missing",
    directUrl: process.env.DIRECT_URL ? "set" : "missing",
    postgresUrl: process.env.POSTGRES_URL ? "set" : "missing",
    postgresPrismaUrl: process.env.POSTGRES_PRISMA_URL ? "set" : "missing",
    jwtSecret: process.env.JWT_SECRET ? "set" : "missing",
  });
};

function maskEmail(email: string) {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) {
    return "***";
  }

  const visibleLocalPart = localPart.slice(0, Math.min(2, localPart.length));
  return `${visibleLocalPart}***@${domainPart}`;
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
      logAuthWarn("login validation failed", {
        requestId: (req as any).requestId ?? null,
        message: parsed.error.issues[0]?.message ?? "Email and password are required",
      });
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
      logAuthWarn("login rejected", {
        requestId: (req as any).requestId ?? null,
        email: maskEmail(normalizedEmail),
        statusCode: result.statusCode,
      });
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    logAuthInfo("login succeeded", {
      requestId: (req as any).requestId ?? null,
      userId: result.data.user.id,
      role: result.data.user.role,
      churchId: result.data.user.churchId ?? null,
    });
    const authResponse = buildAuthResponse(result.data);
    setAuthCookie(res, authResponse.token);
    res.json(authResponse);
  } catch (error) {
    logAuthError(
      `login failed requestId=${(req as any).requestId ?? "unknown"}`,
      error,
    );
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, "Login failed"),
    });
  }
};

export const handleDemoLogin: RequestHandler = async (req, res) => {
  try {
    const result = await updateDatabase((database) => {
      const demoWorkspace = buildDemoWorkspace();

      database.churches = database.churches.filter((church) => church.id !== DEMO_CHURCH_ID);
      database.branches = database.branches.filter((branch) => branch.churchId !== DEMO_CHURCH_ID);
      database.users = database.users.filter(
        (user) => user.id !== DEMO_USER_ID && user.churchId !== DEMO_CHURCH_ID,
      );
      database.members = database.members.filter((member) => member.churchId !== DEMO_CHURCH_ID);
      database.donations = database.donations.filter(
        (donation) => donation.churchId !== DEMO_CHURCH_ID,
      );
      database.events = database.events.filter((event) => event.churchId !== DEMO_CHURCH_ID);
      database.attendance = database.attendance.filter(
        (entry) => entry.churchId !== DEMO_CHURCH_ID,
      );
      database.subscriptionPayments = (database.subscriptionPayments ?? []).filter(
        (payment) => payment.churchId !== DEMO_CHURCH_ID,
      );

      database.churches.push(demoWorkspace.church);
      database.branches.push(demoWorkspace.branch);
      database.users.push(demoWorkspace.user);
      database.members.push(...demoWorkspace.members);
      database.donations.push(...demoWorkspace.donations);
      database.events.push(...demoWorkspace.events);

      return {
        user: demoWorkspace.user,
        church: demoWorkspace.church,
        branch: demoWorkspace.branch,
      };
    });

    logAuthInfo("demo login succeeded", {
      requestId: (req as any).requestId ?? null,
      userId: result.user.id,
      churchId: result.church.id,
    });
    const authResponse = buildAuthResponse(result);
    setAuthCookie(res, authResponse.token);
    res.json(authResponse);
  } catch (error) {
    logAuthError(
      `demo login failed requestId=${(req as any).requestId ?? "unknown"}`,
      error,
    );
    res.status(500).json({
      success: false,
      error: getErrorMessage(error, "Demo access failed"),
    });
  }
};

export const handleSignUp: RequestHandler = async (req, res) => {
  try {
    const parsed = signUpRequestSchema.safeParse(req.body as SignUpRequest);

    if (!parsed.success) {
      logAuthWarn("signup validation failed", {
        requestId: (req as any).requestId ?? null,
        message:
          parsed.error.issues[0]?.message ?? "All required fields must be completed",
      });
      res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message ?? "All required fields must be completed",
      });
      return;
    }

    const { churchName, adminName, email, password, churchSize, billingPlanKey } = parsed.data;

    if (!isSubscriptionPlanKey(billingPlanKey) || !isSelfServeBillingPlanKey(billingPlanKey)) {
      logAuthWarn("signup rejected unsupported billing plan", {
        requestId: (req as any).requestId ?? null,
        email: maskEmail(email.toLowerCase()),
        billingPlanKey,
      });
      res.status(400).json({
        success: false,
        error: "Choose Starter, Growth, or Enterprise during signup. Custom plans are quoted separately.",
      });
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
      logAuthWarn("signup rejected existing user", {
        requestId: (req as any).requestId ?? null,
        email: maskEmail(normalizedEmail),
      });
      res.status(409).json({ success: false, error: result.error });
      return;
    }

    logAuthInfo("signup succeeded", {
      requestId: (req as any).requestId ?? null,
      userId: result.user.id,
      email: maskEmail(normalizedEmail),
      churchId: result.church.id,
      billingPlanKey,
    });
    const authResponse = buildAuthResponse({
      user: result.user,
      church: result.church,
      branch: null,
    });

    setAuthCookie(res, authResponse.token);
    res.status(201).json(authResponse);
  } catch (error) {
    logAuthError(
      `signup failed requestId=${(req as any).requestId ?? "unknown"}`,
      error,
    );
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
