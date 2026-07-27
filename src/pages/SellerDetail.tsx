import { useEffect, useState } from "react";
import {
  ArrowLeft, Mail, Phone, MessageCircle, MapPin, Calendar, TrendingUp,
  Car as CarIcon, Loader2, AlertCircle, Edit, Trash2, Plus, ArrowRight, Eye,
  Video, X,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  useAddSellerVehicle, useDeleteSeller, useDeleteSellerCommunication,
  useLogSellerCommunication, useRemoveSellerVehicle, useScheduleInspection,
  useSeller, useUpdateSeller, useUpdateSellerCommunication, uploadVehicleImages,
} from "@/hooks/api/use-sellers";
import { useCreateCalendarEvent } from "@/hooks/api/use-calendar";
import { useStaff } from "@/hooks/api/use-staff";
import { useAuth } from "@/lib/auth-context";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError, fileUrl } from "@/lib/api";
import { ClientMeetingType, ParticipantInput } from "@/lib/calendar-mapper";
import {
  SELLER_STAGE_LABELS, SellerCommunicationChannel, ServerSellerStage,
} from "@/lib/seller-mapper";
import { VEHICLE_STATUS_BADGE_CLASS, Vehicle, VehicleFormInput } from "@/lib/vehicle-mapper";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VehicleFormDialog } from "@/components/VehicleFormDialog";
import { useCan } from "@/components/Can";

const ALL_STAGES: ServerSellerStage[] = ["new", "contacted", "inspection", "negotiation", "sold", "rejected"];

const seedEditForm = () => ({
  name: "", email: "", phone: "", address: "", city: "", state: "",
  zipCode: "", country: "", notes: "", stage: "new" as ServerSellerStage,
});

