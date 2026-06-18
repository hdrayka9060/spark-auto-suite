import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  Fuel,
  Gauge,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Settings2,
  Sparkles,
  Video,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import PortalShell from "./PortalShell";
import JourneyStepper from "./JourneyStepper";
import StatusBadge from "./StatusBadge";
import { formatCurrency, formatDate, formatDateTime, formatMiles } from "./portal-utils";

type JourneyStage = "interested" | "contacted" | "test_drive" | "negotiation" | "purchased";
interface BuyerProfile { name: string; email: string; phone: string; stage: JourneyStage }
interface InterestedVehicle {
  id: string; title: string; price: number; image: string; year: number; mileage: number;
  fuel: string; transmission: string; availability: "available" | "reserved" | "sold";
}
interface Appointment {
  id: string; vehicleTitle: string; dateTime: string; mode: "in_person" | "virtual";
  location?: string; meetingLink?: string; status: "scheduled" | "completed" | "cancelled";
}
interface BuyerOffer { vehicleTitle: string; yourOffer: number; status: "pending" | "accepted" | "countered" }
interface Purchase { vehicleTitle: string; saleDate: string; amount: number; paymentStatus: "paid" | "partial" | "pending" }
interface Financing {
  vehicleTitle: string; amountFinanced: number; monthlyPayment: number; nextDueDate: string;
  balanceRemaining: number; paymentsMade: number; totalPayments: number; status: "active" | "paid_off";
}
interface DealerContact { name: string; phone: string; email: string }

const mock = {
  profile: { name: "Alex Morgan", email: "alex@example.com", phone: "+1 (415) 555-2310", stage: "test_drive" as JourneyStage },
  vehicles: [
    {
      id: "v1",
      title: "2023 Tesla Model 3 Long Range",
      price: 32990, year: 2023, mileage: 18420, fuel: "Electric", transmission: "Automatic",
      availability: "available" as const,
      image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=70",
    },
    {
      id: "v2",
      title: "2022 Honda Civic Sport",
      price: 22450, year: 2022, mileage: 26500, fuel: "Gasoline", transmission: "CVT",
      availability: "reserved" as const,
      image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=70",
    },
  ] as InterestedVehicle[],
  appointments: [
    {
      id: "a1", vehicleTitle: "2023 Tesla Model 3 Long Range",
      dateTime: "2026-06-24T14:30:00", mode: "in_person",
      location: "AutoDealer Showroom, 1450 Market St, San Francisco", status: "scheduled",
    },
    {
      id: "a2", vehicleTitle: "2022 Honda Civic Sport",
      dateTime: "2026-07-02T17:00:00", mode: "virtual",
      meetingLink: "https://meet.example.com/abc-xyz", status: "scheduled",
    },
  ] as Appointment[],
  offer: { vehicleTitle: "2023 Tesla Model 3 Long Range", yourOffer: 31500, status: "pending" } as BuyerOffer,
  // Demo: keep purchase/financing null so empty-state hides those sections;
  // flip these to test the receipt + financing cards.
  purchase: null as Purchase | null,
  financing: null as Financing | null,
  dealer: { name: "AutoDealer Customer Care", phone: "+1 (415) 555-0100", email: "hello@autodealer.example" } as DealerContact,
};

const buyerSteps = [
  { key: "interested", label: "Interested" },
  { key: "contacted", label: "Contacted" },
  { key: "test_drive", label: "Test Drive" },
  { key: "negotiation", label: "Negotiation" },
  { key: "purchased", label: "Purchased" },
];

const availabilityTone = (a: InterestedVehicle["availability"]) =>
  a === "available" ? "success" : a === "reserved" ? "warning" : "neutral";
const apptTone = (s: Appointment["status"]) =>
  s === "scheduled" ? "info" : s === "completed" ? "success" : "danger";
const offerTone = (s: BuyerOffer["status"]) =>
  s === "accepted" ? "success" : s === "countered" ? "warning" : "info";
const payTone = (s: Purchase["paymentStatus"]) =>
  s === "paid" ? "success" : s === "partial" ? "warning" : "danger";

