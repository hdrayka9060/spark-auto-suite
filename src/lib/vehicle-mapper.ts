/**
 * Bidirectional mapping between the backend Mongoose Vehicle shape and the
 * frontend Vehicle prototype type. Centralizes:
 *  - field renames (_id ↔ id, photos ↔ gallery)
 *  - case differences (lowercase enum ↔ Title-case label)
 *  - shape mismatches (traffic ↔ activity, audit history ↔ narrative history)
 *  - defaults for fields the backend doesn't track yet (testDrives, favorites, logs)
 *
 * Free-text fuel/transmission from the VIN decoder are normalized to the backend
 * enum on write, and pretty-printed back on read.
 */

export type ServerVehicleStatus =
  | "new"
  | "inspection"
  | "unsold"
  | "test_drive"
  | "reserved"
  | "pending"
  | "sold";
export type ServerHosting = "self" | "platform";
export type ServerFuelType = "petrol" | "diesel" | "electric" | "hybrid" | "cng";
export type ServerTransmission = "manual" | "automatic" | "cvt";

/**
 * Canonical body-type list rendered by every vehicle form. Kept short on
 * purpose so the dropdown stays scannable — the NHTSA VIN decoder returns
 * dozens of free-text values, all of which get squashed onto one of these
 * via `normalizeBodyType` below.
 *
 * Stored as-is on the backend (`Vehicle.bodyType: string`) — the backend
 * doesn't enforce the enum so legacy / VIN-decoded freeform values still
 * round-trip cleanly.
 */
export const ALL_BODY_TYPES = [
  "Sedan", "SUV", "Truck", "Pickup", "Coupe", "Hatchback",
  "Convertible", "Wagon", "Van", "Minivan", "Crossover", "Other",
] as const;
export type BodyType = typeof ALL_BODY_TYPES[number];

/**
 * Coerce any free-text body-type string (NHTSA VIN response, CSV import,
 * legacy data) onto the canonical list. "Other" is the safety net so an
 * unrecognised value never breaks the dropdown.
 *
 * Order matters: "pickup" must check before "truck" since some NHTSA
 * BodyClass values include both words.
 */
export function normalizeBodyType(raw: string | null | undefined): BodyType {
  if (!raw) return "Other";
  const s = raw.toLowerCase();
  if (s.includes("pickup")) return "Pickup";
  if (s.includes("truck")) return "Truck";
  if (s.includes("sedan") || s.includes("saloon")) return "Sedan";
  if (s.includes("suv") || s.includes("sport utility")) return "SUV";
  if (s.includes("coupe")) return "Coupe";
  if (s.includes("hatchback") || s.includes("hatch")) return "Hatchback";
  if (s.includes("convertible") || s.includes("roadster") || s.includes("cabriolet")) return "Convertible";
  if (s.includes("wagon") || s.includes("estate")) return "Wagon";
  if (s.includes("minivan") || s.includes("mpv")) return "Minivan";
  if (s.includes("crossover")) return "Crossover";
  if (s.includes("van")) return "Van";
  // If the raw value already matches one of our canonical entries (e.g. "Sedan"
  // typed by hand), pick it up verbatim.
  const exact = ALL_BODY_TYPES.find((t) => t.toLowerCase() === s);
  return (exact as BodyType) ?? "Other";
}

export interface ServerVehicle {
  _id: string;
  vehicleNumber: string;
  title: string;
  description: string;
  photos: string[];
  company: string;
  model: string;
  year: number;
  km: number;
  price: number;
  discount: number;
  costPrice?: number;
  soldAt?: number;
  soldDate?: string | null;
  owners: number;
  fuelType?: ServerFuelType;
  transmission?: ServerTransmission;
  color: string;
  vin: string;
  bodyType: string;
  trim: string;
  engine: string;
  status: ServerVehicleStatus;
  hosting: ServerHosting;
  features: string[];
  history: { field: string; value: string; changedAt: string; changedBy: string }[];
  traffic: { views: number; clicks: number; inquiries: number; lastViewed?: string };
  addedBy?: { _id: string; firstName: string; lastName: string; email: string };
  seller?:
    | { _id: string; sellerName: string; sellerEmail?: string; sellerPhone?: string }
    | string
    | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  title: string;
  company: string;
  model: string;
  year: number;
  km: number;
  price: number;
  discount: number;
  costPrice: number;
  soldAt: number;
  soldDate: string | null;
  owners: number;
  status: "New" | "Inspection" | "Unsold" | "Test Drive" | "Reserved" | "Pending" | "Sold";
  hosting: "Self" | "Platform";
  image: string;
  description: string;
  vin: string;
  color: string;
  fuel: string;
  transmission: string;
  bodyType: string;
  trim: string;
  engine: string;
  gallery: string[];
  history: { date: string; event: string; detail: string }[];
  activity: { views: number; inquiries: number; testDrives: number; favorites: number };
  logs: { date: string; type: string; description: string }[];
  /** Display name of the seller this vehicle came from. "Self" = in-house / no SellerLead linked. */
  sellerName: string;
  /** Real SellerLead ObjectId for navigation; empty string when "Self". */
  sellerId: string;
}

