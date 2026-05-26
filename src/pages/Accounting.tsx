import { useMemo, useState } from "react";
import {
  DollarSign, TrendingUp, AlertCircle, Plus, X, Loader2, Receipt, Edit, Trash2, Download,
} from "lucide-react";
import { TimePeriodSelector } from "@/components/TimePeriodSelector";
import { PERIOD_PRESETS, PeriodPreset } from "@/lib/period-helpers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  useCreateExpense, useCreateSale, useDeleteExpense, useDeleteSale, useExpenses,
  useFinancialSummary, useProfitLoss, useSales, useUpdateExpense, useUpdateSale,
} from "@/hooks/api/use-accounting";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { useLeads } from "@/hooks/api/use-leads";
import { useBuyers } from "@/hooks/api/use-buyers";
import { ApiError } from "@/lib/api";
import {
  ALL_EXPENSE_CATEGORIES, ALL_PAYMENT_STATUSES, ClientExpenseCategory,
  ClientPaymentStatus, ExpenseEntry, SaleLedgerEntry, groupExpensesByCategory,
} from "@/lib/accounting-mapper";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors: Record<ClientPaymentStatus, string> = {
  Paid: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Partial: "bg-blue-100 text-blue-700",
};

const PAYMENT_METHODS: { value: "cash" | "finance" | "bhph" | "trade_in"; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "finance", label: "Finance" },
  { value: "bhph", label: "BHPH" },
  { value: "trade_in", label: "Trade-in" },
];

function formatMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function defaultPLRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

type ExpenseView = "breakdown" | "ledger";

// Sentinel for the buyer picker — switching to it reveals manual name/email
// inputs so the user can still record a sale to someone not in the CRM yet.
const OTHER = "__other__";

