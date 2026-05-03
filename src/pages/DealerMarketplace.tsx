import { useState } from "react";
import { Store, Eye, Users, TrendingUp, Edit2, Check, Search, ExternalLink } from "lucide-react";
import { vehicles } from "@/data/vehicles";

export default function DealerMarketplace() {
  const [listed, setListed] = useState<Record<string, boolean>>(
    Object.fromEntries(vehicles.map((v, i) => [v.id, i % 2 === 0]))
  );
  const [overrides, setOverrides] = useState<Record<string, { price: number; description: string; offer: string }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = vehicles.filter((v) => v.title.toLowerCase().includes(search.toLowerCase()));
  const listedCount = Object.values(listed).filter(Boolean).length;

  // Generate mock performance per vehicle (deterministic-ish)
  const perf = (id: string) => {
    const seed = id.charCodeAt(id.length - 1);
    return { views: 80 + seed * 13, leads: 2 + (seed % 8) };
  };

  const totalViews = vehicles.reduce((acc, v) => acc + (listed[v.id] ? perf(v.id).views : 0), 0);
  const totalLeads = vehicles.reduce((acc, v) => acc + (listed[v.id] ? perf(v.id).leads : 0), 0);

  const getPrice = (id: string) => overrides[id]?.price ?? vehicles.find((v) => v.id === id)!.price;
  const getDesc = (id: string) => overrides[id]?.description ?? vehicles.find((v) => v.id === id)!.description;
  const getOffer = (id: string) => overrides[id]?.offer ?? "";

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Dealer Marketplace</h1>
          <p className="text-muted-foreground text-sm">Publish vehicles to the third-party marketplace</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <ExternalLink className="h-4 w-4" /> View on Marketplace
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card"><div className="p-2 rounded-lg w-fit bg-primary/10 text-primary mb-2"><Store className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">{listedCount}</p><p className="text-xs text-muted-foreground">Listed on Marketplace</p></div>
        <div className="stat-card"><div className="p-2 rounded-lg w-fit bg-blue-50 text-blue-600 mb-2"><Eye className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">{totalViews.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Views (30d)</p></div>
        <div className="stat-card"><div className="p-2 rounded-lg w-fit bg-amber-50 text-amber-600 mb-2"><Users className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">{totalLeads}</p><p className="text-xs text-muted-foreground">Marketplace Leads</p></div>
        <div className="stat-card"><div className="p-2 rounded-lg w-fit bg-emerald-50 text-emerald-600 mb-2"><TrendingUp className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">{((totalLeads / Math.max(totalViews, 1)) * 100).toFixed(2)}%</p><p className="text-xs text-muted-foreground">Conversion Rate</p></div>
      </div>

      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicles..." className="bg-transparent text-sm outline-none w-full" />
      </div>

      <div className="stat-card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th></th><th>Vehicle</th><th>Marketplace Price</th><th>Special Offer</th><th>Views</th><th>Leads</th><th>Listed</th><th></th></tr></thead>
          <tbody>
            {filtered.map((v) => {
              const isEditing = editing === v.id;
              const p = perf(v.id);
              return (
                <tr key={v.id}>
                  <td className="text-2xl">{v.image}</td>
                  <td><p className="font-medium text-sm">{v.title}</p>
                    {isEditing && <textarea defaultValue={getDesc(v.id)} onBlur={(e) => setOverrides((o) => ({ ...o, [v.id]: { ...(o[v.id] ?? { price: getPrice(v.id), offer: getOffer(v.id) }), description: e.target.value } }))} rows={2} className="mt-1 w-full border rounded px-2 py-1 text-xs bg-background" />}
                  </td>
                  <td>
                    {isEditing ? (
                      <input type="number" defaultValue={getPrice(v.id)} onBlur={(e) => setOverrides((o) => ({ ...o, [v.id]: { ...(o[v.id] ?? { description: getDesc(v.id), offer: getOffer(v.id) }), price: Number(e.target.value) } }))} className="w-24 border rounded px-2 py-1 text-sm bg-background" />
                    ) : <span className="text-sm font-medium">${getPrice(v.id).toLocaleString()}</span>}
                  </td>
                  <td>
                    {isEditing ? (
                      <input placeholder="e.g. Free Service" defaultValue={getOffer(v.id)} onBlur={(e) => setOverrides((o) => ({ ...o, [v.id]: { ...(o[v.id] ?? { price: getPrice(v.id), description: getDesc(v.id) }), offer: e.target.value } }))} className="w-32 border rounded px-2 py-1 text-sm bg-background" />
                    ) : <span className="text-sm text-emerald-600">{getOffer(v.id) || "—"}</span>}
                  </td>
                  <td className="text-sm">{listed[v.id] ? p.views : "—"}</td>
                  <td className="text-sm">{listed[v.id] ? p.leads : "—"}</td>
                  <td>
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={!!listed[v.id]} onChange={() => setListed((l) => ({ ...l, [v.id]: !l[v.id] }))} className="sr-only peer" />
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
    </div>
  );
}
