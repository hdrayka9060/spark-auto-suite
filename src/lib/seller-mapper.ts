/**
 * Seller ↔ SellerLead mapper.
 *
 * Backend `seller_leads` represents the acquisition pipeline. Each record can
 * own N vehicles — `vehicles[]` is an array of ObjectId refs into the
 * inventory collection. When the server populates the relation, each entry is
 * a full ServerVehicle. The legacy embedded vehicle fields
 * (vehicleTitle / vehicleCompany / …) are kept for backward compatibility with
 * pre-multi-vehicle records but are no longer the source of truth.
 *
 * Mapper responsibilities:
 *   - flatten address fields
 *   - map populated `vehicles[]` into SellerVehicleListing with real
 *     `vehicleId` so the UI can navigate to /inventory/:id
 *   - fall back to the legacy embedded snapshot when `vehicles[]` is empty
 *   - aggregate listing views from each vehicle's traffic counter
 */

import { ServerVehicle, Vehicle, VehicleFormInput, toClientVehicle, toServerCreatePayload } from "./vehicle-mapper";

export type ServerSellerStage =
  | "new"
  | "contacted"
  | "inspection"
  | "negotiation"
  | "sold"
  | "rejected";

export type ClientSellerStatus = "Active" | "VIP" | "Inactive";

export interface ServerSellerLead {
  _id: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  notes: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  /** Populated by the backend: each item is a full ServerVehicle when populate() ran. */
  vehicles?: (ServerVehicle | string)[];
  // Legacy embedded snapshot (optional in current schema).
  vehicleTitle?: string;
  vehicleCompany?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleKm?: number;
  askingPrice?: number;
  vehiclePhotos?: string[];
  stage: ServerSellerStage;
  inspectionDate?: string | null;
  assignedTo?: { _id: string; firstName: string; lastName: string } | string | null;
  communications: {
    _id?: string;
    type?: string;
    channel: string;
    message: string;
    sentAt: string;
    sentBy: string;
  }[];
  /** Structured audit log. Drives the Activity Timeline on the detail page. */
  activity?: {
    at: string;
    action: string;
    label: string;
    by?: string;
    meta?: Record<string, unknown>;
  }[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SellerVehicleListing {
  /** React key. */
  key: string;
  /** Real Vehicle ObjectId — links to /inventory/:vehicleId. Empty for legacy unsynced snapshots. */
  vehicleId: string;
  title: string;
  company: string;
  model: string;
  year: number;
  km: number;
  price: number;
  /** Client-side status label (e.g. "Unsold"). Falls back to the seller's status for legacy rows. */
  vehicleStatus: Vehicle["status"] | ClientSellerStatus;
  photos: string[];
  inquiries: number;
  views: number;
}

/** One logged communication, flattened for the SellerDetail Communications panel. */
export interface SellerCommunication {
  /** Subdocument ObjectId — targets the edit/delete endpoints. */
  id: string;
  /** "Email" | "SMS" | "WhatsApp" | "Call" — display label. */
  channelLabel: string;
  /** Raw channel key (email/sms/whatsapp/call). */
  channel: string;
  message: string;
  /** YYYY-MM-DD */
  date: string;
  /** ISO timestamp for sorting/precise display. */
  at: string;
}

export interface Seller {
  id: string;
  /** Short stable display code, e.g. "S-1A2B3C". Derived from the ObjectId. */
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  /** "City, State" formatted for card display. */
  locationLabel: string;
  status: ClientSellerStatus;
  stage: ServerSellerStage;
  joinedDate: string;
  notes: string;
  assignedToName?: string;
  assignedToId?: string;
  inspectionDate?: string;
  /** All real vehicles linked to this seller; falls back to the legacy embedded snapshot when empty. */
  vehiclesListed: SellerVehicleListing[];
  activeLeads: number;
  listingViews: number;
  /** Count of seller's vehicles that have been sold. */
  vehiclesSold: number;
  activity: { date: string; type: string; detail: string }[];
  /** Logged communications (email/sms/whatsapp/call), newest first. */
  communications: SellerCommunication[];
}

export const SELLER_STAGE_LABELS: Record<ServerSellerStage, string> = {
  new: "New",
  contacted: "Contacted",
  inspection: "Inspection",
  negotiation: "Negotiation",
  sold: "Sold",
  rejected: "Rejected",
};

const STAGE_TO_STATUS: Record<ServerSellerStage, ClientSellerStatus> = {
  new: "Active",
  contacted: "Active",
  inspection: "Active",
  negotiation: "Active",
  sold: "VIP",
  rejected: "Inactive",
};

const STATUS_TO_SINGLE_STAGE: Partial<Record<ClientSellerStatus, ServerSellerStage>> = {
  VIP: "sold",
  Inactive: "rejected",
  // "Active" maps to 4 stages — filtered client-side
};

export function getSellerStageQuery(status: ClientSellerStatus | "All"): ServerSellerStage | undefined {
  if (status === "All") return undefined;
  return STATUS_TO_SINGLE_STAGE[status];
}

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "Call",
  internal: "Internal",
};

/** Human label for the `action` field on each SellerLead.activity[] entry. */
const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  seller_created: "Created",
  vehicle_added: "Vehicle Added",
  vehicle_unlinked: "Vehicle Unlinked",
  inspection_scheduled: "Inspection",
  updated: "Edited",
  communication: "Communication",
  communication_edited: "Communication",
  communication_deleted: "Communication",
};

