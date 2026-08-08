import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import {
  ChevronLeft, ChevronRight, Bell, Search, User, LogOut, Menu,
} from "lucide-react";
import { navItems } from "@/config/nav";
import { useUnreadCount } from "@/hooks/api/use-messaging";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const SIDEBAR_BG = "hsl(222 47% 11%)";
const SIDEBAR_BORDER = "hsl(222 30% 20%)";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  // Mobile (<768px) nav is an off-canvas drawer instead of the fixed sidebar.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // The page content scrolls inside <main>, not the window, and <main> mounts
  // once (persistent layout route) so its scroll offset would otherwise carry
  // over to the next page. Reset it to the top on every route change — including
  // browser Back/Forward — so each page opens at the top with no visible scroll.
  //   • `scrollRestoration = "manual"` stops the browser restoring the previous
  //     offset on Back/Forward before we reset it (avoids the flash/jump).
  //   • `behavior: "instant"` forces a hard jump; "auto" would defer to any CSS
  //     `scroll-behavior: smooth` and animate the reset.
  // Hash navigations are left alone so in-page anchor links still work.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);
  useEffect(() => {
    if (location.hash) return;
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname, location.hash]);
  const { state, logout, hasPermission } = useAuth();
  // Unread chat badge on the Communication nav item (only fetched if the user
  // can see Communication, so non-members don't 403 in a loop).
  const unreadQuery = useUnreadCount(hasPermission("Communication", "view"));
  const unreadTotal = unreadQuery.data?.total ?? 0;
  const user = state.status === "authenticated" ? state.user : null;
  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || user.email
    : "Dealer";
  const roleLabel = user?.roleId?.name ?? "";

  // Filter navigation items based on user permissions.
  // EVERY module (including Dashboard) requires explicit `view` permission on
  // its corresponding AppModule string — keep this loop generic so the matrix
  // in /roles is the single source of truth for what's visible.
  // The strings in `navItems[].label` MUST stay aligned with the AppModule
  // enum on the backend (`src/common/permissions.ts`) — they are the lookup
  // keys for the role.permissions[].module field. Beware the en-dash in
  // "CRM – Sellers" / "CRM – Buyers".
  // `hidden` retires a module from the sidebar (pending rebuild) regardless of
  // permission; the rest is the normal permission filter.
  const visibleNavItems = navItems.filter(
    (item) => !item.hidden && hasPermission(item.label, "view"),
  );

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden below md, replaced by the drawer */}
      <aside
        className={`${collapsed ? "w-[68px]" : "w-[240px]"} flex flex-col transition-all duration-200 shrink-0 max-md:hidden`}
        style={{ background: SIDEBAR_BG }}
      >
        <SidebarBody
          collapsed={collapsed}
          visibleNavItems={visibleNavItems}
          pathname={location.pathname}
          unreadTotal={unreadTotal}
          showCollapseButton
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>

      {/* Mobile drawer — same nav, always expanded, closes on navigate */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[240px] max-w-[85vw] p-0 gap-0 border-0 flex flex-col md:hidden"
          style={{ background: SIDEBAR_BG }}
        >
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarBody
            collapsed={false}
            visibleNavItems={visibleNavItems}
            pathname={location.pathname}
            unreadTotal={unreadTotal}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-6 max-md:px-4 shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden -ml-1 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Search — hidden on mobile to save space (placeholder, no handler) */}
            <div className="flex items-center gap-3 bg-muted rounded-lg px-3 py-2 w-80 max-md:hidden">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search vehicles, customers, leads..."
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
            </button>
            <div className="flex items-center gap-2 pl-4 border-l max-md:pl-2 max-md:border-l-0">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-sm max-md:hidden">
                <p className="font-medium leading-none">{displayName}</p>
                <p className="text-muted-foreground text-xs">{roleLabel || "Dealer"}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground max-md:ml-0"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6 max-md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The interior of the sidebar (logo + nav + footer + optional collapse toggle).
 * Rendered both by the desktop `<aside>` and the mobile drawer so the nav list,
 * active-state logic and unread badge stay in one place. `onNavigate` is fired
 * on link tap (used by the drawer to close itself); undefined on desktop.
 */
function SidebarBody({
  collapsed,
  visibleNavItems,
  pathname,
  unreadTotal,
  onNavigate,
  onToggleCollapse,
  showCollapseButton = false,
}: {
  collapsed: boolean;
  visibleNavItems: typeof navItems;
  pathname: string;
  unreadTotal: number;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseButton?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2 h-16 px-3 border-b shrink-0" style={{ borderColor: SIDEBAR_BORDER }}>
        <img
          src="/assets/logo.png"
          alt="Spin Auto"
          className="h-10 w-auto max-w-full object-contain shrink-0"
        />
        {!collapsed && (
          <span className="font-display font-bold text-lg text-white tracking-tight">SpinAuto</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {visibleNavItems.map((item) => {
          const active =
            item.path === "/"
              ? pathname === "/"
              : pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {item.label === "Communication" && unreadTotal > 0 && (
                collapsed ? (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400" />
                ) : (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-semibold flex items-center justify-center">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                )
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div
          className="px-4 py-2 text-[10px] leading-tight text-slate-500 border-t"
          style={{ borderColor: SIDEBAR_BORDER }}
        >
          Developed by Dash Technologies
        </div>
      )}

      {showCollapseButton && (
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center h-10 border-t text-slate-400 hover:text-white transition-colors"
          style={{ borderColor: SIDEBAR_BORDER }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}
    </>
  );
}
