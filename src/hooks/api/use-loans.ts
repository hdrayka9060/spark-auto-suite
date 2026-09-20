import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AmortizationRow, ClientLoanStatus, Loan, LoanCreateInput, LoanScheduleSummary, PaymentInput,
  ServerAmortizationRow, ServerLoan,
  toClientLoan, toClientSchedule, toServerLoanCreatePayload,
} from "@/lib/loan-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const LOANS_KEY = ["loans"] as const;

export interface LoanListFilters {
  status?: ClientLoanStatus | "All";
}

const STATUS_TO_SERVER_PARAM: Partial<Record<ClientLoanStatus, string>> = {
  Active: "active",
  Completed: "paid_off",
  Defaulted: "defaulted",
  // "Overdue" is a client-derived status; we filter for it locally.
};

export function useLoans(filters: LoanListFilters = {}) {
  const { status = "All" } = filters;
  const serverStatus = status === "All" || status === "Overdue" ? undefined : STATUS_TO_SERVER_PARAM[status];

  return useQuery({
    queryKey: [...LOANS_KEY, "list", { status }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerLoan>>("/bhph/loans", {
        query: { status: serverStatus, limit: 100 },
      });
      const all = res.data.map(toClientLoan);
      const filtered = status === "Overdue" ? all.filter((l) => l.status === "Overdue") : all;
      return { ...res, data: filtered };
    },
  });
}

export interface LoanDetail {
  loan: Loan;
  schedule: AmortizationRow[];
  summary?: LoanScheduleSummary;
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: [...LOANS_KEY, "detail", id],
    queryFn: async (): Promise<LoanDetail> => {
      const server = await api<{ loan: ServerLoan; schedule: ServerAmortizationRow[]; summary?: LoanScheduleSummary }>(`/bhph/loans/${id}`);
      return {
        loan: toClientLoan(server.loan),
        schedule: toClientSchedule(server.loan, server.schedule),
        summary: server.summary,
      };
    },
    enabled: Boolean(id),
  });
}

export function useLoanSummary() {
  return useQuery({
    queryKey: [...LOANS_KEY, "summary"],
    queryFn: async () => api<{ _id: string; count: number; totalPrincipal: number; totalPaid: number }[]>("/bhph/summary"),
  });
}

/**
 * Rich create payload — a superset the backend resolves: create-from-lead
 * (leadId), existing/inline buyer, down payment, and any two of the EMI trio.
 * Sent through largely as-is; the backend fills in the rest.
 */
export interface LoanCreatePayload {
  leadId?: string;
  buyerLeadId?: string;
  newBuyerName?: string;
  newBuyerEmail?: string;
  newBuyerPhone?: string;
  vehicle?: string;
  vehicleTitle?: string;
  salePrice?: number;
  downPayment?: number;
  interestRatePercent?: number;
  termMonths?: number;
  emiAmount?: number;
  startDate?: string;
  notes?: string;
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoanCreatePayload | LoanCreateInput): Promise<Loan> => {
      // Legacy LoanCreateInput (vehicleId + principal) still supported via the mapper;
      // the new rich payload is sent through directly.
      const body = "vehicleId" in input && !("vehicle" in input)
        ? toServerLoanCreatePayload(input as LoanCreateInput)
        : input;
      const created = await api<ServerLoan>("/bhph/loans", { method: "POST", body });
      return toClientLoan(created);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOANS_KEY });
      // A BHPH loan creates/updates a Sale → refresh accounting + dashboard too.
      qc.invalidateQueries({ queryKey: ["accounting"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

/** Edit loan terms (borrower, price, down payment, rate/term/EMI, dates, notes). */
export function useUpdateLoan(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<LoanCreatePayload>): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}`, { method: "PATCH", body: patch });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}

/** Close a loan (early settlement) — keeps the sale + interest income booked. */
export function useCloseLoan(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}/close`, { method: "POST" });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}

/** Archive a loan (terminal) — reverses the sale + income and un-sells the car. */
export function useArchiveLoan(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}/archive`, { method: "POST" });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}

function invalidateLoanAndFinancials(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: LOANS_KEY });
  qc.invalidateQueries({ queryKey: ["accounting"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["vehicles"] });
}

export function useRecordPayment(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentInput): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}/payment`, {
        method: "POST",
        body: { ...input, date: input.date ?? new Date().toISOString() },
      });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}

export interface UpdatePaymentInput {
  amount?: number;
  method?: string;
  receiptNumber?: string;
  notes?: string;
  date?: string;
  installmentNo?: number | null;
}

/** Edit a recorded payment. */
export function useUpdatePayment(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, patch }: { paymentId: string; patch: UpdatePaymentInput }): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}/payments/${paymentId}`, { method: "PATCH", body: patch });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}

/** Delete a recorded payment (undo). */
export function useDeletePayment(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}/payments/${paymentId}`, { method: "DELETE" });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}

/** Mark several installments fully paid at once. */
export function useBulkMarkPaid(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { installmentNos: number[]; method?: string; date?: string }): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}/payments/bulk-pay`, { method: "POST", body: input });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}

/** Mark an installment unpaid (remove all payments allocated to it). */
export function useUnpayInstallment(loanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (installmentNo: number): Promise<Loan> => {
      const updated = await api<ServerLoan>(`/bhph/loans/${loanId}/installments/${installmentNo}/unpay`, { method: "POST" });
      return toClientLoan(updated);
    },
    onSuccess: () => invalidateLoanAndFinancials(qc),
  });
}
