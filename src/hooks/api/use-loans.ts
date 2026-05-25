import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AmortizationRow, ClientLoanStatus, Loan, LoanCreateInput, PaymentInput,
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
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: [...LOANS_KEY, "detail", id],
    queryFn: async (): Promise<LoanDetail> => {
      const server = await api<{ loan: ServerLoan; schedule: ServerAmortizationRow[] }>(`/bhph/loans/${id}`);
      return {
        loan: toClientLoan(server.loan),
        schedule: toClientSchedule(server.loan, server.schedule),
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

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoanCreateInput): Promise<Loan> => {
      const created = await api<ServerLoan>("/bhph/loans", {
        method: "POST",
        body: toServerLoanCreatePayload(input),
      });
      return toClientLoan(created);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LOANS_KEY }),
  });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: LOANS_KEY }),
  });
}
