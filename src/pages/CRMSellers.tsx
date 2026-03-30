import { useState } from "react";
import { Search, Phone, Mail, MessageCircle, ChevronRight } from "lucide-react";

const stages = ["All", "New", "Contacted", "Inspection", "Negotiation", "Sold", "Rejected"];

const sellers = [
  { id: "S-001", name: "Robert Chen", phone: "555-0101", email: "robert@email.com", vehicle: "2022 Audi A4 Premium", stage: "Inspection", date: "2026-03-28", traffic: 142 },
  { id: "S-002", name: "Lisa Park", phone: "555-0102", email: "lisa@email.com", vehicle: "2021 Toyota RAV4 XLE", stage: "New", date: "2026-03-29", traffic: 0 },
  { id: "S-003", name: "David Martinez", phone: "555-0103", email: "david@email.com", vehicle: "2023 Honda Civic Sport", stage: "Negotiation", date: "2026-03-25", traffic: 89 },
  { id: "S-004", name: "Emily Walsh", phone: "555-0104", email: "emily@email.com", vehicle: "2020 BMW 330i", stage: "Contacted", date: "2026-03-27", traffic: 56 },
  { id: "S-005", name: "James Kim", phone: "555-0105", email: "james@email.com", vehicle: "2024 Ford Bronco Sport", stage: "Sold", date: "2026-03-20", traffic: 310 },
  { id: "S-006", name: "Maria Garcia", phone: "555-0106", email: "maria@email.com", vehicle: "2019 Nissan Altima", stage: "Rejected", date: "2026-03-22", traffic: 45 },
];

const stageColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-purple-100 text-purple-700",
  Inspection: "bg-amber-100 text-amber-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Sold: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

export default function CRMSellers() {
  const [stage, setStage] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = sellers.filter(
    (s) => (stage === "All" || s.stage === stage) && s.name.toLowerCase().includes(search.toLowerCase())
  );

  const detail = sellers.find((s) => s.id === selected);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">CRM – Sellers</h1>
          <p className="text-muted-foreground text-sm">Manage customers who want to sell vehicles</p>
        </div>
      </div>

      {/* Stage Pipeline */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {stages.map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              stage === s ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"
            }`}
          >
            {s} {s !== "All" && <span className="ml-1 opacity-70">({sellers.filter((x) => x.stage === s).length})</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sellers..." className="bg-transparent text-sm outline-none w-full" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* List */}
        <div className="lg:col-span-2 stat-card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Vehicle</th>
                <th>Stage</th>
                <th>Traffic</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className={`cursor-pointer ${selected === s.id ? "bg-primary/5" : ""}`} onClick={() => setSelected(s.id)}>
                  <td>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </td>
                  <td className="text-sm">{s.vehicle}</td>
                  <td><span className={`status-badge ${stageColors[s.stage]}`}>{s.stage}</span></td>
                  <td className="text-sm">{s.traffic} views</td>
                  <td className="text-xs text-muted-foreground">{s.date}</td>
                  <td><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        <div className="stat-card">
          {detail ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-display font-semibold text-lg">{detail.name}</h3>
                <p className="text-sm text-muted-foreground">{detail.email}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Vehicle:</span> {detail.vehicle}</p>
                <p><span className="text-muted-foreground">Stage:</span> <span className={`status-badge ${stageColors[detail.stage]}`}>{detail.stage}</span></p>
                <p><span className="text-muted-foreground">Listing Traffic:</span> {detail.traffic} views</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">COMMUNICATE</p>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80"><Mail className="h-3.5 w-3.5" /> Email</button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80"><Phone className="h-3.5 w-3.5" /> Call</button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm hover:opacity-80"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
                </div>
              </div>
              <div className="border-t pt-4 flex gap-2">
                <button className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Accept Lead</button>
                <button className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-muted">Reject</button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <p className="text-sm">Select a seller to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
