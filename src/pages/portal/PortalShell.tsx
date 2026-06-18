import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Car } from "lucide-react";

interface PortalShellProps {
  children: ReactNode;
}

/**
 * Mobile-first chrome shared by both customer portals.
 * - Sticky compact header with brand
 * - Constrained reading width on desktop
 * - Soft, trustworthy palette via design tokens
 */
export default function PortalShell({ children }: PortalShellProps) {
  const { pathname } = useLocation();
  const onSeller = pathname.startsWith("/seller");
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to={onSeller ? "/seller" : "/portal"} className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Car className="h-4 w-4" />
            </span>
            <span className="text-sm sm:text-base">AutoDealer</span>
            <span className="ml-1 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
              {onSeller ? "Seller portal" : "Buyer portal"}
            </span>
          </Link>
          <div className="flex items-center gap-1 rounded-full border bg-background p-0.5 text-xs">
            <Link
              to="/portal"
              className={`rounded-full px-3 py-1 transition ${
                !onSeller ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Buyer
            </Link>
            <Link
              to="/seller"
              className={`rounded-full px-3 py-1 transition ${
                onSeller ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Seller
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AutoDealer · This is a read-only customer view.
      </footer>
    </div>
  );
}