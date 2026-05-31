import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Edit, Eye, Heart, Loader2, Mail,
  MessageCircle, Phone, Plus, ShoppingBag, Trash2, X,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  useAddBuyerCommunication, useAddBuyerInterestedVehicle, useBookBuyerTestDrive,
  useBuyer, useDeleteBuyer, useDeleteBuyerCommunication, useRemoveBuyerInterestedVehicle,
  useUpdateBuyer, useUpdateBuyerCommunication,
} from "@/hooks/api/use-buyers";
import { useCreateCalendarEvent } from "@/hooks/api/use-calendar";
import { useStaff } from "@/hooks/api/use-staff";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { ApiError, fileUrl } from "@/lib/api";
import {
  BuyerCommChannel, BuyerCommunication, BuyerCommunicationInput, ClientBuyerStatus,
} from "@/lib/buyer-mapper";
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
import { useCan } from "@/components/Can";

const LEAD_STATUSES: ClientBuyerStatus[] = ["Active", "Converted", "Dropped"];

// Sentinel used as the "no selection" value for shadcn Select — its SelectItem
// can't have an empty string value, so we translate to/from "" at the form
// boundary.
const UNASSIGNED = "__unassigned__";

const statusColors: Record<ClientBuyerStatus, string> = {
  Active: "bg-blue-100 text-blue-700",
  Converted: "bg-emerald-100 text-emerald-700",
  Dropped: "bg-gray-100 text-gray-600",
};

const channelColors: Record<BuyerCommChannel, string> = {
  call: "bg-blue-100 text-blue-700",
  email: "bg-violet-100 text-violet-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  sms: "bg-amber-100 text-amber-700",
  offline: "bg-slate-100 text-slate-700",
};

const channelLabel: Record<BuyerCommChannel, string> = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  offline: "Offline",
};

const seedEditForm = () => ({
  name: "",
  email: "",
  phone: "",
  notes: "",
  leadStatus: "Active" as ClientBuyerStatus,
});

const seedCommForm = (): BuyerCommunicationInput & { id?: string } => ({
  channel: "call",
  vehicleId: "",
  byStaffId: "",
  summary: "",
});

const seedTestDriveForm = () => ({
  vehicleId: "",
  date: "",
  time: "10:00",
  assignedTo: "",
  notes: "",
});

