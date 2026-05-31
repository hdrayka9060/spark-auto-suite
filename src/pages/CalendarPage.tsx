import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  Car,
  Wrench,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  MapPin,
  Users as UsersIcon,
  Search,
  UserCheck,
  Briefcase,
  ExternalLink,
  Pencil,
  CalendarDays,
  Mail,
  ChevronDown,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  useRemoveParticipant,
  getMonthRange,
  getWeekRange,
  getDayRange,
  type CalendarFilter,
} from "@/hooks/api/use-calendar";
import { useBuyers } from "@/hooks/api/use-buyers";
import { useSellers } from "@/hooks/api/use-sellers";
import { useVehicles } from "@/hooks/api/use-vehicles";
import { useStaff } from "@/hooks/api/use-staff";
import { ApiError } from "@/lib/api";
import {
  CalendarEventDisplay,
  ClientEventType,
  ClientMeetingType,
  EVENT_TYPE_META,
  Participant,
  ParticipantInput,
  ParticipantType,
} from "@/lib/calendar-mapper";
import { useCan } from "@/components/Can";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_ICON: Record<ClientEventType, typeof Car> = {
  testDrive: Car,
  inspection: Wrench,
  meeting: Video,
  other: CalendarDays,
};

const PARTICIPANT_ICON: Record<ParticipantType, typeof UserCheck> = {
  staff: Briefcase,
  buyer: UserCheck,
  seller: UsersIcon,
};

type ViewMode = "Month" | "Week" | "Day";
type EventFormMode = { kind: "create" } | { kind: "edit"; event: CalendarEventDisplay };

/**
 * Header label for the current view + cursor.
 *   - Day  → "Mon, Jun 15, 2026"
 *   - Week → "Jun 14 – 20, 2026" (or spans months: "Jun 28 – Jul 4, 2026")
 *   - Month → "June 2026"
 *
 * Declared at module scope (above CalendarPage) so it's safely hoisted into
 * scope even during Vite Fast-Refresh partial updates. An earlier version
 * had it defined below CalendarPage and HMR occasionally invalidated the
 * file boundary mid-edit, producing a `ReferenceError: headerLabel is not
 * defined` runtime crash. Function declarations ARE hoisted in plain ESM,
 * but Vite's Fast Refresh transformation sometimes scopes them oddly —
 * placing helpers above their first call site avoids the trap entirely.
 */
