import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldOff } from "lucide-react";
import { useAuth, type PermissionAction } from "@/lib/auth-context";
import { moduleForPath, navItems } from "@/config/nav";

/**
 * Page-level permission gate.
 *
 * Wraps a route element. Auth check is delegated to <ProtectedRoute> (which
 * stays one level out in App.tsx); this layer ONLY checks the permission
 * matrix and redirects/renders an "access denied" stub when the current
 * role lacks the required permission.
 *
 * Three modes:
 *   1. `module` prop given → checks that exact module string.
 *   2. `module` omitted → resolves from the URL via `moduleForPath()`. This
 *      keeps `App.tsx` declarative: most routes just need `<PermissionRoute>`
 *      and we infer the module from `/inventory`, `/staff`, etc.
 *   3. `moduleForPath` returns null (e.g. an unknown route) → renders
 *      children with no permission check. Lets us add new routes incrementally
 *      without forcing each one into the nav config first.
 *
 * On denial we don't infinite-loop: we redirect to the first nav item the
 * user CAN view. If they have no nav permissions at all, we render a stub
 * page (signed-in but locked-out) instead of bouncing to /auth — the user
 * IS authenticated, the admin just hasn't granted them anything yet.
 */
interface PermissionRouteProps {
  children: ReactNode;
  module?: string;
  /** Defaults to "view" — the only sane page-level gate. Edit/Delete are
   *  per-button gates handled by `<Can>` / `hasPermission()`. */
  action?: PermissionAction;
}

export default function PermissionRoute({
  children,
  module,
  action = "view",
}: PermissionRouteProps) {
  const { state, hasPermission } = useAuth();
  const location = useLocation();

  // Resolve the module to check. Explicit prop wins; otherwise derive from URL.
  const resolvedModule = module ?? moduleForPath(location.pathname);

  // While the auth context is still hydrating, render a centred spinner — the
  // same affordance ProtectedRoute uses. Stops "denied" from flashing during
  // the brief window between mount and /users/me resolving.
  if (state.status === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not yet signed in — ProtectedRoute should have caught this already, but
  // guard defensively in case someone wraps PermissionRoute without it.
  if (state.status !== "authenticated") {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // No mapping for this URL → don't gate (e.g. NotFound, future ungated pages).
  if (!resolvedModule) return <>{children}</>;

  // Permission granted → render normally.
  if (hasPermission(resolvedModule, action)) return <>{children}</>;

  // Denied. Find the first nav item the user CAN see and redirect there.
  // If none, render the locked-out stub so they don't bounce in a redirect
  // loop on `/` (which itself requires Dashboard view).
  const fallback = navItems.find((n) => hasPermission(n.label, "view"));
  if (fallback && fallback.path !== location.pathname) {
    return <Navigate to={fallback.path} replace />;
  }
  return <NoAccessStub module={resolvedModule} action={action} />;
}

/**
 * Stub shown only when an authenticated user has zero `view` permissions on
 * any sidebar module. Rare — usually means the admin invited them but
 * forgot to set up their role. Keeps the app navigable (logout works) and
 * explains the situation instead of redirect-looping.
 */
function NoAccessStub({ module, action }: { module: string; action: PermissionAction }) {
  // Tiny delay before showing so a fast role re-fetch doesn't flash this.
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, []);

  const message = useMemo(
    () => `You don't have ${action} access to ${module}. Ask an administrator to update your role.`,
    [module, action],
  );

  if (!show) return null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <ShieldOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="font-display font-semibold text-lg">No access</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
