import { useEffect, useState } from "react";
import { Search, ChevronRight, Filter, List, KanbanSquare, User, Car, Plus, X, Loader2, AlertCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCreateLead, useLeads } from "@/hooks/api/use-leads";
import { useBuyers } from "@/hooks/api/use-buyers";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { useStaff } from "@/hooks/api/use-staff";
import { ApiError } from "@/lib/api";
import {
  ALL_LEAD_SOURCES, ALL_LEAD_STATUSES, ClientLeadSource, ClientLeadStatus,
} from "@/lib/lead-mapper";
import { toast } from "@/hooks/use-toast";

const statuses: (ClientLeadStatus | "All")[] = ["All", ...ALL_LEAD_STATUSES];

const statusColors: Record<ClientLeadStatus, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-purple-100 text-purple-700",
  "Test Drive": "bg-amber-100 text-amber-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Closed: "bg-emerald-100 text-emerald-700",
  Archived: "bg-slate-100 text-slate-600",
};

const sourceColors: Record<ClientLeadSource, string> = {
  Website: "bg-blue-50 text-blue-700",
  "Google Ads": "bg-amber-50 text-amber-700",
  "Meta Ads": "bg-violet-50 text-violet-700",
  Referral: "bg-emerald-50 text-emerald-700",
  "Walk-in": "bg-gray-100 text-gray-700",
};

