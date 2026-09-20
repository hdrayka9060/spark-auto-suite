import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { isPushSupported, getPushState, enablePush } from "@/lib/push";

/** Set once we've auto-enabled (or tried) on this device, so we don't re-ask. */
const TRIED_FLAG = "cdms.pushAutoTried";

/**
 * Push ON by default: a few seconds after an authenticated user loads the app,
 * we automatically enable desktop/OS push IF:
 *   • the browser supports web push,
 *   • this device hasn't decided yet (permission "default", not subscribed),
 *   • the server has push enabled (VAPID configured), and
 *   • we haven't already tried on this device.
 * `enablePush()` triggers the browser's native permission prompt and subscribes
 * on grant. We try once per device — if the user denies (or the browser needs a
 * gesture and ignores it), they can still flip the toggle in Account →
 * Notifications. Best-effort; never blocks the app.
 */
export function usePushAutoPrompt(active: boolean): void {
  useEffect(() => {
    if (!active || !isPushSupported()) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        if (localStorage.getItem(TRIED_FLAG)) return;
        if ((await getPushState()) !== "default") return; // already on / denied / granted
        const cfg = await api<{ enabled: boolean }>("/notifications/push/public-key").catch(() => null);
        if (!cfg?.enabled || cancelled) return;

        // Only auto-try once per device — the native permission prompt shouldn't
        // reappear on every login.
        try { localStorage.setItem(TRIED_FLAG, "1"); } catch { /* private mode */ }

        const state = await enablePush(); // pops the native permission prompt
        if (cancelled) return;
        if (state === "on") {
          toast({
            title: "Desktop notifications on",
            description: "You'll get new leads, sales and reminders as alerts — whether the app is open or closed.",
          });
        }
        // denied / default → stay silent; the Account → Notifications toggle remains.
      } catch {
        /* best-effort — never break the app over push setup */
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);
}
