import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, ChevronRight, LayoutGrid, List, MapPin, Car, Sparkles, Mail, Phone,
  Plus, X, Loader2, AlertCircle, Edit, Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useCreateSeller, useDeleteSeller, useSellers, uploadVehicleImages,
} from "@/hooks/api/use-sellers";
import { ApiError } from "@/lib/api";
import {
  ClientSellerStatus, Seller, SellerVehicleFormInput,
} from "@/lib/seller-mapper";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VehicleFormDialog } from "@/components/VehicleFormDialog";
import { useCan } from "@/components/Can";

const stages: (ClientSellerStatus | "All")[] = ["All", "VIP", "Active", "Inactive"];

const statusColors: Record<ClientSellerStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-600",
  VIP: "bg-amber-100 text-amber-700",
};

/**
 * One vehicle drafted on the seller-create form. We hold the input + any
 * staged image files locally; after the seller create succeeds, images are
 * uploaded against the matching newly-created Vehicle id (matched by order).
 */
interface VehicleDraft {
  key: number;
  input: SellerVehicleFormInput;
  images: File[];
}

const seedSellerForm = () => ({
  name: "", email: "", phone: "",
  address: "", city: "", state: "", zipCode: "", country: "",
  notes: "",
});

export default function CRMSellers() {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { search?: string; statusFilter?: ClientSellerStatus | "All"; view?: "grid" | "list" } | null) ?? null;
  const [statusFilter, setStatusFilter] = useState<ClientSellerStatus | "All">(saved?.statusFilter ?? "All");
  const [search, setSearch] = useState(saved?.search ?? "");
  const [view, setView] = useState<"grid" | "list">(saved?.view ?? "grid");
  const [showAdd, setShowAdd] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Seller | null>(null);

  const sellersQuery = useSellers({ search, status: statusFilter });
  const createSeller = useCreateSeller();
  const deleteSeller = useDeleteSeller();

  const canEdit = useCan("CRM – Sellers", "edit");
  const canDelete = useCan("CRM – Sellers", "delete");

  const [form, setForm] = useState(seedSellerForm());
  const [vehicleDrafts, setVehicleDrafts] = useState<VehicleDraft[]>([]);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const draftKey = useRef(0);
  const resetForm = () => { setForm(seedSellerForm()); setVehicleDrafts([]); draftKey.current = 0; };

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter, view } }, "");
  }, [search, statusFilter, view]);

  const sellers = sellersQuery.data?.data ?? [];
  const counts = useMemo(() => {
    const c = { Active: 0, VIP: 0, Inactive: 0 };
    for (const s of sellers) c[s.status]++;
    return c;
  }, [sellers]);

  const open = (id: string) => navigate(`/crm-sellers/${id}`, { state: { search, statusFilter, view } });

  const addVehicleDraft = (input: SellerVehicleFormInput, images: File[]) => {
    draftKey.current += 1;
    setVehicleDrafts((d) => [...d, { key: draftKey.current, input, images }]);
    setVehicleDialogOpen(false);
  };
  const removeVehicleDraft = (key: number) =>
    setVehicleDrafts((d) => d.filter((row) => row.key !== key));

  const handleSave = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast({
        title: "Missing info",
        description: "Name, email, and phone are required.",
        variant: "destructive",
      });
      return;
    }

    const vehicles = vehicleDrafts.map((d) => d.input);

    try {
      const seller = await createSeller.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
        country: form.country || undefined,
        notes: form.notes || undefined,
        vehicles: vehicles.length ? vehicles : undefined,
      });

      // Upload images for each draft. Backend creates vehicles in the same
      // order we sent them, so the populated vehiclesListed[] aligns by index.
      const failedUploads: string[] = [];
      for (let i = 0; i < vehicleDrafts.length; i++) {
        const draft = vehicleDrafts[i];
        const target = seller.vehiclesListed[i];
        if (!draft.images.length || !target?.vehicleId) continue;
        try {
          await uploadVehicleImages(target.vehicleId, draft.images);
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : "upload failed";
          failedUploads.push(`${draft.input.title}: ${msg}`);
        }
      }

      if (failedUploads.length) {
        toast({
          title: "Seller created, some photo uploads failed",
          description: failedUploads.slice(0, 2).join(" · "),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Seller added",
          description: vehicles.length
            ? `${form.name} created with ${vehicles.length} vehicle(s) in Inventory.`
            : form.name,
        });
      }
      resetForm();
      setShowAdd(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not add seller";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteSeller.mutateAsync(pendingDelete.id);
      toast({
        title: "Seller deleted",
        description: pendingDelete.vehiclesListed.length
          ? `${pendingDelete.name} removed. ${pendingDelete.vehiclesListed.length} vehicle(s) remain in Inventory.`
          : pendingDelete.name,
      });
      setPendingDelete(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">CRM – Sellers</h1>
          <p className="text-muted-foreground text-sm">People wanting to sell vehicles to your dealership</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? "Cancel" : "New Seller"}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <div>
            <h3 className="font-display font-semibold">New Seller</h3>
            <p className="text-xs text-muted-foreground">
              Capture the seller and any vehicles they're offering. Vehicles created here are added to Inventory automatically.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Contact</p>
            <div className="grid md:grid-cols-3 gap-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Address</p>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2" />
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State / Province" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} placeholder="Zip / Postal code" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehicles Offered</p>
              <button
                onClick={() => setVehicleDialogOpen(true)}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Vehicle
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Each vehicle is created in Inventory and linked to this seller when you save. Uses the same form (VIN decoder, images, full specs) as Inventory.
            </p>
            {vehicleDrafts.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground">
                No vehicles yet. Click "Add Vehicle" to add one — or save the seller without any.
              </div>
            ) : (
              <ul className="space-y-2">
                {vehicleDrafts.map((d, i) => (
                  <li key={d.key} className="flex items-center justify-between border rounded-lg px-3 py-2 bg-background/40">
                    <div className="text-sm min-w-0">
                      <p className="font-medium truncate">
                        {i + 1}. {d.input.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.input.year} · {d.input.company} {d.input.model} · ${d.input.price.toLocaleString()}
                        {d.images.length ? ` · ${d.images.length} photo${d.images.length === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removeVehicleDraft(d.key)}
                      className="text-xs text-red-600 hover:underline shrink-0 ml-3"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); resetForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleSave}
              disabled={createSeller.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {createSeller.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Seller
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {stages.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
            }`}
          >
            {s}
            {s !== "All" && <span className="ml-1 opacity-70">({counts[s as ClientSellerStatus] ?? 0})</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sellers..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <div className="ml-auto flex items-center gap-1 bg-card border rounded-lg p-1">
          <button onClick={() => setView("grid")} className={`p-1.5 rounded ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={`p-1.5 rounded ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {sellersQuery.isLoading && (
        <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sellers…
        </div>
      )}

      {sellersQuery.error && (
        <div className="stat-card text-center py-12 text-red-600 flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {sellersQuery.error instanceof Error ? sellersQuery.error.message : "Could not load sellers"}
        </div>
      )}

      {!sellersQuery.isLoading && !sellersQuery.error && view === "grid" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {sellers.map((s) => {
            const initials = s.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            const locationLine = s.locationLabel || s.address || `Joined ${s.joinedDate}`;
            return (
              <div
                key={s.id}
                className="group bg-card border rounded-xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div onClick={() => open(s.id)} className="cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center font-semibold">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display font-semibold truncate group-hover:text-primary transition-colors">{s.name}</h3>
                        <span className={`status-badge ${statusColors[s.status]}`}>
                          {s.status === "VIP" && <Sparkles className="h-3 w-3 mr-0.5" />}
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.code}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{locationLine}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate">{s.email}</span></div>
                    <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{s.phone}</div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-lg font-bold font-display flex items-center gap-1"><Car className="h-4 w-4 text-primary" />{s.vehiclesListed.length}</p>
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Listed</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold font-display text-emerald-700">{s.vehiclesSold}</p>
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Sold</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold font-display">{s.activeLeads}</p>
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Active</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold font-display">{s.listingViews}</p>
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Views</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <button
                    onClick={() => open(s.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-muted py-1.5 rounded-lg text-xs font-medium hover:bg-muted/80"
                  >
                    <Edit className="h-3.5 w-3.5" /> Open / Edit
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setPendingDelete(s)}
                      className="flex items-center justify-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100"
                      title="Delete seller"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!sellersQuery.isLoading && !sellersQuery.error && view === "list" && (
        <div className="stat-card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Vehicles</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.id} className="cursor-pointer">
                  <td onClick={() => open(s.id)}>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                  </td>
                  <td onClick={() => open(s.id)} className="text-sm">
                    <p>{s.email}</p>
                    <p className="text-xs text-muted-foreground">{s.phone}</p>
                  </td>
                  <td onClick={() => open(s.id)} className="text-sm">
                    {s.locationLabel || s.address ? (
                      <>
                        {s.address && <p>{s.address}</p>}
                        <p className="text-xs text-muted-foreground">{s.locationLabel}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td onClick={() => open(s.id)} className="text-sm">
                    {s.vehiclesListed.length} listed
                    {s.vehiclesSold > 0 && (
                      <span className="text-emerald-700 ml-2">· {s.vehiclesSold} sold</span>
                    )}
                  </td>
                  <td onClick={() => open(s.id)}>
                    <span className={`status-badge ${statusColors[s.status]}`}>{s.status}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => open(s.id)} className="text-muted-foreground hover:text-primary">
                        <Edit className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button onClick={() => setPendingDelete(s)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!sellersQuery.isLoading && !sellersQuery.error && sellers.length === 0 && (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm">
          No sellers match your filters. Click "New Seller" to add one.
        </div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this seller?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  This soft-deletes <span className="font-medium">{pendingDelete.name}</span>.
                  {pendingDelete.vehiclesListed.length
                    ? ` Their ${pendingDelete.vehiclesListed.length} linked vehicle(s) remain in your inventory.`
                    : " No linked vehicles to retain."}
                </>
              )}
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

      {/* Shared "Add Vehicle" dialog for the new-seller form (drafts only — actual
          creation happens when the seller is saved). */}
      <VehicleFormDialog
        open={vehicleDialogOpen}
        onOpenChange={setVehicleDialogOpen}
        title="Add Vehicle to this seller"
        description="Drafted locally; will be created in Inventory and linked when you save the seller."
        submitLabel="Add to seller"
        onSubmit={(input, images) => addVehicleDraft(input, images)}
      />
    </div>
  );
}
