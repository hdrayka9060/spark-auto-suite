import { useState } from "react";
import { Globe, ExternalLink, Eye, Edit2, Check, X, Search } from "lucide-react";
import { vehicles } from "@/data/vehicles";

export default function DealerWebsite() {
  const [tab, setTab] = useState<"manage" | "preview">("manage");
  const [published, setPublished] = useState<Record<string, boolean>>(
    Object.fromEntries(vehicles.map((v) => [v.id, v.status !== "Sold"]))
  );
  const [overrides, setOverrides] = useState<Record<string, { price: number; description: string; offer: string }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const togglePublish = (id: string) => setPublished((p) => ({ ...p, [id]: !p[id] }));
  const filtered = vehicles.filter((v) => v.title.toLowerCase().includes(search.toLowerCase()));
  const publishedVehicles = vehicles.filter((v) => published[v.id]);

  const getPrice = (id: string) => overrides[id]?.price ?? vehicles.find((v) => v.id === id)!.price;
  const getDesc = (id: string) => overrides[id]?.description ?? vehicles.find((v) => v.id === id)!.description;
  const getOffer = (id: string) => overrides[id]?.offer ?? "";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dealer Website</h1>
          <p className="text-muted-foreground text-sm">Control which vehicles appear on your public website</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <ExternalLink className="h-4 w-4" /> Visit Live Site
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-2xl font-bold font-display">{vehicles.length}</p><p className="text-xs text-muted-foreground">Total inventory</p></div>
        <div className="stat-card"><p className="text-2xl font-bold font-display text-emerald-600">{publishedVehicles.length}</p><p className="text-xs text-muted-foreground">Published on website</p></div>
        <div className="stat-card"><p className="text-2xl font-bold font-display text-muted-foreground">{vehicles.length - publishedVehicles.length}</p><p className="text-xs text-muted-foreground">Hidden</p></div>
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

          <div className="stat-card overflow-x-auto">
            <table className="data-table">
              <thead><tr><th></th><th>Vehicle</th><th>Website Price</th><th>Offer / Discount</th><th>Description</th><th>Published</th><th></th></tr></thead>
              <tbody>
                {filtered.map((v) => {
                  const isEditing = editing === v.id;
                  return (
                    <tr key={v.id}>
                      <td className="text-2xl">{v.image}</td>
                      <td><p className="font-medium text-sm">{v.title}</p><p className="text-xs text-muted-foreground">{v.year} · {v.km.toLocaleString()} km</p></td>
                      <td>
                        {isEditing ? (
                          <input type="number" defaultValue={getPrice(v.id)} onBlur={(e) => setOverrides((o) => ({ ...o, [v.id]: { ...(o[v.id] ?? { description: getDesc(v.id), offer: getOffer(v.id) }), price: Number(e.target.value) } }))} className="w-24 border rounded px-2 py-1 text-sm bg-background" />
                        ) : <span className="text-sm font-medium">${getPrice(v.id).toLocaleString()}</span>}
                      </td>
                      <td>
                        {isEditing ? (
                          <input placeholder="e.g. $1,000 off" defaultValue={getOffer(v.id)} onBlur={(e) => setOverrides((o) => ({ ...o, [v.id]: { ...(o[v.id] ?? { price: getPrice(v.id), description: getDesc(v.id) }), offer: e.target.value } }))} className="w-32 border rounded px-2 py-1 text-sm bg-background" />
                        ) : <span className="text-sm text-emerald-600">{getOffer(v.id) || "—"}</span>}
                      </td>
                      <td className="max-w-xs">
                        {isEditing ? (
                          <textarea defaultValue={getDesc(v.id)} onBlur={(e) => setOverrides((o) => ({ ...o, [v.id]: { ...(o[v.id] ?? { price: getPrice(v.id), offer: getOffer(v.id) }), description: e.target.value } }))} rows={2} className="w-full border rounded px-2 py-1 text-xs bg-background" />
                        ) : <p className="text-xs text-muted-foreground line-clamp-2">{getDesc(v.id)}</p>}
                      </td>
                      <td>
                        <label className="inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={!!published[v.id]} onChange={() => togglePublish(v.id)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-gray-300 peer-checked:bg-primary rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                        </label>
                      </td>
                      <td>
                        {isEditing ? (
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded bg-emerald-100 text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
                        ) : (
                          <button onClick={() => setEditing(v.id)} className="p-1.5 rounded hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "preview" && (
        <div className="stat-card">
          <div className="bg-muted rounded-lg p-1 mb-4 flex items-center gap-2">
            <div className="flex gap-1.5 ml-2"><span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div>
            <div className="flex-1 bg-background rounded px-3 py-1 text-xs text-muted-foreground">https://autodealer.com</div>
          </div>

          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-8 text-primary-foreground mb-6">
            <h2 className="font-display text-3xl font-bold mb-2">Find Your Dream Car</h2>
            <p className="opacity-90">Browse {publishedVehicles.length} quality vehicles</p>
          </div>

          <h3 className="font-display font-semibold text-lg mb-3">Featured Vehicles ({publishedVehicles.length})</h3>
          {publishedVehicles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Globe className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No vehicles published yet</p></div>
          ) : (
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {publishedVehicles.map((v) => (
                <div key={v.id} className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="bg-muted h-32 flex items-center justify-center text-5xl relative">
                    {v.image}
                    {getOffer(v.id) && <span className="absolute top-2 right-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded">{getOffer(v.id)}</span>}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.km.toLocaleString()} km · {v.year}</p>
                    <p className="font-display font-bold text-primary mt-1">${getPrice(v.id).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
