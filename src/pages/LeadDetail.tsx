import { useEffect, useState } from "react";
import {
  AlertCircle, ArrowLeft, CalendarDays, Copy, Edit, Loader2, Mail, MapPin, Phone, Plus,
  Save, Trash2, Video, X,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  CloseLeadInput, LeadLogInput, useAppendLeadLog, useBookLeadTestDrive, useCloseLead,
  useDeleteLead, useDeleteLeadLog, useLead, useUpdateLead, useUpdateLeadLog,
} from "@/hooks/api/use-leads";
import { useCreateCalendarEvent } from "@/hooks/api/use-calendar";
import { useStaff } from "@/hooks/api/use-staff";
import { useVehicle, useVehicles } from "@/hooks/api/use-vehicles";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { ClientMeetingType, ParticipantInput } from "@/lib/calendar-mapper";
import {
  ALL_LEAD_CHANNELS, ALL_LEAD_STATUSES, ClientLeadChannel, ClientLeadStatus, LeadLogEntry,
} from "@/lib/lead-mapper";
import { toast } from "@/hooks/use-toast";
import { useCan } from "@/components/Can";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Sentinel for shadcn Select — SelectItem can't carry an empty value, so we
// translate "" ↔ this token at the form boundary.
const NONE = "__none__";

const statusColors: Record<ClientLeadStatus, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-purple-100 text-purple-700",
  "Test Drive": "bg-amber-100 text-amber-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Closed: "bg-emerald-100 text-emerald-700",
  Archived: "bg-slate-100 text-slate-600",
};

const channelColors: Record<ClientLeadChannel, string> = {
  Call: "bg-blue-100 text-blue-700",
  Email: "bg-violet-100 text-violet-700",
  WhatsApp: "bg-emerald-100 text-emerald-700",
  SMS: "bg-amber-100 text-amber-700",
  Offline: "bg-slate-100 text-slate-700",
  Website: "bg-cyan-100 text-cyan-700",
};

