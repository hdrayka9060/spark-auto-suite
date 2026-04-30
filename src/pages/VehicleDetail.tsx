import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft, Edit, Trash2, CheckCircle2, ChevronLeft, ChevronRight,
  Eye, MessageSquare, Car, Heart, Calendar, Gauge, Fuel, Settings as SettingsIcon,
  Palette, Hash, Users, History, Activity,
} from "lucide-react";
import { getVehicleById } from "@/data/vehicles";
import { toast } from "@/hooks/use-toast";

const statusClass: Record<string, string> = {
  Sold: "sold",
  Pending: "pending",
  Unsold: "unsold",
};

type TabKey = "overview" | "details" | "history" | "activity";

export default function VehicleDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const vehicle = getVehicleById(id);
  const [tab, setTab] = useState<TabKey>("overview");
  const [imageIdx, setImageIdx] = useState(0);

  if (!vehicle) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => navigate("/inventory")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </button>
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">Vehicle not found.</p>
        </div>
      </div>
    );
  }

  const goBack = () => {
    navigate("/inventory", { state: location.state });
  };

  const finalPrice = vehicle.price - vehicle.discount;
  const tabs: { key: TabKey; label: string; icon: typeof Eye }[] = [
    { key: "overview", label: "Overview", icon: Car },
    { key: "details", label: "Details", icon: SettingsIcon },
    { key: "history", label: "History", icon: History },
    { key: "activity", label: "Activity", icon: Activity },
  ];

  const prevImage = () => setImageIdx((i) => (i - 1 + vehicle.gallery.length) % vehicle.gallery.length);
  const nextImage = () => setImageIdx((i) => (i + 1) % vehicle.gallery.length);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top breadcrumb + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => toast({ title: "Edit Vehicle", description: `Editing ${vehicle.id}` })}
            className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <Edit className="h-4 w-4" /> Edit Vehicle
          </button>
          <button
            onClick={() => toast({ title: "Marked as Sold", description: `${vehicle.title} status updated` })}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" /> Mark as Sold
          </button>
          <button
            onClick={() => {
              toast({ title: "Vehicle deleted", description: `${vehicle.id} removed`, variant: "destructive" });
              goBack();
            }}
            className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Gallery */}
        <div className="lg:col-span-3 stat-card p-0 overflow-hidden">
          <div className="relative aspect-[16/10] bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center">
            <span className="text-[160px] leading-none select-none">{vehicle.gallery[imageIdx]}</span>
            {vehicle.gallery.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-card/90 border rounded-full px-2.5 py-1 text-xs font-medium">
                  {imageIdx + 1} / {vehicle.gallery.length}
                </div>
              </>
            )}
          </div>
          {vehicle.gallery.length > 1 && (
            <div className="flex gap-2 p-3 border-t overflow-x-auto">
              {vehicle.gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setImageIdx(i)}
                  className={`shrink-0 h-16 w-20 rounded-lg border flex items-center justify-center text-3xl transition-colors ${
                    i === imageIdx ? "border-primary ring-2 ring-primary/20 bg-muted" : "hover:bg-muted"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="lg:col-span-2 stat-card space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Hash className="h-3 w-3" /> {vehicle.id} · VIN {vehicle.vin}
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-display mt-1">{vehicle.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`status-badge ${statusClass[vehicle.status]}`}>{vehicle.status}</span>
              <span className="text-xs text-muted-foreground">Hosting: {vehicle.hosting}</span>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Price</div>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-3xl font-bold text-primary">${finalPrice.toLocaleString()}</span>
              {vehicle.discount > 0 && (
                <>
                  <span className="text-base text-muted-foreground line-through">${vehicle.price.toLocaleString()}</span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                    Save ${vehicle.discount.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <Stat icon={Calendar} label="Year" value={String(vehicle.year)} />
            <Stat icon={Gauge} label="KM Driven" value={vehicle.km.toLocaleString()} />
            <Stat icon={Users} label="Owners" value={String(vehicle.owners)} />
            <Stat icon={Fuel} label="Fuel" value={vehicle.fuel} />
            <Stat icon={SettingsIcon} label="Transmission" value={vehicle.transmission} />
            <Stat icon={Palette} label="Color" value={vehicle.color} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 stat-card space-y-3">
            <h3 className="font-display font-semibold">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{vehicle.description}</p>
          </div>
          <div className="stat-card space-y-3">
            <h3 className="font-display font-semibold">Engagement</h3>
            <ActivityRow icon={Eye} label="Total Views" value={vehicle.activity.views.toLocaleString()} />
            <ActivityRow icon={MessageSquare} label="Inquiries" value={String(vehicle.activity.inquiries)} />
            <ActivityRow icon={Car} label="Test Drives" value={String(vehicle.activity.testDrives)} />
            <ActivityRow icon={Heart} label="Favorites" value={String(vehicle.activity.favorites)} />
          </div>
        </div>
      )}

      {tab === "details" && (
        <div className="stat-card grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailRow label="Vehicle Number" value={vehicle.id} />
          <DetailRow label="VIN" value={vehicle.vin} />
          <DetailRow label="Company" value={vehicle.company} />
          <DetailRow label="Model" value={vehicle.model} />
          <DetailRow label="Year" value={String(vehicle.year)} />
          <DetailRow label="Body Type" value={vehicle.bodyType} />
          <DetailRow label="Color" value={vehicle.color} />
          <DetailRow label="Fuel" value={vehicle.fuel} />
          <DetailRow label="Transmission" value={vehicle.transmission} />
          <DetailRow label="KM Driven" value={vehicle.km.toLocaleString()} />
          <DetailRow label="Owners" value={String(vehicle.owners)} />
          <DetailRow label="Hosting" value={vehicle.hosting} />
          <DetailRow label="List Price" value={`$${vehicle.price.toLocaleString()}`} />
          <DetailRow label="Discount" value={vehicle.discount ? `$${vehicle.discount.toLocaleString()}` : "—"} />
          <DetailRow label="Final Price" value={`$${finalPrice.toLocaleString()}`} />
        </div>
      )}

      {tab === "history" && (
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">Vehicle History</h3>
          <ol className="relative border-l-2 border-border ml-2 space-y-5">
            {vehicle.history.map((h, i) => (
              <li key={i} className="ml-5">
                <span className="absolute -left-[7px] h-3 w-3 rounded-full bg-primary border-2 border-card" />
                <div className="text-xs text-muted-foreground">{h.date}</div>
                <div className="font-medium text-sm">{h.event}</div>
                <div className="text-sm text-muted-foreground">{h.detail}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === "activity" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 lg:col-span-1 content-start">
            <KpiCard icon={Eye} label="Views" value={vehicle.activity.views.toLocaleString()} />
            <KpiCard icon={MessageSquare} label="Inquiries" value={String(vehicle.activity.inquiries)} />
            <KpiCard icon={Car} label="Test Drives" value={String(vehicle.activity.testDrives)} />
            <KpiCard icon={Heart} label="Favorites" value={String(vehicle.activity.favorites)} />
          </div>
          <div className="stat-card lg:col-span-2">
            <h3 className="font-display font-semibold mb-4">Recent Activity Log</h3>
            <div className="space-y-3">
              {vehicle.logs.map((l, i) => (
                <div key={i} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{l.type}</span>
                      <span className="text-xs text-muted-foreground">{l.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{l.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/50 pb-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function ActivityRow({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="stat-card">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <div className="text-2xl font-bold font-display">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}