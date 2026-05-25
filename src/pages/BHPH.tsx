import { useEffect, useMemo, useState } from "react";
import {
  Plus, DollarSign, Calendar, CheckCircle, AlertCircle, X, Loader2, Wallet, Receipt,
} from "lucide-react";
import { useCreateLoan, useLoan, useLoans, useRecordPayment } from "@/hooks/api/use-loans";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { ApiError } from "@/lib/api";
import { ClientLoanStatus, Loan, rollupPortfolio } from "@/lib/loan-mapper";
import { toast } from "@/hooks/use-toast";

const statusColors: Record<ClientLoanStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Completed: "bg-blue-100 text-blue-700",
  Overdue: "bg-red-100 text-red-700",
  Defaulted: "bg-gray-200 text-gray-800",
};

const PAYMENT_METHODS: { value: "cash" | "bank_transfer" | "cheque"; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

function formatMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export default function BHPH() {
  const [showCreate, setShowCreate] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ClientLoanStatus | "All">("All");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const loansQuery = useLoans({ status: statusFilter });
  const createLoan = useCreateLoan();
  const detailQuery = useLoan(selectedLoanId ?? undefined);
  const recordPayment = useRecordPayment(selectedLoanId ?? "");
  const vehiclesQuery = useVehicles({ limit: 100 });

  const loans = loansQuery.data?.data ?? [];
  const portfolio = useMemo(() => rollupPortfolio(loans), [loans]);

  useEffect(() => {
    if (selectedLoanId && loans.some((l) => l.id === selectedLoanId)) return;
    if (loans.length > 0) setSelectedLoanId(loans[0].id);
    else setSelectedLoanId(null);
  }, [loans, selectedLoanId]);

  // Create-loan form
  const [createForm, setCreateForm] = useState({
    borrowerName: "", borrowerEmail: "", borrowerPhone: "",
    vehicleId: "",
    principal: "", interestRatePercent: "10", termMonths: "24",
    startDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const resetCreateForm = () => setCreateForm({
    borrowerName: "", borrowerEmail: "", borrowerPhone: "",
    vehicleId: "", principal: "", interestRatePercent: "10", termMonths: "24",
    startDate: new Date().toISOString().slice(0, 10), notes: "",
  });

  const handleCreate = async () => {
    const vehicle = vehiclesQuery.data?.data.find((v) => v.id === createForm.vehicleId);
    if (!vehicle) { toast({ title: "Pick a vehicle", variant: "destructive" }); return; }
    if (!createForm.borrowerName || !createForm.borrowerEmail || !createForm.borrowerPhone || !createForm.principal) {
      toast({ title: "Missing info", description: "Borrower contact + principal are required.", variant: "destructive" });
      return;
    }
    try {
      const loan = await createLoan.mutateAsync({
        borrowerName: createForm.borrowerName,
        borrowerEmail: createForm.borrowerEmail,
        borrowerPhone: createForm.borrowerPhone,
        vehicleId: vehicle.id,
        vehicleTitle: vehicle.title,
        principal: parseFloat(createForm.principal),
        interestRatePercent: parseFloat(createForm.interestRatePercent),
        termMonths: parseInt(createForm.termMonths, 10),
        startDate: createForm.startDate,
        notes: createForm.notes || undefined,
      });
      toast({ title: "Loan created", description: `EMI $${loan.emiAmount.toFixed(2)}/mo` });
      setSelectedLoanId(loan.id);
      resetCreateForm();
      setShowCreate(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create loan";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  // Payment form
  const [payForm, setPayForm] = useState({
    amount: "", method: "cash" as "cash" | "bank_transfer" | "cheque", receiptNumber: "", notes: "",
  });

  const detail = detailQuery.data;

  // Pre-fill payment amount with EMI on detail change
  useEffect(() => {
    if (detail) setPayForm((f) => ({ ...f, amount: f.amount || String(detail.loan.emiAmount.toFixed(2)) }));
  }, [detail?.loan.id]);

  const handlePay = async () => {
    if (!selectedLoanId || !payForm.amount) {
      toast({ title: "Enter amount", variant: "destructive" });
      return;
    }
    try {
      const updated = await recordPayment.mutateAsync({
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        receiptNumber: payForm.receiptNumber || undefined,
        notes: payForm.notes || undefined,
      });
      toast({ title: "Payment recorded", description: `$${parseFloat(payForm.amount).toFixed(2)} · ${updated.status}` });
      setPayForm({ amount: "", method: "cash", receiptNumber: "", notes: "" });
      setShowPay(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not record";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Buy Here Pay Here</h1>
          <p className="text-muted-foreground text-sm">Dealer financing management</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Cancel" : "Create Loan"}
        </button>
      </div>

      {showCreate && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Loan</h3>
          <p className="text-xs text-muted-foreground -mt-2">EMI is auto-calculated from principal, interest rate, and term.</p>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={createForm.borrowerName} onChange={(e) => setCreateForm({ ...createForm, borrowerName: e.target.value })} placeholder="Borrower name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={createForm.borrowerEmail} onChange={(e) => setCreateForm({ ...createForm, borrowerEmail: e.target.value })} placeholder="Email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={createForm.borrowerPhone} onChange={(e) => setCreateForm({ ...createForm, borrowerPhone: e.target.value })} placeholder="Phone *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={createForm.vehicleId} onChange={(e) => setCreateForm({ ...createForm, vehicleId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-3">
              <option value="">Pick a vehicle *…</option>
              {(vehiclesQuery.data?.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.title} — ${v.price.toLocaleString()}</option>)}
            </select>
            <input value={createForm.principal} onChange={(e) => setCreateForm({ ...createForm, principal: e.target.value })} placeholder="Principal ($) *" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={createForm.interestRatePercent} onChange={(e) => setCreateForm({ ...createForm, interestRatePercent: e.target.value })} placeholder="Interest rate (%)" type="number" step="0.1" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={createForm.termMonths} onChange={(e) => setCreateForm({ ...createForm, termMonths: e.target.value })} placeholder="Term (months)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="date" value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Notes (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); resetCreateForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={createLoan.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
              {createLoan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Loan
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} color="bg-primary/10 text-primary" value={formatMoney(portfolio.totalFinanced)} label="Total Financed" />
        <KpiCard icon={CheckCircle} color="bg-emerald-50 text-emerald-600" value={formatMoney(portfolio.totalCollected)} label="Total Collected" />
        <KpiCard icon={Calendar} color="bg-amber-50 text-amber-600" value={formatMoney(portfolio.outstanding)} label="Outstanding" />
        <KpiCard icon={AlertCircle} color="bg-red-50 text-red-600" value={String(portfolio.overdueCount)} label="Overdue Loans" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["All", "Active", "Overdue", "Completed", "Defaulted"] as (ClientLoanStatus | "All")[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 stat-card overflow-x-auto">
          <h3 className="font-display font-semibold mb-4">Loans</h3>
          {loansQuery.isLoading && (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!loansQuery.isLoading && loans.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No loans match your filter. Click "Create Loan" to add one.</p>
          )}
          {loans.length > 0 && (
            <table className="data-table">
              <thead><tr><th>ID</th><th>Borrower</th><th>Vehicle</th><th>EMI</th><th>Progress</th><th>Status</th></tr></thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className={`cursor-pointer ${selectedLoanId === l.id ? "bg-primary/5" : ""}`} onClick={() => setSelectedLoanId(l.id)}>
                    <td className="font-mono text-xs">{l.id.slice(-6)}</td>
                    <td className="font-medium text-sm">{l.borrowerName}</td>
                    <td className="text-sm">{l.vehicleTitle}</td>
                    <td className="text-sm font-medium">${l.emiAmount.toFixed(0)}/mo</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(l.installmentsCompleted / l.termMonths) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{l.installmentsCompleted}/{l.termMonths}</span>
                      </div>
                    </td>
                    <td><span className={`status-badge ${statusColors[l.status]}`}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="stat-card">
          {!selectedLoanId && (
            <div className="text-center text-muted-foreground py-12 text-sm">Select a loan</div>
          )}
          {selectedLoanId && detailQuery.isLoading && (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-12 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {detail && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display font-semibold">{detail.loan.borrowerName}</h3>
                <p className="text-xs text-muted-foreground font-mono">{detail.loan.id.slice(-8)}</p>
              </div>
              <div className="space-y-1 text-sm">
                <Row label="Vehicle" value={detail.loan.vehicleTitle} />
                <Row label="Principal" value={`$${detail.loan.principal.toLocaleString()}`} />
                <Row label="Interest" value={`${detail.loan.interestRatePercent}% / yr`} />
                <Row label="Term" value={`${detail.loan.termMonths} mo`} />
                <Row label="EMI" value={`$${detail.loan.emiAmount.toFixed(2)}`} />
                <Row label="Paid" value={`$${detail.loan.totalPaid.toLocaleString()}`} />
                <Row label="Remaining" value={`$${detail.loan.remaining.toLocaleString()}`} />
                {detail.loan.nextDueDate && <Row label="Next Due" value={detail.loan.nextDueDate} />}
              </div>

              <button
                onClick={() => setShowPay(!showPay)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                {showPay ? <X className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {showPay ? "Cancel" : "Record Payment"}
              </button>

              {showPay && (
                <div className="space-y-2 border-t pt-3">
                  <input value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Amount ($)" type="number" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as typeof payForm.method })} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input value={payForm.receiptNumber} onChange={(e) => setPayForm({ ...payForm, receiptNumber: e.target.value })} placeholder="Receipt # (optional)" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  <input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Notes (optional)" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  <button
                    onClick={handlePay}
                    disabled={recordPayment.isPending}
                    className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {recordPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                    Save Payment
                  </button>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">EMI SCHEDULE</p>
                <div className="grid grid-cols-6 gap-1">
                  {detail.schedule.map((row) => (
                    <div
                      key={row.installmentNo}
                      title={`Due ${row.dueDate} · $${row.emiAmount.toFixed(2)}`}
                      className={`h-6 w-full rounded text-[10px] flex items-center justify-center font-medium ${row.paid ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {row.installmentNo}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Hover a box to see the due date + EMI amount.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Payment History — {detail.loan.borrowerName}</h3>
          {detail.loan.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payments yet for this loan.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt</th><th>Notes</th></tr></thead>
              <tbody>
                {[...detail.loan.payments].reverse().map((p, i) => (
                  <tr key={i}>
                    <td className="text-xs text-muted-foreground">{p.date}</td>
                    <td className="font-medium text-sm">${p.amount.toFixed(2)}</td>
                    <td className="text-sm text-muted-foreground">{p.method.replace("_", " ")}</td>
                    <td className="font-mono text-xs">{p.receiptNumber ?? "—"}</td>
                    <td className="text-xs text-muted-foreground">{p.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, color, value, label }: { icon: typeof Wallet; color: string; value: string; label: string }) {
  return (
    <div className="stat-card">
      <div className={`p-2 rounded-lg w-fit mb-2 ${color}`}><Icon className="h-4 w-4" /></div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}