export default function SellerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const sellerQuery = useSeller(id);
  const updateSeller = useUpdateSeller(id ?? "");
  const deleteSeller = useDeleteSeller();
  const addVehicle = useAddSellerVehicle(id ?? "");
  const removeVehicle = useRemoveSellerVehicle(id ?? "");
  const scheduleInspection = useScheduleInspection(id ?? "");
  const logCommunication = useLogSellerCommunication(id ?? "");
  const updateCommunication = useUpdateSellerCommunication(id ?? "");
  const deleteCommunication = useDeleteSellerCommunication(id ?? "");
  const confirm = useConfirm();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(seedEditForm());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);

  // Inspection form: pick a vehicle, date, time. Books a Calendar event.
  const [inspectVehicleId, setInspectVehicleId] = useState("");
  const [inspectDate, setInspectDate] = useState("");
  const [inspectTime, setInspectTime] = useState("10:00");
  const [inspectAssignee, setInspectAssignee] = useState("");
  const [inspectNotes, setInspectNotes] = useState("");
  // Meeting details — mirror the Calendar create form.
  const [inspectMeetingType, setInspectMeetingType] = useState<ClientMeetingType>("physical");
  const [inspectLocation, setInspectLocation] = useState("");
  const [inspectCreateMeet, setInspectCreateMeet] = useState(false);
  const [inspectMeetLink, setInspectMeetLink] = useState("");
  const [inspectParticipants, setInspectParticipants] = useState<ParticipantInput[]>([]);
  const [participantPick, setParticipantPick] = useState("");

  const [pendingChannel, setPendingChannel] = useState<SellerCommunicationChannel | null>(null);
  const [logMessage, setLogMessage] = useState("");
  // Inline edit of an existing logged communication.
  const [editingCommId, setEditingCommId] = useState<string | null>(null);
  const [editCommText, setEditCommText] = useState("");
  const createCalendarEvent = useCreateCalendarEvent();
  const staffQuery = useStaff();
  const staffOptions = staffQuery.data ?? [];
  const { state: authState } = useAuth();
  const user = authState.user;

  // Default the inspection assignee to whoever is booking it (current user).
  // Runs once the user + staff list are available; only fills an empty slot so
  // it never fights a manual choice.
  useEffect(() => {
    if (user?._id && !inspectAssignee) setInspectAssignee(user._id);
  }, [user, inspectAssignee]);

  const canEdit = useCan("CRM – Sellers", "edit");
  const canDelete = useCan("CRM – Sellers", "delete");

  const seller = sellerQuery.data;
  const back = () => navigate("/crm-sellers", { state: location.state });

  // Sync edit form when seller loads / changes
  useEffect(() => {
    if (!seller) return;
    setEditForm({
      name: seller.name,
      email: seller.email,
      phone: seller.phone,
      address: seller.address,
      city: seller.city,
      state: seller.state,
      zipCode: seller.zipCode,
      country: seller.country,
      notes: seller.notes,
      stage: seller.stage,
    });
  }, [seller]);

  if (sellerQuery.isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={back} />
        <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading seller…
        </div>
      </div>
    );
  }

  if (sellerQuery.error || !seller) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackBtn onClick={back} />
        <div className="stat-card text-center py-12">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">{sellerQuery.error instanceof Error ? sellerQuery.error.message : "Seller not found."}</p>
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
      await updateSeller.mutateAsync({
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
        zipCode: editForm.zipCode,
        country: editForm.country,
        notes: editForm.notes,
        stage: editForm.stage,
      });
      toast({ title: "Seller updated" });
      setEditOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Update failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteSeller.mutateAsync(seller.id);
      toast({ title: "Seller deleted", description: seller.name });
      navigate("/crm-sellers", { state: location.state });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const handleAddVehicleSubmit = async (input: VehicleFormInput, images: File[]) => {
    try {
      const { newVehicleId } = await addVehicle.mutateAsync(input);

      if (images.length) {
        if (!newVehicleId) {
          // Should never happen with the new backend response shape, but
          // surface it loudly instead of silently dropping the photos.
          toast({
            title: "Vehicle added, photos skipped",
            description: "Couldn't locate the new vehicle id to upload to. Upload them from the vehicle detail page.",
            variant: "destructive",
          });
          setAddVehicleOpen(false);
          return;
        }
        try {
          await uploadVehicleImages(newVehicleId, images);
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : "Image upload failed";
          toast({ title: "Vehicle added, photos failed", description: msg, variant: "destructive" });
          setAddVehicleOpen(false);
          return;
        }
      }

      toast({
        title: "Vehicle added",
        description: images.length
          ? `${input.title} added with ${images.length} photo${images.length === 1 ? "" : "s"} — visible in Inventory.`
          : `${input.title} now appears in Inventory.`,
      });
      setAddVehicleOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not add vehicle";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const handleRemoveVehicle = async (vehicleId: string, title: string) => {
    if (!vehicleId) return;
    try {
      await removeVehicle.mutateAsync(vehicleId);
      toast({ title: "Vehicle unlinked", description: `${title} is still in Inventory.` });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove";
      toast({ title: "Remove failed", description: msg, variant: "destructive" });
    }
  };

  const addParticipant = () => {
    if (!participantPick) return;
    const staff = staffOptions.find((s) => s.id === participantPick);
    if (!staff) return;
    if (inspectParticipants.some((p) => p.userId === staff.id)) {
      setParticipantPick("");
      return;
    }
    setInspectParticipants((prev) => [
      ...prev,
      { userType: "staff", userId: staff.id, name: staff.name, email: staff.email || undefined },
    ]);
    setParticipantPick("");
  };
  const removeParticipant = (userId?: string) =>
    setInspectParticipants((prev) => prev.filter((p) => p.userId !== userId));

  const handleScheduleInspection = async () => {
    if (!inspectVehicleId) {
      toast({ title: "Pick a vehicle", description: "Select which car to inspect.", variant: "destructive" });
      return;
    }
    if (!inspectDate || !inspectTime) {
      toast({ title: "Pick date & time", description: "Both date and time are required.", variant: "destructive" });
      return;
    }
    // Staff assignment is mandatory — an inspection must have someone responsible.
    if (!inspectAssignee) {
      toast({ title: "Assign a staff member", description: "Select who is responsible for this inspection.", variant: "destructive" });
      return;
    }
    if (inspectMeetingType === "physical" && !inspectLocation.trim()) {
      toast({ title: "Add a location", description: "Enter where the inspection takes place.", variant: "destructive" });
      return;
    }
    if (inspectMeetingType === "virtual" && !inspectCreateMeet && !inspectMeetLink.trim()) {
      toast({ title: "Add a link", description: "Paste a meeting link or tick “Create Google Meet link”.", variant: "destructive" });
      return;
    }
    const start = new Date(`${inspectDate}T${inspectTime}:00`);
    if (Number.isNaN(start.getTime())) {
      toast({ title: "Invalid date/time", variant: "destructive" });
      return;
    }
    // Inspections default to a 60-minute slot. Matches the convention used on
    // the Calendar page so the event renders consistently in both grids.
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const listing = seller?.vehiclesListed.find((v) => v.vehicleId === inspectVehicleId);
    const vehicleTitle = listing?.title || "Vehicle";

    // Auto-attach the seller as a participant so the event surfaces on their
    // filtered calendar (same fix as Lead/Buyer test-drive), then add any
    // extra staff participants the user picked (deduped).
    const participants: ParticipantInput[] = [
      ...(seller?.id
        ? [{ userType: "seller" as const, userId: seller.id, name: seller.name, email: seller.email }]
        : []),
      ...inspectParticipants,
    ];

    try {
      // 1) Update the seller (sets inspectionDate + moves stage → Inspection + logs activity).
      await scheduleInspection.mutateAsync({
        inspectionDate: start.toISOString(),
        notes: inspectNotes || undefined,
        vehicleId: inspectVehicleId,
        assignedTo: inspectAssignee,
      });
      // 2) Push a real calendar event so /calendar shows it. Independent of the
      //    seller update — if the event call fails, the inspection is still
      //    recorded on the seller; surface a partial-success toast.
      try {
        await createCalendarEvent.mutateAsync({
          title: `Inspection — ${vehicleTitle}`,
          type: "inspection",
          meetingType: inspectMeetingType,
          createMeetLink: inspectMeetingType === "virtual" ? inspectCreateMeet : undefined,
          meetLink: inspectMeetingType === "virtual" ? inspectMeetLink.trim() || undefined : undefined,
          location: inspectMeetingType === "physical" ? inspectLocation.trim() || undefined : undefined,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          customerName: seller?.name,
          customerEmail: seller?.email,
          customerPhone: seller?.phone,
          vehicleId: inspectVehicleId,
          assignedToId: inspectAssignee,
          participants: participants.length ? participants : undefined,
          notes: inspectNotes || undefined,
        });
        toast({ title: "Inspection booked", description: `${vehicleTitle} · ${inspectDate} ${inspectTime}` });
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Calendar event failed";
        toast({ title: "Seller updated, calendar event failed", description: msg, variant: "destructive" });
      }
      setInspectVehicleId("");
      setInspectDate("");
      setInspectTime("10:00");
      setInspectAssignee(user?._id ?? "");
      setInspectNotes("");
      setInspectMeetingType("physical");
      setInspectLocation("");
      setInspectCreateMeet(false);
      setInspectMeetLink("");
      setInspectParticipants([]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not schedule";
      toast({ title: "Schedule failed", description: msg, variant: "destructive" });
    }
  };

  const submitLog = async () => {
    if (!pendingChannel || !logMessage.trim()) return;
    try {
      await logCommunication.mutateAsync({ channel: pendingChannel, message: logMessage.trim() });
      toast({ title: `${pendingChannel} logged` });
      setLogMessage("");
      setPendingChannel(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not log";
      toast({ title: "Log failed", description: msg, variant: "destructive" });
    }
  };

  const startEditComm = (commId: string, current: string) => {
    setEditingCommId(commId);
    setEditCommText(current);
  };
  const cancelEditComm = () => {
    setEditingCommId(null);
    setEditCommText("");
  };
  const saveEditComm = async () => {
    if (!editingCommId || !editCommText.trim()) return;
    try {
      await updateCommunication.mutateAsync({ commId: editingCommId, message: editCommText.trim() });
      toast({ title: "Communication updated" });
      cancelEditComm();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not update";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  };
  const handleDeleteComm = async (commId: string) => {
    const ok = await confirm({
      title: "Delete this communication?",
      description: "This removes the logged entry. This can't be undone.",
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await deleteCommunication.mutateAsync(commId);
      toast({ title: "Communication deleted" });
      if (editingCommId === commId) cancelEditComm();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not delete";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const openVehicle = (vehicleId: string) => {
    if (vehicleId) navigate(`/inventory/${vehicleId}`);
  };

  const initials = seller.name.split(" ").map((n) => n[0]).join("").slice(0, 2);

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

      {/* Header row: seller card + 3 KPI cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="stat-card lg:col-span-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-lg font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-lg truncate">{seller.name}</h2>
              <p className="text-xs text-muted-foreground font-mono">
                {seller.code} · Joined {seller.joinedDate}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground shrink-0" /> <span className="truncate">{seller.email}</span></p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /> {seller.phone}</p>
            {(seller.address || seller.locationLabel) && (
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-sm">
                  {seller.address && <span className="block">{seller.address}</span>}
                  {seller.locationLabel && <span className="block text-muted-foreground">{seller.locationLabel}</span>}
                </span>
              </p>
            )}
          </div>

          {canEdit && (
            <div className="pt-2 space-y-2">
              <button
                onClick={() => setPendingChannel("email")}
                className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" /> Send Email
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPendingChannel("call")}
                  className="bg-muted py-2 rounded-lg text-sm font-medium hover:bg-muted/80 flex items-center justify-center gap-2"
                >
                  <Phone className="h-4 w-4" /> Call
                </button>
                <button
                  onClick={() => setPendingChannel("whatsapp")}
                  className="bg-emerald-100 text-emerald-700 py-2 rounded-lg text-sm font-medium hover:bg-emerald-200 flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi icon={CarIcon} color="bg-primary/10 text-primary" value={seller.vehiclesListed.length} label="Vehicles Listed" />
          <Kpi icon={CarIcon} color="bg-emerald-50 text-emerald-600" value={seller.vehiclesSold} label="Vehicles Sold" />
          <Kpi icon={TrendingUp} color="bg-amber-50 text-amber-600" value={seller.activeLeads} label="Active Leads" />
          <Kpi icon={Eye} color="bg-violet-50 text-violet-600" value={seller.listingViews} label="Listing Views" />
        </div>
      </div>

      {/* Quick communication composer — only when a channel is pending */}
      {pendingChannel && (
        <div className="stat-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide">Log {pendingChannel}</span>
            <button
              onClick={() => { setPendingChannel(null); setLogMessage(""); }}
              className="text-xs text-muted-foreground hover:underline ml-auto"
            >
              Cancel
            </button>
          </div>
          <textarea
            value={logMessage}
            onChange={(e) => setLogMessage(e.target.value)}
            placeholder={`Summary of this ${pendingChannel} interaction…`}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          />
          <button
            onClick={submitLog}
            disabled={!logMessage.trim() || logCommunication.isPending}
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {logCommunication.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Log
          </button>
        </div>
      )}

      {/* Vehicles uploaded table */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Vehicles Uploaded ({seller.vehiclesListed.length})</h3>
          {canEdit && (
            <button
              onClick={() => setAddVehicleOpen(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Vehicle
            </button>
          )}
        </div>

        {seller.vehiclesListed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No vehicles linked yet. Click "Add Vehicle" to upload one — it will appear in Inventory automatically.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Year</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Inquiries</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {seller.vehiclesListed.map((v) => {
                  const navigable = Boolean(v.vehicleId);
                  return (
                    <tr
                      key={v.key}
                      onClick={() => navigable && openVehicle(v.vehicleId)}
                      className={navigable ? "cursor-pointer" : ""}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center overflow-hidden text-lg">
                            {v.photos[0] ? (
                              <img src={fileUrl(v.photos[0])} alt={v.title} className="w-full h-full object-cover" />
                            ) : (
                              <CarIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="font-medium">{v.title || `${v.year} ${v.company} ${v.model}`}</span>
                        </div>
                      </td>
                      <td>{v.year || "—"}</td>
                      <td className="font-medium">{v.price ? `$${v.price.toLocaleString()}` : "—"}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            navigable
                              ? VEHICLE_STATUS_BADGE_CLASS[v.vehicleStatus as Vehicle["status"]] ?? "bg-gray-100 text-gray-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {v.vehicleStatus}
                        </span>
                      </td>
                      <td>{v.inquiries}</td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          {navigable ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); openVehicle(v.vehicleId); }}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              View <ArrowRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Legacy</span>
                          )}
                          {navigable && canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveVehicle(v.vehicleId, v.title); }}
                              disabled={removeVehicle.isPending}
                              className="ml-2 text-xs text-red-600 hover:underline"
                              title="Unlink from this seller (stays in Inventory)"
                            >
                              Unlink
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Communications log */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> Communications ({seller.communications.length})
        </h3>
        {seller.communications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">
            No communications logged yet. Use Send Email / Call / WhatsApp above to log one.
          </p>
        ) : (
          <div className="space-y-3">
            {seller.communications.map((c, i) => {
              const isEditing = Boolean(c.id) && editingCommId === c.id;
              return (
                <div key={c.id || i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <span className="status-badge bg-primary/10 text-primary h-fit shrink-0">{c.channelLabel}</span>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editCommText}
                          onChange={(e) => setEditCommText(e.target.value)}
                          rows={2}
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEditComm}
                            disabled={!editCommText.trim() || updateCommunication.isPending}
                            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-60 flex items-center gap-1"
                          >
                            {updateCommunication.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Save
                          </button>
                          <button onClick={cancelEditComm} className="px-3 py-1.5 rounded-lg text-xs border">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm whitespace-pre-wrap break-words">{c.message}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-xs text-muted-foreground">{c.date}</p>
                          {canEdit && c.id && (
                            <button
                              onClick={() => startEditComm(c.id, c.message)}
                              className="text-muted-foreground hover:text-primary"
                              title="Edit communication"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && c.id && (
                            <button
                              onClick={() => handleDeleteComm(c.id)}
                              disabled={deleteCommunication.isPending}
                              className="text-muted-foreground hover:text-red-600 disabled:opacity-50"
                              title="Delete communication"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity Timeline + Inspection */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-2 flex flex-col overflow-hidden">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2 shrink-0">
            <Calendar className="h-4 w-4" /> Activity Timeline
          </h3>
          {seller.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No activity logged yet.</p>
          ) : (
            // Fill the card (its height is set by the taller sibling — the
            // Inspection card — via the grid's stretch), then scroll only once
            // the list exceeds that height. On mobile it stacks, so cap it to a
            // sensible height instead. The absolute layer keeps the list out of
            // the card's intrinsic height so the row is sized by the sibling.
            <div className="flex-1 min-h-0 lg:relative">
              <div className="space-y-3 max-h-96 overflow-y-auto overscroll-contain pr-1 lg:max-h-none lg:absolute lg:inset-0">
                {seller.activity.map((a, i) => (
                  <div key={i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{a.type}</p>
                        <p className="text-xs text-muted-foreground">{a.date}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Schedule Inspection</h3>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pipeline stage: <span className="text-foreground font-medium">{SELLER_STAGE_LABELS[seller.stage]}</span>
            </p>

            <label className="text-[11px] text-muted-foreground">Vehicle</label>
            <select
              value={inspectVehicleId}
              onChange={(e) => setInspectVehicleId(e.target.value)}
              className="w-full border rounded-lg px-2 py-2 text-sm bg-background"
            >
              <option value="">Select a car…</option>
              {seller.vehiclesListed
                .filter((v) => v.vehicleId)
                .map((v) => (
                  <option key={v.vehicleId} value={v.vehicleId}>
                    {v.title || `${v.year} ${v.company} ${v.model}`}
                  </option>
                ))}
            </select>
            {seller.vehiclesListed.filter((v) => v.vehicleId).length === 0 && (
              <p className="text-[10px] text-amber-700">Add a vehicle to this seller first.</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={inspectDate}
                  onChange={(e) => setInspectDate(e.target.value)}
                  className="w-full border rounded-lg px-2 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Time</label>
                <input
                  type="time"
                  value={inspectTime}
                  onChange={(e) => setInspectTime(e.target.value)}
                  className="w-full border rounded-lg px-2 py-2 text-sm bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground">Assign to staff *</label>
              <select
                value={inspectAssignee}
                onChange={(e) => setInspectAssignee(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm bg-background"
              >
                <option value="">Select staff…</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.roleName ? ` · ${s.roleName}` : ""}{user?._id === s.id ? " (you)" : ""}
                  </option>
                ))}
              </select>
              {!inspectAssignee && (
                <p className="text-[10px] text-amber-700 mt-0.5">Required — an inspection needs a responsible staff member.</p>
              )}
            </div>

            {/* Meeting type — physical (location) or virtual (paste/create link). */}
            <div className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Meeting type</p>
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={inspectMeetingType === "physical"}
                    onChange={() => { setInspectMeetingType("physical"); setInspectCreateMeet(false); }}
                  />
                  <MapPin className="h-3.5 w-3.5" /> Physical
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={inspectMeetingType === "virtual"}
                    onChange={() => setInspectMeetingType("virtual")}
                  />
                  <Video className="h-3.5 w-3.5" /> Virtual
                </label>
              </div>
              {inspectMeetingType === "physical" ? (
                <input
                  value={inspectLocation}
                  onChange={(e) => setInspectLocation(e.target.value)}
                  placeholder="Address or place *"
                  className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                />
              ) : (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={inspectCreateMeet}
                      onChange={(e) => setInspectCreateMeet(e.target.checked)}
                    />
                    <Video className="h-3.5 w-3.5 text-violet-500" /> Create Google Meet link
                  </label>
                  <input
                    value={inspectMeetLink}
                    onChange={(e) => setInspectMeetLink(e.target.value)}
                    placeholder="Or paste an existing meet/zoom/teams link"
                    className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                    disabled={inspectCreateMeet}
                  />
                  {inspectCreateMeet && (
                    <p className="text-[10px] text-muted-foreground">A Google Meet link is generated when you save.</p>
                  )}
                </div>
              )}
            </div>

            {/* Participants — seller is auto-added; add extra staff here. */}
            <div className="border rounded-lg p-2.5 space-y-2 bg-muted/20">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Participants</p>
              <div className="flex gap-2">
                <select
                  value={participantPick}
                  onChange={(e) => setParticipantPick(e.target.value)}
                  className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-background"
                >
                  <option value="">Add staff…</option>
                  {staffOptions
                    .filter((s) => !inspectParticipants.some((p) => p.userId === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addParticipant}
                  disabled={!participantPick}
                  className="px-2.5 py-1.5 rounded-md bg-muted text-sm font-medium hover:bg-muted/80 disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">{seller.name} (seller) is added automatically.</p>
              {inspectParticipants.length > 0 && (
                <ul className="space-y-1">
                  {inspectParticipants.map((p) => (
                    <li key={p.userId} className="flex items-center justify-between text-sm bg-background border rounded-md px-2 py-1">
                      <span className="truncate">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => removeParticipant(p.userId)}
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
              value={inspectNotes}
              onChange={(e) => setInspectNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full border rounded-lg px-3 py-1.5 text-sm bg-background"
            />
            {canEdit && (
              <button
                onClick={handleScheduleInspection}
                disabled={
                  scheduleInspection.isPending ||
                  createCalendarEvent.isPending ||
                  !inspectVehicleId ||
                  !inspectDate ||
                  !inspectTime ||
                  !inspectAssignee
                }
                className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {(scheduleInspection.isPending || createCalendarEvent.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                Book inspection
              </button>
            )}
            <p className="text-[10px] text-muted-foreground">
              Books a calendar event and moves the seller to the Inspection stage.
            </p>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Seller</DialogTitle>
            <DialogDescription>Update contact details, address, and pipeline stage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Contact</p>
              <div className="grid md:grid-cols-3 gap-3">
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Full name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Address</p>
              <div className="grid md:grid-cols-2 gap-3">
                <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Street address" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
                <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" className="border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} placeholder="State / Province" className="border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={editForm.zipCode} onChange={(e) => setEditForm({ ...editForm, zipCode: e.target.value })} placeholder="Zip / Postal code" className="border rounded-lg px-3 py-2 text-sm bg-background" />
                <input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} placeholder="Country" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Pipeline stage</label>
                <select
                  value={editForm.stage}
                  onChange={(e) => setEditForm({ ...editForm, stage: e.target.value as ServerSellerStage })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  {ALL_STAGES.map((s) => <option key={s} value={s}>{SELLER_STAGE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={saveEdit}
              disabled={updateSeller.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {updateSeller.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle dialog (shared form: VIN decoder, full fields, image picker) */}
      <VehicleFormDialog
        open={addVehicleOpen}
        onOpenChange={setAddVehicleOpen}
        title={`Add Vehicle for ${seller.name}`}
        description="Creates a new vehicle in Inventory and links it to this seller. Photos upload after the vehicle is created."
        submitLabel="Add & link to seller"
        isSaving={addVehicle.isPending}
        onSubmit={handleAddVehicleSubmit}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this seller?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes <span className="font-medium">{seller.name}</span>. Any vehicles they uploaded ({seller.vehiclesListed.length}) remain in your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteSeller.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</span>
              ) : (
                "Delete seller"
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
      <ArrowLeft className="h-4 w-4" /> Back to Sellers
    </button>
  );
}

function Kpi({ icon: Icon, color, value, label }: { icon: typeof CarIcon; color: string; value: number; label: string }) {
  return (
    <div className="stat-card">
      <div className={`p-2 rounded-lg w-fit mb-2 ${color}`}><Icon className="h-4 w-4" /></div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
