import { useEffect, useState } from "react";
import {
  AlertCircle, ArrowLeft, CalendarDays, Edit, Loader2, Mail, Phone, Plus, Save, Trash2,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  CloseLeadInput, LeadLogInput, useAppendLeadLog, useBookLeadTestDrive, useCloseLead,
  useDeleteLead, useDeleteLeadLog, useLead, useUpdateLead, useUpdateLeadLog,
} from "@/hooks/api/use-leads";
import { useCreateCalendarEvent } from "@/hooks/api/use-calendar";
import { useStaff } from "@/hooks/api/use-staff";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { ApiError } from "@/lib/api";
import {
  ALL_LEAD_CHANNELS, ALL_LEAD_STATUSES, ClientLeadChannel, ClientLeadStatus, LeadLogEntry,
} from "@/lib/lead-mapper";
import { toast } from "@/hooks/use-toast";
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
  });


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
      setAssigneeId(leadQuery.data.assignedToId ?? "");
      setNotes(leadQuery.data.notes);
      setAskedPrice(leadQuery.data.askedPrice > 0 ? String(leadQuery.data.askedPrice) : "");
    }
  }, [leadQuery.data]);

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
            ? `Asked price set — pipeline moved to Negotiation.`
            : undefined,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Update failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const submitTd = async () => {
    if (!tdForm.date || !tdForm.time) {
      toast({ title: "Pick date & time", variant: "destructive" });
      return;
    }
    const start = new Date(`${tdForm.date}T${tdForm.time}:00`);
    if (Number.isNaN(start.getTime())) {
      toast({ title: "Invalid date/time", variant: "destructive" });
      return;
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      await bookTestDrive.mutateAsync({
        scheduledAt: start.toISOString(),
        assignedTo: tdForm.assignedTo || undefined,
        notes: tdForm.notes || undefined,
      });
      try {
        await createCalendarEvent.mutateAsync({
          title: `Test Drive — ${lead.vehicleTitle}`,
          type: "testDrive",
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          customerName: lead.buyerName,
          customerEmail: lead.buyerEmail,
          customerPhone: lead.buyerPhone,
          vehicleId: lead.vehicleId,
          assignedToId: tdForm.assignedTo || undefined,
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

  const handleDelete = () => {
    if (!window.confirm("Soft-delete this lead?")) return;
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

  const staffOptions = staffQuery.data ?? [];
  const vehicleOptions = vehiclesQuery.data?.data ?? [];

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
            onClick={handleDelete}
            disabled={deleteLead.isPending}
            className="flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {deleteLead.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
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
            <Select value={status} onValueChange={(v) => setStatus(v as ClientLeadStatus)}>
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Assigned Staff</label>
            <Select
              value={assigneeId || NONE}
              onValueChange={(v) => setAssigneeId(v === NONE ? "" : v)}
            >
              <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}{s.roleName ? ` · ${s.roleName}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Asked price <span className="text-[10px]">(auto-moves lead to Negotiation)</span>
            </label>
            <input
              type="number"
              value={askedPrice}
              onChange={(e) => setAskedPrice(e.target.value)}
              placeholder="0"
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <button
            onClick={saveChanges}
            disabled={!hasChanges || updateLead.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {updateLead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
          <button
            onClick={() => {
              setTdForm({ date: "", time: "10:00", assignedTo: assigneeId, notes: "" });
              setTdDialogOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 bg-muted py-2 rounded-lg text-sm font-medium hover:bg-muted/80"
          >
            <CalendarDays className="h-4 w-4" /> Book test drive
          </button>
        </div>
      </div>

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
            <button
              onClick={() => openLogDialog()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Log communication
            </button>
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
                    <button onClick={() => openLogDialog(c)} className="text-xs text-muted-foreground hover:text-primary">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setPendingDeleteLog(c)} className="text-xs text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
              <label className="text-[11px] text-muted-foreground">Assign to staff</label>
              <Select
                value={tdForm.assignedTo || NONE}
                onValueChange={(v) => setTdForm({ ...tdForm, assignedTo: v === NONE ? "" : v })}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.roleName ? ` · ${s.roleName}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={bookTestDrive.isPending || createCalendarEvent.isPending}
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
