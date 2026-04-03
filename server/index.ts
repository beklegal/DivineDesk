import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo.js";
import {
  handleLogin,
  handleDemoLogin,
  handleSignUp,
  handleLogout,
  handleGetMe,
  handleDebugEnv,
  authenticate,
} from "./routes/auth.js";
import {
  handleGetMembers,
  handleCreateMember,
  handleGetDonations,
  handleCreateDonation,
  handleGetEvents,
  handleCreateEvent,
  handleMarkAttendance,
  handleGetDashboardData,
} from "./routes/church-data.js";
import {
  handleGetAdminDashboard,
  handleGetAllChurches,
  handleGetChurchDetails,
  handleCreateChurch,
  handleUpdateChurch,
  handleDeleteChurch,
  handleGetAdminUsers,
  handleCreateAdminUser,
  handleDeleteAdminUser,
  handleUpdateAdminUser,
} from "./routes/admin.js";
import {
  handleCreateAdminPaystackCheckout,
  handleCreateChurchPaystackCheckout,
  handleGetAdminBillingPlans,
  handleGetChurchSubscriptionPayments,
  handlePaystackWebhook,
  handleRecordChurchSubscriptionPayment,
  handleVerifyAdminPaystackPayment,
  handleVerifyChurchPaystackPayment,
} from "./routes/billing.js";
import {
  handleCreateBranchAdmin,
  handleCreateChurchBranch,
  handleGetChurchWorkspace,
  handleUpdateChurchProfile,
} from "./routes/workspace.js";

export function createServer() {
  const app = express();
  const debugApiRequests = process.env.DEBUG_API_REQUESTS === "true";
  const jsonParser = express.json();
  const urlencodedParser = express.urlencoded({ extended: true });

  // Middleware
  app.use(cors());
  app.use((req: any, res, next) => {
    if (!req.path.startsWith("/api")) {
      next();
      return;
    }

    const requestId =
      req.requestId ??
      (typeof req.headers["x-vercel-id"] === "string"
        ? req.headers["x-vercel-id"]
        : null) ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();
    req.requestId = requestId;

    if (debugApiRequests || req.path.startsWith("/api/auth")) {
      console.info(
        `[api] request ${JSON.stringify({
          requestId,
          method: req.method,
          path: req.originalUrl ?? req.url,
        })}`,
      );
    }

    res.on("finish", () => {
      if (debugApiRequests || res.statusCode >= 400 || req.path.startsWith("/api/auth")) {
        console.info(
          `[api] response ${JSON.stringify({
            requestId,
            method: req.method,
            path: req.originalUrl ?? req.url,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
          })}`,
        );
      }
    });

    next();
  });
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/debug-env", handleDebugEnv);
  app.get("/api/demo", handleDemo);
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }

    jsonParser(req, res, (jsonError) => {
      if (jsonError) {
        next(jsonError);
        return;
      }

      urlencodedParser(req, res, next);
    });
  });
  app.use((req: any, res, next) => {
    const publicPaths = ["/api/ping", "/api/demo", "/api/debug-env", "/api/auth/login", "/api/auth/signup", "/api/auth/demo"];

    if (publicPaths.includes(req.path)) {
      return next();
    }

    return authenticate(req, res, next);
  });

  // ============= Authentication Routes =============
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/demo", handleDemoLogin);
  app.post("/api/auth/signup", handleSignUp);
  app.post("/api/auth/logout", handleLogout);
  app.get("/api/auth/me", handleGetMe);

  // ============= Members Routes =============
  app.get("/api/members", handleGetMembers);
  app.post("/api/members", handleCreateMember);

  // ============= Donations Routes =============
  app.get("/api/donations", handleGetDonations);
  app.post("/api/donations", handleCreateDonation);

  // ============= Events Routes =============
  app.get("/api/events", handleGetEvents);
  app.post("/api/events", handleCreateEvent);

  // ============= Attendance Routes =============
  app.post("/api/attendance", handleMarkAttendance);

  // ============= Dashboard Routes =============
  app.get("/api/dashboard", handleGetDashboardData);

  // ============= Church Workspace Routes =============
  app.get("/api/church/workspace", handleGetChurchWorkspace);
  app.put("/api/church/profile", handleUpdateChurchProfile);
  app.post("/api/church/branches", handleCreateChurchBranch);
  app.post("/api/church/branch-admins", handleCreateBranchAdmin);
  app.post("/api/church/billing/checkout", handleCreateChurchPaystackCheckout);
  app.post("/api/church/billing/verify", handleVerifyChurchPaystackPayment);

  // ============= Super Admin Routes =============
  app.get("/api/admin/dashboard", handleGetAdminDashboard);
  app.get("/api/admin/churches", handleGetAllChurches);
  app.get("/api/admin/churches/:churchId", handleGetChurchDetails);
  app.post("/api/admin/churches", handleCreateChurch);
  app.put("/api/admin/churches/:churchId", handleUpdateChurch);
  app.delete("/api/admin/churches/:churchId", handleDeleteChurch);
  app.get("/api/admin/billing/plans", handleGetAdminBillingPlans);
  app.post("/api/admin/churches/:churchId/billing/checkout", handleCreateAdminPaystackCheckout);
  app.post("/api/admin/churches/:churchId/billing/verify", handleVerifyAdminPaystackPayment);
  app.get("/api/admin/churches/:churchId/subscription-payments", handleGetChurchSubscriptionPayments);
  app.post("/api/admin/churches/:churchId/subscription-payments", handleRecordChurchSubscriptionPayment);
  app.get("/api/admin/users", handleGetAdminUsers);
  app.post("/api/admin/users", handleCreateAdminUser);
  app.patch("/api/admin/users/:userId", handleUpdateAdminUser);
  app.delete("/api/admin/users/:userId", handleDeleteAdminUser);

  // ============= Billing Webhooks =============
  app.post("/api/billing/paystack/webhook", handlePaystackWebhook);

  app.use("/api", (req: any, res) => {
    console.warn(
      `[api] unmatched route ${JSON.stringify({
        requestId: req.requestId ?? null,
        method: req.method,
        path: req.originalUrl ?? req.url,
      })}`,
    );
    res.status(404).json({ success: false, error: "API endpoint not found" });
  });
  app.use((error: any, req: any, res: any, _next: any) => {
    console.error(
      `[api] unhandled error ${JSON.stringify({
        requestId: req?.requestId ?? null,
        method: req?.method ?? null,
        path: req?.originalUrl ?? req?.url ?? null,
        message: error instanceof Error ? error.message : String(error),
        statusCode: error?.status ?? error?.statusCode ?? 500,
      })}`,
    );

    if (res.headersSent) {
      return;
    }

    const statusCode = error?.status ?? error?.statusCode ?? 500;
    res.status(statusCode).json({
      success: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : "Internal server error",
    });
  });

  return app;
}
