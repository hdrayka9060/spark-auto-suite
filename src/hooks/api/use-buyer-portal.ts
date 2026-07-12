import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  BuyerPortalData,
  ServerBuyerPortal,
  toClientBuyerPortal,
} from "@/lib/buyer-portal-mapper";

/**
 * Public buyer-portal query. Calls `GET /website/portal/:leadId` with
 * `auth: false` (no token, no 401-refresh) — the lead id in the URL is the
 * access key. A bad/expired link returns 404; we don't retry it.
 */
export function useBuyerPortal(leadId: string | undefined) {
  return useQuery({
    queryKey: ["buyer-portal", leadId],
    queryFn: async (): Promise<BuyerPortalData> => {
      const server = await api<ServerBuyerPortal>(`/website/portal/${leadId}`, {
        auth: false,
      });
      return toClientBuyerPortal(server);
    },
    enabled: Boolean(leadId),
    retry: false,
    refetchOnWindowFocus: true,
  });
}
