import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Car, Users, UserCheck, DollarSign, CreditCard,
  Megaphone, Globe, CalendarDays, HeadphonesIcon, Settings, MessageSquare,
  ChevronLeft, ChevronRight, Bell, Search, User
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Inventory", icon: Car, path: "/inventory" },
  { label: "CRM – Sellers", icon: Users, path: "/crm-sellers" },
  { label: "CRM – Buyers", icon: UserCheck, path: "/crm-buyers" },
  { label: "Accounting", icon: DollarSign, path: "/accounting" },
  { label: "BHPH", icon: CreditCard, path: "/bhph" },
  { label: "Digital Marketing", icon: Megaphone, path: "/marketing" },
  { label: "Dealer Website", icon: Globe, path: "/dealer-website" },
  { label: "Calendar", icon: CalendarDays, path: "/calendar" },
  { label: "Communication", icon: MessageSquare, path: "/communication" },
  { label: "Support", icon: HeadphonesIcon, path: "/support" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

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

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{item.label}</span>}
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
                <p className="font-medium leading-none">John Dealer</p>
                <p className="text-muted-foreground text-xs">Admin</p>
              </div>
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
