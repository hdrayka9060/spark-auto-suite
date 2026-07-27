/**
 * Dashboard mapper. Backend gives raw counts + Mongo aggregation buckets;
 * frontend wants pretty formatted strings and chart-ready data with stable
 * 12-month labels (even months with no sales should appear) and a delta
 * (current vs previous period) on every KPI card.
 */

import { fmtDate } from "./period-helpers";

// ── KPI block ──────────────────────────────────────────────────────────────

export interface ServerDashboardStatBlock {
  totalVehicles: number;
  vehiclesSold: number;
  totalRevenue: number;
  // Full-cost expenses (Operational + Reconditioning + Cost-of-vehicles-sold),
  // matching the Accounting page. Components carried through for future use.
  totalExpenses: number;
  totalOperational?: number;
  totalReconditioning?: number;
  totalCostOfVehicles?: number;
  totalProfit: number;
  activeLeads: number;
  pendingTestDrives: number;
}

export interface ServerDashboardStatsResponse {
  current: ServerDashboardStatBlock;
  previous: ServerDashboardStatBlock | null;
  hasPrevious: boolean;
  range: { startDate: string | null; endDate: string | null };
}

/**
 * Delta description for a single KPI. `pct` is the percentage change as a
 * raw number (e.g. 12 → "+12%"). `abs` is the absolute difference. Direction
 * tells the UI which arrow / colour to draw.
 *
 * `available` is false when we can't compute a delta — either the user is on
 * "All Time" (no previous block) or the previous value was zero (a divide-by-
 * zero we surface as no-delta rather than infinity).
 */
export interface KpiDelta {
  available: boolean;
  pct: number;      // percentage change as a number (0..N or negative). 0 when previous is 0.
  abs: number;      // absolute difference (current − previous)
  direction: "up" | "down" | "flat";
}

export function computeDelta(current: number, previous: number | null): KpiDelta {
  if (previous === null) return { available: false, pct: 0, abs: 0, direction: "flat" };
  const abs = current - previous;
  if (previous === 0) {
    // Going from 0 to anything positive is conceptually +infinity; treating it
    // as "no comparable baseline" is more honest than a misleading huge %.
    return { available: false, pct: 0, abs, direction: abs > 0 ? "up" : abs < 0 ? "down" : "flat" };
  }
  const pct = (abs / Math.abs(previous)) * 100;
  return {
    available: true,
    pct,
    abs,
    direction: abs > 0 ? "up" : abs < 0 ? "down" : "flat",
  };
}

/** "+12.4%" / "-3.0%" / "+5" — used in KPI card chips. */
export function formatDelta(d: KpiDelta, opts?: { asPercent?: boolean; signed?: boolean }): string {
  if (!d.available) return "";
  if (opts?.asPercent === false) {
    const v = d.abs;
    const sign = opts.signed === false ? "" : v >= 0 ? "+" : "";
    return `${sign}${v.toLocaleString()}`;
  }
  const sign = d.pct >= 0 ? "+" : "";
  return `${sign}${d.pct.toFixed(d.pct >= 100 ? 0 : 1)}%`;
}

// ── Charts ─────────────────────────────────────────────────────────────────

export interface ServerRevenueProfitBucket {
  _id: { year: number; month: number };
  revenue: number;
  profit: number;
}

export interface ServerExpenseBucket {
  _id: { year: number; month: number };
  total: number;
}

export interface ServerTypeBucket {
  _id: string; // bodyType (free-text)
  count: number;
}

export interface ServerChartsResponse {
  revenueAndProfit: ServerRevenueProfitBucket[];
  vehiclesByType: ServerTypeBucket[];
  monthlyExpenses: ServerExpenseBucket[];
}

export interface RevenueProfitPoint {
  /** "Jan 2026" */ label: string;
  /** YYYY-MM key */ key: string;
  revenue: number;
  profit: number;
}

export interface MonthlyExpensePoint {
  label: string;
  key: string;
  total: number;
}

