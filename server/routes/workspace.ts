import { RequestHandler } from "express";
import type {
  BillingPlanFeature,
  BranchAdminSummary,
  Church,
  ChurchWorkspace,
  CreateBranchAdminRequest,
  CreateChurchBranchRequest,
  UpdateChurchProfileRequest,
} from "../../shared/api.js";
import { billingHasFeature, getBillingPlanByKey } from "../../shared/api.js";
import { canManageChurchWorkspace } from "../../shared/permissions.js";
import {
  createId,
  readDatabase,
  StoredUser,
  updateDatabase,
} from "../data/database.js";
import { findChurchBranch, getChurchBranches } from "../lib/branches.js";

function requireChurchUser(req: any, res: any) {
  if (!req.churchId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return null;
  }

  return req.churchId as string;
}

function requireUnlockedChurchUser(req: any, res: any) {
  const churchId = requireChurchUser(req, res);

  if (!churchId) {
    return null;
  }

  if (!req.hasChurchWorkspaceAccess) {
    res.status(402).json({
      success: false,
      error:
        "This workspace is locked pending subscription payment. Complete the Paystack payment to continue.",
    });
    return null;
  }

  return churchId;
}

function canManageWorkspace(req: any) {
  return canManageChurchWorkspace(req.user);
}

function requireChurchWorkspaceManager(req: any, res: any) {
  const churchId = requireUnlockedChurchUser(req, res);
  if (!churchId) {
    return null;
  }

  if (!canManageWorkspace(req)) {
    res.status(403).json({
      success: false,
      error:
        "Branch admins cannot create branch accounts. Only the primary church admin can manage branches and branch admins.",
    });
    return null;
  }

  return churchId;
}

function requireChurchPlanFeature(
  req: any,
  res: any,
  feature: BillingPlanFeature,
  errorMessage: string,
) {
  const church = (req.church as Church | null) ?? null;

  if (!church) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return null;
  }

  if (!billingHasFeature(church.billing, feature)) {
    const plan = getBillingPlanByKey(church.billing.planKey);
    res.status(403).json({
      success: false,
      error: `${plan.name} ${errorMessage}`,
    });
    return null;
  }

  return church;
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

function mapBranchAdmin(user: StoredUser, branchName: string): BranchAdminSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "branch_admin" ? "branch_admin" : "admin",
    churchId: user.churchId ?? "",
    branchId: user.branchId ?? "",
    branchName,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export const handleGetChurchWorkspace: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireUnlockedChurchUser(req, res);
    if (!churchId) {
      return;
    }

    const database = await readDatabase();
    const church = database.churches.find((candidate) => candidate.id === churchId);

    if (!church) {
      res.status(404).json({ success: false, error: "Church not found" });
      return;
    }

    const scopedBranchId = req.branchId as string | null;
    const branches = getChurchBranches(database.branches, churchId)
      .filter((branch) => !scopedBranchId || branch.id === scopedBranchId)
      .sort((left, right) => left.name.localeCompare(right.name));
    const branchAdmins = database.users
      .filter(
        (user) =>
          user.churchId === churchId &&
          user.role === "branch_admin" &&
          user.branchId &&
          (!scopedBranchId || user.branchId === scopedBranchId),
      )
      .map((user) => {
        const branch = findChurchBranch(database.branches, churchId, user.branchId);

        return branch ? mapBranchAdmin(user, branch.name) : null;
      })
      .filter((user): user is BranchAdminSummary => Boolean(user))
      .sort((left, right) => left.name.localeCompare(right.name));

    const workspace: ChurchWorkspace = {
      church,
      currentBranch: req.branchId
        ? findChurchBranch(database.branches, churchId, req.branchId) ?? null
        : null,
      branches,
      branchAdmins,
    };

    res.json({ success: true, data: workspace });
  } catch {
    res.status(500).json({ success: false, error: "Failed to load church workspace" });
  }
};