const seedLogForm = (): LeadLogInput & { id?: string } => ({
  channel: "Call",
  vehicleId: "",
  byStaffId: "",
  summary: "",
});

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const leadQuery = useLead(id);
  const updateLead = useUpdateLead(id ?? "");
  const deleteLead = useDeleteLead();
  const closeLead = useCloseLead(id ?? "");
  const bookTestDrive = useBookLeadTestDrive(id ?? "");
  const createCalendarEvent = useCreateCalendarEvent();
  const appendLog = useAppendLeadLog(id ?? "");
  const updateLog = useUpdateLeadLog(id ?? "");
  const deleteLog = useDeleteLeadLog(id ?? "");
  const staffQuery = useStaff();
  const vehiclesQuery = useVehicles({ limit: 100 });
  const leadVehicleQuery = useVehicle(leadQuery.data?.vehicleId);
  const { state: authState } = useAuth();
  const currentUser = authState.user;
  const canEdit = useCan("Leads & Sales", "edit");
  const canDelete = useCan("Leads & Sales", "delete");
  const confirm = useConfirm();

  const [status, setStatus] = useState<ClientLeadStatus>("New");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [askedPrice, setAskedPrice] = useState<string>("");

  // Book Test Drive dialog
  const [tdDialogOpen, setTdDialogOpen] = useState(false);
  const [tdForm, setTdForm] = useState({
    date: "",
    time: "10:00",
    assignedTo: "",
    notes: "",
    meetingType: "physical" as ClientMeetingType,
    location: "",
    createMeet: false,
    meetLink: "",
    participants: [] as ParticipantInput[],
  });
  const [tdParticipantPick, setTdParticipantPick] = useState("");


  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState<LeadLogInput & { id?: string }>(seedLogForm());
  const [pendingDeleteLog, setPendingDeleteLog] = useState<LeadLogEntry | null>(null);

  // Close-lead dialog state — opens when the user saves with status → Closed.
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeForm, setCloseForm] = useState<CloseLeadInput & { _amountPaidTouched?: boolean }>({
    soldAt: 0,
    amountPaid: undefined,
    paymentMethod: "cash",
    paymentStatus: "paid",
    saleDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    if (leadQuery.data) {
      setStatus(leadQuery.data.status);
      // Leads are never unassigned — fall back to the current user.
      setAssigneeId(leadQuery.data.assignedToId || currentUser?._id || "");
      setNotes(leadQuery.data.notes);
      setAskedPrice(leadQuery.data.askedPrice > 0 ? String(leadQuery.data.askedPrice) : "");
    }
  }, [leadQuery.data, currentUser]);

  const lead = leadQuery.data;
  const back = () => navigate("/leads", { state: location.state });

  if (leadQuery.isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={back} />
        <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading lead…
        </div>
      </div>
    );
  }

  if (leadQuery.error || !lead) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={back} />
        <div className="stat-card text-center py-12">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">{leadQuery.error instanceof Error ? leadQuery.error.message : "Lead not found."}</p>
        </div>
      </div>
    );
  }

  const askedPriceNum = askedPrice === "" ? 0 : parseFloat(askedPrice) || 0;
  const hasChanges =
    status !== lead.status ||
    assigneeId !== (lead.assignedToId ?? "") ||
    notes !== lead.notes ||
    askedPriceNum !== lead.askedPrice;

  const saveChanges = async () => {
    // Closing a lead is a multi-system action (sale + vehicle + buyer + lead).
    // Intercept the status flip and let the user fill out sale details first,
    // then route through /leads/:id/close instead of plain PATCH.
    if (status === "Closed" && lead.status !== "Closed") {
      setCloseForm({
        soldAt: lead.vehiclePrice ?? 0,
        amountPaid: undefined,
        paymentMethod: "cash",
        paymentStatus: "paid",
        saleDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      setCloseDialogOpen(true);
      return;
    }
    try {
      await updateLead.mutateAsync({
        status,
        assignedToId: assigneeId || null,
        notes,
        askedPrice: askedPriceNum,
      });
      toast({
        title: "Lead updated",
        description:
          askedPriceNum > 0 && askedPriceNum !== lead.askedPrice
            ? `Asked price updated.`
            : undefined,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Update failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const addTdParticipant = () => {
    if (!tdParticipantPick) return;
    const staff = staffOptions.find((s) => s.id === tdParticipantPick);
    if (!staff) return;
    if (tdForm.participants.some((p) => p.userId === staff.id)) { setTdParticipantPick(""); return; }
    setTdForm((f) => ({
      ...f,
      participants: [...f.participants, { userType: "staff", userId: staff.id, name: staff.name, email: staff.email || undefined }],
    }));
    setTdParticipantPick("");
  };
  const removeTdParticipant = (userId?: string) =>
    setTdForm((f) => ({ ...f, participants: f.participants.filter((p) => p.userId !== userId) }));

  const submitTd = async () => {
    if (!tdForm.date || !tdForm.time) {
      toast({ title: "Pick date & time", variant: "destructive" });
      return;
    }
    if (!tdForm.assignedTo) {
      toast({ title: "Assign a staff member", description: "Select who runs this test drive.", variant: "destructive" });
      return;
    }
    if (tdForm.meetingType === "physical" && !tdForm.location.trim()) {
      toast({ title: "Add a location", description: "Enter where the test drive happens.", variant: "destructive" });
      return;
    }
    if (tdForm.meetingType === "virtual" && !tdForm.createMeet && !tdForm.meetLink.trim()) {
      toast({ title: "Add a link", description: "Paste a meeting link or tick “Create Google Meet link”.", variant: "destructive" });
      return;
    }
    const start = new Date(`${tdForm.date}T${tdForm.time}:00`);
    if (Number.isNaN(start.getTime())) {
      toast({ title: "Invalid date/time", variant: "destructive" });
      return;
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // Buyer is auto-added as a participant (so the event surfaces in their
    // filtered calendar), plus any extra staff picked (deduped).
    const participants: ParticipantInput[] = [
      ...(lead.buyerId
        ? [{ userType: "buyer" as const, userId: lead.buyerId, name: lead.buyerName, email: lead.buyerEmail }]
        : []),
      ...tdForm.participants,
    ];

    try {
      await bookTestDrive.mutateAsync({
        scheduledAt: start.toISOString(),
        assignedTo: tdForm.assignedTo,
        notes: tdForm.notes || undefined,
      });
      try {
        await createCalendarEvent.mutateAsync({
          title: `Test Drive — ${lead.vehicleTitle}`,
          type: "testDrive",
          meetingType: tdForm.meetingType,
          createMeetLink: tdForm.meetingType === "virtual" ? tdForm.createMeet : undefined,
          meetLink: tdForm.meetingType === "virtual" ? tdForm.meetLink.trim() || undefined : undefined,
          location: tdForm.meetingType === "physical" ? tdForm.location.trim() || undefined : undefined,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          customerName: lead.buyerName,
          customerEmail: lead.buyerEmail,
          customerPhone: lead.buyerPhone,
          vehicleId: lead.vehicleId,
          // Link the test-drive event to the lead so it also surfaces on the
          // buyer portal's "Your Appointments" + the lead timeline.
          lead: lead.id,
          assignedToId: tdForm.assignedTo,
          participants: participants.length ? participants : undefined,
          notes: tdForm.notes || undefined,
        });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Calendar event failed";
        toast({ title: "Booked, calendar event failed", description: msg, variant: "destructive" });
        setTdDialogOpen(false);
        return;
      }
      toast({ title: "Test drive booked", description: `${lead.vehicleTitle} · ${tdForm.date} ${tdForm.time}` });
      setTdDialogOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not book";
      toast({ title: "Booking failed", description: msg, variant: "destructive" });
    }
  };

  const submitClose = async () => {
    if (!closeForm.soldAt || closeForm.soldAt <= 0) {
      toast({ title: "Sold price required", variant: "destructive" });
      return;
    }
    if (closeForm.paymentStatus === "partial") {
      if (closeForm.amountPaid === undefined || closeForm.amountPaid <= 0) {
        toast({
          title: "Amount paid required",
          description: "Partial payments need the amount actually received.",
          variant: "destructive",
        });
        return;
      }
      if (closeForm.amountPaid > closeForm.soldAt) {
        toast({ title: "Amount paid exceeds sold price", variant: "destructive" });
        return;
      }
    }
    try {
      await closeLead.mutateAsync({
        soldAt: closeForm.soldAt,
        amountPaid: closeForm.amountPaid,
        paymentMethod: closeForm.paymentMethod,
        paymentStatus: closeForm.paymentStatus,
        saleDate: closeForm.saleDate,
        notes: closeForm.notes || undefined,
      });
      toast({
        title: "Lead closed",
        description: `Sale recorded · vehicle marked sold · buyer purchase logged.`,
      });
      setCloseDialogOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not close lead";
      toast({ title: "Close failed", description: msg, variant: "destructive" });
      // Revert the unsaved status pick so the UI doesn't lie about state.
      setStatus(lead.status);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Soft-delete this lead?",
      description: "It can be recovered. Any linked sale stays unless the lead was closed.",
      confirmText: "Delete",
    });
    if (!ok) return;
    // Navigate first; the mutation strips the row from cached lists in its
    // onMutate, so /leads renders without the deleted row the moment it
    // mounts. The HTTP request flies in the background — the rollback in
    // onError restores the row if it fails, then this toast tells the user.
    const id = lead.id;
    back();
    deleteLead.mutate(id, {
      onSuccess: () => toast({ title: "Lead deleted" }),
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : "Delete failed";
        toast({ title: "Delete failed", description: msg, variant: "destructive" });
      },
    });
  };

  const openLogDialog = (existing?: LeadLogEntry) => {
    setLogForm(
      existing
        ? {
            id: existing.id,
            channel: existing.channel,
            vehicleId: existing.vehicleId ?? "",
            byStaffId: existing.byStaffId ?? "",
            summary: existing.summary,
            at: existing.date ? new Date(existing.date).toISOString() : undefined,
          }
        : { ...seedLogForm(), vehicleId: lead.vehicleId },
    );
    setLogDialogOpen(true);
  };

  const submitLog = async () => {
    if (!logForm.summary.trim()) {
      toast({ title: "Summary required", variant: "destructive" });
      return;
    }
    const body: LeadLogInput = {
      channel: logForm.channel,
      summary: logForm.summary.trim(),
      vehicleId: logForm.vehicleId || undefined,
      byStaffId: logForm.byStaffId || undefined,
      at: logForm.at,
    };
    try {
      if (logForm.id) {
        await updateLog.mutateAsync({ logId: logForm.id, input: body });
        toast({ title: "Log entry updated" });
      } else {
        await appendLog.mutateAsync(body);
        toast({ title: "Communication logged" });
      }
      setLogDialogOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const confirmDeleteLog = async () => {
    if (!pendingDeleteLog) return;
    try {
      await deleteLog.mutateAsync(pendingDeleteLog.id);
      toast({ title: "Log entry deleted" });
      setPendingDeleteLog(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  // Copy the public buyer-portal link so staff can send it to the customer.
  // The portal is the same SPA (route /portal/:leadId), so we build it off the
  // current origin.
  const copyPortalLink = async () => {
    const url = `${window.location.origin}/portal/${lead.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Portal link copied", description: "Share it with the buyer to track their journey." });
    } catch {
      // Clipboard API can fail (insecure context / denied permission) — surface
      // the URL in the toast so the user can copy it manually.
      toast({ title: "Couldn't copy — here's the link", description: url, variant: "destructive" });
    }
  };

  const staffOptions = staffQuery.data ?? [];
  const vehicleOptions = vehiclesQuery.data?.data ?? [];

  // Terminal-state gating: a closed lead can only be archived; an archived lead
  // can't move at all. Both lock assignee / asked-price / test-drive.
  const isClosed = lead.status === "Closed";
  const isArchived = lead.status === "Archived";
  const isTerminal = isClosed || isArchived;
  const statusOptions: ClientLeadStatus[] = isClosed
    ? ["Closed", "Archived"]
    : isArchived
      ? ["Archived"]
      : ALL_LEAD_STATUSES; // active leads can move anywhere (Closed opens the sale dialog)

  // Sale summary (shown once closed). Sold price + full cost basis
  // (acquisition + reconditioning) → gross margin, matching the project's
  // profit definition (revenue − cost, expenses excluded).
  const soldVehicle = leadVehicleQuery.data;
  const saleSummary =
    isClosed && soldVehicle
      ? {
          soldPrice: soldVehicle.soldAt || 0,
          costPrice: (soldVehicle.costPrice || 0) + (soldVehicle.totalSpend || 0),
        }
      : null;
  const grossMargin = saleSummary ? saleSummary.soldPrice - saleSummary.costPrice : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <BackBtn onClick={back} />

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-muted-foreground">{lead.id.slice(-8)}</p>
          <h1 className="module-title">{lead.buyerName} – {lead.vehicleTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">Created {lead.createdAt} · Source: {lead.source}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-badge ${statusColors[lead.status]}`}>{lead.status}</span>
          <button
            onClick={copyPortalLink}
            className="flex items-center gap-2 bg-card border px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted"
            title="Copy the buyer portal link to share with the customer"
          >
            <Copy className="h-3.5 w-3.5" /> Copy link
          </button>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleteLead.isPending}
              className="flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {deleteLead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="stat-card space-y-3">
          <h3 className="font-display font-semibold text-sm uppercase text-muted-foreground tracking-wide">Buyer</h3>
          <p className="font-medium">{lead.buyerName}</p>
          <div className="text-sm space-y-1">
            {lead.buyerEmail && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {lead.buyerEmail}</p>}
            {lead.buyerPhone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {lead.buyerPhone}</p>}
          </div>
          <button onClick={() => navigate(`/crm-buyers/${lead.buyerId}`)} className="w-full text-xs text-primary text-left hover:underline">
            View buyer profile →
          </button>
        </div>

        <div className="stat-card space-y-3">
          <h3 className="font-display font-semibold text-sm uppercase text-muted-foreground tracking-wide">Vehicle</h3>
          <p className="font-medium">{lead.vehicleTitle}</p>
          {lead.vehiclePrice !== undefined && (
            <p className="text-xs text-muted-foreground">${lead.vehiclePrice.toLocaleString()}</p>
          )}
          <button onClick={() => navigate(`/inventory/${lead.vehicleId}`)} className="w-full text-xs text-primary text-left hover:underline">
            View vehicle details →
          </button>
        </div>

        <div className="stat-card space-y-3">
          <h3 className="font-display font-semibold text-sm uppercase text-muted-foreground tracking-wide">Update Lead</h3>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ClientLeadStatus)}
              disabled={!canEdit || isArchived}
            >
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {isClosed && (
              <p className="text-[10px] text-muted-foreground mt-1">Closed — can only be archived (voids the sale).</p>
            )}
            {isArchived && (
              <p className="text-[10px] text-muted-foreground mt-1">Archived is final — this lead can't be reopened.</p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Assigned Staff</label>
            <Select
              value={assigneeId || undefined}
              onValueChange={(v) => setAssigneeId(v)}
              disabled={!canEdit || isTerminal}
            >
              <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Select staff…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.roleName ? ` · ${s.roleName}` : ""}{s.id === currentUser?._id ? " (you)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Asked price</label>
            <input
              type="number"
              value={askedPrice}
              onChange={(e) => setAskedPrice(e.target.value)}
              placeholder="0"
              disabled={!canEdit || isTerminal}
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-background disabled:opacity-60"
            />
          </div>
          {canEdit && (
            <>
              <button
                onClick={saveChanges}
                disabled={!hasChanges || updateLead.isPending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {updateLead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
              {!isTerminal && (
                <button
                  onClick={() => {
                    setTdForm({
                      date: "", time: "10:00", assignedTo: assigneeId || currentUser?._id || "", notes: "",
                      meetingType: "physical", location: "", createMeet: false, meetLink: "", participants: [],
                    });
                    setTdParticipantPick("");
                    setTdDialogOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-muted py-2 rounded-lg text-sm font-medium hover:bg-muted/80"
                >
                  <CalendarDays className="h-4 w-4" /> Book test drive
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sale summary — shown once the lead is closed (car sold). */}
      {isClosed && (
        <div className="stat-card">
          <h3 className="font-display font-semibold text-sm uppercase text-muted-foreground tracking-wide mb-3">Sale Summary</h3>
          {leadVehicleQuery.isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading sale…</p>
          ) : saleSummary ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Sold Price</p>
                <p className="text-xl font-bold font-display">${saleSummary.soldPrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost Price</p>
                <p className="text-xl font-bold font-display">${saleSummary.costPrice.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">acquisition + reconditioning</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross Margin</p>
                <p className={`text-xl font-bold font-display ${grossMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {grossMargin < 0 ? "-" : ""}${Math.abs(grossMargin).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sale details unavailable.</p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Timeline</h3>
          {lead.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No events yet.</p>
          ) : (
            <div className="space-y-3">
              {lead.timeline.map((t, i) => (
                <div key={i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.action}</p>
                    <p className="text-xs text-muted-foreground">{t.date} · {t.by}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold">Communication Log</h3>
            {canEdit && (
              <button
                onClick={() => openLogDialog()}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Log communication
              </button>
            )}
          </div>
          {lead.log.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No communications logged yet.</p>
          ) : (
            <div className="space-y-3">
              {lead.log.map((c) => (
                <div key={c.id} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0 group">
                  <span className={`status-badge ${channelColors[c.channel]} h-fit`}>{c.channel}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {c.byStaffName ?? "Unknown staff"}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.date}</span>
                    </div>
                    <p className="text-sm">{c.summary}</p>
                    {c.vehicleTitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        about <span className="font-medium">{c.vehicleTitle}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 opacity-60 group-hover:opacity-100">
                    {canEdit && (
                      <button onClick={() => openLogDialog(c)} className="text-xs text-muted-foreground hover:text-primary">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setPendingDeleteLog(c)} className="text-xs text-red-600 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="stat-card">
        <h3 className="font-display font-semibold mb-3">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
        />
        <p className="text-xs text-muted-foreground mt-2">Notes are saved when you press "Save Changes" in the Update Lead panel.</p>
      </div>

      {/* Log communication dialog (add + edit) */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{logForm.id ? "Edit communication" : "Log communication"}</DialogTitle>
            <DialogDescription>Capture an interaction on this lead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Channel</label>
              <Select
                value={logForm.channel}
                onValueChange={(v) => setLogForm({ ...logForm, channel: v as ClientLeadChannel })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_LEAD_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Performed by</label>
              <Select
                value={logForm.byStaffId || NONE}
                onValueChange={(v) => setLogForm({ ...logForm, byStaffId: v === NONE ? "" : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Me (logged-in user)" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Me (logged-in user)</SelectItem>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.roleName ? ` · ${s.roleName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">About vehicle (optional)</label>
              <Select
                value={logForm.vehicleId || NONE}
                onValueChange={(v) => setLogForm({ ...logForm, vehicleId: v === NONE ? "" : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>None</SelectItem>
                  {lead.vehicleId && (
                    <SelectGroup>
                      <SelectLabel>This lead's vehicle</SelectLabel>
                      <SelectItem key={`lead-${lead.vehicleId}`} value={lead.vehicleId}>
                        {lead.vehicleTitle}
                      </SelectItem>
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>All inventory</SelectLabel>
                    {vehicleOptions.map((v) => (
                      <SelectItem key={`all-${v.id}`} value={v.id}>{v.title}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Summary</label>
              <textarea
                value={logForm.summary}
                onChange={(e) => setLogForm({ ...logForm, summary: e.target.value })}
                placeholder="What was discussed?"
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setLogDialogOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={submitLog}
              disabled={appendLog.isPending || updateLog.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {(appendLog.isPending || updateLog.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {logForm.id ? "Save changes" : "Log"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book Test Drive dialog — vehicle is locked to this lead's vehicle. */}
      <Dialog open={tdDialogOpen} onOpenChange={setTdDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Book test drive — {lead.vehicleTitle}</DialogTitle>
            <DialogDescription>
              Creates a calendar event and (if not already past) auto-advances this lead to Test Drive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Date</label>
                <input type="date" value={tdForm.date} onChange={(e) => setTdForm({ ...tdForm, date: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm bg-background" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Time</label>
                <input type="time" value={tdForm.time} onChange={(e) => setTdForm({ ...tdForm, time: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm bg-background" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Assign to staff *</label>
              <Select
                value={tdForm.assignedTo || undefined}
                onValueChange={(v) => setTdForm({ ...tdForm, assignedTo: v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select staff…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.roleName ? ` · ${s.roleName}` : ""}{s.id === currentUser?._id ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!tdForm.assignedTo && (
                <p className="text-[10px] text-amber-700 mt-0.5">Required — a test drive needs a responsible staff member.</p>
              )}
            </div>

            {/* Meeting type — physical (location) or virtual (paste/create link). */}
            <div className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Meeting type</p>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={tdForm.meetingType === "physical"}
                    onChange={() => setTdForm({ ...tdForm, meetingType: "physical", createMeet: false })}
                  />
                  <MapPin className="h-3.5 w-3.5" /> Physical
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={tdForm.meetingType === "virtual"}
                    onChange={() => setTdForm({ ...tdForm, meetingType: "virtual" })}
                  />
                  <Video className="h-3.5 w-3.5" /> Virtual
                </label>
              </div>
              {tdForm.meetingType === "physical" ? (
                <input
                  value={tdForm.location}
                  onChange={(e) => setTdForm({ ...tdForm, location: e.target.value })}
                  placeholder="Address or place *"
                  className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                />
              ) : (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={tdForm.createMeet}
                      onChange={(e) => setTdForm({ ...tdForm, createMeet: e.target.checked })}
                    />
                    <Video className="h-3.5 w-3.5 text-violet-500" /> Create Google Meet link
                  </label>
                  <input
                    value={tdForm.meetLink}
                    onChange={(e) => setTdForm({ ...tdForm, meetLink: e.target.value })}
                    placeholder="Or paste an existing meet/zoom/teams link"
                    className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                    disabled={tdForm.createMeet}
                  />
                  {tdForm.createMeet && (
                    <p className="text-[10px] text-muted-foreground">A Google Meet link is generated when you save.</p>
                  )}
                </div>
              )}
            </div>

            {/* Participants — buyer is auto-added; add extra staff here. */}
            <div className="border rounded-lg p-2.5 space-y-2 bg-muted/20">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Participants</p>
              <div className="flex gap-2">
                <select
                  value={tdParticipantPick}
                  onChange={(e) => setTdParticipantPick(e.target.value)}
                  className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-background"
                >
                  <option value="">Add staff…</option>
                  {staffOptions
                    .filter((s) => !tdForm.participants.some((p) => p.userId === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addTdParticipant}
                  disabled={!tdParticipantPick}
                  className="px-2.5 py-1.5 rounded-md bg-muted text-sm font-medium hover:bg-muted/80 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">{lead.buyerName} (buyer) is added automatically.</p>
              {tdForm.participants.length > 0 && (
                <ul className="space-y-1">
                  {tdForm.participants.map((p) => (
                    <li key={p.userId} className="flex items-center justify-between text-sm bg-background border rounded-md px-2 py-1">
                      <span className="truncate">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => removeTdParticipant(p.userId)}
                        className="text-muted-foreground hover:text-red-600 shrink-0"
                        title="Remove participant"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <input
              value={tdForm.notes}
              onChange={(e) => setTdForm({ ...tdForm, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setTdDialogOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={submitTd}
              disabled={bookTestDrive.isPending || createCalendarEvent.isPending || !tdForm.assignedTo}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {(bookTestDrive.isPending || createCalendarEvent.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              Book test drive
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Lead dialog — fires when user sets status → Closed and saves */}
      <Dialog
        open={closeDialogOpen}
        onOpenChange={(o) => {
          setCloseDialogOpen(o);
          if (!o) setStatus(lead.status); // revert if user cancels
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Close lead — {lead.vehicleTitle}</DialogTitle>
            <DialogDescription>
              This creates a Sale, marks the vehicle Sold, adds it to the buyer's purchases, and closes the lead.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Sold at ($) *</label>
              <input
                type="number"
                value={closeForm.soldAt || ""}
                onChange={(e) => setCloseForm({ ...closeForm, soldAt: parseFloat(e.target.value) || 0 })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Sale date</label>
              <input
                type="date"
                value={closeForm.saleDate ?? ""}
                onChange={(e) => setCloseForm({ ...closeForm, saleDate: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Payment method</label>
              <Select
                value={closeForm.paymentMethod}
                onValueChange={(v) => setCloseForm({ ...closeForm, paymentMethod: v as CloseLeadInput["paymentMethod"] })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="bhph">BHPH</SelectItem>
                  <SelectItem value="trade_in">Trade-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Payment status</label>
              <Select
                value={closeForm.paymentStatus}
                onValueChange={(v) => {
                  const ps = v as CloseLeadInput["paymentStatus"];
                  setCloseForm((prev) => ({
                    ...prev,
                    paymentStatus: ps,
                    // Auto-pre-fill amountPaid on switch: full when paid, 0 when pending,
                    // leave blank for partial so the user has to enter it.
                    amountPaid:
                      ps === "paid" ? prev.soldAt
                        : ps === "pending" ? 0
                        : prev.amountPaid,
                  }));
                }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] text-muted-foreground">
                Amount paid ($) {closeForm.paymentStatus === "partial" && "*"}
              </label>
              <input
                type="number"
                value={closeForm.amountPaid ?? ""}
                onChange={(e) => setCloseForm({ ...closeForm, amountPaid: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                placeholder={
                  closeForm.paymentStatus === "paid" ? `Defaults to sold price ($${closeForm.soldAt.toLocaleString()})`
                  : closeForm.paymentStatus === "pending" ? "Leave blank (or 0)"
                  : "Required for partial payments"
                }
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <textarea
              value={closeForm.notes ?? ""}
              onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
              placeholder="Notes (optional)"
              rows={2}
              className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2"
            />
          </div>
          <DialogFooter>
            <button onClick={() => { setCloseDialogOpen(false); setStatus(lead.status); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={submitClose}
              disabled={closeLead.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {closeLead.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Close lead & record sale
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete log entry confirmation */}
      <AlertDialog
        open={Boolean(pendingDeleteLog)}
        onOpenChange={(o) => !o && setPendingDeleteLog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this log entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the communication record from this lead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLog}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteLog.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</span>
              ) : (
                "Delete entry"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back to Leads
    </button>
  );
}
