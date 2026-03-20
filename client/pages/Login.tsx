import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Loader,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSuccessfulLogin = async (nextEmail: string, nextPassword: string) => {
    const authData = await login(nextEmail, nextPassword);

    if (authData?.user?.role === "super_admin") {
      navigate("/admin-dashboard");
      return;
    }

    navigate("/dashboard");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      setError("Please enter both your email and password.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      await handleSuccessfulLogin(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.1),_transparent_35%),linear-gradient(135deg,#f8fafc_0%,#e2e8f0_45%,#ffffff_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-slate-950 p-8 text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.95)] sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.22),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.16),_transparent_28%)]" />
          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-white/20">
                <BrandLogo className="scale-[1.08]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">DivineDesk</p>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Ministry OS
                </p>
              </div>
            </Link>

            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Welcome back
            </div>

            <h1 className="mt-6 text-5xl font-semibold leading-[1.04] text-white">
              Step into a cleaner rhythm for ministry operations.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Sign in to your church workspace and pick up where your team left off across members, giving, attendance, and branch operations.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: "Secure access",
                  body: "Role-aware sign-in for church admins and delegated branch admins.",
                },
                {
                  icon: Users,
                  title: "Live records",
                  body: "Members, events, and attendance now persist across sessions.",
                },
                {
                  icon: Wallet,
                  title: "Giving insight",
                  body: "Weekly stewardship data stays available after restart.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur"
                  >
                    <Icon className="h-5 w-5 text-amber-300" />
                    <p className="mt-4 text-lg font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/70 bg-white/90 p-8 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.55)] backdrop-blur sm:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Sign in
            </p>
            <h2 className="mt-3 text-4xl font-semibold text-slate-950">
              Access your workspace
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Sign in with your live church account. Demo workspaces have been cleared from the system.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-800">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@church.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                className="h-12 rounded-2xl border-slate-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-800">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                className="h-12 rounded-2xl border-slate-200 bg-white"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
            >
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Signing in
                </>
              ) : (
                <>
                  Continue to dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600">
            New workspaces start with a 30-day free trial, then move to the monthly subscription you selected at signup.
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-600">
            New church?{" "}
            <Link to="/signup" className="font-semibold text-slate-950 underline-offset-4 hover:underline">
              Create an account
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
