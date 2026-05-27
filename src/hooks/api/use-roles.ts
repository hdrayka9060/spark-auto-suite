import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: { module: string; actions: ("view" | "edit" | "delete")[] }[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: { module: string; actions: ("view" | "edit" | "delete")[] }[];
}

const ROLES_KEY = ["roles"] as const;

function invalidateRoles(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ROLES_KEY });
  qc.invalidateQueries({ queryKey: ["staff"] });
}

/**
 * List all roles. Backed by GET /roles which returns the sorted list
 * (system roles first, then by name).
 *
 * Used by:
 *   - StaffManagement invite + edit dialogs (role picker)
 *   - The /roles permissions page
 */
export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      return await api<ServerRole[]>("/roles");
    },
    staleTime: 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRoleInput): Promise<ServerRole> => {
      const cleaned = {
        ...input,
        permissions: (input.permissions ?? []).filter((p) => Array.isArray(p.actions) && p.actions.length > 0),
      };
      return await api<ServerRole>("/roles", {
        method: "POST",
        body: cleaned,
      });
    },
    onSuccess: () => invalidateRoles(qc),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateRoleInput }): Promise<ServerRole> => {
      const cleanedInput = {
        ...input,
        permissions: input.permissions
          ? input.permissions.filter((p) => Array.isArray(p.actions) && p.actions.length > 0)
          : undefined,
      } as UpdateRoleInput;
      return await api<ServerRole>(`/roles/${id}`, {
        method: "PATCH",
        body: cleanedInput,
      });
    },
    onSuccess: () => invalidateRoles(qc),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      return await api<void>(`/roles/${id}`, { method: "DELETE" });
    },
    onSuccess: () => invalidateRoles(qc),
  });
}
