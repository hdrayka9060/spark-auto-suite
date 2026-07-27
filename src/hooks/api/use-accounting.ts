import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ClientExpenseCategory, ClientPaymentStatus, ExpenseCreateInput, ExpenseEntry,
  FinancialSummary, ProfitLossReport, SaleCreateInput, SaleLedgerEntry,
  ServerExpense, ServerSale, expenseCategoryToServer, paymentStatusToServer,
  toClientExpense, toClientProfitLoss, toClientSale,
  toServerExpenseCreatePayload, toServerSaleCreatePayload,
} from "@/lib/accounting-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const ACCOUNTING_KEY = ["accounting"] as const;

export function useFinancialSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [...ACCOUNTING_KEY, "summary", { startDate, endDate }],
    queryFn: async () => api<FinancialSummary>("/accounting/summary", { query: { startDate, endDate } }),
  });
}

export interface SalesListFilters {
  search?: string;
  paymentStatus?: ClientPaymentStatus | "All";
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function useSales(filters: SalesListFilters = {}) {
  const { search, paymentStatus = "All", startDate, endDate, page = 1, limit = 200 } = filters;
  const serverStatus = paymentStatus === "All" ? undefined : paymentStatusToServer(paymentStatus);
  return useQuery({
    queryKey: [...ACCOUNTING_KEY, "sales", { search, paymentStatus, startDate, endDate, page, limit }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerSale>>("/accounting/sales", {
        query: { search, paymentStatus: serverStatus, startDate, endDate, page, limit },
      });
      // res carries { total, page, limit, totalPages, hasNext, hasPrev }.
      return { ...res, data: res.data.map(toClientSale) };
    },
  });
}

export interface ExpensesListFilters {
  category?: ClientExpenseCategory | "All";
  startDate?: string;
  endDate?: string;
}

export function useExpenses(filters: ExpensesListFilters = {}) {
  const { category = "All", startDate, endDate } = filters;
  const serverCategory = category === "All" ? undefined : expenseCategoryToServer(category);
  return useQuery({
    queryKey: [...ACCOUNTING_KEY, "expenses", { category, startDate, endDate }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerExpense>>("/accounting/expenses", {
        query: { category: serverCategory, startDate, endDate, limit: 500 },
      });
      return { ...res, data: res.data.map(toClientExpense) };
    },
  });
}

/**
 * One reconditioning spend flattened out of a vehicle's `spends[]`. Cost-of-goods,
 * surfaced read-only in Accounting — NOT an operating expense (never double-counted
 * against profit; see AccountingService.getReconditioningSpends).
 */
export interface ReconditioningSpend {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  vehicleNumber?: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  by: string;
}

export function useReconditioningSpends(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: [...ACCOUNTING_KEY, "reconditioning", { startDate, endDate }],
    queryFn: async () => {
      const res = await api<{
        items: Array<{
          _id: string; vehicleId: string; vehicleTitle: string; vehicleNumber?: string;
          amount: number; category: string; description: string; date: string; by: string;
        }>;
        totalAmount: number;
        count: number;
      }>("/accounting/reconditioning-spends", { query: { startDate, endDate } });
      return {
        items: (res.items ?? []).map<ReconditioningSpend>((x) => ({
          id: x._id,
          vehicleId: x.vehicleId,
          vehicleTitle: x.vehicleTitle,
          vehicleNumber: x.vehicleNumber,
          amount: x.amount ?? 0,
          category: x.category || "Other",
          description: x.description ?? "",
          date: x.date ? x.date.slice(0, 10) : "",
          by: x.by ?? "",
        })),
        totalAmount: res.totalAmount ?? 0,
        count: res.count ?? 0,
      };
    },
  });
}

export function useProfitLoss(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [...ACCOUNTING_KEY, "profit-loss", { startDate, endDate }],
    queryFn: async () => {
      const server = await api<{
        sales: { _id: number; revenue: number; cost: number; count: number }[];
        expenses: { _id: number; total: number }[];
        summary: FinancialSummary;
      }>("/accounting/profit-loss", { query: { startDate, endDate } });
      return toClientProfitLoss(server);
    },
    enabled: Boolean(startDate && endDate),
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaleCreateInput): Promise<SaleLedgerEntry> => {
      const created = await api<ServerSale>("/accounting/sales", {
        method: "POST",
        body: toServerSaleCreatePayload(input),
      });
      return toClientSale(created);
    },
    // createSale touches multiple collections in the unified flow:
    //   - Sale + Expense aggregates  (accounting)
    //   - Vehicle.status / soldAt / soldDate  (vehicles)
    //   - BuyerLead.purchases / stage  (buyers, when buyerLeadId)
    //   - Lead.status / timeline + sibling-leads → dropped  (leads, when leadId)
    // Invalidate every affected cache so all pages reflect "Sold" instantly.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTING_KEY });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["buyers"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["sellers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateSale(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaleCreateInput): Promise<SaleLedgerEntry> => {
      const updated = await api<ServerSale>(`/accounting/sales/${id}`, {
        method: "PATCH",
        body: toServerSaleCreatePayload(input),
      });
      return toClientSale(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTING_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/accounting/sales/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTING_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseCreateInput): Promise<ExpenseEntry> => {
      const created = await api<ServerExpense>("/accounting/expenses", {
        method: "POST",
        body: toServerExpenseCreatePayload(input),
      });
      return toClientExpense(created);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTING_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExpenseCreateInput): Promise<ExpenseEntry> => {
      const updated = await api<ServerExpense>(`/accounting/expenses/${id}`, {
        method: "PATCH",
        body: toServerExpenseCreatePayload(input),
      });
      return toClientExpense(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTING_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/accounting/expenses/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTING_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export type { ProfitLossReport };
