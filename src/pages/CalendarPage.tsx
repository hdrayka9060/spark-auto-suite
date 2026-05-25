import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Video, Car, Wrench, Loader2, AlertCircle, X, Trash2 } from "lucide-react";
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent, getMonthRange } from "@/hooks/api/use-calendar";
import { useBuyers } from "@/hooks/api/use-buyers";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { useStaff } from "@/hooks/api/use-staff";
import { ApiError } from "@/lib/api";
import { CalendarEventDisplay, ClientEventType } from "@/lib/calendar-mapper";
import { toast } from "@/hooks/use-toast";

const eventTypes: Record<ClientEventType, { label: string; color: string; icon: typeof Car }> = {
  testDrive: { label: "Test Drive", color: "bg-primary text-primary-foreground", icon: Car },
  inspection: { label: "Inspection", color: "bg-amber-500 text-white", icon: Wrench },
  meeting: { label: "Meeting", color: "bg-violet-500 text-white", icon: Video },
  blocked: { label: "Blocked", color: "bg-gray-500 text-white", icon: X },
};

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type ViewMode = "Month" | "Week" | "Day";

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>("Month");
  const [showAdd, setShowAdd] = useState(false);

  const range = getMonthRange(cursor.getFullYear(), cursor.getMonth());
  const eventsQuery = useCalendarEvents(range);
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const buyersQuery = useBuyers({});
  const vehiclesQuery = useVehicles({ limit: 100 });
  const staffQuery = useStaff();

  const [form, setForm] = useState({
    title: "", type: "testDrive" as ClientEventType,
    date: "", time: "10:00", duration: "60",
    customerName: "", customerPhone: "", customerEmail: "",
    buyerId: "", vehicleId: "", assignedToId: "", location: "", notes: "",
  });

  const resetForm = () => setForm({
    title: "", type: "testDrive", date: "", time: "10:00", duration: "60",
    customerName: "", customerPhone: "", customerEmail: "",
    buyerId: "", vehicleId: "", assignedToId: "", location: "", notes: "",
  });

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date());

  // When buyer is selected, auto-fill name/email/phone
  const onBuyerSelect = (buyerId: string) => {
    const buyer = (buyersQuery.data?.data ?? []).find((b) => b.id === buyerId);
    setForm((f) => ({
      ...f,
      buyerId,
      customerName: buyer?.name ?? f.customerName,
      customerEmail: buyer?.email ?? f.customerEmail,
      customerPhone: buyer?.phone ?? f.customerPhone,
    }));
  };

  const handleSave = async () => {
    if (!form.title || !form.date || !form.time) {
      toast({ title: "Missing info", description: "Title, date, and time are required.", variant: "destructive" });
      return;
    }
    const start = new Date(`${form.date}T${form.time}`);
    const end = new Date(start.getTime() + parseInt(form.duration, 10) * 60 * 1000);
    try {
      await createEvent.mutateAsync({
        title: form.title,
        type: form.type,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
        customerEmail: form.customerEmail || undefined,
        vehicleId: form.vehicleId || undefined,
        assignedToId: form.assignedToId || undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
      });
      toast({ title: "Event created", description: form.title });
      resetForm();
      setShowAdd(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not create event";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this event?")) return;
    try {
      await deleteEvent.mutateAsync(id);
      toast({ title: "Event deleted" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const events = eventsQuery.data ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Calendar</h1>
          <p className="text-muted-foreground text-sm">Test drives, inspections, and meetings</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-card border rounded-lg overflow-hidden">
            {(["Day", "Week", "Month"] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm font-medium ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAdd ? "Cancel" : "Add Event"}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Event</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event Title *" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClientEventType })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="testDrive">Test Drive</option>
              <option value="inspection">Inspection</option>
              <option value="meeting">Meeting</option>
              <option value="blocked">Blocked</option>
            </select>
            <select value={form.buyerId} onChange={(e) => onBuyerSelect(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Pick buyer (optional)…</option>
              {(buyersQuery.data?.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Duration (minutes)" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Pick vehicle (optional)…</option>
              {(vehiclesQuery.data?.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option value="">Assigned staff (optional)…</option>
              {(staffQuery.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Customer name (overrides buyer)" className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-3" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); resetForm(); }} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button
              onClick={handleSave}
              disabled={createEvent.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-60"
            >
              {createEvent.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Event
            </button>
          </div>
        </div>
      )}

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={goPrev} className="p-1 hover:bg-muted rounded"><ChevronLeft className="h-4 w-4" /></button>
            <h3 className="font-display font-semibold">{monthNames[cursor.getMonth()]} {cursor.getFullYear()}</h3>
            <button onClick={goNext} className="p-1 hover:bg-muted rounded"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={goToday} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-2">Today</button>
          </div>
          <div className="flex gap-3">
            {(["testDrive", "inspection", "meeting"] as ClientEventType[]).map((key) => {
              const t = eventTypes[key];
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${t.color.split(" ")[0]}`} />
                  {t.label}
                </div>
              );
            })}
          </div>
        </div>

        {eventsQuery.isLoading && (
          <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
          </div>
        )}

        {eventsQuery.error && (
          <div className="text-center py-12 text-red-600 flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" /> {eventsQuery.error instanceof Error ? eventsQuery.error.message : "Could not load events"}
          </div>
        )}

        {!eventsQuery.isLoading && !eventsQuery.error && view === "Month" && (
          <MonthGrid cursor={cursor} events={events} onDeleteEvent={handleDelete} />
        )}

        {!eventsQuery.isLoading && !eventsQuery.error && view === "Week" && (
          <WeekStrip cursor={cursor} events={events} onDeleteEvent={handleDelete} />
        )}

        {!eventsQuery.isLoading && !eventsQuery.error && view === "Day" && (
          <DayList cursor={cursor} events={events} onDeleteEvent={handleDelete} />
        )}
      </div>
    </div>
  );
}

// ── Views ──────────────────────────────────────────────────────────────────

function MonthGrid({ cursor, events, onDeleteEvent }: { cursor: Date; events: CalendarEventDisplay[]; onDeleteEvent: (e: React.MouseEvent, id: string) => void }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to a multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEventDisplay[]>();
    for (const e of events) {
      if (e.year !== year || e.month !== month) continue;
      if (!map.has(e.day)) map.set(e.day, []);
      map.get(e.day)!.push(e);
    }
    return map;
  }, [events, year, month]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-t-lg overflow-hidden">
        {daysOfWeek.map((d) => (
          <div key={d} className="bg-muted py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-b-lg overflow-hidden">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="bg-muted/30 min-h-[90px]" />;
          const dayEvents = eventsByDay.get(day) ?? [];
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <div key={idx} className={`bg-card min-h-[90px] p-1.5 ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}>
              <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full" : "text-muted-foreground"}`}>{day}</span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    onClick={(ev) => onDeleteEvent(ev, e.id)}
                    title="Click to delete"
                    className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${eventTypes[e.type].color}`}
                  >
                    {e.time} {e.title.split("–")[0].trim()}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekStrip({ cursor, events, onDeleteEvent }: { cursor: Date; events: CalendarEventDisplay[]; onDeleteEvent: (e: React.MouseEvent, id: string) => void }) {
  // Week starting Sunday containing the cursor date
  const sunday = new Date(cursor);
  sunday.setDate(cursor.getDate() - cursor.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const dayEvents = events.filter((e) => e.dateKey === key);
        return (
          <div key={key} className="border rounded-lg p-2 min-h-[200px]">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {daysOfWeek[d.getDay()]} {d.getDate()}
            </p>
            {dayEvents.map((e) => (
              <div
                key={e.id}
                onClick={(ev) => onDeleteEvent(ev, e.id)}
                title="Click to delete"
                className={`text-xs p-2 rounded mb-1 cursor-pointer ${eventTypes[e.type].color}`}
              >
                <p className="font-medium">{e.time}</p>
                <p className="truncate">{e.title}</p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DayList({ cursor, events, onDeleteEvent }: { cursor: Date; events: CalendarEventDisplay[]; onDeleteEvent: (e: React.MouseEvent, id: string) => void }) {
  const key = cursor.toISOString().slice(0, 10);
  const dayEvents = events.filter((e) => e.dateKey === key);
  const today = new Date();
  const isToday = today.toISOString().slice(0, 10) === key;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {monthNames[cursor.getMonth()]} {cursor.getDate()}, {cursor.getFullYear()}
        {isToday && <span className="ml-2 text-xs text-primary">(Today)</span>}
      </p>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No events for this day.</p>
      ) : (
        dayEvents.map((e) => {
          const Icon = eventTypes[e.type].icon;
          return (
            <div key={e.id} className="flex items-center gap-4 border rounded-lg p-4">
              <div className={`p-2 rounded-lg ${eventTypes[e.type].color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.customer} · {e.time}</p>
                {e.assignedToName && (
                  <p className="text-[11px] text-muted-foreground">Assigned: {e.assignedToName}</p>
                )}
              </div>
              {e.type === "meeting" && e.meetLink && (
                <a href={e.meetLink} target="_blank" rel="noreferrer" className="text-xs bg-muted px-3 py-1.5 rounded-lg hover:bg-muted/80">
                  Join Meet
                </a>
              )}
              <button onClick={(ev) => onDeleteEvent(ev, e.id)} className="p-2 rounded hover:bg-red-50 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
