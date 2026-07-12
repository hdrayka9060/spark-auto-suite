import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ClientLeadChannel,
  ClientLeadStatus,
  Lead,
  LeadCreateInput,
  LeadUpdateInput,
  ServerLead,
  leadChannelToServer,
  toClientLead,
  toServerLeadCreatePayload,
  toServerLeadUpdatePayload,
} from "@/lib/lead-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const LEADS_KEY = ["leads"] as const;

export interface LeadListFilters {
  search?: string;
  status?: ClientLeadStatus | "All";
  assignedToId?: string;
}

const STATUS_TO_SERVER_QUERY: Record<ClientLeadStatus, string> = {
  New: "new",
  Contacted: "contacted",
  "Test Drive": "test_drive",
  Negotiation: "negotiation",
  Closed: "closed",
  Archived: "archived",
};

export function useLeads(filters: LeadListFilters = {}) {
  const { search, status = "All", assignedToId } = filters;
  const serverStatus = status === "All" ? undefined : STATUS_TO_SERVER_QUERY[status];

  return useQuery({
    queryKey: [...LEADS_KEY, "list", { search, status, assignedToId }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerLead>>("/leads", {
        query: { search, status: serverStatus, assignedTo: assignedToId, limit: 100 },
      });
      return { ...res, data: res.data.map(toClientLead) };
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: [...LEADS_KEY, "detail", id],
    queryFn: async () => {
      const server = await api<ServerLead>(`/leads/${id}`);
      return toClientLead(server);
    },
    enabled: Boolean(id),
  });
}

function seedDetail(qc: QueryClient, id: string, lead: Lead) {
  qc.setQueryData([...LEADS_KEY, "detail", id], lead);
  qc.invalidateQueries({ queryKey: LEADS_KEY });
  // Any lead mutation (status flip, log entry, test-drive booking, etc.)
  // potentially affects dashboard KPIs (Active Leads count, activity feed,
  // pendingTestDrives if test_drive booked). Invalidate so the dashboard
  // page reflects without waiting for the polling interval.
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadCreateInput): Promise<Lead> => {
      const created = await api<ServerLead>("/leads", {
        method: "POST",
        body: toServerLeadCreatePayload(input),
      });
      return toClientLead(created);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEADS_KEY });
      // Creating a lead now also adds the vehicle to the buyer's
      // interestedVehicles[], so refresh the buyer caches too.
      qc.invalidateQueries({ queryKey: ["buyers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateLead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadUpdateInput): Promise<Lead> => {
      const updated = await api<ServerLead>(`/leads/${id}`, {
        method: "PATCH",
        body: toServerLeadUpdatePayload(input),
      });
      return toClientLead(updated);
    },
    onSuccess: (lead) => seedDetail(qc, id, lead),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/leads/${id}`, { method: "DELETE" });
    },
    // Optimistic delete: strip the row from every cached list and drop the
    // detail cache before the network call returns. Without this the user
    // sees a 200-400ms "lead is still there" flicker while the mutation
    // round-trips to Atlas — which is the "delete is too slow" UX bug.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LEADS_KEY });
      const prevLists = qc.getQueriesData<unknown>({ queryKey: [...LEADS_KEY, "list"] });
      qc.setQueriesData<{ data: Lead[] } | undefined>(
        { queryKey: [...LEADS_KEY, "list"] },
        (old) => {
          if (!old || !Array.isArray((old as { data?: unknown }).data)) return old;
          return { ...old, data: (old.data as Lead[]).filter((l) => l.id !== id) };
        },
      );
      qc.removeQueries({ queryKey: [...LEADS_KEY, "detail", id] });
      return { prevLists };
    },
    onError: (_err, _id, ctx) => {
      // Rollback on failure — restore every list cache we touched.
      const snapshot = ctx as { prevLists?: [readonly unknown[], unknown][] } | undefined;
      snapshot?.prevLists?.forEach(([key, value]) => {
        qc.setQueryData(key as readonly unknown[], value);
      });
    },
    onSettled: () => {
      // Reconcile with the server, regardless of success/failure.
      qc.invalidateQueries({ queryKey: LEADS_KEY });
      // Deleting a closed lead reverts the sale on the backend (vehicle
      // → unsold, sale soft-deleted, buyer purchase pulled). We don't know
      // here whether the deleted lead was closed, so over-invalidate
      // rather than under — the cost is one extra refetch per delete.
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
      qc.invalidateQueries({ queryKey: ["buyers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export interface LeadLogInput {
  channel: ClientLeadChannel;
  summary: string;
  vehicleId?: string;
  byStaffId?: string;
  at?: string;
}

function toServerLogPayload(input: LeadLogInput) {
  const out: Record<string, unknown> = {
    channel: leadChannelToServer(input.channel),
    summary: input.summary,
  };
  if (input.vehicleId !== undefined) out.vehicleId = input.vehicleId;
  if (input.byStaffId !== undefined) out.byStaffId = input.byStaffId;
  if (input.at !== undefined) out.at = input.at;
  return out;
}

export function useAppendLeadLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadLogInput): Promise<Lead> => {
      const updated = await api<ServerLead>(`/leads/${id}/log`, {
        method: "POST",
        body: toServerLogPayload(input),
      });
      return toClientLead(updated);
    },
    // Adding a lead log now also pushes a communication onto the buyer's
    // CRM record, so refresh the buyer caches alongside the lead/dashboard.
    onSuccess: (lead) => {
      seedDetail(qc, id, lead);
      qc.invalidateQueries({ queryKey: ["buyers"] });
    },
  });
}

export function useUpdateLeadLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ logId, input }: { logId: string; input: LeadLogInput }): Promise<Lead> => {
      const updated = await api<ServerLead>(`/leads/${id}/log/${logId}`, {
        method: "PATCH",
        body: toServerLogPayload(input),
      });
      return toClientLead(updated);
    },
    onSuccess: (lead) => seedDetail(qc, id, lead),
  });
}

export interface LeadBookTestDriveInput {
  scheduledAt: string;
  assignedTo?: string;
  notes?: string;
}

export function useBookLeadTestDrive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadBookTestDriveInput): Promise<Lead> => {
      const updated = await api<ServerLead>(`/leads/${id}/book-test-drive`, {
        method: "POST",
        body: input,
      });
      return toClientLead(updated);
    },
    onSuccess: (lead) => {
      seedDetail(qc, id, lead);
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      // Booking a test drive via the lead now also pushes a test_drive_booked
      // entry onto the buyer's history[], so refresh the buyer caches.
      qc.invalidateQueries({ queryKey: ["buyers"] });
    },
  });
}

export interface CloseLeadInput {
  soldAt: number;
  amountPaid?: number;
  paymentMethod: "cash" | "finance" | "bhph" | "trade_in";
  paymentStatus: "paid" | "partial" | "pending";
  saleDate?: string;
  notes?: string;
}

export function useCloseLead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseLeadInput): Promise<Lead> => {
      const updated = await api<ServerLead>(`/leads/${id}/close`, {
        method: "POST",
        body: input,
      });
      return toClientLead(updated);
    },
    onSuccess: (lead) => {
      seedDetail(qc, id, lead);
      // Closing a lead touches inventory, buyers, and accounting too.
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["buyers"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
      // Force-refetch the leads list: invalidate alone marks queries stale,
      // but the kanban often holds onto its previous snapshot while the new
      // data is in flight. The sibling-archive cascade has to be visible the
      // moment the close dialog closes — refetch makes that guarantee.
      qc.refetchQueries({ queryKey: LEADS_KEY });
    },
  });
}

export function useDeleteLeadLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (logId: string): Promise<Lead> => {
      const updated = await api<ServerLead>(`/leads/${id}/log/${logId}`, { method: "DELETE" });
      return toClientLead(updated);
    },
    onSuccess: (lead) => seedDetail(qc, id, lead),
  });
}
