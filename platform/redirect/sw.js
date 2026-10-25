// Replaces the old offline worker on the previous address: it clears its caches, removes itself and
// sends open windows to the new address (https://kcml-coldrun.web.app).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) {
      const u = new URL(c.url);
      c.navigate('https://kcml-coldrun.web.app' + u.pathname + u.search + u.hash);
    }
  })());
});
