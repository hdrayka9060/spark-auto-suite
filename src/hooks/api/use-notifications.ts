import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NotificationList, NotificationPrefs } from "@/lib/notifications-mapper";

export const NOTIFICATIONS_KEY = ["notifications"] as const;
const listKey = () => [...NOTIFICATIONS_KEY, "list"];
const unreadKey = () => [...NOTIFICATIONS_KEY, "unread"];
const prefsKey = () => [...NOTIFICATIONS_KEY, "prefs"];

/** The current user's most recent notifications (newest first). */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: listKey(),
    queryFn: () => api<NotificationList>("/notifications?limit=20"),
    enabled,
    staleTime: 5_000,
  });
}

/** Unread badge count. Socket events invalidate it live; the interval is a safety net. */
export function useNotificationsUnread(enabled = true) {
  return useQuery({
    queryKey: unreadKey(),
    queryFn: () => api<{ total: number }>("/notifications/unread-count"),
    enabled,
    refetchInterval: 60_000,
    staleTime: 5_000,
  });
}

/** Mark specific notifications (ids) or all of them read. */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids?: string[]; all?: boolean }) =>
      api<{ updated: number }>("/notifications/read", { method: "PATCH", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKey() });
      qc.invalidateQueries({ queryKey: unreadKey() });
    },
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: prefsKey(),
    queryFn: () => api<NotificationPrefs>("/notifications/prefs"),
    staleTime: 60_000,
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      api<NotificationPrefs>("/notifications/prefs", { method: "PATCH", body: prefs }),
    onSuccess: (data) => qc.setQueryData(prefsKey(), data),
  });
}
