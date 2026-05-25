import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  DealerSettings, DealerSettingsUpdate, NotificationPrefs, ServerDealerSettings, toClientSettings,
} from "@/lib/settings-mapper";

const SETTINGS_KEY = ["settings"] as const;

export function useDealerSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const server = await api<ServerDealerSettings>("/settings");
      return toClientSettings(server);
    },
  });
}

export function useUpdateDealerSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: DealerSettingsUpdate): Promise<DealerSettings> => {
      const updated = await api<ServerDealerSettings>("/settings", {
        method: "PATCH",
        body: patch,
      });
      return toClientSettings(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs): Promise<DealerSettings> => {
      const updated = await api<ServerDealerSettings>("/settings/notifications", {
        method: "PATCH",
        body: prefs,
      });
      return toClientSettings(updated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
