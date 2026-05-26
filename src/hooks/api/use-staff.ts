import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";
import { ServerStaff, Staff, toClientStaff } from "@/lib/staff-mapper";

/**
 * Two distinct query shapes against `/users`:
 *   - `useStaff()` — compact options used for dropdowns (lead assignee, etc.)
 *   - `useStaffList()` — full Staff records used by /staff management page
 *
 * Both share the `["staff"]` query-key prefix so a single invalidate covers
 * both surfaces after any mutation.
 */

export interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status?: string;
  roleId?: { _id: string; name: string };
}

export interface StaffOption {
  id: string;
  name: string;
  email: string;
  roleName?: string;
}

const STAFF_KEY = ["staff"] as const;

/** Centralised invalidator — every mutation hook calls this. Hits both the
 *  staff list keys and the dashboard key (per project convention: every
 *  mutation that affects KPIs/activity invalidates `["dashboard"]`). */
function invalidateStaff(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: STAFF_KEY });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

/**
 * Compact dropdown shape — kept for existing callers (lead assignee picker,
 * calendar event owner, etc.). Does NOT include invited/inactive users —
 * we filter to active-ish entries client-side because dropdowns shouldn't
 * surface accounts that can't act.
 */
export function useStaff() {
  return useQuery({
    queryKey: [...STAFF_KEY, "options"],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<StaffMember>>("/users", {
        query: { limit: 100 },
      });
      return res.data
        .filter((u) => !u.status || u.status === "active")
        .map<StaffOption>((u) => ({
          id: u._id,
          name: `${u.firstName} ${u.lastName}`.trim() || u.email,
          email: u.email,
          roleName: u.roleId?.name,
        }));
    },
    staleTime: 60_000,
  });
}

export interface StaffListFilters {
  search?: string;
  /** Display-side status; converted via mapper. "All" → no filter. */
  status?: import("@/lib/staff-mapper").ClientStaffStatus | "All";
  roleId?: string | "All";
}

/**
 * Full staff list for the management page. Filters apply client-side because
 * the backend's /users endpoint pages by createdAt and doesn't filter by
 * status/role today (small list, small wins).
 */
export function useStaffList(filters: StaffListFilters = {}) {
  return useQuery({
    queryKey: [...STAFF_KEY, "list", filters],
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<ServerStaff>>("/users", {
        query: { limit: 100, search: filters.search || undefined },
      });
      const all = res.data.map(toClientStaff);
      return all.filter((s) => {
        if (filters.status && filters.status !== "All" && s.status !== filters.status) return false;
        if (filters.roleId && filters.roleId !== "All" && s.roleId !== filters.roleId) return false;
        return true;
      });
    },
    staleTime: 10_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────

export interface InviteUserInput {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  phone?: string;
  department?: string;
}

/** Invite a new user — backend creates an INVITED row and emails the link. */
export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteUserInput): Promise<Staff> => {
      const server = await api<ServerStaff>("/users/invite", {
        method: "POST",
        body: input,
      });
      return toClientStaff(server);
    },
    onSuccess: () => invalidateStaff(qc),
  });
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: string;
  roleId?: string;
}

/**
 * Patch a user. Used for both edit-profile (any field) and change-role
 * (roleId only). Backend emits `role-changed` activity automatically when
 * roleId differs from the existing value.
 */
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateUserInput }): Promise<Staff> => {
      const server = await api<ServerStaff>(`/users/${id}`, {
        method: "PATCH",
        body: input,
      });
      return toClientStaff(server);
    },
    onSuccess: () => invalidateStaff(qc),
  });
}

/** Soft-delete a user. Backend blocks self-delete (400). */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api<void>(`/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => invalidateStaff(qc),
  });
}

export interface BulkInviteResult {
  created: number;
  invited: string[];
  errors: string[];
}

/**
 * Multipart upload to /users/bulk-upload. Backend parses CSV, invites each
 * row, fires mail dispatches in the background, and returns aggregate
 * counts + per-row error messages.
 */
export function useBulkInviteUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<BulkInviteResult> => {
      const fd = new FormData();
      fd.append("file", file);
      return await api<BulkInviteResult>("/users/bulk-upload", {
        method: "POST",
        body: fd,
        rawBody: true,
      });
    },
    onSuccess: () => invalidateStaff(qc),
  });
}
