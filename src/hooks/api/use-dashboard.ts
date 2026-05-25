import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ServerChartsResponse, ServerDashboardStats,
  ActivitySources, buildRecentActivity,
  toLeadStageSlices, toMonthlySalesChart, toVehicleStatusSlices,
} from "@/lib/dashboard-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const DASHBOARD_KEY = ["dashboard"] as const;

export function useDashboardStats() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "stats"],
    queryFn: async () => api<ServerDashboardStats>("/dashboard/stats"),
    staleTime: 60_000,
  });
}

export function useDashboardCharts() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "charts"],
    queryFn: async () => {
      const server = await api<ServerChartsResponse>("/dashboard/charts");
      return {
        monthlySales: toMonthlySalesChart(server.monthlySales ?? []),
        vehiclesByStatus: toVehicleStatusSlices(server.vehiclesByStatus ?? []),
        leadsByStage: toLeadStageSlices(server.leadsByStage ?? []),
      };
    },
    staleTime: 60_000,
  });
}

/**
 * Backend has no "recent activity" endpoint, so we merge feeds from sales +
 * leads + calendar + tickets to build a unified activity stream. Each list
 * is small (5 most recent) so cost is bounded.
 */
export function useRecentActivity() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, "activity"],
    queryFn: async () => {
      const [sales, leads, calendar, tickets] = await Promise.all([
        api<PaginatedServerResponse<ActivitySources["sales"][number]>>("/accounting/sales", { query: { limit: 5 } }),
        api<PaginatedServerResponse<ActivitySources["leads"][number]>>("/leads", { query: { limit: 5 } }),
        api<PaginatedServerResponse<ActivitySources["calendar"][number]>>("/calendar/events", { query: { limit: 5 } }),
        api<PaginatedServerResponse<ActivitySources["tickets"][number]>>("/support/tickets", { query: { limit: 5 } }),
      ]);
      return buildRecentActivity({
        sales: sales.data,
        leads: leads.data,
        calendar: calendar.data,
        tickets: tickets.data,
      });
    },
    staleTime: 30_000,
  });
}
