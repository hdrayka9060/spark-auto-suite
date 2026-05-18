import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Upload, Search, Filter, Eye, Edit, Trash2, Image, LayoutGrid, List, Gauge, Calendar, Users as UsersIcon, Heart, ScanLine, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { vehicles } from "@/data/vehicles";
import { toast } from "@/hooks/use-toast";

const statusClass: Record<string, string> = {
  Sold: "sold",
  Pending: "pending",
  Unsold: "unsold",
};

export default function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const savedState = (location.state as { search?: string; statusFilter?: string; view?: "grid" | "list" } | null) ?? null;
  const [search, setSearch] = useState(savedState?.search ?? "");
  const [statusFilter, setStatusFilter] = useState(savedState?.statusFilter ?? "All");
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"grid" | "list">(savedState?.view ?? "grid");

  // VIN decoder state
  const [vin, setVin] = useState("");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinDecoded, setVinDecoded] = useState(false);
  const [form, setForm] = useState({
    title: "", company: "", model: "", trim: "", year: "", engine: "",
    fuel: "", transmission: "", bodyType: "", plant: "", country: "",
    km: "", price: "", discount: "", owners: "", description: "", hosting: "Self",
  });
  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // VIN validation: 17 chars, no I/O/Q
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
        bodyType: r.BodyClass || f.bodyType,
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
    setForm({ title: "", company: "", model: "", trim: "", year: "", engine: "", fuel: "", transmission: "", bodyType: "", plant: "", country: "", km: "", price: "", discount: "", owners: "", description: "", hosting: "Self" });
  };

  const saveVehicle = () => {
    if (!form.title || !form.company || !form.model) {
      toast({ title: "Missing info", description: "Title, company and model are required.", variant: "destructive" });
      return;
    }
    toast({ title: "Vehicle added", description: `${form.title} added to inventory.` });
    setShowAdd(false);
    resetForm();
  };

  // Persist filters into history state so they survive back-navigation
  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter, view } }, "");
  }, [search, statusFilter, view]);

  const openVehicle = (id: string) => {
    navigate(`/inventory/${id}`, { state: { search, statusFilter, view } });
  };

  const filtered = vehicles.filter(
    (v) =>
      (statusFilter === "All" || v.status === statusFilter) &&
      (v.title.toLowerCase().includes(search.toLowerCase()) || v.id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Inventory Management</h1>
          <p className="text-muted-foreground text-sm">{vehicles.length} vehicles in inventory</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
            <Upload className="h-4 w-4" /> Bulk CSV
          </button>
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
              {[
                ["title", "Vehicle Title", "text"],
                ["company", "Make / Company", "text"],
                ["model", "Model", "text"],
                ["trim", "Trim / Series", "text"],
                ["year", "Year", "number"],
                ["engine", "Engine", "text"],
                ["fuel", "Fuel Type", "text"],
                ["transmission", "Transmission", "text"],
                ["bodyType", "Body Type", "text"],
              ].map(([k, label, type]) => (
                <div key={k as string}>
                  <label className="text-[11px] text-muted-foreground">{label}</label>
                  <input
                    type={type as string}
                    value={form[k as keyof typeof form]}
                    onChange={(e) => setField(k as keyof typeof form, e.target.value)}
                    placeholder={label as string}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Listing & Pricing</p>
            <div className="grid md:grid-cols-3 gap-3">
              <input value={form.km} onChange={(e) => setField("km", e.target.value)} placeholder="KM Driven" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="Price (CAD $)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.discount} onChange={(e) => setField("discount", e.target.value)} placeholder="Discount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <input value={form.owners} onChange={(e) => setField("owners", e.target.value)} placeholder="Owner Count" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
              <select value={form.hosting} onChange={(e) => setField("hosting", e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-background">
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
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
            <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Drop images here or click to upload (multiple)
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); resetForm(); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button onClick={saveVehicle} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">Add to Inventory</button>
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
            placeholder="Search by title or ID..."
            className="bg-transparent text-sm outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {["All", "Unsold", "Pending", "Sold"].map((s) => (
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

      {/* Grid view */}
      {view === "grid" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((v) => (
            <div
              key={v.id}
              onClick={() => openVehicle(v.id)}
              className="group bg-card border rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="relative aspect-[16/10] bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-7xl">
                <span className="drop-shadow-sm">{v.image}</span>
                <span className={`absolute top-3 left-3 status-badge ${statusClass[v.status]}`}>{v.status}</span>
                {v.discount > 0 && (
                  <span className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    -${v.discount.toLocaleString()}
                  </span>
                )}
                <span className="absolute bottom-3 left-3 text-[10px] font-mono bg-background/80 backdrop-blur px-2 py-0.5 rounded">
                  {v.id}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-display font-semibold leading-tight group-hover:text-primary transition-colors">{v.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.color} · {v.fuel} · {v.transmission}</p>
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
          ))}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th></th>
              <th>Vehicle</th>
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
            {filtered.map((v) => (
              <tr key={v.id} onClick={() => openVehicle(v.id)} className="cursor-pointer">
                <td className="font-mono text-xs">{v.id}</td>
                <td className="text-2xl">{v.image}</td>
                <td className="font-medium">{v.title}</td>
                <td>{v.year}</td>
                <td>{v.km.toLocaleString()}</td>
                <td className="font-medium">${v.price.toLocaleString()}{v.discount > 0 && <span className="text-xs text-emerald-600 ml-1">-${v.discount.toLocaleString()}</span>}</td>
                <td>{v.owners}</td>
                <td><span className={`status-badge ${statusClass[v.status]}`}>{v.status}</span></td>
                <td className="text-xs text-muted-foreground">{v.hosting}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button onClick={() => openVehicle(v.id)} className="p-1.5 rounded hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5" /></button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {filtered.length === 0 && (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm">
          No vehicles match your filters.
        </div>
      )}
    </div>
  );
}
