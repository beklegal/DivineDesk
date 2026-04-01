import { useEffect, useState } from "react";
import { Building2, GitBranch, Loader2, Save, Settings2, ShieldCheck, UserCog } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
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
import { canManageChurchWorkspace } from "@shared/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchWorkspace } from "@/hooks/useChurchWorkspace";
import { formatUserRole } from "@/lib/auth";
import { churchHasBillingFeature, findBillingPlan } from "@/lib/billing";

type TabKey = "profile" | "branches";

export default function Settings() {
  const { branch, church, token, updateChurch, user } = useAuth();
  const {
    workspace,
    branches,
    branchAdmins,
    currentBranch,
    isLoading,
    error,
    refetch,
  } = useChurchWorkspace();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
  });
  const [branchForm, setBranchForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [branchAdminForm, setBranchAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    branchId: "",
  });
  const [profileState, setProfileState] = useState({ isSaving: false, message: "", error: "" });
  const [branchState, setBranchState] = useState({ isSaving: false, message: "", error: "" });
  const [branchAdminState, setBranchAdminState] = useState({
    isSaving: false,
    message: "",
    error: "",
  });

  const canManageWorkspace = canManageChurchWorkspace(user);
  const currentChurch = workspace?.church ?? church;
  const currentPlan = currentChurch ? findBillingPlan(currentChurch.billing.planKey) : null;
  const canManageDelegatedAccess = churchHasBillingFeature(
    currentChurch,
    "delegated_access",
  );
  const canManageMultiBranch = churchHasBillingFeature(
    currentChurch,
    "multi_branch_management",
  );

  useEffect(() => {
    if (!workspace?.church) {
      return;
    }

    setProfileForm({
      name: workspace.church.name ?? "",
      email: workspace.church.email ?? "",
      phone: workspace.church.phone ?? "",
      address: workspace.church.address ?? "",
      website: workspace.church.website ?? "",
    });
  }, [workspace?.church]);

  useEffect(() => {
    if (branches.length === 0) {
      return;
    }

    setBranchAdminForm((previous) => ({
      ...previous,
      branchId: previous.branchId || branches[0].id,
    }));
  }, [branches]);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !canManageWorkspace) {
      return;
    }

    setProfileState({ isSaving: true, message: "", error: "" });

    try {
      const response = await fetch("/api/church/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileForm),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update church profile");
      }

      updateChurch(payload.data);
      setProfileState({
        isSaving: false,
        message: "Church profile updated successfully.",
        error: "",
      });
      refetch();
    } catch (profileError) {
      setProfileState({
        isSaving: false,
        message: "",
        error:
          profileError instanceof Error
            ? profileError.message
            : "Failed to update church profile",
      });
    }
  };

  const handleCreateBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !canManageWorkspace) {
      return;
    }

    setBranchState({ isSaving: true, message: "", error: "" });

    try {
      const response = await fetch("/api/church/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchForm),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create branch");
      }

      setBranchForm({
        name: "",
        email: "",
        phone: "",
        address: "",
      });
      setBranchState({
        isSaving: false,
        message: `${payload.data.name} is now part of your church workspace.`,
        error: "",
      });
      setBranchAdminForm((previous) => ({
        ...previous,
        branchId: previous.branchId || payload.data.id,
      }));
      refetch();
    } catch (branchError) {
      setBranchState({
        isSaving: false,
        message: "",
        error: branchError instanceof Error ? branchError.message : "Failed to create branch",
      });
    }
  };

  const handleCreateBranchAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !canManageWorkspace) {
      return;
    }

    setBranchAdminState({ isSaving: true, message: "", error: "" });

    try {
      const response = await fetch("/api/church/branch-admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(branchAdminForm),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create branch admin");
      }

      setBranchAdminForm((previous) => ({
        ...previous,
        name: "",
        email: "",
        password: "",
      }));
      setBranchAdminState({
        isSaving: false,
        message: `${payload.data.name} can now manage ${payload.data.branchName}.`,
        error: "",
      });
      refetch();
    } catch (branchAdminError) {
      setBranchAdminState({
        isSaving: false,
        message: "",
        error:
          branchAdminError instanceof Error
            ? branchAdminError.message
            : "Failed to create branch admin",
      });
    }
  };

  if (isLoading && !workspace) {
    return (
      <AppShell
        title="Workspace settings"
        description="Manage your church profile, branches, and delegated branch access."
        icon={Settings2}
        eyebrow="Workspace controls"
      >
        <div className="flex min-h-[320px] items-center justify-center rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
            <p className="mt-3 text-sm text-slate-500">Loading church settings...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Workspace settings"
      description={
        canManageMultiBranch
          ? "Keep your church profile current, add branches, and delegate branch-specific management without giving away the whole workspace."
          : canManageDelegatedAccess
          ? "Keep your church profile current and delegate branch-specific admin access from your existing church setup."
          : "Keep your church profile current. Delegated branch admins and multi-branch management unlock on Growth and Enterprise."
      }
      icon={Settings2}
      eyebrow="Branch-ready operations"
      actions={
        <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-200">
          {branch
            ? `Signed in as a ${formatUserRole(user?.role).toLowerCase()} for ${branch.name}.`
            : "Signed in with church-wide access for this workspace."}
        </div>
      }
    >
      {error ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Branch count</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{branches.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            {branches.length > 1
              ? "Your church is operating across multiple branch records."
              : "Your church currently has one primary branch."}
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Branch admins</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{branchAdmins.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            Delegated admins who can operate within their assigned branch.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Access scope</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {currentBranch?.name ?? "All branches"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {canManageWorkspace
              ? canManageMultiBranch
                ? "You can update the church profile, add branches, and create branch admins."
                : canManageDelegatedAccess
                ? "You can update the church profile and create delegated branch admins. Multi-branch management unlocks on Enterprise."
                : "You can update the church profile. Delegated branch admins and multi-branch management unlock on higher tiers."
              : "This view is scoped to your current branch. Branch admins cannot create branch accounts or branch-admin accounts."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {[
          { key: "profile" as const, label: "Church profile", icon: Building2 },
          { key: "branches" as const, label: "Branches", icon: GitBranch },
        ].map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "profile" ? (
        <form
          onSubmit={handleProfileSave}
          className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Church profile</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Update the core church record that appears across the workspace. A primary branch is created automatically, and additional branches can be managed from the next tab.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
              {canManageWorkspace ? "Editable" : "Read only"}
            </div>
          </div>

          {profileState.error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {profileState.error}
            </div>
          ) : null}
          {profileState.message ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {profileState.message}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">Church name</Label>
              <Input
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((previous) => ({ ...previous, name: event.target.value }))
                }
                disabled={!canManageWorkspace}
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">Email</Label>
              <Input
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((previous) => ({ ...previous, email: event.target.value }))
                }
                disabled={!canManageWorkspace}
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">Phone</Label>
              <Input
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((previous) => ({ ...previous, phone: event.target.value }))
                }
                disabled={!canManageWorkspace}
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-800">Website</Label>
              <Input
                value={profileForm.website}
                onChange={(event) =>
                  setProfileForm((previous) => ({ ...previous, website: event.target.value }))
                }
                disabled={!canManageWorkspace}
                className="h-12 rounded-2xl"
              />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label className="text-sm font-semibold text-slate-800">Address</Label>
            <Input
              value={profileForm.address}
              onChange={(event) =>
                setProfileForm((previous) => ({ ...previous, address: event.target.value }))
              }
              disabled={!canManageWorkspace}
              className="h-12 rounded-2xl"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="submit"
              disabled={!canManageWorkspace || profileState.isSaving}
              className="h-12 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800"
            >
              {profileState.isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save profile
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          {!canManageWorkspace ? (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
              Branch admins cannot create branch accounts. Branch creation and branch admin setup are reserved for the primary church admin, but you can still view your branch directory below.
            </div>
          ) : null}
          {canManageWorkspace && (!canManageDelegatedAccess || !canManageMultiBranch) ? (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
              {!canManageDelegatedAccess
                ? `${currentPlan?.name ?? "Starter"} keeps one primary branch active. Upgrade to Growth for delegated branch admins or Enterprise for multi-branch management.`
                : `${currentPlan?.name ?? "Growth"} includes delegated branch-admin access on your current setup. Upgrade to Enterprise to add more branches.`}
            </div>
          ) : null}

          {canManageWorkspace ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {canManageMultiBranch ? (
                <form
                  onSubmit={handleCreateBranch}
                  className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-slate-950">Add a branch</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Register satellite campuses or branch offices so the church can organize records and delegate access cleanly.
                    </p>
                  </div>

                  {branchState.error ? (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {branchState.error}
                    </div>
                  ) : null}
                  {branchState.message ? (
                    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {branchState.message}
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-800">Branch name</Label>
                      <Input
                        value={branchForm.name}
                        onChange={(event) =>
                          setBranchForm((previous) => ({ ...previous, name: event.target.value }))
                        }
                        placeholder="South Campus"
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-800">Branch email</Label>
                        <Input
                          value={branchForm.email}
                          onChange={(event) =>
                            setBranchForm((previous) => ({ ...previous, email: event.target.value }))
                          }
                          placeholder="south@church.org"
                          className="h-12 rounded-2xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-800">Phone</Label>
                        <Input
                          value={branchForm.phone}
                          onChange={(event) =>
                            setBranchForm((previous) => ({ ...previous, phone: event.target.value }))
                          }
                          placeholder="+1 (555) 0109"
                          className="h-12 rounded-2xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-800">Address</Label>
                      <Input
                        value={branchForm.address}
                        onChange={(event) =>
                          setBranchForm((previous) => ({ ...previous, address: event.target.value }))
                        }
                        placeholder="48 Elm Avenue"
                        className="h-12 rounded-2xl"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      type="submit"
                      disabled={branchState.isSaving}
                      className="h-12 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800"
                    >
                      {branchState.isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating
                        </>
                      ) : (
                        <>
                          <GitBranch className="mr-2 h-4 w-4" />
                          Create branch
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-slate-950">Add a branch</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Multi-branch setup unlocks on Enterprise and Custom plans.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                    Your current plan keeps the church on one primary branch record. Upgrade to Enterprise when you are ready to manage multiple campuses or ministry locations from one workspace.
                  </div>
                </section>
              )}

              {canManageDelegatedAccess ? (
                <form
                  onSubmit={handleCreateBranchAdmin}
                  className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-slate-950">Create a branch admin</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Assign a dedicated admin to one branch without giving them church-wide access.
                    </p>
                  </div>

                  {branchAdminState.error ? (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {branchAdminState.error}
                    </div>
                  ) : null}
                  {branchAdminState.message ? (
                    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {branchAdminState.message}
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-800">Admin name</Label>
                      <Input
                        value={branchAdminForm.name}
                        onChange={(event) =>
                          setBranchAdminForm((previous) => ({
                            ...previous,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Aisha Cole"
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-800">Admin email</Label>
                      <Input
                        value={branchAdminForm.email}
                        onChange={(event) =>
                          setBranchAdminForm((previous) => ({
                            ...previous,
                            email: event.target.value,
                          }))
                        }
                        placeholder="branchadmin@church.org"
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-800">Password</Label>
                      <Input
                        type="password"
                        value={branchAdminForm.password}
                        onChange={(event) =>
                          setBranchAdminForm((previous) => ({
                            ...previous,
                            password: event.target.value,
                          }))
                        }
                        placeholder="At least 6 characters"
                        className="h-12 rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-800">Assigned branch</Label>
                      <Select
                        value={branchAdminForm.branchId}
                        onValueChange={(value) =>
                          setBranchAdminForm((previous) => ({ ...previous, branchId: value }))
                        }
                      >
                        <SelectTrigger className="h-12 rounded-2xl">
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branchOption) => (
                            <SelectItem key={branchOption.id} value={branchOption.id}>
                              {branchOption.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      type="submit"
                      disabled={branchAdminState.isSaving || branches.length === 0}
                      className="h-12 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800"
                    >
                      {branchAdminState.isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating
                        </>
                      ) : (
                        <>
                          <UserCog className="mr-2 h-4 w-4" />
                          Create branch admin
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-2xl font-semibold text-slate-950">Create a branch admin</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Delegated branch-admin access starts on Growth.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                    Upgrade this church to Growth or higher when you want a separate login for a branch lead or delegated ministry admin without handing over the full workspace.
                  </div>
                </section>
              )}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">Branch directory</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Every branch can now sit inside the same church workspace while keeping delegated access clean.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  {branches.length} total
                </div>
              </div>

              <div className="space-y-4">
                {branches.map((branchItem) => (
                  <div
                    key={branchItem.id}
                    className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-slate-950">{branchItem.name}</p>
                          {branchItem.isPrimary ? (
                            <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                              Primary
                            </span>
                          ) : null}
                          {currentBranch?.id === branchItem.id ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                              Current scope
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {branchItem.address || "Address not yet added"}
                        </p>
                      </div>
                      <div className="text-sm text-slate-500">
                        {branchItem.email || "No branch email"}  -  {branchItem.phone || "No phone"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">Branch admins</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Sub-admin accounts stay tied to one branch so you can delegate safely.
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>

              {branchAdmins.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  {canManageDelegatedAccess
                    ? "No branch admins yet. Create one to let a branch operate with a limited scope."
                    : "No branch admins yet. Upgrade to Growth or higher to create delegated branch-admin accounts."}
                </div>
              ) : (
                <div className="space-y-4">
                  {branchAdmins.map((admin) => (
                    <div
                      key={admin.id}
                      className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-950">{admin.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{admin.email}</p>
                          <p className="mt-3 text-sm text-slate-600">
                            {admin.branchName}  -  {formatUserRole(admin.role)}
                          </p>
                        </div>
                        <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                          {admin.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