export default function Leads() {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { search?: string; statusFilter?: ClientLeadStatus | "All"; view?: "kanban" | "list" } | null) ?? null;
  const [search, setSearch] = useState(saved?.search ?? "");
  const [statusFilter, setStatusFilter] = useState<ClientLeadStatus | "All">(saved?.statusFilter ?? "All");
  const [view, setView] = useState<"kanban" | "list">(saved?.view ?? "kanban");
  const [showAdd, setShowAdd] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const leadsQuery = useLeads({ search, status: statusFilter });
  const createLead = useCreateLead();
  const buyersQuery = useBuyers({});
  const vehiclesQuery = useVehicles({ limit: 100 });
  const staffQuery = useStaff();

  const [form, setForm] = useState({
    buyerId: "", vehicleId: "", source: "Website" as ClientLeadSource,
    status: "New" as ClientLeadStatus, assignedToId: "", notes: "",
  });
  const resetForm = () => setForm({ buyerId: "", vehicleId: "", source: "Website", status: "New", assignedToId: "", notes: "" });

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter, view } }, "");
  }, [search, statusFilter, view]);

  const leads = leadsQuery.data?.data ?? [];

  // Client-side search filter on top of server-side status filter
  const filtered = leads.filter((l) =>
    l.buyerName.toLowerCase().includes(search.toLowerCase()) ||
    l.vehicleTitle.toLowerCase().includes(search.toLowerCase()),
  );

  const open = (id: string) => navigate(`/leads/${id}`, { state: { search, statusFilter, view } });

  const handleSave = async () => {
    if (!form.buyerId || !form.vehicleId) {
      toast({ title: "Missing info", description: "Pick a buyer and a vehicle.", variant: "destructive" });
      return;
    }
    try {
      const lead = await createLead.mutateAsync({
        buyerId: form.buyerId,
        vehicleId: form.vehicleId,
        source: form.source,
        status: form.status,
        assignedToId: form.assignedToId || undefined,
        notes: form.notes || undefined,
      });
      toast({ title: "Lead created", description: `${lead.buyerName} → ${lead.vehicleTitle}` });
      resetForm();
      setShowAdd(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create lead";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  // Active pipeline (rendered as the main kanban). Archived gets its own
  // de-emphasized strip below so it doesn't compete with in-flight leads for
  // attention but stays one click away when the dealer wants to review history.
  const pipelineStages: ClientLeadStatus[] = ["New", "Contacted", "Test Drive", "Negotiation", "Closed"];
  const archivedLeads = filtered.filter((l) => l.status === "Archived");
  const activeLeads = filtered.filter((l) => l.status !== "Archived");

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Leads & Sales</h1>
          <p className="text-muted-foreground text-sm">Track every enquiry through the sales pipeline</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? "Cancel" : "New Lead"}
        </button>
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Lead</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Buyer *</label>
              <select value={form.buyerId} onChange={(e) => setForm({ ...form, buyerId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Pick a buyer…</option>
                {(buyersQuery.data?.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vehicle *</label>
              <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Pick a vehicle…</option>
                {(vehiclesQuery.data?.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Source</label>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as ClientLeadSource })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                {ALL_LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Initial status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientLeadStatus })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                {ALL_LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Assign to</label>
              <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Unassigned</option>
                {(staffQuery.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="border rounded-lg px-3 py-2 text-sm bg-background self-end"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); resetForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleSave}
              disabled={createLead.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {createLead.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Lead
            </button>
          </div>
        </div>
      )}

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

      {leadsQuery.isLoading && (
        <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading leads…
        </div>
      )}

      {leadsQuery.error && (
        <div className="stat-card text-center py-12 text-red-600 flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" /> {leadsQuery.error instanceof Error ? leadsQuery.error.message : "Could not load leads"}
        </div>
      )}

      {!leadsQuery.isLoading && !leadsQuery.error && view === "kanban" && (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
            {pipelineStages.map((stage) => {
              const items = activeLeads.filter((l) => l.status === stage);
              return (
                <div key={stage} className="bg-muted/40 border rounded-xl p-3 flex flex-col min-h-[200px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusColors[stage].split(" ")[0]}`} />
                      <h3 className="font-display font-semibold text-sm">{stage}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground bg-card border rounded-full px-2 py-0.5">{items.length}</span>
                  </div>
                  <div className="space-y-2 flex-1">
                    {items.map((l) => (
                      <div key={l.id} onClick={() => open(l.id)}
                        className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{l.id.slice(-6)}</span>
                          <span className={`status-badge ${sourceColors[l.source]}`}>{l.source}</span>
                        </div>
                        <p className="font-medium text-sm flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" />{l.buyerName}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Car className="h-3 w-3" />{l.vehicleTitle}</p>
                        <div className="mt-3 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{l.assignedTo || "Unassigned"}</span>
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

          {archivedLeads.length > 0 && (
            <div className="bg-muted/20 border border-dashed rounded-xl p-3">
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="w-full flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  <h3 className="font-display font-semibold text-sm text-muted-foreground">Archived</h3>
                  <span className="text-xs text-muted-foreground bg-card border rounded-full px-2 py-0.5">{archivedLeads.length}</span>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground">
                  {showArchived ? "Hide" : "Show"}
                </span>
              </button>
              {showArchived && (
                <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {archivedLeads.map((l) => (
                    <div key={l.id} onClick={() => open(l.id)}
                      className="bg-card/70 border rounded-lg p-2.5 cursor-pointer hover:shadow-sm hover:border-primary/40 transition-all opacity-80 hover:opacity-100">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{l.id.slice(-6)}</span>
                        <span className={`status-badge ${sourceColors[l.source]}`}>{l.source}</span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" />{l.buyerName}</p>
                      <p className="text-xs text-muted-foreground/80 mt-0.5 flex items-center gap-1.5"><Car className="h-3 w-3" />{l.vehicleTitle}</p>
                      <div className="mt-2 pt-1.5 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{l.assignedTo || "Unassigned"}</span>
                        <span>{l.createdAt.slice(5)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!leadsQuery.isLoading && !leadsQuery.error && view === "list" && (
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
                <tr
                  key={l.id}
                  onClick={() => open(l.id)}
                  className={`cursor-pointer ${l.status === "Archived" ? "opacity-60 hover:opacity-100" : ""}`}
                >
                  <td className="font-mono text-xs">{l.id.slice(-6)}</td>
                  <td className="font-medium">{l.buyerName}</td>
                  <td className="text-sm">{l.vehicleTitle}</td>
                  <td><span className={`status-badge ${sourceColors[l.source]}`}>{l.source}</span></td>
                  <td><span className={`status-badge ${statusColors[l.status]}`}>{l.status}</span></td>
                  <td className="text-sm">{l.assignedTo || "—"}</td>
                  <td className="text-xs text-muted-foreground">{l.createdAt}</td>
                  <td><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!leadsQuery.isLoading && !leadsQuery.error && filtered.length === 0 && (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm">
          No leads match your filters. Click "New Lead" to create one.
        </div>
      )}
    </div>
  );
}
