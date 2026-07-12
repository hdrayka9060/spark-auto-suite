import { useState } from "react";
import {
  RefreshCw, Loader2, AlertCircle, DollarSign, Eye, MousePointerClick,
  Target, TrendingUp, Percent, Plug, Trash2, CheckCircle2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimePeriodSelector } from "@/components/TimePeriodSelector";
import { PeriodPreset, rangeFromPreset } from "@/lib/period-helpers";
import { useCan } from "@/components/Can";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError } from "@/lib/api";
import {
  AdMetrics, AdsCampaignMetrics, AdsConnectionInfo, AdsPlatformMetrics, AdsProvider,
  AdsTrendPoint, ADS_STATUS_BADGE, ADS_STATUS_LABEL, PROVIDER_LABEL,
  formatInt, formatMoney, formatMoneyExact, formatPercent, formatRoas,
} from "@/lib/ads-mapper";
import {
  useAdsAnalytics, useCompleteAdsConnect, useDisconnectAds, useStartAdsConnect, useSyncAds,
} from "@/hooks/api/use-ads";

type Tab = "overview" | "google" | "meta" | "connections";

export default function Marketing() {
  const [tab, setTab] = useState<Tab>("overview");
  const [period, setPeriod] = useState(() => {
    const r = rangeFromPreset("month");
    return { preset: "month" as PeriodPreset, startDate: r.startDate, endDate: r.endDate };
  });
  const provider: AdsProvider | undefined = tab === "google" || tab === "meta" ? tab : undefined;

  const canEdit = useCan("Digital Marketing", "edit");
  const canDelete = useCan("Digital Marketing", "delete");
  const confirm = useConfirm();

  const analyticsQuery = useAdsAnalytics({
    startDate: period.startDate,
    endDate: period.endDate,
    provider,
  });
  const startConnect = useStartAdsConnect();
  const completeConnect = useCompleteAdsConnect();
  const disconnect = useDisconnectAds();
  const sync = useSyncAds();

  const data = analyticsQuery.data;
  const anyDevMode = !!(data?.devMode.google || data?.devMode.meta);

  const handleConnect = async (p: AdsProvider) => {
    try {
      const res = await startConnect.mutateAsync(p);
      if (res.devMode || !res.authUrl) {
        await completeConnect.mutateAsync({ provider: p });
        toast.success(`${PROVIDER_LABEL[p]} connected (dev mode)`);
      } else {
        sessionStorage.setItem("ads_connect_state", res.state);
        window.location.href = res.authUrl;
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't start the connection");
    }
  };

  const handleDisconnect = async (c: AdsConnectionInfo) => {
    const ok = await confirm({
      title: `Disconnect ${PROVIDER_LABEL[c.provider]}?`,
      description: `Stops syncing ${c.accountName || c.accountId}. Historical snapshots are kept.`,
      confirmText: "Disconnect",
    });
    if (!ok) return;
    try {
      await disconnect.mutateAsync(c.id);
      toast.success("Disconnected");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Disconnect failed");
    }
  };

  const handleSync = async (p?: AdsProvider) => {
    try {
      const res = await sync.mutateAsync(p);
      toast.success(`Synced ${res.rows} campaign-day row${res.rows === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Sync failed");
    }
  };

  const renderAnalytics = () => {
    if (analyticsQuery.isLoading) return <LoadingPanel />;
    if (analyticsQuery.isError) return <ErrorPanel onRetry={() => analyticsQuery.refetch()} />;
    if (!data) return null;
    return (
      <>
        {provider && (
          <ProviderStatus
            connection={data.connections.find((c) => c.provider === provider)}
            provider={provider}
            onConnect={canEdit ? () => handleConnect(provider) : undefined}
          />
        )}
        <KpiGrid m={data.summary} />
        <TrendCharts trend={data.trend} />
        {!provider && <PlatformBreakdown rows={data.byPlatform} />}
        <CampaignsTable rows={data.campaigns} />
      </>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Digital Marketing</h1>
          <p className="text-muted-foreground text-sm">Live ad performance from Google &amp; Meta</p>
        </div>
        <div className="flex items-center gap-2">
          <TimePeriodSelector
            preset={period.preset}
            rangeStart={period.startDate}
            rangeEnd={period.endDate}
            onChange={(n) =>
              setPeriod({ preset: n.preset, startDate: n.startDate, endDate: n.endDate })
            }
          />
          {canEdit && (
            <button
              onClick={() => handleSync(provider)}
              disabled={sync.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {sync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync now
            </button>
          )}
        </div>
      </div>

      {anyDevMode && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Showing <strong>sample data</strong> for{" "}
            {data?.devMode.google && "Google"}
            {data?.devMode.google && data?.devMode.meta && " & "}
            {data?.devMode.meta && "Meta"} — connect a live account (and finish API approval) to see
            real numbers.
          </span>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="google">Google Ads</TabsTrigger>
          <TabsTrigger value="meta">Meta Ads</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {renderAnalytics()}
        </TabsContent>
        <TabsContent value="google" className="space-y-6 mt-4">
          {renderAnalytics()}
        </TabsContent>
        <TabsContent value="meta" className="space-y-6 mt-4">
          {renderAnalytics()}
        </TabsContent>
        <TabsContent value="connections" className="space-y-4 mt-4">
          <ConnectionsPanel
            connections={data?.connections ?? []}
            canEdit={canEdit}
            canDelete={canDelete}
            busy={startConnect.isPending || completeConnect.isPending}
            syncing={sync.isPending}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function LoadingPanel() {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground py-16 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="stat-card text-center py-12">
      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
      <p className="text-sm text-muted-foreground mb-3">Couldn't load ad analytics.</p>
      <button onClick={onRetry} className="text-sm text-primary underline">
        Try again
      </button>
    </div>
  );
}

function KpiGrid({ m }: { m: AdMetrics }) {
  const cards = [
    { label: "Ad Spend", value: formatMoney(m.spend), icon: DollarSign, color: "bg-violet-50 text-violet-600" },
    { label: "Impressions", value: formatInt(m.impressions), icon: Eye, color: "bg-primary/10 text-primary" },
    { label: "Clicks", value: formatInt(m.clicks), icon: MousePointerClick, color: "bg-sky-50 text-sky-600" },
    { label: "CTR", value: formatPercent(m.ctr), icon: Percent, color: "bg-amber-50 text-amber-600" },
    { label: "Conversions", value: formatInt(m.conversions), icon: Target, color: "bg-emerald-50 text-emerald-600" },
    { label: "Avg. CPC", value: m.clicks ? formatMoneyExact(m.cpc) : "—", icon: DollarSign, color: "bg-rose-50 text-rose-600" },
    { label: "Cost / Conv.", value: m.conversions ? formatMoneyExact(m.costPerConversion) : "—", icon: DollarSign, color: "bg-indigo-50 text-indigo-600" },
    { label: "ROAS", value: m.spend ? formatRoas(m.roas) : "—", icon: TrendingUp, color: "bg-teal-50 text-teal-600" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="stat-card">
          <div className={`p-2 rounded-lg w-fit ${c.color} mb-2`}>
            <c.icon className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold font-display">{c.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

const fmtDay = (d: string) => (d && d.length >= 10 ? d.slice(5) : d);

function TrendCharts({ trend }: { trend: AdsTrendPoint[] }) {
  if (!trend.length) {
    return (
      <div className="stat-card">
        <p className="text-sm text-muted-foreground py-8 text-center">
          No ad activity in this date range.
        </p>
      </div>
    );
  }
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Spend (daily)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v: number) => formatMoneyExact(v)} />
            <Area type="monotone" dataKey="spend" stroke="hsl(222 60% 45%)" fill="hsl(222 60% 45% / 0.15)" strokeWidth={2} name="Spend" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Clicks &amp; Conversions (daily)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="clicks" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} name="Clicks" />
            <Line type="monotone" dataKey="conversions" stroke="hsl(152 60% 42%)" strokeWidth={2} dot={false} name="Conversions" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PlatformBreakdown({ rows }: { rows: AdsPlatformMetrics[] }) {
  if (!rows.length) return null;
  const chart = rows.map((r) => ({ platform: PROVIDER_LABEL[r.provider], spend: r.spend }));
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Spend by Platform</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="platform" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v: number) => formatMoneyExact(v)} />
            <Bar dataKey="spend" fill="hsl(222 60% 45%)" radius={[4, 4, 0, 0]} name="Spend" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="stat-card overflow-x-auto">
        <h3 className="font-display font-semibold mb-4">Platform Comparison</h3>
        <table className="data-table">
          <thead>
            <tr><th>Platform</th><th>Spend</th><th>Clicks</th><th>CTR</th><th>Conv.</th><th>ROAS</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.provider}>
                <td className="font-medium text-sm">{PROVIDER_LABEL[r.provider]}</td>
                <td className="text-sm">{formatMoneyExact(r.spend)}</td>
                <td className="text-sm">{formatInt(r.clicks)}</td>
                <td className="text-sm">{formatPercent(r.ctr)}</td>
                <td className="text-sm">{formatInt(r.conversions)}</td>
                <td className="text-sm">{r.spend ? formatRoas(r.roas) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignsTable({ rows }: { rows: AdsCampaignMetrics[] }) {
  return (
    <div className="stat-card overflow-x-auto">
      <h3 className="font-display font-semibold mb-4">Campaigns</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No campaign data in this range yet. Run a sync, or wait for ad spend to accrue.
        </p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign</th><th>Platform</th><th>Spend</th><th>Impr.</th><th>Clicks</th>
              <th>CTR</th><th>Conv.</th><th>CPC</th><th>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={`${c.provider}:${c.campaignId}`}>
                <td className="font-medium text-sm">{c.campaignName || c.campaignId || "—"}</td>
                <td className="text-sm">{PROVIDER_LABEL[c.provider]}</td>
                <td className="text-sm">{formatMoneyExact(c.spend)}</td>
                <td className="text-sm">{formatInt(c.impressions)}</td>
                <td className="text-sm">{formatInt(c.clicks)}</td>
                <td className="text-sm">{formatPercent(c.ctr)}</td>
                <td className="text-sm">{formatInt(c.conversions)}</td>
                <td className="text-sm">{c.clicks ? formatMoneyExact(c.cpc) : "—"}</td>
                <td className="text-sm">{c.spend ? formatRoas(c.roas) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProviderStatus({
  connection,
  provider,
  onConnect,
}: {
  connection?: AdsConnectionInfo;
  provider: AdsProvider;
  onConnect?: () => void;
}) {
  if (!connection || connection.status === "revoked") {
    return (
      <div className="stat-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">{PROVIDER_LABEL[provider]} not connected</p>
            <p className="text-xs text-muted-foreground">
              Connect the account to pull real analytics.
            </p>
          </div>
        </div>
        {onConnect && (
          <button
            onClick={onConnect}
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90"
          >
            Connect
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="stat-card space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium">
            {connection.accountName || connection.accountId}
          </span>
          <span className={`status-badge ${ADS_STATUS_BADGE[connection.status] ?? ""}`}>
            {ADS_STATUS_LABEL[connection.status] ?? connection.status}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {connection.lastSyncedAt
            ? `Synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
            : "Never synced"}
        </span>
      </div>
      {connection.lastError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{connection.lastError}</span>
        </div>
      )}
    </div>
  );
}

function ConnectionsPanel({
  connections,
  canEdit,
  canDelete,
  busy,
  syncing,
  onConnect,
  onDisconnect,
  onSync,
}: {
  connections: AdsConnectionInfo[];
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  syncing: boolean;
  onConnect: (p: AdsProvider) => void;
  onDisconnect: (c: AdsConnectionInfo) => void;
  onSync: (p?: AdsProvider) => void;
}) {
  const providers: AdsProvider[] = ["google", "meta"];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {providers.map((p) => {
        const conn = connections.find((c) => c.provider === p && c.status !== "revoked");
        return (
          <div key={p} className="stat-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">{PROVIDER_LABEL[p]}</h3>
              {conn && (
                <span className={`status-badge ${ADS_STATUS_BADGE[conn.status] ?? ""}`}>
                  {ADS_STATUS_LABEL[conn.status] ?? conn.status}
                </span>
              )}
            </div>

            {conn ? (
              <>
                <div className="text-sm">
                  <p className="font-medium">{conn.accountName || conn.accountId}</p>
                  <p className="text-xs text-muted-foreground">
                    Account {conn.accountId}
                    {conn.currency ? ` · ${conn.currency}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {conn.lastSyncedAt
                      ? `Last synced ${new Date(conn.lastSyncedAt).toLocaleString()}`
                      : "Never synced"}
                  </p>
                </div>
                {conn.lastError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{conn.lastError}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {canEdit && (
                    <button
                      onClick={() => onSync(p)}
                      disabled={syncing}
                      className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-60"
                    >
                      {syncing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Sync
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDisconnect(conn)}
                      className="flex items-center gap-1.5 text-sm border border-red-200 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Not connected. Connect to pull read-only {PROVIDER_LABEL[p]} analytics.
                </p>
                {canEdit ? (
                  <button
                    onClick={() => onConnect(p)}
                    disabled={busy}
                    className="flex items-center gap-2 text-sm bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-60 w-fit"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                    Connect {PROVIDER_LABEL[p]}
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">Ask an admin to connect this account.</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
