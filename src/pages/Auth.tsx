import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PASSWORD_RULE = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!PASSWORD_RULE.test(pw))
    return "Password must include uppercase, lowercase, and a number or symbol";
  return null;
}

export default function Auth() {
  const navigate = useNavigate();
  const { state, login, register } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dealershipName, setDealershipName] = useState("");
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

    if (mode === "signup") {
      const pwError = validatePassword(password);
      if (pwError) {
        toast.error(pwError);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await register({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          dealershipName: dealershipName.trim() || undefined,
        });
        toast.success("Account created — welcome!");
      } else {
        await login(email.trim(), password);
        toast.success("Welcome back!");
      }
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
          <Car className="h-8 w-8 text-amber-400" />
          <span className="font-display font-bold text-xl tracking-tight">AutoDealer</span>
        </div>
        <div className="relative z-10 space-y-4">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Run your dealership like a <span className="text-amber-400">pro</span>.
          </h1>
          <p className="text-slate-300 text-lg max-w-md">
            Inventory, CRM, financing, marketing, and support — unified in one modern dashboard.
          </p>
        </div>
        <p className="text-xs text-slate-500 relative z-10">© 2026 AutoDealer CDMS</p>
        <div className="absolute -right-40 -bottom-40 w-[500px] h-[500px] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -left-20 top-20 w-[300px] h-[300px] rounded-full bg-primary/20 blur-3xl" />
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center">
            <Car className="h-7 w-7 text-amber-500" />
            <span className="font-display font-bold text-lg">AutoDealer</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "signin"
                ? "Sign in to access your dealership dashboard."
                : "Get started managing your dealership today."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealershipName">Dealership name (optional)</Label>
                  <Input
                    id="dealershipName"
                    value={dealershipName}
                    onChange={(e) => setDealershipName(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
              </>
            )}
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
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  At least 8 characters with uppercase, lowercase, and a number or symbol.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary font-medium hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
