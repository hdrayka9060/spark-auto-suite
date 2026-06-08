import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import {
  ChevronLeft, ChevronRight, Bell, Search, User, LogOut, Car,
} from "lucide-react";
import { navItems } from "@/config/nav";
import { useUnreadCount } from "@/hooks/api/use-messaging";
import { useFacebookUnreadCount } from "@/hooks/api/use-facebook";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { state, logout, hasPermission } = useAuth();
  // Unread chat badge on the Communication nav item (only fetched if the user
  // can see Communication, so non-members don't 403 in a loop).
  const unreadQuery = useUnreadCount(hasPermission("Communication", "view"));
  const unreadTotal = unreadQuery.data?.total ?? 0;
  // Unread Facebook badge on the Facebook Listings nav item. The Inbox
  // (Messenger) tab is hidden for now, so we count only unread COMMENTS — the
  // sole Facebook surface the user can still act on. (Switch back to `.total`
  // to include unread messages when the Inbox is re-enabled.)
  const fbUnreadQuery = useFacebookUnreadCount(hasPermission("Facebook Listings", "view"));
  const fbUnreadTotal = fbUnreadQuery.data?.comments ?? 0;
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
      {/* Sidebar */}
      <aside
        className={`${collapsed ? "w-[68px]" : "w-[240px]"} flex flex-col transition-all duration-200 shrink-0`}
        style={{ background: "hsl(222 47% 11%)" }}
      >
        <div className="flex items-center gap-2 h-16 px-4 border-b" style={{ borderColor: "hsl(222 30% 20%)" }}>
          <Car className="h-7 w-7 text-amber-400 shrink-0" />
          {!collapsed && <span className="font-display font-bold text-lg text-white tracking-tight">AutoDealer</span>}
        </div>

        <nav
          className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleNavItems.map((item) => {
            const active =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
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
                {item.label === "Facebook Listings" && fbUnreadTotal > 0 && (
                  collapsed ? (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                  ) : (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                      {fbUnreadTotal > 99 ? "99+" : fbUnreadTotal}
                    </span>
                  )
                )}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t text-slate-400 hover:text-white transition-colors"
          style={{ borderColor: "hsl(222 30% 20%)" }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3 bg-muted rounded-lg px-3 py-2 w-80">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vehicles, customers, leads..."
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
            </button>
            <div className="flex items-center gap-2 pl-4 border-l">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-sm">
                <p className="font-medium leading-none">{displayName}</p>
                <p className="text-muted-foreground text-xs">{roleLabel || "Dealer"}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
