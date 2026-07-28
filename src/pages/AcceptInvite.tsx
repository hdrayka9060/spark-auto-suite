import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Accept-invite page. Lives at `/accept-invite?token=<raw>`. Public — no
 * auth required (the token IS the auth). Flow:
 *
 *   1. On mount, GET /auth/invite/:token → fetch the invitee's metadata
 *      so we can show a personalised welcome. 404 → "expired" state.
 *   2. User sets a password (validation matches /auth signup).
 *   3. POST /auth/accept-invite via auth-context.acceptInvite() — backend
 *      sets the password, flips status to ACTIVE, returns access + refresh
 *      tokens. We store them and navigate to `/`.
 *
 * No signup form involved. After this page, the user can log in normally
 * with email + the password they just set.
 */

const PASSWORD_RULE = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!PASSWORD_RULE.test(pw))
    return "Password must include uppercase, lowercase, and a number or symbol";
  return null;
}

interface InviteInfo {
  email: string;
  firstName: string;
  lastName: string;
  roleName: string | null;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { state, acceptInvite } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already-signed-in users hitting this URL by mistake should go home —
  // we don't want them to "accept" an invite for another account.
  useEffect(() => {
    if (state.status === "authenticated") {
      navigate("/", { replace: true });
    }
  }, [state.status, navigate]);

  // Fetch invite metadata on mount.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      setLoadError("Missing invite token");
      return;
    }
    api<InviteInfo>(`/auth/invite/${encodeURIComponent(token)}`, { auth: false })
      .then((info) => {
        if (cancelled) return;
        setInvite(info);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Invite link is invalid or has expired",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !invite) return;

    const pwError = validatePassword(password);
    if (pwError) {
      toast.error(pwError);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      await acceptInvite({ token, password });
      toast.success(`Welcome, ${invite.firstName}!`);
      // The state.status effect above will route to "/" once authenticated.
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not activate account";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center gap-2 justify-center">
            <img src="/assets/logo.png" alt="Spin Auto" className="h-9 w-auto object-contain" />
            <span className="font-display font-bold text-lg">SpinAuto</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Invite unavailable</h2>
            <p className="text-muted-foreground text-sm">
              {loadError ?? "This invitation link is no longer valid."}
            </p>
          </div>
          <Button onClick={() => navigate("/auth", { replace: true })} className="w-full h-11">
            Go to sign in
          </Button>
          <p className="text-xs text-muted-foreground">
            If you believe this is a mistake, ask your administrator to re-send the invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: brand panel (matches Auth.tsx for visual continuity) */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-between p-12 text-white relative overflow-hidden"
        style={{ background: "hsl(222 47% 11%)" }}
      >
        <div className="flex items-center gap-2">
          <img src="/assets/logo.png" alt="Spin Auto" className="h-10 w-auto object-contain" />
          <span className="font-display font-bold text-xl tracking-tight">SpinAuto</span>
        </div>
        <div className="relative z-10 space-y-4">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Welcome to the <span className="text-amber-400">team</span>.
          </h1>
          <p className="text-slate-300 text-lg max-w-md">
            Set your password to activate your account and access the dashboard.
          </p>
        </div>
        <p className="text-xs text-slate-500 relative z-10">© 2026 SpinAuto CDMS</p>
        <div className="absolute -right-40 -bottom-40 w-[500px] h-[500px] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -left-20 top-20 w-[300px] h-[300px] rounded-full bg-primary/20 blur-3xl" />
      </div>

      {/* Right: set-password form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center">
            <img src="/assets/logo.png" alt="Spin Auto" className="h-9 w-auto object-contain" />
            <span className="font-display font-bold text-lg">SpinAuto</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              You've been invited
            </h2>
            <p className="text-muted-foreground text-sm">
              Hi <span className="font-medium text-foreground">{invite.firstName}</span> — set a
              password to activate your account
              {invite.roleName ? (
                <>
                  {" "}as <span className="font-medium text-foreground">{invite.roleName}</span>
                </>
              ) : null}
              .
            </p>
            <p className="text-xs text-muted-foreground">
              Account: <span className="font-mono">{invite.email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters with uppercase, lowercase, and a number or symbol.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Activate account
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By activating your account you accept the dealership's usage policy.
          </p>
        </div>
      </div>
    </div>
  );
}
