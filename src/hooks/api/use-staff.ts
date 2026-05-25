import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PaginatedServerResponse } from "@/lib/vehicle-mapper";

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

/**
 * Fetches active users for staff dropdowns (lead assignee, calendar event owner, etc.).
 * Requires `Staff:view` permission.
 */
export function useStaff() {
  return useQuery({
    queryKey: STAFF_KEY,
    queryFn: async () => {
      const res = await api<PaginatedServerResponse<StaffMember>>("/users", {
        query: { limit: 100 },
      });
      return res.data.map<StaffOption>((u) => ({
        id: u._id,
        name: `${u.firstName} ${u.lastName}`.trim() || u.email,
        email: u.email,
        roleName: u.roleId?.name,
      }));
    },
    staleTime: 60_000, // staff list rarely changes
  });
}
