import { useEffect, useState } from "react";
import { Search, ChevronRight, LayoutGrid, List, MapPin, Car, Sparkles, Mail, Phone } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { sellers } from "@/data/sellers";

const stages = ["All", "VIP", "Active", "Inactive"];

const statusColors: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-gray-100 text-gray-600",
  VIP: "bg-amber-100 text-amber-700",
};

export default function CRMSellers() {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { search?: string; statusFilter?: string; view?: "grid" | "list" } | null) ?? null;
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "All");
  const [search, setSearch] = useState(saved?.search ?? "");
  const [view, setView] = useState<"grid" | "list">(saved?.view ?? "grid");

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter, view } }, "");
  }, [search, statusFilter, view]);

  const filtered = sellers.filter(
    (s) => (statusFilter === "All" || s.status === statusFilter) && s.name.toLowerCase().includes(search.toLowerCase())
  );

  const open = (id: string) => navigate(`/crm-sellers/${id}`, { state: { search, statusFilter, view } });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">CRM – Sellers</h1>
          <p className="text-muted-foreground text-sm">Customers listing vehicles for sale</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {stages.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
            }`}
          >
            {s} {s !== "All" && <span className="ml-1 opacity-70">({sellers.filter((x) => x.status === s).length})</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sellers..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <div className="ml-auto flex items-center gap-1 bg-card border rounded-lg p-1">
          <button onClick={() => setView("grid")} className={`p-1.5 rounded ${view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={`p-1.5 rounded ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {view === "grid" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const initials = s.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            return (
              <div key={s.id} onClick={() => open(s.id)}
                className="group bg-card border rounded-xl p-5 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center font-semibold">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-semibold truncate group-hover:text-primary transition-colors">{s.name}</h3>
                      <span className={`status-badge ${statusColors[s.status]}`}>{s.status === "VIP" && <Sparkles className="h-3 w-3 mr-0.5" />}{s.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{s.location}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate">{s.email}</span></div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{s.phone}</div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-lg font-bold font-display flex items-center gap-1"><Car className="h-4 w-4 text-primary" />{s.vehiclesListed.length}</p>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Listed</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-display">{s.activeLeads}</p>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Leads</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-display">{s.traffic}</p>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Visits</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Seller Name</th>
              <th>Contact</th>
              <th>Vehicles Listed</th>
              <th>Active Leads</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} onClick={() => open(s.id)} className="cursor-pointer">
                <td>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.location}</p>
                </td>
                <td className="text-sm">
                  <p>{s.email}</p>
                  <p className="text-xs text-muted-foreground">{s.phone}</p>
                </td>
                <td className="text-sm">{s.vehiclesListed.length}</td>
                <td className="text-sm">{s.activeLeads}</td>
                <td><span className={`status-badge ${statusColors[s.status]}`}>{s.status}</span></td>
                <td><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
