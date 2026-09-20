/* SpinAuto — Web Push service worker.
   Shows an OS notification when a push arrives (even with the app closed) and
   focuses/opens the app at the notification's link when clicked. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'SpinAuto', body: event.data && event.data.text ? event.data.text() : '' };
  }
  const title = data.title || 'SpinAuto';
  // A tag is required for `renotify`. Group by type so repeats of the same kind
  // collapse into one entry, but `renotify` makes each new one still alert.
  const tag = data.type || 'spinauto';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    renotify: true, // re-alert (sound/banner) even when replacing a same-tag notification
    silent: false,  // request the OS default notification sound (Windows must allow it)
    vibrate: [200, 100, 200], // buzz on mobile; ignored on desktop
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        // Reuse an already-open tab if we have one.
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && url) {
            try { await client.navigate(url); } catch (e) { /* cross-origin / not allowed */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
