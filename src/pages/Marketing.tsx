import { useMemo, useState } from "react";
import { TrendingUp, Users, Target, DollarSign, BarChart3, ChevronRight, Plus, X, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useNavigate } from "react-router-dom";
import { useCampaignMetrics, useCampaigns, useCreateCampaign } from "@/hooks/api/use-campaigns";
import { ApiError } from "@/lib/api";
import {
  ALL_CAMPAIGN_PLATFORMS, ALL_CAMPAIGN_STATUSES,
  ClientCampaignPlatform, ClientCampaignStatus, rollupPortfolio,
} from "@/lib/campaign-mapper";
import { toast } from "@/hooks/use-toast";
import { useCan } from "@/components/Can";

const statusColors: Record<ClientCampaignStatus, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-emerald-100 text-emerald-700",
  Paused: "bg-amber-100 text-amber-700",
  Completed: "bg-blue-100 text-blue-700",
};

function formatMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

export default function Marketing() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ClientCampaignStatus | "All">("All");
  const [platformFilter, setPlatformFilter] = useState<ClientCampaignPlatform | "All">("All");

  const campaignsQuery = useCampaigns({ status: statusFilter, platform: platformFilter });
  const metricsQuery = useCampaignMetrics();
  const createCampaign = useCreateCampaign();
  const canEdit = useCan("Digital Marketing", "edit");

  const campaigns = campaignsQuery.data?.data ?? [];
  const platformMetrics = metricsQuery.data ?? [];
  const portfolio = useMemo(() => rollupPortfolio(platformMetrics), [platformMetrics]);

  // "Leads by Platform" chart — one bar per platform from /metrics aggregation
  const leadsByPlatform = useMemo(
    () => platformMetrics.map((m) => ({
      platform: m.platform,
      leads: m.totalLeads,
      conversions: m.totalConversions,
    })),
    [platformMetrics],
  );

  // CPL per platform — line/area chart input
  const cplByPlatform = useMemo(
    () => platformMetrics.map((m) => ({ platform: m.platform, cpl: Number(m.cpl.toFixed(2)) })),
    [platformMetrics],
  );

  // Create-campaign form
  const [form, setForm] = useState({
    name: "", description: "",
    platform: "Google Ads" as ClientCampaignPlatform,
    status: "Draft" as ClientCampaignStatus,
    budget: "", startDate: "", endDate: "",
  });
  const resetForm = () => setForm({
    name: "", description: "", platform: "Google Ads", status: "Draft", budget: "", startDate: "", endDate: "",
  });

  const handleCreate = async () => {
    if (!form.name) {
      toast({ title: "Missing info", description: "Campaign name is required.", variant: "destructive" });
      return;
    }
    try {
      await createCampaign.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        platform: form.platform,
        status: form.status,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      toast({ title: "Campaign created", description: form.name });
      resetForm();
      setShowCreate(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const stats = [
    { label: "Total Leads", value: portfolio.totalLeads.toLocaleString(), icon: Users, color: "bg-primary/10 text-primary" },
    { label: "Conversion Rate", value: formatPercent(portfolio.conversionRate), icon: Target, color: "bg-emerald-50 text-emerald-600" },
    { label: "Cost Per Lead", value: portfolio.totalLeads > 0 ? formatMoney(portfolio.cpl) : "—", icon: DollarSign, color: "bg-amber-50 text-amber-600" },
    { label: "Ad Spend", value: formatMoney(portfolio.totalSpent), icon: BarChart3, color: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Digital Marketing</h1>
          <p className="text-muted-foreground text-sm">Campaign performance and lead tracking</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showCreate ? "Cancel" : "Create Campaign"}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Campaign</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Campaign name *" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as ClientCampaignPlatform })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_CAMPAIGN_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientCampaignStatus })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              {ALL_CAMPAIGN_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Budget ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} placeholder="Start" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} placeholder="End" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-3" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={createCampaign.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60">
              {createCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className={`p-2 rounded-lg w-fit ${s.color} mb-2`}><s.icon className="h-4 w-4" /></div>
            <p className="text-2xl font-bold font-display">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Leads by Platform</h3>
          {metricsQuery.isLoading ? (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-12 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : leadsByPlatform.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No campaigns yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={leadsByPlatform}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="platform" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="leads" fill="hsl(222 60% 45%)" radius={[4, 4, 0, 0]} name="Leads" />
                <Bar dataKey="conversions" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Cost per Lead by Platform</h3>
          {metricsQuery.isLoading ? (
            <div className="flex items-center justify-center text-muted-foreground gap-2 py-12 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : cplByPlatform.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No campaigns yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cplByPlatform}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="platform" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Line type="monotone" dataKey="cpl" stroke="hsl(152 60% 42%)" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground self-center">Status:</span>
        {(["All", ...ALL_CAMPAIGN_STATUSES] as (ClientCampaignStatus | "All")[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-2">Platform:</span>
        {(["All", ...ALL_CAMPAIGN_PLATFORMS] as (ClientCampaignPlatform | "All")[]).map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${platformFilter === p ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="stat-card overflow-x-auto">
        <h3 className="font-display font-semibold mb-4">Campaigns</h3>
        {campaignsQuery.isLoading && (
          <div className="flex items-center justify-center text-muted-foreground gap-2 py-8 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {!campaignsQuery.isLoading && campaigns.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No campaigns. Click "Create Campaign" to add one.</p>
        )}
        {campaigns.length > 0 && (
          <table className="data-table">
            <thead><tr><th>Campaign</th><th>Platform</th><th>Impressions</th><th>Clicks</th><th>Leads</th><th>CPL</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/marketing/${c.id}`)} className="cursor-pointer">
                  <td className="font-medium text-sm">{c.name}</td>
                  <td className="text-sm">{c.platform}</td>
                  <td className="text-sm">{c.impressions.toLocaleString()}</td>
                  <td className="text-sm">{c.clicks.toLocaleString()}</td>
                  <td className="text-sm">{c.leads}</td>
                  <td className="text-sm">{c.leads > 0 ? `$${c.cpl.toFixed(2)}` : "—"}</td>
                  <td><span className={`status-badge ${statusColors[c.status]}`}>{c.status}</span></td>
                  <td><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
