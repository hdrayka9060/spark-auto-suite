import { useState } from "react";
import { CalendarRange, ChevronDown, ChevronLeft } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import {
  PERIOD_PRESETS, PeriodPreset, fmtDate, periodLabel, rangeFromPreset,
} from "@/lib/period-helpers";

/**
 * Compact dropdown that lets the user pick a preset (Today / This Week /
 * ... / All Time) or a custom date range. Drives a single source of truth:
 * the parent's `{ preset, startDate, endDate }` triple. Used on the
 * Accounting and Dashboard headers; one component, one mental model.
 *
 * The parent decides what to filter — the selector only emits the dates.
 */
export interface TimePeriodSelectorProps {
  /** Currently selected preset (drives the trigger label). */
  preset: PeriodPreset;
  /** YYYY-MM-DD local-date strings; empty = no bound. */
  rangeStart: string;
  rangeEnd: string;
  /** Called when the user picks ANY preset (including via Clear). */
  onChange: (next: { preset: PeriodPreset; startDate: string; endDate: string }) => void;
  /** Optional aria-label for the trigger button; default works for screen readers. */
  ariaLabel?: string;
  /** Optional className override on the trigger button. */
  className?: string;
}

export function TimePeriodSelector({
  preset,
  rangeStart,
  rangeEnd,
  onChange,
  ariaLabel = "Pick time period",
  className,
}: TimePeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"presets" | "custom">("presets");

  const apply = (p: PeriodPreset) => {
    const { startDate, endDate } = rangeFromPreset(p);
    onChange({ preset: p, startDate, endDate });
    setView("presets");
    setOpen(false);
  };

  const label = periodLabel(preset, rangeStart, rangeEnd);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset to the presets list whenever the popover closes so the next
        // open isn't stuck on whatever the previous user state was.
        if (!next) setView("presets");
      }}
    >
      <PopoverTrigger asChild>
        <button
          aria-label={ariaLabel}
          className={
            className ??
            "flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-background hover:bg-muted/60 min-w-[170px] justify-between"
          }
        >
          <span className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{label}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {view === "presets" ? (
          <div className="p-1 min-w-[190px]">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => apply(p.value)}
                className={`w-full text-left text-sm px-3 py-2 rounded hover:bg-muted ${
                  preset === p.value ? "bg-muted font-medium" : ""
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="border-t my-1" />
            <button
              onClick={() => setView("custom")}
              className={`w-full text-left text-sm px-3 py-2 rounded hover:bg-muted flex items-center gap-2 ${
                preset === "custom" ? "bg-muted font-medium" : ""
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Custom range…
            </button>
          </div>
        ) : (
          <div className="p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <button
                onClick={() => setView("presets")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ChevronLeft className="h-3 w-3" /> Presets
              </button>
              <span className="text-xs font-medium">Custom range</span>
            </div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={{
                from: rangeStart ? new Date(rangeStart) : undefined,
                to: rangeEnd ? new Date(rangeEnd) : undefined,
              }}
              onSelect={(range: DateRange | undefined) => {
                onChange({
                  preset: "custom",
                  startDate: range?.from ? fmtDate(range.from) : "",
                  endDate: range?.to ? fmtDate(range.to) : "",
                });
              }}
              initialFocus
            />
            <div className="flex items-center justify-end gap-2 border-t p-2">
              <button
                onClick={() => apply("all")}
                className="text-xs px-2 py-1 rounded hover:bg-muted"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
