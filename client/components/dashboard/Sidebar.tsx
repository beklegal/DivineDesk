import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  ChevronRight,
  HeartHandshake,
  Home,
  Settings,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { BillingPlanFeature } from "@shared/api";
import type { LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserRole } from "@/lib/auth";
import { churchHasBillingFeature } from "@/lib/billing";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationItems = [
  { icon: Home, label: "Overview", href: "/dashboard" },
  { icon: Users, label: "Members", href: "/members" },
  { icon: Wallet, label: "Giving", href: "/donations", requiredFeature: "giving" },
  { icon: Calendar, label: "Events", href: "/events" },
  { icon: HeartHandshake, label: "Attendance", href: "/attendance" },
  { icon: BarChart3, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
] satisfies Array<{
  icon: LucideIcon;
  label: string;
  href: string;
  requiredFeature?: BillingPlanFeature;
}>;

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { branch, church, user } = useAuth();
  const hasGivingAccess = churchHasBillingFeature(church, "giving");
  const visibleNavigationItems = navigationItems.filter(
    (item) =>
      !item.requiredFeature || churchHasBillingFeature(church, item.requiredFeature),
  );

  const churchInitials =
    church?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) ?? "DD";

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <div aria-hidden="true" className="hidden w-80 shrink-0 lg:block" />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-80 flex-col overflow-y-auto border-r border-white/10 bg-[linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] px-5 py-5 text-white shadow-[0_24px_60px_-24px_rgba(2,6,23,0.95)] transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between lg:justify-start">
          <Link to="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/20">
              <BrandLogo className="scale-[1.08]" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">DivineDesk</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Ministry OS
              </p>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_45px_-24px_rgba(148,163,184,0.45)] backdrop-blur">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-white/10 text-lg font-semibold text-white ring-1 ring-white/10">
              {churchInitials}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{church?.name ?? "Workspace"}</p>
              <p className="text-xs text-slate-400">
                {branch?.name
                  ? `${branch.name}  -  ${formatUserRole(user?.role)}`
                  : user?.name ?? "Church admin"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                Members
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {church?.totalMembers ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                Health
              </p>
              <p className="mt-2 text-xl font-semibold text-emerald-300">Live</p>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 px-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          Workspace
        </div>

        <nav className="space-y-2">
          {visibleNavigationItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-medium transition",
                  active
                    ? "bg-white text-slate-950 shadow-lg shadow-black/15"
                    : "text-slate-300 hover:bg-white/8 hover:text-white",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4.5 w-4.5 transition",
                      active ? "text-slate-950" : "text-slate-400 group-hover:text-white",
                    )}
                  />
                  {item.label}
                </span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition",
                    active ? "text-slate-500" : "text-slate-600 group-hover:text-slate-300",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
          <p className="text-sm font-semibold text-white">Built for weekly rhythm</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {hasGivingAccess
              ? "Track attendance, giving, and follow-up from one calm workspace built for ministry teams."
              : "Track attendance, members, and follow-up from one calm workspace built for ministry teams."}
          </p>
        </div>
      </aside>
    </>
  );
}

