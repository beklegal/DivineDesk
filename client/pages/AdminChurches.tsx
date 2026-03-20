import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Edit2, Loader2, Plus, Search, Trash2 } from "lucide-react";
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
import { formatSubscriptionAmount } from "@/lib/billing";
import { formatAdminCurrency } from "@/lib/currency";
import { BILLING_PLANS, ChurchAdmin, CreateChurchRequest } from "@shared/api";

const statusStyles = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-slate-100 text-slate-700",
  suspended: "bg-red-100 text-red-700",
} as const;

const billingStatusStyles = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-amber-100 text-amber-700",
  canceled: "bg-rose-100 text-rose-700",
  suspended: "bg-red-100 text-red-700",
} as const;

export default function AdminChurches() {
  const [churches, setChurches] = useState<ChurchAdmin[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState<CreateChurchRequest>({
    name: "",
    size: "small",
    adminName: "",
    adminEmail: "",
    billingPlanKey: "starter",
  });
  const [error, setError] = useState("");
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetchChurches();
  }, [token]);

  const fetchChurches = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/churches", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChurches(data.data || []);
      }
    } catch (requestError) {
      console.error("Failed to fetch churches:", requestError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name || !formData.size) {
      setError("Please fill in all required fields.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/churches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to create church");
      }

      setFormData({
        name: "",
        size: "small",
        adminName: "",
        adminEmail: "",
        billingPlanKey: "starter",
      });
      setShowAddForm(false);
      await fetchChurches();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to create church",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (churchId: string) => {
    if (!window.confirm("Delete this church workspace?")) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/churches/${churchId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to delete church");
      }

      await fetchChurches();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete church",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const filteredChurches = churches.filter((church) =>
    church.churchName.toLowerCase().includes(search.toLowerCase()) ||
    church.adminName.toLowerCase().includes(search.toLowerCase()) ||
    church.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
    church.subscriptionPlanName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminShell
      title="Church management"
      description="Register new churches, review billing status, and open each workspace with the same platform navigation."
      icon={Plus}
      actions={
        <Button
          onClick={() => setShowAddForm((current) => !current)}
          className="h-11 rounded-2xl bg-white text-slate-950 hover:bg-slate-100"
        >
          <Plus className="mr-2 h-4 w-4" />
          {showAddForm ? "Close form" : "Add church"}
        </Button>
      }
    >
      {error ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {showAddForm ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">Register new church</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            New churches start with the billing plan you assign here, then move into the subscription flow already configured for the platform.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Church name</Label>
                <Input
                  placeholder="Church name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, name: event.target.value }))
                  }
                  className="h-11 rounded-2xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Church size</Label>
                <Select
                  value={formData.size}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      size: value as CreateChurchRequest["size"],
                    }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (1-250 members)</SelectItem>
                    <SelectItem value="medium">Medium (250-1000 members)</SelectItem>
                    <SelectItem value="large">Large (1000+ members)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Admin name</Label>
                <Input
                  placeholder="Admin name"
                  value={formData.adminName}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, adminName: event.target.value }))
                  }
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Admin email</Label>
                <Input
                  type="email"
                  placeholder="admin@church.com"
                  value={formData.adminEmail}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, adminEmail: event.target.value }))
                  }
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Subscription plan</Label>
                <Select
                  value={formData.billingPlanKey}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      billingPlanKey: value as CreateChurchRequest["billingPlanKey"],
                    }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_PLANS.map((plan) => (
                      <SelectItem key={plan.key} value={plan.key}>
                        {plan.name} - {formatSubscriptionAmount(plan.amount)}/month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="h-11 rounded-2xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
              >
                {isLoading ? "Creating..." : "Register church"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Church directory</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Search across churches, subscription plans, and administrators.
            </p>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search churches"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-2xl pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : filteredChurches.length === 0 ? (
          <div className="px-4 py-16 text-center text-slate-500">
            {churches.length === 0
              ? "No churches registered yet."
              : "No churches matched the current search."}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Church
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Admin
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Members
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Plan
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Monthly giving
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Billing
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
                {filteredChurches.map((church) => (
                  <tr key={church.churchId} className="hover:bg-slate-50/80">
                    <td className="px-6 py-5 text-sm font-semibold text-slate-950">
                      {church.churchName}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-950">{church.adminName}</span>
                        <span>{church.adminEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">{church.memberCount}</td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-950">{church.subscriptionPlanName}</span>
                        <span>{formatSubscriptionAmount(church.subscriptionAmount)}/month</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right text-sm font-semibold text-slate-950">
                      {formatAdminCurrency(church.monthlyDonations, { compact: true })}
                    </td>
                    <td className="px-6 py-5 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${billingStatusStyles[church.subscriptionStatus]}`}
                      >
                        {church.subscriptionStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyles[church.status]}`}
                      >
                        {church.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/admin/churches/${church.churchId}`}
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 px-3 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                          aria-label={`Manage ${church.churchName}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(church.churchId)}
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-red-200 px-3 text-red-600 transition hover:bg-red-50"
                          aria-label={`Delete ${church.churchName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
