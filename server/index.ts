import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo.js";
import {
  handleLogin,
  handleSignUp,
  handleLogout,
  handleGetMe,
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

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authenticate);

  // ============= Authentication Routes =============
  app.post("/api/auth/login", handleLogin);
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

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}
