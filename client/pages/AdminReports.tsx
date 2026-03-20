import { Download, TrendingUp, DollarSign, Users, Building2, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { formatAdminCurrency } from "@/lib/currency";

const donationData = [
  { month: "Jan", amount: 45000 },
  { month: "Feb", amount: 52000 },
  { month: "Mar", amount: 48000 },
  { month: "Apr", amount: 61000 },
  { month: "May", amount: 58000 },
  { month: "Jun", amount: 71000 },
];

const churchGrowthData = [
  { month: "Jan", churches: 8 },
  { month: "Feb", churches: 10 },
  { month: "Mar", churches: 12 },
  { month: "Apr", churches: 15 },
  { month: "May", churches: 18 },
  { month: "Jun", churches: 21 },
];

const memberGrowthData = [
  { month: "Jan", members: 2150 },
  { month: "Feb", members: 2480 },
  { month: "Mar", members: 2890 },
  { month: "Apr", members: 3410 },
  { month: "May", members: 3950 },
  { month: "Jun", members: 4520 },
];

export default function AdminReports() {
  return (
    <AdminShell
      title="System reports"
      description="Review platform growth, finance, and church adoption with the same admin navigation used everywhere else."
      icon={BarChart3}
      actions={
        <Button className="h-11 rounded-2xl bg-white text-slate-950 hover:bg-slate-100">
          <Download className="mr-2 h-4 w-4" />
          Export summary
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Total churches</h3>
            <div className="rounded-2xl bg-blue-100 p-3">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-950">21</p>
          <div className="mt-3 text-sm text-emerald-600">+3 this month</div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Total members</h3>
            <div className="rounded-2xl bg-green-100 p-3">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-950">4,520</p>
          <div className="mt-3 text-sm text-emerald-600">+570 this month</div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Total giving</h3>
            <div className="rounded-2xl bg-yellow-100 p-3">
              <DollarSign className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-950">
            {formatAdminCurrency(71000, { compact: true })}
          </p>
          <div className="mt-3 text-sm text-emerald-600">+$13k this month</div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Avg giving/church</h3>
            <div className="rounded-2xl bg-purple-100 p-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-slate-950">
            {formatAdminCurrency(3380, { compact: true })}
          </p>
          <div className="mt-3 text-sm text-slate-500">Per church monthly</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-semibold text-slate-950">Total giving trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={donationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value) => [formatAdminCurrency(value as number), "Amount"]}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: "#f59e0b", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-lg font-semibold text-slate-950">Church growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={churchGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value) => [value, "Churches"]}
              />
              <Bar dataKey="churches" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-6 text-lg font-semibold text-slate-950">Total member growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={memberGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value) => [value, "Members"]}
              />
              <Line
                type="monotone"
                dataKey="members"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: "#10b981", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-950">Download reports</h3>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            "System Overview Report",
            "Church Performance Report",
            "Financial Summary Report",
            "Member Statistics Report",
            "Growth Analytics Report",
            "Compliance Report",
          ].map((report) => (
            <div
              key={report}
              className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{report}</span>
              <Button variant="ghost" size="sm" className="rounded-2xl">
                <Download className="h-4 w-4 text-slate-700" />
              </Button>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
