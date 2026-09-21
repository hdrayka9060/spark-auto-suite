import { useEffect, useMemo, useState } from "react";
import {
  Plus, DollarSign, Calendar, CheckCircle, AlertCircle, X, Loader2, Wallet, Receipt,
  Pencil, Ban, Archive, Trash2, CheckSquare, TrendingUp, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  useArchiveLoan, useBulkMarkPaid, useCreateLoan, useDeletePayment, useLoan, useLoans,
  useRecordPayment, useUnpayInstallment, useUpdateLoan, useUpdatePayment,
} from "@/hooks/api/use-loans";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { useLeads } from "@/hooks/api/use-leads";
import { useBuyers } from "@/hooks/api/use-buyers";
import { useReceivables, useRecordReceivablePayment } from "@/hooks/api/use-accounting";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CloseLoanDialog } from "@/components/CloseLoanDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError } from "@/lib/api";
import { AmortizationRow, ClientLoanStatus, InstallmentState, Loan, rollupPortfolio } from "@/lib/loan-mapper";
import { computeMissing, EmiField } from "@/lib/emi-solver";
import { toast } from "@/hooks/use-toast";

/** Per-installment colour states for the schedule grid + legend. */
const STATE_STYLE: Record<InstallmentState, { box: string; label: string; dot: string }> = {
  paid: { box: "bg-emerald-500 text-white", label: "Paid", dot: "bg-emerald-500" },
  overpaid: { box: "bg-indigo-500 text-white", label: "Overpaid", dot: "bg-indigo-500" },
  partial: { box: "bg-amber-400 text-amber-950", label: "Partial", dot: "bg-amber-400" },
  overdue: { box: "bg-red-500 text-white", label: "Overdue", dot: "bg-red-500" },
  upcoming: { box: "bg-muted text-muted-foreground", label: "Upcoming", dot: "bg-muted-foreground/40" },
};