function headerLabel(view: ViewMode, cursor: Date): string {
  if (view === "Day") {
    return cursor.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "Week") {
    const sunday = new Date(cursor);
    sunday.setDate(cursor.getDate() - cursor.getDay());
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const sameMonth = sunday.getMonth() === saturday.getMonth();
    if (sameMonth) {
      return `${monthNames[sunday.getMonth()].slice(0, 3)} ${sunday.getDate()} – ${saturday.getDate()}, ${saturday.getFullYear()}`;
    }
    return `${monthNames[sunday.getMonth()].slice(0, 3)} ${sunday.getDate()} – ${monthNames[saturday.getMonth()].slice(0, 3)} ${saturday.getDate()}, ${saturday.getFullYear()}`;
  }
  return `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
}

/**
 * Multi-line tooltip text for an event tile. Browsers render newlines in
 * `title=` attributes, so a single string with `\n` separators gives a
 * useful preview without needing a custom tooltip component. Surfaces the
 * creator/assignee/participant count — the user's "I want to see who's
 * involved" requirement applied to the calendar's at-a-glance view.
 */
function buildTileTooltip(e: CalendarEventDisplay): string {
  const parts = [
    `${e.title}`,
    `${e.time} – ${e.endTime}`,
  ];
  if (e.createdByName) parts.push(`Created by: ${e.createdByName}`);
  if (e.assignedToName) parts.push(`Assigned: ${e.assignedToName}`);
  if (e.participants.length > 0) {
    parts.push(`${e.participants.length} participant${e.participants.length === 1 ? "" : "s"}`);
  }
  parts.push("", "Click to view details");
  return parts.join("\n");
}

interface CalendarUserOption {
  id: string;
  userType: ParticipantType;
  name: string;
  email: string;
}

/**
 * Empty form used by both the create and edit dialogs. Single shape +
 * conditional initialiser keeps the form logic in one place.
 */
const EMPTY_FORM = {
  title: "",
  description: "",
  type: "testDrive" as ClientEventType,
  date: "",
  time: "10:00",
  duration: "60",
  meetingType: "physical" as ClientMeetingType,
  createMeetLink: false,
  meetLink: "",
  location: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  buyerId: "",
  vehicleId: "",
  assignedToId: "",
  notes: "",
  participants: [] as ParticipantInput[],
};
type EventForm = typeof EMPTY_FORM;

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>("Month");
  const [formMode, setFormMode] = useState<EventFormMode | null>(null);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Multi-user calendar filter ─────────────────────────────────────────
  // "Viewing calendar of" — defaults to the *current logged-in user* so they
  // see their own events (created by, assigned to, or a participant on)
  // without first having to pick themselves from a dropdown. Switching to a
  // specific user — or "All calendars" — sends ?userId=&userType= to the
  // API which returns only events where that user is creator / assigned /
  // participant. The combobox also exposes an "All calendars" reset row.
  const { state: authState } = useAuth();
  const currentUser = authState.status === "authenticated" ? authState.user : null;
  const currentUserOption = useMemo<CalendarUserOption | null>(() => {
    if (!currentUser) return null;
    return {
      id: currentUser._id,
      userType: "staff",
      name: `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email,
      email: currentUser.email,
    };
  }, [currentUser]);

  const [calendarFilter, setCalendarFilter] = useState<CalendarUserOption | null>(null);
  // Whether the user has explicitly chosen a calendar (vs. our auto-default).
  // Once set, we don't re-stamp the default — otherwise an admin who
  // intentionally chose "All calendars" would get bounced back to "My".
  const [filterTouched, setFilterTouched] = useState(false);

  // First load: seed the filter to the current user once we know who they are.
  useEffect(() => {
    if (!filterTouched && currentUserOption && !calendarFilter) {
      setCalendarFilter(currentUserOption);
    }
  }, [filterTouched, currentUserOption, calendarFilter]);

  /** Wrap the setter so any UI change marks the filter as touched. */
  const handleCalendarFilterChange = (u: CalendarUserOption | null) => {
    setCalendarFilter(u);
    setFilterTouched(true);
  };

  const isViewingSelf = calendarFilter?.id === currentUserOption?.id;

  // Permission flags. EDIT covers create + update + participant management;
  // DELETE covers soft-delete. VIEW is implied by the page-level
  // PermissionRoute gating.
  const canEdit = useCan("Calendar", "edit");
  const canDelete = useCan("Calendar", "delete");

  // ── Data hooks ─────────────────────────────────────────────────────────
  // Fetch the slice that matches the active view, so when the user goes
  // next/prev they see the events for *that* day/week/month — not just
  // whatever month happens to contain the cursor.
  const range = useMemo(() => {
    if (view === "Day") return getDayRange(cursor);
    if (view === "Week") return getWeekRange(cursor);
    return getMonthRange(cursor.getFullYear(), cursor.getMonth());
  }, [view, cursor]);
  const eventsQuery = useCalendarEvents(range, {
    userId: calendarFilter?.id,
    userType: calendarFilter?.userType,
  });
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const removeParticipant = useRemoveParticipant();
  const buyersQuery = useBuyers({});
  const sellersQuery = useSellers({});
  const vehiclesQuery = useVehicles({ limit: 100 });
  const staffQuery = useStaff();

  // Build the unified user directory used by the participant picker AND
  // the "view calendar of" search. Merging here keeps the combobox simple.
  const allUsers = useMemo<CalendarUserOption[]>(() => {
    const staff: CalendarUserOption[] = (staffQuery.data ?? []).map((s) => ({
      id: s.id,
      userType: "staff",
      name: s.name,
      email: s.email,
    }));
    const buyers: CalendarUserOption[] = (buyersQuery.data?.data ?? []).map((b) => ({
      id: b.id,
      userType: "buyer",
      name: b.name,
      email: b.email,
    }));
    const sellers: CalendarUserOption[] = (sellersQuery.data?.data ?? []).map((s) => ({
      id: s.id,
      userType: "seller",
      name: s.name,
      email: s.email,
    }));
    return [...staff, ...buyers, ...sellers];
  }, [staffQuery.data, buyersQuery.data, sellersQuery.data]);

  // ── Event form state ───────────────────────────────────────────────────
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);

  /** Convert a Display event back to form state, so Edit pre-fills cleanly. */
  const formFromEvent = (e: CalendarEventDisplay): EventForm => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const startMinutes = Math.round((e.end.getTime() - e.start.getTime()) / 60000);
    return {
      title: e.title,
      description: e.description ?? "",
      type: e.type,
      date: `${e.start.getFullYear()}-${pad(e.start.getMonth() + 1)}-${pad(e.start.getDate())}`,
      time: `${pad(e.start.getHours())}:${pad(e.start.getMinutes())}`,
      duration: String(startMinutes || 60),
      meetingType: e.meetingType,
      // Edit does not regenerate the meet link by default — that would
      // surprise the user. They can tick the box to refresh it.
      createMeetLink: false,
      meetLink: e.meetLink ?? "",
      location: e.location ?? "",
      customerName: e.customer === "—" ? "" : e.customer,
      customerPhone: e.customerPhone ?? "",
      customerEmail: e.customerEmail ?? "",
      buyerId: "",
      vehicleId: e.vehicleId ?? "",
      assignedToId: e.assignedToId ?? "",
      notes: e.notes ?? "",
      participants: e.participants.map<ParticipantInput>((p) => ({
        userType: p.userType,
        userId: p.userId,
        name: p.name,
        email: p.email,
      })),
    };
  };

  const openCreate = () => {
    /*
     * Default the form's date to the day the user is currently viewing —
     * NOT today. The old behaviour (always defaulting to today) caused a
     * confusing user-reported bug: if the calendar cursor was on a different
     * month and the user clicked "Add Event" → saved, the event landed on
     * today's date and disappeared from view, since the events query
     * fetches only the slice matching the current cursor. The user thought
     * the save had failed.
     *
     * Now: Day view → use the cursor's exact day. Week view → use the
     * cursor's day (which is somewhere inside that week). Month view →
     * use the cursor's day if it's in the displayed month, otherwise
     * the 1st of that month.
     */
    const pad = (n: number) => n.toString().padStart(2, "0");
    let date = new Date(cursor);
    if (view === "Month") {
      const today = new Date();
      if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()) {
        // Viewing the current month: use today as a sensible default.
        date = today;
      } else {
        // Otherwise default to the 1st of the viewed month.
        date.setDate(1);
      }
    }
    setForm({
      ...EMPTY_FORM,
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    });
    setFormMode({ kind: "create" });
  };

  const openEdit = (e: CalendarEventDisplay) => {
    setForm(formFromEvent(e));
    setFormMode({ kind: "edit", event: e });
  };

  const closeForm = () => setFormMode(null);

  // Pre-fill buyer-derived fields when a buyer is selected from the dropdown.
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

  // ── Save (create or update) ────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title || !form.date || !form.time) {
      toast({ title: "Missing info", description: "Title, date, and time are required.", variant: "destructive" });
      return;
    }
    const start = new Date(`${form.date}T${form.time}`);
    const end = new Date(start.getTime() + parseInt(form.duration, 10) * 60 * 1000);
    const payload = {
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      meetingType: form.meetingType,
      createMeetLink: form.meetingType === "virtual" ? form.createMeetLink : undefined,
      meetLink: form.meetLink || undefined,
      customerName: form.customerName || undefined,
      customerPhone: form.customerPhone || undefined,
      customerEmail: form.customerEmail || undefined,
      vehicleId: form.vehicleId || undefined,
      assignedToId: form.assignedToId || undefined,
      location: form.location || undefined,
      notes: form.notes || undefined,
      participants: form.participants.length > 0 ? form.participants : undefined,
    };
    try {
      if (formMode?.kind === "edit") {
        await updateEvent.mutateAsync({ id: formMode.event.id, input: payload });
        toast({ title: "Event updated", description: form.title });
      } else {
        await createEvent.mutateAsync(payload);
        // After save, jump the calendar cursor to the event's date. Without
        // this the user would stay on their previous view and a freshly-
        // created event on a different month would silently disappear,
        // making the save feel like it failed.
        if (start.getMonth() !== cursor.getMonth() || start.getFullYear() !== cursor.getFullYear() || (view !== "Month" && start.toDateString() !== cursor.toDateString())) {
          setCursor(start);
        }
        toast({
          title: "Event created",
          description: `${form.title} · ${start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`,
        });
      }
      closeForm();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save event";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  // ── Click event → open details ─────────────────────────────────────────
  const handleEventClick = (eventId: string) => {
    setDetailEventId(eventId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteEvent.mutateAsync(confirmDeleteId);
      toast({ title: "Event deleted" });
      // If we were viewing this event's details, close that dialog too.
      if (detailEventId === confirmDeleteId) setDetailEventId(null);
      setConfirmDeleteId(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    }
  };

  const handleRemoveParticipant = async (eventId: string, participantId: string) => {
    try {
      await removeParticipant.mutateAsync({ eventId, participantId });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove participant";
      toast({ title: "Remove failed", description: msg, variant: "destructive" });
    }
  };

  /**
   * View-aware navigation. Day view moves by 1 day, Week by 7 days, Month
   * by 1 calendar month. Keeps the heading consistent with what was just
   * navigated to (e.g. Week view should always show 7 consecutive days,
   * never "snap" back to the 1st of the month).
   */
  const step = (direction: 1 | -1) => {
    const next = new Date(cursor);
    if (view === "Day") {
      next.setDate(cursor.getDate() + direction);
    } else if (view === "Week") {
      next.setDate(cursor.getDate() + direction * 7);
    } else {
      // Month: snap to the 1st so off-by-one (e.g. Mar 31 → Feb 28) doesn't
      // collapse onto a shorter month and cascade further back.
      next.setDate(1);
      next.setMonth(cursor.getMonth() + direction);
    }
    setCursor(next);
  };
  const goPrev = () => step(-1);
  const goNext = () => step(1);
  const goToday = () => setCursor(new Date());

  const events = eventsQuery.data ?? [];
  const activeEvent = events.find((e) => e.id === detailEventId) ?? null;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Calendar</h1>
          <p className="text-muted-foreground text-sm">Test drives, inspections, meetings &amp; more</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex bg-card border rounded-lg overflow-hidden">
            {(["Day", "Week", "Month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {v}
              </button>
            ))}
          </div>
          {canEdit && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Event
            </button>
          )}
        </div>
      </div>

      {/* ── User-search toolbar (Google-Calendar-style multi-user view) ──
          On first load this defaults to the current user, so events the
          user is involved in (created / assigned / participant) show up in
          "their" calendar automatically. Picking another user — or "All
          calendars" via the combobox — switches the view. */}
      <div className="flex items-center gap-3 flex-wrap">
        <UserSearchCombobox
          users={allUsers}
          value={calendarFilter}
          onChange={handleCalendarFilterChange}
          loading={staffQuery.isLoading || buyersQuery.isLoading || sellersQuery.isLoading}
          currentUserId={currentUserOption?.id}
        />
        {/* Context badge — makes it obvious which calendar is being shown.
            "My calendar" when filter = self, "<Name>'s calendar" otherwise,
            "Showing all events" when no filter. */}
        {isViewingSelf && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            My calendar
          </span>
        )}
        {!isViewingSelf && calendarFilter && (
          <span className="text-xs text-muted-foreground">
            Showing events {calendarFilter.name} is involved in
          </span>
        )}
        {!calendarFilter && (
          <span className="text-xs text-muted-foreground">
            Showing all events
          </span>
        )}
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={goPrev} className="p-1 hover:bg-muted rounded" title={`Previous ${view.toLowerCase()}`}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="font-display font-semibold">
              {headerLabel(view, cursor)}
            </h3>
            <button onClick={goNext} className="p-1 hover:bg-muted rounded" title={`Next ${view.toLowerCase()}`}>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-2"
            >
              Today
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            {(Object.keys(EVENT_TYPE_META) as ClientEventType[]).map((key) => {
              const t = EVENT_TYPE_META[key];
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${t.dotColor}`} />
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
            <AlertCircle className="h-4 w-4" />{" "}
            {eventsQuery.error instanceof Error ? eventsQuery.error.message : "Could not load events"}
          </div>
        )}

        {!eventsQuery.isLoading && !eventsQuery.error && view === "Month" && (
          <MonthGrid cursor={cursor} events={events} onEventClick={handleEventClick} />
        )}

        {!eventsQuery.isLoading && !eventsQuery.error && view === "Week" && (
          <WeekStrip cursor={cursor} events={events} onEventClick={handleEventClick} />
        )}

        {!eventsQuery.isLoading && !eventsQuery.error && view === "Day" && (
          <DayList cursor={cursor} events={events} onEventClick={handleEventClick} />
        )}
      </div>

      {/* ── Create / Edit dialog ────────────────────────────────────────── */}
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formMode?.kind === "edit" ? "Edit event" : "New event"}
            </DialogTitle>
            <DialogDescription>
              {formMode?.kind === "edit"
                ? `Update "${formMode.event.title}".`
                : "Schedule a test drive, inspection, meeting, or other event."}
            </DialogDescription>
          </DialogHeader>
          <EventForm
            form={form}
            setForm={setForm}
            onBuyerSelect={onBuyerSelect}
            buyers={buyersQuery.data?.data ?? []}
            sellers={sellersQuery.data?.data ?? []}
            staff={staffQuery.data ?? []}
            vehicles={vehiclesQuery.data?.data ?? []}
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createEvent.isPending || updateEvent.isPending}
            >
              {(createEvent.isPending || updateEvent.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {formMode?.kind === "edit" ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Event Details dialog ─────────────────────────────────────────
          Replaces the prior "click-to-delete" misbehaviour. Click an event
          on any view → opens this dialog. Edit / Delete are inside. */}
      <Dialog open={activeEvent !== null} onOpenChange={(open) => !open && setDetailEventId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          {activeEvent && (
            <EventDetailContent
              event={activeEvent}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => {
                openEdit(activeEvent);
                setDetailEventId(null);
              }}
              onDelete={() => setConfirmDeleteId(activeEvent.id)}
              onRemoveParticipant={(pid) => handleRemoveParticipant(activeEvent.id, pid)}
              participantRemoveBusy={removeParticipant.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the event from the calendar and notify any participants.
              The action is reversible only by an admin restoring the deleted row.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEvent.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleteEvent.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteEvent.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

/**
 * "View calendar of" combobox. Lists staff/buyers/sellers in three grouped
 * sections, supports type-ahead search across all three at once. Picking a
 * row sets the parent's filter; the calendar API then returns only events
 * where that user is assignedTo or in participants[].
 */
function UserSearchCombobox({
  users,
  value,
  onChange,
  loading,
  currentUserId,
}: {
  users: CalendarUserOption[];
  value: CalendarUserOption | null;
  onChange: (u: CalendarUserOption | null) => void;
  loading: boolean;
  /** Used to surface a "My calendar" shortcut at the top of the picker. */
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    return {
      staff: users.filter((u) => u.userType === "staff"),
      buyer: users.filter((u) => u.userType === "buyer"),
      seller: users.filter((u) => u.userType === "seller"),
    };
  }, [users]);

  // Find the current user inside the staff group so the "My calendar"
  // shortcut can pass the same shape the rest of the picker uses.
  const currentSelf = useMemo(
    () => users.find((u) => u.id === currentUserId && u.userType === "staff") ?? null,
    [users, currentUserId],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-card hover:bg-muted/60 min-w-[260px] justify-between"
          aria-haspopup="listbox"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            {value ? (
              <>
                {value.id === currentUserId ? (
                  // Visual shortcut so users know they're looking at their
                  // own calendar (the common default case).
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Me
                  </span>
                ) : (
                  <UserTypePill type={value.userType} />
                )}
                <span className="truncate">{value.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">All calendars</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start">
        <Command>
          <CommandInput placeholder="Search staff, buyers, sellers…" />
          {/*
            max-h is generous + overscroll-contain stops the wheel event
            from bubbling up to the parent (the Dialog body that ate the
            scroll in the original bug). The onWheelCapture stopPropagation
            is belt-and-suspenders for browsers that don't honor
            overscroll-behavior on a child correctly.
          */}
          <CommandList
            className="max-h-[60vh] overflow-y-auto overscroll-contain"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <CommandEmpty>
              {loading ? "Loading users…" : "No users found."}
            </CommandEmpty>
            {currentSelf && (
              // "My calendar" pseudo-row at the top so users can re-select
              // themselves quickly after browsing someone else's calendar.
              <CommandItem
                value="__me__"
                onSelect={() => {
                  onChange(currentSelf);
                  setOpen(false);
                }}
              >
                <span className="h-4 w-4 mr-2 rounded-full bg-primary/15 text-primary text-[10px] inline-flex items-center justify-center font-semibold">
                  Me
                </span>
                <span>My calendar</span>
              </CommandItem>
            )}
            <CommandItem
              value="__all__"
              onSelect={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>All calendars</span>
            </CommandItem>
            <UserGroup heading="Staff" items={grouped.staff} onPick={(u) => { onChange(u); setOpen(false); }} />
            <UserGroup heading="Buyers" items={grouped.buyer} onPick={(u) => { onChange(u); setOpen(false); }} />
            <UserGroup heading="Sellers" items={grouped.seller} onPick={(u) => { onChange(u); setOpen(false); }} />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UserGroup({
  heading,
  items,
  onPick,
}: {
  heading: string;
  items: CalendarUserOption[];
  onPick: (u: CalendarUserOption) => void;
}) {
  if (items.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {items.map((u) => {
        const Icon = PARTICIPANT_ICON[u.userType];
        return (
          <CommandItem
            key={`${u.userType}-${u.id}`}
            // Make the search string match by name OR email — Command compares
            // against `value`, so we cram both in there.
            value={`${u.name} ${u.email}`}
            onSelect={() => onPick(u)}
          >
            <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm">{u.name}</span>
              {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
            </div>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

function UserTypePill({ type }: { type: ParticipantType }) {
  const label = type === "staff" ? "Staff" : type === "buyer" ? "Buyer" : "Seller";
  const cls =
    type === "staff"
      ? "bg-blue-50 text-blue-700"
      : type === "buyer"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

// ── Create / Edit form ────────────────────────────────────────────────────

function EventForm({
  form,
  setForm,
  onBuyerSelect,
  buyers,
  sellers,
  staff,
  vehicles,
}: {
  form: EventForm;
  setForm: React.Dispatch<React.SetStateAction<EventForm>>;
  onBuyerSelect: (id: string) => void;
  buyers: { id: string; name: string; email: string; phone: string }[];
  sellers: { id: string; name: string; email: string; phone: string }[];
  staff: { id: string; name: string; email: string }[];
  vehicles: { id: string; title: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Event Title *"
          className="border rounded-lg px-3 py-2 text-sm bg-background md:col-span-2"
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as ClientEventType })}
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="testDrive">Test Drive</option>
          <option value="inspection">Inspection</option>
          <option value="meeting">Meeting</option>
          <option value="other">Other</option>
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        />
        <input
          type="time"
          value={form.time}
          onChange={(e) => setForm({ ...form, time: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        />
        <input
          type="number"
          value={form.duration}
          onChange={(e) => setForm({ ...form, duration: e.target.value })}
          placeholder="Duration (minutes)"
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        />
      </div>

      {/* Meeting type radio + Meet generator. Physical = hide Meet toggle. */}
      <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={form.meetingType === "physical"}
              onChange={() => setForm({ ...form, meetingType: "physical", createMeetLink: false })}
            />
            <MapPin className="h-3.5 w-3.5" /> Physical
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={form.meetingType === "virtual"}
              onChange={() => setForm({ ...form, meetingType: "virtual" })}
            />
            <Video className="h-3.5 w-3.5" /> Virtual
          </label>
        </div>
        {form.meetingType === "physical" ? (
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Address or place"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          />
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.createMeetLink}
                onChange={(e) => setForm({ ...form, createMeetLink: e.target.checked })}
              />
              <Video className="h-3.5 w-3.5 text-violet-500" />
              Create Google Meet link
            </label>
            <input
              value={form.meetLink}
              onChange={(e) => setForm({ ...form, meetLink: e.target.value })}
              placeholder="Or paste an existing meet/zoom/teams link"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              disabled={form.createMeetLink}
            />
            {form.createMeetLink && (
              <p className="text-xs text-muted-foreground">
                A Google Meet link will be generated when you save.
              </p>
            )}
          </div>
        )}
      </div>

      {/* CRM fields: buyer dropdown auto-fills customer details; vehicle + staff. */}
      <div className="grid md:grid-cols-2 gap-3">
        <select
          value={form.buyerId}
          onChange={(e) => onBuyerSelect(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="">Pick buyer (optional)…</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={form.vehicleId}
          onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="">Pick vehicle (optional)…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
        <select
          value={form.assignedToId}
          onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="">Assigned staff (optional)…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={form.customerName}
          onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          placeholder="Customer name (overrides buyer)"
          className="border rounded-lg px-3 py-2 text-sm bg-background"
        />
      </div>

      {/* Participants picker — multi-add from staff/buyers/sellers + ad-hoc email. */}
      <ParticipantPicker
        value={form.participants}
        onChange={(p) => setForm((f) => ({ ...f, participants: p }))}
        buyers={buyers}
        sellers={sellers}
        staff={staff}
      />

      <textarea
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder="Notes (optional)"
        rows={3}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
      />
    </div>
  );
}

function ParticipantPicker({
  value,
  onChange,
  buyers,
  sellers,
  staff,
}: {
  value: ParticipantInput[];
  onChange: (next: ParticipantInput[]) => void;
  buyers: { id: string; name: string; email: string }[];
  sellers: { id: string; name: string; email: string }[];
  staff: { id: string; name: string; email: string }[];
}) {
  const [open, setOpen] = useState(false);

  const allOptions = useMemo<CalendarUserOption[]>(
    () => [
      ...staff.map((s) => ({ id: s.id, userType: "staff" as const, name: s.name, email: s.email })),
      ...buyers.map((b) => ({ id: b.id, userType: "buyer" as const, name: b.name, email: b.email })),
      ...sellers.map((s) => ({ id: s.id, userType: "seller" as const, name: s.name, email: s.email })),
    ],
    [staff, buyers, sellers],
  );

  const isAlready = (userType: ParticipantType, userId: string) =>
    value.some((p) => p.userType === userType && p.userId === userId);

  const add = (opt: CalendarUserOption) => {
    if (isAlready(opt.userType, opt.id)) return;
    onChange([...value, { userType: opt.userType, userId: opt.id, name: opt.name, email: opt.email }]);
    setOpen(false);
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Participants</p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="text-xs flex items-center gap-1 text-primary hover:underline">
              <Plus className="h-3 w-3" /> Add participant
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[320px]" align="end">
            <Command>
              <CommandInput placeholder="Search staff, buyers, sellers…" />
              {/*
                Same fix as the "view calendar of" picker above — this one
                triggered the user-reported bug: the picker is opened from
                inside a Dialog (the Create/Edit Event form), so without
                overscroll-contain + stopPropagation, mouse-wheel events
                bubble to the dialog body and scroll the WHOLE FORM instead
                of the participant list. With these two tweaks the list
                scrolls cleanly.
              */}
              <CommandList
                className="max-h-[50vh] overflow-y-auto overscroll-contain"
                onWheelCapture={(e) => e.stopPropagation()}
              >
                <CommandEmpty>No matches.</CommandEmpty>
                <UserGroup
                  heading="Staff"
                  items={allOptions.filter((o) => o.userType === "staff")}
                  onPick={add}
                />
                <UserGroup
                  heading="Buyers"
                  items={allOptions.filter((o) => o.userType === "buyer")}
                  onPick={add}
                />
                <UserGroup
                  heading="Sellers"
                  items={allOptions.filter((o) => o.userType === "seller")}
                  onPick={add}
                />
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">No participants yet — add staff, buyers, or sellers.</p>
      ) : (
        <ul className="space-y-1">
          {value.map((p, i) => {
            const Icon = PARTICIPANT_ICON[p.userType];
            return (
              <li
                key={`${p.userType}-${p.userId ?? p.email ?? i}`}
                className="flex items-center justify-between text-sm bg-background border rounded-md px-2 py-1.5"
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <UserTypePill type={p.userType} />
                  <span className="truncate">{p.name}</span>
                  {p.email && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {p.email}</span>
                  )}
                </span>
                <button
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-red-600 p-1"
                  title="Remove"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Event Details (read view inside dialog) ──────────────────────────────

function EventDetailContent({
  event,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onRemoveParticipant,
  participantRemoveBusy,
}: {
  event: CalendarEventDisplay;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveParticipant: (participantId: string) => void;
  participantRemoveBusy: boolean;
}) {
  const meta = EVENT_TYPE_META[event.type];
  const Icon = TYPE_ICON[event.type];
  // Friendly status label — server enum uses snake_case, UI shows "No show".
  const statusLabel = event.status.replace("_", " ");
  // Pre-format the timing string once so the layout reads naturally.
  const dateStr = event.start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const sameDay = event.start.toDateString() === event.end.toDateString();
  const timeRange = sameDay
    ? `${event.time} – ${event.endTime}`
    : `${event.time} – ${event.end.toLocaleString(undefined, { month: "short", day: "numeric" })} ${event.endTime}`;

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${meta.tagColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-lg break-words">{event.title}</DialogTitle>
            <DialogDescription className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                {meta.label}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="capitalize">{statusLabel}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="capitalize">{event.meetingType}</span>
              {event.createdByName && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>created by {event.createdByName}</span>
                </>
              )}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
        {/* When + where in a single block — the headline scheduling data. */}
        <div className="text-sm space-y-1.5 border rounded-lg p-3 bg-muted/20">
          <p className="flex items-start gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">{dateStr}</span>
              <br />
              <span className="text-muted-foreground">{timeRange}</span>
            </span>
          </p>
          {event.meetingType === "physical" ? (
            <p className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className={event.location ? "" : "text-muted-foreground italic"}>
                {event.location || "No location set"}
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2">
              <Video className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
              <span className={event.meetLink ? "" : "text-muted-foreground italic"}>
                {event.meetLink ? "Virtual — Google Meet" : "Virtual — no link yet"}
              </span>
            </p>
          )}
        </div>

        {/* Prominent Google Meet join button. Block-level so it's the
            obvious primary action for virtual events. */}
        {event.meetingType === "virtual" && event.meetLink && (
          <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-3 space-y-2">
            <a
              href={event.meetLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              <Video className="h-4 w-4" />
              Join with Google Meet
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
            <p className="text-xs text-muted-foreground text-center break-all">
              {event.meetLink}
            </p>
          </div>
        )}

        {/*
          PEOPLE block — always rendered, with "—" placeholders for empty
          slots. The user explicitly asked for "creator, assignee, etc all
          the details" to be visible. Showing the slots even when empty
          confirms that the data model captures these fields, which was
          the root of the "I can't see who's involved" confusion.
        */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            People
          </p>
          <dl className="text-sm space-y-1.5 border rounded-lg p-3">
            <DetailRow label="Created by" value={event.createdByName} subValue={event.createdByEmail} />
            <DetailRow label="Assigned to" value={event.assignedToName} subValue={event.assignedToEmail} />
            <DetailRow
              label="Customer"
              value={event.customer === "—" ? undefined : event.customer}
              subValue={event.customerEmail}
            />
            <DetailRow label="Vehicle" value={event.vehicleTitle} />
          </dl>
        </div>

        {/* Participants — explicit attendees beyond the creator/assignee. */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Participants ({event.participants.length})
          </p>
          {event.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No additional participants — only the creator and assignee are attending.
            </p>
          ) : (
            <ul className="space-y-1">
              {event.participants.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  canRemove={canEdit}
                  busy={participantRemoveBusy}
                  onRemove={() => onRemoveParticipant(p.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Description / notes — last so they don't push the structured
            facts off-screen on a smaller dialog. */}
        {(event.description || event.notes) && (
          <div className="border rounded-lg p-3 text-sm space-y-2 bg-muted/10">
            {event.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Description
                </p>
                <p className="text-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
            {event.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Notes
                </p>
                <p className="text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="gap-2">
        {canDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
        {canEdit && (
          <Button onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit event
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/**
 * Key-value row used inside the event-detail People block. Always renders
 * the label so the data slot is visible; the value falls back to "—" with
 * an italic muted style so empty fields look intentional rather than
 * accidentally omitted.
 */
function DetailRow({
  label,
  value,
  subValue,
}: {
  label: string;
  value?: string;
  subValue?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground sm:w-24 sm:shrink-0">
        {label}
      </dt>
      <dd className="flex-1 min-w-0 break-words">
        {value ? (
          <span className="text-foreground">{value}</span>
        ) : (
          <span className="text-muted-foreground italic">—</span>
        )}
        {subValue && (
          <span className="block text-xs text-muted-foreground sm:inline sm:ml-1">
            {value ? `· ${subValue}` : subValue}
          </span>
        )}
      </dd>
    </div>
  );
}

function ParticipantRow({
  participant,
  canRemove,
  busy,
  onRemove,
}: {
  participant: Participant;
  canRemove: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const Icon = PARTICIPANT_ICON[participant.userType];
  return (
    <li className="flex items-center justify-between gap-2 text-sm border rounded-md px-2 py-1.5">
      <span className="flex items-center gap-2 min-w-0 flex-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <UserTypePill type={participant.userType} />
        <span className="truncate min-w-0">
          {participant.name}
          {participant.email && (
            <span className="text-xs text-muted-foreground hidden sm:inline"> · {participant.email}</span>
          )}
        </span>
        <span className="text-[10px] uppercase text-muted-foreground tracking-wide ml-1 shrink-0">
          {participant.status}
        </span>
      </span>
      {canRemove && (
        <button
          onClick={onRemove}
          disabled={busy}
          className="text-muted-foreground hover:text-red-600 p-1 disabled:opacity-50 shrink-0"
          title="Remove participant"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

// ── Calendar grid views ───────────────────────────────────────────────────

function MonthGrid({
  cursor,
  events,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEventDisplay[];
  onEventClick: (id: string) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
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
              <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full" : "text-muted-foreground"}`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e.id)}
                    title={buildTileTooltip(e)}
                    className={`block w-full text-left text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-90 ${EVENT_TYPE_META[e.type].tagColor}`}
                  >
                    {e.time} {e.title.split("–")[0].trim()}
                  </button>
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

function WeekStrip({
  cursor,
  events,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEventDisplay[];
  onEventClick: (id: string) => void;
}) {
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
              <button
                key={e.id}
                onClick={() => onEventClick(e.id)}
                title={buildTileTooltip(e)}
                className={`block w-full text-left text-xs p-2 rounded mb-1 cursor-pointer hover:opacity-90 ${EVENT_TYPE_META[e.type].tagColor}`}
              >
                <p className="font-medium">{e.time}</p>
                <p className="truncate">{e.title}</p>
                {/* Week view has room for assignee initials so the user can
                    glance at the tile and know whose event it is. */}
                {e.assignedToName && (
                  <p className="truncate opacity-90 text-[10px] mt-0.5">
                    · {e.assignedToName}
                  </p>
                )}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DayList({
  cursor,
  events,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEventDisplay[];
  onEventClick: (id: string) => void;
}) {
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
          const Icon = TYPE_ICON[e.type];
          return (
            <button
              key={e.id}
              onClick={() => onEventClick(e.id)}
              className="flex items-center gap-4 border rounded-lg p-4 w-full text-left hover:bg-muted/40"
              title="Click to view event"
            >
              <div className={`p-2 rounded-lg ${EVENT_TYPE_META[e.type].tagColor}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.customer} · {e.time} – {e.endTime}
                </p>
                {e.assignedToName && (
                  <p className="text-[11px] text-muted-foreground">Assigned: {e.assignedToName}</p>
                )}
              </div>
              {e.meetingType === "virtual" && e.meetLink && (
                <span className="text-xs bg-muted px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
                  <Video className="h-3 w-3" /> Join
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
