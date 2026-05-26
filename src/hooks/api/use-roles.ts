import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Server-side Role document shape. Mirrors `roles` collection.
 * (The full permission matrix is included in case the /roles page wants
 * to render it; the staff page only needs `_id` + `name`.)
 */
export interface ServerRole {
  _id: string;
  name: string;
  description?: string;
  permissions: { module: string; actions: ("view" | "edit" | "delete")[] }[];
  isSystem?: boolean;
}

const ROLES_KEY = ["roles"] as const;

/**
 * List all roles. Backed by GET /roles which returns the sorted list
 * (system roles first, then by name).
 *
 * Used by:
 *   - StaffManagement invite + edit dialogs (role picker)
 *   - The (still-unwired) /roles permissions page when it ships
 */
export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      // Backend returns the raw array (not paginated).
      return await api<ServerRole[]>("/roles");
    },
    // Roles change rarely; cache for a minute so the dropdown is instant on
    // re-open without going stale long enough to matter.
    staleTime: 60_000,
  });
}
