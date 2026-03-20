import type { Church, ChurchBranch } from "../../shared/api.js";

export function buildPrimaryBranchId(churchId: string) {
  return `branch-${churchId}-primary`;
}

export function getDefaultPrimaryBranchName() {
  return "Main Campus";
}

export function createPrimaryBranch(options: {
  churchId: string;
  createdAt?: string;
  createdByUserId?: string;
  email?: string;
  phone?: string;
  address?: string;
}): ChurchBranch {
  const createdAt = options.createdAt ?? new Date().toISOString();

  return {
    id: buildPrimaryBranchId(options.churchId),
    churchId: options.churchId,
    name: getDefaultPrimaryBranchName(),
    email: options.email,
    phone: options.phone,
    address: options.address,
    isPrimary: true,
    status: "active",
    createdAt,
    createdByUserId: options.createdByUserId,
  };
}

export function getChurchBranches(branches: ChurchBranch[], churchId: string) {
  return branches.filter((branch) => branch.churchId === churchId);
}

export function findChurchBranch(
  branches: ChurchBranch[],
  churchId: string,
  branchId?: string | null,
) {
  if (!branchId) {
    return undefined;
  }

  return branches.find(
    (branch) => branch.churchId === churchId && branch.id === branchId,
  );
}

export function resolvePrimaryBranchId(
  church: Pick<Church, "id" | "primaryBranchId">,
  branches: ChurchBranch[],
) {
  return (
    findChurchBranch(branches, church.id, church.primaryBranchId) ??
    getChurchBranches(branches, church.id).find((branch) => branch.isPrimary) ??
    getChurchBranches(branches, church.id)[0]
  )?.id;
}
