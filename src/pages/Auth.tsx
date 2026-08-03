import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();
  const { state, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (state.status === "authenticated") {
      navigate("/", { replace: true });
    }
  }, [state.status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success("Welcome back!");
      // The effect above handles navigation once state flips.
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // While restoring session, keep the page quiet
  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: brand panel */}
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
            Run your dealership like a <span className="text-amber-400">pro</span>.
          </h1>
          <p className="text-slate-300 text-lg max-w-md">
            Inventory, CRM, financing, marketing, and support — unified in one modern dashboard.
          </p>
        </div>
        <p className="text-xs text-slate-500 relative z-10">© 2026 SpinAuto CDMS</p>
        <div className="absolute -right-40 -bottom-40 w-[500px] h-[500px] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -left-20 top-20 w-[300px] h-[300px] rounded-full bg-primary/20 blur-3xl" />
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center">
            <img src="/assets/logo.png" alt="Spin Auto" className="h-9 w-auto object-contain" />
            <span className="font-display font-bold text-lg">SpinAuto</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm">
              Sign in to access your dealership dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
