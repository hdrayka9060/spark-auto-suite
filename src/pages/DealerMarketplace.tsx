import { useMemo, useState } from "react";
import { Store, Eye, Users, TrendingUp, Edit2, Check, Search, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { useUpdateVehicle, useVehicles } from "@/hooks/api/use-vehicles";
import { ApiError, fileUrl } from "@/lib/api";
import { Vehicle } from "@/lib/vehicle-mapper";
import { toast } from "@/hooks/use-toast";

/**
 * Marketplace listing state is derived from `vehicle.hosting`:
 *   - hosting === "Platform" ⇒ listed on the dealer marketplace
 *   - hosting === "Self"     ⇒ self-hosted only (not on marketplace)
 * Toggling flips between the two.
 *
 * KPIs (views, leads) are sourced from `vehicle.activity.views/inquiries`
 * summed across vehicles where hosting=Platform. There's no marketplace-only
 * traffic tracking yet — those numbers reflect total engagement, which is
 * a reasonable approximation for a single dealer.
 */

export default function DealerMarketplace() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const vehiclesQuery = useVehicles({ search, limit: 100 });
  const vehicles = vehiclesQuery.data?.data ?? [];

  const listedVehicles = useMemo(() => vehicles.filter((v) => v.hosting === "Platform"), [vehicles]);
  const listedCount = listedVehicles.length;
  const totalViews = useMemo(() => listedVehicles.reduce((acc, v) => acc + v.activity.views, 0), [listedVehicles]);
  const totalLeads = useMemo(() => listedVehicles.reduce((acc, v) => acc + v.activity.inquiries, 0), [listedVehicles]);
  const conversionRate = totalViews > 0 ? (totalLeads / totalViews) * 100 : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dealer Marketplace</h1>
          <p className="text-muted-foreground text-sm">Publish vehicles to the third-party marketplace</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          onClick={() => toast({ title: "Marketplace URL", description: "Marketplace integration is on the Phase 8 roadmap." })}>
          <ExternalLink className="h-4 w-4" /> View on Marketplace
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Store} color="bg-primary/10 text-primary" value={String(listedCount)} label="Listed on Marketplace" />
        <KpiCard icon={Eye} color="bg-blue-50 text-blue-600" value={totalViews.toLocaleString()} label="Total Views" />
        <KpiCard icon={Users} color="bg-amber-50 text-amber-600" value={String(totalLeads)} label="Inquiries" />
        <KpiCard icon={TrendingUp} color="bg-emerald-50 text-emerald-600" value={`${conversionRate.toFixed(2)}%`} label="View → Inquiry" />
      </div>

      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicles..." className="bg-transparent text-sm outline-none w-full" />
      </div>

      {vehiclesQuery.isLoading && (
        <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
        </div>
      )}
      {vehiclesQuery.error && (
        <div className="stat-card text-center py-12 text-red-600 flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" /> {vehiclesQuery.error instanceof Error ? vehiclesQuery.error.message : "Could not load"}
        </div>
      )}

      {!vehiclesQuery.isLoading && vehicles.length === 0 && (
        <div className="stat-card text-center py-12 text-muted-foreground">No vehicles in inventory.</div>
      )}

      {vehicles.length > 0 && (
        <div className="stat-card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th></th><th>Vehicle</th><th>Marketplace Price</th><th>Special Offer</th><th>Views</th><th>Inquiries</th><th>Listed</th><th></th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <MarketplaceRow
                  key={v.id}
                  vehicle={v}
                  editing={editingId === v.id}
                  onStartEdit={() => setEditingId(v.id)}
                  onStopEdit={() => setEditingId(null)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MarketplaceRow({
  vehicle: v, editing, onStartEdit, onStopEdit,
}: { vehicle: Vehicle; editing: boolean; onStartEdit: () => void; onStopEdit: () => void }) {
  const update = useUpdateVehicle(v.id);
  const [price, setPrice] = useState(String(v.price));
  const [discount, setDiscount] = useState(String(v.discount));
  const [desc, setDesc] = useState(v.description);
  const listed = v.hosting === "Platform";

  const toggleListed = async () => {
    const targetHosting = listed ? "self" : "platform";
    try {
      await update.mutateAsync({ hosting: targetHosting });
      toast({ title: listed ? "Removed from marketplace" : "Listed on marketplace", description: v.title });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Toggle failed";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    }
  };

  const saveEdits = async () => {
    try {
      await update.mutateAsync({
        price: parseFloat(price) || 0,
        discount: parseFloat(discount) || 0,
        description: desc,
      });
      toast({ title: "Listing updated", description: v.title });
      onStopEdit();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <tr>
      <td>
        {v.image.includes("/") ? (
          <img src={fileUrl(v.image)} alt="" className="h-10 w-14 object-cover rounded" />
        ) : (
          <span className="text-2xl">{v.image}</span>
        )}
      </td>
      <td>
        <p className="font-medium text-sm">{v.title}</p>
        {editing && (
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="mt-1 w-full border rounded px-2 py-1 text-xs bg-background"
          />
        )}
        {!editing && <p className="text-xs text-muted-foreground line-clamp-1">{v.description || "—"}</p>}
      </td>
      <td>
        {editing ? (
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" className="w-24 border rounded px-2 py-1 text-sm bg-background" />
        ) : (
          <span className="text-sm font-medium">${v.price.toLocaleString()}</span>
        )}
      </td>
      <td>
        {editing ? (
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" type="number" className="w-24 border rounded px-2 py-1 text-sm bg-background" />
        ) : (
          <span className="text-sm text-emerald-600">{v.discount > 0 ? `$${v.discount.toLocaleString()} off` : "—"}</span>
        )}
      </td>
      <td className="text-sm">{listed ? v.activity.views.toLocaleString() : "—"}</td>
      <td className="text-sm">{listed ? v.activity.inquiries : "—"}</td>
      <td>
        <label className="inline-flex items-center cursor-pointer" title="Listed = vehicle.hosting === 'Platform'">
          <input type="checkbox" checked={listed} onChange={toggleListed} disabled={update.isPending} className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-300 peer-checked:bg-primary rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </td>
      <td>
        {editing ? (
          <button onClick={saveEdits} disabled={update.isPending} className="p-1.5 rounded bg-emerald-100 text-emerald-700 disabled:opacity-60">
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button onClick={() => { setPrice(String(v.price)); setDiscount(String(v.discount)); setDesc(v.description); onStartEdit(); }} className="p-1.5 rounded hover:bg-muted">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function KpiCard({ icon: Icon, color, value, label }: { icon: typeof Store; color: string; value: string; label: string }) {
  return (
    <div className="stat-card">
      <div className={`p-2 rounded-lg w-fit mb-2 ${color}`}><Icon className="h-4 w-4" /></div>
      <p className="text-2xl font-bold font-display">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
