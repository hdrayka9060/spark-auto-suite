import { useState } from "react";
import { Globe, ExternalLink, Edit2, Check, Search, Loader2, AlertCircle } from "lucide-react";
import { useUpdateVehicle, useVehicles } from "@/hooks/api/use-vehicles";
import { ApiError, fileUrl } from "@/lib/api";
import { Vehicle } from "@/lib/vehicle-mapper";
import { toast } from "@/hooks/use-toast";
import { useCan } from "@/components/Can";

/**
 * The "Published on Website" state is derived from vehicle.status:
 *   - status === "Unsold"  ⇒ visible on the public dealer site (`/api/v1/website/inventory` returns unsold only)
 *   - everything else       ⇒ hidden (Pending = reserved, Sold = sold)
 * Toggling the switch flips between Unsold and Pending.
 */

export default function DealerWebsite() {
  const [tab, setTab] = useState<"manage" | "preview">("manage");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const vehiclesQuery = useVehicles({ search, limit: 100 });
  const vehicles = vehiclesQuery.data?.data ?? [];
  const filtered = vehicles;
  const publishedVehicles = vehicles.filter((v) => v.status === "Unsold");

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dealer Website</h1>
          <p className="text-muted-foreground text-sm">Control which vehicles appear on your public website</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          onClick={() => toast({ title: "Public site URL", description: "Wire your domain to the backend's /api/v1/website/inventory endpoint." })}>
          <ExternalLink className="h-4 w-4" /> Visit Live Site
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-2xl font-bold font-display">{vehiclesQuery.isLoading ? "…" : vehicles.length}</p>
          <p className="text-xs text-muted-foreground">Total inventory</p>
        </div>
        <div className="stat-card">
          <p className="text-2xl font-bold font-display text-emerald-600">{publishedVehicles.length}</p>
          <p className="text-xs text-muted-foreground">Published on website</p>
        </div>
        <div className="stat-card">
          <p className="text-2xl font-bold font-display text-muted-foreground">{vehicles.length - publishedVehicles.length}</p>
          <p className="text-xs text-muted-foreground">Hidden</p>
        </div>
      </div>

      <div className="flex gap-1 bg-card border rounded-lg p-1 w-fit">
        <button onClick={() => setTab("manage")} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "manage" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Manage Listings</button>
        <button onClick={() => setTab("preview")} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "preview" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Website Preview</button>
      </div>

      {tab === "manage" && (
        <>
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

          {!vehiclesQuery.isLoading && filtered.length === 0 && (
            <div className="stat-card text-center py-12 text-muted-foreground">No vehicles found.</div>
          )}

          {filtered.length > 0 && (
            <div className="stat-card overflow-x-auto">
              <table className="data-table">
                <thead><tr><th></th><th>Vehicle</th><th>Website Price</th><th>Offer</th><th>Description</th><th>Published</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((v) => (
                    <DealerWebsiteRow
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
        </>
      )}

      {tab === "preview" && (
        <div className="stat-card">
          <div className="bg-muted rounded-lg p-1 mb-4 flex items-center gap-2">
            <div className="flex gap-1.5 ml-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 bg-background rounded px-3 py-1 text-xs text-muted-foreground">https://your-dealership.com</div>
          </div>

          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-8 text-primary-foreground mb-6">
            <h2 className="font-display text-3xl font-bold mb-2">Find Your Dream Car</h2>
            <p className="opacity-90">Browse {publishedVehicles.length} quality vehicles</p>
          </div>

          <h3 className="font-display font-semibold text-lg mb-3">Featured Vehicles ({publishedVehicles.length})</h3>
          {publishedVehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No vehicles published yet. Toggle "Published" on the Manage tab.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {publishedVehicles.map((v) => (
                <PreviewCard key={v.id} vehicle={v} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DealerWebsiteRow({
  vehicle: v, editing, onStartEdit, onStopEdit,
}: { vehicle: Vehicle; editing: boolean; onStartEdit: () => void; onStopEdit: () => void }) {
  const update = useUpdateVehicle(v.id);
  const canEdit = useCan("Dealer Website", "edit");
  const [price, setPrice] = useState(String(v.price));
  const [discount, setDiscount] = useState(String(v.discount));
  const [desc, setDesc] = useState(v.description);
  const published = v.status === "Unsold";

  const togglePublish = async () => {
    const targetStatus = published ? "pending" : "unsold";
    try {
      await update.mutateAsync({ status: targetStatus });
      toast({ title: published ? "Hidden from website" : "Published to website", description: v.title });
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
        <p className="text-xs text-muted-foreground">{v.year} · {v.km.toLocaleString()} km</p>
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
      <td className="max-w-xs">
        {editing ? (
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-xs bg-background" />
        ) : (
          <p className="text-xs text-muted-foreground line-clamp-2">{v.description || "—"}</p>
        )}
      </td>
      <td>
        <label className="inline-flex items-center cursor-pointer" title="Published = visible on public website (status: Unsold)">
          <input type="checkbox" checked={published} onChange={togglePublish} disabled={!canEdit || update.isPending} className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-300 peer-checked:bg-primary rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
        </label>
      </td>
      <td>
        {canEdit && (editing ? (
          <button onClick={saveEdits} disabled={update.isPending} className="p-1.5 rounded bg-emerald-100 text-emerald-700 disabled:opacity-60">
            {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button onClick={() => { setPrice(String(v.price)); setDiscount(String(v.discount)); setDesc(v.description); onStartEdit(); }} className="p-1.5 rounded hover:bg-muted">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        ))}
      </td>
    </tr>
  );
}

function PreviewCard({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <div className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-muted h-32 flex items-center justify-center text-5xl relative overflow-hidden">
        {v.image.includes("/") ? (
          <img src={fileUrl(v.image)} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          v.image
        )}
        {v.discount > 0 && (
          <span className="absolute top-2 right-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded">
            ${v.discount.toLocaleString()} off
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-sm truncate">{v.title}</p>
        <p className="text-xs text-muted-foreground">{v.km.toLocaleString()} km · {v.year}</p>
        <p className="font-display font-bold text-primary mt-1">${v.price.toLocaleString()}</p>
      </div>
    </div>
  );
}