export const handleUpdateChurchProfile: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceManager(req, res);
    if (!churchId) {
      return;
    }

    const payload = (req.body ?? {}) as UpdateChurchProfileRequest;
    const result = await updateDatabase((database) => {
      const church = database.churches.find((candidate) => candidate.id === churchId);
      if (!church) {
        return { error: "Church not found" as const, statusCode: 404 };
      }

      const nextName = normalizeOptionalString(payload.name);
      if (payload.name !== undefined && !nextName) {
        return { error: "Church name is required" as const, statusCode: 400 };
      }

      if (nextName) {
        church.name = nextName;
      }

      if (payload.email !== undefined) {
        church.email = normalizeOptionalEmail(payload.email);
      }

      if (payload.phone !== undefined) {
        church.phone = normalizeOptionalString(payload.phone);
      }

      if (payload.address !== undefined) {
        church.address = normalizeOptionalString(payload.address);
      }

      if (payload.website !== undefined) {
        church.website = normalizeOptionalString(payload.website);
      }

      church.lastUpdated = new Date().toISOString();
      return { data: church };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to update church profile" });
  }
};

export const handleCreateChurchBranch: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceManager(req, res);
    if (!churchId) {
      return;
    }
    if (
      !requireChurchPlanFeature(
        req,
        res,
        "multi_branch_management",
        "does not include multi-branch management. Upgrade to Enterprise or Custom to add more branches.",
      )
    ) {
      return;
    }

    const payload = (req.body ?? {}) as CreateChurchBranchRequest;
    const branchName = normalizeOptionalString(payload.name);

    if (!branchName) {
      res.status(400).json({ success: false, error: "Branch name is required" });
      return;
    }

    const result = await updateDatabase((database) => {
      const church = database.churches.find((candidate) => candidate.id === churchId);
      if (!church) {
        return { error: "Church not found" as const, statusCode: 404 };
      }

      const duplicate = database.branches.some(
        (branch) =>
          branch.churchId === churchId &&
          branch.name.toLowerCase() === branchName.toLowerCase(),
      );

      if (duplicate) {
        return { error: "A branch with that name already exists" as const, statusCode: 409 };
      }

      const branch = {
        id: createId("branch"),
        churchId,
        name: branchName,
        email: normalizeOptionalEmail(payload.email),
        phone: normalizeOptionalString(payload.phone),
        address: normalizeOptionalString(payload.address),
        isPrimary: false,
        status: "active" as const,
        createdAt: new Date().toISOString(),
        createdByUserId: req.userId as string | undefined,
      };

      database.branches.push(branch);
      church.lastUpdated = new Date().toISOString();

      return { data: branch };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to create branch" });
  }
};

export const handleCreateBranchAdmin: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceManager(req, res);
    if (!churchId) {
      return;
    }
    if (
      !requireChurchPlanFeature(
        req,
        res,
        "delegated_access",
        "does not include delegated branch-admin access. Upgrade to Growth or higher to assign branch admins.",
      )
    ) {
      return;
    }

    const payload = (req.body ?? {}) as CreateBranchAdminRequest;
    const name = normalizeOptionalString(payload.name);
    const email = normalizeOptionalEmail(payload.email);
    const password = typeof payload.password === "string" ? payload.password.trim() : "";

    if (!name || !email || password.length < 6 || !payload.branchId) {
      res.status(400).json({
        success: false,
        error: "Name, email, branch, and a password with at least 6 characters are required",
      });
      return;
    }

    const result = await updateDatabase((database) => {
      const branch = findChurchBranch(database.branches, churchId, payload.branchId);
      if (!branch) {
        return { error: "Branch not found" as const, statusCode: 404 };
      }

      const emailTaken = database.users.some(
        (user) => user.email.toLowerCase() === email,
      );

      if (emailTaken) {
        return { error: "Email already registered" as const, statusCode: 409 };
      }

      const user: StoredUser = {
        id: createId("user"),
        name,
        email,
        password,
        role: "branch_admin",
        churchId,
        branchId: branch.id,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      database.users.push(user);

      return {
        data: mapBranchAdmin(user, branch.name),
      };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to create branch admin" });
  }
};
