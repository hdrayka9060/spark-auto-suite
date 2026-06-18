import { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<Tone, string> = {
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  danger: "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-rose-500/20",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

export default function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current opacity-70`} />
      {children}
    </span>
  );
}