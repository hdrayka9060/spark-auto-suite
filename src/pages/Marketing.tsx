import { TrendingUp, Users, Target, DollarSign, BarChart3, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const stats = [
  { label: "Total Leads", value: "1,240", change: "+18%", icon: Users, color: "bg-primary/10 text-primary" },
  { label: "Conversion Rate", value: "4.2%", change: "+0.8%", icon: Target, color: "bg-emerald-50 text-emerald-600" },
  { label: "Cost Per Lead", value: "$24", change: "-$3", icon: DollarSign, color: "bg-amber-50 text-amber-600" },
  { label: "Ad Spend", value: "$29.7K", change: "+12%", icon: BarChart3, color: "bg-violet-50 text-violet-600" },
];

const campaignData = [
  { name: "Week 1", google: 120, meta: 85 },
  { name: "Week 2", google: 145, meta: 102 },
  { name: "Week 3", google: 98, meta: 130 },
  { name: "Week 4", google: 168, meta: 115 },
];

const campaigns = [
  { name: "Spring Sale – SUVs", platform: "Google Ads", spend: 8500, leads: 342, conversions: 14, cpl: 24.85, status: "Active" },
  { name: "Truck Month Promo", platform: "Meta Ads", spend: 6200, leads: 218, conversions: 9, cpl: 28.44, status: "Active" },
  { name: "EV Awareness", platform: "Google Ads", spend: 4800, leads: 156, conversions: 7, cpl: 30.77, status: "Paused" },
  { name: "Year-End Clearance", platform: "Meta Ads", spend: 10200, leads: 524, conversions: 22, cpl: 19.47, status: "Completed" },
];

const statusColors: Record<string, string> = { Active: "bg-emerald-100 text-emerald-700", Paused: "bg-amber-100 text-amber-700", Completed: "bg-blue-100 text-blue-700" };

export default function Marketing() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Digital Marketing</h1>
          <p className="text-muted-foreground text-sm">Campaign performance and lead tracking</p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Create Campaign</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className={`p-2 rounded-lg w-fit ${s.color} mb-2`}><s.icon className="h-4 w-4" /></div>
            <p className="text-2xl font-bold font-display">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            <p className="text-xs text-emerald-600 font-medium">{s.change}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Leads by Platform (Weekly)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={campaignData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="google" fill="hsl(222 60% 45%)" radius={[4, 4, 0, 0]} name="Google" />
              <Bar dataKey="meta" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} name="Meta" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Conversion Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[{ w: "W1", rate: 3.2 }, { w: "W2", rate: 3.8 }, { w: "W3", rate: 4.1 }, { w: "W4", rate: 4.2 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="w" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="hsl(152 60% 42%)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Campaigns</h3>
        <table className="data-table">
          <thead><tr><th>Campaign</th><th>Platform</th><th>Spend</th><th>Leads</th><th>Conversions</th><th>CPL</th><th>Status</th></tr></thead>
          <tbody>
            {campaigns.map((c, i) => (
              <tr key={i}>
                <td className="font-medium text-sm">{c.name}</td>
                <td className="text-sm">{c.platform}</td>
                <td className="text-sm">${c.spend.toLocaleString()}</td>
                <td className="text-sm">{c.leads}</td>
                <td className="text-sm">{c.conversions}</td>
                <td className="text-sm">${c.cpl.toFixed(2)}</td>
                <td><span className={`status-badge ${statusColors[c.status]}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
