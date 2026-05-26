import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ServerActivity, ServerChartsResponse, ServerDashboardStatsResponse,
  toClientActivity, toMonthlyExpensesChart, toRevenueAndProfitChart, toVehicleTypeSlices,
} from "@/lib/dashboard-mapper";

const DASHBOARD_KEY = ["dashboard"] as const;

// Live-update knobs. Tuned for "feels real-time without hammering the API":
//   - stats: KPI numbers change with every sale/lead/expense; poll often.
//   - charts: monthly aggregates rarely shift inside a single session; poll
//     less often so we don't recompute big aggregations needlessly.
//   - activity: most user-facing real-time signal — what's HAPPENING — so
//     poll the fastest.
// All three default to NOT polling while the tab is hidden (the TanStack
// default for `refetchIntervalInBackground` is false) — no spam when the
// user is in another tab.
const STATS_POLL_MS    = 30_000;
const CHARTS_POLL_MS   = 60_000;
const ACTIVITY_POLL_MS = 15_000;

export interface DashboardDateRange {
  startDate?: string;
  endDate?: string;
}

/**
 * KPIs + previous-period block for trend deltas. Backend echoes back the
 * range so the cache key faithfully reflects what was requested even when
 * the caller didn't pass dates (all-time → undefined echoed back as null).
 */
export function useDashboardStats(range: DashboardDateRange = {}) {
  const { startDate, endDate } = range;
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "stats", { startDate, endDate }],
    queryFn: () =>
      api<ServerDashboardStatsResponse>("/dashboard/stats", {
        query: { startDate, endDate },
      }),
    // staleTime 0 means every mount + every cross-module invalidation triggers
    // a refetch. Combined with the polling interval below the user always
    // sees fresh numbers even if they don't refresh.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: STATS_POLL_MS,
  });
}

/**
 * Charts use a fixed 12-month window — they don't take the period filter
 * because the user wants to see seasonality regardless of the KPI window.
 */
export function useDashboardCharts() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "charts"],
    queryFn: async () => {
      const server = await api<ServerChartsResponse>("/dashboard/charts");
      return {
        revenueAndProfit: toRevenueAndProfitChart(server.revenueAndProfit ?? []),
        vehiclesByType: toVehicleTypeSlices(server.vehiclesByType ?? []),
        monthlyExpenses: toMonthlyExpensesChart(server.monthlyExpenses ?? []),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: CHARTS_POLL_MS,
  });
}

/**
 * Recent-activity feed sourced from the backend's `activities` collection.
 * Every mutation across the system (vehicle add/update/delete, lead status
 * change, sale recorded, calendar event, ticket reply, etc.) writes an
 * entry via ActivityService.log(), so this stream truly captures everything.
 *
 * Replaced the old client-side merge of /sales + /leads + /calendar +
 * /support which only surfaced "creates" and silently missed updates +
 * deletes — see dashboard-mapper.ts for the full action vocabulary.
 */
export function useRecentActivity() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "activity"],
    queryFn: async () => {
      const rows = await api<ServerActivity[]>("/dashboard/activity", { query: { limit: 30 } });
      return toClientActivity(rows);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: ACTIVITY_POLL_MS,
  });
}
