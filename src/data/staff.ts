export type Permission = "view" | "edit" | "delete";

export type Role = {
  id: string;
  name: string;
  description: string;
  modules: { module: string; permissions: Permission[] }[];
  staffCount: number;
};

export type Staff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  status: "Active" | "Invited" | "Suspended";
  joinedDate: string;
  lastActive: string;
};

// MUST stay in sync with the backend AppModule enum
// (cdms-backend/src/common/permissions.ts) AND config/nav.ts labels — these
// strings are the lookup keys in role.permissions[].module. The Roles page
// builds its editable permission model from this list, so a module missing
// here (a) can't be toggled in the matrix and (b) gets silently wiped from a
// role on save (normalizePermissions only carries modules present here).
// "Facebook Listings" was added later and had drifted out of this list.
export const allModules = [
  "Dashboard", "Inventory", "CRM – Sellers", "CRM – Buyers", "Leads & Sales",
  "Accounting", "BHPH", "Digital Marketing", "Dealer Website", "Dealer Marketplace",
  "Facebook Listings",
  "Calendar", "Communication", "Support", "Staff", "Roles", "Settings",
];

export const roles: Role[] = [
  {
    id: "R-01", name: "Admin", description: "Full system access",
    staffCount: 1,
    modules: allModules.map((m) => ({ module: m, permissions: ["view", "edit", "delete"] as Permission[] })),
  },
  {
    id: "R-02", name: "Sales Manager", description: "Manages sales pipeline and staff",
    staffCount: 2,
    modules: [
      { module: "Dashboard", permissions: ["view"] },
      { module: "Inventory", permissions: ["view", "edit"] },
      { module: "CRM – Sellers", permissions: ["view", "edit"] },
      { module: "CRM – Buyers", permissions: ["view", "edit"] },
      { module: "Leads & Sales", permissions: ["view", "edit", "delete"] },
      { module: "Calendar", permissions: ["view", "edit"] },
      { module: "Communication", permissions: ["view", "edit"] },
      { module: "Staff", permissions: ["view"] },
    ],
  },
  {
    id: "R-03", name: "Sales Staff", description: "Handles assigned leads and bookings",
    staffCount: 5,
    modules: [
      { module: "Dashboard", permissions: ["view"] },
      { module: "Inventory", permissions: ["view"] },
      { module: "CRM – Buyers", permissions: ["view", "edit"] },
      { module: "Leads & Sales", permissions: ["view", "edit"] },
      { module: "Calendar", permissions: ["view", "edit"] },
      { module: "Communication", permissions: ["view", "edit"] },
    ],
  },
  {
    id: "R-04", name: "Marketing", description: "Manages campaigns and website content",
    staffCount: 1,
    modules: [
      { module: "Dashboard", permissions: ["view"] },
      { module: "Digital Marketing", permissions: ["view", "edit", "delete"] },
      { module: "Dealer Website", permissions: ["view", "edit"] },
      { module: "Dealer Marketplace", permissions: ["view", "edit"] },
    ],
  },
  {
    id: "R-05", name: "Support", description: "Customer support and ticket handling",
    staffCount: 1,
    modules: [
      { module: "Dashboard", permissions: ["view"] },
      { module: "Support", permissions: ["view", "edit"] },
      { module: "Communication", permissions: ["view", "edit"] },
    ],
  },
];

export const staff: Staff[] = [
  { id: "U-01", name: "John Dealer", email: "john@autodealer.com", phone: "555-1000", roleId: "R-01", status: "Active", joinedDate: "2024-01-01", lastActive: "2026-05-03" },
  { id: "U-02", name: "Alex Rivera", email: "alex@autodealer.com", phone: "555-1001", roleId: "R-02", status: "Active", joinedDate: "2024-06-12", lastActive: "2026-05-03" },
  { id: "U-03", name: "Priya Singh", email: "priya@autodealer.com", phone: "555-1002", roleId: "R-02", status: "Active", joinedDate: "2024-09-04", lastActive: "2026-05-02" },
  { id: "U-04", name: "Tom Becker", email: "tom@autodealer.com", phone: "555-1003", roleId: "R-03", status: "Active", joinedDate: "2025-01-15", lastActive: "2026-05-03" },
  { id: "U-05", name: "Nina Costa", email: "nina@autodealer.com", phone: "555-1004", roleId: "R-03", status: "Active", joinedDate: "2025-03-22", lastActive: "2026-05-01" },
  { id: "U-06", name: "Jordan Hayes", email: "jordan@autodealer.com", phone: "555-1005", roleId: "R-03", status: "Active", joinedDate: "2025-08-10", lastActive: "2026-05-03" },
  { id: "U-07", name: "Maya Patel", email: "maya@autodealer.com", phone: "555-1006", roleId: "R-03", status: "Active", joinedDate: "2025-11-01", lastActive: "2026-05-02" },
  { id: "U-08", name: "Sam Wilson", email: "sam@autodealer.com", phone: "555-1007", roleId: "R-03", status: "Invited", joinedDate: "2026-04-28", lastActive: "—" },
  { id: "U-09", name: "Olivia Reed", email: "olivia@autodealer.com", phone: "555-1008", roleId: "R-04", status: "Active", joinedDate: "2024-11-04", lastActive: "2026-05-03" },
  { id: "U-10", name: "Marcus Lee", email: "marcus@autodealer.com", phone: "555-1009", roleId: "R-05", status: "Active", joinedDate: "2025-02-14", lastActive: "2026-05-02" },
];

export const getRoleById = (id: string) => roles.find((r) => r.id === id);
export const getStaffById = (id: string) => staff.find((s) => s.id === id);
