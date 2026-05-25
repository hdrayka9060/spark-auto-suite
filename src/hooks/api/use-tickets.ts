import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ClientTicketCategory,
  ClientTicketPriority,
  ClientTicketStatus,
  ServerTicket,
  Ticket,
  TicketCreateInput,
  TicketReplyInput,
  ticketStatusToServer,
  toClientTicket,
  toServerReplyPayload,
  toServerTicketCreatePayload,
} from "@/lib/ticket-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const TICKETS_KEY = ["tickets"] as const;

export interface TicketListFilters {
  search?: string;
  status?: ClientTicketStatus | "All";
  priority?: ClientTicketPriority | "All";
  category?: ClientTicketCategory | "All";
}

const STATUS_TO_SERVER_PARAM: Record<ClientTicketStatus, string> = {
  Open: "open",
  "In Progress": "in_progress",
  Resolved: "resolved",
  Closed: "closed",
};
const PRIORITY_TO_SERVER_PARAM: Record<ClientTicketPriority, string> = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Urgent: "urgent",
};
const CATEGORY_TO_SERVER_PARAM: Record<ClientTicketCategory, string> = {
  Technical: "technical",
  Billing: "billing",
  Vehicle: "vehicle",
  General: "general",
  Complaint: "complaint",
};

export function useTickets(filters: TicketListFilters = {}) {
  const { search, status = "All", priority = "All", category = "All" } = filters;
  const serverStatus = status === "All" ? undefined : STATUS_TO_SERVER_PARAM[status];
  const serverPriority = priority === "All" ? undefined : PRIORITY_TO_SERVER_PARAM[priority];
  const serverCategory = category === "All" ? undefined : CATEGORY_TO_SERVER_PARAM[category];

  return useQuery({
    queryKey: [...TICKETS_KEY, "list", { search, status, priority, category }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerTicket>>("/support/tickets", {
        query: { search, status: serverStatus, priority: serverPriority, category: serverCategory, limit: 100 },
      });
      return { ...res, data: res.data.map(toClientTicket) };
    },
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: [...TICKETS_KEY, "detail", id],
    queryFn: async () => {
      const server = await api<ServerTicket>(`/support/tickets/${id}`);
      return toClientTicket(server);
    },
    enabled: Boolean(id),
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: [...TICKETS_KEY, "stats"],
    queryFn: async () => api<{ _id: string; count: number }[]>("/support/stats"),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TicketCreateInput): Promise<Ticket> => {
      const created = await api<ServerTicket>("/support/tickets", {
        method: "POST",
        body: toServerTicketCreatePayload(input),
      });
      return toClientTicket(created);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}

export function useReplyToTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TicketReplyInput): Promise<Ticket> => {
      const updated = await api<ServerTicket>(`/support/tickets/${id}/reply`, {
        method: "POST",
        body: toServerReplyPayload(input),
      });
      return toClientTicket(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}

export function useUpdateTicketStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ status, assignedToId }: { status: ClientTicketStatus; assignedToId?: string }): Promise<Ticket> => {
      const updated = await api<ServerTicket>(`/support/tickets/${id}/status`, {
        method: "PATCH",
        body: { status: ticketStatusToServer(status), assignedTo: assignedToId },
      });
      return toClientTicket(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}

export function useUploadTicketAttachments(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]): Promise<Ticket> => {
      const formData = new FormData();
      // Backend field name is `files` for ticket attachments.
      for (const f of files) formData.append("files", f);
      const updated = await api<ServerTicket>(`/support/tickets/${id}/attachments`, {
        method: "POST",
        body: formData,
        rawBody: true,
      });
      return toClientTicket(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}
