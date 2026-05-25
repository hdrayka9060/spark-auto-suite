/**
 * Buyer ↔ BuyerLead mapper. Frontend prototype types model "buyers" as customer
 * records; backend stores the same data in `buyer_leads` as pipeline records.
 *
 * Multi-vehicle interests now live on `interestedVehicles[]` (array of
 * populated Vehicle docs). The legacy singular `interestedVehicle` field is
 * still surfaced as a fallback so old records keep rendering.
 *
 * `communications[]` is editable per-entry — each has a Mongo `_id` so the UI
 * can target individual rows for PATCH / DELETE.
 */

import { ServerVehicle } from "./vehicle-mapper";

export type ServerBuyerStage =
  | "new"
  | "contacted"
  | "test_drive"
  | "negotiation"
  | "purchased"
  | "lost";

export type ClientBuyerStatus = "Active" | "Converted" | "Dropped";
export type ClientBuyerLeadStatus = ClientBuyerStatus;

export type BuyerCommChannel = "email" | "sms" | "whatsapp" | "call" | "offline";

export interface ServerBuyerCommunication {
  _id: string;
  at: string;
  channel: BuyerCommChannel;
  vehicle?: { _id: string; title?: string; vehicleNumber?: string } | string | null;
  vehicleTitle?: string;
  summary: string;
  by?: string;
  byStaff?:
    | { _id: string; firstName: string; lastName: string; email?: string }
    | string
    | null;
}

export interface ServerBuyerPurchase {
  _id?: string;
  at: string;
  vehicle?: { _id: string; title?: string } | string | null;
  vehicleTitle?: string;
  soldAt: number;
  soldDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  leadId?: string;
  saleId?: string;
}