function deriveCode(id: string): string {
  return `S-${id.slice(-6).toUpperCase()}`;
}

function isPopulatedVehicle(v: ServerVehicle | string): v is ServerVehicle {
  return typeof v !== "string" && Boolean(v) && "title" in v;
}

export function toClientSeller(s: ServerSellerLead): Seller {
  const status = STAGE_TO_STATUS[s.stage] ?? "Active";
  const assignee = typeof s.assignedTo === "string" || !s.assignedTo ? null : s.assignedTo;

  // Prefer the structured activity[] log (created/edited/vehicle/inspection
  // events); fall back to legacy communications[] for sellers that pre-date
  // the activity field.
  const activity = s.activity?.length
    ? [...s.activity]
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .map((a) => ({
          date: a.at?.slice(0, 10) ?? "",
          type: ACTIVITY_ACTION_LABEL[a.action] ?? a.action,
          detail: a.label,
        }))
    : (s.communications ?? []).map((c) => ({
        date: c.sentAt?.slice(0, 10) ?? "",
        type: CHANNEL_LABEL[c.channel] ?? c.channel,
        detail: c.message ?? "",
      }));

  const realVehicles = (s.vehicles ?? []).filter(isPopulatedVehicle);
  const populatedListings: SellerVehicleListing[] = realVehicles.map((v) => {
    const client = toClientVehicle(v);
    return {
      key: v._id,
      vehicleId: v._id,
      title: client.title,
      company: client.company,
      model: client.model,
      year: client.year,
      km: client.km,
      price: client.price,
      vehicleStatus: client.status,
      photos: v.photos ?? [],
      inquiries: v.traffic?.inquiries ?? 0,
      views: v.traffic?.views ?? 0,
    };
  });

  // Fallback to the legacy single embedded snapshot if no real vehicles are linked yet.
  const hasLegacySnapshot =
    !populatedListings.length &&
    Boolean(s.vehicleTitle || s.vehicleCompany || s.vehicleModel);

  const listings: SellerVehicleListing[] = hasLegacySnapshot
    ? [
        {
          key: `${s._id}-legacy`,
          vehicleId: "", // not yet synced to inventory
          title: s.vehicleTitle ?? "",
          company: s.vehicleCompany ?? "",
          model: s.vehicleModel ?? "",
          year: s.vehicleYear ?? 0,
          km: s.vehicleKm ?? 0,
          price: s.askingPrice ?? 0,
          vehicleStatus: status,
          photos: s.vehiclePhotos ?? [],
          inquiries: 0,
          views: 0,
        },
      ]
    : populatedListings;

  const listingViews = populatedListings.reduce((sum, l) => sum + l.views, 0);
  const totalInquiries = populatedListings.reduce((sum, l) => sum + l.inquiries, 0);
  const vehiclesSold = populatedListings.filter((l) => l.vehicleStatus === "Sold").length;

  const communications: SellerCommunication[] = [...(s.communications ?? [])]
    .filter((c) => c && c.message)
    .sort((a, b) => (String(a.sentAt) < String(b.sentAt) ? 1 : -1))
    .map((c) => ({
      id: c._id ?? "",
      channel: c.channel,
      channelLabel: CHANNEL_LABEL[c.channel] ?? c.channel,
      message: c.message ?? "",
      date: c.sentAt?.slice(0, 10) ?? "",
      at: c.sentAt ?? "",
    }));

  const address = s.address ?? "";
  const city = s.city ?? "";
  const state = s.state ?? "";
  const locationLabel = [city, state].filter(Boolean).join(", ");

  return {
    id: s._id,
    code: deriveCode(s._id),
    name: s.sellerName,
    email: s.sellerEmail,
    phone: s.sellerPhone,
    address,
    city,
    state,
    zipCode: s.zipCode ?? "",
    country: s.country ?? "",
    locationLabel,
    status,
    stage: s.stage,
    joinedDate: s.createdAt.slice(0, 10),
    notes: s.notes ?? "",
    assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : undefined,
    assignedToId: typeof s.assignedTo === "string" ? s.assignedTo : assignee?._id,
    inspectionDate: s.inspectionDate ?? undefined,
    vehiclesListed: listings,
    // "Active leads" is a rough proxy = vehicles with inquiries > 0. The
    // server doesn't surface a per-seller-lead count, and joining on /leads
    // would be a separate query; this stays accurate-enough as a card stat.
    activeLeads: populatedListings.filter((l) => l.inquiries > 0).length || totalInquiries,
    listingViews,
    vehiclesSold,
    activity,
    communications,
  };
}

