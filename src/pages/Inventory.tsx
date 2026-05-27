import { useRef, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Upload, Search, Filter, Eye, Edit, Trash2, Image, LayoutGrid, List,
  Gauge, Calendar, Users as UsersIcon, Heart, ScanLine, Loader2, CheckCircle2,
  AlertCircle, Sparkles,
} from "lucide-react";
import { useBulkUploadVehicles, useCreateVehicle, useDeleteVehicle, useVehicles } from "@/hooks/api/use-vehicles";
import { api, ApiError, fileUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ALL_BODY_TYPES, ALL_VEHICLE_STATUSES, VEHICLE_STATUS_BADGE_CLASS, normalizeBodyType,
  type ServerVehicle, type Vehicle,
} from "@/lib/vehicle-mapper";
import { toast } from "@/hooks/use-toast";

// Status badge styling now lives in the mapper so every page uses the same colors.
const statusClass = VEHICLE_STATUS_BADGE_CLASS;

const toTitle = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

type StatusFilter = "All" | Vehicle["status"];

export default function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const canDeleteInventory = hasPermission("Inventory", "delete");
  const savedState = (location.state as { search?: string; statusFilter?: StatusFilter; view?: "grid" | "list" } | null) ?? null;
  const [search, setSearch] = useState(savedState?.search ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(savedState?.statusFilter ?? "All");
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"grid" | "list">(savedState?.view ?? "grid");

  const vehiclesQuery = useVehicles({ search, status: statusFilter });
  const createVehicle = useCreateVehicle();
  const queryClient = useQueryClient();
  const deleteVehicle = useDeleteVehicle();
  const bulkUpload = useBulkUploadVehicles();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);

  const downloadSampleCsv = () => {
    // Two example rows. Headers match the backend's expected CSV columns
    // (see inventory.controller.ts bulk-upload doc).
    const csv = [
      "title,company,model,year,price,km,owners,fuelType,transmission,color,description,vin,bodyType",
      `"2024 Honda Civic EX",Honda,Civic,2024,28000,5000,1,petrol,automatic,Silver,"Like-new condition; clean carfax",1HGCV1F37PA123456,Sedan`,
      `"2023 Toyota Camry SE",Toyota,Camry,2023,32000,12000,1,petrol,automatic,"Pearl White","Well maintained; non-smoker",4T1G11AK1PU654321,Sedan`,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-sample.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImagesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const total = pendingImages.length + files.length;
    if (total > 10) {
      toast({ title: "Too many images", description: "Maximum 10 per vehicle.", variant: "destructive" });
      return;
    }
    setPendingImages((prev) => [...prev, ...files]);
    if (imagesInputRef.current) imagesInputRef.current.value = "";
  };

  const removePendingImage = (idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCsvPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({ title: "Wrong file type", description: "Pick a .csv file.", variant: "destructive" });
      if (csvInputRef.current) csvInputRef.current.value = "";
      return;
    }
    try {
      const result = await bulkUpload.mutateAsync(file);
      const errorCount = result.errors?.length ?? 0;
      if (errorCount === 0) {
        toast({ title: "CSV import done", description: `${result.created} vehicle${result.created === 1 ? "" : "s"} added` });
      } else {
        toast({
          title: `Imported ${result.created}, ${errorCount} failed`,
          description: result.errors.slice(0, 3).join(" · "),
          variant: errorCount > result.created ? "destructive" : "default",
        });
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  // VIN decoder state
  const [vin, setVin] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinDecoded, setVinDecoded] = useState(false);
  const [form, setForm] = useState({
    title: "", company: "", model: "", trim: "", year: "", engine: "",
    fuel: "", transmission: "", bodyType: "", plant: "", country: "",
    km: "", price: "", discount: "", owners: "", color: "", description: "",
    hosting: "Self" as "Self" | "Platform",
  });
  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
  const isVinValid = VIN_RE.test(vin.trim());

  const decodeVin = async () => {
    const v = vin.trim().toUpperCase();
    setVinError(null);
    if (!VIN_RE.test(v)) {
      setVinError("VIN must be 17 characters (letters & digits, no I/O/Q).");
      return;
    }
    setVinLoading(true);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${v}?format=json`);
      if (!res.ok) throw new Error("Lookup service unavailable");
      const json = await res.json();
      const r = json?.Results?.[0];
      if (!r) throw new Error("No data returned for this VIN");
      if (r.ErrorCode && r.ErrorCode !== "0" && r.ErrorCode !== "1" && r.ErrorCode !== "6") {
        throw new Error(r.ErrorText || "VIN could not be decoded");
      }
      const make = r.Make || "";
      const model = r.Model || "";
      const year = r.ModelYear || "";
      if (!make && !model && !year) throw new Error("VIN is valid but no vehicle data is available");
      setForm((f) => ({
        ...f,
        company: make ? toTitle(make) : f.company,
        model: model || f.model,
        year: year || f.year,
        trim: r.Trim || r.Series || f.trim,
        engine: [r.DisplacementL && `${parseFloat(r.DisplacementL).toFixed(1)}L`, r.EngineCylinders && `${r.EngineCylinders}-cyl`, r.EngineHP && `${r.EngineHP}hp`].filter(Boolean).join(" · ") || f.engine,
        fuel: r.FuelTypePrimary || f.fuel,
        transmission: [r.TransmissionStyle, r.TransmissionSpeeds && `${r.TransmissionSpeeds}-spd`].filter(Boolean).join(" ") || f.transmission,
        bodyType: normalizeBodyType(r.BodyClass) || f.bodyType,
        plant: [r.PlantCity, r.PlantState, r.PlantCountry].filter(Boolean).join(", "),
        country: r.PlantCountry || "",
        title: [year, make && toTitle(make), model, r.Trim].filter(Boolean).join(" ") || f.title,
      }));
      setVinDecoded(true);
      toast({ title: "VIN decoded", description: `${year} ${toTitle(make)} ${model}` });
    } catch (e) {
      setVinError(e instanceof Error ? e.message : "Failed to decode VIN");
      setVinDecoded(false);
    } finally {
      setVinLoading(false);
    }
  };

  const resetForm = () => {
    setVin(""); setVinError(null); setVinDecoded(false);
    setForm({
      title: "", company: "", model: "", trim: "", year: "", engine: "",
      fuel: "", transmission: "", bodyType: "", plant: "", country: "",
      km: "", price: "", discount: "", owners: "", color: "", description: "",
      hosting: "Self",
    });
    setPendingImages([]);
    if (imagesInputRef.current) imagesInputRef.current.value = "";
  };

  const saveVehicle = async () => {
    if (!form.title || !form.company || !form.model) {
      toast({
        title: "Missing info",
        description: "Title, company and model are required.",
        variant: "destructive",
      });
      return;
    }
    if (!form.year || !form.price) {
      toast({
        title: "Missing info",
        description: "Year and price are required.",
        variant: "destructive",
      });
      return;
    }
    try {
      const vehicle = await createVehicle.mutateAsync({
        title: form.title,
        company: form.company,
        model: form.model,
        year: parseInt(form.year, 10),
        km: form.km ? parseInt(form.km, 10) : undefined,
        price: parseFloat(form.price),
        discount: form.discount ? parseFloat(form.discount) : undefined,
        owners: form.owners ? parseInt(form.owners, 10) : undefined,
        fuel: form.fuel || undefined,
        transmission: form.transmission || undefined,
        color: form.color || undefined,
        vin: vin.trim() || undefined,
        bodyType: form.bodyType || undefined,
        description: form.description || undefined,
        hosting: form.hosting,
      });

      // If the user staged images in the form, upload them now that we have the new vehicle's id.
      if (pendingImages.length > 0) {
        try {
          const formData = new FormData();
          for (const file of pendingImages) formData.append("images", file);
          await api<ServerVehicle>(`/inventory/${vehicle.id}/images`, {
            method: "POST",
            body: formData,
            rawBody: true,
          });
          // useCreateVehicle already invalidated ["vehicles"] right after the
          // vehicle was created (with an empty photos[]). The list re-fetched
          // and rendered the placeholder before the image upload finished, so
          // we re-invalidate here to pull the populated photos[] in.
          queryClient.invalidateQueries({ queryKey: ["vehicles"] });
          toast({
            title: "Vehicle added",
            description: `${vehicle.title} added with ${pendingImages.length} photo${pendingImages.length === 1 ? "" : "s"}.`,
          });
        } catch (err) {
          // Vehicle was created successfully; only image upload failed. Make that clear.
          const msg = err instanceof ApiError ? err.message : "Image upload failed";
          toast({
            title: "Vehicle added, photos failed",
            description: `${msg}. You can retry uploads from the detail page.`,
            variant: "destructive",
          });
        }
      } else {
        toast({ title: "Vehicle added", description: `${vehicle.title} added to inventory.` });
      }

      setShowAdd(false);
      resetForm();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not add vehicle";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, vehicle: Vehicle) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${vehicle.title}? This is a soft delete and can be recovered.`)) return;
    try {
      await deleteVehicle.mutateAsync(vehicle.id);
      toast({ title: "Vehicle deleted", description: vehicle.title });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not delete";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter, view } }, "");
  }, [search, statusFilter, view]);

  const openVehicle = (id: string) => {
    navigate(`/inventory/${id}`, { state: { search, statusFilter, view } });
  };

  const vehicles = vehiclesQuery.data?.data ?? [];
  const total = vehiclesQuery.data?.total ?? 0;
  const isLoading = vehiclesQuery.isLoading;
  const error = vehiclesQuery.error;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Inventory Management</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? "Loading…" : `${total} vehicle${total === 1 ? "" : "s"} in inventory`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={downloadSampleCsv}
            title="Download a sample CSV with two example rows"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Download sample CSV
          </button>
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={bulkUpload.isPending}
            title="Upload a CSV (columns: vehicleNumber, title, company, model, year, price, km, discount, owners, fuelType, transmission, color, description, vin, bodyType)"
            className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 disabled:opacity-60"
          >
            {bulkUpload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {bulkUpload.isPending ? "Uploading…" : "Bulk CSV"}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvPicked}
            className="hidden"
          />
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" /> Add Vehicle
          </button>
        </div>
      </div>

      {/* Add Vehicle Form */}
      {showAdd && (
        <div className="stat-card space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Add New Vehicle
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Enter a Canadian/North American VIN to auto-fill specs, or fill manually.</p>
            </div>
            <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">Reset</button>
          </div>

          {/* VIN Lookup */}
          <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <ScanLine className="h-3.5 w-3.5" /> Quick Add by VIN
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={vin}
                  onChange={(e) => { setVin(e.target.value.toUpperCase()); setVinError(null); }}
                  placeholder="e.g. 2HGFC2F59KH123456"
                  maxLength={17}
                  className={`w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono tracking-wider uppercase pr-20 ${
                    vin && !isVinValid ? "border-red-400" : vinDecoded ? "border-emerald-400" : ""
                  }`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                  {vin.length}/17
                </span>
              </div>
              <button
                onClick={decodeVin}
                disabled={!isVinValid || vinLoading}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {vinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                {vinLoading ? "Decoding…" : "Decode VIN"}
              </button>
            </div>
            {vinError && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {vinError}
              </div>
            )}
            {vinDecoded && !vinError && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Details auto-filled below — edit any field before saving.
              </div>
            )}
          </div>

          {/* Preview card when decoded */}
          {vinDecoded && (
            <div className="flex gap-4 rounded-lg border bg-card p-4">
              <div className="w-28 h-20 rounded-md bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-4xl shrink-0">
                🚗
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">VIN Preview</p>
                <p className="font-display font-semibold truncate">{form.title || "Untitled vehicle"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[form.bodyType, form.engine, form.transmission].filter(Boolean).join(" · ") || "—"}
                </p>
                {form.plant && <p className="text-[11px] text-muted-foreground mt-1">Built: {form.plant}</p>}
              </div>
            </div>
          )}

          {/* Auto-filled / editable fields */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vehicle Details</p>
            <div className="grid md:grid-cols-3 gap-3">
              {([
                ["title", "Vehicle Title", "text"],
                ["company", "Make / Company", "text"],
                ["model", "Model", "text"],
                ["trim", "Trim / Series", "text"],
                ["year", "Year", "number"],
                ["engine", "Engine", "text"],
                ["fuel", "Fuel Type", "text"],
                ["transmission", "Transmission", "text"],
              ] as const).map(([k, label, type]) => (
                <div key={k}>
                  <label className="text-[11px] text-muted-foreground">{label}</label>
                  <input
                    type={type}
                    value={form[k]}
                    onChange={(e) => setField(k, e.target.value)}
                    placeholder={label}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
              ))}
              {/* Body type as a canonical dropdown (see vehicle-mapper.ts). */}
              <div>
                <label className="text-[11px] text-muted-foreground">Body Type</label>
                <select
                  value={form.bodyType}
                  onChange={(e) => setField("bodyType", e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                >
                  <option value="">Select body type…</option>
                  {ALL_BODY_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Listing & Pricing</p>
            <div className="grid md:grid-cols-3 gap-3">
              <input value={form.km} onChange={(e) => setField("km", e.target.value)} placeholder="KM Driven" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="Price ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.discount} onChange={(e) => setField("discount", e.target.value)} placeholder="Discount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.owners} onChange={(e) => setField("owners", e.target.value)} placeholder="Owner Count" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.color} onChange={(e) => setField("color", e.target.value)} placeholder="Color (e.g. Pearl White)" type="text" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <select value={form.hosting} onChange={(e) => setField("hosting", e.target.value as "Self" | "Platform")} className="border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="Self">Self Hosted</option>
                <option value="Platform">Platform</option>
              </select>
            </div>
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Description"
            className="border rounded-lg px-3 py-2 text-sm bg-background w-full"
            rows={2}
          />

          {/* Image picker — stages files for upload right after vehicle creation */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Photos (optional)</p>
            <div
              onClick={() => imagesInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Click to pick photos (max 10). They'll upload right after the vehicle is saved.
            </div>
            <input
              ref={imagesInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesPicked}
              className="hidden"
            />
            {pendingImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {pendingImages.map((file, idx) => {
                  const url = URL.createObjectURL(file);
                  return (
                    <div key={idx} className="relative group">
                      <img
                        src={url}
                        alt={file.name}
                        className="h-20 w-28 object-cover rounded border"
                        onLoad={() => URL.revokeObjectURL(url)}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removePendingImage(idx); }}
                        title="Remove this photo"
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground h-5 w-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAdd(false); resetForm(); }}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={saveVehicle}
              disabled={createVehicle.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {createVehicle.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add to Inventory
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, make, model..."
            className="bg-transparent text-sm outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["All", ...ALL_VEHICLE_STATUSES] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 bg-card border rounded-lg p-1">
          <button onClick={() => setView("grid")} className={`p-1.5 rounded ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={`p-1.5 rounded ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="List view">
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
        </div>
      )}

      {error && (
        <div className="stat-card text-center py-12 text-red-600 text-sm flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error instanceof Error ? error.message : "Could not load inventory"}
        </div>
      )}

      {!isLoading && !error && view === "grid" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onOpen={() => openVehicle(v.id)}
              onDelete={(e) => handleDelete(e, v)}
              canDelete={canDeleteInventory}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && view === "list" && (
        <div className="stat-card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th></th>
                <th>Vehicle</th>
                <th>Seller</th>
                <th>Year</th>
                <th>KM</th>
                <th>Price</th>
                <th>Owners</th>
                <th>Status</th>
                <th>Hosting</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} onClick={() => openVehicle(v.id)} className="cursor-pointer">
                  <td className="font-mono text-xs">{v.id.slice(-6)}</td>
                  <td><VehicleThumb image={v.image} /></td>
                  <td className="font-medium">{v.title}</td>
                  <td>
                    {v.sellerId ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/crm-sellers/${v.sellerId}`); }}
                        className="text-xs text-primary hover:underline"
                      >
                        {v.sellerName}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Self</span>
                    )}
                  </td>
                  <td>{v.year}</td>
                  <td>{v.km.toLocaleString()}</td>
                  <td className="font-medium">${v.price.toLocaleString()}{v.discount > 0 && <span className="text-xs text-emerald-600 ml-1">-${v.discount.toLocaleString()}</span>}</td>
                  <td>{v.owners}</td>
                  <td><span className={`status-badge ${statusClass[v.status]}`}>{v.status}</span></td>
                  <td className="text-xs text-muted-foreground">{v.hosting}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={() => openVehicle(v.id)} className="p-1.5 rounded hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => openVehicle(v.id)} className="p-1.5 rounded hover:bg-muted" title="Edit on detail page"><Edit className="h-3.5 w-3.5" /></button>
                      {canDeleteInventory && (
                        <button onClick={(e) => handleDelete(e, v)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && vehicles.length === 0 && (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm">
          No vehicles match your filters.
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function VehicleThumb({ image }: { image: string }) {
  // Backend-served image paths look like "/uploads/vehicles/abc.jpg"; emoji placeholders don't.
  if (image.includes("/")) {
    return <img src={fileUrl(image)} alt="" className="h-8 w-12 object-cover rounded" />;
  }
  return <span className="text-2xl">{image}</span>;
}

function VehicleCard({ vehicle: v, onOpen, onDelete, canDelete }: {
  vehicle: Vehicle;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  canDelete: boolean;
}) {
  const isImagePath = v.image.includes("/");
  return (
    <div
      onClick={onOpen}
      className="group bg-card border rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="relative aspect-[16/10] bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-7xl overflow-hidden">
        {isImagePath ? (
          <img src={fileUrl(v.image)} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="drop-shadow-sm">{v.image}</span>
        )}
        <span className={`absolute top-3 left-3 status-badge ${statusClass[v.status]}`}>{v.status}</span>
        {v.discount > 0 && (
          <span className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            -${v.discount.toLocaleString()}
          </span>
        )}
        <span className="absolute bottom-3 left-3 text-[10px] font-mono bg-background/80 backdrop-blur px-2 py-0.5 rounded">
          {v.id.slice(-6)}
        </span>
        {canDelete && (
          <button
            onClick={onDelete}
            className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-background/80 backdrop-blur hover:bg-red-50 text-red-500"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-display font-semibold leading-tight group-hover:text-primary transition-colors">{v.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {[v.color, v.fuel, v.transmission].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Seller: <span className={v.sellerId ? "text-foreground font-medium" : "text-muted-foreground"}>{v.sellerName}</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />{v.year}</div>
          <div className="flex items-center gap-1 text-muted-foreground"><Gauge className="h-3 w-3" />{(v.km / 1000).toFixed(1)}k</div>
          <div className="flex items-center gap-1 text-muted-foreground"><UsersIcon className="h-3 w-3" />{v.owners} own.</div>
        </div>
        <div className="flex items-end justify-between pt-2 border-t">
          <div>
            <p className="text-lg font-bold font-display">${v.price.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{v.hosting} hosted</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{v.activity.views}</span>
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{v.activity.favorites}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
