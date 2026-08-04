import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  DecodedVin,
  PaginatedServerResponse,
  ServerCreateVehiclePayload,
  ServerUpdateVehiclePayload,
  ServerVehicle,
  Vehicle,
  VehicleFormInput,
  VehicleSpendInput,
  toClientVehicle,
  toServerCreatePayload,
  vehicleStatusToServer,
} from "@/lib/vehicle-mapper";

const VEHICLES_KEY = ["vehicles"] as const;

// ── List with filters ─────────────────────────────────────────────────────

export interface VehicleListFilters {
  search?: string;
  /** Client-side capitalized status ("Sold" / "Pending" / "Unsold" / "All"). */
  status?: "All" | Vehicle["status"];
  page?: number;
  limit?: number;
  sort?: string;
}

export function useVehicles(filters: VehicleListFilters = {}) {
  const { search, status, page = 1, limit = 50, sort = "-createdAt" } = filters;
  // "Available" (no status) → 'available' sentinel so the empty-string status
  // survives query-param transport; the backend findAll translates it to ''.
  const serverStatus =
    !status || status === "All"
      ? undefined
      : status === "Available"
      ? "available"
      : vehicleStatusToServer(status);

  return useQuery({
    queryKey: [...VEHICLES_KEY, "list", { search, status, page, limit, sort }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerVehicle>>("/inventory", {
        query: { search, status: serverStatus, page, limit, sort },
      });
      return {
        ...res,
        data: res.data.map(toClientVehicle),
      };
    },
  });
}

// ── Single detail ──────────────────────────────────────────────────────────

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: [...VEHICLES_KEY, "detail", id],
    queryFn: async () => {
      const server = await api<ServerVehicle>(`/inventory/${id}`);
      return toClientVehicle(server);
    },
    enabled: Boolean(id),
  });
}

// ── Communication logs for the Activity tab ───────────────────────────────

interface ServerCommunicationLog {
  _id: string;
  channel: "email" | "sms" | "whatsapp" | "call";
  message?: string;
  summary?: string;
  createdAt: string;
}

export interface ActivityLogEntry {
  date: string;
  type: string;
  description: string;
}

const CHANNEL_LABEL: Record<ServerCommunicationLog["channel"], string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "Call",
};

export function useVehicleActivityLogs(vehicleId: string | undefined) {
  return useQuery({
    queryKey: [...VEHICLES_KEY, "logs", vehicleId],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerCommunicationLog>>(
        "/communication/logs",
        { query: { linkedVehicle: vehicleId, limit: 20 } },
      );
      return res.data.map<ActivityLogEntry>((l) => ({
        date: l.createdAt.slice(0, 10),
        type: CHANNEL_LABEL[l.channel] ?? l.channel,
        description: l.message ?? l.summary ?? "",
      }));
    },
    enabled: Boolean(vehicleId),
  });
}

// ── Per-vehicle Activity tab (views / inquiries / test drives + merged log) ─

export interface VehicleActivityLog {
  /** ISO timestamp. */ date: string;
  channel: string;
  summary: string;
  by: string;
  /** Where the entry came from — drives the source badge. */
  source: "communication" | "lead" | "buyer" | "seller" | string;
}

export interface VehicleActivity {
  views: number;
  inquiries: number;
  testDrives: number;
  logs: VehicleActivityLog[];
}

/**
 * One call backs the whole Activity tab: lifetime views (storefront opens),
 * inquiries (website-sourced leads), test drives booked, and the merged
 * communication log across the lead / buyer / seller / standalone sources.
 */
export function useVehicleActivity(vehicleId: string | undefined) {
  return useQuery({
    queryKey: [...VEHICLES_KEY, "activity", vehicleId],
    queryFn: () => api<VehicleActivity>(`/inventory/${vehicleId}/activity`),
    enabled: Boolean(vehicleId),
    staleTime: 30_000,
  });
}

// ── VIN decode (server-side NHTSA vPIC lookup) ─────────────────────────────

