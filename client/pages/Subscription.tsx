import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CreditCard,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatBillingDate,
  formatSubscriptionAmount,
  formatSubscriptionStatusLabel,
} from "@/lib/billing";

export default function Subscription() {
  const { church, logout, refreshSession, token, updateChurch, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLaunchingCheckout, setIsLaunchingCheckout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const autoVerifiedReference = useRef<string | null>(null);

  const reference =
    searchParams.get("reference")?.trim() || church?.billing.lastPaymentReference || "";
  const canMakePayment =
    church?.status === "active" && church?.billing.status !== "suspended";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError("");
    setSuccess("");

    try {
      await refreshSession();
      setSuccess("Billing status refreshed.");
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh billing status",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleVerifyPayment = async (providedReference?: string) => {
    if (!token) {
      return;
    }

    const nextReference = providedReference || reference;
    if (!nextReference) {
      setError("Complete the Paystack payment first, then return here to verify it.");
      return;
    }

    setIsVerifying(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/church/billing/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reference: nextReference }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to verify payment");
      }

      updateChurch(payload.data);
      await refreshSession();
      setSuccess("Payment confirmed. Your workspace is unlocked.");
      navigate("/dashboard", { replace: true });
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Failed to verify payment",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLaunchCheckout = async () => {
    if (!token || !church) {
      return;
    }

    setIsLaunchingCheckout(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/church/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planKey: church.billing.planKey,
          billingEmail: church.billing.billingEmail ?? user?.email,
          callbackUrl: `${window.location.origin}/subscription`,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create Paystack checkout");
      }

      window.location.assign(payload.data.authorizationUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Failed to create Paystack checkout",
      );
    } finally {
      setIsLaunchingCheckout(false);
    }
  };

  useEffect(() => {
    const queryReference = searchParams.get("reference")?.trim();

    if (!queryReference || !token || autoVerifiedReference.current === queryReference) {
      return;
    }

    autoVerifiedReference.current = queryReference;
    void handleVerifyPayment(queryReference);
  }, [searchParams, token]);

  if (!church) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_50%,#f8fafc_100%)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">Billing access unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We could not find a church workspace for this account. Sign in again or contact the
            system administrator.
          </p>
          <Button onClick={handleLogout} className="mt-6 h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
            Back to login
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="h-11 rounded-2xl border-slate-300 bg-white"
          >
            Sign out
          </Button>
        </div>

        <section className="overflow-hidden rounded-[36px] border border-white/70 bg-slate-950 px-8 py-10 text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.95)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-200">
                <LockKeyhole className="h-3.5 w-3.5 text-amber-300" />
                Workspace locked
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Subscription action needed for {church.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                The church workspace is paused until the subscription is settled. Once payment is
                confirmed, members, donations, events, attendance, and settings will unlock again.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Current status</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {formatSubscriptionStatusLabel(church.billing.status)}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {church.billing.planName} at {formatSubscriptionAmount(church.billing.amount)}/month
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-sm">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_340px]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold text-slate-950">Payment prompt</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              New churches receive one month free. After that, the workspace locks on the due date
              until the monthly {formatSubscriptionAmount(church.billing.amount)} payment is made.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next billing date</p>
                <p className="mt-3 text-xl font-semibold text-slate-950">
                  {formatBillingDate(church.billing.renewalDate ?? church.billing.trialEndsAt)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Billing email</p>
                <p className="mt-3 text-xl font-semibold text-slate-950">
                  {church.billing.billingEmail ?? church.adminEmail ?? church.email ?? "Not set"}
                </p>
              </div>
            </div>

            {canMakePayment ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  onClick={() => void handleLaunchCheckout()}
                  disabled={isLaunchingCheckout}
                  className="h-12 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800"
                >
                  {isLaunchingCheckout ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Pay with Paystack
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleVerifyPayment()}
                  disabled={isVerifying || !reference}
                  className="h-12 rounded-2xl border-slate-300 bg-white"
                >
                  {isVerifying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  I already paid
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleRefresh()}
                  disabled={isRefreshing}
                  className="h-12 rounded-2xl border-slate-300 bg-white"
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Refresh status
                </Button>
              </div>
            ) : (
              <div className="mt-8 rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-700">
                This workspace was suspended by the system administrator. Contact the platform team
                before attempting another payment.
              </div>
            )}

            {reference ? (
              <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                Last Paystack reference: <span className="font-medium text-slate-950">{reference}</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">What happens next</p>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                <p>1. Open the Paystack payment link and complete the charge.</p>
                <p>2. Return here and verify the payment if the dashboard does not unlock automatically.</p>
                <p>3. As soon as the payment is confirmed, you will be redirected back into the workspace.</p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Managed by system admin</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Super admins can still change this church to free access, premium access, or a
                manual lock from the admin dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
