import {
  Car, DollarSign, TrendingUp, Users, CalendarDays, BarChart3,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

const stats = [
  { label: "Total Vehicles", value: "247", change: "+12", up: true, icon: Car, color: "bg-primary/10 text-primary" },
  { label: "Vehicles Sold", value: "89", change: "+7", up: true, icon: BarChart3, color: "bg-emerald-50 text-emerald-600" },
  { label: "Revenue", value: "$2.4M", change: "+18%", up: true, icon: DollarSign, color: "bg-amber-50 text-amber-600" },
  { label: "Profit", value: "$680K", change: "+12%", up: true, icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
  { label: "Active Leads", value: "156", change: "-3", up: false, icon: Users, color: "bg-blue-50 text-blue-600" },
  { label: "Pending Test Drives", value: "23", change: "+5", up: true, icon: CalendarDays, color: "bg-violet-50 text-violet-600" },
];

const revenueData = [
  { month: "Jan", revenue: 180000, profit: 45000 },
  { month: "Feb", revenue: 220000, profit: 62000 },
  { month: "Mar", revenue: 195000, profit: 51000 },
  { month: "Apr", revenue: 310000, profit: 88000 },
  { month: "May", revenue: 280000, profit: 76000 },
  { month: "Jun", revenue: 350000, profit: 102000 },
  { month: "Jul", revenue: 320000, profit: 91000 },
  { month: "Aug", revenue: 410000, profit: 125000 },
  { month: "Sep", revenue: 380000, profit: 110000 },
  { month: "Oct", revenue: 290000, profit: 82000 },
  { month: "Nov", revenue: 340000, profit: 98000 },
  { month: "Dec", revenue: 420000, profit: 130000 },
];

const inventoryBreakdown = [
  { name: "SUV", value: 78, color: "#2563eb" },
  { name: "Sedan", value: 65, color: "#f59e0b" },
  { name: "Truck", value: 42, color: "#10b981" },
  { name: "Coupe", value: 35, color: "#8b5cf6" },
  { name: "Hatchback", value: 27, color: "#ef4444" },
];

const salesByMonth = [
  { month: "Jan", sold: 8 }, { month: "Feb", sold: 12 }, { month: "Mar", sold: 9 },
  { month: "Apr", sold: 15 }, { month: "May", sold: 11 }, { month: "Jun", sold: 14 },
];

const recentActivity = [
  { action: "New vehicle added", detail: "2024 BMW X5 xDrive40i", time: "2 min ago" },
  { action: "Test drive booked", detail: "Sarah M. — Tesla Model 3", time: "15 min ago" },
  { action: "Vehicle sold", detail: "2023 Mercedes C300 — $42,500", time: "1 hr ago" },
  { action: "New lead", detail: "Mike R. interested in Ford F-150", time: "2 hrs ago" },
  { action: "Payment received", detail: "BHPH #1042 — $850 installment", time: "3 hrs ago" },
  { action: "Ticket resolved", detail: "#SUP-209 — Title transfer issue", time: "4 hrs ago" },
];

export default function Dashboard() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back, John. Here's your dealership overview.</p>
        </div>
        <select className="bg-card border rounded-lg px-3 py-2 text-sm">
          <option>Last 30 days</option>
          <option>Last 7 days</option>
          <option>This quarter</option>
          <option>This year</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${s.up ? "text-emerald-600" : "text-red-500"}`}>
                {s.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold font-display">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <div className="stat-card lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Revenue & Profit</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v: number) => [`$${(v / 1000).toFixed(0)}k`]} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(222 60% 45%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory Pie */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Inventory by Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={inventoryBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {inventoryBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {inventoryBreakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Sales Bar Chart */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Monthly Sales</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="sold" fill="hsl(222 60% 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((item, i) => (
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
        </div>
      </div>
    </div>
  );
}
