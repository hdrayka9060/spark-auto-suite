/**
 * Accounting mapper. Sales + expenses + summaries + P&L by month.
 *
 * Backend stores absolute dollar amounts and uses ISO date strings.
 * Frontend pretty-prints to USD strings and uses 3-letter month names for the
 * P&L chart. Status/payment-method enums get title-case display.
 */

export type ServerPaymentStatus = "paid" | "pending" | "partial";
export type ServerPaymentMethod = "cash" | "finance" | "bhph" | "trade_in";
export type ServerExpenseCategory =
  | "general" | "marketing" | "maintenance" | "staff" | "utilities" | "other";

export type ClientPaymentStatus = "Paid" | "Pending" | "Partial";
export type ClientExpenseCategory = "General" | "Marketing" | "Maintenance" | "Staff" | "Utilities" | "Other";

export interface ServerSale {
  _id: string;
  vehicleTitle: string;
  vehicleId: string;
  buyerName: string;
  buyerEmail: string;
  salePrice: number;
  costPrice: number;
  discount: number;
  /** How much of (salePrice − discount) the buyer has actually paid. */
  amountPaid?: number;
  saleDate: string;
  paymentMethod: ServerPaymentMethod;
  paymentStatus: ServerPaymentStatus;
  notes: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface ServerExpense {
  _id: string;
  title: string;
  amount: number;
  date: string;
  category: ServerExpenseCategory;
  vendor: string;
  notes: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  totalExpenses: number;
  totalProfit: number;
  totalSales: number;
  outstanding: number;
}

export interface SaleLedgerEntry {
  id: string;
  vehicleTitle: string;
  vehicleId: string;
  buyerName: string;
  buyerEmail: string;
  /** Gross sale price (before discount). */
  amount: number;
  discount: number;
  /** Dealer's acquisition cost — drives per-row gross margin. */
  costPrice: number;
  /** What the buyer has actually paid against the net (salePrice − discount). */
  amountPaid: number;
  /** Remaining receivable for non-paid sales — already clamped at zero. */
  outstanding: number;
  date: string;
  paymentMethod: string;
  paymentStatus: ClientPaymentStatus;
  notes: string;
}

export interface ExpenseEntry {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: ClientExpenseCategory;
  vendor: string;
  notes: string;
}

export interface PLBucket {
  month: string; // "Jan"
  monthIndex: number; // 1..12 (from mongo $month)
  revenue: number;
  cost: number;
  expenses: number;
  profit: number;
}

export interface ProfitLossReport {
  buckets: PLBucket[];
  summary: FinancialSummary;
}

const STATUS_TO_CLIENT: Record<ServerPaymentStatus, ClientPaymentStatus> = {
  paid: "Paid",
  pending: "Pending",
  partial: "Partial",
};

const CATEGORY_TO_CLIENT: Record<ServerExpenseCategory, ClientExpenseCategory> = {
  general: "General",
  marketing: "Marketing",
  maintenance: "Maintenance",
  staff: "Staff",
  utilities: "Utilities",
  other: "Other",
};

const CATEGORY_TO_SERVER: Record<ClientExpenseCategory, ServerExpenseCategory> = {
  General: "general",
  Marketing: "marketing",
  Maintenance: "maintenance",
  Staff: "staff",
  Utilities: "utilities",
  Other: "other",
};

const STATUS_TO_SERVER: Record<ClientPaymentStatus, ServerPaymentStatus> = {
  Paid: "paid",
  Pending: "pending",
  Partial: "partial",
};

export const ALL_PAYMENT_STATUSES: ClientPaymentStatus[] = ["Paid", "Pending", "Partial"];
export const ALL_EXPENSE_CATEGORIES: ClientExpenseCategory[] = [
  "General", "Marketing", "Maintenance", "Staff", "Utilities", "Other",
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function paymentStatusToServer(s: ClientPaymentStatus): ServerPaymentStatus {
  return STATUS_TO_SERVER[s];
}
export function expenseCategoryToServer(c: ClientExpenseCategory): ServerExpenseCategory {
  return CATEGORY_TO_SERVER[c];
}

export function toClientSale(s: ServerSale): SaleLedgerEntry {
  const net = Math.max(0, (s.salePrice ?? 0) - (s.discount ?? 0));
  const amountPaid = Math.max(0, Math.min(net, s.amountPaid ?? (s.paymentStatus === "paid" ? net : 0)));
  const outstanding = s.paymentStatus === "paid" ? 0 : Math.max(0, net - amountPaid);
  return {
    id: s._id,
    vehicleTitle: s.vehicleTitle,
    vehicleId: s.vehicleId,
    buyerName: s.buyerName,
    buyerEmail: s.buyerEmail,
    amount: s.salePrice,
    discount: s.discount,
    costPrice: s.costPrice ?? 0,
    amountPaid,
    outstanding,
    date: s.saleDate?.slice(0, 10) ?? s.createdAt?.slice(0, 10),
    paymentMethod: s.paymentMethod === "trade_in" ? "Trade-in" : (s.paymentMethod.charAt(0).toUpperCase() + s.paymentMethod.slice(1)),
    paymentStatus: STATUS_TO_CLIENT[s.paymentStatus],
    notes: s.notes ?? "",
  };
}

export function toClientExpense(e: ServerExpense): ExpenseEntry {
  return {
    id: e._id,
    title: e.title,
    amount: e.amount,
    date: e.date?.slice(0, 10) ?? e.createdAt?.slice(0, 10),
    category: CATEGORY_TO_CLIENT[e.category],
    vendor: e.vendor ?? "",
    notes: e.notes ?? "",
  };
}

/**
 * Backend returns sales + expenses grouped by month-number ($month: 1..12).
 * Convert to client-friendly buckets aligned by month name.
 */
export function toClientProfitLoss(server: {
  sales: { _id: number; revenue: number; cost: number; count: number }[];
  expenses: { _id: number; total: number }[];
  summary: FinancialSummary;
}): ProfitLossReport {
  const salesByMonth = new Map(server.sales.map((s) => [s._id, s]));
  const expensesByMonth = new Map(server.expenses.map((e) => [e._id, e]));
  const monthSet = new Set<number>([...salesByMonth.keys(), ...expensesByMonth.keys()]);
  const months = [...monthSet].sort((a, b) => a - b);

  const buckets: PLBucket[] = months.map((m) => {
    const sale = salesByMonth.get(m);
    const expense = expensesByMonth.get(m);
    const revenue = sale?.revenue ?? 0;
    const cost = sale?.cost ?? 0;
    const expenses = expense?.total ?? 0;
    return {
      month: MONTH_NAMES[m - 1] ?? `M${m}`,
      monthIndex: m,
      revenue,
      cost,
      expenses,
      profit: revenue - cost - expenses,
    };
  });

  return { buckets, summary: server.summary };
}

export interface SaleCreateInput {
  vehicleTitle: string;
  vehicleId: string;
  buyerName: string;
  buyerEmail: string;
  salePrice: number;
  costPrice?: number;
  discount?: number;
  /** Optional. If omitted, backend derives from paymentStatus. */
  amountPaid?: number;
  saleDate: string; // YYYY-MM-DD
  paymentMethod?: "cash" | "finance" | "bhph" | "trade_in";
  paymentStatus?: ClientPaymentStatus;
  notes?: string;
  /** Optional CRM Buyer to attach this sale to — pushes onto buyer.purchases. */
  buyerLeadId?: string;
  /** Optional Lead to close as a result of this sale. */
  leadId?: string;
}

export function toServerSaleCreatePayload(input: SaleCreateInput) {
  return {
    vehicleTitle: input.vehicleTitle,
    vehicleId: input.vehicleId,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    salePrice: input.salePrice,
    costPrice: input.costPrice ?? 0,
    discount: input.discount ?? 0,
    amountPaid: input.amountPaid,
    saleDate: input.saleDate,
    paymentMethod: input.paymentMethod ?? "cash",
    paymentStatus: input.paymentStatus ? STATUS_TO_SERVER[input.paymentStatus] : "paid",
    notes: input.notes ?? "",
    buyerLeadId: input.buyerLeadId,
    leadId: input.leadId,
  };
}

export interface ExpenseCreateInput {
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: ClientExpenseCategory;
  vendor?: string;
  notes?: string;
}

export function toServerExpenseCreatePayload(input: ExpenseCreateInput) {
  return {
    title: input.title,
    amount: input.amount,
    date: input.date,
    category: CATEGORY_TO_SERVER[input.category],
    vendor: input.vendor ?? "",
    notes: input.notes ?? "",
  };
}

/** Aggregate a list of ExpenseEntry by category — for the breakdown bar chart. */
export function groupExpensesByCategory(expenses: ExpenseEntry[]): { category: ClientExpenseCategory; amount: number }[] {
  const map = new Map<ClientExpenseCategory, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
