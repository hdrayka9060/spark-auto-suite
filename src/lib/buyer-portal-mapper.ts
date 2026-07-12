/**
 * Buyer Portal mapper. Translates the public `GET /website/portal/:id` payload
 * into the shape the portal page renders.
 *
 * The endpoint is unauthenticated and intentionally minimal (first name only,
 * comms = channel + date with NO summary text). This mapper only does light
 * normalization — chiefly resolving the vehicle's first photo to an absolute
 * URL via `fileUrl` (S3 URLs pass through; legacy /uploads paths get the
 * backend origin) — plus the journey-status → stepper mapping.
 */
import { fileUrl } from "@/lib/api";

export type PortalJourneyStatus =
  | "new"
  | "contacted"
  | "test_drive"
  | "negotiation"
  | "closed"
  | "archived";

export type PortalApptType = "test_drive" | "inspection" | "meeting" | "other";
export type PortalApptStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface ServerPortalAppointment {
  type: PortalApptType;
  title: string;
  start: string;
  end: string;
  meetingType: "physical" | "virtual";
  location: string;
  meetLink: string;
  status: PortalApptStatus;
}

export interface ServerPortalComm {
  date: string;
  channel: string;
  summary?: string;
}

export interface ServerPortalVehicle {
  title: string;
  company: string;
  model: string;
  year: number;
  km: number;
  price: number;
  photos: string[];
  fuelType: string;
  transmission: string;
  color: string;
  bodyType: string;
  status: string;
}

export interface ServerBuyerPortal {
  buyer: { firstName: string };
  journeyStatus: PortalJourneyStatus;
  offer: { askedPrice: number } | null;
  vehicle: ServerPortalVehicle;
  sold: {
    isSold: boolean;
    soldToThisBuyer: boolean;
    soldPrice?: number;
    soldDate?: string | null;
  };
  appointments: ServerPortalAppointment[];
  communications: ServerPortalComm[];
  dealer: { name: string; phone: string; email: string; address: string } | null;
  browseUrl: string;
}

export interface BuyerPortalData extends Omit<ServerBuyerPortal, "vehicle"> {
  vehicle: ServerPortalVehicle & { photoUrl: string };
}

export function toClientBuyerPortal(s: ServerBuyerPortal): BuyerPortalData {
  return {
    ...s,
    vehicle: {
      ...s.vehicle,
      photoUrl: s.vehicle.photos?.length ? fileUrl(s.vehicle.photos[0]) : "",
    },
  };
}

// ── Journey stepper ──────────────────────────────────────────────────────────

export const BUYER_STEPS = [
  { key: "interested", label: "Interested" },
  { key: "contacted", label: "Contacted" },
  { key: "test_drive", label: "Test Drive" },
  { key: "negotiation", label: "Negotiation" },
  { key: "purchased", label: "Purchased" },
];

const STATUS_TO_STEP: Record<PortalJourneyStatus, string> = {
  // "Interested" is always shown completed: the tracking link is only sent
  // after the buyer has been contacted, so the floor is "contacted".
  new: "contacted",
  contacted: "contacted",
  test_drive: "test_drive",
  negotiation: "negotiation",
  closed: "purchased",
  archived: "contacted",
};

export function stepKeyForStatus(status: PortalJourneyStatus): string {
  return STATUS_TO_STEP[status] ?? "interested";
}

// ── Display helpers ──────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<string, string> = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  offline: "In person",
};
export const channelLabel = (c: string): string =>
  CHANNEL_LABEL[c] ?? (c ? c[0].toUpperCase() + c.slice(1) : "Contact");

const APPT_TYPE_LABEL: Record<PortalApptType, string> = {
  test_drive: "Test drive",
  inspection: "Inspection",
  meeting: "Meeting",
  other: "Appointment",
};
export const apptTypeLabel = (t: PortalApptType): string => APPT_TYPE_LABEL[t] ?? "Appointment";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";
export const apptStatusTone = (s: PortalApptStatus): BadgeTone =>
  s === "completed" ? "success" : s === "cancelled" ? "danger" : s === "no_show" ? "warning" : "info";

/** Title-case a lowercase enum value (e.g. "automatic" → "Automatic"). */
export const titleCase = (v: string): string =>
  v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