export function useDecodeVin() {
  return useMutation({
    mutationFn: async (args: { vin: string; year?: number }): Promise<DecodedVin> => {
      const vin = args.vin.trim().toUpperCase();
      const query = args.year ? { year: args.year } : undefined;
      return api<DecodedVin>(`/inventory/vin/${encodeURIComponent(vin)}/decode`, { query });
    },
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VehicleFormInput): Promise<Vehicle> => {
      const payload: ServerCreateVehiclePayload = toServerCreatePayload(input);
      const created = await api<ServerVehicle>("/inventory", {
        method: "POST",
        body: payload,
      });
      return toClientVehicle(created);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ServerUpdateVehiclePayload): Promise<Vehicle> => {
      const updated = await api<ServerVehicle>(`/inventory/${id}`, {
        method: "PATCH",
        body: patch,
      });
      return toClientVehicle(updated);
    },
    onSuccess: (_data, patch) => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // A status change on a vehicle ripples into accounting (sale rows),
      // leads (sibling-archive on flip → sold, closed-lead-archive on flip
      // OUT of sold) and buyers (purchases[] entries). Without this the
      // dealer has to manually reload those pages to see the cascade.
      if (patch && (patch as { status?: unknown }).status !== undefined) {
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["accounting"] });
        qc.invalidateQueries({ queryKey: ["buyers"] });
      }
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api(`/inventory/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      // Deleting a sold vehicle cascades to accounting + leads + buyers
      // (the inventory.service softDelete → cleanupSoldArtifacts path).
      qc.invalidateQueries({ queryKey: ["accounting"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["buyers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── CSV bulk upload ────────────────────────────────────────────────────────

export interface BulkUploadResult {
  created: number;
  /** How many rows had specs auto-filled from a successfully decoded VIN. */
  decoded?: number;
  errors: string[];
  totalRows?: number;
}

export function useBulkUploadVehicles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<BulkUploadResult> => {
      const formData = new FormData();
      // Backend field name is `file` (single CSV).
      formData.append("file", file);
      return api<BulkUploadResult>("/inventory/bulk-upload", {
        method: "POST",
        body: formData,
        rawBody: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_KEY }),
  });
}

// ── Image upload (multipart) ──────────────────────────────────────────────

export function useUploadVehicleImages(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]): Promise<Vehicle> => {
      const formData = new FormData();
      // Backend field name is `images` (see FilesInterceptor('images', 10)).
      for (const file of files) formData.append("images", file);
      const updated = await api<ServerVehicle>(`/inventory/${id}/images`, {
        method: "POST",
        body: formData,
        rawBody: true,
      });
      return toClientVehicle(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
    },
  });
}

// ── Vehicle spends (reconditioning cost-of-goods) ─────────────────────────

/** Add a spend to a vehicle. Backend rejects if the vehicle is already sold. */
export function useAddVehicleSpend(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VehicleSpendInput): Promise<Vehicle> => {
      const updated = await api<ServerVehicle>(`/inventory/${id}/spends`, {
        method: "POST",
        body: {
          amount: input.amount,
          category: input.category,
          description: input.description,
          date: input.date,
        },
      });
      return toClientVehicle(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** Edit a spend. Re-syncs the sale if the vehicle is already sold. */
export function useUpdateVehicleSpend(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ spendId, input }: { spendId: string; input: VehicleSpendInput }): Promise<Vehicle> => {
      const updated = await api<ServerVehicle>(`/inventory/${id}/spends/${spendId}`, {
        method: "PATCH",
        body: {
          amount: input.amount,
          category: input.category,
          description: input.description,
          date: input.date,
        },
      });
      return toClientVehicle(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // Editing an amount on an already-sold vehicle re-syncs its Sale row.
      qc.invalidateQueries({ queryKey: ["accounting"] });
    },
  });
}

/** Delete a spend by its subdocument id. Re-syncs the sale if already sold. */
export function useDeleteVehicleSpend(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spendId: string): Promise<Vehicle> => {
      const updated = await api<ServerVehicle>(`/inventory/${id}/spends/${spendId}`, {
        method: "DELETE",
      });
      return toClientVehicle(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // Deleting a spend on an already-sold vehicle re-syncs its Sale row, so
      // the accounting ledger + P&L need to refresh too.
      qc.invalidateQueries({ queryKey: ["accounting"] });
    },
  });
}

/** Remove one image (by stored path) from a vehicle's photos[]. */
export function useDeleteVehicleImage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoPath: string): Promise<Vehicle> => {
      const updated = await api<ServerVehicle>(`/inventory/${id}/images`, {
        method: "DELETE",
        body: { photoPath },
      });
      return toClientVehicle(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
    },
  });
}

/**
 * Persist a new order for a vehicle's photos[]. Pass the FULL photos list in the
 * desired order (a permutation of the current set). Array order is the display
 * order used by the admin gallery, the public storefront, the buyer portal, and
 * Facebook, so reordering here reflects everywhere.
 */
export function useReorderVehicleImages(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photos: string[]): Promise<Vehicle> => {
      const updated = await api<ServerVehicle>(`/inventory/${id}/images/order`, {
        method: "PATCH",
        body: { photos },
      });
      return toClientVehicle(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
    },
  });
}

/**
 * Count calendar events of type `test_drive` linked to this vehicle.
 * Used to populate the Engagement panel's Test Drives counter on VehicleDetail.
 *
 * The /calendar/events endpoint doesn't currently filter by linked vehicle, so
 * we fetch all test_drive events (up to 200) and filter client-side. If we ever
 * add a `vehicle` query param to the calendar controller, switch to it here.
 */
export function useVehicleTestDriveCount(vehicleId: string | undefined) {
  return useQuery({
    queryKey: [...VEHICLES_KEY, "testDrives", vehicleId],
    queryFn: async () => {
      const res = await api<{
        data: { vehicle?: { _id: string } | string | null }[];
        total: number;
      }>("/calendar/events", {
        query: { eventType: "test_drive", limit: 200 },
      });
      return res.data.filter((e) => {
        const v = e.vehicle;
        if (!v) return false;
        return typeof v === "string" ? v === vehicleId : v._id === vehicleId;
      }).length;
    },
    enabled: Boolean(vehicleId),
    staleTime: 30_000,
  });
}
