const SHELL = 'savejar-shell-v1';
const FONTS = 'savejar-fonts-v1';
const ASSETS = ['./index.html', './icon.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // page loads -> always serve the cached app shell when possible
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((h) => h || fetch(req).catch(() => caches.match('./index.html'))));
    return;
  }

  // google fonts -> cache on first online load, then serve offline
  if (url.hostname.indexOf('fonts.googleapis.com') > -1 || url.hostname.indexOf('fonts.gstatic.com') > -1) {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }

  // everything else -> cache first, then network
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      return caches.open(SHELL).then((c) => { try { c.put(req, res.clone()); } catch (_) {} return res; });
    }).catch(() => hit))
  );
});
