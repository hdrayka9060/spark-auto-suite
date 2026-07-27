import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ClientSellerStatus,
  Seller,
  SellerCommunicationChannel,
  SellerFormInput,
  SellerUpdateInput,
  SellerVehicleFormInput,
  ServerSellerLead,
  getSellerStageQuery,
  toClientSeller,
  toServerSellerCreatePayload,
  toServerSellerUpdatePayload,
  toServerVehiclePayload,
} from "@/lib/seller-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const SELLERS_KEY = ["sellers"] as const;
const VEHICLES_KEY = ["vehicles"] as const;

export interface SellerListFilters {
  search?: string;
  status?: ClientSellerStatus | "All";
}

export function useSellers(filters: SellerListFilters = {}) {
  const { search, status = "All" } = filters;
  const serverStage = getSellerStageQuery(status);

  return useQuery({
    queryKey: [...SELLERS_KEY, "list", { search, status }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerSellerLead>>("/crm/sellers", {
        query: { search, stage: serverStage, limit: 100 },
      });
      const all = res.data.map(toClientSeller);
      const filtered = status === "Active" ? all.filter((s) => s.status === "Active") : all;
      return { ...res, data: filtered };
    },
  });
}

export function useSeller(id: string | undefined) {
  return useQuery({
    queryKey: [...SELLERS_KEY, "detail", id],
    queryFn: async () => {
      const server = await api<ServerSellerLead>(`/crm/sellers/${id}`);
      return toClientSeller(server);
    },
    enabled: Boolean(id),
  });
}

/** Invalidate both seller + vehicle caches; used by any mutation that touches inventory. */
function invalidateSellerAndInventory(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: SELLERS_KEY });
  qc.invalidateQueries({ queryKey: VEHICLES_KEY });
}

export function useCreateSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SellerFormInput): Promise<Seller> => {
      const created = await api<ServerSellerLead>("/crm/sellers", {
        method: "POST",
        body: toServerSellerCreatePayload(input),
      });
      return toClientSeller(created);
    },
    // Vehicles may have been created as part of the seller create, so refresh inventory too.
    onSuccess: () => invalidateSellerAndInventory(qc),
  });
}

export function useUpdateSeller(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SellerUpdateInput): Promise<Seller> => {
      const updated = await api<ServerSellerLead>(`/crm/sellers/${id}`, {
        method: "PATCH",
        body: toServerSellerUpdatePayload(input),
      });
      return toClientSeller(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SELLERS_KEY }),
  });
}

export function useDeleteSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/crm/sellers/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SELLERS_KEY }),
  });
}

/**
 * Create a new vehicle in inventory and link it to an existing seller.
 * The backend returns both the refreshed seller AND the freshly-created
 * vehicle, so we never have to guess "which one in the array is new" —
 * critical for the image upload chain.
 */
interface AddSellerVehicleResponse {
  seller: ServerSellerLead;
  vehicle: { _id: string };
}

export function useAddSellerVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SellerVehicleFormInput): Promise<{ seller: Seller; newVehicleId: string }> => {
      const res = await api<AddSellerVehicleResponse>(`/crm/sellers/${id}/vehicles`, {
        method: "POST",
        body: toServerVehiclePayload(input),
      });
      return {
        seller: toClientSeller(res.seller),
        newVehicleId: res.vehicle?._id ?? "",
      };
    },
    onSuccess: () => invalidateSellerAndInventory(qc),
  });
}

/**
 * POST images to a freshly-created vehicle. Used in both seller flows so the
 * "Add Vehicle" dialog (and the multi-vehicle seller create form) can attach
 * photos after the vehicle row exists in inventory.
 */
export async function uploadVehicleImages(vehicleId: string, files: File[]): Promise<void> {
  if (!files.length || !vehicleId) return;
  const formData = new FormData();
  for (const file of files) formData.append("images", file);
  await api(`/inventory/${vehicleId}/images`, { method: "POST", body: formData, rawBody: true });
}

/** Remove the seller↔vehicle link (vehicle stays in inventory). */
export function useRemoveSellerVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vehicleId: string): Promise<Seller> => {
      const updated = await api<ServerSellerLead>(
        `/crm/sellers/${id}/vehicles/${vehicleId}`,
        { method: "DELETE" },
      );
      return toClientSeller(updated);
    },
    onSuccess: () => invalidateSellerAndInventory(qc),
  });
}

export interface ScheduleInspectionInput {
  inspectionDate: string;
  notes?: string;
  vehicleId?: string;
  assignedTo?: string;
}

export function useScheduleInspection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInspectionInput): Promise<Seller> => {
      const updated = await api<ServerSellerLead>(`/crm/sellers/${id}/inspection`, {
        method: "POST",
        body: input,
      });
      return toClientSeller(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SELLERS_KEY }),
  });
}

export function useLogSellerCommunication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channel, message }: { channel: SellerCommunicationChannel; message: string }): Promise<Seller> => {
      const updated = await api<ServerSellerLead>(`/crm/sellers/${id}/communicate`, {
        method: "POST",
        body: { channel, message },
      });
      return toClientSeller(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SELLERS_KEY }),
  });
}

/** Edit a logged communication's message (and/or channel). */
export function useUpdateSellerCommunication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commId, message, channel }: { commId: string; message?: string; channel?: SellerCommunicationChannel }): Promise<Seller> => {
      const updated = await api<ServerSellerLead>(`/crm/sellers/${id}/communicate/${commId}`, {
        method: "PATCH",
        body: { message, channel },
      });
      return toClientSeller(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SELLERS_KEY }),
  });
}

/** Delete a single logged communication entry. */
export function useDeleteSellerCommunication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commId: string): Promise<Seller> => {
      const updated = await api<ServerSellerLead>(`/crm/sellers/${id}/communicate/${commId}`, {
        method: "DELETE",
      });
      return toClientSeller(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SELLERS_KEY }),
  });
}
