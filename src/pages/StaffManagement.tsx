import { useMemo, useRef, useState } from "react";
import { Plus, Upload, Search, Mail, Phone, Trash2, Pencil, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  useStaffList,
  useInviteUser,
  useUpdateUser,
  useDeleteUser,
  useBulkInviteUsers,
  type BulkInviteResult,
} from "@/hooks/api/use-staff";
import { useRoles } from "@/hooks/api/use-roles";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import {
  Staff,
  STAFF_STATUSES,
  STAFF_STATUS_BADGE_CLASS,
  STAFF_CSV_COLUMNS,
  buildSampleStaffCsv,
  staffInitials,
  type ClientStaffStatus,
} from "@/lib/staff-mapper";
import Can, { useCan } from "@/components/Can";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Staff Management page — Phase 8 wire-up.
 *
 * Replaces the old mock-data version (`@/data/staff` import gone). Hooks
 * directly into the NestJS /users endpoints via use-staff/use-roles.
 *
 * Capabilities:
 *   1. Invite a new user (POST /users/invite) → triggers email + INVITED row
 *   2. Edit user profile + role (PATCH /users/:id) → role change emits a
 *      dedicated activity row
 *   3. Soft-delete (DELETE /users/:id) — confirm via AlertDialog; backend
 *      blocks self-delete; we also hide the button on the current user's row
 *   4. Bulk-invite via CSV upload — hidden file input
 *   5. Download a sample CSV — frontend-built Blob (no extra endpoint)
 *
 * Per project convention all mutations live inside hook files, the page
 * never calls `api()` directly. Mutation hooks invalidate ["staff"] and
 * ["dashboard"] on success so KPIs/activity refresh.
 */

const STATUS_FILTERS: ("All" | ClientStaffStatus)[] = ["All", ...STAFF_STATUSES];

