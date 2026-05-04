import { useEffect, useState } from "react";
import { Search, ChevronRight, Filter, LayoutGrid, List, KanbanSquare, User, Car } from "lucide-react";
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
  const saved = (location.state as { search?: string; statusFilter?: string; view?: "kanban" | "list" } | null) ?? null;
  const [search, setSearch] = useState(saved?.search ?? "");
  const [statusFilter, setStatusFilter] = useState(saved?.statusFilter ?? "All");
  const [view, setView] = useState<"kanban" | "list">(saved?.view ?? "kanban");

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter, view } }, "");
  }, [search, statusFilter, view]);

  const filtered = leads.filter(
    (l) =>
      (statusFilter === "All" || l.status === statusFilter) &&
      (l.buyerName.toLowerCase().includes(search.toLowerCase()) || l.vehicleTitle.toLowerCase().includes(search.toLowerCase()))
  );

  const open = (id: string) => navigate(`/leads/${id}`, { state: { search, statusFilter, view } });

  const pipelineStages = ["New", "Contacted", "Test Drive", "Negotiation", "Closed"] as const;

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
        <div className="ml-auto flex items-center gap-1 bg-card border rounded-lg p-1">
          <button onClick={() => setView("kanban")} className={`p-1.5 rounded ${view === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Pipeline"><KanbanSquare className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={`p-1.5 rounded ${view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="List"><List className="h-4 w-4" /></button>
        </div>
      </div>

      {view === "kanban" && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
          {pipelineStages.map((stage) => {
            const items = filtered.filter((l) => l.status === stage);
            return (
              <div key={stage} className="bg-muted/40 border rounded-xl p-3 flex flex-col min-h-[200px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${statusColors[stage].split(" ")[0].replace("bg-", "bg-")}`} />
                    <h3 className="font-display font-semibold text-sm">{stage}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground bg-card border rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="space-y-2 flex-1">
                  {items.map((l) => (
                    <div key={l.id} onClick={() => open(l.id)}
                      className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{l.id}</span>
                        <span className={`status-badge ${sourceColors[l.source]}`}>{l.source}</span>
                      </div>
                      <p className="font-medium text-sm flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" />{l.buyerName}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Car className="h-3 w-3" />{l.vehicleTitle}</p>
                      <div className="mt-3 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{l.assignedTo}</span>
                        <span>{l.createdAt.slice(5)}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No leads</p>
                  )}
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
      )}
    </div>
  );
}
