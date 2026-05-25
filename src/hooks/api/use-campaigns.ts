import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Campaign,
  CampaignCreateInput,
  ClientCampaignPlatform,
  ClientCampaignStatus,
  PlatformMetrics,
  ServerCampaign,
  campaignPlatformToServer,
  campaignStatusToServer,
  toClientCampaign,
  toClientMetrics,
  toServerCampaignCreatePayload,
} from "@/lib/campaign-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const CAMPAIGNS_KEY = ["campaigns"] as const;

export interface CampaignListFilters {
  status?: ClientCampaignStatus | "All";
  platform?: ClientCampaignPlatform | "All";
}

export function useCampaigns(filters: CampaignListFilters = {}) {
  const { status = "All", platform = "All" } = filters;
  const serverStatus = status === "All" ? undefined : campaignStatusToServer(status);
  const serverPlatform = platform === "All" ? undefined : campaignPlatformToServer(platform);

  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, "list", { status, platform }],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerCampaign>>("/marketing/campaigns", {
        query: { status: serverStatus, platform: serverPlatform, limit: 100 },
      });
      return { ...res, data: res.data.map(toClientCampaign) };
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, "detail", id],
    queryFn: async () => {
      const server = await api<ServerCampaign>(`/marketing/campaigns/${id}`);
      return toClientCampaign(server);
    },
    enabled: Boolean(id),
  });
}

export function useCampaignMetrics() {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, "metrics"],
    queryFn: async (): Promise<PlatformMetrics[]> => {
      const server = await api<{
        _id: "google" | "meta" | "instagram" | "email";
        totalLeads: number;
        totalConversions: number;
        totalSpent: number;
        totalImpressions: number;
        totalClicks: number;
        campaignCount: number;
      }[]>("/marketing/metrics");
      return toClientMetrics(server);
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampaignCreateInput): Promise<Campaign> => {
      const created = await api<ServerCampaign>("/marketing/campaigns", {
        method: "POST",
        body: toServerCampaignCreatePayload(input),
      });
      return toClientCampaign(created);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { status?: ClientCampaignStatus; budget?: number; description?: string }): Promise<Campaign> => {
      const serverPatch: Record<string, unknown> = {};
      if (patch.status !== undefined) serverPatch.status = campaignStatusToServer(patch.status);
      if (patch.budget !== undefined) serverPatch.budget = patch.budget;
      if (patch.description !== undefined) serverPatch.description = patch.description;
      const updated = await api<ServerCampaign>(`/marketing/campaigns/${id}`, {
        method: "PATCH",
        body: serverPatch,
      });
      return toClientCampaign(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useRefreshCampaignMetrics(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Campaign> => {
      const updated = await api<ServerCampaign>(`/marketing/campaigns/${id}/refresh-metrics`, {
        method: "POST",
      });
      return toClientCampaign(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}
