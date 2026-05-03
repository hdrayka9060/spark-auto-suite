import { useEffect, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
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
  const saved = (location.state as { search?: string; statusFilter?: string } | null) ?? null;
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "All");
  const [search, setSearch] = useState(saved?.search ?? "");

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter } }, "");
  }, [search, statusFilter]);

  const filtered = sellers.filter(
    (s) => (statusFilter === "All" || s.status === statusFilter) && s.name.toLowerCase().includes(search.toLowerCase())
  );

  const open = (id: string) => navigate(`/crm-sellers/${id}`, { state: { search, statusFilter } });

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

      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sellers..." className="bg-transparent text-sm outline-none w-full" />
      </div>

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
    </div>
  );
}
