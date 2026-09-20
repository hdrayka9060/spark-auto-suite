import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2, Settings } from "lucide-react";
import { api } from "@/lib/api";
import {
  NOTIFICATIONS_KEY,
  useMarkNotificationsRead,
} from "@/hooks/api/use-notifications";
import {
  notificationMeta,
  timeAgo,
  type AppNotification,
  type NotificationList,
} from "@/lib/notifications-mapper";

export default function Notifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const markRead = useMarkNotificationsRead();

  const { data, fetchNextPage, hasNextPage, isFetching, isLoading } = useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, "page"],
    queryFn: ({ pageParam }) =>
      api<NotificationList>(
        `/notifications?limit=30${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5_000,
  });

  const items: AppNotification[] = data?.pages.flatMap((p) => p.items) ?? [];
  const unread = items.filter((n) => !n.read).length;

  const refresh = () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

  const openItem = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await markRead.mutateAsync({ ids: [n.id] });
        refresh();
      } catch { /* best-effort */ }
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try {
      await markRead.mutateAsync({ all: true });
      refresh();
    } catch { /* best-effort */ }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="module-title flex items-center gap-2">
            <Bell className="h-6 w-6" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAll}
            disabled={markRead.isPending || unread === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
          <button
            onClick={() => navigate("/account/notifications")}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            <Settings className="h-4 w-4" /> Preferences
          </button>
        </div>
      </div>

      <div className="stat-card p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 h-7 w-7 opacity-40" />
            No notifications yet.
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => {
              const { icon: Icon, tint } = notificationMeta(n.type);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => openItem(n)}
                    className={`flex w-full gap-3 px-4 py-3.5 text-left transition hover:bg-muted/60 ${n.read ? "" : "bg-primary/5"}`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{n.title}</span>
                        {!n.read && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                        {n.actorName ? ` · ${n.actorName}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasNextPage && (
          <div className="border-t p-3 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load older
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
