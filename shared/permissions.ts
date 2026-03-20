import type { UserRole } from "./api";

interface WorkspaceScopedUser {
  role?: UserRole | string | null;
  branchId?: string | null;
}

export function canManageChurchWorkspace(user?: WorkspaceScopedUser | null) {
  return user?.role === "admin" && !user?.branchId;
}