export default function Accounting() {
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseView, setExpenseView] = useState<ExpenseView>("breakdown");

  // Global date range — drives KPIs, ledgers, breakdown, AND CSV exports.
  // Defaults to "all time" (both blank); user picks any window they want.
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");

  // Time-period selector state. `periodPreset` tracks which radio is "selected"
  // for label purposes; the actual filter is still rangeStart/rangeEnd above.
  // We default to "all" to preserve the existing first-paint behaviour.
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");

  const summaryQuery = useFinancialSummary(rangeStart || undefined, rangeEnd || undefined);
  const salesQuery = useSales({ startDate: rangeStart || undefined, endDate: rangeEnd || undefined });
  const expensesQuery = useExpenses({ startDate: rangeStart || undefined, endDate: rangeEnd || undefined });
  // P&L chart uses its own 12-month default window — independent of the
  // user's KPI/ledger filter so the trend is always 12 months.
  const { startDate: plStart, endDate: plEnd } = useMemo(defaultPLRange, []);
  const plQuery = useProfitLoss(plStart, plEnd);
  const createSale = useCreateSale();
  const createExpense = useCreateExpense();
  const vehiclesQuery = useVehicles({ limit: 100 });
  const leadsQuery = useLeads();
  const buyersQuery = useBuyers();

  const expenseList = expensesQuery.data?.data ?? [];
  const expenseBreakdown = useMemo(() => groupExpensesByCategory(expenseList), [expenseList]);
  const maxExpense = expenseBreakdown[0]?.amount ?? 1;

  const summary = summaryQuery.data;
  const stats = useMemo(() => [
    { label: "Total Sales", value: summary ? String(summary.totalSales) : "—", icon: Receipt, color: "bg-primary/10 text-primary" },
    { label: "Revenue", value: summary ? formatMoney(summary.totalRevenue) : "—", icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
    { label: "Profit", value: summary ? formatMoney(summary.totalProfit) : "—", icon: DollarSign, color: "bg-amber-50 text-amber-600" },
    { label: "Outstanding", value: summary ? formatMoney(summary.outstanding) : "—", icon: AlertCircle, color: "bg-red-50 text-red-600" },
  ], [summary]);

  // Sale form. `salePrice` is what the buyer actually paid (the "Sold at"
  // figure). The dealer's `costPrice` is intentionally NOT collected here —
  // it's pulled from the linked Vehicle's inventory record at submit time,
  // mirroring how Inventory's MarkAsSoldDialog + Lead's CloseLeadDialog
  // already do it. Single source of truth: the vehicle.
  const [saleForm, setSaleForm] = useState({
    vehicleId: "", buyerName: "", buyerEmail: "",
    salePrice: "", discount: "", amountPaid: "",
    saleDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash" as "cash" | "finance" | "bhph" | "trade_in",
    paymentStatus: "Paid" as ClientPaymentStatus,
    notes: "",
    linkedLeadId: "",       // optional — closes the lead on submit
    linkedBuyerId: "",      // optional — pushes onto buyer.purchases on submit
  });
  const resetSaleForm = () => setSaleForm({
    vehicleId: "", buyerName: "", buyerEmail: "",
    salePrice: "", discount: "", amountPaid: "",
    saleDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash", paymentStatus: "Paid", notes: "",
    linkedLeadId: "", linkedBuyerId: "",
  });

  /**
   * When the user picks a lead, derive vehicle + buyer from it so they don't
   * have to retype anything. Manual edits afterwards still win.
   */
  const handleLinkLeadPicked = (leadId: string) => {
    if (!leadId) {
      setSaleForm((f) => ({ ...f, linkedLeadId: "" }));
      return;
    }
    const lead = (leadsQuery.data?.data ?? []).find((l) => l.id === leadId);
    if (!lead) return;
    setSaleForm((f) => ({
      ...f,
      linkedLeadId: leadId,
      linkedBuyerId: lead.buyerId || f.linkedBuyerId,
      vehicleId: lead.vehicleId || f.vehicleId,
      buyerName: lead.buyerName !== "—" ? lead.buyerName : f.buyerName,
      buyerEmail: lead.buyerEmail ?? f.buyerEmail,
      salePrice: lead.vehiclePrice !== undefined ? String(lead.vehiclePrice) : f.salePrice,
    }));
  };

  /**
   * Buyer picker is the primary control. Pick an existing buyer to lock the
   * link + auto-fill name/email; pick OTHER to keep the manual fields
   * editable for someone not yet in the CRM.
   */
  const handleLinkBuyerPicked = (value: string) => {
    if (!value) {
      setSaleForm((f) => ({ ...f, linkedBuyerId: "", buyerName: "", buyerEmail: "" }));
      return;
    }
    if (value === OTHER) {
      setSaleForm((f) => ({ ...f, linkedBuyerId: OTHER, buyerName: "", buyerEmail: "" }));
      return;
    }
    const buyer = (buyersQuery.data?.data ?? []).find((b) => b.id === value);
    if (!buyer) return;
    setSaleForm((f) => ({
      ...f,
      linkedBuyerId: value,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
    }));
  };

  const handleSaveSale = async () => {
    const vehicle = vehiclesQuery.data?.data.find((v) => v.id === saleForm.vehicleId);
    if (!vehicle) { toast({ title: "Pick a vehicle", variant: "destructive" }); return; }
    if (!saleForm.buyerName || !saleForm.buyerEmail || !saleForm.salePrice) {
      toast({ title: "Missing info", description: "Buyer name, email, and sold-at price are required.", variant: "destructive" });
      return;
    }
    try {
      const realBuyerId = saleForm.linkedBuyerId && saleForm.linkedBuyerId !== OTHER
        ? saleForm.linkedBuyerId : undefined;
      await createSale.mutateAsync({
        vehicleId: vehicle.id,
        vehicleTitle: vehicle.title,
        buyerName: saleForm.buyerName,
        buyerEmail: saleForm.buyerEmail,
        salePrice: parseFloat(saleForm.salePrice),
        // costPrice comes from the linked Vehicle (single source of truth).
        // Dealer never re-enters it here — matches MarkAsSoldDialog +
        // LeadCloseDialog and prevents two stored cost figures drifting apart.
        costPrice: vehicle.costPrice ?? 0,
        discount: saleForm.discount ? parseFloat(saleForm.discount) : 0,
        amountPaid: saleForm.amountPaid !== "" ? parseFloat(saleForm.amountPaid) : undefined,
        saleDate: saleForm.saleDate,
        paymentMethod: saleForm.paymentMethod,
        paymentStatus: saleForm.paymentStatus,
        notes: saleForm.notes || undefined,
        buyerLeadId: realBuyerId,
        leadId: saleForm.linkedLeadId || undefined,
      });
      toast({ title: "Sale recorded", description: vehicle.title });
      resetSaleForm();
      setShowAddSale(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  // Expense form
  const [expForm, setExpForm] = useState({
    title: "", amount: "", date: new Date().toISOString().slice(0, 10),
    category: "General" as ClientExpenseCategory, vendor: "", notes: "",
  });
  const resetExpForm = () => setExpForm({
    title: "", amount: "", date: new Date().toISOString().slice(0, 10),
    category: "General", vendor: "", notes: "",
  });

  // ── Sale edit / delete state ─────────────────────────────────────────────
  const [editingSale, setEditingSale] = useState<SaleLedgerEntry | null>(null);
  const [editSaleForm, setEditSaleForm] = useState({
    vehicleId: "", buyerName: "", buyerEmail: "", linkedBuyerId: "",
    salePrice: "", costPrice: "", discount: "", amountPaid: "",
    saleDate: "", paymentMethod: "cash" as "cash" | "finance" | "bhph" | "trade_in",
    paymentStatus: "Paid" as ClientPaymentStatus, notes: "",
  });
  const [pendingDeleteSale, setPendingDeleteSale] = useState<SaleLedgerEntry | null>(null);
  const updateSale = useUpdateSale(editingSale?.id ?? "");
  const deleteSale = useDeleteSale();

  const openEditSale = (s: SaleLedgerEntry) => {
    setEditingSale(s);
    setEditSaleForm({
      vehicleId: s.vehicleId,
      buyerName: s.buyerName,
      buyerEmail: s.buyerEmail,
      linkedBuyerId: OTHER, // sale doesn't carry buyerLeadId; treat as manual on edit
      salePrice: String(s.amount),
      costPrice: String(s.costPrice ?? 0),
      discount: String(s.discount),
      amountPaid: String(s.amountPaid),
      saleDate: s.date,
      paymentMethod: (s.paymentMethod || "Cash").toLowerCase() as "cash" | "finance" | "bhph" | "trade_in",
      paymentStatus: s.paymentStatus,
      notes: s.notes ?? "",
    });
  };

  const handleEditSaleBuyerPicked = (value: string) => {
    if (!value) {
      setEditSaleForm((f) => ({ ...f, linkedBuyerId: "", buyerName: "", buyerEmail: "" }));
      return;
    }
    if (value === OTHER) {
      setEditSaleForm((f) => ({ ...f, linkedBuyerId: OTHER }));
      return;
    }
    const b = (buyersQuery.data?.data ?? []).find((x) => x.id === value);
    if (!b) return;
    setEditSaleForm((f) => ({ ...f, linkedBuyerId: value, buyerName: b.name, buyerEmail: b.email }));
  };

  const handleSaveSaleEdit = async () => {
    if (!editingSale) return;
    if (!editSaleForm.buyerName || !editSaleForm.buyerEmail) {
      toast({ title: "Buyer required", description: "Pick a buyer or enter name + email.", variant: "destructive" });
      return;
    }
    const vehicle = vehiclesQuery.data?.data.find((v) => v.id === editSaleForm.vehicleId);
    if (!vehicle) {
      toast({ title: "Pick a vehicle", variant: "destructive" });
      return;
    }
    try {
      await updateSale.mutateAsync({
        vehicleId: vehicle.id,
        vehicleTitle: vehicle.title,
        buyerName: editSaleForm.buyerName,
        buyerEmail: editSaleForm.buyerEmail,
        salePrice: parseFloat(editSaleForm.salePrice) || 0,
        costPrice: editSaleForm.costPrice ? parseFloat(editSaleForm.costPrice) : 0,
        discount: editSaleForm.discount ? parseFloat(editSaleForm.discount) : 0,
        amountPaid: editSaleForm.amountPaid !== "" ? parseFloat(editSaleForm.amountPaid) : undefined,
        saleDate: editSaleForm.saleDate,
        paymentMethod: editSaleForm.paymentMethod,
        paymentStatus: editSaleForm.paymentStatus,
        notes: editSaleForm.notes || undefined,
      });
      toast({ title: "Sale updated", description: vehicle.title });
      setEditingSale(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Update failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const handleConfirmDeleteSale = async () => {
    if (!pendingDeleteSale) return;
    try {
      await deleteSale.mutateAsync(pendingDeleteSale.id);
      toast({ title: "Sale deleted" });
      setPendingDeleteSale(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  // Expense edit / delete state
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [editExpForm, setEditExpForm] = useState({
    title: "", amount: "", date: "", category: "General" as ClientExpenseCategory, vendor: "", notes: "",
  });
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState<ExpenseEntry | null>(null);
  const updateExpense = useUpdateExpense(editingExpense?.id ?? "");
  const deleteExpense = useDeleteExpense();

  const openEditExpense = (e: ExpenseEntry) => {
    setEditingExpense(e);
    setEditExpForm({
      title: e.title,
      amount: String(e.amount),
      date: e.date,
      category: e.category,
      vendor: e.vendor ?? "",
      notes: e.notes ?? "",
    });
  };

  const handleSaveExpenseEdit = async () => {
    if (!editingExpense) return;
    if (!editExpForm.title || !editExpForm.amount) {
      toast({ title: "Missing info", description: "Title and amount are required.", variant: "destructive" });
      return;
    }
    try {
      await updateExpense.mutateAsync({
        title: editExpForm.title,
        amount: parseFloat(editExpForm.amount),
        date: editExpForm.date,
        category: editExpForm.category,
        vendor: editExpForm.vendor || undefined,
        notes: editExpForm.notes || undefined,
      });
      toast({ title: "Expense updated", description: editExpForm.title });
      setEditingExpense(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Update failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const handleConfirmDeleteExpense = async () => {
    if (!pendingDeleteExpense) return;
    try {
      await deleteExpense.mutateAsync(pendingDeleteExpense.id);
      toast({ title: "Expense deleted", description: pendingDeleteExpense.title });
      setPendingDeleteExpense(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  /** Download the current sales ledger as CSV — respects the active date range. */
  const downloadSalesCsv = () => {
    const sales = salesQuery.data?.data ?? [];
    if (sales.length === 0) {
      toast({ title: "Nothing to export", description: "No sales in the selected range." });
      return;
    }
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "Date,Invoice,Vehicle,Buyer,Sale Price,Discount,Cost Price,Margin,Paid,Outstanding,Method,Status,Notes";
    const rows = sales.map((s) => {
      const margin = Math.max(0, s.amount - s.discount) - s.costPrice;
      return [
        s.date, s.id.slice(-6), s.vehicleTitle, s.buyerName,
        s.amount, s.discount, s.costPrice, margin,
        s.amountPaid, s.outstanding, s.paymentMethod, s.paymentStatus, s.notes,
      ].map(esc).join(",");
    });
    const suffix = rangeStart || rangeEnd ? `${rangeStart || "start"}_to_${rangeEnd || "today"}` : new Date().toISOString().slice(0, 10);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /** Download the current expense list as CSV. Filtering already happens upstream. */
  const downloadExpenseCsv = () => {
    if (expenseList.length === 0) {
      toast({ title: "Nothing to export", description: "No expenses are currently visible." });
      return;
    }
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "Date,Title,Category,Amount,Vendor,Notes";
    const rows = expenseList.map((e) =>
      [e.date, e.title, e.category, e.amount, e.vendor, e.notes].map(esc).join(","),
    );
    const suffix = rangeStart || rangeEnd ? `${rangeStart || "start"}_to_${rangeEnd || "today"}` : new Date().toISOString().slice(0, 10);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveExpense = async () => {
    if (!expForm.title || !expForm.amount) {
      toast({ title: "Missing info", description: "Title and amount are required.", variant: "destructive" });
      return;
    }
    try {
      await createExpense.mutateAsync({
        title: expForm.title,
        amount: parseFloat(expForm.amount),
        date: expForm.date,
        category: expForm.category,
        vendor: expForm.vendor || undefined,
        notes: expForm.notes || undefined,
      });
      toast({ title: "Expense added", description: expForm.title });
      resetExpForm();
      setShowAddExpense(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Accounting</h1>
          <p className="text-muted-foreground text-sm">
            Financial overview and records ·{" "}
            <span className="font-medium">
              {periodPreset === "custom" && rangeStart && rangeEnd
                ? `${rangeStart} → ${rangeEnd}`
                : PERIOD_PRESETS.find((p) => p.value === periodPreset)?.label ?? "All Time"}
            </span>
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <TimePeriodSelector
            preset={periodPreset}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onChange={({ preset, startDate, endDate }) => {
              setPeriodPreset(preset);
              setRangeStart(startDate);
              setRangeEnd(endDate);
            }}
          />
          <button
            onClick={() => { setShowAddExpense(!showAddExpense); setShowAddSale(false); }}
            className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80"
          >
            {showAddExpense ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddExpense ? "Cancel" : "Add Expense"}
          </button>
          <button
            onClick={() => { setShowAddSale(!showAddSale); setShowAddExpense(false); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            {showAddSale ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddSale ? "Cancel" : "Record Sale"}
          </button>
        </div>
      </div>

      {showAddSale && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Record a Sale</h3>
          <p className="text-xs text-muted-foreground -mt-2">
            Vehicle is required. Linking a lead or buyer is optional — pick one to auto-fill and close the loop on the related record.
          </p>

          {/* Optional linkers — picking either auto-fills the rest. */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Link to lead (optional)</label>
              <select
                value={saleForm.linkedLeadId}
                onChange={(e) => handleLinkLeadPicked(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">No lead link</option>
                {(leadsQuery.data?.data ?? [])
                  .filter((l) => l.status !== "Closed" && l.status !== "Archived")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.buyerName} – {l.vehicleTitle} ({l.status})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Buyer *</label>
              <select
                value={saleForm.linkedBuyerId}
                onChange={(e) => handleLinkBuyerPicked(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">Select a buyer…</option>
                {(buyersQuery.data?.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name} – {b.email}</option>
                ))}
                <option value={OTHER}>Other — enter manually</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <select value={saleForm.vehicleId} onChange={(e) => setSaleForm({ ...saleForm, vehicleId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-3">
              <option value="">Pick a vehicle *…</option>
              {(vehiclesQuery.data?.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            {saleForm.linkedBuyerId === OTHER && (
              <>
                <input value={saleForm.buyerName} onChange={(e) => setSaleForm({ ...saleForm, buyerName: e.target.value })} placeholder="Buyer name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={saleForm.buyerEmail} onChange={(e) => setSaleForm({ ...saleForm, buyerEmail: e.target.value })} placeholder="Buyer email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              </>
            )}
            <input type="date" value={saleForm.saleDate} onChange={(e) => setSaleForm({ ...saleForm, saleDate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={saleForm.salePrice} onChange={(e) => setSaleForm({ ...saleForm, salePrice: e.target.value })} placeholder="Sold at ($) *" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            {/* Cost price is intentionally NOT collected here — taken from the
                linked Vehicle in handleSaveSale (same source as MarkAsSold +
                Lead Close). Avoids two cost figures drifting apart. */}
            <input value={saleForm.discount} onChange={(e) => setSaleForm({ ...saleForm, discount: e.target.value })} placeholder="Discount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={saleForm.amountPaid} onChange={(e) => setSaleForm({ ...saleForm, amountPaid: e.target.value })} placeholder="Amount paid ($) — required for Partial" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={saleForm.paymentMethod} onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value as typeof saleForm.paymentMethod })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={saleForm.paymentStatus} onChange={(e) => setSaleForm({ ...saleForm, paymentStatus: e.target.value as ClientPaymentStatus })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} placeholder="Notes (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAddSale(false); resetSaleForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleSaveSale} disabled={createSale.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
              {createSale.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Record Sale
            </button>
          </div>
        </div>
      )}

      {showAddExpense && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Add an Expense</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} placeholder="Title *" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
            <input value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} placeholder="Amount ($) *" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value as ClientExpenseCategory })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={expForm.vendor} onChange={(e) => setExpForm({ ...expForm, vendor: e.target.value })} placeholder="Vendor (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <input value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} placeholder="Notes (optional)" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAddExpense(false); resetExpForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleSaveExpense} disabled={createExpense.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
              {createExpense.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Expense
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className={`p-2 rounded-lg w-fit ${s.color} mb-3`}><s.icon className="h-4 w-4" /></div>
            <p className="text-2xl font-bold font-display">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Profit & Loss (last 12 months)</h3>
          {plQuery.isLoading ? (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-12 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (plQuery.data?.buckets ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No sales or expenses in the last 12 months.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={plQuery.data!.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="square"
                />
                <Bar dataKey="revenue"  name="Revenue"  fill="hsl(222 60% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="hsl(220 13% 80%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit"   name="Profit"   fill="hsl(152 60% 42%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stat-card">
          {/* Header: title + view toggle (+ CSV button in ledger mode) */}
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="font-display font-semibold">
              {expenseView === "breakdown" ? "Expense Breakdown" : "Expense Ledger"}
            </h3>
            <div className="flex items-center gap-2">
              {expenseView === "ledger" && (
                <button
                  onClick={downloadExpenseCsv}
                  disabled={expenseList.length === 0}
                  className="flex items-center gap-2 bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/80 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              )}
              <div className="flex items-center bg-muted rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setExpenseView("breakdown")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    expenseView === "breakdown"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Breakdown
                </button>
                <button
                  onClick={() => setExpenseView("ledger")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    expenseView === "ledger"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Ledger
                </button>
              </div>
            </div>
          </div>

          {expensesQuery.isLoading ? (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : expenseList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No expenses logged yet.</p>
          ) : expenseView === "breakdown" ? (
            <div className="space-y-3">
              {expenseBreakdown.map((e) => (
                <div key={e.category} className="flex items-center justify-between">
                  <span className="text-sm">{e.category}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${(e.amount / maxExpense) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium w-24 text-right">{formatMoney(e.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Ledger view — scrollable list with hover edit/delete actions.
            <div className="max-h-[280px] overflow-y-auto -mx-2">
              <ul className="divide-y">
                {expenseList.map((e) => (
                  <li key={e.id} className="group flex items-start gap-2 px-2 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{e.title}</span>
                        <span className="status-badge bg-slate-100 text-slate-700 text-[10px]">{e.category}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {e.date}{e.vendor && ` · ${e.vendor}`}{e.notes && ` · ${e.notes}`}
                      </p>
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap">{formatMoney(e.amount)}</span>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                      <button
                        onClick={() => openEditExpense(e)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDeleteExpense(e)}
                        className="p-1 rounded hover:bg-red-50 text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h3 className="font-display font-semibold">Sales Ledger</h3>
          <button
            onClick={downloadSalesCsv}
            disabled={(salesQuery.data?.data ?? []).length === 0}
            className="flex items-center gap-2 bg-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/80 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
        {salesQuery.isLoading ? (
          <div className="flex items-center justify-center text-muted-foreground gap-2 py-8 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (salesQuery.data?.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No sales recorded yet. Click "Record Sale" above.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Vehicle</th>
                <th>Buyer</th>
                <th>Sale</th>
                <th>Cost</th>
                <th>Margin</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Method</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(salesQuery.data?.data ?? []).map((s) => {
                const net = Math.max(0, s.amount - s.discount);
                const margin = net - s.costPrice;
                return (
                <tr key={s.id} className="group">
                  <td className="font-mono text-xs">{s.id.slice(-6)}</td>
                  <td className="text-sm">{s.vehicleTitle}</td>
                  <td className="text-sm">{s.buyerName}</td>
                  <td className="font-medium">
                    ${s.amount.toLocaleString()}
                    {s.discount > 0 && <span className="text-xs text-emerald-600 ml-1">-${s.discount.toLocaleString()}</span>}
                  </td>
                  <td className="text-sm">${s.costPrice.toLocaleString()}</td>
                  <td
                    className={`text-sm font-medium ${
                      s.costPrice > 0 ? (margin >= 0 ? "text-emerald-700" : "text-red-600") : "text-muted-foreground"
                    }`}
                  >
                    {s.costPrice > 0 ? `$${margin.toLocaleString()}` : "—"}
                  </td>
                  <td className="text-sm">${s.amountPaid.toLocaleString()}</td>
                  <td className={`text-sm font-medium ${s.outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    ${s.outstanding.toLocaleString()}
                  </td>
                  <td className="text-xs text-muted-foreground">{s.paymentMethod}</td>
                  <td className="text-xs text-muted-foreground">{s.date}</td>
                  <td><span className={`status-badge ${statusColors[s.paymentStatus]}`}>{s.paymentStatus}</span></td>
                  <td>
                    <div className="flex items-center gap-1 justify-end opacity-60 group-hover:opacity-100">
                      <button
                        onClick={() => openEditSale(s)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                        title="Edit sale"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDeleteSale(s)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        title="Delete sale"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Sale dialog */}
      <Dialog open={Boolean(editingSale)} onOpenChange={(o) => !o && setEditingSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>Adjust the buyer, vehicle, prices, payment, or notes.</DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[11px] text-muted-foreground">Vehicle *</label>
              <select
                value={editSaleForm.vehicleId}
                onChange={(e) => setEditSaleForm({ ...editSaleForm, vehicleId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">Pick a vehicle…</option>
                {(vehiclesQuery.data?.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] text-muted-foreground">Buyer *</label>
              <select
                value={editSaleForm.linkedBuyerId}
                onChange={(e) => handleEditSaleBuyerPicked(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">Select…</option>
                {(buyersQuery.data?.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name} – {b.email}</option>
                ))}
                <option value={OTHER}>Other — enter manually</option>
              </select>
            </div>
            {editSaleForm.linkedBuyerId === OTHER && (
              <>
                <input value={editSaleForm.buyerName} onChange={(e) => setEditSaleForm({ ...editSaleForm, buyerName: e.target.value })} placeholder="Buyer name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={editSaleForm.buyerEmail} onChange={(e) => setEditSaleForm({ ...editSaleForm, buyerEmail: e.target.value })} placeholder="Buyer email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              </>
            )}
            <input type="date" value={editSaleForm.saleDate} onChange={(e) => setEditSaleForm({ ...editSaleForm, saleDate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={editSaleForm.salePrice} onChange={(e) => setEditSaleForm({ ...editSaleForm, salePrice: e.target.value })} placeholder="Sale price ($) *" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={editSaleForm.costPrice} onChange={(e) => setEditSaleForm({ ...editSaleForm, costPrice: e.target.value })} placeholder="Cost price ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={editSaleForm.discount} onChange={(e) => setEditSaleForm({ ...editSaleForm, discount: e.target.value })} placeholder="Discount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={editSaleForm.amountPaid} onChange={(e) => setEditSaleForm({ ...editSaleForm, amountPaid: e.target.value })} placeholder="Amount paid ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={editSaleForm.paymentMethod} onChange={(e) => setEditSaleForm({ ...editSaleForm, paymentMethod: e.target.value as typeof editSaleForm.paymentMethod })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={editSaleForm.paymentStatus} onChange={(e) => setEditSaleForm({ ...editSaleForm, paymentStatus: e.target.value as ClientPaymentStatus })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <textarea value={editSaleForm.notes} onChange={(e) => setEditSaleForm({ ...editSaleForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
          </div>
          <DialogFooter>
            <button onClick={() => setEditingSale(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleSaveSaleEdit}
              disabled={updateSale.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {updateSale.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete sale confirmation */}
      <AlertDialog open={Boolean(pendingDeleteSale)} onOpenChange={(o) => !o && setPendingDeleteSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteSale && (
                <>
                  Removes the <span className="font-medium">${pendingDeleteSale.amount.toLocaleString()}</span> sale of {pendingDeleteSale.vehicleTitle} to {pendingDeleteSale.buyerName} from the ledger.
                  The linked vehicle's Sold status is NOT reverted automatically.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSale}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteSale.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</span>
              ) : (
                "Delete sale"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Expense dialog */}
      <Dialog open={Boolean(editingExpense)} onOpenChange={(o) => !o && setEditingExpense(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update title, amount, date, category, vendor, or notes.</DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={editExpForm.title} onChange={(e) => setEditExpForm({ ...editExpForm, title: e.target.value })} placeholder="Title *" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
            <input value={editExpForm.amount} onChange={(e) => setEditExpForm({ ...editExpForm, amount: e.target.value })} placeholder="Amount ($) *" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="date" value={editExpForm.date} onChange={(e) => setEditExpForm({ ...editExpForm, date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={editExpForm.category} onChange={(e) => setEditExpForm({ ...editExpForm, category: e.target.value as ClientExpenseCategory })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input value={editExpForm.vendor} onChange={(e) => setEditExpForm({ ...editExpForm, vendor: e.target.value })} placeholder="Vendor (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <textarea value={editExpForm.notes} onChange={(e) => setEditExpForm({ ...editExpForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-3" />
          </div>
          <DialogFooter>
            <button onClick={() => setEditingExpense(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleSaveExpenseEdit}
              disabled={updateExpense.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {updateExpense.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete expense confirmation */}
      <AlertDialog
        open={Boolean(pendingDeleteExpense)}
        onOpenChange={(o) => !o && setPendingDeleteExpense(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteExpense && (
                <>
                  This removes <span className="font-medium">{pendingDeleteExpense.title}</span>
                  {" "}(${pendingDeleteExpense.amount.toLocaleString()}) from the ledger and recalculates totals.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteExpense}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteExpense.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</span>
              ) : (
                "Delete expense"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
