import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Gauge,
  MapPin,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PortalShell from "./PortalShell";
import JourneyStepper from "./JourneyStepper";
import StatusBadge from "./StatusBadge";
import { DealerCard } from "./BuyerPortal";
import { formatCurrency, formatDate, formatDateTime, formatMiles } from "./portal-utils";

type SellerStage = "submitted" | "contacted" | "inspection" | "offer" | "sold";
interface SellerProfile { name: string; email: string; phone: string; stage: SellerStage }
interface SellerVehicle {
  id: string; title: string; year: number; mileage: number; image: string; askingPrice: number;
  status: "under_review" | "inspection_booked" | "offer_made" | "listed" | "sold";
}
interface Inspection { dateTime: string; location: string; whatToBring?: string[]; status: "scheduled" | "completed" | "cancelled" }
interface SellerOffer { askingPrice: number; dealerOffer: number; status: "pending" | "accepted" | "declined" }
interface SaleOutcome { soldDate: string; agreedAmount: number; payoutStatus: "paid" | "pending" }
interface Milestone { date: string; label: string }
interface DealerContact { name: string; phone: string; email: string }

const mock = {
  profile: { name: "Jamie Chen", email: "jamie@example.com", phone: "+1 (415) 555-9981", stage: "offer" as SellerStage },
  vehicles: [
    {
      id: "sv1",
      title: "2021 Toyota RAV4 XLE",
      year: 2021, mileage: 38500, askingPrice: 24500,
      image: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=70",
      status: "offer_made" as const,
    },
  ] as SellerVehicle[],
  inspection: {
    dateTime: "2026-06-21T10:00:00",
    location: "AutoDealer Service Center, 88 Bryant St, San Francisco",
    whatToBring: ["Vehicle registration", "Current insurance card", "All sets of keys", "Service records (if available)"],
    status: "scheduled",
  } as Inspection,
  offer: { askingPrice: 24500, dealerOffer: 23200, status: "pending" } as SellerOffer,
  sale: null as SaleOutcome | null,
  milestones: [
    { date: "2026-06-12T09:15:00", label: "You submitted your vehicle" },
    { date: "2026-06-14T16:40:00", label: "Dealer contacted you" },
    { date: "2026-06-17T11:00:00", label: "Inspection scheduled" },
    { date: "2026-06-19T15:30:00", label: "Offer made" },
  ] as Milestone[],
  dealer: { name: "AutoDealer Acquisitions", phone: "+1 (415) 555-0144", email: "sellers@autodealer.example" } as DealerContact,
};

const sellerSteps = [
  { key: "submitted", label: "Submitted" },
  { key: "contacted", label: "Contacted" },
  { key: "inspection", label: "Inspection" },
  { key: "offer", label: "Offer" },
  { key: "sold", label: "Sold" },
];

const vehicleStatus = (s: SellerVehicle["status"]) => {
  switch (s) {
    case "under_review": return { tone: "info" as const, label: "Under review" };
    case "inspection_booked": return { tone: "info" as const, label: "Inspection booked" };
    case "offer_made": return { tone: "warning" as const, label: "Offer made" };
    case "listed": return { tone: "success" as const, label: "Listed" };
    case "sold": return { tone: "success" as const, label: "Sold" };
  }
};

export default function SellerPortal() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <PortalShell><LoadingState /></PortalShell>;

  const { profile, vehicles, inspection, offer, sale, milestones, dealer } = mock;

  return (
    <PortalShell>
      {/* Welcome + stepper */}
      <section className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi {profile.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your sale and see exactly when you&apos;ll get paid.</p>
        </div>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <JourneyStepper steps={sellerSteps} currentKey={profile.stage} />
          </CardContent>
        </Card>
      </section>

      {/* Vehicles */}
      <Section title={vehicles.length > 1 ? "Your vehicles" : "Your vehicle"}>
        {vehicles.length === 0 ? (
          <EmptyState title="No vehicles submitted" body="Submitted vehicles will appear here while we review them." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vehicles.map((v) => {
              const s = vehicleStatus(v.status);
              return (
                <Card key={v.id} className="overflow-hidden">
                  <div className="relative aspect-[16/10] bg-muted">
                    <img src={v.image} alt={v.title} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute left-3 top-3"><StatusBadge tone={s.tone}>{s.label}</StatusBadge></div>
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <h3 className="text-base font-semibold leading-tight">{v.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {v.year}</span>
                      <span className="inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> {formatMiles(v.mileage)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Asking</span>
                      <span className="text-base font-semibold">{formatCurrency(v.askingPrice)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      {/* Inspection */}
      {inspection && inspection.status === "scheduled" && (
        <Section title="Inspection appointment">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Upcoming</span>
                <StatusBadge tone="info">Scheduled</StatusBadge>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-base font-semibold">{formatDateTime(inspection.dateTime)}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />{inspection.location}
                  </p>
                </div>
              </div>
              {inspection.whatToBring && inspection.whatToBring.length > 0 && (
                <div className="rounded-lg border bg-background p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <ClipboardList className="h-3.5 w-3.5" /> What to bring
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {inspection.whatToBring.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Offer */}
      {offer && (
        <Section title="The offer">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">Compare</h3>
                <StatusBadge tone={offer.status === "accepted" ? "success" : offer.status === "declined" ? "danger" : "warning"}>
                  {offer.status === "pending" ? "Awaiting your response" : offer.status === "accepted" ? "Accepted" : "Declined"}
                </StatusBadge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your asking</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{formatCurrency(offer.askingPrice)}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-primary">Dealer offer</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{formatCurrency(offer.dealerOffer)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="w-full sm:flex-1"><BadgeCheck className="mr-2 h-4 w-4" /> Accept offer</Button>
                <Button variant="outline" className="w-full sm:flex-1">Contact dealer</Button>
              </div>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Sale & payout */}
      {sale && (
        <Section title="Sale & payout">
          <Card className="border-emerald-500/20">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Sold on {formatDate(sale.soldDate)}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{formatCurrency(sale.agreedAmount)}</p>
              </div>
              <StatusBadge tone={sale.payoutStatus === "paid" ? "success" : "warning"}>
                <Wallet className="h-3 w-3" /> Payout {sale.payoutStatus}
              </StatusBadge>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Timeline */}
      <Section title="Progress timeline">
        {milestones.length === 0 ? (
          <EmptyState title="No activity yet" body="Milestones in your sale will appear here." />
        ) : (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <ol className="relative space-y-5 border-l border-border/70 pl-5">
                {milestones.map((m, i) => (
                  <li key={`${m.date}-${i}`} className="relative">
                    <span className="absolute -left-[26px] top-1 grid h-3 w-3 place-items-center rounded-full bg-primary ring-4 ring-primary/15" />
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(m.date)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </Section>

      {/* Dealer */}
      <Section title="Contact dealer">
        <DealerCard dealer={dealer} />
      </Section>
    </PortalShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}