// ── Write direction ────────────────────────────────────────────────────────

/** Same shape as the Inventory "Add Vehicle" form — keeps both flows aligned. */
export type SellerVehicleFormInput = VehicleFormInput;

export interface SellerFormInput {
  name: string;
  email: string;
  phone: string;
  notes?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  /** Optional vehicles to create + link at seller creation time. */
  vehicles?: SellerVehicleFormInput[];
}

export function toServerSellerCreatePayload(input: SellerFormInput) {
  const out: Record<string, unknown> = {
    sellerName: input.name,
    sellerEmail: input.email,
    sellerPhone: input.phone,
  };
  if (input.notes) out.notes = input.notes;
  if (input.address) out.address = input.address;
  if (input.city) out.city = input.city;
  if (input.state) out.state = input.state;
  if (input.zipCode) out.zipCode = input.zipCode;
  if (input.country) out.country = input.country;
  if (input.vehicles?.length) out.vehicles = input.vehicles.map(toServerVehiclePayload);
  return out;
}

/** Reuse the canonical inventory payload mapper so all vehicle field translations stay in one place. */
export function toServerVehiclePayload(input: SellerVehicleFormInput) {
  return toServerCreatePayload(input);
}

export interface SellerUpdateInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  stage?: ServerSellerStage;
  notes?: string;
  assignedToId?: string | null;
  askingPrice?: number;
  inspectionDate?: string;
}

export function toServerSellerUpdatePayload(input: SellerUpdateInput) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.sellerName = input.name;
  if (input.email !== undefined) out.sellerEmail = input.email;
  if (input.phone !== undefined) out.sellerPhone = input.phone;
  if (input.address !== undefined) out.address = input.address;
  if (input.city !== undefined) out.city = input.city;
  if (input.state !== undefined) out.state = input.state;
  if (input.zipCode !== undefined) out.zipCode = input.zipCode;
  if (input.country !== undefined) out.country = input.country;
  if (input.stage !== undefined) out.stage = input.stage;
  if (input.notes !== undefined) out.notes = input.notes;
  if (input.assignedToId !== undefined) out.assignedTo = input.assignedToId;
  if (input.askingPrice !== undefined) out.askingPrice = input.askingPrice;
  if (input.inspectionDate !== undefined) out.inspectionDate = input.inspectionDate;
  return out;
}

export type SellerCommunicationChannel = "email" | "sms" | "whatsapp" | "call";