export interface ServerBuyerLead {
  _id: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  notes: string;
  purchases?: ServerBuyerPurchase[];
  /** Modern array of populated Vehicle docs (or ObjectId strings). */
  interestedVehicles?: (ServerVehicle | string)[];
  /** Legacy singular field — may still be set on old documents. */
  interestedVehicle?: ServerVehicle | string | null;
  budget?: number;
  stage: ServerBuyerStage;
  assignedTo?: string | { _id: string; firstName: string; lastName: string };
  history: { vehicleId?: string; vehicleTitle?: string; action: string; date: string }[];
  communications?: ServerBuyerCommunication[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerInterestedVehicle {
  vehicleId: string;
  title: string;
  image: string;
  price: number;
  year: number;
}

export interface BuyerCommunication {
  id: string;
  date: string;
  channel: BuyerCommChannel;
  channelLabel: string;
  vehicleId?: string;
  vehicleTitle?: string;
  summary: string;
  byStaffId?: string;
  byStaffName?: string;
}

export interface BuyerPurchase {
  id: string;
  date: string;
  vehicleId?: string;
  vehicleTitle: string;
  soldAt: number;
  paymentMethod?: string;
  paymentStatus?: string;
}

export interface BuyerTestDrive {
  vehicleId: string;
  vehicleTitle: string;
  date: string;
  status: "Scheduled" | "Completed" | "Cancelled";
}

export interface Buyer {
  id: string;
  /** Short stable display code like "B-XXXXXX". */
  code: string;
  name: string;
  email: string;
  phone: string;
  /** 3-bucket lead status derived from the backend stage. */
  status: ClientBuyerStatus;
  /** Raw backend stage — kept for filtering / writes. */
  stage: ServerBuyerStage;
  notes: string;
  interestedVehicles: BuyerInterestedVehicle[];
  budget?: number;
  testDrives: BuyerTestDrive[];
  communications: BuyerCommunication[];
  createdAt: string;
  // ── Derived helpers used by the list page ───────────────────────────────
  /** Title of the first interested vehicle, for compact list / table rendering. */
  interestedVehicleTitle?: string;
  /** Count of bookings made on this buyer (= testDrives.length). */
  bookings: number;
  /** Confirmed purchases (one per closed-and-won lead). */
  purchases: BuyerPurchase[];
}

export const BUYER_STAGE_LABELS: Record<ServerBuyerStage, string> = {
  new: "New",
  contacted: "Contacted",
  test_drive: "Test Drive",
  negotiation: "Negotiation",
  purchased: "Purchased",
  lost: "Lost",
};

const STAGE_TO_STATUS: Record<ServerBuyerStage, ClientBuyerStatus> = {
  new: "Active",
  contacted: "Active",
  test_drive: "Active",
  negotiation: "Active",
  purchased: "Converted",
  lost: "Dropped",
};

const STATUS_TO_STAGE: Record<ClientBuyerStatus, ServerBuyerStage> = {
  // When the user picks a Lead Status, this is the canonical backend stage we write.
  // Mid-pipeline edits (contacted / test_drive / negotiation) still flow through
  // book-test-drive and other dedicated endpoints — they don't need a UI toggle.
  Active: "new",
  Converted: "purchased",
  Dropped: "lost",
};

const STATUS_TO_STAGE_QUERY: Record<ClientBuyerStatus, ServerBuyerStage[]> = {
  Active: ["new", "contacted", "test_drive", "negotiation"],
  Converted: ["purchased"],
  Dropped: ["lost"],
};

export function getBuyerStageQuery(status: ClientBuyerStatus | "All"): ServerBuyerStage | undefined {
  if (status === "All") return undefined;
  const stages = STATUS_TO_STAGE_QUERY[status];
  return stages.length === 1 ? stages[0] : undefined;
}

export function leadStatusToStage(status: ClientBuyerStatus): ServerBuyerStage {
  return STATUS_TO_STAGE[status];
}

const CHANNEL_LABEL: Record<BuyerCommChannel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "Call",
  offline: "Offline",
};

const FALLBACK_IMAGE = "🚗";

function isPopulatedVehicle(v: ServerVehicle | string | null | undefined): v is ServerVehicle {
  return Boolean(v) && typeof v !== "string" && "title" in (v as object);
}

function deriveCode(id: string): string {
  return `B-${id.slice(-6).toUpperCase()}`;
}

function toInterested(v: ServerVehicle): BuyerInterestedVehicle {
  return {
    vehicleId: v._id,
    title: v.title,
    image: v.photos?.[0] ?? FALLBACK_IMAGE,
    price: v.price,
    year: v.year,
  };
}

export function toClientBuyer(s: ServerBuyerLead): Buyer {
  // Merge modern array + legacy singular field, de-duped by vehicleId.
  const seen = new Set<string>();
  const interested: BuyerInterestedVehicle[] = [];
  for (const v of s.interestedVehicles ?? []) {
    if (!isPopulatedVehicle(v)) continue;
    if (seen.has(v._id)) continue;
    seen.add(v._id);
    interested.push(toInterested(v));
  }
  if (isPopulatedVehicle(s.interestedVehicle) && !seen.has(s.interestedVehicle._id)) {
    seen.add(s.interestedVehicle._id);
    interested.push(toInterested(s.interestedVehicle));
  }

  const testDriveHistory = (s.history ?? []).filter((h) => h.action === "test_drive_booked");

  const communications: BuyerCommunication[] = (s.communications ?? [])
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map((c) => {
      const vehicleObj = isPopulatedVehicle(c.vehicle as ServerVehicle | string | null | undefined)
        ? (c.vehicle as ServerVehicle)
        : null;
      const vehicleId =
        typeof c.vehicle === "string"
          ? c.vehicle
          : vehicleObj?._id;
      const staff = typeof c.byStaff === "string" || !c.byStaff ? null : c.byStaff;
      return {
        id: c._id,
        date: c.at?.slice(0, 10) ?? "",
        channel: c.channel,
        channelLabel: CHANNEL_LABEL[c.channel] ?? c.channel,
        vehicleId,
        vehicleTitle: vehicleObj?.title ?? c.vehicleTitle,
        summary: c.summary ?? "",
        byStaffId: staff?._id ?? (typeof c.byStaff === "string" ? c.byStaff : undefined),
        byStaffName: staff ? `${staff.firstName} ${staff.lastName}`.trim() : undefined,
      };
    });

  const testDrives = testDriveHistory.map<BuyerTestDrive>((h) => ({
    vehicleId: h.vehicleId ?? "",
    vehicleTitle: h.vehicleTitle ?? "",
    date: h.date?.slice(0, 10) ?? "",
    status: "Scheduled",
  }));

  return {
    id: s._id,
    code: deriveCode(s._id),
    name: s.buyerName,
    email: s.buyerEmail,
    phone: s.buyerPhone,
    status: STAGE_TO_STATUS[s.stage] ?? "Active",
    stage: s.stage,
    notes: s.notes ?? "",
    interestedVehicles: interested,
    budget: s.budget,
    testDrives,
    communications,
    createdAt: s.createdAt,
    interestedVehicleTitle: interested[0]?.title,
    bookings: testDrives.length,
    purchases: (s.purchases ?? [])
      .slice()
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .map<BuyerPurchase>((p) => {
        const vObj = p.vehicle && typeof p.vehicle === "object" ? p.vehicle : null;
        const vId = typeof p.vehicle === "string" ? p.vehicle : vObj?._id;
        return {
          id: p._id ?? `${vId ?? "v"}-${p.at}`,
          date: (p.soldDate ?? p.at)?.slice(0, 10) ?? "",
          vehicleId: vId,
          vehicleTitle: vObj?.title ?? p.vehicleTitle ?? "Vehicle",
          soldAt: p.soldAt ?? 0,
          paymentMethod: p.paymentMethod,
          paymentStatus: p.paymentStatus,
        };
      }),
  };
}

// ── Write direction ────────────────────────────────────────────────────────

export interface BuyerFormInput {
  name: string;
  email: string;
  phone: string;
  notes?: string;
  /** Vehicle IDs to attach as interests at creation time. */
  interestedVehicleIds?: string[];
  budget?: number;
}

export function toServerBuyerCreatePayload(input: BuyerFormInput) {
  return {
    buyerName: input.name,
    buyerEmail: input.email,
    buyerPhone: input.phone,
    notes: input.notes ?? "",
    interestedVehicles: input.interestedVehicleIds ?? [],
    budget: input.budget,
  };
}

export interface BuyerUpdateInput {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  /** Lead status — maps to a canonical stage on save. */
  leadStatus?: ClientBuyerStatus;
  /** Direct stage write (used internally — UI prefers leadStatus). */
  stage?: ServerBuyerStage;
  assignedToId?: string | null;
  budget?: number;
}

export function toServerBuyerUpdatePayload(input: BuyerUpdateInput) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.buyerName = input.name;
  if (input.email !== undefined) out.buyerEmail = input.email;
  if (input.phone !== undefined) out.buyerPhone = input.phone;
  if (input.notes !== undefined) out.notes = input.notes;
  if (input.stage !== undefined) out.stage = input.stage;
  else if (input.leadStatus !== undefined) out.stage = leadStatusToStage(input.leadStatus);
  if (input.assignedToId !== undefined) out.assignedTo = input.assignedToId;
  if (input.budget !== undefined) out.budget = input.budget;
  return out;
}

export interface BookBuyerTestDriveInput {
  vehicleId: string;
  vehicleTitle: string;
  scheduledAt?: string; // ISO
  assignedTo?: string;
  notes?: string;
}

export interface BuyerCommunicationInput {
  channel: BuyerCommChannel;
  vehicleId?: string;
  summary: string;
  at?: string; // ISO
  /** User ObjectId of the staff member who performed this interaction. */
  byStaffId?: string;
}
