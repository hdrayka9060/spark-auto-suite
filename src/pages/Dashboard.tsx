import { useMemo, useState } from "react";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Briefcase, Car, CalendarDays,
  DollarSign, Download, LifeBuoy, Loader2, MessageSquare, Receipt, ShoppingCart,
  TrendingUp, UserCircle2, Users,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { useDashboardCharts, useDashboardStats, useRecentActivity } from "@/hooks/api/use-dashboard";
import {
  KpiDelta, activityCsvFilename, activityToCsv, computeDelta, formatDelta, formatKpiMoney,
} from "@/lib/dashboard-mapper";
import { useAuth } from "@/lib/auth-context";
import { TimePeriodSelector } from "@/components/TimePeriodSelector";
import { PERIOD_PRESETS, PeriodPreset } from "@/lib/period-helpers";

export default function Dashboard() {
  const { state } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;
  const greetingName = user?.firstName || "there";

  // Period selector state. KPIs filter on this range; charts always show
  // the last 12 months (seasonality is the whole point of the trend chart).
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("year");
  const [rangeStart, setRangeStart] = useState<string>(() => {
    // Default to "This Year" so the dashboard arrives with meaningful numbers
    // instead of all-time aggregates that look like noise.
    const n = new Date();
    return `${n.getFullYear()}-01-01`;
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    const n = new Date();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return `${n.getFullYear()}-${m}-${d}`;
  });

  const statsQuery = useDashboardStats({ startDate: rangeStart || undefined, endDate: rangeEnd || undefined });
  const chartsQuery = useDashboardCharts();
  const activityQuery = useRecentActivity();

  const stats = statsQuery.data;
  const current = stats?.current;
  const previous = stats?.previous ?? null;
  const revenueAndProfit = chartsQuery.data?.revenueAndProfit ?? [];
  const vehiclesByType = chartsQuery.data?.vehiclesByType ?? [];
  const monthlyExpenses = chartsQuery.data?.monthlyExpenses ?? [];
  const activity = activityQuery.data ?? [];

  // Six KPIs with computed deltas. Money fields show as %, count fields show
  // as absolute change — both feel more natural to a dealer reading the chip.
  const cards = useMemo(() => {
    if (!current) return [];
    return [
      {
        label: "Total Vehicles",
        value: current.totalVehicles.toLocaleString(),
        icon: Car,
        color: "bg-primary/10 text-primary",
        delta: computeDelta(current.totalVehicles, previous?.totalVehicles ?? null),
        deltaAsPercent: false,
      },
      {
        label: "Vehicles Sold",
        value: current.vehiclesSold.toLocaleString(),
        icon: BarChart3,
        color: "bg-emerald-50 text-emerald-600",
        delta: computeDelta(current.vehiclesSold, previous?.vehiclesSold ?? null),
        deltaAsPercent: false,
      },
      {
        label: "Revenue",
        value: formatKpiMoney(current.totalRevenue),
        icon: DollarSign,
        color: "bg-amber-50 text-amber-600",
        delta: computeDelta(current.totalRevenue, previous?.totalRevenue ?? null),
        deltaAsPercent: true,
      },
      {
        label: "Expenses",
        value: formatKpiMoney(current.totalExpenses),
        icon: Receipt,
        color: "bg-rose-50 text-rose-600",
        delta: computeDelta(current.totalExpenses, previous?.totalExpenses ?? null),
        deltaAsPercent: true,
      },
      {
        label: "Profit",
        value: formatKpiMoney(current.totalProfit),
        icon: TrendingUp,
        color: "bg-emerald-50 text-emerald-600",
        delta: computeDelta(current.totalProfit, previous?.totalProfit ?? null),
        deltaAsPercent: true,
      },
      {
        label: "Active Leads",
        value: current.activeLeads.toLocaleString(),
        icon: Users,
        color: "bg-blue-50 text-blue-600",
        delta: computeDelta(current.activeLeads, previous?.activeLeads ?? null),
        deltaAsPercent: false,
      },
      {
        label: "Pending Test Drives",
        value: current.pendingTestDrives.toLocaleString(),
        icon: CalendarDays,
        color: "bg-violet-50 text-violet-600",
        delta: computeDelta(current.pendingTestDrives, previous?.pendingTestDrives ?? null),
        deltaAsPercent: false,
      },
    ];
  }, [current, previous]);

  const periodLabel = useMemo(() => {
    if (periodPreset === "custom" && rangeStart && rangeEnd) return `${rangeStart} → ${rangeEnd}`;
    return PERIOD_PRESETS.find((p) => p.value === periodPreset)?.label ?? "All Time";
  }, [periodPreset, rangeStart, rangeEnd]);

  const downloadActivity = () => {
    // Generate a Blob client-side rather than hitting an API; the activity
    // feed is already assembled in memory and the CSV is small (~10 rows).
    const csv = activityToCsv(activity);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activityCsvFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back, {greetingName}. Here's your dealership overview ·{" "}
            <span className="font-medium">{periodLabel}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <TimePeriodSelector
            preset={periodPreset}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onChange={({ preset, startDate, endDate }) => {
              setPeriodPreset(preset);
              setRangeStart(startDate);
              setRangeEnd(endDate);
            }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
        {statsQuery.isLoading && <SkeletonCards />}
        {statsQuery.error && (
          <div className="col-span-full stat-card text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {statsQuery.error instanceof Error ? statsQuery.error.message : "Could not load stats"}
          </div>
        )}
        {cards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            color={c.color}
            delta={c.delta}
            deltaAsPercent={c.deltaAsPercent}
            hasPrevious={!!previous}
          />
        ))}
      </div>

      {/* Charts Row 1 — Revenue & Profit + Inventory by Type */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Revenue &amp; Profit ($K)</h3>
          {chartsQuery.isLoading ? (
            <ChartLoading />
          ) : revenueAndProfit.every((m) => m.revenue === 0 && m.profit === 0) ? (
            <EmptyChartMessage text="No sales yet. Record a sale on the Accounting page." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueAndProfit}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.split(" ")[0] /* just the month abbrev */}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(222 60% 45%)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(38 92% 50%)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Inventory by Type</h3>
          {chartsQuery.isLoading ? (
            <ChartLoading />
          ) : vehiclesByType.length === 0 ? (
            <EmptyChartMessage text="No inventory yet." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={vehiclesByType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {vehiclesByType.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2 justify-center">
                {vehiclesByType.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    {item.name} ({item.value})
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts Row 2 — Monthly Expenses + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Monthly Total Expenses</h3>
          <p className="text-xs text-muted-foreground -mt-3 mb-3">Operating + reconditioning + cost of vehicles sold</p>
          {chartsQuery.isLoading ? (
            <ChartLoading />
          ) : monthlyExpenses.every((m) => m.total === 0) ? (
            <EmptyChartMessage text="No expenses recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyExpenses}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis
                  dataKey="label"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.split(" ")[0]}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="total" name="Expenses" fill="hsl(222 60% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Recent Activity</h3>
            <button
              onClick={downloadActivity}
              disabled={activity.length === 0}
              className="flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              title={activity.length === 0 ? "No activity to export" : "Download as CSV"}
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
          {activityQuery.isLoading ? (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No activity yet. Things will show up here as you use the app.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {activity.map((item, i) => {
                const { Icon, badgeCls } = ACTIVITY_MODULE_STYLES[item.module] ?? ACTIVITY_MODULE_STYLES.default;
                return (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className={`p-1.5 rounded-md shrink-0 ${badgeCls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">by {item.by}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">{item.time}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: typeof Receipt;
  color: string;
  delta: KpiDelta;
  deltaAsPercent: boolean;
  hasPrevious: boolean;
}

/**
 * KPI card with an optional delta chip in the top-right. Chip is hidden when:
 *   - the user is on All Time (no previous block to compare)
 *   - the previous value was 0 (computeDelta marks it unavailable to avoid
 *     infinity), so a "+infinity%" arrow would mislead the dealer
 */
function KpiCard({ label, value, icon: Icon, color, delta, deltaAsPercent, hasPrevious }: KpiCardProps) {
  const showDelta = hasPrevious && delta.available;
  const text = showDelta ? formatDelta(delta, { asPercent: deltaAsPercent }) : "";
  const deltaCls =
    delta.direction === "up"
      ? "text-emerald-600 bg-emerald-50"
      : delta.direction === "down"
      ? "text-red-600 bg-red-50"
      : "text-muted-foreground bg-muted";
  const Arrow =
    delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : null;

  return (
    <div className="stat-card relative">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg w-fit ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        {showDelta && (
          <span className={`flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded ${deltaCls}`}>
            {Arrow && <Arrow className="h-3 w-3" />}
            {text}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/**
 * Module → icon + colored badge classname. Keeps the activity card scannable
 * by colour-coding rows: a sale is amber, a vehicle change is blue, a lead
 * move is violet, etc. Unknown modules fall through to the generic blue dot.
 */
const ACTIVITY_MODULE_STYLES: Record<
  string,
  { Icon: typeof Receipt; badgeCls: string }
> = {
  inventory:     { Icon: Car,           badgeCls: "bg-blue-100 text-blue-700" },
  leads:         { Icon: Briefcase,     badgeCls: "bg-violet-100 text-violet-700" },
  accounting:    { Icon: DollarSign,    badgeCls: "bg-amber-100 text-amber-700" },
  calendar:      { Icon: CalendarDays,  badgeCls: "bg-emerald-100 text-emerald-700" },
  "crm-buyers":  { Icon: ShoppingCart,  badgeCls: "bg-sky-100 text-sky-700" },
  "crm-sellers": { Icon: UserCircle2,   badgeCls: "bg-teal-100 text-teal-700" },
  support:       { Icon: LifeBuoy,      badgeCls: "bg-rose-100 text-rose-700" },
  communication: { Icon: MessageSquare, badgeCls: "bg-indigo-100 text-indigo-700" },
  default:       { Icon: Receipt,       badgeCls: "bg-muted text-muted-foreground" },
};

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="stat-card animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-muted mb-3" />
          <div className="h-6 w-20 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted mt-2" />
        </div>
      ))}
    </>
  );
}

function ChartLoading() {
  return (
    <div className="flex items-center justify-center text-muted-foreground gap-2 py-16 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

function EmptyChartMessage({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-16 text-center">{text}</p>;
}
