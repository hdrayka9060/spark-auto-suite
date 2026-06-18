import { Check } from "lucide-react";

interface JourneyStepperProps {
  steps: { key: string; label: string }[];
  currentKey: string;
}

/**
 * Horizontal stepper on desktop; horizontally-scrollable on mobile.
 * Past stages render as completed (filled + check), current as active
 * (ring + primary), future as muted.
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
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                    !done && !active && "bg-muted text-muted-foreground",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-xs font-medium ${
                    active ? "text-foreground" : done ? "text-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={`h-px w-8 sm:w-12 ${i < currentIdx ? "bg-primary" : "bg-border"}`}
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