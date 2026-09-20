/**
 * Web Push (OS notifications) client helpers. Registers the service worker,
 * requests permission, subscribes with the server's VAPID public key, and
 * stores/removes the subscription on the backend. Per-device: subscribing on a
 * phone and a laptop are independent.
 */
import { api } from "@/lib/api";

export type PushState =
  | "unsupported" // browser can't do web push (or iOS Safari not installed as PWA)
  | "denied" // user blocked notifications in the browser
  | "default" // not yet asked
  | "granted-off" // permission granted but this device isn't subscribed
  | "on"; // subscribed on this device

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  const reg = existing ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  return reg;
}

/** Current push state on this device (for rendering the toggle). */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) return "on";
  return Notification.permission === "granted" ? "granted-off" : "default";
}

/** Request permission + subscribe this device. Returns the resulting state. */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  const cfg = await api<{ enabled: boolean; publicKey: string }>("/notifications/push/public-key");
  if (!cfg?.enabled || !cfg.publicKey) {
    throw new Error("Push notifications aren't configured on the server.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "default";

  const reg = await ensureRegistration();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
  });
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
  await api("/notifications/push/subscribe", {
    method: "POST",
    body: { endpoint: json.endpoint, keys: json.keys },
  });
  return "on";
}

/** Unsubscribe this device. */
export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await api("/notifications/push/unsubscribe", {
      method: "POST",
      body: { endpoint: sub.endpoint },
    }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return getPushState();
}
