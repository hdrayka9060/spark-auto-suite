/**
 * Dashboard mapper. Backend gives raw counts + Mongo aggregation buckets;
 * frontend wants pretty formatted strings and chart-ready data with stable
 * 6-month labels (even months with no sales should appear).
 */

export interface ServerDashboardStats {
  totalVehicles: number;
  vehiclesSold: number;
  pendingTestDrives: number;
  totalLeads: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  totalRevenue: number;
}

export interface ServerMonthlySalesBucket {
  _id: { year: number; month: number };
  revenue: number;
  count: number;
}

export interface ServerStatusBucket {
  _id: string; // sold | unsold | pending OR buyer-lead stage
  count: number;
}

export interface ServerChartsResponse {
  monthlySales: ServerMonthlySalesBucket[];
  vehiclesByStatus: ServerStatusBucket[];
  leadsByStage: ServerStatusBucket[];
}

export interface MonthlyChartPoint {
  /** "Jan 2026" */
  label: string;
  /** YYYY-MM key for sorting */
  key: string;
  revenue: number;
  count: number;
}

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
  rawKey: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const VEHICLE_STATUS_COLORS: Record<string, string> = {
  unsold: "#2563eb",   // blue
  pending: "#f59e0b",  // amber
  sold: "#10b981",     // emerald
};

const VEHICLE_STATUS_LABELS: Record<string, string> = {
  unsold: "Available",
  pending: "Pending",
  sold: "Sold",
};

const LEAD_STAGE_COLORS: Record<string, string> = {
  new: "#3b82f6",
  contacted: "#8b5cf6",
  test_drive: "#f59e0b",
  negotiation: "#fb923c",
  purchased: "#10b981",
  lost: "#9ca3af",
};

const LEAD_STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  test_drive: "Test Drive",
  negotiation: "Negotiation",
  purchased: "Purchased",
  lost: "Lost",
};

/** Fill in missing months for the last 6 (oldest → newest), even when revenue is 0. */
export function toMonthlySalesChart(server: ServerMonthlySalesBucket[]): MonthlyChartPoint[] {
  const lookup = new Map<string, ServerMonthlySalesBucket>(
    server.map((b) => [`${b._id.year}-${String(b._id.month).padStart(2, "0")}`, b]),
  );
  const out: MonthlyChartPoint[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const bucket = lookup.get(key);
    out.push({
      key,
      label: `${MONTH_NAMES[d.getMonth()]} ${year}`,
      revenue: bucket?.revenue ?? 0,
      count: bucket?.count ?? 0,
    });
  }
  return out;
}

export function toVehicleStatusSlices(server: ServerStatusBucket[]): StatusSlice[] {
  return server.map((b) => ({
    rawKey: b._id,
    name: VEHICLE_STATUS_LABELS[b._id] ?? b._id,
    value: b.count,
    color: VEHICLE_STATUS_COLORS[b._id] ?? "#6b7280",
  }));
}

export function toLeadStageSlices(server: ServerStatusBucket[]): StatusSlice[] {
  return server.map((b) => ({
    rawKey: b._id,
    name: LEAD_STAGE_LABELS[b._id] ?? b._id,
    value: b.count,
    color: LEAD_STAGE_COLORS[b._id] ?? "#6b7280",
  }));
}

// ── Recent Activity merge (no backend endpoint; client builds from other sources) ─

export interface ActivityItem {
  action: string;
  detail: string;
  timestamp: string; // ISO
  time: string; // "2 min ago" / "Mar 28"
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

export interface ActivitySources {
  sales: { salePrice: number; vehicleTitle: string; buyerName: string; saleDate: string; createdAt: string }[];
  leads: { _id: string; buyer?: { buyerName: string } | string; vehicle?: { title: string } | string; createdAt: string }[];
  calendar: { title: string; customerName: string; eventType: string; startDateTime: string }[];
  tickets: { subject: string; raisedByName: string; status: string; createdAt: string }[];
}

export function buildRecentActivity(src: ActivitySources): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const s of src.sales.slice(0, 5)) {
    const ts = s.saleDate ?? s.createdAt;
    items.push({
      action: "Vehicle sold",
      detail: `${s.vehicleTitle} — $${s.salePrice.toLocaleString()} (${s.buyerName})`,
      timestamp: ts,
      time: formatRelative(ts),
    });
  }

  for (const l of src.leads.slice(0, 5)) {
    const buyer = typeof l.buyer === "string" || !l.buyer ? null : l.buyer;
    const vehicle = typeof l.vehicle === "string" || !l.vehicle ? null : l.vehicle;
    items.push({
      action: "New lead",
      detail: `${buyer?.buyerName ?? "Someone"} interested in ${vehicle?.title ?? "a vehicle"}`,
      timestamp: l.createdAt,
      time: formatRelative(l.createdAt),
    });
  }

  for (const e of src.calendar.slice(0, 5)) {
    const label = e.eventType === "test_drive" ? "Test drive booked" : e.eventType === "inspection" ? "Inspection scheduled" : "Calendar event";
    items.push({
      action: label,
      detail: `${e.customerName || e.title}`,
      timestamp: e.startDateTime,
      time: formatRelative(e.startDateTime),
    });
  }

  for (const t of src.tickets.slice(0, 5)) {
    const status = t.status === "open" ? "Ticket opened" : t.status === "resolved" ? "Ticket resolved" : "Ticket updated";
    items.push({
      action: status,
      detail: `${t.subject} (${t.raisedByName})`,
      timestamp: t.createdAt,
      time: formatRelative(t.createdAt),
    });
  }

  // Sort newest-first, top 10
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items.slice(0, 10);
}

// ── KPI card formatter ─────────────────────────────────────────────────────

export function formatKpiMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