const statusColors: Record<ClientLoanStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Completed: "bg-blue-100 text-blue-700",
  Overdue: "bg-red-100 text-red-700",
  Defaulted: "bg-gray-200 text-gray-800",
  Closed: "bg-slate-200 text-slate-700",
  Archived: "bg-zinc-200 text-zinc-500",
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

  const [showEdit, setShowEdit] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const confirm = useConfirm();
  // Schedule grid: bulk-select mode + which installment modal is open.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modalInst, setModalInst] = useState<number | null>(null);
  const [histPage, setHistPage] = useState(1);
  const [loanPage, setLoanPage] = useState(1);
  const loansQuery = useLoans({ status: statusFilter });
  const detailQuery = useLoan(selectedLoanId ?? undefined);
  const recordPayment = useRecordPayment(selectedLoanId ?? "");
  const archiveLoan = useArchiveLoan(selectedLoanId ?? "");
  const bulkPay = useBulkMarkPaid(selectedLoanId ?? "");
  const HIST_PER_PAGE = 8;
  const LOANS_PER_PAGE = 10;

  const loans = loansQuery.data?.data ?? [];
  const portfolio = useMemo(() => rollupPortfolio(loans), [loans]);

  useEffect(() => {
    if (selectedLoanId && loans.some((l) => l.id === selectedLoanId)) return;
    if (loans.length > 0) setSelectedLoanId(loans[0].id);
    else setSelectedLoanId(null);
  }, [loans, selectedLoanId]);

  // Payment form
  const [payForm, setPayForm] = useState({
    amount: "", method: "cash" as "cash" | "bank_transfer" | "cheque", receiptNumber: "", notes: "",
  });

  const detail = detailQuery.data;

  // Pre-fill payment amount with EMI on detail change
  useEffect(() => {
    if (detail) setPayForm((f) => ({ ...f, amount: f.amount || String(detail.loan.emiAmount.toFixed(2)) }));
  }, [detail?.loan.id]);

  // Close opens the app dialog (payoff / defaulted); no browser confirm.
  const handleArchive = async () => {
    if (!selectedLoanId) return;
    const ok = await confirm({
      title: "Archive this loan?",
      description: "This UN-SELLS the car and removes the sale + interest from all financials. This cannot be undone.",
      confirmText: "Archive",
      destructive: true,
    });
    if (!ok) return;
    try {
      await archiveLoan.mutateAsync();
      toast({ title: "Loan archived", description: "Car un-sold; financials reversed." });
      setSelectedLoanId(null);
    } catch (err) {
      toast({ title: "Could not archive", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    }
  };

  // Reset per-loan grid/history UI when switching loans.
  useEffect(() => {
    setSelectMode(false); setSelected(new Set()); setModalInst(null); setHistPage(1);
  }, [selectedLoanId]);
  useEffect(() => { setLoanPage(1); }, [statusFilter]);

  const toggleSelect = (no: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(no)) n.delete(no); else n.add(no);
      return n;
    });

  const handleBulkPay = async () => {
    if (!selected.size) return;
    try {
      await bulkPay.mutateAsync({ installmentNos: [...selected] });
      toast({ title: `Marked ${selected.size} installment(s) paid` });
      setSelected(new Set());
      setSelectMode(false);
    } catch (err) {
      toast({ title: "Bulk pay failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    }
  };

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
        <CreateLoanForm
          onCreated={(loan) => { setSelectedLoanId(loan.id); setShowCreate(false); }}
          onCancel={() => setShowCreate(false)}
        />
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
            <>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Borrower</th><th>Vehicle</th><th>EMI</th><th>Progress</th><th>Status</th></tr></thead>
                <tbody>
                  {loans.slice((loanPage - 1) * LOANS_PER_PAGE, loanPage * LOANS_PER_PAGE).map((l) => (
                    <tr key={l.id} className={`cursor-pointer ${selectedLoanId === l.id ? "bg-primary/5" : ""}`} onClick={() => setSelectedLoanId(l.id)}>
                      <td className="font-mono text-xs">{l.id.slice(-6)}</td>
                      <td className="font-medium text-sm">{l.borrowerName}</td>
                      <td className="text-sm">{l.vehicleTitle}</td>
                      <td className="text-sm font-medium">${l.emiAmount.toFixed(0)}/mo</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, (l.installmentsCompleted / l.termMonths) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{l.installmentsCompleted}/{l.termMonths}</span>
                        </div>
                      </td>
                      <td><span className={`status-badge ${statusColors[l.status]}`}>{l.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pager page={loanPage} total={loans.length} perPage={LOANS_PER_PAGE} onPage={setLoanPage} />
            </>
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
                {detail.summary && (
                  <Row
                    label="Interest earned"
                    value={`$${detail.summary.interestCollected.toLocaleString()} / $${detail.summary.totalInterest.toLocaleString()}`}
                  />
                )}
                {(detail.summary?.nextDueAt || detail.loan.nextDueDate) && (
                  <Row label="Next Due" value={(detail.summary?.nextDueAt ?? detail.loan.nextDueDate ?? "").slice(0, 10)} />
                )}
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

              {/* Loan lifecycle actions */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setShowEdit((s) => !s)} className="flex items-center justify-center gap-1 px-2 py-2 text-xs border rounded-lg hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5" />{showEdit ? "Cancel" : "Edit"}
                </button>
                <button onClick={() => setShowClose(true)} disabled={detail.loan.rawStatus === "closed" || detail.loan.rawStatus === "paid_off" || detail.loan.rawStatus === "archived"} className="flex items-center justify-center gap-1 px-2 py-2 text-xs border rounded-lg hover:bg-muted disabled:opacity-50">
                  <Ban className="h-3.5 w-3.5" />Close
                </button>
                <button onClick={handleArchive} disabled={archiveLoan.isPending} className="flex items-center justify-center gap-1 px-2 py-2 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
                  <Archive className="h-3.5 w-3.5" />Archive
                </button>
              </div>

              <CloseLoanDialog
                open={showClose}
                onOpenChange={setShowClose}
                loanId={detail.loan.id}
                borrowerName={detail.loan.borrowerName}
                vehicleTitle={detail.loan.vehicleTitle}
                outstandingPrincipal={detail.summary?.outstandingPrincipal ?? detail.summary?.outstanding ?? 0}
              />

              {showEdit && (
                <EditLoanForm loan={detail.loan} onDone={() => setShowEdit(false)} />
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">EMI SCHEDULE</p>
                  <div className="flex items-center gap-2">
                    {selectMode && selected.size > 0 && (
                      <button onClick={handleBulkPay} disabled={bulkPay.isPending} className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-60 flex items-center gap-1">
                        {bulkPay.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckSquare className="h-3 w-3" />}
                        Mark {selected.size} paid
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}
                      className={`text-[11px] px-2 py-1 rounded border ${selectMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {selectMode ? "Done" : "Select"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {detail.schedule.map((row) => {
                    const st = STATE_STYLE[row.state];
                    const isSel = selected.has(row.installmentNo);
                    return (
                      <button
                        key={row.installmentNo}
                        title={`#${row.installmentNo} · due ${row.dueDate} · $${row.emiAmount.toFixed(2)} · ${st.label}${row.paidAmount > 0 ? ` · paid $${row.paidAmount.toFixed(2)}` : ""}`}
                        onClick={() => (selectMode ? toggleSelect(row.installmentNo) : setModalInst(row.installmentNo))}
                        className={`h-7 w-full rounded text-[10px] flex items-center justify-center font-medium transition ${st.box} ${row.isLate && row.state === "partial" ? "ring-2 ring-red-500" : ""} ${isSel ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                      >
                        {row.installmentNo}
                      </button>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {(Object.keys(STATE_STYLE) as InstallmentState[]).map((s) => (
                    <span key={s} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className={`h-2.5 w-2.5 rounded-sm ${STATE_STYLE[s].dot}`} />{STATE_STYLE[s].label}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {selectMode ? "Tap installments to select, then Mark paid." : "Tap an installment to view / edit its payments."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {detail && selectedLoanId && (
        <PaymentHistory
          loanId={selectedLoanId}
          borrowerName={detail.loan.borrowerName}
          payments={detail.loan.payments}
          page={histPage}
          perPage={HIST_PER_PAGE}
          onPage={setHistPage}
          editable={detail.loan.rawStatus !== "archived"}
        />
      )}

      {detail && selectedLoanId && modalInst != null && (
        <InstallmentModal
          loanId={selectedLoanId}
          row={detail.schedule.find((r) => r.installmentNo === modalInst)}
          editable={detail.loan.rawStatus !== "archived"}
          onClose={() => setModalInst(null)}
        />
      )}

      <ReceivablesPanel />
    </div>
  );
}

/**
 * Partial / pending balances that aren't BHPH financing — the non-BHPH
 * receivables (cash/finance/trade-in sales left partly unpaid). Surfaced here so
 * every "money still owed" lives on one page. Record payments inline.
 */
function ReceivablesPanel() {
  const { data, isLoading } = useReceivables("open");
  const recordPay = useRecordReceivablePayment();
  const rows = data?.data ?? [];
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState("");

  const money = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString()}`;

  const submitPay = async (id: string) => {
    const amt = parseFloat(payAmt);
    if (!(amt > 0)) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    try {
      await recordPay.mutateAsync({ id, input: { amount: amt } });
      toast({ title: "Payment recorded" });
      setPayId(null); setPayAmt("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="stat-card">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-amber-600" />
        <h3 className="font-display font-semibold">Partial payments &amp; amounts owed</h3>
        <span className="text-xs text-muted-foreground">(non-BHPH balances)</span>
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No outstanding balances. 🎉</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Vehicle</th>
                <th className="py-2 pr-3">Buyer</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3 text-right">Total</th>
                <th className="py-2 pr-3 text-right">Collected</th>
                <th className="py-2 pr-3 text-right">Outstanding</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-middle">
                  <td className="py-2 pr-3">{r.vehicleTitle ?? "—"}</td>
                  <td className="py-2 pr-3">{r.buyerName ?? "—"}</td>
                  <td className="py-2 pr-3 capitalize">{(r.paymentMethod ?? "").replace("_", " ") || "—"}</td>
                  <td className="py-2 pr-3 text-right">{money(r.totalAmount)}</td>
                  <td className="py-2 pr-3 text-right">{money(r.collected)}</td>
                  <td className="py-2 pr-3 text-right font-medium text-amber-700 dark:text-amber-400">{money(r.outstanding)}</td>
                  <td className="py-2 pr-3 text-right">
                    {payId === r.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number" min={0} autoFocus value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                          placeholder={String(r.outstanding)}
                          className="w-24 rounded border bg-background px-2 py-1 text-xs"
                        />
                        <button onClick={() => submitPay(r.id)} disabled={recordPay.isPending} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-60">Save</button>
                        <button onClick={() => { setPayId(null); setPayAmt(""); }} className="rounded border px-2 py-1 text-xs">✕</button>
                      </span>
                    ) : (
                      <button onClick={() => { setPayId(r.id); setPayAmt(""); }} className="rounded border px-2 py-1 text-xs hover:bg-muted">Record payment</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function Pager({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
      <span>Page {page} of {pages} · {total} total</span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1 border rounded disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="p-1 border rounded disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

type ClientPayment = Loan["payments"][number];

function PaymentHistory({ loanId, borrowerName, payments, page, perPage, onPage, editable }: {
  loanId: string; borrowerName: string; payments: ClientPayment[]; page: number; perPage: number; onPage: (p: number) => void; editable: boolean;
}) {
  const del = useDeletePayment(loanId);
  const upd = useUpdatePayment(loanId);
  const confirm = useConfirm();
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmt, setEditAmt] = useState("");

  const rows = [...payments].reverse();
  const paged = rows.slice((page - 1) * perPage, page * perPage);

  const saveEdit = async (id: string) => {
    const a = parseFloat(editAmt);
    if (!(a > 0)) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    try { await upd.mutateAsync({ paymentId: id, patch: { amount: a } }); toast({ title: "Payment updated" }); setEditId(null); }
    catch (err) { toast({ title: "Update failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" }); }
  };
  const remove = async (id: string) => {
    const ok = await confirm({ title: "Delete this payment?", description: "This adjusts the loan balance + accounting.", confirmText: "Delete", destructive: true });
    if (!ok) return;
    try { await del.mutateAsync(id); toast({ title: "Payment deleted" }); }
    catch (err) { toast({ title: "Delete failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" }); }
  };

  return (
    <div className="stat-card">
      <h3 className="font-display font-semibold mb-4">Payment History — {borrowerName}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No payments yet for this loan.</p>
      ) : (
        <>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>For</th><th>Receipt</th><th>Notes</th>{editable && <th></th>}</tr></thead>
            <tbody>
              {paged.map((p, i) => (
                <tr key={p._id ?? i}>
                  <td className="text-xs text-muted-foreground">{p.date}</td>
                  <td className="font-medium text-sm">
                    {editId === p._id ? (
                      <input value={editAmt} onChange={(e) => setEditAmt(e.target.value)} type="number" className="w-20 border rounded px-1 py-0.5 text-sm bg-background" />
                    ) : `$${p.amount.toFixed(2)}`}
                  </td>
                  <td className="text-sm text-muted-foreground">{p.method.replace("_", " ")}</td>
                  <td className="text-xs text-muted-foreground">{p.installmentNo ? `#${p.installmentNo}` : "—"}</td>
                  <td className="font-mono text-xs">{p.receiptNumber ?? "—"}</td>
                  <td className="text-xs text-muted-foreground">{p.notes ?? ""}</td>
                  {editable && (
                    <td className="text-right whitespace-nowrap">
                      {p._id ? (
                        editId === p._id ? (
                          <>
                            <button onClick={() => saveEdit(p._id!)} className="text-xs text-emerald-600 mr-2">Save</button>
                            <button onClick={() => setEditId(null)} className="text-xs text-muted-foreground">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(p._id!); setEditAmt(String(p.amount)); }} className="text-muted-foreground hover:text-foreground mr-2" title="Edit"><Pencil className="h-3.5 w-3.5 inline" /></button>
                            <button onClick={() => remove(p._id!)} className="text-red-500 hover:text-red-600" title="Delete"><Trash2 className="h-3.5 w-3.5 inline" /></button>
                          </>
                        )
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={rows.length} perPage={perPage} onPage={onPage} />
        </>
      )}
    </div>
  );
}

function InstallmentModal({ loanId, row, editable, onClose }: {
  loanId: string; row?: AmortizationRow; editable: boolean; onClose: () => void;
}) {
  const rec = useRecordPayment(loanId);
  const del = useDeletePayment(loanId);
  const unpay = useUnpayInstallment(loanId);
  const confirm = useConfirm();
  const [amt, setAmt] = useState("");

  if (!row) return null;
  const st = STATE_STYLE[row.state];

  const pay = async (amount: number) => {
    if (!(amount > 0)) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    try { await rec.mutateAsync({ amount, method: "cash", installmentNo: row.installmentNo }); setAmt(""); toast({ title: "Payment recorded" }); }
    catch (err) { toast({ title: "Failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" }); }
  };
  const markUnpaid = async () => {
    const ok = await confirm({ title: `Mark installment #${row.installmentNo} unpaid?`, description: "This removes its payment(s) and adjusts the loan + accounting.", confirmText: "Mark unpaid", destructive: true });
    if (!ok) return;
    try { await unpay.mutateAsync(row.installmentNo); toast({ title: "Installment marked unpaid" }); onClose(); }
    catch (err) { toast({ title: "Failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" }); }
  };
  const removePayment = async (id: string) => {
    try { await del.mutateAsync(id); toast({ title: "Payment deleted" }); }
    catch (err) { toast({ title: "Failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" }); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Installment #{row.installmentNo}
            <span className={`text-[11px] px-2 py-0.5 rounded ${st.box}`}>{st.label}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Row label="Due date" value={row.dueDate} />
            <Row label="EMI due" value={`$${row.emiAmount.toFixed(2)}`} />
            <Row label="Paid" value={`$${row.paidAmount.toFixed(2)}`} />
            <Row label="Remaining" value={`$${row.remaining.toFixed(2)}`} />
          </div>

          <div className="border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Payments on this installment</p>
            {row.payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">None yet.</p>
            ) : (
              <div className="space-y-1">
                {row.payments.map((p) => (
                  <div key={p._id} className="flex items-center justify-between text-xs">
                    <span>{p.date} · ${p.amount.toFixed(2)} · {p.method.replace("_", " ")}</span>
                    {editable && <button onClick={() => removePayment(p._id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {editable && (
            <div className="border-t pt-3 space-y-2">
              {row.remaining > 0.005 && (
                <button onClick={() => pay(row.remaining)} disabled={rec.isPending} className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {rec.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
                  Pay remaining ${row.remaining.toFixed(2)}
                </button>
              )}
              <div className="flex gap-2">
                <input value={amt} onChange={(e) => setAmt(e.target.value)} type="number" placeholder="Custom amount" className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background" />
                <button onClick={() => pay(parseFloat(amt))} disabled={rec.isPending} className="px-3 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-60">Add</button>
              </div>
              {row.payments.length > 0 && (
                <button onClick={markUnpaid} disabled={unpay.isPending} className="w-full text-xs text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50 disabled:opacity-60">
                  Mark installment unpaid
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inputCls = "border rounded-lg px-3 py-2 text-sm bg-background w-full";
// Block "-"/"+"/"e" so money & EMI inputs can't go negative (paired with min={0}).
const blockNegKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") e.preventDefault();
};
// Strip any "-" so a value can never be negative regardless of how it arrived
// (typing, paste, spinner). The keydown guard covers live typing; this covers the rest.
const noNeg = (v: string) => v.replace(/-/g, "");
const num = (s: string) => (parseFloat(s) || 0);
const numU = (s: string): number | undefined => {
  const v = parseFloat(s);
  return s.trim() === "" || Number.isNaN(v) ? undefined : v;
};

/**
 * Create-loan form: pick a lead (auto-fills buyer + car) OR a car + buyer
 * (existing or new), a down payment, and any TWO of interest / term / EMI —
 * the third is solved live. The backend re-resolves + re-solves on submit.
 */
function CreateLoanForm({ onCreated, onCancel }: { onCreated: (loan: Loan) => void; onCancel: () => void }) {
  const createLoan = useCreateLoan();
  // limit is capped at 100 server-side (the inventory list DTO's @Max(100)); a
  // higher value 400s and left the vehicle dropdown empty. 100 covers the lot.
  const vehiclesQuery = useVehicles({ limit: 100 });
  const leadsQuery = useLeads({});
  const buyersQuery = useBuyers({});

  const vehicles = vehiclesQuery.data?.data ?? [];
  const buyers = buyersQuery.data?.data ?? [];
  const leads = (leadsQuery.data?.data ?? []).filter(
    (l) => !l.isWalkIn && l.vehicleId && !/closed|archived|sold/i.test(l.status),
  );

  const [source, setSource] = useState<"lead" | "new">("new");
  const [leadId, setLeadId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [buyerMode, setBuyerMode] = useState<"existing" | "new">("existing");
  const [buyerId, setBuyerId] = useState("");
  const [nb, setNb] = useState({ name: "", email: "", phone: "" });

  const [salePrice, setSalePrice] = useState("");
  const [downPayment, setDownPayment] = useState("0");
  const [raw, setRaw] = useState({ rate: "10", term: "24", emi: "" });
  // order[2] is the derived field (default: EMI derived from rate + term).
  const [order, setOrder] = useState<EmiField[]>(["term", "rate", "emi"]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const setField = (f: EmiField, v: string) => {
    setRaw((p) => ({ ...p, [f]: v }));
    setOrder((prev) => [f, ...prev.filter((x) => x !== f)]);
  };
  const selectLead = (id: string) => {
    setLeadId(id);
    const lead = leads.find((l) => l.id === id);
    const veh = vehicles.find((v) => v.id === lead?.vehicleId);
    if (veh) setSalePrice(String(veh.price));
  };
  const selectVehicle = (id: string) => {
    setVehicleId(id);
    const veh = vehicles.find((v) => v.id === id);
    if (veh) setSalePrice(String(veh.price));
  };

  const principal = Math.max(0, num(salePrice) - num(downPayment));
  const derived = order[2];
  const authVals = {
    rate: derived === "rate" ? undefined : numU(raw.rate),
    term: derived === "term" ? undefined : numU(raw.term),
    emi: derived === "emi" ? undefined : numU(raw.emi),
  };
  const derivedVal = computeMissing(principal, authVals, derived);
  const fmt = (f: EmiField, v: number) => (f === "term" ? String(Math.round(v)) : v.toFixed(2));
  const display = (f: EmiField) => (f === derived ? (derivedVal == null ? "" : fmt(f, derivedVal)) : raw[f]);
  const resolved = {
    rate: derived === "rate" ? derivedVal ?? undefined : numU(raw.rate),
    term: derived === "term" ? derivedVal ?? undefined : numU(raw.term),
    emi: derived === "emi" ? derivedVal ?? undefined : numU(raw.emi),
  };
  const selectedLead = leads.find((l) => l.id === leadId);

  const handleSubmit = async () => {
    if (principal <= 0) { toast({ title: "Enter a sale price above the down payment", variant: "destructive" }); return; }
    const auth: EmiField[] = [order[0], order[1]];
    const authOk = auth.every((f) => numU(raw[f]) !== undefined) && derivedVal != null;
    if (!authOk) { toast({ title: "Fill any two of interest, term, EMI", variant: "destructive" }); return; }

    const payload: Record<string, unknown> = {
      salePrice: num(salePrice),
      downPayment: num(downPayment) || 0,
      startDate,
      notes: notes || undefined,
    };
    if (auth.includes("rate")) payload.interestRatePercent = num(raw.rate);
    if (auth.includes("term")) payload.termMonths = parseInt(raw.term, 10);
    if (auth.includes("emi")) payload.emiAmount = num(raw.emi);

    if (source === "lead") {
      if (!leadId) { toast({ title: "Pick a lead", variant: "destructive" }); return; }
      payload.leadId = leadId;
    } else {
      if (!vehicleId) { toast({ title: "Pick a vehicle", variant: "destructive" }); return; }
      payload.vehicle = vehicleId;
      payload.vehicleTitle = vehicles.find((v) => v.id === vehicleId)?.title;
      if (buyerMode === "existing") {
        if (!buyerId) { toast({ title: "Pick a buyer", variant: "destructive" }); return; }
        payload.buyerLeadId = buyerId;
      } else {
        if (!nb.email.trim() || !nb.phone.trim()) { toast({ title: "New buyer needs email + phone", variant: "destructive" }); return; }
        payload.newBuyerName = nb.name;
        payload.newBuyerEmail = nb.email;
        payload.newBuyerPhone = nb.phone;
      }
    }

    try {
      const loan = await createLoan.mutateAsync(payload);
      toast({ title: "Loan created", description: `EMI $${loan.emiAmount.toFixed(2)}/mo · financed $${loan.principal.toLocaleString()}` });
      onCreated(loan);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof ApiError ? err.message : "Could not create loan", variant: "destructive" });
    }
  };

  const emiTrio: { field: EmiField; label: string; step?: string }[] = [
    { field: "rate", label: "Interest %", step: "0.1" },
    { field: "term", label: "Term (months)" },
    { field: "emi", label: "EMI ($/mo)", step: "0.01" },
  ];

  return (
    <div className="stat-card space-y-4">
      <h3 className="font-display font-semibold">New Loan</h3>

      {/* Source toggle */}
      <div className="flex gap-2">
        {(["lead", "new"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${source === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
          >
            {s === "lead" ? "From a lead" : "Car + buyer"}
          </button>
        ))}
      </div>

      {source === "lead" ? (
        <div className="space-y-2">
          <select value={leadId} onChange={(e) => selectLead(e.target.value)} className={inputCls}>
            <option value="">Select a lead *…</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>{l.buyerName} — {l.vehicleTitle}</option>
            ))}
          </select>
          {selectedLead && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Buyer <span className="font-medium text-foreground">{selectedLead.buyerName}</span>
              {selectedLead.buyerEmail ? ` (${selectedLead.buyerEmail})` : ""} · Vehicle{" "}
              <span className="font-medium text-foreground">{selectedLead.vehicleTitle}</span>
            </div>
          )}
          {leads.length === 0 && <p className="text-xs text-muted-foreground">No open leads with a buyer + vehicle. Use “Car + buyer”.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <select value={vehicleId} onChange={(e) => selectVehicle(e.target.value)} className={inputCls}>
            <option value="">Pick a vehicle *…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} — ${v.price?.toLocaleString() ?? "—"} · {v.status === "Sold" ? "Sold" : "Unsold"}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {(["existing", "new"] as const).map((m) => (
              <button key={m} onClick={() => setBuyerMode(m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${buyerMode === m ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>
                {m === "existing" ? "Existing buyer" : "New buyer"}
              </button>
            ))}
          </div>
          {buyerMode === "existing" ? (
            <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className={inputCls}>
              <option value="">Pick a buyer *…</option>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.email}</option>)}
            </select>
          ) : (
            <div className="grid md:grid-cols-3 gap-2">
              <input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder="Buyer name" className={inputCls} />
              <input value={nb.email} onChange={(e) => setNb({ ...nb, email: e.target.value })} placeholder="Email *" type="email" className={inputCls} />
              <input value={nb.phone} onChange={(e) => setNb({ ...nb, phone: e.target.value })} placeholder="Phone *" className={inputCls} />
            </div>
          )}
        </div>
      )}

      {/* Money */}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Sale price ($) *</label>
          <input value={salePrice} onChange={(e) => setSalePrice(noNeg(e.target.value))} type="number" min={0} onKeyDown={blockNegKeys} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Down payment ($)</label>
          <input value={downPayment} onChange={(e) => setDownPayment(noNeg(e.target.value))} type="number" min={0} onKeyDown={blockNegKeys} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Financed</label>
          <div className={`${inputCls} bg-muted/50 flex items-center`}>${principal.toLocaleString()}</div>
        </div>
      </div>

      {/* EMI trio — fill any two */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Fill any two — the third is calculated.</p>
        <div className="grid md:grid-cols-3 gap-3">
          {emiTrio.map(({ field, label, step }) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                {label}{field === derived && <span className="text-primary">(auto)</span>}
              </label>
              <input
                value={display(field)}
                onChange={(e) => setField(field, noNeg(e.target.value))}
                type="number"
                min={0}
                step={step}
                onKeyDown={blockNegKeys}
                className={`${inputCls} ${field === derived ? "border-primary/40 bg-primary/5" : ""}`}
              />
            </div>
          ))}
        </div>
      </div>

      {resolved.emi != null && resolved.term != null && principal > 0 && (
        <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">
          Financed <b>${principal.toLocaleString()}</b> · EMI <b>${resolved.emi.toFixed(2)}/mo</b> · {resolved.term} months
          {resolved.rate != null ? ` · ${resolved.rate}% /yr` : ""}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputCls} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
        <button onClick={handleSubmit} disabled={createLoan.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
          {createLoan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Loan
        </button>
      </div>
    </div>
  );
}

/** Edit an existing loan's terms — same live 2→3 solver as create. */
function EditLoanForm({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const updateLoan = useUpdateLoan(loan.id);
  const [borrowerName, setBorrowerName] = useState(loan.borrowerName);
  const [salePrice, setSalePrice] = useState(String(loan.salePrice));
  const [downPayment, setDownPayment] = useState(String(loan.downPayment));
  const [raw, setRaw] = useState({ rate: String(loan.interestRatePercent), term: String(loan.termMonths), emi: loan.emiAmount.toFixed(2) });
  const [order, setOrder] = useState<EmiField[]>(["term", "rate", "emi"]);
  const [startDate, setStartDate] = useState(loan.startDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(loan.notes ?? "");

  const setField = (f: EmiField, v: string) => {
    setRaw((p) => ({ ...p, [f]: v }));
    setOrder((prev) => [f, ...prev.filter((x) => x !== f)]);
  };
  const principal = Math.max(0, num(salePrice) - num(downPayment));
  const derived = order[2];
  const authVals = {
    rate: derived === "rate" ? undefined : numU(raw.rate),
    term: derived === "term" ? undefined : numU(raw.term),
    emi: derived === "emi" ? undefined : numU(raw.emi),
  };
  const derivedVal = computeMissing(principal, authVals, derived);
  const fmt = (f: EmiField, v: number) => (f === "term" ? String(Math.round(v)) : v.toFixed(2));
  const display = (f: EmiField) => (f === derived ? (derivedVal == null ? "" : fmt(f, derivedVal)) : raw[f]);

  const handleSave = async () => {
    if (principal <= 0) { toast({ title: "Sale price must exceed the down payment", variant: "destructive" }); return; }
    const auth: EmiField[] = [order[0], order[1]];
    if (!auth.every((f) => numU(raw[f]) !== undefined) || derivedVal == null) {
      toast({ title: "Fill any two of interest, term, EMI", variant: "destructive" }); return;
    }
    const patch: Record<string, unknown> = {
      borrowerName, salePrice: num(salePrice), downPayment: num(downPayment) || 0, startDate, notes,
    };
    if (auth.includes("rate")) patch.interestRatePercent = num(raw.rate);
    if (auth.includes("term")) patch.termMonths = parseInt(raw.term, 10);
    if (auth.includes("emi")) patch.emiAmount = num(raw.emi);
    try {
      await updateLoan.mutateAsync(patch);
      toast({ title: "Loan updated" });
      onDone();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof ApiError ? err.message : "", variant: "destructive" });
    }
  };

  const trio: { field: EmiField; label: string; step?: string }[] = [
    { field: "rate", label: "Interest %", step: "0.1" },
    { field: "term", label: "Term (mo)" },
    { field: "emi", label: "EMI ($/mo)", step: "0.01" },
  ];

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Edit terms</p>
      <input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="Borrower name" className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} type="number" placeholder="Sale price" className={inputCls} />
        <input value={downPayment} onChange={(e) => setDownPayment(e.target.value)} type="number" placeholder="Down payment" className={inputCls} />
      </div>
      <p className="text-[10px] text-muted-foreground">Financed ${principal.toLocaleString()} · fill any two below</p>
      <div className="grid grid-cols-3 gap-2">
        {trio.map(({ field, label, step }) => (
          <input
            key={field}
            value={display(field)}
            onChange={(e) => setField(field, e.target.value)}
            type="number"
            step={step}
            placeholder={label}
            className={`${inputCls} ${field === derived ? "border-primary/40 bg-primary/5" : ""}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={inputCls} />
      </div>
      <button onClick={handleSave} disabled={updateLoan.isPending} className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
        {updateLoan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </button>
    </div>
  );
}
