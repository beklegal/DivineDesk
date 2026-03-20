import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  GitBranch,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import type {
  AdminUserSummary,
  ChurchAdmin,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from "@shared/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserRole } from "@/lib/auth";

const roleStyles = {
  super_admin: "bg-rose-100 text-rose-700",
  admin: "bg-blue-100 text-blue-700",
  branch_admin: "bg-amber-100 text-amber-700",
  staff: "bg-emerald-100 text-emerald-700",
  member: "bg-slate-100 text-slate-700",
} as const;

const statusStyles = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-700",
  suspended: "bg-red-100 text-red-700",
} as const;

const scopeStyles = {
  platform: "bg-slate-950 text-white",
  church: "bg-blue-100 text-blue-700",
  branch: "bg-amber-100 text-amber-700",
} as const;

type ScopeFilter = "all" | "platform" | "church" | "branch";
type CreateUserFormState = CreateAdminUserRequest & { churchId: string };

function formatScope(scope?: AdminUserSummary["scope"]) {
  switch (scope) {
    case "platform":
      return "Platform";
    case "church":
      return "Church";
    case "branch":
      return "Branch";
    default:
      return "Account";
  }
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString();
}

export default function AdminUsers() {
  const { token, user } = useAuth();
  const [accounts, setAccounts] = useState<AdminUserSummary[]>([]);
  const [churches, setChurches] = useState<ChurchAdmin[]>([]);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sensitiveMessage, setSensitiveMessage] = useState("");
  const [formData, setFormData] = useState<CreateUserFormState>({
    name: "",
    email: "",
    role: "admin",
    churchId: "",
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetchData();
  }, [token]);

  useEffect(() => {
    if (formData.role !== "admin" || formData.churchId || churches.length === 0) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      churchId: churches[0].churchId,
    }));
  }, [churches, formData.churchId, formData.role]);

  const fetchData = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [accountsResponse, churchesResponse] = await Promise.all([
        fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/churches", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const accountsPayload = await accountsResponse.json();
      const churchesPayload = await churchesResponse.json();

      if (!accountsResponse.ok) {
        throw new Error(accountsPayload.error || "Failed to load platform accounts");
      }

      if (!churchesResponse.ok) {
        throw new Error(churchesPayload.error || "Failed to load churches");
      }

      setAccounts(accountsPayload.data || []);
      setChurches(churchesPayload.data || []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load platform accounts",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetFeedback = () => {
    setError("");
    setMessage("");
    setSensitiveMessage("");
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    if (!formData.name || !formData.email || (formData.role === "admin" && !formData.churchId)) {
      setError("Name, email, and the required assignment must be provided.");
      return;
    }

    setIsSaving(true);
    resetFeedback();

    try {
      const payload: CreateAdminUserRequest = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        ...(formData.role === "admin" ? { churchId: formData.churchId } : {}),
      };

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to create account");
      }

      setFormData({
        name: "",
        email: "",
        role: "admin",
        churchId: churches[0]?.churchId ?? "",
      });
      setShowCreateForm(false);
      setMessage(`${result.data.name} is now managed by the super admin workspace.`);
      setSensitiveMessage(`Temporary password for ${result.data.email}: ${result.temporaryPassword}`);
      await fetchData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create account");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (account: AdminUserSummary) => {
    if (!token) {
      return;
    }

    const nextStatus = account.status === "active" ? "suspended" : "active";
    setIsSaving(true);
    resetFeedback();

    try {
      const payload: UpdateAdminUserRequest = {
        status: nextStatus,
      };

      const response = await fetch(`/api/admin/users/${account.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update account status");
      }

      setMessage(
        `${result.data.name} is now ${result.data.status === "active" ? "active" : "suspended"}.`,
      );
      await fetchData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update account status",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (account: AdminUserSummary) => {
    if (!token) {
      return;
    }

    const nextPassword = window.prompt(
      `Enter a temporary password for ${account.email}`,
      "welcome123",
    );

    if (!nextPassword) {
      return;
    }

    setIsSaving(true);
    resetFeedback();

    try {
      const payload: UpdateAdminUserRequest = {
        password: nextPassword,
      };

      const response = await fetch(`/api/admin/users/${account.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to reset password");
      }

      setMessage(`Password reset completed for ${result.data.name}.`);
      setSensitiveMessage(`Temporary password for ${account.email}: ${nextPassword}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to reset password");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (account: AdminUserSummary) => {
    if (!token) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${account.name}? This removes the account from the platform.`,
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    resetFeedback();

    try {
      const response = await fetch(`/api/admin/users/${account.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete account");
      }

      setMessage(`${account.name} was removed from platform access.`);
      await fetchData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete account");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesScope = scopeFilter === "all" || account.scope === scopeFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        account.name.toLowerCase().includes(query) ||
        account.email.toLowerCase().includes(query) ||
        account.churchName?.toLowerCase().includes(query) ||
        account.branchName?.toLowerCase().includes(query) ||
        formatUserRole(account.role).toLowerCase().includes(query);

      return matchesScope && matchesSearch;
    });
  }, [accounts, scopeFilter, search]);

  const totalPlatformAdmins = accounts.filter((account) => account.scope === "platform").length;
  const totalChurchScoped = accounts.filter((account) => account.scope === "church").length;
  const totalBranchScoped = accounts.filter((account) => account.scope === "branch").length;
  const totalActive = accounts.filter((account) => account.status === "active").length;

  return (
    <AdminShell
      title="Account management"
      description="The super admin now oversees every platform, church, and branch account from one place."
      icon={Users}
      actions={
        <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-200">
          {accounts.length} total accounts across the platform
        </div>
      }
    >
      {error ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-sm">
          {message}
        </div>
      ) : null}

      {sensitiveMessage ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
          {sensitiveMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">All accounts</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{accounts.length}</p>
          <p className="mt-2 text-sm text-slate-500">{totalActive} currently active</p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Platform admins</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{totalPlatformAdmins}</p>
          <p className="mt-2 text-sm text-slate-500">
            Global access to every account and church workspace
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Church-scoped</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{totalChurchScoped}</p>
          <p className="mt-2 text-sm text-slate-500">
            Primary church admins assigned to a full workspace
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Branch-scoped</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{totalBranchScoped}</p>
          <p className="mt-2 text-sm text-slate-500">
            Delegated branch admins managed centrally by the platform
          </p>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Platform accounts</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Search every account, create church or platform admins, and control access when needed.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search accounts"
                className="h-11 rounded-2xl pl-9"
              />
            </div>

            <Select
              value={scopeFilter}
              onValueChange={(value) => setScopeFilter(value as ScopeFilter)}
            >
              <SelectTrigger className="h-11 w-[180px] rounded-2xl">
                <SelectValue placeholder="Filter scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scopes</SelectItem>
                <SelectItem value="platform">Platform</SelectItem>
                <SelectItem value="church">Church</SelectItem>
                <SelectItem value="branch">Branch</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              onClick={() => {
                resetFeedback();
                setShowCreateForm((previous) => !previous);
              }}
              className="h-11 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              {showCreateForm ? "Close form" : "Add account"}
            </Button>
          </div>
        </div>

        {showCreateForm ? (
          <form
            onSubmit={handleCreateUser}
            className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Create a managed account</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  The super admin can create platform admins and church admins here. New accounts start with a temporary password.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-amber-700">
                Default password: welcome123
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Full name</Label>
                <Input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, name: event.target.value }))
                  }
                  placeholder="Account name"
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, email: event.target.value }))
                  }
                  placeholder="admin@church.org"
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData((previous) => ({
                      ...previous,
                      role: value as CreateAdminUserRequest["role"],
                      churchId:
                        value === "admin"
                          ? previous.churchId || churches[0]?.churchId || ""
                          : "",
                    }))
                  }
                >
                  <SelectTrigger className="h-12 rounded-2xl">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Church admin</SelectItem>
                    <SelectItem value="super_admin">Super admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">Assigned church</Label>
                <Select
                  value={formData.churchId}
                  onValueChange={(value) =>
                    setFormData((previous) => ({ ...previous, churchId: value }))
                  }
                  disabled={formData.role !== "admin"}
                >
                  <SelectTrigger className="h-12 rounded-2xl">
                    <SelectValue
                      placeholder={
                        formData.role === "admin" ? "Choose a church" : "Not required"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {churches.map((church) => (
                      <SelectItem key={church.churchId} value={church.churchId}>
                        {church.churchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="h-12 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <UserCog className="mr-2 h-4 w-4" />
                    Create account
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <section className="rounded-[32px] border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">Loading all platform accounts...</p>
            </div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500">
            No accounts matched the current search and filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Account
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Scope
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Assignment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Last login
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAccounts.map((account) => {
                  const isCurrentUser = user?.id === account.id;

                  return (
                    <tr key={account.id} className="align-top hover:bg-slate-50/80">
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950">{account.name}</p>
                            {isCurrentUser ? (
                              <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                                Current session
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-slate-500">{account.email}</p>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${roleStyles[account.role]}`}
                        >
                          {formatUserRole(account.role)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${scopeStyles[account.scope ?? "platform"]}`}
                        >
                          {formatScope(account.scope)}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-600">
                        <div className="space-y-2">
                          {account.scope === "platform" ? (
                            <div className="inline-flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-slate-500" />
                              Platform-wide
                            </div>
                          ) : (
                            <>
                              <div className="inline-flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-slate-500" />
                                {account.churchName ?? "No church assignment"}
                              </div>
                              {account.branchName ? (
                                <div className="inline-flex items-center gap-2">
                                  <GitBranch className="h-4 w-4 text-slate-500" />
                                  {account.branchName}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-600">
                        {formatDateTime(account.lastLoginAt)}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyles[account.status]}`}
                        >
                          {account.status}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleToggleStatus(account)}
                            disabled={isSaving || isCurrentUser}
                            className="h-10 rounded-2xl"
                          >
                            {account.status === "active" ? "Suspend" : "Activate"}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleResetPassword(account)}
                            disabled={isSaving}
                            className="h-10 rounded-2xl"
                          >
                            <Lock className="mr-2 h-4 w-4" />
                            Reset password
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDeleteUser(account)}
                            disabled={isSaving || isCurrentUser}
                            className="h-10 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
