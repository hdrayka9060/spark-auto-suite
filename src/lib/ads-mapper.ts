/**
 * Client types + formatters for the read-only ad-analytics feature (Google Ads
 * + Meta Ads) shown on the Marketing tab. The backend (`/marketing/ads/*`)
 * already returns clean, derived JSON, so this is mostly type definitions +
 * display helpers — no field-bending. Pure module: no React, no api() (the
 * mapper-per-entity convention).
 */

export type AdsProvider = "google" | "meta";

export const PROVIDER_LABEL: Record<AdsProvider, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
};

/** The five raw sums + four derived ratios, as computed by the backend. */
export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number; // %
  cpc: number; // $
  costPerConversion: number; // $
  roas: number; // x
}

export interface AdsPlatformMetrics extends AdMetrics {
  provider: AdsProvider;
}

export interface AdsCampaignMetrics extends AdMetrics {
  provider: AdsProvider;
  campaignId: string;
  campaignName: string;
}

export interface AdsTrendPoint {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export interface AdsConnectionInfo {
  id: string;
  provider: AdsProvider;
  accountId: string;
  accountName: string;
  currency: string;
  status: string;
  lastSyncedAt: string | null;
  lastError: string;
}

export interface AdsAnalytics {
  range: { startDate: string; endDate: string };
  devMode: { google: boolean; meta: boolean };
  summary: AdMetrics;
  byPlatform: AdsPlatformMetrics[];
  campaigns: AdsCampaignMetrics[];
  trend: AdsTrendPoint[];
  connections: AdsConnectionInfo[];
}

/** Response of POST /marketing/ads/connect/start. */
export interface StartAdsConnectResult {
  provider: AdsProvider;
  devMode: boolean;
  authUrl: string | null;
  state: string;
}

export const ADS_STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending_account: "bg-amber-100 text-amber-700",
  expired: "bg-amber-100 text-amber-700",
  revoked: "bg-slate-100 text-slate-700",
};

export const ADS_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  pending_account: "No account selected",
  expired: "Token expired",
  revoked: "Disconnected",
};

// ── Formatters ───────────────────────────────────────────────────────────────

/** Abbreviated money for KPI tiles ($1.2K / $3.4M). */
export function formatMoney(n: number): string {
  const a = Math.abs(n ?? 0);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n ?? 0).toLocaleString()}`;
}

/** Exact money (table cells). */
export function formatMoneyExact(n: number): string {
  return `$${(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatInt(n: number): string {
  return Math.round(n ?? 0).toLocaleString();
}

export function formatPercent(n: number): string {
  return `${(n ?? 0).toFixed(2)}%`;
}

export function formatRoas(n: number): string {
  return `${(n ?? 0).toFixed(2)}x`;
}
