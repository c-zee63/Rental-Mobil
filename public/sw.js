// Service worker sederhana: aplikasi tetap bisa dibuka saat offline (setelah pernah dibuka online).
// Data Firestore ditangani oleh cache offline Firestore sendiri.
const V = 'v1';
const STATIC = `static-${V}`, PAGES = `pages-${V}`, TILES = `tiles-${V}`;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/', '/login'])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => ![STATIC, PAGES, TILES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Peta OpenStreetMap: tampilkan dari cache bila ada, perbarui di belakang layar
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return; // Firestore/Auth/lainnya: biarkan browser

  // Aset statis: cache dulu
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    }));
    return;
  }

  // Halaman & data navigasi: jaringan dulu, cadangan dari cache
  e.respondWith(
    fetch(req)
      .then((r) => { if (r.ok) caches.open(PAGES).then((c) => c.put(req, r.clone())); return r; })
      .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('/') : Response.error()))
  );
});
