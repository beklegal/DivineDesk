import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CreditCard,
  ExternalLink,
  Loader2,
  Search,
  Wallet,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { formatSubscriptionAmount } from "@/lib/billing";
import { formatAdminCurrency } from "@/lib/currency";
import type {
  Church,
  ChurchAdmin,
  ChurchSubscriptionPaymentRecord,
  CreateChurchSubscriptionPaymentRecordRequest,
  SubscriptionPaymentMethod,
} from "@shared/api";

type PaymentFormState = {
  amount: string;
  paidAt: string;
  method: SubscriptionPaymentMethod;
  reference: string;
  notes: string;
};

const manualPaymentMethods: Array<{
  value: SubscriptionPaymentMethod;
  label: string;
}> = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "cash", label: "Cash" },
  { value: "manual", label: "Manual adjustment" },
];

const billingStatusStyles = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-amber-100 text-amber-700",
  canceled: "bg-rose-100 text-rose-700",
  suspended: "bg-red-100 text-red-700",
} as const;

function getTodayInputDate() {
  return new Date().toISOString().split("T")[0];
}

function createPaymentFormState(amount?: number): PaymentFormState {
  return {
    amount: amount ? String(amount) : "",
    paidAt: getTodayInputDate(),
    method: "bank_transfer",
    reference: "",
    notes: "",
  };
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : "Pending";
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : "Pending";
}

function formatPaymentMethod(value: SubscriptionPaymentMethod) {
  switch (value) {
    case "bank_transfer":
      return "Bank transfer";
    case "mobile_money":
      return "Mobile money";
    case "cash":
      return "Cash";
    case "manual":
      return "Manual adjustment";
    case "paystack":
      return "Paystack";
    default:
      return value;
  }
}

function formatPaymentSource(value: ChurchSubscriptionPaymentRecord["source"]) {
  switch (value) {
    case "manual":
      return "Manual";
    case "paystack_verify":
      return "Paystack verify";
    case "paystack_webhook":
      return "Paystack webhook";
    default:
      return value;
  }
}

