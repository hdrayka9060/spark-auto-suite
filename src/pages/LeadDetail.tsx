import { useState } from "react";
import { ArrowLeft, Mail, Phone, MessageCircle, User } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getLeadById, staffNames } from "@/data/leads";
import { getBuyerById } from "@/data/buyers";
import { getVehicleById } from "@/data/vehicles";

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-purple-100 text-purple-700",
  "Test Drive": "bg-amber-100 text-amber-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Closed: "bg-emerald-100 text-emerald-700",
};

const channelColors: Record<string, string> = {
  Call: "bg-blue-100 text-blue-700",
  Email: "bg-violet-100 text-violet-700",
  WhatsApp: "bg-emerald-100 text-emerald-700",
  SMS: "bg-amber-100 text-amber-700",
};

const allStatuses = ["New", "Contacted", "Test Drive", "Negotiation", "Closed"] as const;

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const lead = getLeadById(id ?? "");
  const [status, setStatus] = useState(lead?.status ?? "New");
  const [assignee, setAssignee] = useState(lead?.assignedTo ?? "");

  if (!lead) return <div className="text-center py-20"><p>Lead not found.</p><button onClick={() => navigate("/leads")} className="mt-4 text-primary text-sm">Back</button></div>;

  const buyer = getBuyerById(lead.buyerId);
  const vehicle = getVehicleById(lead.vehicleId);
  const back = () => navigate("/leads", { state: location.state });

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={back} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </button>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-muted-foreground">{lead.id}</p>
          <h1 className="module-title">{lead.buyerName} – {lead.vehicleTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">Created {lead.createdAt} · Source: {lead.source}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-badge ${statusColors[status]}`}>{status}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Buyer */}
        <div className="stat-card space-y-3">
          <h3 className="font-display font-semibold text-sm uppercase text-muted-foreground tracking-wide">Buyer</h3>
          {buyer ? (
            <>
              <p className="font-medium">{buyer.name}</p>
              <div className="text-sm space-y-1">
                <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {buyer.email}</p>
                <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {buyer.phone}</p>
              </div>
              <button onClick={() => navigate(`/crm-buyers/${buyer.id}`)} className="w-full text-xs text-primary text-left hover:underline">View buyer profile →</button>
            </>
          ) : <p className="text-sm text-muted-foreground">Buyer not found</p>}
        </div>

        {/* Vehicle */}
        <div className="stat-card space-y-3">
          <h3 className="font-display font-semibold text-sm uppercase text-muted-foreground tracking-wide">Vehicle</h3>
          {vehicle ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{vehicle.image}</span>
                <div>
                  <p className="font-medium">{vehicle.title}</p>
                  <p className="text-xs text-muted-foreground">${vehicle.price.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => navigate(`/inventory/${vehicle.id}`)} className="w-full text-xs text-primary text-left hover:underline">View vehicle details →</button>
            </>
          ) : <p className="text-sm text-muted-foreground">Vehicle not found</p>}
        </div>

        {/* Update */}
        <div className="stat-card space-y-3">
          <h3 className="font-display font-semibold text-sm uppercase text-muted-foreground tracking-wide">Update Lead</h3>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-background">
              {allStatuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Assigned Staff</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-background">
              {staffNames.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90">Save Changes</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Timeline */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Timeline</h3>
          <div className="space-y-3">
            {lead.timeline.map((t, i) => (
              <div key={i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.action}</p>
                  <p className="text-xs text-muted-foreground">{t.date} · {t.by}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Communication */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Communication Log</h3>
          <div className="space-y-3">
            {lead.log.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No messages yet</p>}
            {lead.log.map((c, i) => (
              <div key={i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                <span className={`status-badge ${channelColors[c.channel]} h-fit`}>{c.channel}</span>
                <div className="flex-1">
                  <p className="text-sm">{c.summary}</p>
                  <p className="text-xs text-muted-foreground">{c.date}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 mt-4 flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm"><Mail className="h-3.5 w-3.5" /> Email</button>
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm"><Phone className="h-3.5 w-3.5" /> Call</button>
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-3">Notes</h3>
        <textarea defaultValue={lead.notes} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" rows={3} />
      </div>
    </div>
  );
}
