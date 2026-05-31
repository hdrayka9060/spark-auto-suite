import type { ReactNode } from "react";
import { useAuth, type PermissionAction } from "@/lib/auth-context";

/**
 * Conditionally render children when the current user holds a permission.
 *
 * Thin wrapper over `useAuth().hasPermission()` — the same check the sidebar
 * and PermissionRoute use, but for inline UI (buttons, menu items, table
 * row actions). Centralising it keeps every page's gating consistent with
 * the route-level + nav-level checks.
 *
 *   <Can module="Staff" action="edit">
 *     <button onClick={openInvite}>Invite Staff</button>
 *   </Can>
 *
 * `fallback` is optional — usually you want the button to simply disappear,
 * but you can pass a disabled placeholder or "ask an admin" hint where the
 * absence would be confusing (e.g. an entire empty toolbar).
 *
 * Note: this is a UX guard ONLY. The backend permissions guard is the real
 * authority. Hiding the button doesn't stop a determined client from POSTing
 * directly — the API will return 403 either way.
 */
interface CanProps {
  module: string;
  action?: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function Can({ module, action = "view", children, fallback = null }: CanProps) {
  const { hasPermission } = useAuth();
  return <>{hasPermission(module, action) ? children : fallback}</>;
}

/**
 * Hook variant — sometimes you need to gate logic, not just JSX. Returns a
 * stable boolean so you can `disabled={!can}` or `if (can) …`.
 */
export function useCan(module: string, action: PermissionAction = "view"): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(module, action);
}
