import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { LucideIcon, LogOut } from "lucide-react";

interface AdminShellProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
}

const adminNav = [
  { label: "Overview", href: "/admin-dashboard" },
  { label: "Churches", href: "/admin/churches" },
  { label: "Subscriptions", href: "/admin/subscriptions" },
  { label: "Users", href: "/admin/users" },
  { label: "Reports", href: "/admin/reports" },
];

export function AdminShell({
  title,
  description,
  icon: Icon,
  children,
  actions,
}: AdminShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/admin-dashboard" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-950/15 ring-1 ring-slate-200">
              <BrandLogo className="scale-[1.08]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">DivineDesk Control</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                System admin
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm md:flex">
            {adminNav.map((item) => {
              const isActive =
                location.pathname === item.href ||
                location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm md:block">
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">Platform administrator</p>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="h-11 rounded-2xl border border-transparent px-4 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)] sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.22),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.16),_transparent_28%)]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-200">
                Platform analytics
              </div>
              <div className="flex items-center gap-4">
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
            </div>

            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>
        </section>

        <div className="mt-8 space-y-6">{children}</div>
      </main>
    </div>
  );
}
