// Service worker: receives web push messages and shows them as system
// notifications (Android, desktop, and iOS 16.4+ once the site is added to the
// Home Screen). Deliberately does no caching — it exists only for push.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'The Painted Painter', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'The Painted Painter';
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body || '',
        icon: '/IMG_7201.PNG',
        badge: '/IMG_7201.PNG',
        tag: payload.type || undefined,
        data: { link: payload.link || '/' },
      }),
      // Home-screen / dock badge where supported (best effort).
      self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : Promise.resolve(),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