export default function BuyerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const buyerQuery = useBuyer(id);
  const updateBuyer = useUpdateBuyer(id ?? "");
  const deleteBuyer = useDeleteBuyer();
  const addInterested = useAddBuyerInterestedVehicle(id ?? "");
  const removeInterested = useRemoveBuyerInterestedVehicle(id ?? "");
  const bookTestDrive = useBookBuyerTestDrive(id ?? "");
  const addComm = useAddBuyerCommunication(id ?? "");
  const updateComm = useUpdateBuyerCommunication(id ?? "");
  const deleteComm = useDeleteBuyerCommunication(id ?? "");
  const createCalendarEvent = useCreateCalendarEvent();
  const vehiclesQuery = useVehicles({ limit: 100 });
  const staffQuery = useStaff();

  const canEdit = useCan("CRM – Buyers", "edit");
  const canDelete = useCan("CRM – Buyers", "delete");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(seedEditForm());

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pickerVehicleId, setPickerVehicleId] = useState("");

  const [testDriveOpen, setTestDriveOpen] = useState(false);
  const [testDriveForm, setTestDriveForm] = useState(seedTestDriveForm());

  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [commForm, setCommForm] = useState<BuyerCommunicationInput & { id?: string }>(seedCommForm());

  const buyer = buyerQuery.data;
  const back = () => navigate("/crm-buyers", { state: location.state });

  useEffect(() => {
    if (!buyer) return;
    setEditForm({
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      notes: buyer.notes,
      leadStatus: buyer.status,
    });
  }, [buyer]);

  const interestedIdSet = useMemo(
    () => new Set(buyer?.interestedVehicles.map((v) => v.vehicleId) ?? []),
    [buyer],
  );

  if (buyerQuery.isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={back} />
        <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading buyer…
        </div>
      </div>
    );
  }
  if (buyerQuery.error || !buyer) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={back} />
        <div className="stat-card text-center py-12">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">{buyerQuery.error instanceof Error ? buyerQuery.error.message : "Buyer not found."}</p>
        </div>
      </div>
    );
  }

  const saveEdit = async () => {
    if (!editForm.name || !editForm.email || !editForm.phone) {
      toast({ title: "Missing info", description: "Name, email, and phone are required.", variant: "destructive" });
      return;
    }
    try {
      await updateBuyer.mutateAsync({
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        notes: editForm.notes,
        leadStatus: editForm.leadStatus,
      });
      toast({ title: "Buyer updated" });
      setEditOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not update";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteBuyer.mutateAsync(buyer.id);
      toast({ title: "Buyer deleted", description: buyer.name });
      navigate("/crm-buyers", { state: location.state });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const handleAddInterested = async () => {
    if (!pickerVehicleId) return;
    if (interestedIdSet.has(pickerVehicleId)) {
      toast({ title: "Already on the list", variant: "destructive" });
      return;
    }
    try {
      await addInterested.mutateAsync(pickerVehicleId);
      setPickerVehicleId("");
      toast({ title: "Vehicle added to interests" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not add";
      toast({ title: "Add failed", description: msg, variant: "destructive" });
    }
  };

  const handleRemoveInterested = async (vehicleId: string) => {
    try {
      await removeInterested.mutateAsync(vehicleId);
      toast({ title: "Removed from interests" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove";
      toast({ title: "Remove failed", description: msg, variant: "destructive" });
    }
  };

  const openTestDriveDialog = (vehicleId?: string) => {
    setTestDriveForm({ ...seedTestDriveForm(), vehicleId: vehicleId ?? "" });
    setTestDriveOpen(true);
  };

  const submitTestDrive = async () => {
    if (!testDriveForm.vehicleId) {
      toast({ title: "Pick a vehicle", variant: "destructive" });
      return;
    }
    if (!testDriveForm.date || !testDriveForm.time) {
      toast({ title: "Pick date & time", variant: "destructive" });
      return;
    }
    const start = new Date(`${testDriveForm.date}T${testDriveForm.time}:00`);
    if (Number.isNaN(start.getTime())) {
      toast({ title: "Invalid date/time", variant: "destructive" });
      return;
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const vehicleTitle =
      buyer.interestedVehicles.find((v) => v.vehicleId === testDriveForm.vehicleId)?.title ??
      vehiclesQuery.data?.data.find((v) => v.id === testDriveForm.vehicleId)?.title ??
      "Vehicle";

    try {
      await bookTestDrive.mutateAsync({
        vehicleId: testDriveForm.vehicleId,
        vehicleTitle,
        scheduledAt: start.toISOString(),
        assignedTo: testDriveForm.assignedTo || undefined,
        notes: testDriveForm.notes || undefined,
      });
      try {
        await createCalendarEvent.mutateAsync({
          title: `Test Drive — ${vehicleTitle}`,
          type: "testDrive",
          // Test drives are in-person — explicit so the schema default
          // doesn't drift and the detail dialog renders the right block.
          meetingType: "physical",
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          customerName: buyer.name,
          customerEmail: buyer.email,
          customerPhone: buyer.phone,
          vehicleId: testDriveForm.vehicleId,
          assignedToId: testDriveForm.assignedTo || undefined,
          // Add the buyer as a participant so the event shows up in the
          // buyer's filtered "My calendar" view, not just the staff's.
          participants: [
            {
              userType: "buyer" as const,
              userId: buyer.id,
              name: buyer.name,
              email: buyer.email,
            },
          ],
          notes: testDriveForm.notes || undefined,
        });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Calendar event failed";
        toast({ title: "Booked, but calendar event failed", description: msg, variant: "destructive" });
        setTestDriveOpen(false);
        return;
      }
      toast({ title: "Test drive booked", description: `${vehicleTitle} · ${testDriveForm.date} ${testDriveForm.time}` });
      setTestDriveOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not book";
      toast({ title: "Booking failed", description: msg, variant: "destructive" });
    }
  };

  const openCommDialog = (existing?: BuyerCommunication) => {
    setCommForm(
      existing
        ? {
            id: existing.id,
            channel: existing.channel,
            vehicleId: existing.vehicleId ?? "",
            byStaffId: existing.byStaffId ?? "",
            summary: existing.summary,
            at: existing.date ? new Date(existing.date).toISOString() : undefined,
          }
        : seedCommForm(),
    );
    setCommDialogOpen(true);
  };

  const submitComm = async () => {
    if (!commForm.summary.trim()) {
      toast({ title: "Summary required", variant: "destructive" });
      return;
    }
    const body: BuyerCommunicationInput = {
      channel: commForm.channel,
      summary: commForm.summary.trim(),
      vehicleId: commForm.vehicleId || undefined,
      byStaffId: commForm.byStaffId || undefined,
      at: commForm.at,
    };
    try {
      if (commForm.id) {
        await updateComm.mutateAsync({ commId: commForm.id, input: body });
        toast({ title: "Communication updated" });
      } else {
        await addComm.mutateAsync(body);
        toast({ title: "Communication logged" });
      }
      setCommDialogOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const removeCommEntry = async (commId: string) => {
    try {
      await deleteComm.mutateAsync(commId);
      toast({ title: "Communication deleted" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const initials = buyer.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const availableVehicles = (vehiclesQuery.data?.data ?? []).filter((v) => !interestedIdSet.has(v.id));
  const staffOptions = staffQuery.data ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <BackBtn onClick={back} />
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80"
            >
              <Edit className="h-4 w-4" /> Edit
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Header: buyer card + KPI strip */}
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="stat-card lg:col-span-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-amber-500 text-white flex items-center justify-center text-lg font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-lg truncate">{buyer.name}</h2>
              <p className="text-xs text-muted-foreground font-mono">{buyer.code}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="truncate">{buyer.email}</span></p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /> {buyer.phone}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">Lead Status:</span>
              <span className={`status-badge ${statusColors[buyer.status]}`}>{buyer.status}</span>
            </div>
          </div>
          {canEdit && (
            <div className="pt-2 space-y-2">
              <button
                onClick={() => openTestDriveDialog()}
                className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2"
              >
                <CalendarDays className="h-4 w-4" /> Book Test Drive
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setCommForm({ ...seedCommForm(), channel: "call" }); setCommDialogOpen(true); }}
                  className="bg-muted py-2 rounded-lg text-sm font-medium hover:bg-muted/80 flex items-center justify-center gap-2"
                >
                  <Phone className="h-4 w-4" /> Call
                </button>
                <button
                  onClick={() => { setCommForm({ ...seedCommForm(), channel: "whatsapp" }); setCommDialogOpen(true); }}
                  className="bg-emerald-100 text-emerald-700 py-2 rounded-lg text-sm font-medium hover:bg-emerald-200 flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Kpi icon={Heart} color="bg-rose-50 text-rose-600" value={buyer.interestedVehicles.length} label="Vehicles Interested" />
          <Kpi icon={CalendarDays} color="bg-amber-50 text-amber-600" value={buyer.testDrives.length} label="Test Drives Booked" />
          <Kpi icon={ShoppingBag} color="bg-emerald-50 text-emerald-600" value={buyer.purchases.length} label="Purchased" />
        </div>
      </div>

      {/* Interested vehicles + Test drives */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold">Vehicles Interested</h3>
            <span className="text-xs text-muted-foreground">{buyer.interestedVehicles.length} total</span>
          </div>

          {/* Add interested vehicle picker */}
          {canEdit && (
            <div className="flex gap-2 mb-3">
              <select
                value={pickerVehicleId}
                onChange={(e) => setPickerVehicleId(e.target.value)}
                className="flex-1 border rounded-lg px-2 py-2 text-sm bg-background"
              >
                <option value="">Pick a vehicle to add…</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.title} (${v.price.toLocaleString()})</option>
                ))}
              </select>
              <button
                onClick={handleAddInterested}
                disabled={!pickerVehicleId || addInterested.isPending}
                className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {addInterested.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
          )}

          {buyer.interestedVehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No vehicles linked yet. Pick one above to track interest.
            </p>
          ) : (
            <ul className="space-y-2">
              {buyer.interestedVehicles.map((v) => (
                <li
                  key={v.vehicleId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 group"
                >
                  <button
                    onClick={() => navigate(`/inventory/${v.vehicleId}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <VehicleThumb image={v.image} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.title}</p>
                      <p className="text-xs text-muted-foreground">${v.price.toLocaleString()} · {v.year}</p>
                    </div>
                    <span className="text-xs text-primary flex items-center gap-1 shrink-0">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openTestDriveDialog(v.vehicleId)}
                      className="text-xs text-primary hover:underline shrink-0 hidden sm:inline"
                      title="Book test drive for this vehicle"
                    >
                      Test drive
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleRemoveInterested(v.vehicleId)}
                      disabled={removeInterested.isPending}
                      className="text-xs text-red-600 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold">Test Drives & Purchases</h3>
            {canEdit && (
              <button
                onClick={() => openTestDriveDialog()}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Book test drive
              </button>
            )}
          </div>
          {buyer.purchases.length === 0 && buyer.testDrives.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No test drives or purchases yet.</p>
          ) : (
            <div className="space-y-2">
              {buyer.purchases.map((p) => (
                <div
                  key={`p-${p.id}`}
                  onClick={() => p.vehicleId && navigate(`/inventory/${p.vehicleId}`)}
                  className="flex items-center gap-3 p-2 border rounded-lg bg-emerald-50/40 cursor-pointer hover:bg-emerald-50"
                >
                  <ShoppingBag className="h-4 w-4 text-emerald-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.vehicleTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      Sold {p.date} · ${p.soldAt.toLocaleString()}
                      {p.paymentMethod && ` · ${p.paymentMethod}`}
                    </p>
                  </div>
                  <span className="status-badge bg-emerald-100 text-emerald-700">
                    {p.paymentStatus ?? "Purchased"}
                  </span>
                </div>
              ))}
              {buyer.testDrives.map((t, i) => (
                <div key={`td-${i}`} className="flex items-center gap-3 p-2 border rounded-lg">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.vehicleTitle || `Vehicle ${t.vehicleId.slice(-6)}`}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span className="status-badge bg-blue-100 text-blue-700">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Communication history */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Communication History</h3>
          {canEdit && (
            <button
              onClick={() => openCommDialog()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Log communication
            </button>
          )}
        </div>
        {buyer.communications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No communications logged yet.</p>
        ) : (
          <div className="space-y-3">
            {buyer.communications.map((c) => (
              <div key={c.id} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0 group">
                <span className={`status-badge ${channelColors[c.channel]} h-fit`}>{c.channelLabel}</span>
                <div className="flex-1">
                  <p className="text-sm">{c.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.date}
                    {c.byStaffName && <> · by <span className="font-medium">{c.byStaffName}</span></>}
                    {c.vehicleTitle && <> · about <span className="font-medium">{c.vehicleTitle}</span></>}
                  </p>
                </div>
                <div className="flex gap-2 opacity-60 group-hover:opacity-100">
                  {canEdit && (
                    <button onClick={() => openCommDialog(c)} className="text-xs text-muted-foreground hover:text-primary">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => removeCommEntry(c.id)} className="text-xs text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Buyer</DialogTitle>
            <DialogDescription>Update name, contact, lead status, and notes.</DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Full name *" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Lead status</label>
              <select
                value={editForm.leadStatus}
                onChange={(e) => setEditForm({ ...editForm, leadStatus: e.target.value as ClientBuyerStatus })}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Notes (optional)"
              rows={2}
              className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={saveEdit}
              disabled={updateBuyer.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {updateBuyer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book Test Drive dialog */}
      <Dialog open={testDriveOpen} onOpenChange={setTestDriveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Book Test Drive</DialogTitle>
            <DialogDescription>
              Creates a calendar event and moves this buyer into the Test Drive stage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Vehicle</label>
              <Select
                value={testDriveForm.vehicleId || undefined}
                onValueChange={(v) => setTestDriveForm({ ...testDriveForm, vehicleId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a vehicle…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {buyer.interestedVehicles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Buyer's interested vehicles</SelectLabel>
                      {buyer.interestedVehicles.map((v) => (
                        <SelectItem key={`int-${v.vehicleId}`} value={v.vehicleId}>{v.title}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>All inventory</SelectLabel>
                    {(vehiclesQuery.data?.data ?? []).map((v) => (
                      <SelectItem key={`all-${v.id}`} value={v.id}>{v.title}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Date</label>
                <input type="date" value={testDriveForm.date} onChange={(e) => setTestDriveForm({ ...testDriveForm, date: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm bg-background" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Time</label>
                <input type="time" value={testDriveForm.time} onChange={(e) => setTestDriveForm({ ...testDriveForm, time: e.target.value })} className="w-full border rounded-lg px-2 py-2 text-sm bg-background" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Assign to staff</label>
              <Select
                value={testDriveForm.assignedTo || UNASSIGNED}
                onValueChange={(v) => setTestDriveForm({ ...testDriveForm, assignedTo: v === UNASSIGNED ? "" : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.roleName ? ` · ${s.roleName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              value={testDriveForm.notes}
              onChange={(e) => setTestDriveForm({ ...testDriveForm, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setTestDriveOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={submitTestDrive}
              disabled={bookTestDrive.isPending || createCalendarEvent.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {(bookTestDrive.isPending || createCalendarEvent.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              Book test drive
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Communication dialog (add + edit) */}
      <Dialog open={commDialogOpen} onOpenChange={setCommDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{commForm.id ? "Edit communication" : "Log communication"}</DialogTitle>
            <DialogDescription>Capture an interaction with this buyer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Channel</label>
              <Select
                value={commForm.channel}
                onValueChange={(v) => setCommForm({ ...commForm, channel: v as BuyerCommChannel })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["call", "whatsapp", "sms", "email", "offline"] as BuyerCommChannel[]).map((c) => (
                    <SelectItem key={c} value={c}>{channelLabel[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Performed by</label>
              <Select
                value={commForm.byStaffId || UNASSIGNED}
                onValueChange={(v) => setCommForm({ ...commForm, byStaffId: v === UNASSIGNED ? "" : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Me (logged-in user)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={UNASSIGNED}>Me (logged-in user)</SelectItem>
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
                value={commForm.vehicleId || UNASSIGNED}
                onValueChange={(v) => setCommForm({ ...commForm, vehicleId: v === UNASSIGNED ? "" : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={UNASSIGNED}>None</SelectItem>
                  {buyer.interestedVehicles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Buyer's interested vehicles</SelectLabel>
                      {buyer.interestedVehicles.map((v) => (
                        <SelectItem key={`int-${v.vehicleId}`} value={v.vehicleId}>{v.title}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>All inventory</SelectLabel>
                    {(vehiclesQuery.data?.data ?? []).map((v) => (
                      <SelectItem key={`all-${v.id}`} value={v.id}>{v.title}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Summary</label>
              <textarea
                value={commForm.summary}
                onChange={(e) => setCommForm({ ...commForm, summary: e.target.value })}
                placeholder="What was discussed?"
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setCommDialogOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={submitComm}
              disabled={addComm.isPending || updateComm.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {(addComm.isPending || updateComm.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {commForm.id ? "Save changes" : "Log"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this buyer?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes <span className="font-medium">{buyer.name}</span>. Their interested vehicles stay in inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-700">
              {deleteBuyer.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</span>
              ) : (
                "Delete buyer"
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
      <ArrowLeft className="h-4 w-4" /> Back to Buyers
    </button>
  );
}

function Kpi({ icon: Icon, color, value, label }: { icon: typeof Eye; color: string; value: number; label: string }) {
  return (
    <div className="stat-card">
      <div className={`p-2 rounded-lg w-fit mb-2 ${color}`}><Icon className="h-4 w-4" /></div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function VehicleThumb({ image }: { image: string }) {
  if (image.includes("/")) return <img src={fileUrl(image)} alt="" className="h-10 w-14 object-cover rounded" />;
  return <span className="text-2xl">{image}</span>;
}
