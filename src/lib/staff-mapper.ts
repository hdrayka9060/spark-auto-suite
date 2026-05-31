/**
 * Mapper for the Staff Management surface. Server returns User documents
 * (with populated `roleId` Role doc); frontend wants a flat shape with a
 * derived full name, friendly status label, and badge classes.
 *
 * Backend status enum: 'active' | 'inactive' | 'suspended' | 'invited'
 * Frontend status label: 'Active' | 'Inactive' | 'Suspended' | 'Invited'
 *
 * Note: there's an older read-only mapper in use-staff.ts that produces a
 * compact `StaffOption` for dropdowns. This module is for the FULL staff
 * record needed by the management page (avatar initials, joined date,
 * status badge, etc.).
 */

export type ServerStaffStatus = "active" | "inactive" | "suspended" | "invited";

export interface ServerStaff {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  avatar?: string;
  status?: ServerStaffStatus;
  /** When populated by the backend, this is the Role document. Some legacy
   *  rows may have a string id; we treat that as "unknown role". */
  roleId?: { _id: string; name: string; description?: string } | string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientStaffStatus = "Active" | "Invited" | "Inactive" | "Suspended";

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  /** "First Last" — falls back to email when names are absent. */
  fullName: string;
  email: string;
  phone: string;
  department: string;
  avatar: string;
  status: ClientStaffStatus;
  roleId: string | null;
  roleName: string;
  /** YYYY-MM-DD slice of createdAt — matches how other modules render dates. */
  joinedDate: string;
  /** Best-effort "last active" — backend doesn't track logins, so we surface
   *  updatedAt as a proxy. UI labels it "last active" but is honest about
   *  the limitation in tooltips. */
  lastActive: string;
}

const STATUS_TO_CLIENT: Record<ServerStaffStatus, ClientStaffStatus> = {
  active: "Active",
  invited: "Invited",
  inactive: "Inactive",
  suspended: "Suspended",
};

const STATUS_TO_SERVER: Record<ClientStaffStatus, ServerStaffStatus> = {
  Active: "active",
  Invited: "invited",
  Inactive: "inactive",
  Suspended: "suspended",
};

export const STAFF_STATUSES: ClientStaffStatus[] = ["Active", "Invited", "Inactive", "Suspended"];

/**
 * Tailwind utility classes for the status badge. Mirrors the pattern in
 * other mappers (lead-mapper, ticket-mapper).
 */
export const STAFF_STATUS_BADGE_CLASS: Record<ClientStaffStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Invited: "bg-amber-100 text-amber-700",
  Inactive: "bg-slate-100 text-slate-700",
  Suspended: "bg-red-100 text-red-700",
};

export function staffStatusToServer(status: ClientStaffStatus): ServerStaffStatus {
  return STATUS_TO_SERVER[status];
}

function shortDate(iso?: string): string {
  if (!iso) return "—";
  // Mongo timestamps are ISO; slice to YYYY-MM-DD without timezone math.
  // (Same trick as fmtDate avoids the toISOString TZ drift bug.)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toClientStaff(server: ServerStaff): Staff {
  const first = server.firstName ?? "";
  const last = server.lastName ?? "";
  const fullName = `${first} ${last}`.trim() || server.email;

  // roleId is either a populated Role object or a raw string id.
  const populatedRole =
    server.roleId && typeof server.roleId === "object" ? server.roleId : null;
  const rawRoleId =
    populatedRole?._id ??
    (typeof server.roleId === "string" ? server.roleId : null);
  const roleName = populatedRole?.name ?? "—";

  const serverStatus: ServerStaffStatus = server.status ?? "active";
  return {
    id: server._id,
    firstName: first,
    lastName: last,
    fullName,
    email: server.email,
    phone: server.phone ?? "",
    department: server.department ?? "",
    avatar: server.avatar ?? "",
    status: STATUS_TO_CLIENT[serverStatus] ?? "Active",
    roleId: rawRoleId,
    roleName,
    joinedDate: shortDate(server.createdAt),
    lastActive: shortDate(server.updatedAt),
  };
}

/** Initials for an avatar circle. "John Doe" → "JD", falls back to first letter of email. */
export function staffInitials(s: { firstName?: string; lastName?: string; email?: string }): string {
  const first = (s.firstName ?? "").trim();
  const last = (s.lastName ?? "").trim();
  if (first || last) {
    const f = first.charAt(0).toUpperCase();
    const l = last.charAt(0).toUpperCase();
    return (f + l) || (s.email ?? "?").charAt(0).toUpperCase();
  }
  return (s.email ?? "?").charAt(0).toUpperCase();
}

/**
 * Build the sample bulk-upload CSV content. Frontend-generated so the schema
 * stays a single source of truth (no extra backend endpoint to drift).
 *
 * Column order MUST match what UsersService.bulkInvite parses:
 *   firstName, lastName, email, phone, department, role
 *
 * `role` must match a Role's `name` exactly (case-insensitive) — the example
 * rows use seeded role names so the file works out of the box. `department`
 * and `phone` are optional (blank cells are accepted).
 */
export function buildSampleStaffCsv(): string {
  const header = "firstName,lastName,email,phone,department,role";
  const rows = [
    "John,Doe,john.doe@example.com,555-0100,Sales,Sales Staff",
    "Jane,Smith,jane.smith@example.com,555-0101,Sales,Sales Manager",
    "Maria,Lopez,maria.lopez@example.com,,Service,Support",
  ];
  return [header, ...rows].join("\n") + "\n";
}

/**
 * Column metadata for the Sample-CSV UI hint card. Kept here next to the
 * sample-builder so the docs and the actual columns can't drift.
 */
export const STAFF_CSV_COLUMNS: {
  key: string;
  label: string;
  required: boolean;
  hint: string;
}[] = [
  { key: "firstName", label: "First name", required: true, hint: "e.g. Jane" },
  { key: "lastName", label: "Last name", required: true, hint: "e.g. Smith" },
  { key: "email", label: "Email", required: true, hint: "must be unique" },
  { key: "phone", label: "Phone", required: false, hint: "any format" },
  { key: "department", label: "Department", required: false, hint: "e.g. Sales, Service" },
  { key: "role", label: "Role", required: true, hint: "must match a role name" },
];
