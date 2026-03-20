import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CreditCard, ExternalLink, Loader2, RefreshCcw, Save, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { formatSubscriptionAmount } from "@/lib/billing";
import { formatAdminCurrency } from "@/lib/currency";
import { AdminBillingPlan, BILLING_PLANS, Church, ChurchSize, ChurchStatus, ChurchSubscriptionPaymentRecord, CreateChurchSubscriptionPaymentRecordRequest, SubscriptionPaymentMethod, SubscriptionPlanKey, SubscriptionStatus, UpdateChurchRequest } from "@shared/api";

type ChurchFormState = {
  name: string; size: ChurchSize; status: ChurchStatus; adminName: string; adminEmail: string;
  email: string; phone: string; address: string; website: string; billingPlanKey: SubscriptionPlanKey;
  billingStatus: SubscriptionStatus; billingAmount: string; billingEmail: string; renewalDate: string;
  trialEndsAt: string; customerCode: string; subscriptionCode: string; planCode: string; lastPaymentReference: string;
};

type PaymentFormState = {
  amount: string; paidAt: string; method: SubscriptionPaymentMethod; reference: string; notes: string;
};

const fallbackBillingPlans: AdminBillingPlan[] = BILLING_PLANS.map((plan) => ({ ...plan, paystackPlanCode: undefined, isConfigured: false }));
const manualPaymentMethods: Array<{ value: SubscriptionPaymentMethod; label: string }> = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "cash", label: "Cash" },
  { value: "manual", label: "Manual adjustment" },
];
const workspaceStatusStyles = { active: "bg-green-100 text-green-700", inactive: "bg-slate-100 text-slate-700", suspended: "bg-red-100 text-red-700" } as const;
const billingStatusStyles = { active: "bg-emerald-100 text-emerald-700", trialing: "bg-blue-100 text-blue-700", past_due: "bg-amber-100 text-amber-700", canceled: "bg-rose-100 text-rose-700", suspended: "bg-red-100 text-red-700" } as const;
const emptyFormState: ChurchFormState = { name: "", size: "small", status: "active", adminName: "", adminEmail: "", email: "", phone: "", address: "", website: "", billingPlanKey: "starter", billingStatus: "trialing", billingAmount: "", billingEmail: "", renewalDate: "", trialEndsAt: "", customerCode: "", subscriptionCode: "", planCode: "", lastPaymentReference: "" };

function toInputDate(value?: string) { return !value ? "" : value.includes("T") ? value.split("T")[0] : value; }
function formatDate(value?: string) { return value ? new Date(value).toLocaleDateString() : "Pending"; }
function formatDateTime(value?: string) { return value ? new Date(value).toLocaleString() : "Pending"; }
function getFutureInputDate(days: number) { const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + days); return nextDate.toISOString().split("T")[0]; }
function createPaymentFormState(amount?: number): PaymentFormState { return { amount: amount ? String(amount) : "", paidAt: getFutureInputDate(0), method: "bank_transfer", reference: "", notes: "" }; }
function formatPaymentMethod(value: SubscriptionPaymentMethod) { return value === "bank_transfer" ? "Bank transfer" : value === "mobile_money" ? "Mobile money" : value === "cash" ? "Cash" : value === "manual" ? "Manual adjustment" : "Paystack"; }
function formatPaymentSource(value: ChurchSubscriptionPaymentRecord["source"]) { return value === "manual" ? "Manual" : value === "paystack_verify" ? "Paystack verify" : "Paystack webhook"; }

function toFormState(church: Church): ChurchFormState {
  return {
    name: church.name, size: church.size, status: church.status ?? "active", adminName: church.adminName ?? "", adminEmail: church.adminEmail ?? "", email: church.email ?? "", phone: church.phone ?? "", address: church.address ?? "", website: church.website ?? "",
    billingPlanKey: church.billing.planKey, billingStatus: church.billing.status, billingAmount: String(church.billing.amount ?? ""), billingEmail: church.billing.billingEmail ?? "", renewalDate: toInputDate(church.billing.renewalDate), trialEndsAt: toInputDate(church.billing.trialEndsAt), customerCode: church.billing.customerCode ?? "", subscriptionCode: church.billing.subscriptionCode ?? "", planCode: church.billing.planCode ?? "", lastPaymentReference: church.billing.lastPaymentReference ?? "",
  };
}