/** Form payload from the "Add Vehicle" UI. */
export interface VehicleFormInput {
  title: string;
  company: string;
  model: string;
  year: number;
  km?: number;
  price: number;
  discount?: number;
  costPrice?: number;
  owners?: number;
  /** Free-text from VIN decoder ("Gasoline", "Electric", ...) — normalized on write. */
  fuel?: string;
  /** Free-text from VIN decoder ("8-Speed Automatic", "CVT", ...) — normalized on write. */
  transmission?: string;
  color?: string;
  vin?: string;
  bodyType?: string;
  trim?: string;
  engine?: string;
  description?: string;
  hosting?: "Self" | "Platform";
}

// ── Capitalization helpers ────────────────────────────────────────────────

const capitalize = (s?: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const STATUS_TO_CLIENT: Record<ServerVehicleStatus, Vehicle["status"]> = {
  new: "New",
  inspection: "Inspection",
  unsold: "Unsold",
  test_drive: "Test Drive",
  reserved: "Reserved",
  pending: "Pending",
  sold: "Sold",
};
const STATUS_TO_SERVER: Record<Vehicle["status"], ServerVehicleStatus> = {
  New: "new",
  Inspection: "inspection",
  Unsold: "unsold",
  "Test Drive": "test_drive",
  Reserved: "reserved",
  Pending: "pending",
  Sold: "sold",
};

/** Canonical ordered list of all client-facing statuses (used by filter pills + dropdowns). */
export const ALL_VEHICLE_STATUSES: Vehicle["status"][] = [
  "New",
  "Inspection",
  "Unsold",
  "Test Drive",
  "Reserved",
  "Pending",
  "Sold",
];

/** Color theme per status — used by Inventory cards/table + VehicleDetail badge. */
export const VEHICLE_STATUS_BADGE_CLASS: Record<Vehicle["status"], string> = {
  New: "bg-cyan-100 text-cyan-700",
  Inspection: "bg-violet-100 text-violet-700",
  Unsold: "bg-blue-100 text-blue-700",
  "Test Drive": "bg-amber-100 text-amber-700",
  Reserved: "bg-orange-100 text-orange-700",
  Pending: "bg-yellow-100 text-yellow-800",
  Sold: "bg-emerald-100 text-emerald-700",
};

const HOSTING_TO_CLIENT: Record<ServerHosting, Vehicle["hosting"]> = {
  self: "Self",
  platform: "Platform",
};
const HOSTING_TO_SERVER: Record<Vehicle["hosting"], ServerHosting> = {
  Self: "self",
  Platform: "platform",
};

// ── Normalization (free-text VIN decoder output → backend enum) ───────────

/**
 * Best-effort mapping from free-text fuel ("Gasoline", "Electric", "Hybrid Gas/Electric")
 * to the backend FuelType enum. Returns undefined if no match — caller decides
 * whether to omit the field entirely.
 */
export function normalizeFuelType(input?: string): ServerFuelType | undefined {
  if (!input) return undefined;
  const s = input.toLowerCase();
  if (s.includes("electric") && !s.includes("hybrid")) return "electric";
  if (s.includes("hybrid")) return "hybrid";
  if (s.includes("diesel")) return "diesel";
  if (s.includes("cng") || s.includes("compressed natural")) return "cng";
  if (s.includes("gas") || s.includes("petrol")) return "petrol";
  return undefined;
}

/**
 * Maps free-text transmission ("8-Speed Automatic", "CVT", "6-Speed Manual")
 * to the backend Transmission enum.
 */
export function normalizeTransmission(input?: string): ServerTransmission | undefined {
  if (!input) return undefined;
  const s = input.toLowerCase();
  if (s.includes("cvt")) return "cvt";
  if (s.includes("manual")) return "manual";
  if (s.includes("automatic") || s.includes("auto") || /\d-spd/.test(s)) return "automatic";
  return undefined;
}

// ── Read direction: ServerVehicle → Vehicle ───────────────────────────────

const FALLBACK_IMAGE = "🚗";

export function toClientVehicle(s: ServerVehicle): Vehicle {
  const sellerObj = typeof s.seller === "string" || !s.seller ? null : s.seller;
  return {
    id: s._id,
    title: s.title,
    company: s.company,
    model: s.model,
    year: s.year,
    km: s.km,
    price: s.price,
    discount: s.discount ?? 0,
    costPrice: s.costPrice ?? 0,
    soldAt: s.soldAt ?? 0,
    soldDate: s.soldDate ?? null,
    owners: s.owners,
    status: STATUS_TO_CLIENT[s.status] ?? "Unsold",
    hosting: HOSTING_TO_CLIENT[s.hosting] ?? "Platform",
    image: s.photos?.[0] ?? FALLBACK_IMAGE,
    description: s.description ?? "",
    vin: s.vin ?? "",
    color: s.color ?? "",
    fuel: capitalize(s.fuelType),
    transmission: capitalize(s.transmission),
    bodyType: s.bodyType ?? "",
    trim: s.trim ?? "",
    engine: s.engine ?? "",
    gallery: s.photos?.length ? s.photos : [FALLBACK_IMAGE],
    history: (s.history ?? []).map((h) => ({
      date: h.changedAt?.slice(0, 10) ?? "",
      event: `Updated ${h.field}`,
      detail: `New value: ${h.value}`,
    })),
    activity: {
      views: s.traffic?.views ?? 0,
      inquiries: s.traffic?.inquiries ?? 0,
      testDrives: 0, // not tracked by backend yet; wire from buyer_leads in Phase 3
      favorites: 0,  // not tracked yet
    },
    logs: [], // populated separately via communication_logs (see useVehicleActivityLogs)
    sellerName: sellerObj?.sellerName ?? "Self",
    sellerId: sellerObj?._id ?? "",
  };
}

// ── Write direction: form → CreateVehicleDto-shaped server payload ────────

export interface ServerCreateVehiclePayload {
  title: string;
  company: string;
  model: string;
  year: number;
  price: number;
  km?: number;
  discount?: number;
  costPrice?: number;
  owners?: number;
  fuelType?: ServerFuelType;
  transmission?: ServerTransmission;
  color?: string;
  vin?: string;
  bodyType?: string;
  trim?: string;
  engine?: string;
  description?: string;
  hosting?: ServerHosting;
}

export function toServerCreatePayload(input: VehicleFormInput): ServerCreateVehiclePayload {
  const payload: ServerCreateVehiclePayload = {
    title: input.title,
    company: input.company,
    model: input.model,
    year: input.year,
    price: input.price,
  };
  if (input.km !== undefined) payload.km = input.km;
  if (input.discount !== undefined) payload.discount = input.discount;
  if (input.costPrice !== undefined) payload.costPrice = input.costPrice;
  if (input.owners !== undefined) payload.owners = input.owners;
  if (input.color) payload.color = input.color;
  if (input.vin) payload.vin = input.vin;
  if (input.bodyType) payload.bodyType = input.bodyType;
  if (input.trim) payload.trim = input.trim;
  if (input.engine) payload.engine = input.engine;
  if (input.description) payload.description = input.description;
  if (input.hosting) payload.hosting = HOSTING_TO_SERVER[input.hosting];
  const fuel = normalizeFuelType(input.fuel);
  if (fuel) payload.fuelType = fuel;
  const trans = normalizeTransmission(input.transmission);
  if (trans) payload.transmission = trans;
  return payload;
}

/** Partial update — accepts a Vehicle (client shape) and produces only the changed fields. */
export interface ServerUpdateVehiclePayload {
  title?: string;
  description?: string;
  company?: string;
  model?: string;
  year?: number;
  price?: number;
  discount?: number;
  costPrice?: number;
  status?: ServerVehicleStatus;
  hosting?: ServerHosting;
  color?: string;
  vin?: string;
  bodyType?: string;
  fuelType?: ServerFuelType;
  transmission?: ServerTransmission;
  km?: number;
  owners?: number;
}

export function vehicleStatusToServer(status: Vehicle["status"]): ServerVehicleStatus {
  return STATUS_TO_SERVER[status];
}

// ── Pagination envelope (from backend's PaginatedResult<T>) ───────────────

export interface PaginatedServerResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
