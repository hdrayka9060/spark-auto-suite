import { useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, LayoutGrid, List, Mail, Phone, Heart, CalendarCheck, ShoppingBag, Plus, Loader2, AlertCircle, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBuyers, useCreateBuyer } from "@/hooks/api/use-buyers";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { ApiError } from "@/lib/api";
import { ClientBuyerStatus } from "@/lib/buyer-mapper";
import { toast } from "@/hooks/use-toast";
import { useCan } from "@/components/Can";

const statusColors: Record<ClientBuyerStatus, string> = {
  Active: "bg-blue-100 text-blue-700",
  Converted: "bg-emerald-100 text-emerald-700",
  Dropped: "bg-gray-100 text-gray-600",
};

const filters: (ClientBuyerStatus | "All")[] = ["All", "Active", "Converted", "Dropped"];

export default function CRMBuyers() {
  const navigate = useNavigate();
  const location = useLocation();
  const saved = (location.state as { search?: string; statusFilter?: ClientBuyerStatus | "All"; view?: "grid" | "list" } | null) ?? null;
  const [search, setSearch] = useState(saved?.search ?? "");
  const [statusFilter, setStatusFilter] = useState<ClientBuyerStatus | "All">(saved?.statusFilter ?? "All");
  const [view, setView] = useState<"grid" | "list">(saved?.view ?? "grid");
  const [showAdd, setShowAdd] = useState(false);

  const buyersQuery = useBuyers({ search, status: statusFilter });
  const createBuyer = useCreateBuyer();
  const vehiclesQuery = useVehicles({ limit: 100 });

  const canEdit = useCan("CRM – Buyers", "edit");
  const canDelete = useCan("CRM – Buyers", "delete");

  // Add-buyer form state
  const [form, setForm] = useState({
    name: "", email: "", phone: "", notes: "",
    interestedVehicleId: "", budget: "",
  });
  const resetForm = () => setForm({ name: "", email: "", phone: "", notes: "", interestedVehicleId: "", budget: "" });

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state || {}), usr: { search, statusFilter, view } }, "");
  }, [search, statusFilter, view]);

  const buyers = buyersQuery.data?.data ?? [];
  const counts = useMemo(() => {
    const c = { Active: 0, Converted: 0, Dropped: 0 };
    for (const b of buyers) c[b.status]++;
    return c;
  }, [buyers]);

  const open = (id: string) => navigate(`/crm-buyers/${id}`, { state: { search, statusFilter, view } });

  const handleSave = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast({ title: "Missing info", description: "Name, email and phone are required.", variant: "destructive" });
      return;
    }
    try {
      await createBuyer.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone,
        notes: form.notes || undefined,
        interestedVehicleIds: form.interestedVehicleId ? [form.interestedVehicleId] : undefined,
        budget: form.budget ? parseFloat(form.budget) : undefined,
      });
      toast({ title: "Buyer added", description: form.name });
      resetForm();
      setShowAdd(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not add buyer";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">CRM – Buyers</h1>
          <p className="text-muted-foreground text-sm">Customers looking to buy vehicles</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? "Cancel" : "New Buyer"}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Buyer</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" type="email" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select
              value={form.interestedVehicleId}
              onChange={(e) => setForm({ ...form, interestedVehicleId: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">Interested vehicle (optional)</option>
              {(vehiclesQuery.data?.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
            <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Budget ($)" type="number" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAdd(false); resetForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleSave}
              disabled={createBuyer.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {createBuyer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Buyer
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
            }`}
          >
            {s}
            {s !== "All" && <span className="ml-1 opacity-70">({counts[s as keyof typeof counts]})</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyers..." className="bg-transparent text-sm outline-none w-full" />
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

      {buyersQuery.isLoading && (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading buyers…
        </div>
      )}

      {buyersQuery.error && (
        <div className="stat-card text-center py-12 text-red-600 text-sm flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {buyersQuery.error instanceof Error ? buyersQuery.error.message : "Could not load buyers"}
        </div>
      )}

      {!buyersQuery.isLoading && !buyersQuery.error && view === "grid" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {buyers.map((b) => {
            const initials = b.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            return (
              <div
                key={b.id}
                onClick={() => open(b.id)}
                className="group bg-card border rounded-xl p-5 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent to-accent/70 text-accent-foreground flex items-center justify-center font-semibold">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-semibold truncate group-hover:text-primary transition-colors">{b.name}</h3>
                      <span className={`status-badge ${statusColors[b.status]}`}>{b.status}</span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{b.id.slice(-8)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate">{b.email}</span></div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{b.phone}</div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-lg font-bold font-display flex items-center gap-1"><Heart className="h-4 w-4 text-rose-500" />{b.interestedVehicles.length}</p>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Interest</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-display flex items-center gap-1"><CalendarCheck className="h-4 w-4 text-primary" />{b.bookings}</p>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Bookings</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold font-display flex items-center gap-1"><ShoppingBag className="h-4 w-4 text-emerald-600" />{b.purchases.length}</p>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Bought</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!buyersQuery.isLoading && !buyersQuery.error && view === "list" && (
        <div className="stat-card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Buyer Name</th>
                <th>Contact</th>
                <th>Interested Vehicle</th>
                <th>Bookings</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.id} onClick={() => open(b.id)} className="cursor-pointer">
                  <td className="font-medium">{b.name}</td>
                  <td className="text-sm">
                    <p>{b.email}</p>
                    <p className="text-xs text-muted-foreground">{b.phone}</p>
                  </td>
                  <td className="text-sm">{b.interestedVehicleTitle ?? "—"}</td>
                  <td className="text-sm">{b.bookings}</td>
                  <td><span className={`status-badge ${statusColors[b.status]}`}>{b.status}</span></td>
                  <td><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!buyersQuery.isLoading && !buyersQuery.error && buyers.length === 0 && (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm">
          No buyers match your filters. Click "New Buyer" to add one.
        </div>
      )}
    </div>
  );
}