export interface TypeSlice {
  name: string;
  value: number;
  color: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Fill in the missing 12 months (oldest → newest). Always emits 12 points so
 * the recharts axis is stable across months with zero activity.
 */
function buildMonthlySeries<TBucket extends { _id: { year: number; month: number } }, TPoint>(
  server: TBucket[],
  toPoint: (bucket: TBucket | null, label: string, key: string) => TPoint,
): TPoint[] {
  const lookup = new Map<string, TBucket>(
    server.map((b) => [`${b._id.year}-${String(b._id.month).padStart(2, "0")}`, b]),
  );
  const out: TPoint[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    out.push(toPoint(lookup.get(key) ?? null, `${MONTH_NAMES[d.getMonth()]} ${year}`, key));
  }
  return out;
}

export function toRevenueAndProfitChart(server: ServerRevenueProfitBucket[]): RevenueProfitPoint[] {
  return buildMonthlySeries(server, (b, label, key) => ({
    label,
    key,
    revenue: b?.revenue ?? 0,
    profit: b?.profit ?? 0,
  }));
}

export function toMonthlyExpensesChart(server: ServerExpenseBucket[]): MonthlyExpensePoint[] {
  return buildMonthlySeries(server, (b, label, key) => ({
    label,
    key,
    total: b?.total ?? 0,
  }));
}

/**
 * Group bodyTypes into the top N + a single "Other" bucket. Stable colour
 * palette so the donut doesn't reshuffle on every refetch.
 */
const TYPE_PALETTE = ["#2563eb", "#f59e0b", "#10b981", "#a855f7", "#ef4444", "#6b7280"];
const TOP_N = 5;

export function toVehicleTypeSlices(server: ServerTypeBucket[]): TypeSlice[] {
  const sorted = [...server].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const slices: TypeSlice[] = top.map((b, i) => ({
    name: b._id || "Unknown",
    value: b.count,
    color: TYPE_PALETTE[i] ?? TYPE_PALETTE[TYPE_PALETTE.length - 1],
  }));
  if (rest.length > 0) {
    slices.push({
      name: "Other",
      value: rest.reduce((sum, b) => sum + b.count, 0),
      color: TYPE_PALETTE[TYPE_PALETTE.length - 1],
    });
  }
  return slices;
}

// ── Recent Activity feed (now sourced from the backend's `activities` log) ─

/**
 * Server-side activity row. One per mutation across the system —
 * create/update/delete/close/etc. Lives in the `activities` collection,
 * written by every feature service via ActivityService.log().
 */
export interface ServerActivity {
  _id: string;
  module: string;          // 'inventory' | 'leads' | 'accounting' | 'calendar' | 'crm-buyers' | 'crm-sellers' | 'support' | 'communication'
  action: string;          // 'created' | 'updated' | 'deleted' | 'closed' | 'archived' | 'sold' | 'status-changed' | ...
  entity: string;          // 'Vehicle' | 'Lead' | 'Sale' | 'Expense' | 'Calendar Event' | 'Buyer' | 'Seller' | 'Ticket'
  entityId?: string;
  label: string;           // pre-formatted summary
  by: string;              // actor display name (snapshot)
  byId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;       // ISO — the activity timestamp
}

export interface ActivityItem {
  /** Verb phrase ("Vehicle added", "Lead closed"). Derived from module+action. */
  action: string;
  /** The server-provided detail line, fit for display as-is. */
  detail: string;
  /** Who did it. "System" for backend-triggered cascades. */
  by: string;
  /** Which feature area — used by the UI to colour-code / icon-pick the row. */
  module: string;
  /** ISO timestamp. */
  timestamp: string;
  /** "2 min ago" / "Mar 28" relative formatter. */
  time: string;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const delta = Math.max(0, now - then);
  const min = Math.floor(delta / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Render a server activity row's `module` + `action` + `entity` triple as
 * a single verb phrase suitable for the activity card. Falls back to a
 * generic "<Entity> <action>" so unknown combinations still render cleanly.
 */
function actionPhrase(a: ServerActivity): string {
  // Most actions have a natural verb phrase; map the common ones explicitly
  // so the card reads like English rather than enum slugs.
  const ent = a.entity;
  switch (a.action) {
    case "created":     return `${ent} added`;
    case "updated":     return `${ent} updated`;
    case "deleted":     return `${ent} removed`;
    case "archived":    return `${ent} archived`;
    case "closed":      return `${ent} closed`;
    case "sold":        return `${ent} marked sold`;
    case "status-changed": return `${ent} status changed`;
    case "sale-recorded":  return "Sale recorded";
    case "test-drive-booked": return "Test drive booked";
    case "interest-added": return `${ent} added a vehicle of interest`;
    case "logged":      return "Communication logged";
    case "replied":     return "Ticket reply";
    case "resolved":    return "Ticket resolved";
    case "blocked":     return "Calendar slot blocked";
    // User / staff lifecycle. Distinct from generic 'created/updated' so the
    // dashboard reads "Staff invited" / "Invite accepted" / "Role changed"
    // rather than the duller "User created" / "User updated".
    case "invited":          return ent === "User" ? "Staff invited" : `${ent} invited`;
    case "invite-accepted":  return "Invite accepted";
    case "role-changed":     return "Role changed";
    case "spend-added":      return "Spend added";
    case "spend-updated":    return "Spend updated";
    case "spend-removed":    return "Spend removed";
    case "facebook-connected":    return "Facebook connected";
    case "facebook-disconnected": return "Facebook disconnected";
    case "published":        return `${ent} published`;
    case "listing-removed":  return "Listing removed";
    case "comment-replied":  return "Comment replied";
    case "comment-resolved": return "Comment resolved";
    case "message-sent":         return "Messenger reply sent";
    case "lead-assigned":        return "Lead assigned";
    case "lead-status-changed":  return "Lead status changed";
    case "lead-promoted":        return "Lead created from Messenger";
    case "group-posted":         return "Posted to group";
    // Marketing ads analytics (read-only Google + Meta Ads).
    case "ads-connected":        return "Ad account connected";
    case "ads-disconnected":     return "Ad account disconnected";
    case "ads-synced":           return "Ad insights synced";
    default:            return `${ent} ${a.action}`.trim();
  }
}

export function toClientActivity(server: ServerActivity[]): ActivityItem[] {
  return server.map((a) => ({
    action: actionPhrase(a),
    detail: a.label,
    by: a.by || "System",
    module: a.module,
    timestamp: a.createdAt,
    time: formatRelative(a.createdAt),
  }));
}

/**
 * CSV export for the Recent Activity card. Escapes embedded quotes the
 * Excel-friendly way (double them). The result is suitable for direct
 * Blob download with mime `text/csv`.
 */
export function activityToCsv(items: ActivityItem[]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["Module", "Action", "Detail", "By", "Timestamp", "Time"].map(esc).join(",");
  const rows = items.map((i) =>
    [i.module, i.action, i.detail, i.by, i.timestamp, i.time].map(esc).join(","),
  );
  return [header, ...rows].join("\n");
}

export function activityCsvFilename(): string {
  return `dashboard-activity-${fmtDate(new Date())}.csv`;
}

// ── KPI card formatter ─────────────────────────────────────────────────────

export function formatKpiMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
