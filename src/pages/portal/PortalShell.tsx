import { ReactNode } from "react";
import { Car } from "lucide-react";

interface PortalShellProps {
  children: ReactNode;
}

/**
 * Mobile-first chrome for the public Buyer Portal.
 * - Sticky compact header with brand
 * - Constrained reading width on desktop
 * - Read-only customer view (no app navigation, no auth)
 */
export default function PortalShell({ children }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Car className="h-4 w-4" />
            </span>
            <span className="text-sm sm:text-base">Spin Auto</span>
            <span className="ml-1 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
              Buyer portal
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Spin Auto · This is a read-only customer view.
      </footer>
    </div>
  );
}
