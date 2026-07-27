import { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/**
 * Storefront-themed status pill (dark surface). Semantic tones kept from v1:
 * success = sold-to-you, danger = sold, warning = archived, info = available.
 */
const toneClasses: Record<Tone, string> = {
  success: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  danger: "bg-[#DB2526]/20 text-[#ff8f8f] ring-[#DB2526]/45",
  info: "bg-white/10 text-white/90 ring-white/25",
  neutral: "bg-white/10 text-white/70 ring-white/20",
};

export default function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-inset ${toneClasses[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
