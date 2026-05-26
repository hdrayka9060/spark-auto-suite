import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CalendarEventCreateInput,
  CalendarEventDisplay,
  ServerCalendarEvent,
  toClientEvent,
  toServerEventCreatePayload,
} from "@/lib/calendar-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const CALENDAR_KEY = ["calendar"] as const;
const VEHICLES_KEY = ["vehicles"] as const;

export interface CalendarRange {
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string;
}

export function useCalendarEvents(range: CalendarRange) {
  return useQuery({
    queryKey: [...CALENDAR_KEY, "list", range],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerCalendarEvent>>("/calendar/events", {
        query: { startDate: range.startDate, endDate: range.endDate, limit: 200 },
      });
      return res.data.map(toClientEvent);
    },
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CalendarEventCreateInput): Promise<CalendarEventDisplay> => {
      const created = await api<ServerCalendarEvent>("/calendar/events", {
        method: "POST",
        body: toServerEventCreatePayload(input),
      });
      return toClientEvent(created);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CALENDAR_KEY });
      // A test_drive event creates a new test-drive count for the linked vehicle.
      // useVehicleTestDriveCount lives under ["vehicles", "testDrives"]; invalidate
      // the whole vehicles prefix so any open VehicleDetail re-counts.
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      // pendingTestDrives KPI + activity feed both come from calendar events.
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/calendar/events/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CALENDAR_KEY });
      qc.invalidateQueries({ queryKey: VEHICLES_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** Boundaries for a calendar grid showing a full month (first ↔ last day). */
export function getMonthRange(year: number, month: number): CalendarRange {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return {
    startDate: first.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
  };
}
