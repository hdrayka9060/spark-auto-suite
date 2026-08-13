import { useEffect, useState } from "react";
import { Search, ChevronRight, Filter, List, KanbanSquare, User, Car, Plus, X, Loader2, AlertCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCreateLead, useLeads } from "@/hooks/api/use-leads";
import { useBuyers } from "@/hooks/api/use-buyers";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { useStaff } from "@/hooks/api/use-staff";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import {
  ALL_LEAD_SOURCES, ALL_LEAD_STATUSES, ClientLeadSource, ClientLeadStatus,
} from "@/lib/lead-mapper";
import { toast } from "@/hooks/use-toast";
import { useCan } from "@/components/Can";
import {
  SaleDetailsFields, SaleDetails, seedSaleDetails, validateSaleDetails,
} from "@/components/SaleDetailsFields";

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
  const { state: authState } = useAuth();
  const selfId = authState.user?._id ?? "";

  const canEdit = useCan("Leads & Sales", "edit");
  const canDelete = useCan("Leads & Sales", "delete");

  const [form, setForm] = useState({
    buyerId: "", vehicleId: "", source: "Website" as ClientLeadSource,
    status: "New" as ClientLeadStatus, assignedToId: "", notes: "",
  });
  // Sale capture — only used when the initial status is Closed.
  const [sale, setSale] = useState<SaleDetails>(seedSaleDetails());
  // Buyer entry mode: link an existing CRM buyer, create a new one inline, or a
  // walk-in lead with no buyer.
  const [buyerMode, setBuyerMode] = useState<"existing" | "new" | "walkin">("existing");
  const [newBuyer, setNewBuyer] = useState({ name: "", email: "", phone: "" });
  const resetForm = () => {
    setForm({ buyerId: "", vehicleId: "", source: "Website", status: "New", assignedToId: selfId, notes: "" });
    setSale(seedSaleDetails());
    setBuyerMode("existing");
    setNewBuyer({ name: "", email: "", phone: "" });
  };

  // Leads are never unassigned — default the picker to the current user.
  useEffect(() => {
    if (selfId) setForm((f) => (f.assignedToId ? f : { ...f, assignedToId: selfId }));
  }, [selfId]);

  // When the initial status becomes Closed, prefill the sold price from the
  // chosen vehicle's list price (staff can override).
  useEffect(() => {
    if (form.status !== "Closed") return;
    const veh = (vehiclesQuery.data?.data ?? []).find((v) => v.id === form.vehicleId);
    setSale((s) => (s.soldAt > 0 ? s : { ...s, soldAt: veh?.price ?? 0, amountPaid: veh?.price ?? 0 }));
  }, [form.status, form.vehicleId, vehiclesQuery.data]);

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
    if (!form.vehicleId) {
      toast({ title: "Missing info", description: "Pick a vehicle.", variant: "destructive" });
      return;
    }
    if (buyerMode === "existing" && !form.buyerId) {
      toast({ title: "Pick a buyer", description: "Choose an existing buyer, add a new one, or select Walk-in.", variant: "destructive" });
      return;
    }
    if (buyerMode === "new" && (!newBuyer.name.trim() || !newBuyer.email.trim() || !newBuyer.phone.trim())) {
      toast({ title: "New buyer details needed", description: "Enter the new buyer's name, email and phone.", variant: "destructive" });
      return;
    }

    // Client-side Guard 2 mirror — only relevant when linking an existing buyer.
    if (buyerMode === "existing") {
      const existingLead = leads.find(
        (l) => l.buyerId === form.buyerId && l.vehicleId === form.vehicleId && l.status !== "Archived"
      );
      if (existingLead) {
        toast({
          title: "Lead already exists",
          description: `${existingLead.buyerName} already has an active lead for ${existingLead.vehicleTitle}. Archive the existing lead to create a new one.`,
          variant: "destructive",
        });
        return;
      }
    }

    // Creating a lead directly as Closed captures the sale (same as closing an
    // existing lead) — validate before sending.
    const closing = form.status === "Closed";
    if (closing) {
      const saleErr = validateSaleDetails(sale);
      if (saleErr) {
        toast({ title: "Sale details needed", description: saleErr, variant: "destructive" });
        return;
      }
    }

    try {
      const lead = await createLead.mutateAsync({
        buyerId: buyerMode === "existing" ? form.buyerId : undefined,
        ...(buyerMode === "new"
          ? { newBuyerName: newBuyer.name.trim(), newBuyerEmail: newBuyer.email.trim(), newBuyerPhone: newBuyer.phone.trim() }
          : {}),
        vehicleId: form.vehicleId,
        source: form.source,
        status: form.status,
        assignedToId: form.assignedToId || undefined,
        notes: form.notes || undefined,
        ...(closing
          ? {
              soldAt: sale.soldAt,
              amountPaid: sale.amountPaid,
              paymentMethod: sale.paymentMethod,
              paymentStatus: sale.paymentStatus,
              saleDate: sale.saleDate,
            }
          : {}),
      });
      toast({
        title: closing ? "Lead created & sale recorded" : "Lead created",
        description: `${lead.buyerName} → ${lead.vehicleTitle}`,
      });
      resetForm();
      setShowAdd(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create lead";
      const title = msg.includes("already exists") ? "Duplicate lead" : "Save failed";
      toast({ title, description: msg, variant: "destructive" });
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
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? "Cancel" : "New Lead"}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Lead</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Buyer</label>
              <select
                value={buyerMode === "new" ? "__new__" : buyerMode === "walkin" ? "__walkin__" : (form.buyerId || "")}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") { setBuyerMode("new"); setForm({ ...form, buyerId: "" }); }
                  else if (v === "__walkin__") { setBuyerMode("walkin"); setForm({ ...form, buyerId: "" }); }
                  else { setBuyerMode("existing"); setForm({ ...form, buyerId: v }); }
                }}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background"
              >
                <option value="">Pick a buyer…</option>
                <option value="__new__">➕ New buyer (add to CRM)</option>
                <option value="__walkin__">🚶 Walk-in (no buyer)</option>
                {(buyersQuery.data?.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {buyerMode === "new" && (
                <>
                  <div className="grid md:grid-cols-3 gap-3 mt-2">
                    <input placeholder="New buyer name *" value={newBuyer.name} onChange={(e) => setNewBuyer((b) => ({ ...b, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                    <input type="email" placeholder="New buyer email *" value={newBuyer.email} onChange={(e) => setNewBuyer((b) => ({ ...b, email: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                    <input inputMode="tel" placeholder="Phone *" value={newBuyer.phone} onChange={(e) => setNewBuyer((b) => ({ ...b, phone: e.target.value.replace(/[^\d+\- ]/g, "") }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    A new buyer is added to CRM. A buyer with the same email is rejected — pick them from the list instead.
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vehicle *</label>
              <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">Pick a vehicle…</option>
                {(vehiclesQuery.data?.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.title} — {v.status}</option>
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
              <label className="text-xs text-muted-foreground">Assign to *</label>
              <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="" disabled>Select staff…</option>
                {(staffQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.id === selfId ? " (you)" : ""}</option>
                ))}
              </select>
            </div>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="border rounded-lg px-3 py-2 text-sm bg-background self-end"
            />
          </div>

          {/* Sale capture — appears when the lead is created directly as Closed. */}
          {form.status === "Closed" && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sale details</p>
              <p className="text-[11px] text-muted-foreground">
                Closing on creation records a sale, marks the vehicle Sold, and logs the buyer's purchase.
              </p>
              <SaleDetailsFields value={sale} onChange={setSale} />
            </div>
          )}

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
