import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CalendarEventCreateInput,
  CalendarEventDisplay,
  CalendarEventUpdateInput,
  ParticipantInput,
  ParticipantType,
  ServerCalendarEvent,
  toClientEvent,
  toServerEventCreatePayload,
  toServerEventUpdatePayload,
} from "@/lib/calendar-mapper";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

const CALENDAR_KEY = ["calendar"] as const;
const VEHICLES_KEY = ["vehicles"] as const;

export interface CalendarRange {
  // Full ISO instants for the local day boundaries of the visible range
  // (start-of-first-day → end-of-last-day, in the browser's timezone).
  // NOT date-only YYYY-MM-DD: that path went through toISOString().slice(0,10),
  // which converts to UTC first and shifts the window back a day for users
  // east of UTC, dropping the last day's events (PROJECT_MEMORY §3). Sending
  // precise instants does the local→UTC conversion here, where the timezone
  // is known, so the backend's $gte/$lte match is exact.
  startDate: string; // ISO datetime, inclusive lower bound
  endDate: string; // ISO datetime, inclusive upper bound (end-of-day)
}

export interface CalendarFilter {
  /**
   * When set, the API filters to events where this user is either the
   * staff `assignedTo` OR appears in `participants[]`. Drives the
   * multi-user calendar view ("View calendar of X").
   */
  userId?: string;
  userType?: ParticipantType;
}

export function useCalendarEvents(range: CalendarRange, filter: CalendarFilter = {}) {
  return useQuery({
    queryKey: [...CALENDAR_KEY, "list", range, filter],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerCalendarEvent>>("/calendar/events", {
        query: {
          startDate: range.startDate,
          endDate: range.endDate,
          limit: 200,
          userId: filter.userId || undefined,
          userType: filter.userType || undefined,
        },
      });
      return res.data.map(toClientEvent);
    },
  });
}

/** Fetch a single event (the detail dialog uses this when an event is clicked). */
export function useCalendarEvent(id: string | null) {
  return useQuery({
    queryKey: [...CALENDAR_KEY, "detail", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("no id");
      const res = await api<ServerCalendarEvent>(`/calendar/events/${id}`);
      return toClientEvent(res);
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
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CalendarEventUpdateInput }): Promise<CalendarEventDisplay> => {
      const updated = await api<ServerCalendarEvent>(`/calendar/events/${id}`, {
        method: "PATCH",
        body: toServerEventUpdatePayload(input),
      });
      return toClientEvent(updated);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/calendar/events/${id}`, { method: "DELETE" });
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useAddParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, participant }: { eventId: string; participant: ParticipantInput }) => {
      const updated = await api<ServerCalendarEvent>(`/calendar/events/${eventId}/participants`, {
        method: "POST",
        body: participant,
      });
      return toClientEvent(updated);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, participantId }: { eventId: string; participantId: string }) => {
      const updated = await api<ServerCalendarEvent>(
        `/calendar/events/${eventId}/participants/${participantId}`,
        { method: "DELETE" },
      );
      return toClientEvent(updated);
    },
    onSuccess: () => invalidate(qc),
  });
}

/**
 * Shared invalidation: list, detail, plus the cross-module surfaces.
 * Test-drive events update vehicle test-drive counts; pending-test-drives
 * KPI + activity feed both come from calendar events.
 */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CALENDAR_KEY });
  qc.invalidateQueries({ queryKey: VEHICLES_KEY });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

/** Boundaries for a calendar grid showing a full month (first ↔ last day). */
export function getMonthRange(year: number, month: number): CalendarRange {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Sunday-anchored 7-day range containing `date`. Used by Week view. */
export function getWeekRange(date: Date): CalendarRange {
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  sunday.setHours(0, 0, 0, 0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  return { startDate: sunday.toISOString(), endDate: saturday.toISOString() };
}

/** Single-day range for Day view (full local day, start-of-day → end-of-day). */
export function getDayRange(date: Date): CalendarRange {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
