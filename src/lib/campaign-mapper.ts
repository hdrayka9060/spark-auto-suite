/**
 * Campaign mapper. Backend stores aggregate metrics (impressions/clicks/leads/
 * conversions/spent); frontend wants per-campaign trend lines too. We don't
 * persist daily trend data on the backend yet, so the mapper synthesizes a
 * deterministic 14-day trend from the totals — good enough for a prototype
 * dashboard until a real ad-platform integration arrives.
 *
 * Computed fields (cpl, ctr) are derived from raw counts at read time.
 */

export type ServerCampaignPlatform = "google" | "meta" | "instagram" | "email";
export type ServerCampaignStatus = "draft" | "active" | "paused" | "completed";

export type ClientCampaignPlatform = "Google Ads" | "Meta Ads" | "Instagram" | "Email";
export type ClientCampaignStatus = "Draft" | "Active" | "Paused" | "Completed";

export interface ServerCampaign {
  _id: string;
  name: string;
  description: string;
  platform: ServerCampaignPlatform;
  status: ServerCampaignStatus;
  budget: number;
  spent: number;
  startDate?: string;
  endDate?: string;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrendPoint {
  day: string;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  platform: ClientCampaignPlatform;
  status: ClientCampaignStatus;
  budget: number;
  spend: number;
  startDate: string;
  endDate: string;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  /** Cost per Lead = spent / leads (or 0 if no leads). */
  cpl: number;
  /** Click-through-rate as a percentage = clicks / impressions * 100. */
  ctr: number;
  /** Synthesized 14-day trend from totals (deterministic, seeded by id). */
  trend: TrendPoint[];
}

export interface PlatformMetrics {
  platform: ClientCampaignPlatform;
  totalLeads: number;
  totalConversions: number;
  totalSpent: number;
  totalImpressions: number;
  totalClicks: number;
  campaignCount: number;
  cpl: number;
  ctr: number;
}

const PLATFORM_TO_CLIENT: Record<ServerCampaignPlatform, ClientCampaignPlatform> = {
  google: "Google Ads",
  meta: "Meta Ads",
  instagram: "Instagram",
  email: "Email",
};
const PLATFORM_TO_SERVER: Record<ClientCampaignPlatform, ServerCampaignPlatform> = {
  "Google Ads": "google",
  "Meta Ads": "meta",
  Instagram: "instagram",
  Email: "email",
};

const STATUS_TO_CLIENT: Record<ServerCampaignStatus, ClientCampaignStatus> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};
const STATUS_TO_SERVER: Record<ClientCampaignStatus, ServerCampaignStatus> = {
  Draft: "draft",
  Active: "active",
  Paused: "paused",
  Completed: "completed",
};

export const ALL_CAMPAIGN_PLATFORMS: ClientCampaignPlatform[] = ["Google Ads", "Meta Ads", "Instagram", "Email"];
export const ALL_CAMPAIGN_STATUSES: ClientCampaignStatus[] = ["Draft", "Active", "Paused", "Completed"];

/** A tiny seeded pseudo-RNG so each campaign gets a consistent trend across renders. */
function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function synthesizeTrend(id: string, impressions: number, clicks: number, leads: number): TrendPoint[] {
  // Seed from id chars so each campaign has its own stable trend shape.
  const seed = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = seedRand(seed || 1);
  const N = 14;
  const avgImp = impressions / N;
  const avgClk = clicks / N;
  const avgLeads = leads / N;
  return Array.from({ length: N }, (_, i) => ({
    day: `D${i + 1}`,
    impressions: Math.round(avgImp * (0.7 + rand() * 0.6)),
    clicks: Math.round(avgClk * (0.7 + rand() * 0.6)),
    leads: Math.round(avgLeads * (0.6 + rand() * 0.8)),
  }));
}

export function toClientCampaign(s: ServerCampaign): Campaign {
  const cpl = s.leads > 0 ? s.spent / s.leads : 0;
  const ctr = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0;
  return {
    id: s._id,
    name: s.name,
    description: s.description ?? "",
    platform: PLATFORM_TO_CLIENT[s.platform],
    status: STATUS_TO_CLIENT[s.status],
    budget: s.budget,
    spend: s.spent,
    startDate: s.startDate?.slice(0, 10) ?? "",
    endDate: s.endDate?.slice(0, 10) ?? "",
    impressions: s.impressions,
    clicks: s.clicks,
    leads: s.leads,
    conversions: s.conversions,
    cpl,
    ctr,
    trend: synthesizeTrend(s._id, s.impressions, s.clicks, s.leads),
  };
}

// ── Write direction ────────────────────────────────────────────────────────

export interface CampaignCreateInput {
  name: string;
  description?: string;
  platform: ClientCampaignPlatform;
  status?: ClientCampaignStatus;
  budget?: number;
  startDate?: string;
  endDate?: string;
}

export function toServerCampaignCreatePayload(input: CampaignCreateInput) {
  return {
    name: input.name,
    description: input.description,
    platform: PLATFORM_TO_SERVER[input.platform],
    status: input.status ? STATUS_TO_SERVER[input.status] : "draft",
    budget: input.budget ?? 0,
    startDate: input.startDate,
    endDate: input.endDate,
  };
}

export function campaignStatusToServer(s: ClientCampaignStatus): ServerCampaignStatus {
  return STATUS_TO_SERVER[s];
}

export function campaignPlatformToServer(p: ClientCampaignPlatform): ServerCampaignPlatform {
  return PLATFORM_TO_SERVER[p];
}

// ── Server /marketing/metrics aggregation → typed PlatformMetrics ─────────

export function toClientMetrics(server: {
  _id: ServerCampaignPlatform;
  totalLeads: number;
  totalConversions: number;
  totalSpent: number;
  totalImpressions: number;
  totalClicks: number;
  campaignCount: number;
}[]): PlatformMetrics[] {
  return server.map((row) => ({
    platform: PLATFORM_TO_CLIENT[row._id],
    totalLeads: row.totalLeads ?? 0,
    totalConversions: row.totalConversions ?? 0,
    totalSpent: row.totalSpent ?? 0,
    totalImpressions: row.totalImpressions ?? 0,
    totalClicks: row.totalClicks ?? 0,
    campaignCount: row.campaignCount ?? 0,
    cpl: row.totalLeads > 0 ? row.totalSpent / row.totalLeads : 0,
    ctr: row.totalImpressions > 0 ? (row.totalClicks / row.totalImpressions) * 100 : 0,
  }));
}

export interface PortfolioMetrics {
  totalLeads: number;
  totalConversions: number;
  totalSpent: number;
  totalImpressions: number;
  totalClicks: number;
  conversionRate: number; // conversions / leads * 100
  cpl: number;
}

export function rollupPortfolio(metrics: PlatformMetrics[]): PortfolioMetrics {
  const t = metrics.reduce(
    (acc, m) => ({
      totalLeads: acc.totalLeads + m.totalLeads,
      totalConversions: acc.totalConversions + m.totalConversions,
      totalSpent: acc.totalSpent + m.totalSpent,
      totalImpressions: acc.totalImpressions + m.totalImpressions,
      totalClicks: acc.totalClicks + m.totalClicks,
    }),
    { totalLeads: 0, totalConversions: 0, totalSpent: 0, totalImpressions: 0, totalClicks: 0 },
  );
  return {
    ...t,
    conversionRate: t.totalLeads > 0 ? (t.totalConversions / t.totalLeads) * 100 : 0,
    cpl: t.totalLeads > 0 ? t.totalSpent / t.totalLeads : 0,
  };
}
