import { useState } from "react";
import { Search, Eye, CalendarDays, MessageCircle, Phone } from "lucide-react";

const buyers = [
  { id: "B-001", name: "Sarah Mitchell", email: "sarah@email.com", phone: "555-0201", interested: "2024 Tesla Model 3", testDrive: "Scheduled", date: "2026-03-30", history: 2 },
  { id: "B-002", name: "Michael Brown", email: "mike@email.com", phone: "555-0202", interested: "2024 BMW X5", testDrive: "Completed", date: "2026-03-28", history: 1 },
  { id: "B-003", name: "Jennifer Lee", email: "jen@email.com", phone: "555-0203", interested: "2023 Audi Q7", testDrive: "None", date: "2026-03-29", history: 0 },
  { id: "B-004", name: "Chris Johnson", email: "chris@email.com", phone: "555-0204", interested: "2022 Ford F-150", testDrive: "Scheduled", date: "2026-03-31", history: 3 },
  { id: "B-005", name: "Amanda Taylor", email: "amanda@email.com", phone: "555-0205", interested: "2023 Toyota Camry", testDrive: "Completed", date: "2026-03-25", history: 1 },
];

const testDriveColors: Record<string, string> = {
  Scheduled: "bg-amber-100 text-amber-700",
  Completed: "bg-emerald-100 text-emerald-700",
  None: "bg-gray-100 text-gray-600",
};

export default function CRMBuyers() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>("B-001");

  const filtered = buyers.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  const detail = buyers.find((b) => b.id === selected);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">CRM – Buyers</h1>
          <p className="text-muted-foreground text-sm">Manage customers who want to buy vehicles</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyers..." className="bg-transparent text-sm outline-none w-full" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 stat-card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Buyer</th><th>Interested In</th><th>Test Drive</th><th>Past Purchases</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className={`cursor-pointer ${selected === b.id ? "bg-primary/5" : ""}`} onClick={() => setSelected(b.id)}>
                  <td>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.email}</p>
                  </td>
                  <td className="text-sm">{b.interested}</td>
                  <td><span className={`status-badge ${testDriveColors[b.testDrive]}`}>{b.testDrive}</span></td>
                  <td className="text-sm">{b.history}</td>
                  <td className="text-xs text-muted-foreground">{b.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stat-card">
          {detail ? (
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-lg">{detail.name}</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Email:</span> {detail.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {detail.phone}</p>
                <p><span className="text-muted-foreground">Interested In:</span> {detail.interested}</p>
                <p><span className="text-muted-foreground">Test Drive:</span> <span className={`status-badge ${testDriveColors[detail.testDrive]}`}>{detail.testDrive}</span></p>
              </div>
              <div className="border-t pt-4 space-y-2">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                  <CalendarDays className="h-4 w-4" /> Book Test Drive
                </button>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm"><Eye className="h-3.5 w-3.5" /> View Details</button>
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm"><Phone className="h-3.5 w-3.5" /> Call</button>
                </div>
                <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12 text-sm">Select a buyer to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
