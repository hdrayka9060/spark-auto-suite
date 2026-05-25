/**
 * Calendar event mapper. Server stores full ISO datetimes; the prototype UI
 * uses day-of-month + "HH:MM AM/PM" strings. The mapper computes display
 * fields from startDateTime.
 */

export type ServerEventType = "test_drive" | "inspection" | "meeting" | "blocked";
export type ServerEventStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type ClientEventType = "testDrive" | "inspection" | "meeting" | "blocked";

export interface ServerCalendarEvent {
  _id: string;
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  eventType: ServerEventType;
  status: ServerEventStatus;
  assignedTo?: { _id: string; firstName: string; lastName: string } | string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicle?: { _id: string; title: string; vehicleNumber?: string } | string | null;
  meetLink: string;
  location: string;
  notes: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventDisplay {
  id: string;
  title: string;
  type: ClientEventType;
  status: ServerEventStatus;
  start: Date;
  end: Date;
  /** YYYY-MM-DD for date-only comparisons */
  dateKey: string;
  time: string; // "10:00 AM"
  day: number; // day of month
  month: number; // 0-indexed (Date convention)
  year: number;
  customer: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleId?: string;
  vehicleTitle?: string;
  assignedToName?: string;
  assignedToId?: string;
  meetLink?: string;
  location?: string;
  notes?: string;
}

const TYPE_TO_CLIENT: Record<ServerEventType, ClientEventType> = {
  test_drive: "testDrive",
  inspection: "inspection",
  meeting: "meeting",
  blocked: "blocked",
};

const TYPE_TO_SERVER: Record<ClientEventType, ServerEventType> = {
  testDrive: "test_drive",
  inspection: "inspection",
  meeting: "meeting",
  blocked: "blocked",
};

function formatTime(d: Date): string {
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

export function toClientEvent(s: ServerCalendarEvent): CalendarEventDisplay {
  const start = new Date(s.startDateTime);
  const end = new Date(s.endDateTime);
  const assignee = typeof s.assignedTo === "string" || !s.assignedTo ? null : s.assignedTo;
  const vehicle = typeof s.vehicle === "string" || !s.vehicle ? null : s.vehicle;
  const isoDate = start.toISOString().slice(0, 10);
  return {
    id: s._id,
    title: s.title,
    type: TYPE_TO_CLIENT[s.eventType],
    status: s.status,
    start,
    end,
    dateKey: isoDate,
    time: formatTime(start),
    day: start.getDate(),
    month: start.getMonth(),
    year: start.getFullYear(),
    customer: s.customerName || "—",
    customerPhone: s.customerPhone || undefined,
    customerEmail: s.customerEmail || undefined,
    vehicleId: vehicle?._id,
    vehicleTitle: vehicle?.title,
    assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : undefined,
    assignedToId: typeof s.assignedTo === "string" ? s.assignedTo : assignee?._id,
    meetLink: s.meetLink || undefined,
    location: s.location || undefined,
    notes: s.notes || undefined,
  };
}

// ── Write direction ────────────────────────────────────────────────────────

export interface CalendarEventCreateInput {
  title: string;
  type: ClientEventType;
  startDateTime: string; // ISO
  endDateTime: string; // ISO
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleId?: string;
  assignedToId?: string;
  location?: string;
  notes?: string;
}

export function toServerEventCreatePayload(input: CalendarEventCreateInput) {
  const out: Record<string, unknown> = {
    title: input.title,
    eventType: TYPE_TO_SERVER[input.type],
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
  };
  if (input.customerName) out.customerName = input.customerName;
  if (input.customerPhone) out.customerPhone = input.customerPhone;
  if (input.customerEmail) out.customerEmail = input.customerEmail;
  if (input.vehicleId) out.vehicle = input.vehicleId;
  if (input.assignedToId) out.assignedTo = input.assignedToId;
  if (input.location) out.location = input.location;
  if (input.notes) out.notes = input.notes;
  return out;
}
