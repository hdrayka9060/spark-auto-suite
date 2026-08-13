import { useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, Edit, Trash2, ChevronLeft, ChevronRight,
  Eye, MessageSquare, Car, Calendar, Gauge, Fuel, Settings as SettingsIcon,
  Palette, Hash, Users, History, Activity, Loader2, AlertCircle, Save, X, Upload,
  Receipt, Plus, GripVertical, CheckCircle2, UserPlus,
} from "lucide-react";
import {
  useDeleteVehicle, useDeleteVehicleImage, useReorderVehicleImages, useUpdateVehicle, useUploadVehicleImages,
  useVehicle, useVehicleActivity, useMarkVehicleSold, useSoldBuyer,
  useAddVehicleSpend, useUpdateVehicleSpend, useDeleteVehicleSpend,
} from "@/hooks/api/use-vehicles";
import { useBuyers } from "@/hooks/api/use-buyers";
import { useAssignLeadBuyer } from "@/hooks/api/use-leads";
import {
  SaleDetailsFields, SaleDetails, seedSaleDetails, validateSaleDetails,
} from "@/components/SaleDetailsFields";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCan } from "@/components/Can";
import { useConfirm } from "@/components/ConfirmDialog";
import { ApiError, fileUrl } from "@/lib/api";
import {
  ALL_BODY_TYPES, ServerHosting, SPEND_CATEGORIES,
  VEHICLE_STATUS_BADGE_CLASS,
  Vehicle, VehicleSpend, normalizeFuelType, normalizeTransmission, vehicleStatusToServer,
} from "@/lib/vehicle-mapper";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const statusClass = VEHICLE_STATUS_BADGE_CLASS;

