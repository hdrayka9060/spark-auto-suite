import { ReactNode } from "react";
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
  // Archived for a reason OTHER than "sold to another buyer". When archived AND
  // sold-to-other, the "sold" state takes precedence.
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
          <p className="text-xs uppercase tracking-widest text-[#DB2526]">Welcome back</p>
          <h1 className="disp mt-1 text-3xl font-bold text-white">Hi {buyer.firstName} 👋</h1>
          <p className="mt-1 text-sm text-white/60">
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
          <Card className="p-4 sm:p-5">
            <JourneyStepper
              steps={BUYER_STEPS}
              currentKey={soldToYou ? "purchased" : stepKeyForStatus(journeyStatus)}
            />
          </Card>
        )}
      </section>

      {/* The vehicle */}
      <Section title="Your vehicle">
        <Card className="overflow-hidden">
          <div className="relative aspect-[16/10] bg-gradient-to-br from-[#333] to-[#161616]">
            {vehicle.photoUrl ? (
              <img
                src={vehicle.photoUrl}
                alt={vehicle.title}
                className={`h-full w-full object-cover ${soldToOther ? "grayscale" : ""}`}
                loading="lazy"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/40">
                <Car className="h-10 w-10" />
              </div>
            )}
            {(soldToYou || soldToOther) && (
              <div className="pointer-events-none absolute left-0 top-0 z-20 h-28 w-28 overflow-hidden">
                <span className="disp absolute left-[-52px] top-[24px] w-[200px] rotate-[-45deg] bg-[#DB2526] py-1.5 text-center text-sm font-bold uppercase tracking-widest text-white shadow-lg">
                  Sold
                </span>
              </div>
            )}
            <div className="absolute right-3 top-3">
              <StatusBadge tone={soldToYou ? "success" : soldToOther ? "danger" : archivedOther ? "warning" : "info"}>
                {soldToYou ? "Sold to you" : soldToOther ? "Sold" : archivedOther ? "Archived" : "Available"}
              </StatusBadge>
            </div>
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="disp text-lg font-bold leading-tight text-white">{vehicle.title}</h3>
              {!sold.isSold && (
                <p className="disp shrink-0 text-xl font-bold text-[#DB2526]">{formatCurrency(vehicle.price)}</p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Spec icon={<Calendar className="h-3.5 w-3.5" />} label={`${vehicle.year}`} />
              <Spec icon={<Gauge className="h-3.5 w-3.5" />} label={formatKm(vehicle.km)} />
              {vehicle.fuelType && <Spec icon={<Fuel className="h-3.5 w-3.5" />} label={titleCase(vehicle.fuelType)} />}
              {vehicle.transmission && (
                <Spec icon={<Settings2 className="h-3.5 w-3.5" />} label={titleCase(vehicle.transmission)} />
              )}
              {vehicle.color && <Spec icon={<Palette className="h-3.5 w-3.5" />} label={vehicle.color} />}
            </dl>

            {soldToYou && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs uppercase tracking-wider text-white/50">Sold price</p>
                <p className="disp text-2xl font-bold text-white">{formatCurrency(sold.soldPrice ?? 0)}</p>
                {sold.soldDate && <p className="mt-0.5 text-xs text-white/50">on {formatDate(sold.soldDate)}</p>}
              </div>
            )}
            {soldToOther && (
              <div className="rounded-lg border border-[#DB2526]/40 bg-[#DB2526]/10 p-3 text-sm text-[#ff9a9a]">
                This vehicle has been sold. Browse our latest inventory below for similar cars.
              </div>
            )}
            {archivedOther && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                This inquiry has been archived. Please contact the dealership below if you're still interested.
              </div>
            )}
          </div>
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
                <h3 className="mb-2 text-sm font-semibold text-white/60">Communication history</h3>
                <Card>
                  <ul className="divide-y divide-[#3a3a3a]">
                    {communications.map((c, i) => (
                      <li key={i} className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <ChannelIcon channel={c.channel} />
                          <span className="font-medium text-white">{channelLabel(c.channel)}</span>
                          <span className="ml-auto text-xs text-white/50">{formatDate(c.date)}</span>
                        </div>
                        {c.summary && <p className="mt-1 pl-7 text-sm text-white/60">{c.summary}</p>}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Your offer — hidden once the car is sold */}
      {offer && !sold.isSold && !archivedOther && (
        <Section title="Your offer">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">Your offer on</p>
              <p className="text-sm font-medium text-white/90">{vehicle.title}</p>
              <p className="disp mt-2 text-2xl font-bold text-white">{formatCurrency(offer.askedPrice)}</p>
            </div>
            <StatusBadge tone="info">Awaiting response</StatusBadge>
          </Card>
        </Section>
      )}

      {/* Browse more vehicles */}
      <Section title="Looking for something else?">
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="disp text-base font-bold text-white">Browse more vehicles</p>
            <p className="text-sm text-white/60">See our full inventory online.</p>
          </div>
          <a href={browseUrl} target="_blank" rel="noreferrer" className={redBtn}>
            Browse inventory <ExternalLink className="h-4 w-4" />
          </a>
        </Card>
      </Section>

      {/* Dealer contact (passive — no message form) */}
      {dealer && (
        <Section title="Need help?">
          <Card className="space-y-3 p-4 sm:p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/50">Your dealer</p>
              <p className="disp text-base font-bold text-white">{dealer.name}</p>
              {dealer.address && (
                <p className="mt-1 flex items-start gap-2 text-sm text-white/60">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#DB2526]" /> {dealer.address}
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {dealer.phone && (
                <a href={`tel:${dealer.phone}`} className={contactTile}>
                  <Phone className="h-4 w-4 text-[#DB2526]" /> {dealer.phone}
                </a>
              )}
              {dealer.email && (
                <a href={`mailto:${dealer.email}`} className={contactTile}>
                  <Mail className="h-4 w-4 text-[#DB2526]" /> {dealer.email}
                </a>
              )}
            </div>
          </Card>
        </Section>
      )}
    </PortalShell>
  );
}

const redBtn =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#DB2526] px-6 py-3 disp text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#B41A1A]";
const contactTile =
  "flex items-center gap-2 rounded-md border border-[#3a3a3a] bg-[#0b0b0b] px-3 py-2 text-sm font-medium text-white transition-colors hover:border-[#DB2526]/60";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-[#3a3a3a] bg-[#2a2a2a] ${className}`}>{children}</div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="disp text-lg font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Spec({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-white/70">
      <span className="text-[#DB2526]">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ApptCard({ appt, nextUp }: { appt: ServerPortalAppointment; nextUp: boolean }) {
  return (
    <Card className={`p-4 ${nextUp ? "border-[#DB2526]/50" : ""}`}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {nextUp && (
            <span className="rounded-full bg-[#DB2526]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#ff8f8f]">
              Next up
            </span>
          )}
          <StatusBadge tone={apptStatusTone(appt.status)}>{appt.status.replace("_", " ")}</StatusBadge>
        </div>
        <div>
          <h4 className="text-sm font-semibold leading-tight text-white">
            {apptTypeLabel(appt.type)}
            {appt.title ? ` · ${appt.title}` : ""}
          </h4>
          <p className="mt-0.5 text-xs text-white/50">{formatDateTime(appt.start)}</p>
        </div>
        <ApptDetails appt={appt} />
      </div>
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
        className="inline-flex items-center gap-2 text-sm font-medium text-[#DB2526] hover:underline"
      >
        <Video className="h-4 w-4" /> Join video call
      </a>
    );
  }
  if (appt.location) {
    return (
      <div className="flex items-start gap-2 text-sm text-white/60">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#DB2526]" />
        <span>{appt.location}</span>
      </div>
    );
  }
  return null;
}

function ChannelIcon({ channel }: { channel: string }) {
  const cls = "h-4 w-4 text-[#DB2526]";
  if (channel === "call") return <Phone className={cls} />;
  if (channel === "email") return <Mail className={cls} />;
  if (channel === "offline") return <User className={cls} />;
  return <MessageCircle className={cls} />; // whatsapp / sms / website / other
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0b0b0b] text-[#DB2526]">{icon}</div>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="max-w-sm text-xs text-white/50">{body}</p>
    </Card>
  );
}

function NotFoundState() {
  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0b0b0b] text-[#DB2526]">
        <CircleAlert className="h-6 w-6" />
      </div>
      <p className="disp text-base font-bold text-white">This link isn't available</p>
      <p className="max-w-sm text-sm text-white/60">
        The link may be invalid or expired. Please contact the dealership for an up-to-date link.
      </p>
    </Card>
  );
}

function LoadingState() {
  const bar = "animate-pulse rounded-lg bg-[#2a2a2a]";
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className={`${bar} h-6 w-40`} />
        <div className={`${bar} h-20 w-full`} />
      </div>
      <div className={`${bar} h-56 w-full`} />
      <div className={`${bar} h-32 w-full`} />
    </div>
  );
}
