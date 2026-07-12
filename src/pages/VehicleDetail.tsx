import { useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, Edit, Trash2, CheckCircle2, ChevronLeft, ChevronRight,
  Eye, MessageSquare, Car, Heart, Calendar, Gauge, Fuel, Settings as SettingsIcon,
  Palette, Hash, Users, History, Activity, Loader2, AlertCircle, Save, X, Upload,
  Receipt, Plus,
} from "lucide-react";
import {
  useDeleteVehicle, useDeleteVehicleImage, useUpdateVehicle, useUploadVehicleImages,
  useVehicle, useVehicleActivityLogs, useVehicleTestDriveCount,
  useAddVehicleSpend, useUpdateVehicleSpend, useDeleteVehicleSpend,
} from "@/hooks/api/use-vehicles";
import { useCreateSale } from "@/hooks/api/use-accounting";
import { useBuyers } from "@/hooks/api/use-buyers";
import { useLeads } from "@/hooks/api/use-leads";
import { useCan } from "@/components/Can";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError, fileUrl } from "@/lib/api";
import {
  ALL_BODY_TYPES, ServerHosting, SPEND_CATEGORIES,
  VEHICLE_STATUS_BADGE_CLASS,
  Vehicle, VehicleSpend, normalizeFuelType, normalizeTransmission, vehicleStatusToServer,
} from "@/lib/vehicle-mapper";
import { ClientPaymentStatus } from "@/lib/accounting-mapper";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";
// "Other" sentinel for the buyer picker — switching to it reveals manual
// name/email fields so the user can record a sale to someone who isn't (yet)
// in the CRM.
const OTHER = "__other__";

const statusClass = VEHICLE_STATUS_BADGE_CLASS;

type TabKey = "overview" | "details" | "spends" | "history" | "activity";