function toPayload(formData: ChurchFormState): UpdateChurchRequest {
  const amount = Number(formData.billingAmount);
  return {
    name: formData.name, size: formData.size, status: formData.status, adminName: formData.adminName, adminEmail: formData.adminEmail, email: formData.email, phone: formData.phone, address: formData.address, website: formData.website,
    billing: { planKey: formData.billingPlanKey, status: formData.billingStatus, amount: Number.isFinite(amount) && amount > 0 ? amount : undefined, billingEmail: formData.billingEmail || undefined, renewalDate: formData.renewalDate || undefined, trialEndsAt: formData.trialEndsAt || undefined, customerCode: formData.customerCode || undefined, subscriptionCode: formData.subscriptionCode || undefined, planCode: formData.planCode || undefined, lastPaymentReference: formData.lastPaymentReference || undefined },
  };
}

export default function AdminChurchDetails() {
  const { churchId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [church, setChurch] = useState<Church | null>(null);
  const [billingPlans, setBillingPlans] = useState<AdminBillingPlan[]>(fallbackBillingPlans);
  const [paymentRecords, setPaymentRecords] = useState<ChurchSubscriptionPaymentRecord[]>([]);
  const [formData, setFormData] = useState<ChurchFormState>(emptyFormState);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(createPaymentFormState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isApplyingAccessAction, setIsApplyingAccessAction] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selectedPlan = useMemo(() => billingPlans.find((plan) => plan.key === formData.billingPlanKey), [billingPlans, formData.billingPlanKey]);

  const applyChurch = (nextChurch: Church) => { setChurch(nextChurch); setFormData(toFormState(nextChurch)); };
  const setField = (field: keyof ChurchFormState, value: string) => { setFormData((current) => ({ ...current, [field]: value })); if (error) setError(""); if (success) setSuccess(""); };

  const loadChurch = async () => {
    if (!token || !churchId) return;
    setIsLoading(true); setError("");
    try {
      const [churchRes, plansRes, paymentsRes] = await Promise.all([
        fetch(`/api/admin/churches/${churchId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/billing/plans", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/churches/${churchId}/subscription-payments`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const churchPayload = await churchRes.json();
      if (!churchRes.ok) throw new Error(churchPayload.error || "Failed to load church");
      applyChurch(churchPayload.data);
      setPaymentForm(createPaymentFormState(churchPayload.data.billing.amount));
      if (plansRes.ok) { const plansPayload = await plansRes.json(); setBillingPlans(plansPayload.data || fallbackBillingPlans); }
      if (paymentsRes.ok) { const paymentsPayload = await paymentsRes.json(); setPaymentRecords(paymentsPayload.data || []); }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load church");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!churchId) { navigate("/admin/churches", { replace: true }); return; }
    void loadChurch();
  }, [churchId, token]);

  const handleSave = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!token || !churchId) return;
    setIsSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/churches/${churchId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(toPayload(formData)) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update church");
      applyChurch(payload.data);
      setSuccess("Church and subscription updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update church");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLaunchCheckout = async () => {
    if (!token || !churchId) return;
    setIsStartingCheckout(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/churches/${churchId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planKey: formData.billingPlanKey, billingEmail: formData.billingEmail || formData.adminEmail || formData.email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to launch checkout");
      setField("lastPaymentReference", payload.data.reference);
      setSuccess("Paystack checkout opened in a new tab.");
      window.open(payload.data.authorizationUrl, "_blank", "noopener,noreferrer");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to launch checkout");
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const handleApplyAccessAction = async (updater: (current: ChurchFormState) => ChurchFormState, successMessage: string) => {
    if (!token || !churchId) return;
    setIsApplyingAccessAction(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/churches/${churchId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(toPayload(updater(formData))) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update church");
      applyChurch(payload.data);
      setSuccess(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update church");
    } finally {
      setIsApplyingAccessAction(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!token || !churchId || !formData.lastPaymentReference) return;
    setIsVerifyingPayment(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/churches/${churchId}/billing/verify`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ reference: formData.lastPaymentReference }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to verify payment");
      applyChurch(payload.data);
      await loadChurch();
      setSuccess("Paystack payment verified and payment history refreshed.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to verify payment");
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !churchId) return;
    setIsRecordingPayment(true); setError(""); setSuccess("");
    try {
      const request: CreateChurchSubscriptionPaymentRecordRequest = {
        amount: paymentForm.amount ? Number(paymentForm.amount) : undefined,
        paidAt: paymentForm.paidAt,
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      };
      const response = await fetch(`/api/admin/churches/${churchId}/subscription-payments`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(request) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to record subscription payment");
      applyChurch(payload.data.church);
      setPaymentRecords(payload.data.records || []);
      setPaymentForm(createPaymentFormState(payload.data.church.billing.amount));
      setSuccess("Subscription payment recorded and church access refreshed.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to record subscription payment");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !churchId || !church) return;
    if (!window.confirm(`Delete ${church.name}? This removes its workspace data.`)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/churches/${churchId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to delete church");
      navigate("/admin/churches");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete church");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminShell
      title={church?.name ?? "Church management"}
      description="Manage workspace details, subscription access, Paystack billing, and church payment records from one admin view."
      icon={Building2}
      actions={
        <>
          <Link to="/admin/churches"><Button variant="outline" className="h-11 rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
          <Button onClick={() => void handleSave()} disabled={isLoading || isSaving} className="h-11 rounded-2xl bg-white text-slate-950 hover:bg-slate-100">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
        </>
      }
    >
      {error ? <div className="rounded-[28px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-[28px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}
      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
      ) : church ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_340px]">
            <form onSubmit={(event) => void handleSave(event)} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Workspace</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Church profile</h2></div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${workspaceStatusStyles[formData.status]}`}>{formData.status}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${billingStatusStyles[formData.billingStatus]}`}>{formData.billingStatus.replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <div className="space-y-2"><Label>Church name</Label><Input value={formData.name} onChange={(event) => setField("name", event.target.value)} className="h-11 rounded-2xl" /></div>
                <div className="space-y-2"><Label>Church size</Label><Select value={formData.size} onValueChange={(value: ChurchSize) => setField("size", value)}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Workspace status</Label><Select value={formData.status} onValueChange={(value: ChurchStatus) => setField("status", value)}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Church email</Label><Input type="email" value={formData.email} onChange={(event) => setField("email", event.target.value)} className="h-11 rounded-2xl" /></div>
                <div className="space-y-2"><Label>Admin name</Label><Input value={formData.adminName} onChange={(event) => setField("adminName", event.target.value)} className="h-11 rounded-2xl" /></div>
                <div className="space-y-2"><Label>Admin email</Label><Input type="email" value={formData.adminEmail} onChange={(event) => setField("adminEmail", event.target.value)} className="h-11 rounded-2xl" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={formData.phone} onChange={(event) => setField("phone", event.target.value)} className="h-11 rounded-2xl" /></div>
                <div className="space-y-2"><Label>Website</Label><Input value={formData.website} onChange={(event) => setField("website", event.target.value)} className="h-11 rounded-2xl" /></div>
              </div>
              <div className="mt-5 space-y-2"><Label>Address</Label><Textarea value={formData.address} onChange={(event) => setField("address", event.target.value)} className="min-h-[110px] rounded-2xl" /></div>
              <div className="mt-10 border-t border-slate-200 pt-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Paystack billing</p>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div className="space-y-2"><Label>Plan</Label><Select value={formData.billingPlanKey} onValueChange={(value: SubscriptionPlanKey) => setField("billingPlanKey", value)}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent>{billingPlans.map((plan) => <SelectItem key={plan.key} value={plan.key}>{plan.name} - {formatSubscriptionAmount(plan.amount)}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Billing status</Label><Select value={formData.billingStatus} onValueChange={(value: SubscriptionStatus) => setField("billingStatus", value)}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trialing">Trialing</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="past_due">Past due</SelectItem><SelectItem value="canceled">Canceled</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Amount (USD)</Label><Input type="number" min="0" value={formData.billingAmount} onChange={(event) => setField("billingAmount", event.target.value)} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Billing email</Label><Input type="email" value={formData.billingEmail} onChange={(event) => setField("billingEmail", event.target.value)} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Renewal date</Label><Input type="date" value={formData.renewalDate} onChange={(event) => setField("renewalDate", event.target.value)} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Trial ends</Label><Input type="date" value={formData.trialEndsAt} onChange={(event) => setField("trialEndsAt", event.target.value)} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Customer code</Label><Input value={formData.customerCode} onChange={(event) => setField("customerCode", event.target.value)} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Subscription code</Label><Input value={formData.subscriptionCode} onChange={(event) => setField("subscriptionCode", event.target.value)} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Plan code</Label><Input value={formData.planCode} onChange={(event) => setField("planCode", event.target.value)} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Last payment reference</Label><Input value={formData.lastPaymentReference} onChange={(event) => setField("lastPaymentReference", event.target.value)} className="h-11 rounded-2xl" /></div>
                </div>
                {!selectedPlan?.isConfigured ? <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Configure the matching `PAYSTACK_*_PLAN_CODE` before launching checkout.</div> : null}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button type="submit" disabled={isSaving} className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-800">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save changes</Button>
                  <Button type="button" variant="outline" onClick={() => void handleLaunchCheckout()} disabled={isStartingCheckout || !selectedPlan?.isConfigured} className="h-11 rounded-2xl">{isStartingCheckout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}Launch checkout</Button>
                  <Button type="button" variant="outline" onClick={() => void handleVerifyPayment()} disabled={isVerifyingPayment || !formData.lastPaymentReference} className="h-11 rounded-2xl">{isVerifyingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}Verify payment</Button>
                </div>
                <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Access controls</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Church users are redirected to the subscription page whenever billing becomes past due. Use these actions to grant free access, restore premium access, or lock the workspace until payment is made.</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => void handleApplyAccessAction((current) => ({ ...current, billingStatus: "trialing", trialEndsAt: getFutureInputDate(30) }), "A new 30-day free access window has been granted.")} disabled={isApplyingAccessAction} className="h-11 rounded-2xl">{isApplyingAccessAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Grant free access</Button>
                    <Button type="button" variant="outline" onClick={() => void handleApplyAccessAction((current) => ({ ...current, billingStatus: "active", renewalDate: getFutureInputDate(30) }), "Premium access has been restored for the next billing cycle.")} disabled={isApplyingAccessAction} className="h-11 rounded-2xl">{isApplyingAccessAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Restore premium access</Button>
                    <Button type="button" variant="outline" onClick={() => void handleApplyAccessAction((current) => ({ ...current, billingStatus: "past_due", renewalDate: getFutureInputDate(0) }), "The workspace is now locked until payment is completed.")} disabled={isApplyingAccessAction} className="h-11 rounded-2xl border-amber-300 text-amber-700 hover:bg-amber-50">{isApplyingAccessAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Lock until payment</Button>
                  </div>
                </div>
              </div>
            </form>
            <div className="space-y-6">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Summary</p>
                <div className="mt-6 space-y-4 text-sm">
                  <div className="flex items-center justify-between"><span className="text-slate-500">Created</span><span className="font-medium text-slate-900">{formatDate(church.createdAt)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Members</span><span className="font-medium text-slate-900">{church.totalMembers}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Plan</span><span className="font-medium text-slate-900">{church.billing.planName}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Plan amount</span><span className="font-medium text-slate-900">{formatSubscriptionAmount(church.billing.amount)}/month</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Billing status</span><span className="font-medium text-slate-900 capitalize">{church.billing.status.replace(/_/g, " ")}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Next billing</span><span className="font-medium text-slate-900">{formatDate(church.billing.renewalDate ?? church.billing.trialEndsAt)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Last payment</span><span className="font-medium text-slate-900">{formatDate(church.billing.lastPaymentAt)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Recorded payments</span><span className="font-medium text-slate-900">{paymentRecords.length}</span></div>
                </div>
              </div>
              <div className="rounded-[32px] border border-red-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">Danger zone</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Delete church</h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">This permanently removes the workspace and its related records.</p>
                <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting} className="mt-6 h-11 rounded-2xl">{isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete church</Button>
              </div>
            </div>
          </div>
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"><CreditCard className="h-3.5 w-3.5" />Subscription payments</div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">Record and review payments</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Keep a manual record of subscription payments made by the church and retain Paystack verification history in the same ledger.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{paymentRecords.length} payment record{paymentRecords.length === 1 ? "" : "s"}</div>
            </div>
            <form onSubmit={handleRecordPayment} className="mt-8 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Amount (USD)</Label><Input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Paid on</Label><Input type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm((current) => ({ ...current, paidAt: event.target.value }))} className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Method</Label><Select value={paymentForm.method} onValueChange={(value: SubscriptionPaymentMethod) => setPaymentForm((current) => ({ ...current, method: value }))}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent>{manualPaymentMethods.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Reference</Label><Input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Receipt number or transfer reference" className="h-11 rounded-2xl" /></div>
                  <div className="space-y-2"><Label>Notes</Label><Textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional notes about the payment" className="min-h-[120px] rounded-2xl" /></div>
                </div>
                <Button type="submit" disabled={isRecordingPayment} className="mt-5 h-11 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">{isRecordingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Record payment</Button>
              </div>
              <div className="overflow-x-auto rounded-[28px] border border-slate-200">
                {paymentRecords.length === 0 ? (
                  <div className="px-6 py-16 text-center text-slate-500">No subscription payments have been recorded for this church yet.</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50"><tr><th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Paid on</th><th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Method</th><th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source</th><th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Coverage</th><th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Amount</th><th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reference</th><th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recorded by</th></tr></thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {paymentRecords.map((record) => (
                        <tr key={record.id} className="align-top hover:bg-slate-50/80">
                          <td className="px-6 py-5 text-sm text-slate-600"><div className="flex flex-col"><span className="font-medium text-slate-950">{formatDate(record.paidAt)}</span><span className="text-xs text-slate-400">{formatDateTime(record.recordedAt)}</span></div></td>
                          <td className="px-6 py-5 text-sm text-slate-600">{formatPaymentMethod(record.method)}</td>
                          <td className="px-6 py-5 text-sm"><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">{formatPaymentSource(record.source)}</span></td>
                          <td className="px-6 py-5 text-sm text-slate-600"><div className="flex flex-col"><span>{formatDate(record.periodStart)}</span><span className="text-xs text-slate-400">to {formatDate(record.periodEnd)}</span></div></td>
                          <td className="px-6 py-5 text-right text-sm font-semibold text-slate-950">{formatAdminCurrency(record.amount)}</td>
                          <td className="px-6 py-5 text-sm text-slate-600"><div className="flex max-w-[220px] flex-col"><span className="truncate font-medium text-slate-950">{record.reference || "No reference"}</span><span className="truncate text-xs text-slate-400">{record.notes || "No notes"}</span></div></td>
                          <td className="px-6 py-5 text-sm text-slate-600"><div className="flex flex-col"><span className="font-medium text-slate-950">{record.recordedByName || record.recordedByUserId}</span><span className="text-xs text-slate-400">{record.recordedByUserId}</span></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </form>
          </section>
        </div>
      ) : (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center text-slate-500">This church could not be found.</div>
      )}
    </AdminShell>
  );
}
