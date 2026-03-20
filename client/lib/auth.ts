import type { UserRole } from "@shared/api";

export function formatUserRole(role?: UserRole | string | null) {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "admin":
      return "Church admin";
    case "branch_admin":
      return "Branch admin";
    case "staff":
      return "Staff";
    case "member":
      return "Member";
    default:
      return "User";
  }
}
