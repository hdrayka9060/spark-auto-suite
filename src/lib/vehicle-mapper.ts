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

// Vehicle lifecycle collapsed to New / Sold / no-status(""). "" = available.
export type ServerVehicleStatus = "new" | "sold" | "";
export type ServerHosting = "self" | "platform";
export type ServerFuelType = "petrol" | "diesel" | "electric" | "hybrid" | "cng";
export type ServerTransmission = "manual" | "automatic" | "cvt";

/**
 * Dropdown option lists for the vehicle forms. Fuel + Transmission values ARE
 * the backend enum values (so they persist verbatim); the label is display-only.
 */
export const FUEL_OPTIONS: { value: ServerFuelType; label: string }[] = [
  { value: "petrol", label: "Petrol / Gasoline" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
  { value: "cng", label: "CNG" },
];
export const TRANSMISSION_OPTIONS: { value: ServerTransmission; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "cvt", label: "CVT" },
];

/**
 * Engine configurations offered by the vehicle form's Engine dropdown. Kept
 * coarse on purpose; anything the VIN decoder returns that doesn't match one of
 * these (e.g. "2.5L · 4-cyl · 170hp") is handled via the form's "Other" escape,
 * which keeps the free-text detail rather than discarding it.
 */
export const ENGINE_OPTIONS = [
  "3-Cylinder", "4-Cylinder", "5-Cylinder", "6-Cylinder",
  "V6", "V8", "V10", "V12", "Electric", "Hybrid", "Rotary",
] as const;

/** Drive-configuration options (VIN decoder normalizes NHTSA DriveType onto these). */
export const DRIVETRAIN_OPTIONS = ["FWD", "RWD", "AWD", "4X4"] as const;

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
  drivetrain?: string;
  engineSize?: string;
  interiorColor?: string;
  doors?: number;
  status: ServerVehicleStatus;
  hosting: ServerHosting;
  /** Deliberate "show on public dealer website" flag. */
  publishedToWebsite?: boolean;
  features: string[];
  history: { field: string; value: string; changedAt: string; changedBy: string }[];
  spends?: { _id: string; amount: number; category: string; description: string; date: string; by?: string }[];
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
  /** "Available" = no status (no badge). Only New / Sold carry a badge. */
  status: "New" | "Sold" | "Available";
  hosting: "Self" | "Platform";
  /** Whether the vehicle is published on the public dealer website. */
  published: boolean;
  image: string;
  description: string;
  vin: string;
  color: string;
  fuel: string;
  transmission: string;
  bodyType: string;
  trim: string;
  engine: string;
  drivetrain: string;
  engineSize: string;
  interiorColor: string;
  doors: number;
  /** ISO timestamp the vehicle was added — drives the "New this week" tag. */
  createdAt: string;
  gallery: string[];
  history: { date: string; event: string; detail: string }[];
  /** Reconditioning spends recorded before the sale (cost-of-goods). */
  spends: VehicleSpend[];
  /** Σ(spends.amount) — convenience for the Spends tab + cost-basis display. */
  totalSpend: number;
  activity: { views: number; inquiries: number; testDrives: number; favorites: number };
  logs: { date: string; type: string; description: string }[];
  /** Display name of the seller this vehicle came from. "Self" = in-house / no SellerLead linked. */
  sellerName: string;
  /** Real SellerLead ObjectId for navigation; empty string when "Self". */
  sellerId: string;
}

/** One reconditioning spend recorded against a vehicle (client shape). */
export interface VehicleSpend {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  by: string;
}

/** Categories offered by the Add Spend form. Stored verbatim on the backend. */
export const SPEND_CATEGORIES = [
  "Repair", "Service", "Parts", "Transport", "Detailing", "Other",
] as const;
export type SpendCategory = typeof SPEND_CATEGORIES[number];

/** Form payload from the Add Spend dialog. */
export interface VehicleSpendInput {
  amount: number;
  category?: string;
  description?: string;
  date?: string; // YYYY-MM-DD
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
  /** Drive configuration ("FWD" / "AWD" / "4X4" / "RWD"). */
  drivetrain?: string;
  /** Engine displacement, e.g. "2.5 L". */
  engineSize?: string;
  /** Interior colour (exterior colour is `color`). */
  interiorColor?: string;
  /** Number of doors. */
  doors?: number;
  description?: string;
  hosting?: "Self" | "Platform";
  /** Linked SellerLead id. Required when hosting = Platform. */
  seller?: string | null;
}

// ── Capitalization helpers ────────────────────────────────────────────────

