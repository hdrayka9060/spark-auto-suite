import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Video, Car, Wrench } from "lucide-react";

const eventTypes = {
  testDrive: { label: "Test Drive", color: "bg-primary text-primary-foreground", icon: Car },
  inspection: { label: "Inspection", color: "bg-amber-500 text-white", icon: Wrench },
  meeting: { label: "Meeting", color: "bg-violet-500 text-white", icon: Video },
};

type EventType = keyof typeof eventTypes;

interface CalEvent {
  id: number;
  title: string;
  type: EventType;
  time: string;
  day: number;
  customer: string;
}

const events: CalEvent[] = [
  { id: 1, title: "Test Drive – Tesla Model 3", type: "testDrive", time: "10:00 AM", day: 30, customer: "Sarah Mitchell" },
  { id: 2, title: "Inspection – Audi A4", type: "inspection", time: "2:00 PM", day: 30, customer: "Robert Chen" },
  { id: 3, title: "Test Drive – BMW X5", type: "testDrive", time: "11:00 AM", day: 31, customer: "Chris Johnson" },
  { id: 4, title: "Google Meet – Finance Review", type: "meeting", time: "3:00 PM", day: 31, customer: "Internal" },
  { id: 5, title: "Test Drive – Ford F-150", type: "testDrive", time: "9:00 AM", day: 1, customer: "Mike Rodriguez" },
  { id: 6, title: "Inspection – Honda Accord", type: "inspection", time: "1:00 PM", day: 2, customer: "Amanda Taylor" },
];

const views = ["Day", "Week", "Month"] as const;
const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthDays = Array.from({ length: 31 }, (_, i) => i + 1);

export default function CalendarPage() {
  const [view, setView] = useState<typeof views[number]>("Month");
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="module-header">
        <div>
          <h1 className="module-title">Calendar</h1>
          <p className="text-muted-foreground text-sm">Manage test drives, inspections, and meetings</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-card border rounded-lg overflow-hidden">
            {views.map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-sm font-medium ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{v}</button>
            ))}
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Add Event
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold">New Event</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <input placeholder="Event Title" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <select className="border rounded-lg px-3 py-2 text-sm bg-background">
              <option>Test Drive</option><option>Inspection</option><option>Meeting</option>
            </select>
            <input placeholder="Customer" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input type="time" className="border rounded-lg px-3 py-2 text-sm bg-background" />
            <input placeholder="Google Meet Link (optional)" className="border rounded-lg px-3 py-2 text-sm bg-background" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Save Event</button>
          </div>
        </div>
      )}

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button className="p-1 hover:bg-muted rounded"><ChevronLeft className="h-4 w-4" /></button>
            <h3 className="font-display font-semibold">March 2026</h3>
            <button className="p-1 hover:bg-muted rounded"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex gap-3">
            {Object.entries(eventTypes).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${val.color}`} />
                {val.label}
              </div>
            ))}
          </div>
        </div>

        {view === "Month" && (
          <div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-t-lg overflow-hidden">
              {daysOfWeek.map((d) => (
                <div key={d} className="bg-muted py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-b-lg overflow-hidden">
              {/* Empty cells for offset (March 2026 starts on Sunday) */}
              {monthDays.map((day) => {
                const dayEvents = events.filter((e) => e.day === day);
                const isToday = day === 30;
                return (
                  <div key={day} className={`bg-card min-h-[90px] p-1.5 ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}>
                    <span className={`text-xs font-medium ${isToday ? "bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full" : "text-muted-foreground"}`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.map((e) => (
                        <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${eventTypes[e.type].color}`}>{e.time} {e.title.split("–")[0]}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "Week" && (
          <div className="grid grid-cols-7 gap-2">
            {["Mon 25", "Tue 26", "Wed 27", "Thu 28", "Fri 29", "Sat 30", "Sun 31"].map((d, i) => {
              const dayNum = 25 + i;
              const dayEvents = events.filter((e) => e.day === dayNum);
              return (
                <div key={d} className="border rounded-lg p-2 min-h-[200px]">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{d}</p>
                  {dayEvents.map((e) => (
                    <div key={e.id} className={`text-xs p-2 rounded mb-1 ${eventTypes[e.type].color}`}>
                      <p className="font-medium">{e.time}</p>
                      <p className="truncate">{e.title}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {view === "Day" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">March 30, 2026 (Today)</p>
            {events.filter((e) => e.day === 30).map((e) => (
              <div key={e.id} className="flex items-center gap-4 border rounded-lg p-4">
                <div className={`p-2 rounded-lg ${eventTypes[e.type].color}`}>
                  {(() => { const Icon = eventTypes[e.type].icon; return <Icon className="h-4 w-4" />; })()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.customer} · {e.time}</p>
                </div>
                {e.type === "meeting" && <button className="text-xs bg-muted px-3 py-1.5 rounded-lg">Join Meet</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
