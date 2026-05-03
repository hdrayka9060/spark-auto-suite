import { ArrowLeft, Eye, MousePointer, Users, DollarSign, Target, Percent } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { getCampaignById } from "@/data/campaigns";

const statusColors: Record<string, string> = { Active: "bg-emerald-100 text-emerald-700", Paused: "bg-amber-100 text-amber-700", Completed: "bg-blue-100 text-blue-700" };

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const c = getCampaignById(id ?? "");
  if (!c) return <div className="text-center py-20"><p>Campaign not found.</p><button onClick={() => navigate("/marketing")} className="mt-4 text-primary text-sm">Back</button></div>;

  const metrics = [
    { label: "Impressions", value: c.impressions.toLocaleString(), icon: Eye, color: "bg-blue-50 text-blue-600" },
    { label: "Clicks", value: c.clicks.toLocaleString(), icon: MousePointer, color: "bg-violet-50 text-violet-600" },
    { label: "Leads", value: c.leads.toString(), icon: Users, color: "bg-amber-50 text-amber-600" },
    { label: "Conversions", value: c.conversions.toString(), icon: Target, color: "bg-emerald-50 text-emerald-600" },
    { label: "Spend", value: `$${c.spend.toLocaleString()}`, icon: DollarSign, color: "bg-primary/10 text-primary" },
    { label: "CTR", value: `${c.ctr}%`, icon: Percent, color: "bg-orange-50 text-orange-600" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate("/marketing")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Marketing
      </button>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{c.platform} · {c.startDate} → {c.endDate}</p>
          <h1 className="module-title">{c.name}</h1>
        </div>
        <span className={`status-badge ${statusColors[c.status]}`}>{c.status}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="stat-card">
            <div className={`p-2 rounded-lg w-fit ${m.color} mb-2`}><m.icon className="h-4 w-4" /></div>
            <p className="text-xl font-bold font-display">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Impressions & Clicks (14 days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={c.trend}>
              <defs>
                <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(222 60% 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(222 60% 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="impressions" stroke="hsl(222 60% 45%)" fill="url(#impGrad)" strokeWidth={2} />
              <Line type="monotone" dataKey="clicks" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Leads Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={c.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="leads" stroke="hsl(152 60% 42%)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Performance Summary</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div><p className="text-muted-foreground text-xs">Cost per Lead</p><p className="font-display font-bold text-lg">${c.cpl.toFixed(2)}</p></div>
          <div><p className="text-muted-foreground text-xs">Cost per Click</p><p className="font-display font-bold text-lg">${(c.spend / c.clicks).toFixed(2)}</p></div>
          <div><p className="text-muted-foreground text-xs">Lead → Conversion Rate</p><p className="font-display font-bold text-lg">{((c.conversions / c.leads) * 100).toFixed(1)}%</p></div>
        </div>
      </div>
    </div>
  );
}
