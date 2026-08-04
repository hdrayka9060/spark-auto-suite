import { ReactNode, useEffect } from "react";
import { Car } from "lucide-react";

/**
 * Public Buyer Portal chrome — v2, styled to match the Spin Auto storefront
 * (dark #222 surface, brand red #DB2526, Play display + Roboto body fonts).
 *
 * The admin app doesn't ship the storefront's Google Fonts or Tailwind tokens,
 * so this shell is fully self-contained: it injects the fonts once and scopes
 * the display font to a `.portal-v2` wrapper. Colors are applied via arbitrary
 * Tailwind values so nothing here leaks into the rest of the admin app.
 */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Play:wght@400;700&family=Roboto:wght@300;400;500;700&display=swap";

const SCOPED_CSS = `
.portal-v2 { font-family: "Roboto", Arial, system-ui, sans-serif; }
.portal-v2 .disp { font-family: "Play", system-ui, sans-serif; }
`;

export default function PortalShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (document.getElementById("portal-v2-fonts")) return;
    const link = document.createElement("link");
    link.id = "portal-v2-fonts";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  return (
    <div className="portal-v2 h-screen overflow-y-auto bg-[#222222] text-[#e8e8e8]">
      <style>{SCOPED_CSS}</style>

      <header className="sticky top-0 z-30 border-b border-[#3a3a3a] bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-[#DB2526] text-white">
              <Car className="h-4 w-4" />
            </span>
            <span className="disp text-base font-bold uppercase tracking-widest text-white">Spin Auto</span>
            <span className="ml-1 hidden rounded-full border border-[#DB2526]/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#DB2526] sm:inline">
              Buyer Portal
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6 pb-24">{children}</main>

      <footer className="border-t border-[#3a3a3a] bg-black">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Spin Auto Ltd. · This is a read-only customer view.
        </div>
      </footer>
    </div>
  );
}
