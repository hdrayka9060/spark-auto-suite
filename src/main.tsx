import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker on load so the app is installable (PWA) and the
// Web Push worker is ready. It has no fetch handler — no offline caching, just
// push/notification handling. Best-effort; ignored where unsupported.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
