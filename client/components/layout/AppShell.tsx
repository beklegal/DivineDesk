import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserRole } from "@/lib/auth";
import { churchHasBillingFeature, findBillingPlan } from "@/lib/billing";
import { formatChurchCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/dashboard/Sidebar";
import { LucideIcon, LogOut, Menu, Sparkles, X } from "lucide-react";

interface AppShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  className?: string;
}

export function AppShell({
  title,
  description,
  icon: Icon,
  children,
  actions,
  eyebrow = "Church Workspace",
  className,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { branch, church, logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentPlan = church ? findBillingPlan(church.billing.planKey) : null;
  const hasGivingAccess = churchHasBillingFeature(church, "giving");
  const heroStats = church
    ? [
        { label: "Members", value: church.totalMembers.toString() },
        ...(hasGivingAccess
          ? [
              {
                label: "Monthly giving",
                value: formatChurchCurrency(church.monthlyDonations || 0, { compact: true }),
              },
            ]
          : [{ label: "Plan", value: currentPlan?.name ?? "Starter" }]),
        { label: "Attendance", value: `${church.weeklyAttendance || 0}/week` },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)] text-slate-900 lg:flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen((open) => !open)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 lg:hidden"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm sm:flex sm:items-center sm:gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  <BrandLogo className="scale-[1.08]" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {eyebrow}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm md:block">
                <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">
                  {branch?.name
                    ? `${branch.name}  -  ${church?.name ?? "DivineDesk"}`
                    : church?.name ?? "DivineDesk Platform"}
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  {formatUserRole(user?.role)}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-slate-950/15">
                {user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "DD"}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-11 rounded-2xl border border-transparent px-4 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>

        <main className={cn("mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8", className)}>
          <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-slate-950 px-6 py-8 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)] sm:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.24),_transparent_25%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.18),_transparent_30%)]" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-200">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  {eyebrow}
                </div>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-white/10 ring-1 ring-white/15">
                    <Icon className="h-7 w-7 text-amber-300" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      {title}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                      {description}
                    </p>
                  </div>
                </div>
                {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
              </div>

              {heroStats.length > 0 ? (
                <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
                  {heroStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-3xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur"
                    >
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <div className="mt-8 space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

