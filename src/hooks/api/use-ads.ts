import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdsAnalytics, AdsProvider, StartAdsConnectResult } from "@/lib/ads-mapper";

/**
 * Hooks for the read-only Google Ads + Meta Ads analytics on the Marketing tab.
 * Mirrors use-facebook.ts (connect start/callback, disconnect) but everything
 * here is analytics-only — there is no campaign-create mutation.
 *
 * Every mutation invalidates ["ads"] AND ["dashboard"] (the latter is the gap
 * the legacy use-campaigns hooks have — we do it right here).
 */
export const ADS_KEY = ["ads"] as const;

const invalidateAds = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ADS_KEY });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
};

export interface AdsAnalyticsParams {
  startDate?: string;
  endDate?: string;
  provider?: AdsProvider;
}

/** Aggregated analytics (KPIs + per-platform + campaigns + daily trend +
 *  connections). Pass a provider to scope every figure to one platform. */
export function useAdsAnalytics(params: AdsAnalyticsParams) {
  return useQuery({
    queryKey: [...ADS_KEY, "analytics", params],
    queryFn: async () =>
      api<AdsAnalytics>("/marketing/ads/analytics", {
        query: {
          startDate: params.startDate || undefined,
          endDate: params.endDate || undefined,
          provider: params.provider,
        },
      }),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

/** Step 1 of connect — returns devMode + the provider login URL + CSRF state. */
export function useStartAdsConnect() {
  return useMutation({
    mutationFn: async (provider: AdsProvider): Promise<StartAdsConnectResult> =>
      api<StartAdsConnectResult>("/marketing/ads/connect/start", {
        method: "POST",
        body: { provider },
      }),
  });
}

/** Step 2 of connect — exchange the OAuth code (or mint mock data in dev-mode). */
export function useCompleteAdsConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      provider: AdsProvider;
      code?: string;
      state?: string;
    }): Promise<void> => {
      await api("/marketing/ads/connect/callback", { method: "POST", body: input });
    },
    onSuccess: () => invalidateAds(qc),
  });
}

export function useDisconnectAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api(`/marketing/ads/connections/${id}`, { method: "DELETE" });
    },
    onSuccess: () => invalidateAds(qc),
  });
}

/** Refresh ad insights now (one provider, or all when provider omitted). */
export function useSyncAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider?: AdsProvider): Promise<{ rows: number }> =>
      api<{ rows: number }>("/marketing/ads/sync", {
        method: "POST",
        body: { provider },
      }),
    onSuccess: () => invalidateAds(qc),
  });
}

/** Bind / switch the ad account a connection reports on (no re-auth). */
export function useUpdateAdsConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      accountId?: string;
      accountName?: string;
      loginCustomerId?: string;
    }): Promise<void> => {
      const { id, ...body } = args;
      await api(`/marketing/ads/connections/${id}`, { method: "PATCH", body });
    },
    onSuccess: () => invalidateAds(qc),
  });
}
