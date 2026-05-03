export type Campaign = {
  id: string;
  name: string;
  platform: "Google Ads" | "Meta Ads";
  status: "Active" | "Paused" | "Completed";
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  cpl: number;
  ctr: number;
  startDate: string;
  endDate: string;
  trend: { day: string; impressions: number; clicks: number; leads: number }[];
};

const buildTrend = (base: number) =>
  Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    impressions: Math.round(base * (0.8 + Math.random() * 0.5)),
    clicks: Math.round(base * 0.04 * (0.7 + Math.random() * 0.6)),
    leads: Math.round(base * 0.003 * (0.6 + Math.random() * 0.8)),
  }));

export const campaigns: Campaign[] = [
  {
    id: "C-01", name: "Spring Sale – SUVs", platform: "Google Ads", status: "Active",
    spend: 8500, impressions: 412000, clicks: 18420, leads: 342, conversions: 14,
    cpl: 24.85, ctr: 4.47, startDate: "2026-03-01", endDate: "2026-04-30",
    trend: buildTrend(28000),
  },
  {
    id: "C-02", name: "Truck Month Promo", platform: "Meta Ads", status: "Active",
    spend: 6200, impressions: 298000, clicks: 11200, leads: 218, conversions: 9,
    cpl: 28.44, ctr: 3.76, startDate: "2026-04-01", endDate: "2026-04-30",
    trend: buildTrend(20000),
  },
  {
    id: "C-03", name: "EV Awareness", platform: "Google Ads", status: "Paused",
    spend: 4800, impressions: 184000, clicks: 6420, leads: 156, conversions: 7,
    cpl: 30.77, ctr: 3.49, startDate: "2026-03-15", endDate: "2026-04-15",
    trend: buildTrend(13000),
  },
  {
    id: "C-04", name: "Year-End Clearance", platform: "Meta Ads", status: "Completed",
    spend: 10200, impressions: 612000, clicks: 24800, leads: 524, conversions: 22,
    cpl: 19.47, ctr: 4.05, startDate: "2025-12-01", endDate: "2025-12-31",
    trend: buildTrend(42000),
  },
];

export const getCampaignById = (id: string) => campaigns.find((c) => c.id === id);
