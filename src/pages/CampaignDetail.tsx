import { ArrowLeft, Eye, MousePointer, Users, DollarSign, Target, Percent, Loader2, AlertCircle, RefreshCw, Pause, Play, CheckCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useCampaign, useRefreshCampaignMetrics, useUpdateCampaign } from "@/hooks/api/use-campaigns";
import { ApiError } from "@/lib/api";
import { ClientCampaignStatus } from "@/lib/campaign-mapper";
import { toast } from "@/hooks/use-toast";

const statusColors: Record<ClientCampaignStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-emerald-100 text-emerald-700",
  Paused: "bg-amber-100 text-amber-700",
  Completed: "bg-blue-100 text-blue-700",
};

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const campaignQuery = useCampaign(id);
  const updateCampaign = useUpdateCampaign(id ?? "");
  const refreshMetrics = useRefreshCampaignMetrics(id ?? "");

  if (campaignQuery.isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={() => navigate("/marketing")} />
        <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading campaign…
        </div>
      </div>
    );
  }

  if (campaignQuery.error || !campaignQuery.data) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={() => navigate("/marketing")} />
        <div className="stat-card text-center py-12">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">
            {campaignQuery.error instanceof Error ? campaignQuery.error.message : "Campaign not found."}
          </p>
        </div>
      </div>
    );
  }

  const c = campaignQuery.data;

  const setStatus = async (status: ClientCampaignStatus) => {
    try {
      await updateCampaign.mutateAsync({ status });
      toast({ title: "Campaign updated", description: status });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Update failed";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  };

  const doRefresh = async () => {
    try {
      await refreshMetrics.mutateAsync();
      toast({ title: "Metrics refreshed" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not refresh";
      toast({ title: "Refresh failed", description: msg, variant: "destructive" });
    }
  };

  const metrics = [
    { label: "Impressions", value: c.impressions.toLocaleString(), icon: Eye, color: "bg-blue-50 text-blue-600" },
    { label: "Clicks", value: c.clicks.toLocaleString(), icon: MousePointer, color: "bg-violet-50 text-violet-600" },
    { label: "Leads", value: c.leads.toString(), icon: Users, color: "bg-amber-50 text-amber-600" },
    { label: "Conversions", value: c.conversions.toString(), icon: Target, color: "bg-emerald-50 text-emerald-600" },
    { label: "Spend", value: `$${c.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "bg-primary/10 text-primary" },
    { label: "CTR", value: `${c.ctr.toFixed(2)}%`, icon: Percent, color: "bg-orange-50 text-orange-600" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <BackBtn onClick={() => navigate("/marketing")} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{c.platform}{c.startDate && ` · ${c.startDate}`}{c.endDate && ` → ${c.endDate}`}</p>
          <h1 className="module-title">{c.name}</h1>
          {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`status-badge ${statusColors[c.status]}`}>{c.status}</span>
          {c.status === "Draft" && (
            <button onClick={() => setStatus("Active")} disabled={updateCampaign.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 disabled:opacity-60">
              <Play className="h-3.5 w-3.5" /> Activate
            </button>
          )}
          {c.status === "Active" && (
            <button onClick={() => setStatus("Paused")} disabled={updateCampaign.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-60">
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          )}
          {c.status === "Paused" && (
            <button onClick={() => setStatus("Active")} disabled={updateCampaign.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 disabled:opacity-60">
              <Play className="h-3.5 w-3.5" /> Resume
            </button>
          )}
          {(c.status === "Active" || c.status === "Paused") && (
            <button onClick={() => setStatus("Completed")} disabled={updateCampaign.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-60">
              <CheckCircle className="h-3.5 w-3.5" /> Complete
            </button>
          )}
          <button onClick={doRefresh} disabled={refreshMetrics.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border rounded-lg hover:bg-muted disabled:opacity-60">
            {refreshMetrics.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh Metrics
          </button>
        </div>
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
          <h3 className="font-display font-semibold mb-4">Impressions & Clicks (14-day trend)</h3>
          <p className="text-[10px] text-muted-foreground -mt-3 mb-2">Synthesized from totals until real ad-platform integration lands.</p>
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
          <h3 className="font-display font-semibold mb-4">Leads Trend (14-day)</h3>
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
        <div className="grid sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Cost per Lead</p>
            <p className="font-display font-bold text-lg">{c.leads > 0 ? `$${c.cpl.toFixed(2)}` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Cost per Click</p>
            <p className="font-display font-bold text-lg">{c.clicks > 0 ? `$${(c.spend / c.clicks).toFixed(2)}` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Lead → Conversion</p>
            <p className="font-display font-bold text-lg">{c.leads > 0 ? `${((c.conversions / c.leads) * 100).toFixed(1)}%` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Budget Used</p>
            <p className="font-display font-bold text-lg">{c.budget > 0 ? `${((c.spend / c.budget) * 100).toFixed(0)}%` : "—"}</p>
            {c.budget > 0 && <p className="text-[10px] text-muted-foreground">of ${c.budget.toLocaleString()}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to Marketing
    </button>
  );
}
