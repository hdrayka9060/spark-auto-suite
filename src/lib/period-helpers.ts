/**
 * Period-selector helpers. Shared between the Accounting and Dashboard pages
 * (and any other page that needs a "Today / This Month / Custom range" filter).
 *
 * The string union `PeriodPreset` plus the YYYY-MM-DD output `{ startDate,
 * endDate }` pair is the contract every consumer relies on:
 *   - empty strings on both sides ⇒ "no filter" (all-time)
 *   - "custom" is reserved for ranges the user picked on the calendar that
 *     don't match any preset
 *
 * Date strings are LOCAL `YYYY-MM-DD`. Using `Date#toISOString().slice(0, 10)`
 * silently shifts to UTC and produced off-by-one-day bugs in IST during smoke
 * testing — `fmtDate` below is the safe alternative.
 */

export type PeriodPreset =
  | "today" | "yesterday" | "week" | "month" | "quarter" | "year" | "all" | "custom";

export const PERIOD_PRESETS: { value: Exclude<PeriodPreset, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

/**
 * Format a Date as YYYY-MM-DD in LOCAL time. Do NOT switch this to
 * `toISOString` — the API accepts naive date strings and any TZ shift causes
 * a one-day boundary error for users east of UTC.
 */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeFromPreset(preset: PeriodPreset): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { startDate: fmtDate(today), endDate: fmtDate(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { startDate: fmtDate(y), endDate: fmtDate(y) };
    }
    case "week": {
      // Week starting Monday — Sunday = 0 in JS so coerce to 7.
      const day = today.getDay() || 7;
      const start = new Date(today);
      start.setDate(today.getDate() - (day - 1));
      return { startDate: fmtDate(start), endDate: fmtDate(today) };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmtDate(start), endDate: fmtDate(today) };
    }
    case "quarter": {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      return { startDate: fmtDate(start), endDate: fmtDate(today) };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { startDate: fmtDate(start), endDate: fmtDate(today) };
    }
    case "all":
    case "custom":
    default:
      return { startDate: "", endDate: "" };
  }
}

/**
 * Human-readable label for the current selection — drives the trigger button
 * text and the page subtitle. Pass the same triple the selector tracks.
 */
export function periodLabel(
  preset: PeriodPreset,
  rangeStart: string,
  rangeEnd: string,
): string {
  if (preset === "custom") {
    if (rangeStart && rangeEnd) return `${rangeStart} → ${rangeEnd}`;
    if (rangeStart) return `${rangeStart} → today`;
    if (rangeEnd) return `Up to ${rangeEnd}`;
    return "Custom";
  }
  return PERIOD_PRESETS.find((p) => p.value === preset)?.label ?? "All Time";
}
