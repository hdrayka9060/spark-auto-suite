/**
 * Per-user notification preferences card (6 categories × in-app / email).
 * Shared by the admin Settings page and the standalone `/account/notifications`
 * route so every staff member can manage their own preferences — the backend
 * endpoints (`GET|PATCH /notifications/prefs`) are per-user and ungated.
 */
import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Save } from "lucide-react";
import { ApiError } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { NOTIFICATION_CATEGORIES, type NotificationPrefs } from "@/lib/notifications-mapper";
import { useNotificationPrefs, useUpdateNotificationPrefs } from "@/hooks/api/use-notifications";
import { getPushState, enablePush, disablePush, type PushState } from "@/lib/push";

/** "Push notifications on this device" — registers/unregisters Web Push. */
function PushSection() {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  const on = state === "on";
  const canToggle = !busy && (state === "on" || state === "default" || state === "granted-off");

  const toggle = async () => {
    setBusy(true);
    try {
      const next = on ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") toast({ title: "Push notifications enabled on this device" });
      else if (next === "denied")
        toast({ title: "Notifications are blocked", description: "Allow them for this site in your browser settings, then reload.", variant: "destructive" });
    } catch (e) {
      toast({ title: "Couldn't change push setting", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const hint =
    state === "loading" ? "Checking…"
    : state === "unsupported" ? "Not supported on this browser. On iPhone, add SpinAuto to your Home Screen first, then enable it there."
    : state === "denied" ? "Blocked — allow notifications for this site in your browser settings, then reload."
    : on ? "You’ll get alerts on this device whether SpinAuto is open or closed."
    : "Get alerts on this device whether SpinAuto is open or closed.";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {on ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>
        <div>
          <p className="font-medium text-sm">Push notifications on this device</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
          {on && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Fires for every category with <strong>Push</strong> enabled below (all on by default).
            </p>
          )}
        </div>
      </div>
      {state === "loading" || busy ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <button type="button" onClick={toggle} disabled={!canToggle} className="shrink-0 disabled:opacity-40" aria-label="Toggle push notifications">
          <span className={`block w-11 h-6 rounded-full relative transition-colors ${on ? "bg-primary" : "bg-gray-300"} after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform ${on ? "after:translate-x-5" : ""}`} />
        </button>
      )}
    </div>
  );
}

/** A single on/off pill toggle. */
function PrefToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function NotificationPreferences() {
  const prefsQuery = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const [prefs, setPrefs] = useState<NotificationPrefs>({});

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  if (prefsQuery.isLoading) {
    return (
      <div className="stat-card text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
      </div>
    );
  }

  const on = (cat: string, ch: "inApp" | "email" | "push") => prefs[cat]?.[ch] ?? true;
  const toggle = (cat: string, ch: "inApp" | "email" | "push") =>
    setPrefs((p) => {
      const cur = {
        inApp: p[cat]?.inApp ?? true,
        email: p[cat]?.email ?? true,
        push: p[cat]?.push ?? true,
      };
      return { ...p, [cat]: { ...cur, [ch]: !cur[ch] } };
    });

  const handleSave = async () => {
    try {
      await updatePrefs.mutateAsync(prefs);
      toast({ title: "Notification preferences saved" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="stat-card space-y-4">
      <h3 className="font-display font-semibold">Notification Preferences</h3>
      <p className="text-xs text-muted-foreground -mt-2">
        Choose how you&apos;re notified. <strong>In-app</strong> shows in the bell; <strong>Email</strong> is sent
        for every alert your preferences allow; <strong>Push</strong> reaches this device whether the app is open or closed.
      </p>

      <PushSection />

      <div className="space-y-3">
        <div className="hidden sm:flex items-center justify-end gap-8 pr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="w-11 text-center">In-app</span>
          <span className="w-11 text-center">Email</span>
          <span className="w-11 text-center">Push</span>
        </div>
        {NOTIFICATION_CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{cat.hint}</p>
            </div>
            <div className="flex items-center gap-8">
              <PrefToggle checked={on(cat.key, "inApp")} onChange={() => toggle(cat.key, "inApp")} />
              <PrefToggle checked={on(cat.key, "email")} onChange={() => toggle(cat.key, "email")} />
              <PrefToggle checked={on(cat.key, "push")} onChange={() => toggle(cat.key, "push")} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={updatePrefs.isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {updatePrefs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Preferences
        </button>
      </div>
    </div>
  );
}
