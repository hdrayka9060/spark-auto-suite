import { useEffect, useState } from "react";
import { Search, ChevronRight, Filter } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { leads } from "@/data/leads";

const statuses = ["All", "New", "Contacted", "Test Drive", "Negotiation", "Closed"];

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-purple-100 text-purple-700",
  "Test Drive": "bg-amber-100 text-amber-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Closed: "bg-emerald-100 text-emerald-700",
};

const sourceColors: Record<string, string> = {
  Website: "bg-blue-50 text-blue-700",
  "Google Ads": "bg-amber-50 text-amber-700",
  "Meta Ads": "bg-violet-50 text-violet-700",
  Referral: "bg-emerald-50 text-emerald-700",
  "Walk-in": "bg-gray-100 text-gray-700",
};

export default function Leads() {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { search?: string; statusFilter?: string } | null) ?? null;
  const [search, setSearch] = useState(saved?.search ?? "");
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "All");

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter } }, "");
  }, [search, statusFilter]);

  const filtered = leads.filter(
    (l) =>
      (statusFilter === "All" || l.status === statusFilter) &&
      (l.buyerName.toLowerCase().includes(search.toLowerCase()) || l.vehicleTitle.toLowerCase().includes(search.toLowerCase()))
  );

  const open = (id: string) => navigate(`/leads/${id}`, { state: { search, statusFilter } });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Leads & Sales</h1>
          <p className="text-muted-foreground text-sm">Track every enquiry through the sales pipeline</p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">+ New Lead</button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by buyer or vehicle..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lead ID</th>
              <th>Buyer Name</th>
              <th>Vehicle</th>
              <th>Source</th>
              <th>Status</th>
              <th>Assigned Staff</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} onClick={() => open(l.id)} className="cursor-pointer">
                <td className="font-mono text-xs">{l.id}</td>
                <td className="font-medium">{l.buyerName}</td>
                <td className="text-sm">{l.vehicleTitle}</td>
                <td><span className={`status-badge ${sourceColors[l.source]}`}>{l.source}</span></td>
                <td><span className={`status-badge ${statusColors[l.status]}`}>{l.status}</span></td>
                <td className="text-sm">{l.assignedTo}</td>
                <td className="text-xs text-muted-foreground">{l.createdAt}</td>
                <td><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
