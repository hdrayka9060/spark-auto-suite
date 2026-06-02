import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { Shield, Plus, Check, Loader2, Trash2, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  type ServerRole,
} from "@/hooks/api/use-roles";
import { useStaffList } from "@/hooks/api/use-staff";
import { allModules, type Permission } from "@/data/staff";
import { navItems } from "@/config/nav";
import { useCan } from "@/components/Can";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const allPerms: Permission[] = ["view", "edit", "delete"];

/**
 * The permissions matrix only exposes access control for modules that are
 * VISIBLE sidebar tabs. Hidden/retired nav entries (BHPH, Communication,
 * Support, Settings — flagged `hidden` in config/nav.ts) are omitted so admins
 * don't grant access to tabs nobody can reach.
 *
 * IMPORTANT: this filters only the RENDERED rows. The editable model below
 * still spans `allModules`, so any permissions an existing role already holds
 * for a hidden module are preserved untouched on save — toggling a visible row
 * never wipes a hidden-module grant.
 */
const visibleModules = navItems.filter((n) => !n.hidden).map((n) => n.label);

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
  // Pull the full staff list so the Delete dialog can warn the admin
  // about how many users will be left with a broken role assignment if
  // they delete the role. Cheap call — capped at 100 by useStaffList default.
  const staffQuery = useStaffList();

  // Page-level permission flags. View access is already enforced by
  // PermissionRoute; these gate the mutating affordances inline.
  const canEditRoles = useCan("Roles", "edit");
  const canDeleteRoles = useCan("Roles", "delete");

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  // Lifted out of the inline onClick so the destructive confirmation flow
  // is reactively driven by a single source of truth.
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<ServerRole | null>(null);

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
        {canEditRoles && (
          <button
            onClick={() => setShowAdd((current) => !current)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Role
          </button>
        )}
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
            {createRole.isPending && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
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
                {visibleModules.map((module) => (
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
              disabled={createRole.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRole}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg"
              disabled={createRole.isPending}
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
                    disabled={!canEditRoles}
                    className="mt-2 w-full border rounded-lg px-3 py-2 text-sm bg-background disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={!canEditRoles}
                    className="mt-2 w-full border rounded-lg px-3 py-2 text-sm bg-background disabled:bg-muted disabled:cursor-not-allowed"
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
                    {visibleModules.map((module) => (
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
                              disabled={!canEditRoles}
                              className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4">
                {/* Left side: a small contextual chip for system roles so the
                    admin knows up-front why Delete is disabled. */}
                <div className="text-xs text-muted-foreground">
                  {selectedRole.isSystem && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                      <Lock className="h-3 w-3" /> System role — locked
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Delete is gated by Roles:delete AND blocked for system
                      roles. Backend rejects both cases, but disabling here
                      avoids a wasted round-trip and clarifies the affordance. */}
                  {canDeleteRoles && (
                    <button
                      onClick={() => setConfirmDeleteRole(selectedRole)}
                      disabled={deleteRole.isPending || selectedRole.isSystem}
                      title={
                        selectedRole.isSystem
                          ? "System roles cannot be deleted"
                          : "Delete this role"
                      }
                      className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-700 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                    >
                      {deleteRole.isPending && confirmDeleteRole?._id === selectedRole._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete role
                    </button>
                  )}

                  {canEditRoles && (
                    <button
                      onClick={handleSaveRole}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                      disabled={updateRole.isPending}
                    >
                      {updateRole.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Save Permissions
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Select a role to edit its permissions.</div>
          )}
        </div>
      </div>

      {/* ── Destructive Delete-Role confirmation ─────────────────────────
          Replaces the bare window.confirm. Three deliberate UX choices:
            1. Red banner with AlertTriangle — clearly destructive
            2. Surfaces the count of users currently assigned to this role
               so the admin knows downstream impact (those users will be
               left with a dangling roleId until reassigned)
            3. Requires the admin to type the role name to enable the
               Delete button — prevents fat-finger clicks on a permanent
               action. Same pattern as GitHub repo delete. */}
      <DeleteRoleDialog
        role={confirmDeleteRole}
        onClose={() => setConfirmDeleteRole(null)}
        deleting={deleteRole.isPending}
        assignedCount={
          confirmDeleteRole
            ? (staffQuery.data ?? []).filter((s) => s.roleId === confirmDeleteRole._id).length
            : 0
        }
        onConfirm={async () => {
          if (!confirmDeleteRole) return;
          try {
            await deleteRole.mutateAsync(confirmDeleteRole._id);
            toast.success(`Role "${confirmDeleteRole.name}" deleted`);
            setSelectedRoleId((prev) =>
              prev === confirmDeleteRole._id
                ? (roles.find((r) => r._id !== confirmDeleteRole._id)?._id ?? null)
                : prev,
            );
            setConfirmDeleteRole(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to delete role");
          }
        }}
      />
    </div>
  );
}

/**
 * Destructive AlertDialog for role deletion. Extracted as its own component
 * because of the local state for the typed-confirmation input — keeping it
 * inline would force the parent to remember to reset the input on every open.
 *
 * The double-confirmation (button + typed name) is intentional: deleting a
 * role is irreversible (soft-deleted, but no UI to restore) AND has
 * downstream impact on every staff member assigned to it.
 */
interface DeleteRoleDialogProps {
  role: ServerRole | null;
  assignedCount: number;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteRoleDialog({
  role,
  assignedCount,
  deleting,
  onClose,
  onConfirm,
}: DeleteRoleDialogProps) {
  const [typedName, setTypedName] = useState("");

  // Reset the typed name every time the dialog opens for a new role —
  // otherwise quickly closing and reopening would leave stale text.
  useEffect(() => {
    if (role) setTypedName("");
  }, [role?._id]);

  const nameMatches = !!role && typedName.trim() === role.name;

  return (
    <AlertDialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <AlertDialogTitle className="text-center">
            Delete role &ldquo;{role?.name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                This action <strong>cannot be undone</strong>. The role will be removed from the system permanently.
              </p>
              {assignedCount > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {assignedCount} staff member{assignedCount === 1 ? "" : "s"} {assignedCount === 1 ? "is" : "are"} currently assigned to this role.
                    </p>
                    <p className="text-xs mt-1 text-amber-800">
                      They will keep this role attached but their permissions will silently stop applying. Reassign them from the Staff page before deleting.
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-1.5 pt-1">
                <label htmlFor="confirm-name" className="text-xs font-medium text-foreground">
                  Type <code className="px-1 py-0.5 bg-muted rounded font-mono">{role?.name}</code> to confirm
                </label>
                <input
                  id="confirm-name"
                  autoComplete="off"
                  autoFocus
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder={role?.name}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          {/*
            We bypass shadcn's <AlertDialogAction> here because asChild would
            stack two `buttonVariants()` class sets — the wrapper's default
            (primary blue) and the inner Button's destructive (red) — and
            the merge order isn't guaranteed to keep the red. Rendering the
            destructive Button directly with an explicit click handler that
            calls onConfirm gives us full control. The dialog stays open
            while the mutation runs; the parent closes it on success.
          */}
          <Button
            type="button"
            variant="destructive"
            disabled={!nameMatches || deleting}
            onClick={onConfirm}
            className="min-w-[120px]"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete role
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
