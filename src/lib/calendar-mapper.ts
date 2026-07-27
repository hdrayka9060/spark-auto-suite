/**
 * Calendar event mapper. Server stores full ISO datetimes; the UI uses
 * day-of-month + "HH:MM AM/PM" strings. The mapper computes display fields
 * from startDateTime, and translates participant subdocs both ways.
 *
 * Major contract changes (vs. the previous version):
 *   - `blocked` event type is renamed to `other`. Boot migrator on the
 *     backend rewrites legacy rows; the mapper here treats both for
 *     defensive reads.
 *   - Events have a `participants[]` array (Staff / Buyer / Seller).
 *   - `meetingType: 'physical' | 'virtual'` separates in-person from video
 *     calls. Drives the "Create Google Meet" affordance on the form.
 */

export type ServerEventType = "test_drive" | "inspection" | "meeting" | "other";
export type ServerEventStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type ServerMeetingType = "physical" | "virtual";

export type ClientEventType = "testDrive" | "inspection" | "meeting" | "other";
export type ClientMeetingType = "physical" | "virtual";

/** Three participant kinds — Staff / Buyer / Seller. */
export type ParticipantType = "staff" | "buyer" | "seller";
export type ParticipantStatus = "invited" | "accepted" | "declined";

export interface ServerParticipant {
  _id: string;
  userType: ParticipantType;
  userId?: string;
  name: string;
  email?: string;
  status?: ParticipantStatus;
  invitedAt?: string;
}

export interface Participant {
  id: string;
  userType: ParticipantType;
  userId?: string;
  name: string;
  email: string;
  status: ParticipantStatus;
}

