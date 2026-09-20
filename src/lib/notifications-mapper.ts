import {
  AlarmClock, Bell, CalendarClock, CalendarX, DollarSign, Handshake, Hourglass,
  LifeBuoy, MailWarning, PlugZap, ShieldCheck, Target, UserCheck, UserPlus,
  Receipt, CreditCard, CheckCircle2, AlertTriangle,
  type LucideIcon,
} from "lucide-react";

/** Client shape returned by GET /notifications (already unwrapped from the envelope). */
export interface AppNotification {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  entity: { kind: string; id: string } | null;
  link: string;
  read: boolean;
  readAt: string | null;
  actorName: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

/** Per-type presentation (icon + accent tint class). Falls back to a bell. */
const TYPE_META: Record<string, { icon: LucideIcon; tint: string }> = {
  "lead.assigned": { icon: UserPlus, tint: "text-blue-600 bg-blue-100 dark:bg-blue-950/40" },
  "lead.new": { icon: Target, tint: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40" },
  "appointment.booked": { icon: CalendarClock, tint: "text-violet-600 bg-violet-100 dark:bg-violet-950/40" },
  "appointment.updated": { icon: CalendarClock, tint: "text-violet-600 bg-violet-100 dark:bg-violet-950/40" },
  "appointment.cancelled": { icon: CalendarX, tint: "text-rose-600 bg-rose-100 dark:bg-rose-950/40" },
  "appointment.reminder": { icon: AlarmClock, tint: "text-violet-600 bg-violet-100 dark:bg-violet-950/40" },
  "sale.recorded": { icon: DollarSign, tint: "text-amber-600 bg-amber-100 dark:bg-amber-950/40" },
  "lead.negotiation": { icon: Handshake, tint: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950/40" },
  "lead.stale": { icon: Hourglass, tint: "text-orange-600 bg-orange-100 dark:bg-orange-950/40" },
  "user.invite-accepted": { icon: UserCheck, tint: "text-teal-600 bg-teal-100 dark:bg-teal-950/40" },
  "user.role-changed": { icon: ShieldCheck, tint: "text-sky-600 bg-sky-100 dark:bg-sky-950/40" },
  "support.ticket-created": { icon: LifeBuoy, tint: "text-orange-600 bg-orange-100 dark:bg-orange-950/40" },
  "ads.sync-failed": { icon: PlugZap, tint: "text-red-600 bg-red-100 dark:bg-red-950/40" },
  "system.mail-failed": { icon: MailWarning, tint: "text-red-600 bg-red-100 dark:bg-red-950/40" },
  "bhph.payment-recorded": { icon: Receipt, tint: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40" },
  "bhph.payment-due": { icon: CreditCard, tint: "text-amber-600 bg-amber-100 dark:bg-amber-950/40" },
  "bhph.payment-overdue": { icon: AlertTriangle, tint: "text-red-600 bg-red-100 dark:bg-red-950/40" },
  "bhph.loan-paid-off": { icon: CheckCircle2, tint: "text-blue-600 bg-blue-100 dark:bg-blue-950/40" },
};

export function notificationMeta(type: string): { icon: LucideIcon; tint: string } {
  return TYPE_META[type] ?? { icon: Bell, tint: "text-muted-foreground bg-muted" };
}

/** Compact relative time, e.g. "just now", "5m", "3h", "2d", else a date. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

/** Notification preference categories (mirror backend NotificationCategory). */
export const NOTIFICATION_CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "leads", label: "Leads & Sales", hint: "New leads, assignments, negotiation, follow-ups" },
  { key: "appointments", label: "Appointments", hint: "Test drives, inspections, events" },
  { key: "sales", label: "Sales", hint: "Vehicles sold, sales recorded" },
  { key: "social", label: "Social & Ads", hint: "Facebook, ad-account activity" },
  { key: "support", label: "Support", hint: "Tickets and replies" },
  { key: "system", label: "System", hint: "Account, security, ops alerts" },
];

export type ChannelPref = { inApp: boolean; email: boolean; push: boolean };
export type NotificationPrefs = Record<string, ChannelPref>;
