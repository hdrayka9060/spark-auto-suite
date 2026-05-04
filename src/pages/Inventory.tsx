import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Upload, Search, Filter, Eye, Edit, Trash2, Image, LayoutGrid, List, Gauge, Calendar, Users as UsersIcon, Heart } from "lucide-react";
import { vehicles } from "@/data/vehicles";

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
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Add New Vehicle</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <input placeholder="Vehicle Title" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Company" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Model" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Year" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="KM Driven" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Price ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Discount ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Owner Count" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option>Self Hosted</option>
              <option>Platform</option>
            </select>
          </div>
          <textarea placeholder="Description" className="border rounded-lg px-3 py-2 text-sm bg-background w-full" rows={2} />
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
            <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Drop images here or click to upload (multiple)
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancel</button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">Save Vehicle</button>
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
