import { Check } from "lucide-react";

interface JourneyStepperProps {
  steps: { key: string; label: string }[];
  currentKey: string;
}

/**
 * Horizontal stepper (scrolls on mobile), storefront-themed. Past stages render
 * completed (red + check), current active (red + ring), future muted.
 */
export default function JourneyStepper({ steps, currentKey }: JourneyStepperProps) {
  const currentIdx = Math.max(0, steps.findIndex((s) => s.key === currentKey));
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-2 px-1">
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={step.key} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition",
                    done && "bg-[#DB2526] text-white",
                    active && "bg-[#DB2526] text-white ring-4 ring-[#DB2526]/25",
                    !done && !active && "bg-[#3a3a3a] text-white/50",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-xs font-medium ${
                    active ? "text-white" : done ? "text-white/70" : "text-white/40"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={`h-px w-8 sm:w-12 ${i < currentIdx ? "bg-[#DB2526]" : "bg-[#3a3a3a]"}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