export default function AdminSubscriptions() {
  const { token } = useAuth();
  const [churches, setChurches] = useState<ChurchAdmin[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState("");
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null);
  const [paymentRecords, setPaymentRecords] = useState<ChurchSubscriptionPaymentRecord[]>([]);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(createPaymentFormState());
  const [search, setSearch] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredChurches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return churches.filter((church) => {
      if (!query) {
        return true;
      }

      return (
        church.churchName.toLowerCase().includes(query) ||
        church.adminName.toLowerCase().includes(query) ||
        church.adminEmail.toLowerCase().includes(query) ||
        church.subscriptionPlanName.toLowerCase().includes(query)
      );
    });
  }, [churches, search]);

  const totalExpectedRevenue = useMemo(
    () =>
      churches.reduce((total, church) => {
        if (["active", "trialing", "past_due"].includes(church.subscriptionStatus)) {
          return total + church.subscriptionAmount;
        }

        return total;
      }, 0),
    [churches],
  );

  const activeSubscriptions = churches.filter(
    (church) => church.subscriptionStatus === "active",
  ).length;
  const pastDueChurches = churches.filter(
    (church) => church.subscriptionStatus === "past_due",
  ).length;

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadChurches();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedChurchId) {
      return;
    }

    void loadSelectedChurch(selectedChurchId);
  }, [token, selectedChurchId]);

  const loadChurches = async () => {
    if (!token) {
      return;
    }

    setIsLoadingList(true);
    setError("");

    try {
      const response = await fetch("/api/admin/churches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load churches");
      }

      const nextChurches = payload.data || [];
      setChurches(nextChurches);

      if (nextChurches.length === 0) {
        setSelectedChurchId("");
        setSelectedChurch(null);
        setPaymentRecords([]);
        return;
      }

      if (
        !selectedChurchId ||
        !nextChurches.some((church: ChurchAdmin) => church.churchId === selectedChurchId)
      ) {
        setSelectedChurchId(nextChurches[0].churchId);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load churches",
      );
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadSelectedChurch = async (churchId: string) => {
    if (!token) {
      return;
    }

    setIsLoadingDetails(true);
    setError("");

    try {
      const [churchResponse, paymentsResponse] = await Promise.all([
        fetch(`/api/admin/churches/${churchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/churches/${churchId}/subscription-payments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const churchPayload = await churchResponse.json();
      const paymentsPayload = await paymentsResponse.json();

      if (!churchResponse.ok) {
        throw new Error(churchPayload.error || "Failed to load church");
      }

      if (!paymentsResponse.ok) {
        throw new Error(paymentsPayload.error || "Failed to load payment history");
      }

      setSelectedChurch(churchPayload.data);
      setPaymentRecords(paymentsPayload.data || []);
      setPaymentForm(createPaymentFormState(churchPayload.data.billing.amount));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load subscription details",
      );
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token || !selectedChurchId || !selectedChurch) {
      return;
    }

    setIsRecordingPayment(true);
    setError("");
    setSuccess("");

    try {
      const request: CreateChurchSubscriptionPaymentRecordRequest = {
        amount: paymentForm.amount ? Number(paymentForm.amount) : undefined,
        paidAt: paymentForm.paidAt,
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      };

      const response = await fetch(
        `/api/admin/churches/${selectedChurchId}/subscription-payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to record subscription payment");
      }

      setSelectedChurch(payload.data.church);
      setPaymentRecords(payload.data.records || []);
      setPaymentForm(createPaymentFormState(payload.data.church.billing.amount));
      setSuccess("Subscription payment recorded.");
      await loadChurches();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to record subscription payment",
      );
    } finally {
      setIsRecordingPayment(false);
    }
  };

  return (
    <AdminShell
      title="Subscription management"
      description="Record church subscription fees, review payment history, and keep billing actions one click away from the main admin navigation."
      icon={CreditCard}
      actions={
        selectedChurchId ? (
          <Link to={`/admin/churches/${selectedChurchId}`}>
            <Button className="h-11 rounded-2xl bg-white text-slate-950 hover:bg-slate-100">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open church profile
            </Button>
          </Link>
        ) : null
      }
    >
      {error ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-[28px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Churches</h3>
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-4xl font-semibold text-slate-950">{churches.length}</p>
          <p className="mt-3 text-sm text-slate-500">Churches with managed subscriptions</p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Expected monthly revenue</h3>
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-4xl font-semibold text-slate-950">
            {formatAdminCurrency(totalExpectedRevenue, { compact: true })}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Based on current church subscription plans
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Collections status</h3>
            <CreditCard className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-4xl font-semibold text-slate-950">
            {activeSubscriptions}/{churches.length || 0}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            {pastDueChurches} church{pastDueChurches === 1 ? "" : "es"} currently past due
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Church subscriptions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Pick a church, then record the subscription fee without leaving this page.
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search churches"
                className="h-11 rounded-2xl pl-9"
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {isLoadingList ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : filteredChurches.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-slate-500">
                No churches matched the current search.
              </div>
            ) : (
              filteredChurches.map((church) => {
                const isSelected = church.churchId === selectedChurchId;

                return (
                  <button
                    key={church.churchId}
                    type="button"
                    onClick={() => {
                      setSelectedChurchId(church.churchId);
                      setSuccess("");
                      setError("");
                    }}
                    className={`w-full rounded-[28px] border p-5 text-left transition ${
                      isSelected
                        ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-lg font-semibold ${isSelected ? "text-white" : "text-slate-950"}`}>
                          {church.churchName}
                        </p>
                        <p className={`mt-1 text-sm ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                          {church.adminName} · {church.adminEmail}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                          isSelected
                            ? "bg-white/10 text-white"
                            : billingStatusStyles[church.subscriptionStatus]
                        }`}
                      >
                        {church.subscriptionStatus.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className={isSelected ? "text-slate-400" : "text-slate-500"}>Plan</p>
                        <p className={`mt-1 font-medium ${isSelected ? "text-white" : "text-slate-950"}`}>
                          {church.subscriptionPlanName}
                        </p>
                      </div>
                      <div>
                        <p className={isSelected ? "text-slate-400" : "text-slate-500"}>Amount</p>
                        <p className={`mt-1 font-medium ${isSelected ? "text-white" : "text-slate-950"}`}>
                          {formatSubscriptionAmount(church.subscriptionAmount)}/month
                        </p>
                      </div>
                      <div>
                        <p className={isSelected ? "text-slate-400" : "text-slate-500"}>Renewal</p>
                        <p className={`mt-1 font-medium ${isSelected ? "text-white" : "text-slate-950"}`}>
                          {church.renewalDate
                            ? new Date(church.renewalDate).toLocaleDateString()
                            : "Pending"}
                        </p>
                      </div>
                      <div>
                        <p className={isSelected ? "text-slate-400" : "text-slate-500"}>Members</p>
                        <p className={`mt-1 font-medium ${isSelected ? "text-white" : "text-slate-950"}`}>
                          {church.memberCount}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {isLoadingDetails ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : selectedChurch ? (
            <div className="space-y-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment recorder
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                    {selectedChurch.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Record church subscription fees and review all payment history for this workspace.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Plan</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {selectedChurch.billing.planName}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Amount</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {formatSubscriptionAmount(selectedChurch.billing.amount)}/month
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Renewal</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {formatDate(
                        selectedChurch.billing.renewalDate ??
                          selectedChurch.billing.trialEndsAt,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <form
                  onSubmit={handleRecordPayment}
                  className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Amount (USD)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(event) =>
                          setPaymentForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        className="h-11 rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Paid on</Label>
                      <Input
                        type="date"
                        value={paymentForm.paidAt}
                        onChange={(event) =>
                          setPaymentForm((current) => ({
                            ...current,
                            paidAt: event.target.value,
                          }))
                        }
                        className="h-11 rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select
                        value={paymentForm.method}
                        onValueChange={(value: SubscriptionPaymentMethod) =>
                          setPaymentForm((current) => ({ ...current, method: value }))
                        }
                      >
                        <SelectTrigger className="h-11 rounded-2xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {manualPaymentMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Reference</Label>
                      <Input
                        value={paymentForm.reference}
                        onChange={(event) =>
                          setPaymentForm((current) => ({
                            ...current,
                            reference: event.target.value,
                          }))
                        }
                        placeholder="Receipt number or transfer reference"
                        className="h-11 rounded-2xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={paymentForm.notes}
                        onChange={(event) =>
                          setPaymentForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Optional notes about the payment"
                        className="min-h-[120px] rounded-2xl"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isRecordingPayment}
                    className="mt-5 h-11 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                  >
                    {isRecordingPayment ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    Record payment
                  </Button>
                </form>

                <div className="overflow-x-auto rounded-[28px] border border-slate-200">
                  {paymentRecords.length === 0 ? (
                    <div className="px-6 py-16 text-center text-slate-500">
                      No subscription payments have been recorded for this church yet.
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Paid on
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Method
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Source
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Coverage
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Amount
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Reference
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Recorded by
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {paymentRecords.map((record) => (
                          <tr key={record.id} className="align-top hover:bg-slate-50/80">
                            <td className="px-6 py-5 text-sm text-slate-600">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-950">
                                  {formatDate(record.paidAt)}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {formatDateTime(record.recordedAt)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-slate-600">
                              {formatPaymentMethod(record.method)}
                            </td>
                            <td className="px-6 py-5 text-sm">
                              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
                                {formatPaymentSource(record.source)}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-sm text-slate-600">
                              <div className="flex flex-col">
                                <span>{formatDate(record.periodStart)}</span>
                                <span className="text-xs text-slate-400">
                                  to {formatDate(record.periodEnd)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right text-sm font-semibold text-slate-950">
                              {formatAdminCurrency(record.amount)}
                            </td>
                            <td className="px-6 py-5 text-sm text-slate-600">
                              <div className="flex max-w-[220px] flex-col">
                                <span className="truncate font-medium text-slate-950">
                                  {record.reference || "No reference"}
                                </span>
                                <span className="truncate text-xs text-slate-400">
                                  {record.notes || "No notes"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-slate-600">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-950">
                                  {record.recordedByName || record.recordedByUserId}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {record.recordedByUserId}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-slate-500">
              Select a church from the left to record and review subscription fees.
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
