import {
  LayoutDashboard,
  Car,
  Users,
  UserCheck,
  DollarSign,
  CreditCard,
  Megaphone,
  Globe,
  CalendarDays,
  HeadphonesIcon,
  Settings,
  MessageSquare,
  Target,
  Store,
  Shield,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Single source of truth for the sidebar nav + route-permission mapping.
 *
 * `label` MUST exactly match an AppModule string in the backend
 * (`cdms-backend/src/common/permissions.ts`). The strings double as the lookup
 * key in `role.permissions[].module`, so a typo silently strips access for
 * everyone — beware the en-dash ("–", U+2013) in "CRM – Sellers" and
 * "CRM – Buyers".
 *
 * Used by:
 *   - <AppLayout> to render the sidebar (filtered by `hasPermission`)
 *   - <PermissionRoute> to gate page-level access
 *   - `usePermissionFallbackPath()` to redirect users away from pages they
 *     can't view (e.g. when Dashboard is no longer their default landing).
 */
export interface NavItem {
  /** Module label — must match an AppModule enum value on the backend. */
  label: string;
  icon: LucideIcon;
  path: string;
  /**
   * When true, the item is kept in this list (so `moduleForPath` + route
   * permission gating still resolve) but is NOT rendered in the sidebar.
   * Used to temporarily retire modules that are pending a rebuild — flip the
   * flag off to bring the tab back. See <AppLayout> which filters on it.
   */
  hidden?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Inventory", icon: Car, path: "/inventory" },
  { label: "CRM – Sellers", icon: Users, path: "/crm-sellers" },
  { label: "CRM – Buyers", icon: UserCheck, path: "/crm-buyers" },
  { label: "Leads & Sales", icon: Target, path: "/leads" },
  { label: "Accounting", icon: DollarSign, path: "/accounting" },
  // Hidden pending rebuild — keep entries so routing/permissions still resolve.
  { label: "BHPH", icon: CreditCard, path: "/bhph", hidden: true },
  { label: "Digital Marketing", icon: Megaphone, path: "/marketing" },
  { label: "Dealer Website", icon: Globe, path: "/dealer-website" },
  { label: "Dealer Marketplace", icon: Store, path: "/marketplace" },
  { label: "Calendar", icon: CalendarDays, path: "/calendar" },
  { label: "Communication", icon: MessageSquare, path: "/communication", hidden: true },
  { label: "Support", icon: HeadphonesIcon, path: "/support", hidden: true },
  { label: "Staff", icon: UserCog, path: "/staff" },
  { label: "Roles", icon: Shield, path: "/roles" },
  { label: "Settings", icon: Settings, path: "/settings", hidden: true },
];

/**
 * Resolve which AppModule a given URL belongs to. Detail routes inherit the
 * module of their list page (e.g. `/inventory/:id` → "Inventory"). Anything
 * unmapped returns `null` — callers should treat that as "no permission
 * required" (e.g. `/settings/profile` could later opt in to Settings).
 */
export function moduleForPath(pathname: string): string | null {
  // Exact match first (handles `/`).
  const exact = navItems.find((n) => n.path === pathname);
  if (exact) return exact.label;
  // Prefix match — but NOT `/` because every path starts with `/`.
  const prefix = navItems.find(
    (n) => n.path !== "/" && pathname.startsWith(n.path + "/"),
  );
  return prefix?.label ?? null;
}