export default function StaffManagement() {
  const { state: authState } = useAuth();
  const currentUserId = authState.status === "authenticated" ? authState.user._id : null;

  // Frontend-side permission gates. These match the backend @RequirePermission
  // decorators on /users — Staff:edit covers invite/bulk-upload/update, and
  // Staff:delete covers soft-delete. Without these flags we'd just bounce off
  // the API with a 403 toast; surfacing the gate as visibility/disabled gives
  // a cleaner UX.
  const canEditStaff = useCan("Staff", "edit");
  const canDeleteStaff = useCan("Staff", "delete");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | ClientStaffStatus>("All");

  const rolesQuery = useRoles();
  const staffQuery = useStaffList({
    search: search || undefined,
    status: statusFilter,
    roleId: roleFilter,
  });

  // ── Invite dialog state ─────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    roleId: "",
  });
  const inviteMutation = useInviteUser();

  const resetInviteForm = () =>
    setInviteForm({ firstName: "", lastName: "", email: "", phone: "", department: "", roleId: "" });

  const submitInvite = async () => {
    const { firstName, lastName, email, roleId, phone, department } = inviteForm;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !roleId) {
      toast.error("First name, last name, email, and role are required");
      return;
    }
    try {
      await inviteMutation.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        department: department.trim() || undefined,
        roleId,
      });
      toast.success(`Invitation sent to ${email}`);
      setInviteOpen(false);
      resetInviteForm();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send invite");
    }
  };

  // ── Edit dialog state ───────────────────────────────────────────────────
  const [editing, setEditing] = useState<Staff | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    department: "",
    roleId: "",
  });
  const updateMutation = useUpdateUser();

  const openEdit = (staff: Staff) => {
    setEditing(staff);
    setEditForm({
      firstName: staff.firstName,
      lastName: staff.lastName,
      phone: staff.phone,
      department: staff.department,
      roleId: staff.roleId ?? "",
    });
  };

  const submitEdit = async () => {
    if (!editing) return;
    try {
      // Build a sparse PATCH — only include fields that actually changed so
      // the backend's role-changed-vs-updated activity differentiation works
      // correctly. (Sending roleId equal to the current value would not
      // trigger the role-changed branch anyway, but keeping payloads minimal
      // is good hygiene.)
      const input: Record<string, string> = {};
      if (editForm.firstName !== editing.firstName) input.firstName = editForm.firstName.trim();
      if (editForm.lastName !== editing.lastName) input.lastName = editForm.lastName.trim();
      if (editForm.phone !== editing.phone) input.phone = editForm.phone.trim();
      if (editForm.department !== editing.department) input.department = editForm.department.trim();
      if (editForm.roleId && editForm.roleId !== editing.roleId) input.roleId = editForm.roleId;

      if (Object.keys(input).length === 0) {
        toast.info("No changes to save");
        setEditing(null);
        return;
      }

      await updateMutation.mutateAsync({ id: editing.id, input });
      toast.success("Staff member updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update staff member");
    }
  };

  // ── Delete confirmation state ───────────────────────────────────────────
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const deleteMutation = useDeleteUser();

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      toast.success(`${deleting.fullName} was removed`);
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete user");
    }
  };

  // ── Bulk upload & sample CSV ────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bulkMutation = useBulkInviteUsers();
  // When the bulk endpoint returns either successes OR per-row errors, we
  // open a dialog with the full breakdown so the admin can see exactly which
  // emails landed and which were rejected (mail failure, role not found, etc.)
  // — instead of cramming a few errors into a toast description.
  const [bulkResult, setBulkResult] = useState<BulkInviteResult | null>(null);

  const handleBulkFile = async (file: File) => {
    try {
      const result = await bulkMutation.mutateAsync(file);
      setBulkResult(result);
      // Lightweight toast as immediate feedback; the dialog has the detail.
      if (result.errors.length === 0) {
        toast.success(`Invited ${result.created} staff member${result.created === 1 ? "" : "s"}`);
      } else if (result.created === 0) {
        toast.error(`All ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} failed`);
      } else {
        toast.warning(
          `Invited ${result.created} · ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} skipped`,
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Bulk upload failed");
    }
  };

  const downloadSampleCsv = () => {
    const csv = buildSampleStaffCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff-bulk-upload-sample.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalCount = staffQuery.data?.length ?? 0;

  // Pre-compute the role-filter buttons. We render "All" + one button per role
  // returned by useRoles so the filter set always tracks the DB.
  const roles = rolesQuery.data ?? [];

  const filteredCount = useMemo(() => totalCount, [totalCount]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Bulk-invite loading overlay — the server invites each row sequentially
          (one SMTP send per staff member), so this can take a few seconds. */}
      {bulkMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-8 py-6 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading CSV &amp; sending invitations…</p>
            <p className="text-xs text-muted-foreground">Each staff member is emailed an invite — this can take a few seconds.</p>
          </div>
        </div>
      )}

      <div className="module-header">
        <div>
          <h1 className="module-title">Staff Management</h1>
          <p className="text-muted-foreground text-sm">
            {staffQuery.isLoading ? "Loading…" : `${filteredCount} team member${filteredCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBulkFile(f);
              // Reset so picking the same file twice still triggers onChange.
              e.target.value = "";
            }}
          />
          {/* The bulk-import affordance is gated by Staff:edit — users
              without that permission (Sales Manager, etc.) still see the list
              but can't trigger uploads. Layout: a plain text link for the
              sample CSV next to an outlined "Bulk CSV" button. */}
          {canEditStaff && (
          <>
          <button
            onClick={downloadSampleCsv}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline px-2 py-2"
            title={`Columns: ${STAFF_CSV_COLUMNS.map((c) => c.key).join(", ")}`}
          >
            Download sample CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkMutation.isPending}
            className="flex items-center gap-2 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted/60 disabled:opacity-50"
            title="Upload a CSV to invite many staff at once"
          >
            {bulkMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Bulk CSV
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Invite Staff
          </button>
          </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="bg-transparent text-sm outline-none w-full"
          />
        </div>

        {/* Role chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setRoleFilter("All")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              roleFilter === "All"
                ? "bg-primary text-primary-foreground"
                : "bg-card border hover:bg-muted"
            }`}
          >
            All roles
          </button>
          {roles.map((r) => (
            <button
              key={r._id}
              onClick={() => setRoleFilter(r._id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                roleFilter === r._id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border hover:bg-muted"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Errors */}
      {staffQuery.isError && (
        <div className="stat-card border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2">
          Failed to load staff:{" "}
          {staffQuery.error instanceof Error ? staffQuery.error.message : "Unknown error"}
        </div>
      )}

      {/* Table */}
      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Last Active</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffQuery.isLoading && (
              <tr>
                <td colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading staff…
                </td>
              </tr>
            )}
            {!staffQuery.isLoading && totalCount === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No staff match your filters. Click <em>Invite Staff</em> to add someone.
                </td>
              </tr>
            )}
            {(staffQuery.data ?? []).map((s) => {
              const isSelf = currentUserId === s.id;
              return (
                <tr key={s.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {staffInitials(s)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {s.fullName} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.department || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm">
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-muted-foreground" /> {s.email}
                    </p>
                    {s.phone && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {s.phone}
                      </p>
                    )}
                  </td>
                  <td>
                    <span className="status-badge bg-blue-50 text-blue-700">{s.roleName}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${STAFF_STATUS_BADGE_CLASS[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground">{s.joinedDate}</td>
                  <td className="text-xs text-muted-foreground" title="Surfaces the user's last updatedAt — we don't track logins directly today">
                    {s.lastActive}
                  </td>
                  <td className="text-right">
                    {/* Hide the entire action cluster when the user has neither
                        Staff:edit nor Staff:delete — keeps the column visually
                        clean for read-only roles (e.g. Sales Manager). */}
                    {(canEditStaff || (canDeleteStaff && !isSelf)) && (
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Can module="Staff" action="edit">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-2 rounded hover:bg-muted"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </Can>
                      {!isSelf && (
                        <Can module="Staff" action="delete">
                          <button
                            onClick={() => setDeleting(s)}
                            className="p-2 rounded hover:bg-red-50"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </Can>
                      )}
                    </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Invite dialog ───────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) resetInviteForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a new staff member</DialogTitle>
            <DialogDescription>
              They'll receive an email with a link to set their password and activate their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="i-firstName">First name</Label>
                <Input
                  id="i-firstName"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-lastName">Last name</Label>
                <Input
                  id="i-lastName"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-email">Email</Label>
              <Input
                id="i-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="email"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="i-phone">Phone (optional)</Label>
                <Input
                  id="i-phone"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-department">Department (optional)</Label>
                <Input
                  id="i-department"
                  value={inviteForm.department}
                  onChange={(e) => setInviteForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. Sales, Service"
                  autoComplete="organization"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-role">Role</Label>
              <Select
                value={inviteForm.roleId}
                onValueChange={(v) => setInviteForm((f) => ({ ...f, roleId: v }))}
              >
                <SelectTrigger id="i-role">
                  <SelectValue placeholder={rolesQuery.isLoading ? "Loading…" : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
            <DialogDescription>
              Update name, contact info, or role. Role changes take effect on the user's next request.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-firstName">First name</Label>
                  <Input
                    id="e-firstName"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-lastName">Last name</Label>
                  <Input
                    id="e-lastName"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={editing.email} disabled />
                <p className="text-xs text-muted-foreground">
                  Email is the user's login — changing it isn't supported here.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-phone">Phone</Label>
                <Input
                  id="e-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-department">Department</Label>
                <Input
                  id="e-department"
                  value={editForm.department}
                  onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-role">Role</Label>
                <Select
                  value={editForm.roleId}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, roleId: v }))}
                >
                  <SelectTrigger id="e-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk upload result dialog ───────────────────────────────────── */}
      <Dialog open={bulkResult !== null} onOpenChange={(open) => !open && setBulkResult(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk upload results</DialogTitle>
            <DialogDescription>
              {bulkResult && (
                <>
                  {bulkResult.created} invited · {bulkResult.errors.length} skipped
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {bulkResult && (
            <div className="space-y-4 overflow-y-auto">
              {bulkResult.invited.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Invitations sent ({bulkResult.invited.length})
                  </h4>
                  <ul className="text-sm space-y-1 max-h-40 overflow-y-auto bg-emerald-50/50 rounded-md p-3 border border-emerald-100">
                    {bulkResult.invited.map((email) => (
                      <li key={email} className="font-mono text-xs">{email}</li>
                    ))}
                  </ul>
                </div>
              )}
              {bulkResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    Skipped — no user was created for these rows ({bulkResult.errors.length})
                  </h4>
                  <ul className="text-xs space-y-1.5 max-h-60 overflow-y-auto bg-red-50/50 rounded-md p-3 border border-red-100">
                    {bulkResult.errors.map((err, i) => (
                      <li key={i} className="text-red-900">{err}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Fix the issues (typos, role names, mail config) and re-upload only the failed rows.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setBulkResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  <strong>{deleting.fullName}</strong> ({deleting.email}) will be deactivated and
                  blocked from signing in. This is a soft delete — their historical activity is
                  preserved in the audit log.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Default behavior closes the dialog before we await; prevent
                // so we can control closing ourselves once the mutation lands.
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