// Where each Recent-Activity-Log entry came from (buyer / seller / lead / standalone comm).
const SOURCE_LABEL: Record<string, string> = {
  communication: "Comm",
  lead: "Lead",
  buyer: "Buyer",
  seller: "Seller",
};
const SOURCE_BADGE: Record<string, string> = {
  communication: "bg-indigo-100 text-indigo-700",
  lead: "bg-violet-100 text-violet-700",
  buyer: "bg-sky-100 text-sky-700",
  seller: "bg-teal-100 text-teal-700",
};

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
  const reorderImages = useReorderVehicleImages(id);
  const activityQuery = useVehicleActivity(id);
  const addSpend = useAddVehicleSpend(id);
  const updateSpendMut = useUpdateVehicleSpend(id);
  const deleteSpend = useDeleteVehicleSpend(id);
  const markSold = useMarkVehicleSold(id);
  // Buyers for the optional "link a CRM buyer" picker in the Mark/Assign dialogs.
  const buyersQuery = useBuyers();
  // Who bought this vehicle (from its closed lead) — only when sold.
  const soldBuyerQuery = useSoldBuyer(id, vehicleQuery.data?.status === "Sold");
  const assignBuyer = useAssignLeadBuyer(soldBuyerQuery.data?.leadId ?? "");
  const canEditInventory = useCan("Inventory", "edit");
  const canDeleteInventory = useCan("Inventory", "delete");
  // Financial figures (cost price, reconditioning spends, sold price, gross
  // margin) are gated behind Accounting:view — staff with only Inventory access
  // manage the car but never see its money.
  const canViewFinancials = useCan("Accounting", "view");
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
  // Index of the thumbnail currently being dragged (for photo reordering).
  const [dragIdx, setDragIdx] = useState<number | null>(null);
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

  // Mark-as-Sold dialog state. `saleBuyer.linkedBuyerId` (a CRM buyer id) is
  // optional — when set, the sale is pushed onto that buyer's purchases[].
  const [showMarkSold, setShowMarkSold] = useState(false);
  const [saleDetails, setSaleDetails] = useState<SaleDetails>(() => seedSaleDetails());
  const [saleBuyer, setSaleBuyer] = useState({ buyerName: "", buyerEmail: "", buyerPhone: "", linkedBuyerId: "" });
  // Assign-buyer-to-a-sold-walk-in dialog state.
  const [showAssignBuyer, setShowAssignBuyer] = useState(false);
  const [assignForm, setAssignForm] = useState({ linkedBuyerId: "", newBuyerName: "", newBuyerEmail: "", newBuyerPhone: "" });

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
    // Spends are financial data — only surfaced to Accounting:view holders.
    ...(canViewFinancials ? [{ key: "spends" as TabKey, label: "Spends", icon: Receipt }] : []),
    { key: "history", label: "History", icon: History },
    { key: "activity", label: "Activity", icon: Activity },
  ];

  const prevImage = () => setImageIdx((i) => (i - 1 + vehicle.gallery.length) % vehicle.gallery.length);
  const nextImage = () => setImageIdx((i) => (i + 1) % vehicle.gallery.length);

  // ── Mark as Sold ──────────────────────────────────────────────────────────
  const BUYER_NONE = "__none__"; // Radix Select can't use an empty-string value.
  const openMarkSold = () => {
    // Default the sold price to the vehicle's asking price (after discount).
    setSaleDetails(seedSaleDetails(finalPrice > 0 ? finalPrice : vehicle.price));
    setSaleBuyer({ buyerName: "", buyerEmail: "", buyerPhone: "", linkedBuyerId: "" });
    setShowMarkSold(true);
  };
  const handleSaleBuyerPicked = (value: string) => {
    if (value === BUYER_NONE) {
      setSaleBuyer({ buyerName: "", buyerEmail: "", buyerPhone: "", linkedBuyerId: "" });
      return;
    }
    const b = (buyersQuery.data?.data ?? []).find((x) => x.id === value);
    if (!b) return;
    setSaleBuyer({
      buyerName: b.name !== "—" ? b.name : "",
      buyerEmail: b.email ?? "",
      buyerPhone: b.phone ?? "",
      linkedBuyerId: value,
    });
  };
  // A new CRM buyer is created only when an email is typed for someone not
  // already linked from the picker. Buyer is otherwise fully optional.
  const creatingNewBuyer = !saleBuyer.linkedBuyerId && !!saleBuyer.buyerEmail.trim();
  const submitMarkSold = async () => {
    // Phone is required only to add a NEW buyer to CRM.
    if (creatingNewBuyer && !saleBuyer.buyerPhone.trim()) {
      toast({ title: "Buyer phone required", description: "Enter a phone to add this buyer to CRM, or clear the email to record a walk-in sale.", variant: "destructive" });
      return;
    }
    const err = validateSaleDetails(saleDetails);
    if (err) { toast({ title: "Check the sale details", description: err, variant: "destructive" }); return; }
    try {
      await markSold.mutateAsync({
        buyerName: saleBuyer.buyerName.trim() || undefined,
        buyerEmail: saleBuyer.buyerEmail.trim() || undefined,
        buyerPhone: saleBuyer.buyerPhone.trim() || undefined,
        salePrice: saleDetails.soldAt,
        amountPaid: saleDetails.amountPaid,
        saleDate: saleDetails.saleDate,
        paymentMethod: saleDetails.paymentMethod,
        paymentStatus: saleDetails.paymentStatus,
        buyerLeadId: saleBuyer.linkedBuyerId || undefined,
      });
      toast({ title: "Vehicle marked as sold", description: vehicle.title });
      setShowMarkSold(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to mark as sold";
      toast({ title: "Couldn't mark as sold", description: msg, variant: "destructive" });
    }
  };

  // ── Assign a buyer to a sold walk-in ────────────────────────────────────────
  const openAssignBuyer = () => {
    setAssignForm({ linkedBuyerId: "", newBuyerName: "", newBuyerEmail: "", newBuyerPhone: "" });
    setShowAssignBuyer(true);
  };
  const submitAssignBuyer = async () => {
    const usingExisting = !!assignForm.linkedBuyerId;
    if (!usingExisting && (!assignForm.newBuyerName.trim() || !assignForm.newBuyerEmail.trim() || !assignForm.newBuyerPhone.trim())) {
      toast({ title: "Buyer details required", description: "Pick a buyer, or enter name, email and phone for a new one.", variant: "destructive" });
      return;
    }
    try {
      await assignBuyer.mutateAsync(
        usingExisting
          ? { buyerLeadId: assignForm.linkedBuyerId }
          : {
              newBuyerName: assignForm.newBuyerName.trim(),
              newBuyerEmail: assignForm.newBuyerEmail.trim(),
              newBuyerPhone: assignForm.newBuyerPhone.trim(),
            },
      );
      toast({ title: "Buyer assigned" });
      setShowAssignBuyer(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to assign buyer";
      toast({ title: "Couldn't assign buyer", description: msg, variant: "destructive" });
    }
  };

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

  const saveEdit = async () => {
    if (!editForm) return;

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

  // Drag-to-reorder the gallery. `from`/`to` are indices into vehicle.gallery
  // (which, when >1 photo, is exactly the server photos[] in order). The new
  // order is persisted; photos[0] is the cover shown on the storefront/cards.
  const handleReorder = async (from: number, to: number) => {
    if (from === to || from == null || to == null) return;
    const next = [...vehicle.gallery];
    if (from < 0 || to < 0 || from >= next.length || to >= next.length) return;
    // Only reorder when every item is a real photo path (never the emoji fallback).
    if (!next.every((g) => g.includes("/"))) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setImageIdx(to); // keep the large preview on the image the user just moved
    try {
      await reorderImages.mutateAsync(next);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save the new image order";
      toast({ title: "Reorder failed", description: msg, variant: "destructive" });
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
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80"
                >
                  <Edit className="h-4 w-4" /> Edit Vehicle
                </button>
              )}
              {canEditInventory && vehicle.status !== "Sold" && (
                <button
                  onClick={openMarkSold}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark as Sold
                </button>
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

      {/* Mark-as-Sold dialog — funnels into the unified sale flow (ledger + vehicle→sold + sibling-lead archive + buyer.purchases). */}
      <Dialog open={showMarkSold} onOpenChange={setShowMarkSold}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Sold</DialogTitle>
            <DialogDescription>
              Records the sale of {vehicle.title}. This creates a sales-ledger entry in Accounting,
              flips the vehicle to Sold, and archives any other open leads for this vehicle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Link CRM buyer (optional)</label>
              <Select value={saleBuyer.linkedBuyerId || BUYER_NONE} onValueChange={handleSaleBuyerPicked}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="New buyer (enter below)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BUYER_NONE}>New buyer (enter below)</SelectItem>
                  {(buyersQuery.data?.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}{b.email ? ` · ${b.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!saleBuyer.linkedBuyerId && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Buyer is optional. Enter an email to add a new buyer to CRM (rejected if the email already
                  exists) — or leave blank to record a walk-in sale.
                </p>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Buyer name</label>
                <input
                  value={saleBuyer.buyerName}
                  onChange={(e) => setSaleBuyer((s) => ({ ...s, buyerName: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Buyer email</label>
                <input
                  type="email"
                  value={saleBuyer.buyerEmail}
                  onChange={(e) => setSaleBuyer((s) => ({ ...s, buyerEmail: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">
                  Buyer phone {creatingNewBuyer && "*"}
                </label>
                <input
                  value={saleBuyer.buyerPhone}
                  inputMode="tel"
                  // Allow only digits, +, spaces and hyphens.
                  onChange={(e) => setSaleBuyer((s) => ({ ...s, buyerPhone: e.target.value.replace(/[^\d+\- ]/g, "") }))}
                  placeholder={creatingNewBuyer ? "Required to add buyer to CRM" : "e.g. +1 555-123-4567"}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                />
              </div>
            </div>
            <SaleDetailsFields value={saleDetails} onChange={setSaleDetails} />
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowMarkSold(false)}
              className="px-4 py-2 rounded-lg text-sm bg-muted text-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
            <button
              onClick={submitMarkSold}
              disabled={markSold.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:opacity-90 disabled:opacity-60"
            >
              {markSold.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirm Sale
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign-buyer dialog (for a sold walk-in vehicle) */}
      <Dialog open={showAssignBuyer} onOpenChange={setShowAssignBuyer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign buyer</DialogTitle>
            <DialogDescription>
              Link a buyer to this walk-in sale of {vehicle.title}. Updates the sales ledger and the buyer's purchase history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground">Existing CRM buyer</label>
              <Select
                value={assignForm.linkedBuyerId || BUYER_NONE}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, linkedBuyerId: v === BUYER_NONE ? "" : v }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="New buyer (enter below)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={BUYER_NONE}>New buyer (enter below)</SelectItem>
                  {(buyersQuery.data?.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}{b.email ? ` · ${b.email}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!assignForm.linkedBuyerId && (
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">Buyer name *</label>
                  <input
                    value={assignForm.newBuyerName}
                    onChange={(e) => setAssignForm((f) => ({ ...f, newBuyerName: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">Buyer email *</label>
                  <input
                    type="email"
                    value={assignForm.newBuyerEmail}
                    onChange={(e) => setAssignForm((f) => ({ ...f, newBuyerEmail: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-muted-foreground">Buyer phone *</label>
                  <input
                    value={assignForm.newBuyerPhone}
                    inputMode="tel"
                    onChange={(e) => setAssignForm((f) => ({ ...f, newBuyerPhone: e.target.value.replace(/[^\d+\- ]/g, "") }))}
                    placeholder="e.g. +1 555-123-4567"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowAssignBuyer(false)}
              className="px-4 py-2 rounded-lg text-sm bg-muted text-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
            <button
              onClick={submitAssignBuyer}
              disabled={assignBuyer.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {assignBuyer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Assign
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {/* Delete the CURRENT photo — works even when the car has a single
                image (the thumbnail strip, and its delete "×", only render for
                2+ photos, so this is the only way to remove the last one). */}
            {canEditInventory && isCurrentImagePath && (
              <button
                onClick={() => handleDeletePhoto(currentGalleryItem)}
                disabled={deleteImage.isPending}
                className="absolute top-3 left-3 flex items-center gap-1.5 bg-card/90 backdrop-blur border rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                title="Remove this photo"
              >
                {deleteImage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete photo
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
            <div className="border-t">
              {canEditInventory && (
                <p className="px-3 pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <GripVertical className="h-3 w-3" />
                  Drag to reorder — the first image is the cover shown on the storefront.
                </p>
              )}
              <div className="flex gap-2 p-3 overflow-x-auto">
                {vehicle.gallery.map((g, i) => {
                  const isPath = g.includes("/");
                  const draggable = isPath && canEditInventory;
                  return (
                    <div
                      key={i}
                      draggable={draggable}
                      onDragStart={draggable ? () => setDragIdx(i) : undefined}
                      onDragOver={(e) => { if (dragIdx !== null) e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) handleReorder(dragIdx, i); setDragIdx(null); }}
                      onDragEnd={() => setDragIdx(null)}
                      className={`relative group shrink-0 rounded-lg transition-opacity ${draggable ? "cursor-move" : ""} ${
                        dragIdx === i ? "opacity-40" : ""
                      } ${dragIdx !== null && dragIdx !== i ? "ring-1 ring-dashed ring-primary/40" : ""}`}
                    >
                      <button
                        onClick={() => setImageIdx(i)}
                        className={`h-16 w-20 rounded-lg border flex items-center justify-center text-3xl overflow-hidden transition-colors ${
                          i === imageIdx ? "border-primary ring-2 ring-primary/20 bg-muted" : "hover:bg-muted"
                        }`}
                      >
                        {isPath ? <img src={fileUrl(g)} alt="" className="w-full h-full object-cover pointer-events-none" /> : g}
                      </button>
                      {i === 0 && isPath && (
                        <span className="absolute bottom-1 left-1 bg-card/90 border rounded px-1 text-[9px] font-medium leading-tight pointer-events-none">
                          Cover
                        </span>
                      )}
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
                  {/* Status is not hand-edited here — it's driven by leads + the
                      unified sale flow (Accounting / Close Lead). Read-only while
                      editing so it stays visible. */}
                  {vehicle.status !== "Available" && (
                    <span className={`status-badge ${statusClass[vehicle.status]}`}>{vehicle.status}</span>
                  )}
                  {/* Hosting is fixed at creation (it drives the seller link) —
                      read-only while editing, like status. */}
                  <span className="text-xs text-muted-foreground">Hosting: {vehicle.hosting}</span>
                </>
              ) : (
                <>
                  {vehicle.status !== "Available" && (
                    <span className={`status-badge ${statusClass[vehicle.status]}`}>{vehicle.status}</span>
                  )}
                  <span className="text-xs text-muted-foreground">Hosting: {vehicle.hosting}</span>
                </>
              )}
            </div>

            {/* Sold-to buyer line (from the vehicle's closed lead). "Walk-in"
                when no buyer; assignable later for walk-ins. */}
            {vehicle.status === "Sold" && (
              <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted-foreground">Buyer:</span>
                <span className="font-medium">{soldBuyerQuery.data?.buyerName ?? "—"}</span>
                {soldBuyerQuery.data?.buyerEmail && (
                  <span className="text-xs text-muted-foreground">· {soldBuyerQuery.data.buyerEmail}</span>
                )}
                {canEditInventory && soldBuyerQuery.data?.isWalkIn && soldBuyerQuery.data?.leadId && (
                  <button
                    onClick={openAssignBuyer}
                    className="flex items-center gap-1 text-xs border rounded-lg px-2 py-1 hover:bg-muted"
                  >
                    <UserPlus className="h-3 w-3" /> Assign buyer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Prices panel — Cost / Selling / (Sold) */}
          <div className="border-t pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Prices</div>
            {editing && editForm ? (
              <div className="space-y-2">
                {canViewFinancials && (
                  <PriceField label="Cost Price">
                    <input
                      type="number"
                      min={0}
                      value={editForm.costPrice}
                      onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value.replace(/-/g, "") })}
                      placeholder="0"
                      className="border rounded-lg px-3 py-1.5 text-sm bg-background w-32 text-right"
                    />
                  </PriceField>
                )}
                <PriceField label="Selling Price">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value.replace(/-/g, "") })}
                      placeholder="0"
                      className="border rounded-lg px-3 py-1.5 text-sm bg-background w-32 text-right"
                    />
                    <input
                      type="number"
                      min={0}
                      value={editForm.discount}
                      onChange={(e) => setEditForm({ ...editForm, discount: e.target.value.replace(/-/g, "") })}
                      placeholder="Discount $"
                      className="border rounded-lg px-3 py-1.5 text-sm bg-background w-28 text-right"
                    />
                  </div>
                </PriceField>
                {canViewFinancials && vehicle.status === "Sold" && (
                  <PriceField label="Sold Price">
                    <span className="text-sm text-muted-foreground">
                      ${vehicle.soldAt.toLocaleString()} <span className="text-[10px]">(read-only)</span>
                    </span>
                  </PriceField>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {canViewFinancials && (
                  <PriceRow label="Cost Price" value={`$${(vehicle.costPrice ?? 0).toLocaleString()}`} />
                )}
                {canViewFinancials && vehicle.totalSpend > 0 && (
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
                {canViewFinancials && vehicle.status === "Sold" && (
                  <PriceRow
                    label="Sold Price"
                    value={
                      <span className="font-bold text-emerald-700">${(vehicle.soldAt || 0).toLocaleString()}</span>
                    }
                  />
                )}
                {canViewFinancials && vehicle.status === "Sold" && (vehicle.soldAt ?? 0) > 0 && (
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
                <input type="number" min={1900} max={2100} value={editForm.year} onChange={(e) => setEditForm({ ...editForm, year: e.target.value.replace(/-/g, "") })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Gauge} label="KM Driven">
                <input type="number" min={0} value={editForm.km} onChange={(e) => setEditForm({ ...editForm, km: e.target.value.replace(/-/g, "") })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
              </EditField>
              <EditField icon={Users} label="Owners">
                <input type="number" min={1} value={editForm.owners} onChange={(e) => setEditForm({ ...editForm, owners: e.target.value.replace(/-/g, "") })} className="w-full border rounded px-2 py-1 text-sm bg-background" />
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
            <ActivityRow
              icon={Eye}
              label="Total Views"
              value={activityQuery.isLoading ? "…" : (activityQuery.data?.views ?? 0).toLocaleString()}
              hint="Storefront opens (lifetime)"
            />
            <ActivityRow
              icon={MessageSquare}
              label="Inquiries"
              value={activityQuery.isLoading ? "…" : String(activityQuery.data?.inquiries ?? 0)}
              hint="Storefront leads (lifetime)"
            />
            <ActivityRow
              icon={Car}
              label="Test Drives"
              value={activityQuery.isLoading ? "…" : String(activityQuery.data?.testDrives ?? 0)}
              hint="Booked (lifetime)"
            />
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
          <DetailRow label="Interior Color" value={vehicle.interiorColor || "—"} />
          <DetailRow label="Fuel" value={vehicle.fuel || "—"} />
          <DetailRow label="Transmission" value={vehicle.transmission || "—"} />
          <DetailRow label="Drivetrain" value={vehicle.drivetrain || "—"} />
          <DetailRow label="Engine" value={vehicle.engine || "—"} />
          <DetailRow label="Engine Size" value={vehicle.engineSize || "—"} />
          <DetailRow label="Doors" value={vehicle.doors ? String(vehicle.doors) : "—"} />
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

      {tab === "spends" && canViewFinancials && (
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

          {/* Add form — available even after the vehicle is sold. */}
          {canEditInventory ? (
            <div className="stat-card space-y-3">
              <h4 className="font-medium text-sm">Add a spend</h4>
              {vehicle.status === "Sold" && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  This vehicle is sold — new spends still post to the expense ledger and the sale's cost basis updates automatically.
                </p>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">Amount ($) *</label>
                  <input
                    type="number"
                    min={0}
                    value={spendForm.amount}
                    onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value.replace(/-/g, "") })}
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
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-4 lg:col-span-1 content-start">
            <KpiCard icon={Eye} label="Views" value={activityQuery.isLoading ? "…" : (activityQuery.data?.views ?? 0).toLocaleString()} />
            <KpiCard icon={MessageSquare} label="Inquiries" value={activityQuery.isLoading ? "…" : String(activityQuery.data?.inquiries ?? 0)} />
            <KpiCard icon={Car} label="Test Drives" value={activityQuery.isLoading ? "…" : String(activityQuery.data?.testDrives ?? 0)} />
          </div>
          <div className="stat-card lg:col-span-2">
            <h3 className="font-display font-semibold mb-4">Recent Activity Log</h3>
            {activityQuery.isLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading logs…
              </div>
            ) : (activityQuery.data?.logs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No communication logged for this vehicle yet.</p>
            ) : (
              <div className="space-y-3">
                {(activityQuery.data?.logs ?? []).map((l, i) => (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium capitalize">{l.channel}</span>
                          <span className={`status-badge text-[10px] ${SOURCE_BADGE[l.source] ?? "bg-slate-100 text-slate-600"}`}>
                            {SOURCE_LABEL[l.source] ?? l.source}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{l.date.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{l.summary}{l.by ? ` · ${l.by}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                min={0}
                value={editSpendForm.amount}
                onChange={(e) => setEditSpendForm({ ...editSpendForm, amount: e.target.value.replace(/-/g, "") })}
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
