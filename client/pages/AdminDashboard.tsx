import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  DollarSign,
  Loader2,
  Plus,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { formatAdminCurrency } from "@/lib/currency";
import { formatSubscriptionAmount } from "@/lib/billing";
import { AdminDashboardStats, ChurchAdmin } from "@shared/api";

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [churches, setChurches] = useState<ChurchAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      return;
    }

    void fetchData();
  }, [token]);

  const fetchData = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const [statsRes, churchesRes] = await Promise.all([
        fetch("/api/admin/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/churches", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      if (churchesRes.ok) {
        const churchesData = await churchesRes.json();
        setChurches(churchesData.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminShell
      title="Platform overview"
      description="Monitor churches, subscriptions, revenue, and workspace health from one shared system-admin dashboard."
      icon={BarChart3}
      actions={
        <Link to="/admin/churches">
          <Button className="h-11 rounded-2xl bg-white text-slate-950 hover:bg-slate-100">
            <Plus className="mr-2 h-4 w-4" />
            Manage churches
          </Button>
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {stats ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-500">Total churches</h3>
                  <div className="rounded-2xl bg-blue-100 p-3">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-4xl font-semibold text-slate-950">{stats.totalChurches}</p>
                <p className="mt-3 text-sm text-slate-500">{stats.activeChurches} active</p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-500">Total members</h3>
                  <div className="rounded-2xl bg-green-100 p-3">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <p className="text-4xl font-semibold text-slate-950">
                  {stats.totalMembers.toLocaleString()}
                </p>
                <p className="mt-3 text-sm text-slate-500">Across all churches</p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-500">Monthly giving</h3>
                  <div className="rounded-2xl bg-yellow-100 p-3">
                    <DollarSign className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                <p className="text-4xl font-semibold text-slate-950">
                  {formatAdminCurrency(stats.totalDonations, { compact: true })}
                </p>
                <p className="mt-3 text-sm text-slate-500">Super-admin reporting view</p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-500">System health</h3>
                  <div className="rounded-2xl bg-purple-100 p-3">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <p className="text-4xl font-semibold text-slate-950">
                  {stats.systemHealth.uptime}%
                </p>
                <div className="mt-4 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(stats.systemHealth.uptime, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-500">Monthly recurring revenue</h3>
                  <div className="rounded-2xl bg-emerald-100 p-3">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <p className="text-4xl font-semibold text-slate-950">
                  {formatAdminCurrency(stats.monthlyRecurringRevenue, { compact: true })}
                </p>
                <p className="mt-3 text-sm text-slate-500">Active platform subscriptions</p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-500">Trials and collections</h3>
                  <div className="rounded-2xl bg-amber-100 p-3">
                    <Building2 className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                <p className="text-4xl font-semibold text-slate-950">
                  {stats.trialChurches + stats.pastDueChurches}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  {stats.trialChurches} trials, {stats.pastDueChurches} past due
                </p>
              </div>
            </div>
          ) : null}

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Churches management</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Review billing status, renewal dates, and activity across all registered churches.
                </p>
              </div>
              <Link to="/admin/churches">
                <Button className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                  <Plus className="mr-2 h-4 w-4" />
                  Add church
                </Button>
              </Link>
            </div>

            {churches.length === 0 ? (
              <div className="px-4 py-16 text-center text-slate-500">
                No churches registered yet.
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
                        Renewal
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
                    {churches.map((church) => (
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
                        <td className="px-6 py-5 text-sm text-slate-600">
                          {church.renewalDate
                            ? new Date(church.renewalDate).toLocaleDateString()
                            : "Pending"}
                        </td>
                        <td className="px-6 py-5 text-sm">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyles[church.status]}`}
                          >
                            {church.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <Link to={`/admin/churches/${church.churchId}`}>
                            <Button variant="outline" className="h-10 rounded-2xl">
                              Manage
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-3">
            <Link to="/admin/reports" className="group rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-950">System reports</h3>
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                View platform-wide analytics, growth, and finance trends.
              </p>
              <div className="mt-5 inline-flex items-center text-sm font-medium text-slate-700">
                Open reports
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Link>

            <Link to="/admin/users" className="group rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-950">User management</h3>
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Manage platform, church, and branch-level access centrally.
              </p>
              <div className="mt-5 inline-flex items-center text-sm font-medium text-slate-700">
                Open users
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Link>

            <Link to="/admin/churches" className="group rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-950">Church directory</h3>
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Open any church profile and manage subscription access in one place.
              </p>
              <div className="mt-5 inline-flex items-center text-sm font-medium text-slate-700">
                Open churches
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Link>
          </div>
        </>
      )}
    </AdminShell>
  );
}
