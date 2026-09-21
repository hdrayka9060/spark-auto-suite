import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useChangePaymentMethod } from "@/hooks/api/use-vehicles";

type Method = "cash" | "finance" | "bhph" | "trade_in";
type Status = "paid" | "partial" | "pending";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string | undefined;
  /** Net sale amount (salePrice − discount). */
  net: number;
  current: { paymentMethod: string; paymentStatus: string; amountPaid: number };
  /** Whether the sold car has a CRM buyer (required to switch to BHPH). */
  hasBuyer: boolean;
  onChanged?: () => void;
}

const money = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString()}`;
const LABEL: Record<Method, string> = { cash: "Cash", finance: "Finance", bhph: "BHPH", trade_in: "Trade-in" };

/**
 * Change a sold car's payment method with a full cascade (loan/receivable/
 * ledger/P&L). Switching TO BHPH needs a buyer + down payment + two of
 * rate/term/EMI; leaving BHPH archives the loan and opens a receivable if still
 * owed. Uses the app dialog — never a browser prompt.
 */
export function ChangePaymentMethodDialog({
  open, onOpenChange, vehicleId, net, current, hasBuyer, onChanged,
}: Props) {
  const change = useChangePaymentMethod(vehicleId ?? "");
  const [method, setMethod] = useState<Method>((current.paymentMethod as Method) || "cash");
  const [status, setStatus] = useState<Status>((current.paymentStatus as Status) || "paid");
  const [amountPaid, setAmountPaid] = useState<string>(String(current.amountPaid ?? ""));
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("");
  const [emi, setEmi] = useState("");

  useEffect(() => {
    if (open) {
      setMethod((current.paymentMethod as Method) || "cash");
      setStatus((current.paymentStatus as Status) || "paid");
      setAmountPaid(String(current.amountPaid ?? ""));
      setRate(""); setTerm(""); setEmi("");
    }
  }, [open, current.paymentMethod, current.paymentStatus, current.amountPaid]);

  const isBhph = method === "bhph";
  const emiCount = [rate, term, emi].filter((v) => v.trim() !== "").length;

  const submit = async () => {
    if (!vehicleId) return;
    if (isBhph) {
      if (!hasBuyer) { toast({ title: "Assign a buyer first", description: "BHPH needs a CRM buyer on the car.", variant: "destructive" }); return; }
      if (!(Number(amountPaid) > 0)) { toast({ title: "Down payment required", description: "Enter the amount already collected.", variant: "destructive" }); return; }
      if (emiCount < 2) { toast({ title: "Enter two of rate / term / EMI", variant: "destructive" }); return; }
    }
    try {
      await change.mutateAsync({
        paymentMethod: method,
        paymentStatus: isBhph ? "partial" : status,
        amountPaid: amountPaid === "" ? undefined : Math.max(0, Number(amountPaid) || 0),
        bhph: isBhph ? {
          interestRatePercent: rate === "" ? undefined : Number(rate),
          termMonths: term === "" ? undefined : Number(term),
          emiAmount: emi === "" ? undefined : Number(emi),
        } : undefined,
      });
      toast({ title: "Payment method updated", description: `Now ${LABEL[method]}. Ledger, P&L and BHPH updated.` });
      onOpenChange(false);
      onChanged?.();
    } catch (err) {
      toast({ title: "Couldn't change payment method", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !change.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change payment method</DialogTitle>
          <DialogDescription>
            Currently {LABEL[(current.paymentMethod as Method)] ?? current.paymentMethod} · {current.paymentStatus} · sale {money(net)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-muted-foreground">New payment method</label>
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="bhph">BHPH</SelectItem>
                <SelectItem value="trade_in">Trade-in</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isBhph ? (
            <div className="space-y-3">
              {!hasBuyer && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This car has no CRM buyer. Assign a buyer before switching to BHPH.
                </div>
              )}
              <div>
                <label className="text-[11px] text-muted-foreground">Down payment ($) *</label>
                <input type="number" min={0} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Rate %</label>
                  <input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Term (mo)</label>
                  <input type="number" min={1} value={term} onChange={(e) => setTerm(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">EMI ($)</label>
                  <input type="number" min={0} value={emi} onChange={(e) => setEmi(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Enter any two — the third is computed. Financed = {money(Math.max(0, net - (Number(amountPaid) || 0)))}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Payment status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(status === "partial" || status === "pending") && (
                <div>
                  <label className="text-[11px] text-muted-foreground">Amount paid ($)</label>
                  <input type="number" min={0} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  <p className="mt-1 text-[11px] text-muted-foreground">An open receivable tracks the {money(Math.max(0, net - (Number(amountPaid) || 0)))} balance.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={change.isPending} className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={change.isPending || !vehicleId} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {change.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Update
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
