import { useState } from "react";
import { Plus, Paperclip, Search, MessageSquare } from "lucide-react";

const tickets = [
  { id: "SUP-210", subject: "Title transfer delay", customer: "Michael Brown", priority: "High", status: "Open", date: "2026-03-29", messages: 3 },
  { id: "SUP-209", subject: "Warranty claim on 2023 Honda Accord", customer: "Amanda Taylor", priority: "Medium", status: "Resolved", date: "2026-03-27", messages: 5 },
  { id: "SUP-208", subject: "Financing rate discrepancy", customer: "Tony Ramirez", priority: "High", status: "In Progress", date: "2026-03-26", messages: 4 },
  { id: "SUP-207", subject: "Vehicle delivery scheduling", customer: "Chris Johnson", priority: "Low", status: "Open", date: "2026-03-25", messages: 2 },
  { id: "SUP-206", subject: "Missing vehicle documentation", customer: "Sarah Mitchell", priority: "Medium", status: "In Progress", date: "2026-03-24", messages: 6 },
];

const priorityColors: Record<string, string> = { High: "bg-red-100 text-red-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-blue-100 text-blue-700" };

const threadMessages = [
  { from: "Michael Brown", role: "Customer", time: "Mar 29, 10:15 AM", text: "Hi, I purchased a vehicle last week and haven't received the title transfer documents yet. Can you please check on this?" },
  { from: "John Dealer", role: "Agent", time: "Mar 29, 10:45 AM", text: "Hi Michael, thanks for reaching out. I'm looking into this now. The DMV processing usually takes 5-7 business days." },
  { from: "Michael Brown", role: "Customer", time: "Mar 29, 11:20 AM", text: "It's already been 8 business days. I need these documents urgently for my insurance." },
];

export default function Support() {
  const [selected, setSelected] = useState("SUP-210");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = tickets.filter((t) => t.subject.toLowerCase().includes(search.toLowerCase()) || t.id.includes(search));
  const detail = tickets.find((t) => t.id === selected);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Support</h1>
          <p className="text-muted-foreground text-sm">Ticket management and customer support</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      {showNew && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">Raise a Ticket</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input placeholder="Subject" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select className="border rounded-lg px-3 py-2 text-sm bg-background"><option>High</option><option>Medium</option><option>Low</option></select>
          </div>
          <textarea placeholder="Describe the issue..." className="w-full border rounded-lg px-3 py-2 text-sm bg-background" rows={3} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground"><Paperclip className="h-4 w-4" /> Attach files</div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Submit Ticket</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="bg-transparent text-sm outline-none w-full" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 stat-card space-y-1 max-h-[500px] overflow-y-auto">
          {filtered.map((t) => (
            <div key={t.id} onClick={() => setSelected(t.id)} className={`p-3 rounded-lg cursor-pointer transition-colors ${selected === t.id ? "bg-primary/5 border border-primary/20" : "hover:bg-muted"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                <span className={`status-badge ${t.status === "Open" ? "open" : t.status === "In Progress" ? "in-progress" : "resolved"}`}>{t.status}</span>
              </div>
              <p className="text-sm font-medium">{t.subject}</p>
              <p className="text-xs text-muted-foreground">{t.customer} · {t.date}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 stat-card">
          {detail ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold">{detail.subject}</h3>
                  <p className="text-sm text-muted-foreground">{detail.customer} · {detail.id}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`status-badge ${priorityColors[detail.priority]}`}>{detail.priority}</span>
                  <span className={`status-badge ${detail.status === "Open" ? "open" : detail.status === "In Progress" ? "in-progress" : "resolved"}`}>{detail.status}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                {threadMessages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "Agent" ? "flex-row-reverse" : ""}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${m.role === "Agent" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.from.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className={`max-w-[70%] ${m.role === "Agent" ? "text-right" : ""}`}>
                      <div className={`p-3 rounded-xl text-sm ${m.role === "Agent" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>{m.text}</div>
                      <p className="text-[10px] text-muted-foreground mt-1">{m.from} · {m.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 flex gap-2">
                <input placeholder="Type a reply..." className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background" />
                <button className="p-2 hover:bg-muted rounded-lg"><Paperclip className="h-4 w-4" /></button>
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">Send</button>
              </div>
            </div>
          ) : <div className="text-center text-muted-foreground py-12 text-sm">Select a ticket</div>}
        </div>
      </div>
    </div>
  );
}
