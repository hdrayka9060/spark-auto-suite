import { useParams } from "react-router-dom";
import {
  Calendar,
  Car,
  CircleAlert,
  ExternalLink,
  Fuel,
  Gauge,
  Mail,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  Settings2,
  User,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PortalShell from "./PortalShell";
import JourneyStepper from "./JourneyStepper";
import StatusBadge from "./StatusBadge";
import { formatCurrency, formatDate, formatDateTime, formatKm } from "./portal-utils";
import { useBuyerPortal } from "@/hooks/api/use-buyer-portal";
import {
  BUYER_STEPS,
  apptStatusTone,
  apptTypeLabel,
  channelLabel,
  stepKeyForStatus,
  titleCase,
  type ServerPortalAppointment,
  type ServerPortalComm,
} from "@/lib/buyer-portal-mapper";

export default function BuyerPortal() {
  const { leadId } = useParams<{ leadId: string }>();
  const { data, isLoading, isError } = useBuyerPortal(leadId);

  if (isLoading) return <PortalShell><LoadingState /></PortalShell>;
  if (isError || !data) return <PortalShell><NotFoundState /></PortalShell>;

  const { buyer, journeyStatus, offer, vehicle, sold, appointments, communications, dealer, browseUrl } = data;
  const soldToYou = sold.isSold && sold.soldToThisBuyer;
  const soldToOther = sold.isSold && !sold.soldToThisBuyer;
  const isArchived = journeyStatus === "archived";
  // Archived for a reason OTHER than "sold to another buyer" (e.g. manually
  // archived / stale inquiry). When archived AND sold-to-other, the "sold"
  // state takes precedence.
  const archivedOther = isArchived && !soldToOther;

  const sortedAppts = [...appointments].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const now = Date.now();
  const nextIdx = sortedAppts.findIndex(
    (a) => a.status === "scheduled" && +new Date(a.start) >= now,
  );

  return (
    <PortalShell>
      {/* Greeting + journey stepper */}
      <section className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi {buyer.firstName} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {soldToOther
              ? "Here's the latest on the vehicle you enquired about."
              : soldToYou
                ? "Congratulations on your purchase! Here's your summary."
                : archivedOther
                  ? "This inquiry is no longer active."
                  : "Here's where you are in your car-buying journey."}
          </p>
        </div>
        {!soldToOther && !archivedOther && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <JourneyStepper
                steps={BUYER_STEPS}
                currentKey={soldToYou ? "purchased" : stepKeyForStatus(journeyStatus)}
              />
            </CardContent>
          </Card>
        )}
      </section>

      {/* The vehicle */}
      <Section title="Your vehicle">
        <Card className="overflow-hidden">
          <div className="relative aspect-[16/10] bg-muted">
            {vehicle.photoUrl ? (
              <img
                src={vehicle.photoUrl}
                alt={vehicle.title}
                className={`h-full w-full object-cover ${soldToOther ? "grayscale" : ""}`}
                loading="lazy"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">
                <Car className="h-10 w-10" />
              </div>
            )}
            <div className="absolute left-3 top-3">
              <StatusBadge tone={soldToYou ? "success" : soldToOther ? "danger" : archivedOther ? "warning" : "info"}>
                {soldToYou ? "Sold to you" : soldToOther ? "Sold" : archivedOther ? "Archived" : "Available"}
              </StatusBadge>
            </div>
          </div>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold leading-tight">{vehicle.title}</h3>
              {!sold.isSold && (
                <p className="shrink-0 text-lg font-semibold">{formatCurrency(vehicle.price)}</p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <Spec icon={<Calendar className="h-3.5 w-3.5" />} label={`${vehicle.year}`} />
              <Spec icon={<Gauge className="h-3.5 w-3.5" />} label={formatKm(vehicle.km)} />
              {vehicle.fuelType && <Spec icon={<Fuel className="h-3.5 w-3.5" />} label={titleCase(vehicle.fuelType)} />}
              {vehicle.transmission && (
                <Spec icon={<Settings2 className="h-3.5 w-3.5" />} label={titleCase(vehicle.transmission)} />
              )}
              {vehicle.color && <Spec icon={<Palette className="h-3.5 w-3.5" />} label={vehicle.color} />}
            </dl>

            {soldToYou && (
              <div className="rounded-lg bg-emerald-500/10 p-3 ring-1 ring-inset ring-emerald-500/20">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Sold price</p>
                <p className="text-2xl font-semibold tracking-tight">{formatCurrency(sold.soldPrice ?? 0)}</p>
                {sold.soldDate && (
                  <p className="mt-0.5 text-xs text-muted-foreground">on {formatDate(sold.soldDate)}</p>
                )}
              </div>
            )}
            {soldToOther && (
              <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-400">
                This vehicle has been sold. Browse our latest inventory below for similar cars.
              </div>
            )}
            {archivedOther && (
              <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                This inquiry has been archived. Please contact the dealership below if you're still interested.
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* Appointments + communication history */}
      <Section title="Your appointments">
        {appointments.length === 0 && communications.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-5 w-5" />}
            title="Nothing scheduled yet"
            body="Test drives, meetings and updates from the dealership will appear here."
          />
        ) : (
          <div className="space-y-4">
            {sortedAppts.length > 0 && (
              <div className="space-y-3">
                {sortedAppts.map((a, i) => (
                  <ApptCard key={i} appt={a} nextUp={i === nextIdx} />
                ))}
              </div>
            )}
            {communications.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Communication history</h3>
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border/70">
                      {communications.map((c, i) => (
                        <li key={i} className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            <ChannelIcon channel={c.channel} />
                            <span className="font-medium">{channelLabel(c.channel)}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{formatDate(c.date)}</span>
                          </div>
                          {c.summary && (
                            <p className="mt-1 pl-7 text-sm text-muted-foreground">{c.summary}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Your offer — below appointments; hidden once the car is sold */}
      {offer && !sold.isSold && !archivedOther && (
        <Section title="Your offer">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 bg-card">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Your offer on</p>
                <p className="text-sm font-medium">{vehicle.title}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{formatCurrency(offer.askedPrice)}</p>
              </div>
              <StatusBadge tone="info">Awaiting response</StatusBadge>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Browse more vehicles */}
      <Section title="Looking for something else?">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-base font-semibold">Browse more vehicles</p>
              <p className="text-sm text-muted-foreground">See our full inventory online.</p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <a href={browseUrl} target="_blank" rel="noreferrer">
                Browse inventory <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </Section>

      {/* Dealer contact (passive — no message form). Always shown. */}
      {dealer && (
        <Section title="Need help?">
          <Card>
            <CardContent className="space-y-3 p-4 sm:p-5 bg-card">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Your dealer</p>
                <p className="text-base font-semibold">{dealer.name}</p>
                {dealer.address && (
                  <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {dealer.address}
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {dealer.phone && (
                  <a href={`tel:${dealer.phone}`} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                    <Phone className="h-4 w-4 text-muted-foreground" /> {dealer.phone}
                  </a>
                )}
                {dealer.email && (
                  <a href={`mailto:${dealer.email}`} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                    <Mail className="h-4 w-4 text-muted-foreground" /> {dealer.email}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </Section>
      )}
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

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground/80">{icon}</span>
      <span className="text-foreground/80">{label}</span>
    </div>
  );
}

function ApptCard({ appt, nextUp }: { appt: ServerPortalAppointment; nextUp: boolean }) {
  return (
    <Card className={nextUp ? "border-primary/40 bg-card" : "bg-card"}>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {nextUp && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Next up
            </span>
          )}
          <StatusBadge tone={apptStatusTone(appt.status)}>{appt.status.replace("_", " ")}</StatusBadge>
        </div>
        <div>
          <h4 className="text-sm font-semibold leading-tight">
            {apptTypeLabel(appt.type)}
            {appt.title ? ` · ${appt.title}` : ""}
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(appt.start)}</p>
        </div>
        <ApptDetails appt={appt} />
      </CardContent>
    </Card>
  );
}

function ApptDetails({ appt }: { appt: ServerPortalAppointment }) {
  if (appt.meetingType === "virtual" && appt.meetLink) {
    return (
      <a
        href={appt.meetLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Video className="h-4 w-4" /> Join video call
      </a>
    );
  }
  if (appt.location) {
    return (
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{appt.location}</span>
      </div>
    );
  }
  return null;
}

function ChannelIcon({ channel }: { channel: string }) {
  const cls = "h-4 w-4 text-muted-foreground";
  if (channel === "call") return <Phone className={cls} />;
  if (channel === "email") return <Mail className={cls} />;
  if (channel === "offline") return <User className={cls} />;
  return <MessageCircle className={cls} />; // whatsapp / sms / other
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

function NotFoundState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <CircleAlert className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold">This link isn't available</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The link may be invalid or expired. Please contact the dealership for an up-to-date link.
        </p>
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
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
