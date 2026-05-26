import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  BookBuyerTestDriveInput,
  Buyer,
  BuyerCommunicationInput,
  BuyerFormInput,
  BuyerUpdateInput,
  ClientBuyerStatus,
  ServerBuyerLead,
  ServerBuyerStage,
  getBuyerStageQuery,
  toClientBuyer,
  toServerBuyerCreatePayload,
  toServerBuyerUpdatePayload,
} from "@/lib/buyer-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const BUYERS_KEY = ["buyers"] as const;
const CALENDAR_KEY = ["calendar"] as const;

export interface BuyerListFilters {
  search?: string;
  status?: ClientBuyerStatus | "All";
}

export function useBuyers(filters: BuyerListFilters = {}) {
  const { search, status = "All" } = filters;
  const serverStage = getBuyerStageQuery(status);

  return useQuery({
    queryKey: [...BUYERS_KEY, "list", { search, status }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerBuyerLead>>("/crm/buyers", {
        query: { search, stage: serverStage, limit: 100 },
      });
      const all = res.data.map(toClientBuyer);
      const filtered = status === "Active" ? all.filter((b) => b.status === "Active") : all;
      return { ...res, data: filtered };
    },
  });
}

export function useBuyer(id: string | undefined) {
  return useQuery({
    queryKey: [...BUYERS_KEY, "detail", id],
    queryFn: async () => {
      const server = await api<ServerBuyerLead>(`/crm/buyers/${id}`);
      return toClientBuyer(server);
    },
    enabled: Boolean(id),
  });
}

function invalidateBuyers(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: BUYERS_KEY });
  // Buyer mutations feed the dashboard activity stream (new-lead entries
  // mention the buyer). Keep the dashboard in sync without a hard reload.
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BuyerFormInput): Promise<Buyer> => {
      const created = await api<ServerBuyerLead>("/crm/buyers", {
        method: "POST",
        body: toServerBuyerCreatePayload(input),
      });
      return toClientBuyer(created);
    },
    onSuccess: () => invalidateBuyers(qc),
  });
}

export function useUpdateBuyer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BuyerUpdateInput): Promise<Buyer> => {
      const updated = await api<ServerBuyerLead>(`/crm/buyers/${id}`, {
        method: "PATCH",
        body: toServerBuyerUpdatePayload(input),
      });
      return toClientBuyer(updated);
    },
    onSuccess: (buyer) => {
      qc.setQueryData([...BUYERS_KEY, "detail", id], buyer);
      invalidateBuyers(qc);
    },
  });
}

export function useDeleteBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/crm/buyers/${id}`, { method: "DELETE" });
    },
    onSuccess: () => invalidateBuyers(qc),
  });
}

export function useAddBuyerInterestedVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vehicleId: string): Promise<Buyer> => {
      const updated = await api<ServerBuyerLead>(`/crm/buyers/${id}/interested-vehicles`, {
        method: "POST",
        body: { vehicleId },
      });
      return toClientBuyer(updated);
    },
    // Seed the detail cache directly so the page re-renders instantly with
    // the new vehicle, without waiting on the refetch round-trip.
    onSuccess: (buyer) => {
      qc.setQueryData([...BUYERS_KEY, "detail", id], buyer);
      invalidateBuyers(qc);
    },
  });
}

export function useRemoveBuyerInterestedVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vehicleId: string): Promise<Buyer> => {
      const updated = await api<ServerBuyerLead>(
        `/crm/buyers/${id}/interested-vehicles/${vehicleId}`,
        { method: "DELETE" },
      );
      return toClientBuyer(updated);
    },
    onSuccess: (buyer) => {
      qc.setQueryData([...BUYERS_KEY, "detail", id], buyer);
      invalidateBuyers(qc);
    },
  });
}

export function useBookBuyerTestDrive(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BookBuyerTestDriveInput): Promise<Buyer> => {
      const updated = await api<ServerBuyerLead>(`/crm/buyers/${id}/test-drive`, {
        method: "POST",
        body: input,
      });
      return toClientBuyer(updated);
    },
    onSuccess: (buyer) => {
      qc.setQueryData([...BUYERS_KEY, "detail", id], buyer);
      invalidateBuyers(qc);
      qc.invalidateQueries({ queryKey: CALENDAR_KEY });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}

export function useAddBuyerCommunication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BuyerCommunicationInput): Promise<Buyer> => {
      const updated = await api<ServerBuyerLead>(`/crm/buyers/${id}/communications`, {
        method: "POST",
        body: input,
      });
      return toClientBuyer(updated);
    },
    onSuccess: (buyer) => {
      qc.setQueryData([...BUYERS_KEY, "detail", id], buyer);
      invalidateBuyers(qc);
    },
  });
}

export function useUpdateBuyerCommunication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commId, input }: { commId: string; input: BuyerCommunicationInput }): Promise<Buyer> => {
      const updated = await api<ServerBuyerLead>(`/crm/buyers/${id}/communications/${commId}`, {
        method: "PATCH",
        body: input,
      });
      return toClientBuyer(updated);
    },
    onSuccess: (buyer) => {
      qc.setQueryData([...BUYERS_KEY, "detail", id], buyer);
      invalidateBuyers(qc);
    },
  });
}

export function useDeleteBuyerCommunication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commId: string): Promise<Buyer> => {
      const updated = await api<ServerBuyerLead>(`/crm/buyers/${id}/communications/${commId}`, {
        method: "DELETE",
      });
      return toClientBuyer(updated);
    },
    onSuccess: (buyer) => {
      qc.setQueryData([...BUYERS_KEY, "detail", id], buyer);
      invalidateBuyers(qc);
    },
  });
}

/** Convenience for "Mark as Converted" / "Mark as Dropped" buttons. */
export function useSetBuyerStage(id: string) {
  const update = useUpdateBuyer(id);
  return {
    ...update,
    mutateAsync: (stage: ServerBuyerStage) => update.mutateAsync({ stage }),
  };
}
