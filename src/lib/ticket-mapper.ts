/**
 * Support ticket mapper. Backend schema maps almost 1:1 to the prototype —
 * just enum case translation and a few field renames.
 */

export type ServerTicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type ServerTicketPriority = "low" | "medium" | "high" | "urgent";
export type ServerTicketCategory = "technical" | "billing" | "vehicle" | "general" | "complaint";

export type ClientTicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type ClientTicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type ClientTicketCategory = "Technical" | "Billing" | "Vehicle" | "General" | "Complaint";

export interface ServerThreadEntry {
  message: string;
  sentByName: string;
  sentByEmail?: string;
  sentAt: string;
  isInternal?: boolean;
  attachments?: string[];
}

export interface ServerTicket {
  _id: string;
  subject: string;
  description: string;
  status: ServerTicketStatus;
  priority: ServerTicketPriority;
  category: ServerTicketCategory;
  raisedByName: string;
  raisedByEmail: string;
  assignedTo?: { _id: string; firstName: string; lastName: string; email?: string } | string | null;
  attachments: string[];
  thread: ServerThreadEntry[];
  resolvedAt?: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadMessage {
  message: string;
  sentByName: string;
  sentByEmail?: string;
  /** YYYY-MM-DD HH:MM */
  sentAt: string;
  isInternal: boolean;
  attachments: string[];
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: ClientTicketStatus;
  priority: ClientTicketPriority;
  category: ClientTicketCategory;
  raisedByName: string;
  raisedByEmail: string;
  assignedToName?: string;
  assignedToId?: string;
  attachments: string[];
  thread: ThreadMessage[];
  createdAt: string; // YYYY-MM-DD
  resolvedAt?: string;
}

const STATUS_TO_CLIENT: Record<ServerTicketStatus, ClientTicketStatus> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};
const STATUS_TO_SERVER: Record<ClientTicketStatus, ServerTicketStatus> = {
  Open: "open",
  "In Progress": "in_progress",
  Resolved: "resolved",
  Closed: "closed",
};
const PRIORITY_TO_CLIENT: Record<ServerTicketPriority, ClientTicketPriority> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const PRIORITY_TO_SERVER: Record<ClientTicketPriority, ServerTicketPriority> = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Urgent: "urgent",
};
const CATEGORY_TO_CLIENT: Record<ServerTicketCategory, ClientTicketCategory> = {
  technical: "Technical",
  billing: "Billing",
  vehicle: "Vehicle",
  general: "General",
  complaint: "Complaint",
};
const CATEGORY_TO_SERVER: Record<ClientTicketCategory, ServerTicketCategory> = {
  Technical: "technical",
  Billing: "billing",
  Vehicle: "vehicle",
  General: "general",
  Complaint: "complaint",
};

export const ALL_TICKET_STATUSES: ClientTicketStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
export const ALL_TICKET_PRIORITIES: ClientTicketPriority[] = ["Low", "Medium", "High", "Urgent"];
export const ALL_TICKET_CATEGORIES: ClientTicketCategory[] = ["Technical", "Billing", "Vehicle", "General", "Complaint"];

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}
function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function toClientTicket(s: ServerTicket): Ticket {
  const assignee = typeof s.assignedTo === "string" || !s.assignedTo ? null : s.assignedTo;
  return {
    id: s._id,
    subject: s.subject,
    description: s.description ?? "",
    status: STATUS_TO_CLIENT[s.status],
    priority: PRIORITY_TO_CLIENT[s.priority],
    category: CATEGORY_TO_CLIENT[s.category],
    raisedByName: s.raisedByName,
    raisedByEmail: s.raisedByEmail,
    assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : undefined,
    assignedToId: typeof s.assignedTo === "string" ? s.assignedTo : assignee?._id,
    attachments: s.attachments ?? [],
    thread: (s.thread ?? []).map((t) => ({
      message: t.message,
      sentByName: t.sentByName,
      sentByEmail: t.sentByEmail,
      sentAt: formatDateTime(t.sentAt),
      isInternal: !!t.isInternal,
      attachments: t.attachments ?? [],
    })),
    createdAt: formatDate(s.createdAt),
    resolvedAt: s.resolvedAt ? formatDate(s.resolvedAt) : undefined,
  };
}

// ── Write direction ────────────────────────────────────────────────────────

export interface TicketCreateInput {
  subject: string;
  description: string;
  priority: ClientTicketPriority;
  category: ClientTicketCategory;
  raisedByName: string;
  raisedByEmail: string;
}

export function toServerTicketCreatePayload(input: TicketCreateInput) {
  return {
    subject: input.subject,
    description: input.description,
    priority: PRIORITY_TO_SERVER[input.priority],
    category: CATEGORY_TO_SERVER[input.category],
    raisedByName: input.raisedByName,
    raisedByEmail: input.raisedByEmail,
  };
}

export interface TicketReplyInput {
  message: string;
  sentByName: string;
  sentByEmail?: string;
  isInternal?: boolean;
}

export function toServerReplyPayload(input: TicketReplyInput) {
  return {
    message: input.message,
    sentByName: input.sentByName,
    sentByEmail: input.sentByEmail,
    isInternal: input.isInternal ?? false,
  };
}

export function ticketStatusToServer(s: ClientTicketStatus): ServerTicketStatus {
  return STATUS_TO_SERVER[s];
}
