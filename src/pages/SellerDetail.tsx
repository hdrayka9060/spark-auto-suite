import { ArrowLeft, Mail, Phone, MessageCircle, MapPin, Calendar, TrendingUp, Car as CarIcon } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getSellerById } from "@/data/sellers";
import { getVehicleById } from "@/data/vehicles";

const vehicleStatusClass: Record<string, string> = {
  Sold: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Unsold: "bg-blue-100 text-blue-700",
};

export default function SellerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const seller = getSellerById(id ?? "");

  if (!seller) {
    return (
      <div className="text-center py-20">
        <p>Seller not found.</p>
        <button onClick={() => navigate("/crm-sellers")} className="mt-4 text-primary text-sm">Back to Sellers</button>
      </div>
    );
  }

  const back = () => navigate("/crm-sellers", { state: location.state });
  const totalListings = seller.vehiclesListed.length;

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={back} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Sellers
      </button>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Profile */}
        <div className="stat-card lg:col-span-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold">
              {seller.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">{seller.name}</h2>
              <p className="text-xs text-muted-foreground">{seller.id} · Joined {seller.joinedDate}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm border-t pt-3">
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {seller.email}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {seller.phone}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {seller.location}</p>
          </div>

          <div className="border-t pt-3 space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <Mail className="h-4 w-4" /> Send Email
            </button>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-sm"><Phone className="h-3.5 w-3.5" /> Call</button>
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>
            </div>
          </div>
        </div>

        {/* Stats + Lead summary */}
        <div className="lg:col-span-2 grid sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="p-2 rounded-lg w-fit bg-primary/10 text-primary mb-2"><CarIcon className="h-4 w-4" /></div>
            <p className="text-2xl font-bold font-display">{totalListings}</p>
            <p className="text-xs text-muted-foreground">Vehicles Listed</p>
          </div>
          <div className="stat-card">
            <div className="p-2 rounded-lg w-fit bg-amber-50 text-amber-600 mb-2"><TrendingUp className="h-4 w-4" /></div>
            <p className="text-2xl font-bold font-display">{seller.activeLeads}</p>
            <p className="text-xs text-muted-foreground">Active Leads</p>
          </div>
          <div className="stat-card">
            <div className="p-2 rounded-lg w-fit bg-violet-50 text-violet-600 mb-2"><TrendingUp className="h-4 w-4" /></div>
            <p className="text-2xl font-bold font-display">{seller.traffic}</p>
            <p className="text-xs text-muted-foreground">Listing Views</p>
          </div>
        </div>
      </div>

      {/* Vehicles */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">Vehicles Uploaded ({totalListings})</h3>
        {totalListings === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No vehicles listed yet</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th></th><th>Vehicle</th><th>Year</th><th>Price</th><th>Status</th><th>Inquiries</th><th></th></tr>
            </thead>
            <tbody>
              {seller.vehiclesListed.map((vid) => {
                const v = getVehicleById(vid);
                if (!v) return null;
                return (
                  <tr key={vid} onClick={() => navigate(`/inventory/${vid}`)} className="cursor-pointer">
                    <td className="text-2xl">{v.image}</td>
                    <td className="font-medium text-sm">{v.title}</td>
                    <td className="text-sm">{v.year}</td>
                    <td className="text-sm font-medium">${v.price.toLocaleString()}</td>
                    <td><span className={`status-badge ${vehicleStatusClass[v.status]}`}>{v.status}</span></td>
                    <td className="text-sm">{v.activity.inquiries}</td>
                    <td className="text-xs text-primary">View →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Calendar className="h-4 w-4" /> Activity Timeline</h3>
        <div className="space-y-3">
          {seller.activity.map((a, i) => (
            <div key={i} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
              <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{a.type}</p>
                  <p className="text-xs text-muted-foreground">{a.date}</p>
                </div>
                <p className="text-sm text-muted-foreground">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