export default function VehicleDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const vehicleQuery = useVehicle(id);
  const updateVehicle = useUpdateVehicle(id);
  const deleteVehicle = useDeleteVehicle();
  const uploadImages = useUploadVehicleImages(id);
  const deleteImage = useDeleteVehicleImage(id);
  const logsQuery = useVehicleActivityLogs(id);
  const testDriveCountQuery = useVehicleTestDriveCount(id);
  const addSpend = useAddVehicleSpend(id);
  const updateSpendMut = useUpdateVehicleSpend(id);
  const deleteSpend = useDeleteVehicleSpend(id);
  const canEditInventory = useCan("Inventory", "edit");
  const canDeleteInventory = useCan("Inventory", "delete");
  const confirm = useConfirm();

  const [tab, setTab] = useState<TabKey>("overview");
  const [spendForm, setSpendForm] = useState({
    amount: "",
    category: "Repair" as string,
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [editingSpend, setEditingSpend] = useState<VehicleSpend | null>(null);
  const [editSpendForm, setEditSpendForm] = useState({
    amount: "",
    category: "Repair" as string,
    description: "",
    date: "",
  });
  const [imageIdx, setImageIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    company: string;
    model: string;
    year: string;
    price: string;
    discount: string;
    km: string;
    owners: string;
    color: string;
    fuel: string;
    transmission: string;
    bodyType: string;
    vin: string;
    description: string;
    status: Vehicle["status"];
    hosting: Vehicle["hosting"];
    costPrice: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sold-flow state — opens when the user transitions status to Sold from
  // either the edit form or the "Mark as Sold" header button. Drives the same
  // unified createSale flow that Accounting + Close-Lead use.
  const createSale = useCreateSale();
  const buyersQuery = useBuyers();
  const leadsQuery = useLeads();
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [soldForm, setSoldForm] = useState({
    buyerName: "",
    buyerEmail: "",
    linkedBuyerId: "",
    linkedLeadId: "",
    soldAt: "",
    saleDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash" as "cash" | "finance" | "bhph" | "trade_in",
    paymentStatus: "Paid" as ClientPaymentStatus,
    amountPaid: "",
    notes: "",
  });

  const vehicle = vehicleQuery.data;

  if (vehicleQuery.isLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackButton onClick={() => navigate("/inventory")} />
        <div className="stat-card text-center py-12 text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicle…
        </div>
      </div>
    );
  }

  if (vehicleQuery.error || !vehicle) {
    return (
      <div className="animate-fade-in space-y-6">
        <BackButton onClick={() => navigate("/inventory")} />
        <div className="stat-card text-center py-12">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-muted-foreground">
            {vehicleQuery.error instanceof Error ? vehicleQuery.error.message : "Vehicle not found."}
          </p>
        </div>
      </div>
    );
  }

  const goBack = () => navigate("/inventory", { state: location.state });

  const finalPrice = vehicle.price - vehicle.discount;
  const tabs: { key: TabKey; label: string; icon: typeof Eye }[] = [
    { key: "overview", label: "Overview", icon: Car },
    { key: "details", label: "Details", icon: SettingsIcon },
    { key: "spends", label: "Spends", icon: Receipt },
    { key: "history", label: "History", icon: History },
    { key: "activity", label: "Activity", icon: Activity },
  ];

  const prevImage = () => setImageIdx((i) => (i - 1 + vehicle.gallery.length) % vehicle.gallery.length);
  const nextImage = () => setImageIdx((i) => (i + 1) % vehicle.gallery.length);

  const startEdit = () => {
    setEditForm({
      title: vehicle.title,
      company: vehicle.company,
      model: vehicle.model,
      year: String(vehicle.year),
      price: String(vehicle.price),
      discount: String(vehicle.discount),
      km: String(vehicle.km),
      owners: String(vehicle.owners),
      color: vehicle.color,
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      bodyType: vehicle.bodyType,
      vin: vehicle.vin,
      description: vehicle.description,
      status: vehicle.status,
      hosting: vehicle.hosting,
      costPrice: String(vehicle.costPrice ?? 0),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm(null);
  };

  const openSoldDialog = () => {
    setSoldForm({
      buyerName: "",
      buyerEmail: "",
      linkedBuyerId: "",
      linkedLeadId: "",
      soldAt: String(vehicle.price ?? ""),
      saleDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "cash",
      paymentStatus: "Paid",
      amountPaid: "",
      notes: "",
    });
    setSoldDialogOpen(true);
  };

  /**
   * Buyer-picker controller. Three cases:
   *   - existing buyer id → fill name/email from CRM, lock linkedBuyerId
   *   - OTHER sentinel    → clear linkedBuyerId, let user type manually
   *   - empty string      → reset both link + manual fields
   */
  const handleSoldBuyerPicked = (value: string) => {
    if (!value) {
      setSoldForm((f) => ({ ...f, linkedBuyerId: "", buyerName: "", buyerEmail: "" }));
      return;
    }
    if (value === OTHER) {
      setSoldForm((f) => ({ ...f, linkedBuyerId: OTHER, buyerName: "", buyerEmail: "" }));
      return;
    }
    const b = (buyersQuery.data?.data ?? []).find((x) => x.id === value);
    if (!b) return;
    setSoldForm((f) => ({
      ...f,
      linkedBuyerId: value,
      buyerName: b.name,
      buyerEmail: b.email,
    }));
  };

  const handleSoldLeadPicked = (leadId: string) => {
    if (!leadId) {
      setSoldForm((f) => ({ ...f, linkedLeadId: "" }));
      return;
    }
    const l = (leadsQuery.data?.data ?? []).find((x) => x.id === leadId);
    if (!l) return;
    setSoldForm((f) => ({
      ...f,
      linkedLeadId: leadId,
      linkedBuyerId: l.buyerId || f.linkedBuyerId,
      buyerName: l.buyerName !== "—" ? l.buyerName : f.buyerName,
      buyerEmail: l.buyerEmail ?? f.buyerEmail,
    }));
  };

  const submitSold = async () => {
    if (!soldForm.buyerName || !soldForm.buyerEmail) {
      toast({ title: "Buyer required", description: "Pick a CRM buyer or fill in name + email.", variant: "destructive" });
      return;
    }
    const soldAtNum = parseFloat(soldForm.soldAt);
    if (!soldAtNum || soldAtNum <= 0) {
      toast({ title: "Sold price required", variant: "destructive" });
      return;
    }
    const amountPaidNum = soldForm.amountPaid !== "" ? parseFloat(soldForm.amountPaid) : undefined;
    if (soldForm.paymentStatus === "Partial") {
      if (amountPaidNum === undefined || amountPaidNum <= 0) {
        toast({ title: "Amount paid required for Partial", variant: "destructive" });
        return;
      }
      if (amountPaidNum > soldAtNum) {
        toast({ title: "Amount paid exceeds sold price", variant: "destructive" });
        return;
      }
    }
    try {
      const realBuyerId = soldForm.linkedBuyerId && soldForm.linkedBuyerId !== OTHER
        ? soldForm.linkedBuyerId : undefined;
      await createSale.mutateAsync({
        vehicleId: vehicle.id,
        vehicleTitle: vehicle.title,
        buyerName: soldForm.buyerName,
        buyerEmail: soldForm.buyerEmail,
        salePrice: soldAtNum,
        costPrice: vehicle.costPrice ?? 0,
        discount: 0,
        amountPaid: amountPaidNum,
        saleDate: soldForm.saleDate,
        paymentMethod: soldForm.paymentMethod,
        paymentStatus: soldForm.paymentStatus,
        notes: soldForm.notes || undefined,
        buyerLeadId: realBuyerId,
        leadId: soldForm.linkedLeadId || undefined,
      });
      toast({
        title: "Vehicle sold",
        description: `Sale recorded · vehicle marked Sold${soldForm.linkedLeadId ? " · lead closed" : ""}.`,
      });
      setSoldDialogOpen(false);
      // Reset edit-form status if user was mid-edit
      if (editForm) setEditForm({ ...editForm, status: "Sold" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not mark as sold";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    if (!editForm) return;

    // If the user is transitioning the vehicle to Sold from the edit form,
    // route through the SoldDialog (buyer + sale fields) instead of a plain
    // status PATCH. The dialog calls the unified createSale flow.
    if (editForm.status === "Sold" && vehicle.status !== "Sold") {
      openSoldDialog();
      return;
    }

    try {
      await updateVehicle.mutateAsync({
        title: editForm.title,
        company: editForm.company,
        model: editForm.model,
        year: parseInt(editForm.year, 10) || vehicle.year,
        price: parseFloat(editForm.price) || 0,
        discount: parseFloat(editForm.discount) || 0,
        costPrice: parseFloat(editForm.costPrice) || 0,
        km: parseInt(editForm.km, 10) || 0,
        owners: parseInt(editForm.owners, 10) || 1,
        color: editForm.color,
        fuelType: normalizeFuelType(editForm.fuel),
        transmission: normalizeTransmission(editForm.transmission),
        bodyType: editForm.bodyType,
        vin: editForm.vin,
        description: editForm.description,
        status: vehicleStatusToServer(editForm.status),
        hosting: editForm.hosting.toLowerCase() as ServerHosting,
      });
      toast({ title: "Vehicle updated", description: editForm.title });
      setEditing(false);
      setEditForm(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not update vehicle";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  };

  const markAsSold = () => {
    if (vehicle.status === "Sold") return;
    openSoldDialog();
  };

  const submitSpend = async () => {
    const amt = parseFloat(spendForm.amount);
    if (!amt || amt <= 0) {
      toast({ title: "Amount required", description: "Enter a spend amount greater than 0.", variant: "destructive" });
      return;
    }
    try {
      await addSpend.mutateAsync({
        amount: amt,
        category: spendForm.category,
        description: spendForm.description || undefined,
        date: spendForm.date || undefined,
      });
      toast({ title: "Spend added", description: `$${amt.toLocaleString()} · ${spendForm.category}` });
      setSpendForm({ amount: "", category: "Repair", description: "", date: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not add spend";
      toast({ title: "Add failed", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteSpend = async (spendId: string) => {
    const ok = await confirm({
      title: "Remove this spend?",
      description: "This can't be undone.",
      confirmText: "Remove",
    });
    if (!ok) return;
    try {
      await deleteSpend.mutateAsync(spendId);
      toast({ title: "Spend removed" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove spend";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const openEditSpend = (sp: VehicleSpend) => {
    setEditSpendForm({
      amount: String(sp.amount),
      category: sp.category || "Repair",
      description: sp.description || "",
      date: sp.date || new Date().toISOString().slice(0, 10),
    });
    setEditingSpend(sp);
  };

  const submitEditSpend = async () => {
    if (!editingSpend) return;
    const amt = parseFloat(editSpendForm.amount);
    if (!amt || amt <= 0) {
      toast({ title: "Amount required", description: "Enter a spend amount greater than 0.", variant: "destructive" });
      return;
    }
    try {
      await updateSpendMut.mutateAsync({
        spendId: editingSpend.id,
        input: {
          amount: amt,
          category: editSpendForm.category,
          description: editSpendForm.description || "",
          date: editSpendForm.date || undefined,
        },
      });
      toast({ title: "Spend updated", description: `$${amt.toLocaleString()} · ${editSpendForm.category}` });
      setEditingSpend(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not update spend";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${vehicle.title}?`,
      description: "This is a soft delete and can be recovered.",
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await deleteVehicle.mutateAsync(vehicle.id);
      toast({ title: "Vehicle deleted", description: vehicle.title });
      goBack();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not delete";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const handleDeletePhoto = async (photoPath: string) => {
    // Don't try to delete the emoji placeholder.
    if (!photoPath.includes("/")) return;
    const ok = await confirm({
      title: "Remove this photo?",
      description: "The file stays on disk; it just won't show in the gallery anymore.",
      confirmText: "Remove",
    });
    if (!ok) return;
    try {
      await deleteImage.mutateAsync(photoPath);
      toast({ title: "Photo removed" });
      // Keep imageIdx in bounds after delete.
      setImageIdx((i) => Math.max(0, i - (vehicle.gallery.length <= 1 ? 0 : 1)));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove photo";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > 10) {
      toast({ title: "Too many files", description: "Up to 10 images at a time.", variant: "destructive" });
      return;
    }
    try {
      await uploadImages.mutateAsync(files);
      toast({ title: "Images uploaded", description: `${files.length} image(s) added.` });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not upload images";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const currentGalleryItem = vehicle.gallery[imageIdx] ?? "🚗";
  const isCurrentImagePath = currentGalleryItem.includes("/");

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <BackButton onClick={goBack} />
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={updateVehicle.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
              >
                {updateVehicle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </>
          ) : (
            <>
              {canEditInventory && (
                <>
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80"
                  >
                    <Edit className="h-4 w-4" /> Edit Vehicle
                  </button>
                  <button
                    onClick={markAsSold}
                    disabled={vehicle.status === "Sold" || updateVehicle.isPending}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateVehicle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {vehicle.status === "Sold" ? "Sold" : "Mark as Sold"}
                  </button>
                </>
              )}
              {canDeleteInventory && (
                <button
                  onClick={handleDelete}
                  disabled={deleteVehicle.isPending}
                  className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
                >
                  {deleteVehicle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Gallery */}
        <div className="lg:col-span-3 stat-card p-0 overflow-hidden">
          <div className="relative aspect-[16/10] bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center overflow-hidden">
            {isCurrentImagePath ? (
              <img src={fileUrl(currentGalleryItem)} alt={vehicle.title} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="text-[160px] leading-none select-none">{currentGalleryItem}</span>
            )}
            {vehicle.gallery.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-card/90 border rounded-full px-2.5 py-1 text-xs font-medium">
                  {imageIdx + 1} / {vehicle.gallery.length}
                </div>
              </>
            )}
            {canEditInventory && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadImages.isPending}
                className="absolute top-3 right-3 flex items-center gap-1.5 bg-card/90 backdrop-blur border rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                title="Upload up to 10 images"
              >
                {uploadImages.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadImages.isPending ? "Uploading…" : "Upload"}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          {vehicle.gallery.length > 1 && (
            <div className="flex gap-2 p-3 border-t overflow-x-auto">
              {vehicle.gallery.map((g, i) => {
                const isPath = g.includes("/");
                return (
                  <div key={i} className="relative group shrink-0">
                    <button
                      onClick={() => setImageIdx(i)}
                      className={`h-16 w-20 rounded-lg border flex items-center justify-center text-3xl overflow-hidden transition-colors ${
                        i === imageIdx ? "border-primary ring-2 ring-primary/20 bg-muted" : "hover:bg-muted"
                      }`}
                    >
                      {isPath ? <img src={fileUrl(g)} alt="" className="w-full h-full object-cover" /> : g}
                    </button>
                    {isPath && canEditInventory && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(g); }}
                        disabled={deleteImage.isPending}
                        title="Remove this photo"
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground h-5 w-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
                      >
                        {deleteImage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "×"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="lg:col-span-2 stat-card space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Hash className="h-3 w-3" /> {vehicle.id.slice(-8)} · VIN {vehicle.vin || "—"}
            </div>
            {editing && editForm ? (
              <input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="text-2xl font-bold tracking-tight font-display mt-1 w-full border rounded-lg px-2 py-1 bg-background"
              />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight font-display mt-1">{vehicle.title}</h1>
            )}
            <div className="flex items-center gap-2 mt-2">
              {editing && editForm ? (
                <>
                  {/* Status is no longer hand-edited here — a vehicle's status is
                      driven by its leads + the unified sale flow ("Mark as Sold").
                      Shown read-only so it stays visible while editing. */}
                  <span className={`status-badge ${statusClass[vehicle.status]}`}>{vehicle.status}</span>
                  <select
                    value={editForm.hosting}
                    onChange={(e) => setEditForm({ ...editForm, hosting: e.target.value as Vehicle["hosting"] })}
                    className="border rounded-lg px-2 py-1 text-xs bg-background"
                  >
                    <option value="Self">Self Hosted</option>
                    <option value="Platform">Platform</option>
                  </select>
                </>
              ) : (
                <>
                  <span className={`status-badge ${statusClass[vehicle.status]}`}>{vehicle.status}</span>
                  <span className="text-xs text-muted-foreground">Hosting: {vehicle.hosting}</span>
                </>
              )}
            </div>
          </div>

          {/* Prices panel — Cost / Selling / (Sold) */}
          <div className="border-t pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Prices</div>
            {editing && editForm ? (
              <div className="space-y-2">
                <PriceField label="Cost Price">
                  <input
                    type="number"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                    placeholder="0"
                    className="border rounded-lg px-3 py-1.5 text-sm bg-background w-32 text-right"
                  />
                </PriceField>
                <PriceField label="Selling Price">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      placeholder="0"
                      className="border rounded-lg px-3 py-1.5 text-sm bg-background w-32 text-right"
                    />
                    <input
                      type="number"
                      value={editForm.discount}
                      onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })}
                      placeholder="Discount $"
                      className="border rounded-lg px-3 py-1.5 text-sm bg-background w-28 text-right"
                    />
                  </div>
                </PriceField>
                {vehicle.status === "Sold" && (
                  <PriceField label="Sold Price">
                    <span className="text-sm text-muted-foreground">
                      ${vehicle.soldAt.toLocaleString()} <span className="text-[10px]">(read-only)</span>
                    </span>
                  </PriceField>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <PriceRow label="Cost Price" value={`$${(vehicle.costPrice ?? 0).toLocaleString()}`} />
                {vehicle.totalSpend > 0 && (
                  <PriceRow label="Spent (recond.)" value={`$${vehicle.totalSpend.toLocaleString()}`} />
                )}
                <PriceRow
                  label="Selling Price"
                  value={
                    <span className="inline-flex items-baseline gap-2">
                      <span className="font-semibold">${finalPrice.toLocaleString()}</span>
                      {vehicle.discount > 0 && (
                        <span className="text-xs text-muted-foreground line-through">${vehicle.price.toLocaleString()}</span>
                      )}
                    </span>
                  }
                />
                {vehicle.status === "Sold" && (
                  <PriceRow
                    label="Sold Price"
                    value={
                      <span className="font-bold text-emerald-700">${(vehicle.soldAt || 0).toLocaleString()}</span>
                    }
                  />
                )}
                {vehicle.status === "Sold" && (vehicle.soldAt ?? 0) > 0 && (
                  <PriceRow
                    label="Gross Margin"
                    value={
                      <span
                        className={
                          (vehicle.soldAt - (vehicle.costPrice ?? 0) - vehicle.totalSpend) >= 0
                            ? "text-emerald-700 font-semibold"
                            : "text-red-600 font-semibold"
                        }
                      >
                        ${(vehicle.soldAt - (vehicle.costPrice ?? 0) - vehicle.totalSpend).toLocaleString()}
                      </span>
                    }
                  />
                )}
              </div>
            )}
          </div>

          {editing && editForm ? (
            <div className="border-t pt-4 grid grid-cols-2 gap-3">
              <EditField icon={Calendar} label="Year">
                <input type="number" value={editForm.year} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Gauge} label="KM Driven">
                <input type="number" value={editForm.km} onChange={(e) => setEditForm({ ...editForm, km: e.target.value })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Users} label="Owners">
                <input type="number" value={editForm.owners} onChange={(e) => setEditForm({ ...editForm, owners: e.target.value })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Fuel} label="Fuel">
                <input value={editForm.fuel} onChange={(e) => setEditForm({ ...editForm, fuel: e.target.value })} placeholder="petrol / electric / hybrid…" className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={SettingsIcon} label="Transmission">
                <input value={editForm.transmission} onChange={(e) => setEditForm({ ...editForm, transmission: e.target.value })} placeholder="automatic / manual / cvt" className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Palette} label="Color">
                <input value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Hash} label="Body Type">
                <select
                  value={editForm.bodyType}
                  onChange={(e) => setEditForm({ ...editForm, bodyType: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm bg-background"
                >
                  <option value="">Select…</option>
                  {ALL_BODY_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </EditField>
              <EditField icon={Hash} label="VIN">
                <input value={editForm.vin} onChange={(e) => setEditForm({ ...editForm, vin: e.target.value })} className="w-full border rounded px-2 py-1 text-sm bg-background font-mono" />
              </EditField>
              <EditField icon={Car} label="Company">
                <input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Car} label="Model">
                <input value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 border-t pt-4">
              <Stat icon={Calendar} label="Year" value={String(vehicle.year)} />
              <Stat icon={Gauge} label="KM Driven" value={vehicle.km.toLocaleString()} />
              <Stat icon={Users} label="Owners" value={String(vehicle.owners)} />
              <Stat icon={Fuel} label="Fuel" value={vehicle.fuel || "—"} />
              <Stat icon={SettingsIcon} label="Transmission" value={vehicle.transmission || "—"} />
              <Stat icon={Palette} label="Color" value={vehicle.color || "—"} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 stat-card space-y-3">
            <h3 className="font-display font-semibold">Description</h3>
            {editing && editForm ? (
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={5}
                className="border rounded-lg px-3 py-2 text-sm bg-background w-full"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {vehicle.description || "No description yet."}
              </p>
            )}
          </div>
          <div className="stat-card space-y-3">
            <h3 className="font-display font-semibold">Engagement</h3>
            <ActivityRow icon={Eye} label="Total Views" value={vehicle.activity.views.toLocaleString()} />
            <ActivityRow icon={MessageSquare} label="Inquiries" value={String(vehicle.activity.inquiries)} />
            <ActivityRow
              icon={Car}
              label="Test Drives"
              value={testDriveCountQuery.isLoading ? "…" : String(testDriveCountQuery.data ?? 0)}
              hint="From Calendar events"
            />
            <ActivityRow icon={Heart} label="Favorites" value="—" hint="Public-site feature (deferred)" />
          </div>
        </div>
      )}

      {tab === "details" && (
        <div className="stat-card grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailRow label="Vehicle ID" value={vehicle.id.slice(-8)} />
          <DetailRow label="VIN" value={vehicle.vin || "—"} />
          <DetailRow label="Company" value={vehicle.company} />
          <DetailRow label="Model" value={vehicle.model} />
          <DetailRow label="Year" value={String(vehicle.year)} />
          <DetailRow label="Body Type" value={vehicle.bodyType || "—"} />
          <DetailRow label="Color" value={vehicle.color || "—"} />
          <DetailRow label="Fuel" value={vehicle.fuel || "—"} />
          <DetailRow label="Transmission" value={vehicle.transmission || "—"} />
          <DetailRow label="KM Driven" value={vehicle.km.toLocaleString()} />
          <DetailRow label="Owners" value={String(vehicle.owners)} />
          <DetailRow label="Hosting" value={vehicle.hosting} />
          <DetailRow label="List Price" value={`$${vehicle.price.toLocaleString()}`} />
          <DetailRow label="Discount" value={vehicle.discount ? `$${vehicle.discount.toLocaleString()}` : "—"} />
          <DetailRow label="Final Price" value={`$${finalPrice.toLocaleString()}`} />
          <DetailRow
            label="Seller"
            value={
              vehicle.sellerId ? (
                <button
                  onClick={() => navigate(`/crm-sellers/${vehicle.sellerId}`)}
                  className="text-primary hover:underline"
                >
                  {vehicle.sellerName}
                </button>
              ) : (
                <span className="text-muted-foreground">Self</span>
              )
            }
          />
        </div>
      )}

      {tab === "spends" && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="stat-card flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-xl">
              <h3 className="font-display font-semibold">Money Spent on this Vehicle</h3>
              <p className="text-sm text-muted-foreground">
                Repairs, service, parts, etc. recorded before the sale. These are added to the
                vehicle's cost basis — once sold, profit = sold price − cost price − total spend.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-display">${vehicle.totalSpend.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Total spend · {vehicle.spends.length} {vehicle.spends.length === 1 ? "entry" : "entries"}
              </div>
            </div>
          </div>

          {/* Add form (hidden when sold) / sold banner */}
          {vehicle.status === "Sold" ? (
            <div className="stat-card border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This vehicle is sold — its spend total is locked into the sale, so new spends can't be added. You can still remove an entry below to correct a mistake (the sale's cost updates automatically).</span>
            </div>
          ) : canEditInventory ? (
            <div className="stat-card space-y-3">
              <h4 className="font-medium text-sm">Add a spend</h4>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">Amount ($) *</label>
                  <input
                    type="number"
                    value={spendForm.amount}
                    onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })}
                    placeholder="500"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Category</label>
                  <select
                    value={spendForm.category}
                    onChange={(e) => setSpendForm({ ...spendForm, category: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    {SPEND_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={spendForm.date}
                    onChange={(e) => setSpendForm({ ...spendForm, date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-[11px] text-muted-foreground">Description</label>
                  <input
                    value={spendForm.description}
                    onChange={(e) => setSpendForm({ ...spendForm, description: e.target.value })}
                    placeholder="e.g. New brake pads + labor"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={submitSpend}
                  disabled={addSpend.isPending}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
                >
                  {addSpend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Spend
                </button>
              </div>
            </div>
          ) : null}

          {/* Spends table */}
          <div className="stat-card">
            {vehicle.spends.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spends recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Category</th>
                      <th className="py-2 pr-4 font-medium">Description</th>
                      <th className="py-2 pr-4 font-medium">Added by</th>
                      <th className="py-2 pr-4 font-medium text-right">Amount</th>
                      {(canEditInventory || canDeleteInventory) && <th className="py-2 font-medium text-right" />}
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.spends.map((sp) => (
                      <tr key={sp.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{sp.date || "—"}</td>
                        <td className="py-2 pr-4"><span className="status-badge bg-muted text-foreground">{sp.category}</span></td>
                        <td className="py-2 pr-4">{sp.description || "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{sp.by || "—"}</td>
                        <td className="py-2 pr-4 text-right font-medium">${sp.amount.toLocaleString()}</td>
                        {(canEditInventory || canDeleteInventory) && (
                          <td className="py-2 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {canEditInventory && (
                                <button
                                  onClick={() => openEditSpend(sp)}
                                  title="Edit spend"
                                  className="text-muted-foreground hover:text-primary hover:bg-muted rounded p-1"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                              {canDeleteInventory && (
                                <button
                                  onClick={() => handleDeleteSpend(sp.id)}
                                  disabled={deleteSpend.isPending}
                                  title="Remove spend"
                                  className="text-destructive hover:bg-destructive/10 rounded p-1 disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td className="py-2 pr-4 font-medium" colSpan={4}>Total</td>
                      <td className="py-2 pr-4 text-right font-bold">${vehicle.totalSpend.toLocaleString()}</td>
                      {(canEditInventory || canDeleteInventory) && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Vehicle History</h3>
          {vehicle.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet. Edits will be tracked here.</p>
          ) : (
            <ol className="relative border-l-2 border-border ml-2 space-y-5">
              {vehicle.history.map((h, i) => (
                <li key={i} className="ml-5">
                  <span className="absolute -left-[7px] h-3 w-3 rounded-full bg-primary border-2 border-card" />
                  <div className="text-xs text-muted-foreground">{h.date}</div>
                  <div className="font-medium text-sm">{h.event}</div>
                  <div className="text-sm text-muted-foreground">{h.detail}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 lg:col-span-1 content-start">
            <KpiCard icon={Eye} label="Views" value={vehicle.activity.views.toLocaleString()} />
            <KpiCard icon={MessageSquare} label="Inquiries" value={String(vehicle.activity.inquiries)} />
            <KpiCard icon={Car} label="Test Drives" value="—" />
            <KpiCard icon={Heart} label="Favorites" value="—" />
          </div>
          <div className="stat-card lg:col-span-2">
            <h3 className="font-display font-semibold mb-4">Recent Activity Log</h3>
            {logsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading logs…
              </div>
            ) : (logsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No communication logs yet for this vehicle.</p>
            ) : (
              <div className="space-y-3">
                {(logsQuery.data ?? []).map((l, i) => (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{l.type}</span>
                        <span className="text-xs text-muted-foreground">{l.date}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{l.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mark as Sold dialog — same flow as Close Lead, just with mandatory
          buyer entry (since no lead provides one) and optional lead link. */}
      <Dialog
        open={soldDialogOpen}
        onOpenChange={(o) => {
          setSoldDialogOpen(o);
          // If user cancels, revert any unsaved status flip in the edit form.
          if (!o && editForm && editForm.status === "Sold" && vehicle.status !== "Sold") {
            setEditForm({ ...editForm, status: vehicle.status });
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Mark as Sold — {vehicle.title}</DialogTitle>
            <DialogDescription>
              Records a Sale, updates the vehicle's sold price + date, and (if you link a buyer/lead) closes the related records.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Link to lead (optional)</label>
              <Select
                value={soldForm.linkedLeadId || NONE}
                onValueChange={(v) => handleSoldLeadPicked(v === NONE ? "" : v)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="No lead link" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>No lead link</SelectItem>
                  {(leadsQuery.data?.data ?? [])
                    .filter((l) => l.vehicleId === vehicle.id && l.status !== "Closed" && l.status !== "Archived")
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.buyerName} ({l.status})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] text-muted-foreground">Buyer *</label>
              <Select
                value={soldForm.linkedBuyerId || ""}
                onValueChange={handleSoldBuyerPicked}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a buyer…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(buyersQuery.data?.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} – {b.email}</SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other — enter manually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {soldForm.linkedBuyerId === OTHER && (
              <>
                <input
                  value={soldForm.buyerName}
                  onChange={(e) => setSoldForm({ ...soldForm, buyerName: e.target.value })}
                  placeholder="Buyer name *"
                  className="border rounded-lg px-3 py-2 text-sm bg-background"
                />
                <input
                  value={soldForm.buyerEmail}
                  onChange={(e) => setSoldForm({ ...soldForm, buyerEmail: e.target.value })}
                  placeholder="Buyer email *"
                  type="email"
                  className="border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </>
            )}
            <div>
              <label className="text-[11px] text-muted-foreground">Sold at ($) *</label>
              <input
                type="number"
                value={soldForm.soldAt}
                onChange={(e) => setSoldForm({ ...soldForm, soldAt: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Sale date</label>
              <input
                type="date"
                value={soldForm.saleDate}
                onChange={(e) => setSoldForm({ ...soldForm, saleDate: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Payment method</label>
              <Select
                value={soldForm.paymentMethod}
                onValueChange={(v) => setSoldForm({ ...soldForm, paymentMethod: v as typeof soldForm.paymentMethod })}
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
                value={soldForm.paymentStatus}
                onValueChange={(v) => {
                  const ps = v as ClientPaymentStatus;
                  const soldAtNum = parseFloat(soldForm.soldAt) || 0;
                  setSoldForm((f) => ({
                    ...f,
                    paymentStatus: ps,
                    amountPaid: ps === "Paid" ? String(soldAtNum) : ps === "Pending" ? "0" : f.amountPaid,
                  }));
                }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] text-muted-foreground">
                Amount paid ($) {soldForm.paymentStatus === "Partial" && "*"}
              </label>
              <input
                type="number"
                value={soldForm.amountPaid}
                onChange={(e) => setSoldForm({ ...soldForm, amountPaid: e.target.value })}
                placeholder={
                  soldForm.paymentStatus === "Paid" ? "Defaults to sold price"
                  : soldForm.paymentStatus === "Pending" ? "Leave blank (or 0)"
                  : "Required for Partial"
                }
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <textarea
              value={soldForm.notes}
              onChange={(e) => setSoldForm({ ...soldForm, notes: e.target.value })}
              placeholder="Notes (optional)"
              rows={2}
              className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setSoldDialogOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={submitSold}
              disabled={createSale.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {createSale.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark sold & record sale
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Spend dialog */}
      <Dialog open={Boolean(editingSpend)} onOpenChange={(o) => !o && setEditingSpend(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Spend</DialogTitle>
            <DialogDescription>
              Update the amount, category, date, or description. If the vehicle is already sold, the sale's cost basis updates automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Amount ($) *</label>
              <input
                type="number"
                value={editSpendForm.amount}
                onChange={(e) => setEditSpendForm({ ...editSpendForm, amount: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Category</label>
              <select
                value={editSpendForm.category}
                onChange={(e) => setEditSpendForm({ ...editSpendForm, category: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                {SPEND_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground">Date</label>
              <input
                type="date"
                value={editSpendForm.date}
                onChange={(e) => setEditSpendForm({ ...editSpendForm, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground">Description</label>
              <input
                value={editSpendForm.description}
                onChange={(e) => setEditSpendForm({ ...editSpendForm, description: e.target.value })}
                placeholder="e.g. New brake pads + labor"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditingSpend(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={submitEditSpend}
              disabled={updateSpendMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {updateSpendMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" /> Back to inventory
    </button>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function PriceField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function EditField({ icon: Icon, label, children }: { icon: typeof Eye; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-border/50 pb-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function ActivityRow({ icon: Icon, label, value, hint }: { icon: typeof Eye; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
        {hint && <span className="text-[10px] text-muted-foreground/70">({hint})</span>}
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="stat-card">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <div className="text-2xl font-bold font-display">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}
