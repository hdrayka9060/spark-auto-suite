import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { Shield, Plus, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  type ServerRole,
} from "@/hooks/api/use-roles";
import { allModules, type Permission } from "@/data/staff";

const allPerms: Permission[] = ["view", "edit", "delete"];

type RolePermission = { module: string; actions: Permission[] };

const buildEmptyPermissions = (): RolePermission[] =>
  allModules.map((module) => ({ module, actions: [] }));

const normalizePermissions = (permissions: RolePermission[]): RolePermission[] =>
  allModules.map((module) => ({
    module,
    actions: permissions.find((entry) => entry.module === module)?.actions ?? [],
  }));

export default function RolesPermissions() {
  const rolesQuery = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editablePermissions, setEditablePermissions] = useState<RolePermission[]>(buildEmptyPermissions());

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<RolePermission[]>(buildEmptyPermissions());

  const roles = rolesQuery.data ?? [];

  const deleteRole = useDeleteRole();

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0]._id);
    }
  }, [selectedRoleId, roles]);

  const selectedRole = useMemo(
    () => roles.find((role) => role._id === selectedRoleId),
    [roles, selectedRoleId],
  );

  useEffect(() => {
    if (!selectedRole) return;
    setEditName(selectedRole.name);
    setEditDescription(selectedRole.description ?? "");
    setEditablePermissions(normalizePermissions(selectedRole.permissions));
  }, [selectedRole]);

  useEffect(() => {
    if (!showAdd) return;
    setNewRoleName("");
    setNewRoleDescription("");
    setNewRolePermissions(buildEmptyPermissions());
  }, [showAdd]);

  const togglePermission = (
    permissions: RolePermission[],
    setPermissions: Dispatch<SetStateAction<RolePermission[]>>,
    module: string,
    action: Permission,
  ) => {
    setPermissions((prev) =>
      prev.map((entry) =>
        entry.module !== module
          ? entry
          : {
              ...entry,
              actions: entry.actions.includes(action)
                ? entry.actions.filter((item) => item !== action)
                : [...entry.actions, action],
            },
      ),
    );
  };

  const hasPerm = (permissions: RolePermission[], module: string, perm: Permission) =>
    permissions.find((entry) => entry.module === module)?.actions.includes(perm) ?? false;

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    try {
      await createRole.mutateAsync({
        name: newRoleName.trim(),
        description: newRoleDescription.trim(),
        permissions: newRolePermissions,
      });
      toast.success("Role created");
      setShowAdd(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create role",
      );
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    if (!editName.trim()) {
      toast.error("Role name is required");
      return;
    }

    const payload = {
      name: editName.trim(),
      description: editDescription.trim(),
      permissions: editablePermissions,
    };

    try {
      await updateRole.mutateAsync({ id: selectedRole._id, input: payload });
      toast.success("Role updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save role",
      );
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm">
            Manage roles and the permissions matrix for each module.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((current) => !current)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Role
        </button>
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-semibold">Create Role</h3>
              <p className="text-sm text-muted-foreground">
                Define a new role and select which module actions it may perform.
              </p>
            </div>
            {createRole.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role Name"
              className="border rounded-lg px-3 py-2 text-sm bg-background"
            />
            <input
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              placeholder="Description"
              className="border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  {allPerms.map((perm) => (
                    <th key={perm} className="text-center capitalize">
                      {perm}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allModules.map((module) => (
                  <tr key={module}>
                    <td className="font-medium text-sm">{module}</td>
                    {allPerms.map((perm) => (
                      <td key={perm} className="text-center">
                        <input
                          type="checkbox"
                          checked={hasPerm(newRolePermissions, module, perm)}
                          onChange={() =>
                            togglePermission(newRolePermissions, setNewRolePermissions, module, perm)
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm border rounded-lg"
              disabled={createRole.isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRole}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg"
              disabled={createRole.isLoading}
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="stat-card lg:col-span-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold mb-2 text-sm uppercase text-muted-foreground tracking-wide">
              Roles
            </h3>
            {rolesQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
          {rolesQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading roles…</div>
          ) : rolesQuery.isError ? (
            <div className="text-sm text-red-600">Unable to load roles.</div>
          ) : (
            roles.map((role) => (
              <button
                key={role._id}
                onClick={() => setSelectedRoleId(role._id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedRoleId === role._id
                    ? "bg-primary/5 border-primary"
                    : "border-transparent hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield
                    className={`h-4 w-4 ${
                      selectedRoleId === role._id ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span className="font-medium text-sm">{role.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {role.permissions.filter((p) => Array.isArray(p.actions) && p.actions.length > 0).length} modules{role.isSystem ? " · system role" : ""}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="stat-card lg:col-span-3">
          {selectedRole ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label className="text-sm font-medium">Role name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-2 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="mt-2 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      {allPerms.map((perm) => (
                        <th key={perm} className="text-center capitalize">
                          {perm}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allModules.map((module) => (
                      <tr key={module}>
                        <td className="font-medium text-sm">{module}</td>
                        {allPerms.map((perm) => (
                          <td key={perm} className="text-center">
                            <input
                              type="checkbox"
                              checked={hasPerm(editablePermissions, module, perm)}
                              onChange={() =>
                                togglePermission(editablePermissions, setEditablePermissions, module, perm)
                              }
                              className="h-4 w-4 accent-primary"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!selectedRole) return;
                      const ok = window.confirm(`Delete role \"${selectedRole.name}\"? This cannot be undone.`);
                      if (!ok) return;
                      try {
                        await deleteRole.mutateAsync(selectedRole._id);
                        toast.success("Role deleted");
                        setSelectedRoleId((prev) => {
                          // pick a different role if available
                          const remaining = roles.filter((r) => r._id !== selectedRole._id);
                          return remaining.length > 0 ? remaining[0]._id : null;
                        });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Unable to delete role");
                      }
                    }}
                    className="px-4 py-2 text-sm border rounded-lg text-red-600 bg-white"
                    disabled={deleteRole.isLoading}
                  >
                    {deleteRole.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>

                  <button
                    onClick={handleSaveRole}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                    disabled={updateRole.isLoading}
                  >
                    {updateRole.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save Permissions
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Select a role to edit its permissions.</div>
          )}
        </div>
      </div>
    </div>
  );
}