export interface ServerCalendarEvent {
  _id: string;
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  eventType: ServerEventType | "blocked"; // defensive: tolerate legacy reads
  status: ServerEventStatus;
  meetingType?: ServerMeetingType;
  assignedTo?: { _id: string; firstName: string; lastName: string; email?: string } | string | null;
  createdBy?: { _id: string; firstName: string; lastName: string; email?: string } | string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicle?: { _id: string; title: string; vehicleNumber?: string } | string | null;
  /** Linked CRM lead (raw ObjectId — the API does not populate it). */
  lead?: { _id: string } | string | null;
  meetLink: string;
  /** Backing Google Calendar event id — non-empty ONLY for Google-provisioned
   *  Meet links. Used to tell a real Google Meet from a user-pasted link. */
  googleEventId?: string;
  location: string;
  notes: string;
  participants?: ServerParticipant[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventDisplay {
  id: string;
  title: string;
  description?: string;
  type: ClientEventType;
  status: ServerEventStatus;
  meetingType: ClientMeetingType;
  start: Date;
  end: Date;
  /** YYYY-MM-DD for date-only comparisons */
  dateKey: string;
  time: string; // "10:00 AM"
  endTime: string;
  day: number; // day of month
  month: number; // 0-indexed (Date convention)
  year: number;
  customer: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleId?: string;
  vehicleTitle?: string;
  leadId?: string;
  assignedToName?: string;
  assignedToEmail?: string;
  assignedToId?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdById?: string;
  meetLink?: string;
  /** True when the meet link was provisioned by Google (has a backing event);
   *  false for a user-pasted link. Drives the "Google Meet" vs "Meet Link" UI. */
  isGoogleMeet: boolean;
  location?: string;
  notes?: string;
  participants: Participant[];
}

const TYPE_TO_CLIENT: Record<string, ClientEventType> = {
  test_drive: "testDrive",
  inspection: "inspection",
  meeting: "meeting",
  // Legacy 'blocked' values from before the rename map to the new 'other'
  // slot so old rows keep rendering without a backend rewrite delay.
  blocked: "other",
  other: "other",
};

const TYPE_TO_SERVER: Record<ClientEventType, ServerEventType> = {
  testDrive: "test_drive",
  inspection: "inspection",
  meeting: "meeting",
  other: "other",
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
  const creator = typeof s.createdBy === "string" || !s.createdBy ? null : s.createdBy;
  const vehicle = typeof s.vehicle === "string" || !s.vehicle ? null : s.vehicle;
  const isoDate = start.toISOString().slice(0, 10);
  return {
    id: s._id,
    title: s.title,
    description: s.description || undefined,
    type: TYPE_TO_CLIENT[s.eventType] ?? "other",
    status: s.status,
    meetingType: s.meetingType ?? "physical",
    start,
    end,
    dateKey: isoDate,
    time: formatTime(start),
    endTime: formatTime(end),
    day: start.getDate(),
    month: start.getMonth(),
    year: start.getFullYear(),
    customer: s.customerName || "—",
    customerPhone: s.customerPhone || undefined,
    customerEmail: s.customerEmail || undefined,
    vehicleId: vehicle?._id,
    vehicleTitle: vehicle?.title,
    leadId: typeof s.lead === "string" ? s.lead || undefined : s.lead?._id,
    assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : undefined,
    assignedToEmail: assignee?.email,
    assignedToId: typeof s.assignedTo === "string" ? s.assignedTo : assignee?._id,
    createdByName: creator ? `${creator.firstName} ${creator.lastName}`.trim() : undefined,
    createdByEmail: creator?.email,
    createdById: typeof s.createdBy === "string" ? s.createdBy : creator?._id,
    meetLink: s.meetLink || undefined,
    isGoogleMeet: !!s.googleEventId,
    location: s.location || undefined,
    notes: s.notes || undefined,
    participants: (s.participants ?? []).map<Participant>((p) => ({
      id: p._id,
      userType: p.userType,
      userId: p.userId,
      name: p.name,
      email: p.email ?? "",
      status: p.status ?? "invited",
    })),
  };
}

// ── Write direction ────────────────────────────────────────────────────────

export interface ParticipantInput {
  userType: ParticipantType;
  userId?: string;
  name: string;
  email?: string;
}

export interface CalendarEventCreateInput {
  title: string;
  description?: string;
  type: ClientEventType;
  startDateTime: string; // ISO
  endDateTime: string; // ISO
  meetingType: ClientMeetingType;
  /** When true AND meetingType=virtual, backend generates a Meet link. */
  createMeetLink?: boolean;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleId?: string;
  /** Link this event to a CRM lead (drives the Buyer Portal + lead timeline). */
  lead?: string;
  assignedToId?: string;
  location?: string;
  meetLink?: string;
  notes?: string;
  participants?: ParticipantInput[];
}

export interface CalendarEventUpdateInput extends Partial<CalendarEventCreateInput> {}

function toServerParticipants(input?: ParticipantInput[]) {
  if (!input || input.length === 0) return undefined;
  return input.map((p) => ({
    userType: p.userType,
    ...(p.userId ? { userId: p.userId } : {}),
    name: p.name,
    email: p.email ?? "",
  }));
}

export function toServerEventCreatePayload(input: CalendarEventCreateInput) {
  const out: Record<string, unknown> = {
    title: input.title,
    eventType: TYPE_TO_SERVER[input.type],
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    meetingType: input.meetingType,
  };
  if (input.description) out.description = input.description;
  if (input.createMeetLink !== undefined) out.createMeetLink = input.createMeetLink;
  if (input.customerName) out.customerName = input.customerName;
  if (input.customerPhone) out.customerPhone = input.customerPhone;
  if (input.customerEmail) out.customerEmail = input.customerEmail;
  if (input.vehicleId) out.vehicle = input.vehicleId;
  if (input.lead) out.lead = input.lead;
  if (input.assignedToId) out.assignedTo = input.assignedToId;
  if (input.location) out.location = input.location;
  if (input.meetLink) out.meetLink = input.meetLink;
  if (input.notes) out.notes = input.notes;
  const participants = toServerParticipants(input.participants);
  if (participants) out.participants = participants;
  return out;
}

export function toServerEventUpdatePayload(input: CalendarEventUpdateInput) {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description;
  if (input.type !== undefined) out.eventType = TYPE_TO_SERVER[input.type];
  if (input.startDateTime !== undefined) out.startDateTime = input.startDateTime;
  if (input.endDateTime !== undefined) out.endDateTime = input.endDateTime;
  if (input.meetingType !== undefined) out.meetingType = input.meetingType;
  if (input.createMeetLink !== undefined) out.createMeetLink = input.createMeetLink;
  if (input.customerName !== undefined) out.customerName = input.customerName;
  if (input.customerPhone !== undefined) out.customerPhone = input.customerPhone;
  if (input.customerEmail !== undefined) out.customerEmail = input.customerEmail;
  if (input.vehicleId !== undefined) out.vehicle = input.vehicleId;
  if (input.lead !== undefined) out.lead = input.lead;
  if (input.assignedToId !== undefined) out.assignedTo = input.assignedToId;
  if (input.location !== undefined) out.location = input.location;
  if (input.meetLink !== undefined) out.meetLink = input.meetLink;
  if (input.notes !== undefined) out.notes = input.notes;
  const participants = toServerParticipants(input.participants);
  if (participants) out.participants = participants;
  return out;
}

/** Display metadata for each event type — colour, label, icon name. */
export const EVENT_TYPE_META: Record<ClientEventType, { label: string; tagColor: string; dotColor: string }> = {
  testDrive: {
    label: "Test Drive",
    tagColor: "bg-primary text-primary-foreground",
    dotColor: "bg-primary",
  },
  inspection: {
    label: "Inspection",
    tagColor: "bg-amber-500 text-white",
    dotColor: "bg-amber-500",
  },
  meeting: {
    label: "Meeting",
    tagColor: "bg-violet-500 text-white",
    dotColor: "bg-violet-500",
  },
  other: {
    label: "Other",
    tagColor: "bg-slate-500 text-white",
    dotColor: "bg-slate-500",
  },
};
