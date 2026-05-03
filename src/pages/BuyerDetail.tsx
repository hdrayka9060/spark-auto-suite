import { ArrowLeft, Mail, Phone, MessageCircle, CalendarDays, Eye, ShoppingBag } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getBuyerById } from "@/data/buyers";
import { getVehicleById } from "@/data/vehicles";

const statusColors: Record<string, string> = {
  Active: "bg-blue-100 text-blue-700",
  Converted: "bg-emerald-100 text-emerald-700",
  Dropped: "bg-gray-100 text-gray-600",
};

const channelColors: Record<string, string> = {
  Call: "bg-blue-100 text-blue-700",
  Email: "bg-violet-100 text-violet-700",
  WhatsApp: "bg-emerald-100 text-emerald-700",
  SMS: "bg-amber-100 text-amber-700",
};

export default function BuyerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const buyer = getBuyerById(id ?? "");

  if (!buyer) return <div className="text-center py-20"><p>Buyer not found.</p><button onClick={() => navigate("/crm-buyers")} className="mt-4 text-primary text-sm">Back</button></div>;

  const back = () => navigate("/crm-buyers", { state: location.state });

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={back} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Buyers
      </button>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="stat-card lg:col-span-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-lg font-semibold">
              {buyer.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">{buyer.name}</h2>
              <p className="text-xs text-muted-foreground">{buyer.id}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm border-t pt-3">
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {buyer.email}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {buyer.phone}</p>
            <p>Lead Status: <span className={`status-badge ${statusColors[buyer.status]}`}>{buyer.status}</span></p>
          </div>
          <div className="border-t pt-3 space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <CalendarDays className="h-4 w-4" /> Book Test Drive
            </button>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm"><Phone className="h-3.5 w-3.5" /> Call</button>
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 grid sm:grid-cols-3 gap-4">
          <div className="stat-card"><div className="p-2 rounded-lg w-fit bg-blue-50 text-blue-600 mb-2"><Eye className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">{buyer.viewed.length}</p><p className="text-xs text-muted-foreground">Vehicles Viewed</p></div>
          <div className="stat-card"><div className="p-2 rounded-lg w-fit bg-amber-50 text-amber-600 mb-2"><CalendarDays className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">{buyer.testDrives.length}</p><p className="text-xs text-muted-foreground">Test Drives Booked</p></div>
          <div className="stat-card"><div className="p-2 rounded-lg w-fit bg-emerald-50 text-emerald-600 mb-2"><ShoppingBag className="h-4 w-4" /></div><p className="text-2xl font-bold font-display">{buyer.purchases.length}</p><p className="text-xs text-muted-foreground">Purchased</p></div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Vehicles viewed */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Vehicles Viewed</h3>
          <div className="space-y-2">
            {buyer.viewed.map((vid) => {
              const v = getVehicleById(vid);
              if (!v) return null;
              return (
                <div key={vid} onClick={() => navigate(`/inventory/${vid}`)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                  <div className="text-2xl">{v.image}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">${v.price.toLocaleString()} · {v.year}</p>
                  </div>
                  <span className="text-xs text-primary">View →</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Test Drives */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Test Drives & Purchases</h3>
          <div className="space-y-2">
            {buyer.testDrives.map((t, i) => {
              const v = getVehicleById(t.vehicleId);
              return (
                <div key={i} className="flex items-center gap-3 p-2 border rounded-lg">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{v?.title ?? t.vehicleId}</p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span className="status-badge bg-blue-100 text-blue-700">{t.status}</span>
                </div>
              );
            })}
            {buyer.purchases.map((vid) => {
              const v = getVehicleById(vid);
              return (
                <div key={vid} className="flex items-center gap-3 p-2 border rounded-lg bg-emerald-50/50">
                  <ShoppingBag className="h-4 w-4 text-emerald-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{v?.title}</p>
                    <p className="text-xs text-muted-foreground">Purchased</p>
                  </div>
                  <span className="status-badge bg-emerald-100 text-emerald-700">Sold</span>
                </div>
              );
            })}
            {buyer.testDrives.length === 0 && buyer.purchases.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No bookings yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Communication History */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Communication History</h3>
        <div className="space-y-3">
          {buyer.communications.map((c, i) => (
            <div key={i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
              <span className={`status-badge ${channelColors[c.channel]} h-fit`}>{c.channel}</span>
              <div className="flex-1">
                <p className="text-sm">{c.summary}</p>
                <p className="text-xs text-muted-foreground">{c.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
