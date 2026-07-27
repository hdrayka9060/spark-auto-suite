/**
 * Lead mapper. Backend `leads` collection holds individual buyer × vehicle
 * inquiries; the frontend Leads & Sales page renders them as kanban cards.
 *
 * Most fields pass through; enums (source, status, channel) just need
 * case translation between the backend's snake_case lowercase and the
 * frontend's Title-Case display.
 */

export type ServerLeadSource = "website" | "google_ads" | "meta_ads" | "referral" | "walk_in";
export type ServerLeadStatus = "new" | "contacted" | "test_drive" | "negotiation" | "closed" | "archived";
export type ServerLeadChannel = "call" | "email" | "whatsapp" | "sms" | "offline" | "website";

export type ClientLeadSource = "Website" | "Google Ads" | "Meta Ads" | "Referral" | "Walk-in";
export type ClientLeadStatus = "New" | "Contacted" | "Test Drive" | "Negotiation" | "Closed" | "Archived";
export type ClientLeadChannel = "Call" | "Email" | "WhatsApp" | "SMS" | "Offline" | "Website";

export interface ServerLead {
  _id: string;
  buyer: { _id: string; buyerName: string; buyerEmail?: string; buyerPhone?: string } | string;
  vehicle: { _id: string; title: string; vehicleNumber?: string; price?: number } | string;
  source: ServerLeadSource;
  status: ServerLeadStatus;
  assignedTo?: { _id: string; firstName: string; lastName: string; email?: string } | string | null;
  notes: string;
  askedPrice?: number;
  timeline: { date: string; action: string; by: string }[];
  log: {
    _id?: string;
    date: string;
    channel: ServerLeadChannel;
    summary: string;
    vehicle?: { _id: string; title?: string; vehicleNumber?: string } | string | null;
    vehicleTitle?: string;
    byStaff?: { _id: string; firstName: string; lastName: string; email?: string } | string | null;
  }[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  vehicleId: string;
  vehicleTitle: string;
  vehiclePrice?: number;
  source: ClientLeadSource;
  status: ClientLeadStatus;
  assignedTo: string; // staff display name; "" if unassigned
  assignedToId?: string;
  createdAt: string;
  notes: string;
  askedPrice: number;
  timeline: { date: string; action: string; by: string }[];
  log: LeadLogEntry[];
}

export interface LeadLogEntry {
  id: string;
  date: string;
  channel: ClientLeadChannel;
  summary: string;
  vehicleId?: string;
  vehicleTitle?: string;
  byStaffId?: string;
  byStaffName?: string;
}

const SOURCE_TO_CLIENT: Record<ServerLeadSource, ClientLeadSource> = {
  website: "Website",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  referral: "Referral",
  walk_in: "Walk-in",
};
const SOURCE_TO_SERVER: Record<ClientLeadSource, ServerLeadSource> = {
  Website: "website",
  "Google Ads": "google_ads",
  "Meta Ads": "meta_ads",
  Referral: "referral",
  "Walk-in": "walk_in",
};

const STATUS_TO_CLIENT: Record<ServerLeadStatus, ClientLeadStatus> = {
  new: "New",
  contacted: "Contacted",
  test_drive: "Test Drive",
  negotiation: "Negotiation",
  closed: "Closed",
  archived: "Archived",
};
const STATUS_TO_SERVER: Record<ClientLeadStatus, ServerLeadStatus> = {
  New: "new",
  Contacted: "contacted",
  "Test Drive": "test_drive",
  Negotiation: "negotiation",
  Closed: "closed",
  Archived: "archived",
};

const CHANNEL_TO_CLIENT: Record<ServerLeadChannel, ClientLeadChannel> = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  offline: "Offline",
  website: "Website",
};
const CHANNEL_TO_SERVER: Record<ClientLeadChannel, ServerLeadChannel> = {
  Call: "call",
  Email: "email",
  WhatsApp: "whatsapp",
  SMS: "sms",
  Offline: "offline",
  Website: "website",
};

export const ALL_LEAD_STATUSES: ClientLeadStatus[] = ["New", "Contacted", "Test Drive", "Negotiation", "Closed", "Archived"];
export const ALL_LEAD_SOURCES: ClientLeadSource[] = ["Website", "Google Ads", "Meta Ads", "Referral", "Walk-in"];
export const ALL_LEAD_CHANNELS: ClientLeadChannel[] = ["Call", "Email", "WhatsApp", "SMS", "Offline"];

/**
 * Color theme per lead status — badge classes (mirrors VEHICLE_STATUS_BADGE_CLASS
 * in vehicle-mapper). Single source of truth so the Leads page and the Inventory
 * lead-tags render the same colors.
 */