export default function BuyerPortal() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <PortalShell><LoadingState /></PortalShell>;

  const { profile, vehicles, appointments, offer, purchase, financing, dealer } = mock;
  const sortedAppts = [...appointments].sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));
  const [nextAppt, ...restAppts] = sortedAppts;

  return (
    <PortalShell>
      {/* Welcome + stepper */}
      <section className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi {profile.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s where you are in your car-buying journey.
          </p>
        </div>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <JourneyStepper steps={buyerSteps} currentKey={profile.stage} />
          </CardContent>
        </Card>
      </section>

      {/* Vehicles I'm interested in */}
      <Section title="Vehicles you're interested in" subtitle={`${vehicles.length} saved`}>
        {vehicles.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Nothing saved yet" body="Vehicles you express interest in will appear here." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vehicles.map((v) => (
              <Card key={v.id} className="overflow-hidden">
                <div className="relative aspect-[16/10] bg-muted">
                  <img src={v.image} alt={v.title} className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute left-3 top-3"><StatusBadge tone={availabilityTone(v.availability)}>
                    {v.availability === "available" ? "Available" : v.availability === "reserved" ? "Reserved" : "Sold"}
                  </StatusBadge></div>
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold leading-tight">{v.title}</h3>
                    <p className="shrink-0 text-base font-semibold">{formatCurrency(v.price)}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <Spec icon={<Calendar className="h-3.5 w-3.5" />} label={`${v.year}`} />
                    <Spec icon={<Gauge className="h-3.5 w-3.5" />} label={formatMiles(v.mileage)} />
                    <Spec icon={<Fuel className="h-3.5 w-3.5" />} label={v.fuel} />
                    <Spec icon={<Settings2 className="h-3.5 w-3.5" />} label={v.transmission} />
                  </dl>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <Button size="sm" className="w-full sm:flex-1" disabled={v.availability === "sold"}>Book a test drive</Button>
                    <Button size="sm" variant="outline" className="w-full sm:flex-1">Ask a question</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Appointments */}
      <Section title="Your appointments">
        {sortedAppts.length === 0 ? (
          <EmptyState icon={<Calendar className="h-5 w-5" />} title="No appointments yet" body="When you book a test drive, it'll show up here." />
        ) : (
          <div className="space-y-3">
            {nextAppt && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Next up</span>
                    <StatusBadge tone={apptTone(nextAppt.status)}>{nextAppt.status}</StatusBadge>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{nextAppt.vehicleTitle}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{formatDateTime(nextAppt.dateTime)}</p>
                  </div>
                  <ApptDetails appt={nextAppt} />
                </CardContent>
              </Card>
            )}
            {restAppts.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {restAppts.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-tight">{a.vehicleTitle}</h4>
                        <StatusBadge tone={apptTone(a.status)}>{a.status}</StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(a.dateTime)}</p>
                      <ApptDetails appt={a} compact />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Offer */}
      {offer && (
        <Section title="Your offer">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Your offer on</p>
                <p className="text-sm font-medium">{offer.vehicleTitle}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{formatCurrency(offer.yourOffer)}</p>
              </div>
              <StatusBadge tone={offerTone(offer.status)}>
                {offer.status === "pending" ? "Awaiting response" : offer.status === "accepted" ? "Accepted" : "Countered"}
              </StatusBadge>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Purchase */}
      {purchase && (
        <Section title="Your purchase">
          <Card className="border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Receipt
              </CardTitle>
              <StatusBadge tone={payTone(purchase.paymentStatus)}>{purchase.paymentStatus}</StatusBadge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ReceiptRow label="Vehicle" value={purchase.vehicleTitle} />
              <ReceiptRow label="Sale date" value={formatDate(purchase.saleDate)} />
              <ReceiptRow label="Amount" value={<span className="text-base font-semibold">{formatCurrency(purchase.amount)}</span>} />
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Financing */}
      {financing && (
        <Section title="Your financing">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Monthly payment</p>
                  <p className="text-2xl font-semibold tracking-tight">{formatCurrency(financing.monthlyPayment)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Next due {formatDate(financing.nextDueDate)}</p>
                </div>
                <StatusBadge tone={financing.status === "active" ? "info" : "success"}>
                  {financing.status === "active" ? "Active" : "Paid off"}
                </StatusBadge>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-3">
                <Stat label="Financed" value={formatCurrency(financing.amountFinanced)} />
                <Stat label="Balance" value={formatCurrency(financing.balanceRemaining)} />
                <Stat label="Vehicle" value={financing.vehicleTitle} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{financing.paymentsMade} of {financing.totalPayments} payments made</span>
                  <span className="font-medium">{Math.round((financing.paymentsMade / financing.totalPayments) * 100)}%</span>
                </div>
                <Progress value={(financing.paymentsMade / financing.totalPayments) * 100} />
              </div>
              <Button disabled className="w-full sm:w-auto">
                <Wallet className="mr-2 h-4 w-4" /> Make a payment — coming soon
              </Button>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Help */}
      <Section title="Need help?">
        <DealerCard dealer={dealer} />
      </Section>
    </PortalShell>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground/80">{icon}</span>
      <span className="text-foreground/80">{label}</span>
    </div>
  );
}

function ApptDetails({ appt, compact = false }: { appt: Appointment; compact?: boolean }) {
  if (appt.mode === "in_person") {
    return (
      <div className={`flex items-start gap-2 ${compact ? "text-xs" : "text-sm"} text-muted-foreground`}>
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{appt.location}</span>
      </div>
    );
  }
  return (
    <a
      href={appt.meetingLink}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 font-medium text-primary hover:underline ${compact ? "text-xs" : "text-sm"}`}
    >
      <Video className="h-4 w-4" /> Join video call
    </a>
  );
}

function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-border/70 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function DealerCard({ dealer }: { dealer: DealerContact }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Your dealer</p>
          <p className="text-base font-semibold">{dealer.name}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={`tel:${dealer.phone}`} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
            <Phone className="h-4 w-4 text-muted-foreground" /> {dealer.phone}
          </a>
          <a href={`mailto:${dealer.email}`} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
            <Mail className="h-4 w-4 text-muted-foreground" /> {dealer.email}
          </a>
        </div>
        <Button variant="outline" className="w-full sm:w-auto">
          <MessageCircle className="mr-2 h-4 w-4" /> Message dealer
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export { DealerCard };