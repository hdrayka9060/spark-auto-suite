/**
 * Shared sale-capture fields — Sold at / Sale date / Payment method / Payment
 * status / Amount paid. Used by both the Lead "Close" dialog and the New-Lead
 * form when the initial status is Closed, so the two capture a sale identically.
 *
 * Amount paid is REQUIRED only when payment status is "partial"; for "paid" it
 * defaults to the sold price and for "pending" it's 0.
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type SalePaymentMethod = "cash" | "finance" | "bhph" | "trade_in";
export type SalePaymentStatus = "paid" | "partial" | "pending";

export interface SaleDetails {
  soldAt: number;
  saleDate: string; // YYYY-MM-DD
  paymentMethod: SalePaymentMethod;
  paymentStatus: SalePaymentStatus;
  amountPaid?: number;
}

/** Seed a fresh sale-details value; defaults amountPaid to the sold price (paid). */
export function seedSaleDetails(defaultSoldAt = 0): SaleDetails {
  return {
    soldAt: defaultSoldAt,
    saleDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash",
    paymentStatus: "paid",
    amountPaid: undefined,
  };
}

/** Returns a human error message if the sale details are invalid, else null. */
export function validateSaleDetails(v: SaleDetails): string | null {
  if (!v.soldAt || v.soldAt <= 0) return "Sold price is required.";
  if (v.paymentStatus === "partial") {
    if (v.amountPaid === undefined || v.amountPaid <= 0) {
      return "Amount paid is required for partial payments.";
    }
    if (v.amountPaid > v.soldAt) return "Amount paid can't exceed the sold price.";
  }
  return null;
}

export function SaleDetailsFields({
  value,
  onChange,
}: {
  value: SaleDetails;
  onChange: (next: SaleDetails) => void;
}) {
  const set = (patch: Partial<SaleDetails>) => onChange({ ...value, ...patch });

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <label className="text-[11px] text-muted-foreground">Sold at ($) *</label>
        <input
          type="number"
          value={value.soldAt || ""}
          onChange={(e) => set({ soldAt: parseFloat(e.target.value) || 0 })}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Sale date</label>
        <input
          type="date"
          value={value.saleDate ?? ""}
          onChange={(e) => set({ saleDate: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
        />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Payment method</label>
        <Select
          value={value.paymentMethod}
          onValueChange={(v) => set({ paymentMethod: v as SalePaymentMethod })}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
            <SelectItem value="bhph">BHPH</SelectItem>
            <SelectItem value="trade_in">Trade-in</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">Payment status</label>
        <Select
          value={value.paymentStatus}
          onValueChange={(v) => {
            const ps = v as SalePaymentStatus;
            // Auto-prefill amountPaid: full when paid, 0 when pending, blank for
            // partial so the user must enter it.
            set({
              paymentStatus: ps,
              amountPaid: ps === "paid" ? value.soldAt : ps === "pending" ? 0 : value.amountPaid,
            });
          }}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <label className="text-[11px] text-muted-foreground">
          Amount paid ($) {value.paymentStatus === "partial" && "*"}
        </label>
        <input
          type="number"
          value={value.amountPaid ?? ""}
          onChange={(e) => set({ amountPaid: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
          placeholder={
            value.paymentStatus === "paid" ? `Defaults to sold price ($${value.soldAt.toLocaleString()})`
            : value.paymentStatus === "pending" ? "Leave blank (or 0)"
            : "Required for partial payments"
          }
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
        />
      </div>
    </div>
  );
}
