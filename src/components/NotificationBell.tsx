/**
 * Header notification bell — replaces the old decorative bell. Shows the live
 * unread count (pushed over Socket.io via socket-context, refetched on a 60s
 * safety net) and a dropdown of recent notifications. Clicking an item marks it
 * read and deep-links to the related record.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useNotificationsUnread,
  useMarkNotificationsRead,
} from "@/hooks/api/use-notifications";
import { notificationMeta, timeAgo, type AppNotification } from "@/lib/notifications-mapper";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: unread } = useNotificationsUnread();
  const { data: list, isLoading } = useNotifications(open); // load the list only when opened
  const markRead = useMarkNotificationsRead();

  const count = unread?.total ?? 0;
  const items = list?.items ?? [];

  const openItem = (n: AppNotification) => {
    if (!n.read) markRead.mutate({ ids: [n.id] });
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold text-white bg-destructive rounded-full">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-md:w-[92vw]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-3">
            {count > 0 && (
              <button
                onClick={() => markRead.mutate({ all: true })}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            <button
              onClick={() => { setOpen(false); navigate("/account/notifications"); }}
              title="Notification settings"
              aria-label="Notification settings"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <ScrollArea className="max-h-[70vh]">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-6 w-6 opacity-40" />
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const { icon: Icon, tint } = notificationMeta(n.type);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-muted/60 ${n.read ? "" : "bg-primary/5"}`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{n.title}</span>
                          {!n.read && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
