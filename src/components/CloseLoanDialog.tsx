import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useCloseLoan } from "@/hooks/api/use-loans";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string | undefined;
  borrowerName?: string;
  vehicleTitle?: string;
  /** Remaining principal — the early-payoff amount (from the loan summary). */
  outstandingPrincipal?: number;
  onClosed?: () => void;
}

type Outcome = "payoff" | "defaulted";

const money = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString()}`;

/**
 * Close a BHPH loan via the app's own dialog (never a browser confirm). Two
 * outcomes: EARLY PAYOFF (settle the remaining principal now, future interest
 * waived, + an optional early-closure fee) → loan paid off; or MARK DEFAULTED
 * (keep whatever was collected, stop reminders). Neither reverses the sale.
 */
export function CloseLoanDialog({
  open, onOpenChange, loanId, borrowerName, vehicleTitle, outstandingPrincipal = 0, onClosed,
}: Props) {
  const closeLoan = useCloseLoan(loanId ?? "");
  const [outcome, setOutcome] = useState<Outcome>("payoff");
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) { setOutcome("payoff"); setFee(""); setNote(""); }
  }, [open]);

  const submit = async () => {
    if (!loanId) return;
    try {
      await closeLoan.mutateAsync({
        outcome,
        earlyClosureFee: outcome === "payoff" ? Math.max(0, Number(fee) || 0) : undefined,
        note: note.trim() || undefined,
      });
      toast({
        title: outcome === "payoff" ? "Loan paid off" : "Loan marked defaulted",
        description: outcome === "payoff"
          ? "The remaining balance was settled and the sale marked paid."
          : "Reminders stopped. Collected payments stay booked.",
      });
      onOpenChange(false);
      onClosed?.();
    } catch (err) {
      toast({ title: "Couldn't close the loan", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const payoffTotal = Math.max(0, outstandingPrincipal) + Math.max(0, Number(fee) || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !closeLoan.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close loan</DialogTitle>
          <DialogDescription>
            {borrowerName || "Borrower"}{vehicleTitle ? ` · ${vehicleTitle}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Outcome choice */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOutcome("payoff")}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm ${outcome === "payoff" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
            >
              <span className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Early payoff</span>
              <span className="text-xs text-muted-foreground">Settle the balance now — paid off.</span>
            </button>
            <button
              type="button"
              onClick={() => setOutcome("defaulted")}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm ${outcome === "defaulted" ? "border-destructive bg-destructive/5 ring-1 ring-destructive" : "hover:bg-muted"}`}
            >
              <span className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" /> Defaulted</span>
              <span className="text-xs text-muted-foreground">Stopped paying — keep collected.</span>
            </button>
          </div>

          {outcome === "payoff" ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Remaining principal</span><span className="font-medium">{money(outstandingPrincipal)}</span></div>
                {Number(fee) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Early-closure fee</span><span className="font-medium">{money(Number(fee))}</span></div>
                )}
                <div className="mt-1 flex justify-between border-t pt-1"><span className="text-muted-foreground">Borrower pays</span><span className="font-semibold">{money(payoffTotal)}</span></div>
                <p className="mt-1 text-[11px] text-muted-foreground">Future interest is waived. The sale is marked fully paid.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Early-closure fee (optional)</label>
                <input
                  type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Booked as other income.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              The loan will be marked <strong>defaulted</strong> and reminders stop. The down payment,
              payments, and interest already collected stay booked — the sale is <strong>not</strong> reversed.
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Note (optional)</label>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={outcome === "payoff" ? "e.g. paid off in full" : "e.g. no contact for 60 days"}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={closeLoan.isPending} className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Cancel</button>
          <button
            onClick={submit}
            disabled={closeLoan.isPending || !loanId}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 ${outcome === "defaulted" ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}
          >
            {closeLoan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {outcome === "payoff" ? "Confirm payoff" : "Mark defaulted"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