export const LEAD_STATUS_BADGE_CLASS: Record<ClientLeadStatus, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-purple-100 text-purple-700",
  "Test Drive": "bg-amber-100 text-amber-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Closed: "bg-emerald-100 text-emerald-700",
  Archived: "bg-slate-100 text-slate-600",
};

function refId<T extends { _id: string } | string | null | undefined>(v: T): string {
  if (!v) return "";
  return typeof v === "string" ? v : v._id;
}

export function toClientLead(s: ServerLead): Lead {
  const buyer = typeof s.buyer === "string" ? null : s.buyer;
  const vehicle = typeof s.vehicle === "string" ? null : s.vehicle;
  const assignee = typeof s.assignedTo === "string" || !s.assignedTo ? null : s.assignedTo;

  return {
    id: s._id,
    buyerId: refId(s.buyer),
    buyerName: buyer?.buyerName ?? "—",
    buyerEmail: buyer?.buyerEmail,
    buyerPhone: buyer?.buyerPhone,
    vehicleId: refId(s.vehicle),
    vehicleTitle: vehicle?.title ?? "—",
    vehiclePrice: vehicle?.price,
    source: SOURCE_TO_CLIENT[s.source],
    status: STATUS_TO_CLIENT[s.status],
    assignedTo: assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : "",
    assignedToId: refId(s.assignedTo ?? undefined),
    createdAt: s.createdAt.slice(0, 10),
    notes: s.notes ?? "",
    askedPrice: s.askedPrice ?? 0,
    timeline: (s.timeline ?? []).map((t) => ({
      date: t.date.slice(0, 10),
      action: t.action,
      by: t.by,
    })),
    log: (s.log ?? [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map<LeadLogEntry>((l) => {
        const vehicleObj = l.vehicle && typeof l.vehicle === "object" ? l.vehicle : null;
        const staffObj = l.byStaff && typeof l.byStaff === "object" ? l.byStaff : null;
        const vehicleId =
          typeof l.vehicle === "string" ? l.vehicle : vehicleObj?._id;
        const byStaffId =
          typeof l.byStaff === "string" ? l.byStaff : staffObj?._id;
        return {
          id: l._id ?? "",
          date: l.date?.slice(0, 10) ?? "",
          channel: CHANNEL_TO_CLIENT[l.channel] ?? "Call",
          summary: l.summary ?? "",
          vehicleId,
          vehicleTitle: vehicleObj?.title ?? l.vehicleTitle,
          byStaffId,
          byStaffName: staffObj ? `${staffObj.firstName} ${staffObj.lastName}`.trim() : undefined,
        };
      }),
  };
}

// ── Write direction ────────────────────────────────────────────────────────

export interface LeadCreateInput {
  buyerId: string;
  vehicleId: string;
  source: ClientLeadSource;
  status?: ClientLeadStatus;
  assignedToId?: string;
  notes?: string;
  // Sale details — only sent when creating a lead directly as Closed.
  soldAt?: number;
  amountPaid?: number;
  paymentMethod?: "cash" | "finance" | "bhph" | "trade_in";
  paymentStatus?: "paid" | "partial" | "pending";
  saleDate?: string;
}

export function toServerLeadCreatePayload(input: LeadCreateInput) {
  return {
    buyer: input.buyerId,
    vehicle: input.vehicleId,
    source: SOURCE_TO_SERVER[input.source],
    status: input.status ? STATUS_TO_SERVER[input.status] : undefined,
    assignedTo: input.assignedToId,
    notes: input.notes,
    // Passed through to the backend, which routes closed-on-create through the
    // unified sale flow. Undefined for non-closed leads (stripped server-side).
    soldAt: input.soldAt,
    amountPaid: input.amountPaid,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    saleDate: input.saleDate,
  };
}

export interface LeadUpdateInput {
  status?: ClientLeadStatus;
  assignedToId?: string | null;
  notes?: string;
  askedPrice?: number;
  source?: ClientLeadSource;
}

export function toServerLeadUpdatePayload(input: LeadUpdateInput) {
  const out: Record<string, unknown> = {};
  if (input.status !== undefined) out.status = STATUS_TO_SERVER[input.status];
  if (input.assignedToId !== undefined) out.assignedTo = input.assignedToId;
  if (input.notes !== undefined) out.notes = input.notes;
  if (input.askedPrice !== undefined) out.askedPrice = input.askedPrice;
  if (input.source !== undefined) out.source = SOURCE_TO_SERVER[input.source];
  return out;
}

export function leadChannelToServer(c: ClientLeadChannel): ServerLeadChannel {
  return CHANNEL_TO_SERVER[c];
}
