/**
 * BHPH loan mapper. Auto-derives Overdue status client-side from `nextDue`.
 *
 * Backend tracks: `status: active | paid_off | defaulted`, `payments[]` log,
 * `totalPaid`, `principal`, `termMonths`. The detail endpoint also returns
 * a precomputed `schedule[]` amortization table.
 *
 * Frontend prototype uses an "Overdue" derived status — we set it when the
 * loan is still `active` and the next-due date is in the past.
 */

export type ServerLoanStatus = "active" | "paid_off" | "defaulted";
export type ClientLoanStatus = "Active" | "Completed" | "Defaulted" | "Overdue";

export interface ServerPayment {
  amount: number;
  date: string;
  method: string;
  notes?: string;
  receiptNumber?: string;
}

export interface ServerLoan {
  _id: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  vehicle?: { _id: string; title: string; vehicleNumber?: string } | string | null;
  vehicleTitle: string;
  principal: number;
  interestRatePercent: number;
  termMonths: number;
  emiAmount: number;
  startDate: string;
  endDate?: string;
  totalPaid: number;
  status: ServerLoanStatus;
  payments: ServerPayment[];
  notes: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerAmortizationRow {
  installmentNo: number;
  dueDate: string;
  emiAmount: number;
  principalPart: number;
  interestPart: number;
  balance: number;
}

export interface AmortizationRow {
  installmentNo: number;
  dueDate: string; // YYYY-MM-DD
  emiAmount: number;
  principalPart: number;
  interestPart: number;
  balance: number;
  /** Has this installment been paid (cumulative payment >= installment due)? */
  paid: boolean;
}

export interface Loan {
  id: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  vehicleId?: string;
  vehicleTitle: string;
  principal: number;
  interestRatePercent: number;
  termMonths: number;
  emiAmount: number;
  startDate: string;
  endDate?: string;
  totalPaid: number;
  remaining: number;
  installmentsCompleted: number;
  nextDueDate?: string;
  status: ClientLoanStatus;
  rawStatus: ServerLoanStatus;
  payments: { date: string; amount: number; method: string; receiptNumber?: string; notes?: string }[];
  notes: string;
}

const STATUS_TO_CLIENT: Record<ServerLoanStatus, ClientLoanStatus> = {
  active: "Active",
  paid_off: "Completed",
  defaulted: "Defaulted",
};

function formatDate(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

function refId<T extends { _id: string } | string | null | undefined>(v: T): string | undefined {
  if (!v) return undefined;
  return typeof v === "string" ? v : v._id;
}

/**
 * Compute how many full installments are covered by the total paid amount.
 * Used to drive the EMI grid (boxes 1..N filled = paid).
 */
function computeInstallmentsCompleted(totalPaid: number, emi: number): number {
  if (emi <= 0) return 0;
  return Math.min(Math.floor(totalPaid / emi), Number.MAX_SAFE_INTEGER);
}

function computeNextDueDate(startDate: string, installmentsCompleted: number, termMonths: number): string | undefined {
  if (installmentsCompleted >= termMonths) return undefined;
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + installmentsCompleted + 1);
  return d.toISOString().slice(0, 10);
}

export function toClientLoan(s: ServerLoan): Loan {
  const completed = computeInstallmentsCompleted(s.totalPaid, s.emiAmount);
  const remaining = Math.max(0, s.principal - s.totalPaid);
  const nextDue = s.status === "active" ? computeNextDueDate(s.startDate, completed, s.termMonths) : undefined;

  let clientStatus: ClientLoanStatus = STATUS_TO_CLIENT[s.status];
  if (clientStatus === "Active" && nextDue) {
    const today = new Date();
    if (new Date(nextDue) < today) clientStatus = "Overdue";
  }

  return {
    id: s._id,
    borrowerName: s.borrowerName,
    borrowerEmail: s.borrowerEmail,
    borrowerPhone: s.borrowerPhone,
    vehicleId: refId(s.vehicle),
    vehicleTitle: s.vehicleTitle,
    principal: s.principal,
    interestRatePercent: s.interestRatePercent,
    termMonths: s.termMonths,
    emiAmount: s.emiAmount,
    startDate: formatDate(s.startDate),
    endDate: s.endDate ? formatDate(s.endDate) : undefined,
    totalPaid: s.totalPaid,
    remaining,
    installmentsCompleted: completed,
    nextDueDate: nextDue,
    status: clientStatus,
    rawStatus: s.status,
    payments: (s.payments ?? []).map((p) => ({
      date: formatDate(p.date),
      amount: p.amount,
      method: p.method,
      receiptNumber: p.receiptNumber,
      notes: p.notes,
    })),
    notes: s.notes ?? "",
  };
}

export function toClientSchedule(loan: ServerLoan, rows: ServerAmortizationRow[]): AmortizationRow[] {
  const completed = computeInstallmentsCompleted(loan.totalPaid, loan.emiAmount);
  return rows.map((r) => ({
    installmentNo: r.installmentNo,
    dueDate: formatDate(r.dueDate),
    emiAmount: r.emiAmount,
    principalPart: r.principalPart,
    interestPart: r.interestPart,
    balance: r.balance,
    paid: r.installmentNo <= completed,
  }));
}

// ── Summary aggregation ────────────────────────────────────────────────────

export interface LoanSummaryRow {
  status: ClientLoanStatus;
  count: number;
  totalPrincipal: number;
  totalPaid: number;
}

export interface PortfolioTotals {
  totalFinanced: number;
  totalCollected: number;
  outstanding: number;
  overdueCount: number;
}

export function rollupPortfolio(loans: Loan[]): PortfolioTotals {
  let totalFinanced = 0;
  let totalCollected = 0;
  let overdueCount = 0;
  for (const l of loans) {
    totalFinanced += l.principal;
    totalCollected += l.totalPaid;
    if (l.status === "Overdue") overdueCount++;
  }
  return {
    totalFinanced,
    totalCollected,
    outstanding: Math.max(0, totalFinanced - totalCollected),
    overdueCount,
  };
}

// ── Write direction ────────────────────────────────────────────────────────

export interface LoanCreateInput {
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  vehicleId: string;
  vehicleTitle: string;
  principal: number;
  interestRatePercent: number;
  termMonths: number;
  startDate: string; // YYYY-MM-DD
  notes?: string;
}

export function toServerLoanCreatePayload(input: LoanCreateInput) {
  return {
    borrowerName: input.borrowerName,
    borrowerEmail: input.borrowerEmail,
    borrowerPhone: input.borrowerPhone,
    vehicle: input.vehicleId,
    vehicleTitle: input.vehicleTitle,
    principal: input.principal,
    interestRatePercent: input.interestRatePercent,
    termMonths: input.termMonths,
    startDate: input.startDate,
    notes: input.notes,
  };
}

export interface PaymentInput {
  amount: number;
  method: "cash" | "bank_transfer" | "cheque";
  notes?: string;
  receiptNumber?: string;
  date?: string;
}
