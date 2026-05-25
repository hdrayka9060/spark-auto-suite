import {
  Car, DollarSign, TrendingUp, Users, CalendarDays, BarChart3, Loader2, AlertCircle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { useDashboardCharts, useDashboardStats, useRecentActivity } from "@/hooks/api/use-dashboard";
import { formatKpiMoney } from "@/lib/dashboard-mapper";
import { useAuth } from "@/lib/auth-context";

export default function Dashboard() {
  const { state } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;
  const greetingName = user?.firstName || "there";

  const statsQuery = useDashboardStats();
  const chartsQuery = useDashboardCharts();
  const activityQuery = useRecentActivity();

  const s = statsQuery.data;
  const monthlySales = chartsQuery.data?.monthlySales ?? [];
  const vehiclesByStatus = chartsQuery.data?.vehiclesByStatus ?? [];
  const leadsByStage = chartsQuery.data?.leadsByStage ?? [];
  const activity = activityQuery.data ?? [];

  const cards = s
    ? [
        { label: "Total Vehicles", value: s.totalVehicles.toLocaleString(), icon: Car, color: "bg-primary/10 text-primary" },
        { label: "Vehicles Sold", value: s.vehiclesSold.toLocaleString(), icon: BarChart3, color: "bg-emerald-50 text-emerald-600" },
        { label: "Revenue (Total)", value: formatKpiMoney(s.totalRevenue), icon: DollarSign, color: "bg-amber-50 text-amber-600" },
        { label: "Profit (This Month)", value: formatKpiMoney(s.monthlyProfit), icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
        { label: "Active Leads", value: s.totalLeads.toLocaleString(), icon: Users, color: "bg-blue-50 text-blue-600" },
        { label: "Pending Test Drives", value: s.pendingTestDrives.toLocaleString(), icon: CalendarDays, color: "bg-violet-50 text-violet-600" },
      ]
    : [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back, {greetingName}. Here's your dealership overview.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsQuery.isLoading && (
          <SkeletonCards />
        )}
        {statsQuery.error && (
          <div className="col-span-full stat-card text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {statsQuery.error instanceof Error ? statsQuery.error.message : "Could not load stats"}
          </div>
        )}
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className={`p-2 rounded-lg w-fit ${c.color} mb-3`}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold font-display">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Sales Revenue (last 6 months)</h3>
          {chartsQuery.isLoading ? (
            <ChartLoading />
          ) : monthlySales.every((m) => m.revenue === 0) ? (
            <EmptyChartMessage text="No sales yet. Record a sale on the Accounting page." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(222 60% 45%)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Inventory by Status</h3>
          {chartsQuery.isLoading ? (
            <ChartLoading />
          ) : vehiclesByStatus.length === 0 ? (
            <EmptyChartMessage text="No inventory yet." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={vehiclesByStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {vehiclesByStatus.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {vehiclesByStatus.map((item) => (
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

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Buyer Pipeline</h3>
          {chartsQuery.isLoading ? (
            <ChartLoading />
          ) : leadsByStage.length === 0 ? (
            <EmptyChartMessage text="No buyers in the pipeline yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {leadsByStage.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Recent Activity</h3>
          {activityQuery.isLoading ? (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No activity yet. Things will show up here as you use the app.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
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