const capitalize = (s?: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const STATUS_TO_CLIENT: Record<ServerVehicleStatus, Vehicle["status"]> = {
  new: "New",
  sold: "Sold",
  "": "Available",
};
const STATUS_TO_SERVER: Record<Vehicle["status"], ServerVehicleStatus> = {
  New: "new",
  Sold: "sold",
  Available: "",
};

/** Canonical ordered list of all client-facing statuses (used by filter pills + dropdowns). */
export const ALL_VEHICLE_STATUSES: Vehicle["status"][] = [
  "New",
  "Available",
  "Sold",
];

/**
 * Color theme per status — used by Inventory cards/table + VehicleDetail badge.
 * "Available" (no status) intentionally has no badge styling; render sites
 * should skip the badge entirely for it.
 */
export const VEHICLE_STATUS_BADGE_CLASS: Record<Vehicle["status"], string> = {
  New: "bg-cyan-100 text-cyan-700",
  Available: "",
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

// ── VIN decode (server /inventory/vin/:vin/decode → Add-Vehicle form patch) ─

/**
 * Shape returned by the backend VinDecodeService.decodeOne (NHTSA vPIC).
 * `bodyType` arrives already normalized to ALL_BODY_TYPES, so it pre-selects in
 * the dropdown; `fuel`/`transmission` are raw display strings that the form's
 * submit mapper (`toServerCreatePayload`) coerces to the backend enums.
 */
export interface DecodedVin {
  vin: string;
  make?: string;
  model?: string;
  modelYear?: number;
  trim?: string;
  engine?: string;
  fuel?: string;
  transmission?: string;
  bodyType?: string;
  drivetrain?: string;
  engineSize?: string;
  doors?: number;
  plant?: string;
  country?: string;
  title?: string;
}

/**
 * Convert a server VIN-decode result into a partial Add-Vehicle form patch.
 * Only non-empty fields are returned, so spreading it over the form
 * (`{ ...form, ...patch }`) never clobbers a value the user already typed.
 */
export function decodedVinToFormPatch(d: DecodedVin): Record<string, string> {
  const p: Record<string, string> = {};
  if (d.make) p.company = d.make;
  if (d.model) p.model = d.model;
  if (d.modelYear) p.year = String(d.modelYear);
  if (d.trim) p.trim = d.trim;
  if (d.engine) p.engine = d.engine;
  // Normalize the raw NHTSA fuel/transmission strings to the backend enum values
  // so the form's dropdowns pre-select instead of showing a blank (the option
  // values ARE the enum values). Falls back to leaving the field untouched.
  if (d.fuel) {
    const f = normalizeFuelType(d.fuel);
    if (f) p.fuel = f;
  }
  if (d.transmission) {
    const t = normalizeTransmission(d.transmission);
    if (t) p.transmission = t;
  }
  if (d.bodyType) p.bodyType = d.bodyType;
  if (d.drivetrain) p.drivetrain = d.drivetrain;
  if (d.engineSize) p.engineSize = d.engineSize;
  if (d.doors !== undefined && d.doors !== null) p.doors = String(d.doors);
  if (d.plant) p.plant = d.plant;
  if (d.country) p.country = d.country;
  if (d.title) p.title = d.title;
  return p;
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
    status: STATUS_TO_CLIENT[s.status] ?? "Available",
    hosting: HOSTING_TO_CLIENT[s.hosting] ?? "Platform",
    // Default true for legacy docs written before the flag existed.
    published: s.publishedToWebsite ?? true,
    image: s.photos?.[0] ?? FALLBACK_IMAGE,
    description: s.description ?? "",
    vin: s.vin ?? "",
    color: s.color ?? "",
    fuel: capitalize(s.fuelType),
    transmission: capitalize(s.transmission),
    bodyType: s.bodyType ?? "",
    trim: s.trim ?? "",
    engine: s.engine ?? "",
    drivetrain: s.drivetrain ?? "",
    engineSize: s.engineSize ?? "",
    interiorColor: s.interiorColor ?? "",
    doors: s.doors ?? 0,
    createdAt: s.createdAt ?? "",
    gallery: s.photos?.length ? s.photos : [FALLBACK_IMAGE],
    history: (s.history ?? []).map((h) => ({
      date: h.changedAt?.slice(0, 10) ?? "",
      event: `Updated ${h.field}`,
      detail: `New value: ${h.value}`,
    })),
    spends: (s.spends ?? []).map((sp) => ({
      id: sp._id,
      amount: sp.amount ?? 0,
      category: sp.category || "Other",
      description: sp.description ?? "",
      date: sp.date?.slice(0, 10) ?? "",
      by: sp.by ?? "",
    })),
    totalSpend: (s.spends ?? []).reduce((acc, sp) => acc + (sp.amount ?? 0), 0),
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
  drivetrain?: string;
  engineSize?: string;
  interiorColor?: string;
  doors?: number;
  description?: string;
  hosting?: ServerHosting;
  seller?: string | null;
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
  if (input.drivetrain) payload.drivetrain = input.drivetrain;
  if (input.engineSize) payload.engineSize = input.engineSize;
  if (input.interiorColor) payload.interiorColor = input.interiorColor;
  if (input.doors !== undefined) payload.doors = input.doors;
  if (input.description) payload.description = input.description;
  if (input.hosting) payload.hosting = HOSTING_TO_SERVER[input.hosting];
  // Only send a seller link when one is actually chosen. Empty string / null =
  // "Self" (in-house), which the backend treats as no seller.
  if (input.seller) payload.seller = input.seller;
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
  publishedToWebsite?: boolean;
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
