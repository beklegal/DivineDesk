import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
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
import {
  BILLING_PLANS,
  getSelfServeBillingPlans,
  type SubscriptionPlanKey,
} from "@shared/api";
import { ArrowRight, BadgeCheck, CheckCircle2, Loader, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { findBillingPlan, getBillingPlanSummary, getBillingTrialLabel } from "@/lib/billing";

const selfServePlans = getSelfServeBillingPlans();
const defaultBillingPlanKey = selfServePlans[0]?.key ?? "starter";

function getRecommendedPlanKey(churchSize: string): SubscriptionPlanKey {
  if (churchSize === "large") {
    return "enterprise";
  }

  if (churchSize === "medium") {
    return "growth";
  }

  return "starter";
}

export default function SignUp() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    churchName: "",
    adminName: "",
    email: "",
    password: "",
    churchSize: "",
    billingPlanKey: defaultBillingPlanKey as SubscriptionPlanKey,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signup } = useAuth();
  const selectedPlan = findBillingPlan(formData.billingPlanKey);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError("");
  };

  const handleStepOne = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.churchName || !formData.adminName) {
      setError("Please complete your church and admin details.");
      return;
    }

    setError("");
    setStep(2);
  };

  const handleStepTwo = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.email || !formData.password || !formData.churchSize) {
      setError("Please complete your account setup.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const authData = await signup(
        formData.churchName,
        formData.adminName,
        formData.email,
        formData.password,
        formData.churchSize as "small" | "medium" | "large",
        formData.billingPlanKey,
      );

      if (authData?.user?.role === "super_admin") {
        navigate("/admin-dashboard");
        return;
      }

      navigate("/dashboard");
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_32%),linear-gradient(135deg,#f8fafc_0%,#e2e8f0_45%,#ffffff_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="rounded-[36px] border border-white/70 bg-white/90 p-8 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.55)] backdrop-blur sm:p-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <BrandLogo className="scale-[1.08]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">DivineDesk</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Ministry OS
              </p>
            </div>
          </Link>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Create account
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-950">
              Launch your church workspace
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Start with a polished dashboard, a persistent church record, and a{" "}
              {getBillingTrialLabel().toLowerCase()} before your selected plan goes live.
            </p>
          </div>

          <div className="mt-8 flex gap-3">
            {[1, 2].map((currentStep) => (
              <div key={currentStep} className="flex-1">
                <div
                  className={`h-2 rounded-full transition ${
                    step >= currentStep ? "bg-slate-950" : "bg-slate-200"
                  }`}
                />
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  Step {currentStep}
                </p>
              </div>
            ))}
          </div>

          {step === 1 ? (
            <form onSubmit={handleStepOne} className="mt-8 space-y-5">
              {error ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="churchName" className="text-sm font-semibold text-slate-800">
                  Church name
                </Label>
                <Input
                  id="churchName"
                  name="churchName"
                  placeholder="Grace Community Church"
                  value={formData.churchName}
                  onChange={handleInputChange}
                  className="h-12 rounded-2xl border-slate-200 bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminName" className="text-sm font-semibold text-slate-800">
                  Primary admin
                </Label>
                <Input
                  id="adminName"
                  name="adminName"
                  placeholder="Jordan Miles"
                  value={formData.adminName}
                  onChange={handleInputChange}
                  className="h-12 rounded-2xl border-slate-200 bg-white"
                />
              </div>

              <Button className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleStepTwo} className="mt-8 space-y-5">
              {error ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-800">
                  Admin email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@church.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="h-12 rounded-2xl border-slate-200 bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-800">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a secure password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="h-12 rounded-2xl border-slate-200 bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">
                  Church size
                </Label>
                <Select
                  value={formData.churchSize}
                  onValueChange={(value) => {
                    setFormData((previous) => ({
                      ...previous,
                      churchSize: value,
                      billingPlanKey: getRecommendedPlanKey(value),
                    }));
                    setError("");
                  }}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="Choose your church size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small church</SelectItem>
                    <SelectItem value="medium">Growing church</SelectItem>
                    <SelectItem value="large">Large church</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-800">
                  Subscription plan
                </Label>
                <Select
                  value={formData.billingPlanKey}
                  onValueChange={(value) => {
                    setFormData((previous) => ({
                      ...previous,
                      billingPlanKey: value as SubscriptionPlanKey,
                    }));
                    setError("");
                  }}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="Choose your billing plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {selfServePlans.map((plan) => (
                      <SelectItem key={plan.key} value={plan.key}>
                        {getBillingPlanSummary(plan)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{selectedPlan.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                        {selectedPlan.targetProfile}
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                      {selectedPlan.publicPriceLabel}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {selectedPlan.description}
                  </p>
                  <div className="mt-4 space-y-3">
                    {selectedPlan.highlights.map((highlight) => (
                      <div key={highlight} className="flex items-start gap-3 text-sm text-slate-600">
                        <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
                        <p>{highlight}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                  Need a tailored rollout? Custom plans are quoted separately for mega churches,
                  dedicated support, and deeper integrations.
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-12 flex-1 rounded-2xl border-slate-300 bg-white"
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 flex-1 rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                >
                  {isLoading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Creating
                    </>
                  ) : (
                    <>
                      Create workspace
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-slate-950 underline-offset-4 hover:underline">
              Sign in here
            </Link>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-slate-950 p-8 text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.95)] sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.22),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.16),_transparent_28%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Pricing lineup
            </div>

            <h2 className="mt-6 text-5xl font-semibold leading-[1.04] text-white">
              Pick the tier that fits today and still leaves room to grow.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Every new church starts with a real persisted workspace, a primary branch, and a{" "}
              {getBillingTrialLabel().toLowerCase()}. After that, billing follows the tier you
              choose, while custom plans are quoted with the platform team.
            </p>

            <div className="mt-10 space-y-4">
              {BILLING_PLANS.map((plan) => {
                const isSelected = plan.key === selectedPlan.key;

                return (
                <div
                  key={plan.key}
                  className={`rounded-[28px] border px-5 py-5 backdrop-blur transition ${
                    isSelected
                      ? "border-amber-300/70 bg-white/16 shadow-[0_24px_60px_-42px_rgba(251,191,36,0.8)]"
                      : "border-white/10 bg-white/10"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-white">{plan.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                        {plan.targetProfile}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
                      {plan.publicPriceLabel}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{plan.description}</p>
                  <div className="mt-4 space-y-3">
                    {plan.highlights.map((highlight) => (
                      <div key={highlight} className="flex items-start gap-3">
                        <BadgeCheck className="mt-0.5 h-4 w-4 text-amber-300" />
                        <p className="text-sm leading-6 text-slate-300">{highlight}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-400">
                    {plan.selfServeEnabled
                      ? "Available during signup"
                      : "Custom pricing arranged with the platform team"}
                  </p>
                </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
