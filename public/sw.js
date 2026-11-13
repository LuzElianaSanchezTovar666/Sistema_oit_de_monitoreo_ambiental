const CACHE_NAME = 'simoa-static-cache-v3';
const STATIC_ASSETS = [
  '/assets/images/simoa-logo.webp',
  '/assets/images/simoa-logo.avif',
  '/assets/images/simoa-icon.png',
  '/assets/images/hero-iot-stage.avif',
  '/assets/images/hero-iot-stage.webp',
  '/assets/images/module-esp32-node.avif',
  '/assets/images/module-sensors-dht22.avif',
  '/assets/images/module-mqtt-broker.avif',
  '/assets/images/module-ai-anomaly.avif',
  '/assets/images/module-lab-bioterium.avif',
  '/assets/images/module-climate-chamber.avif',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.avif') || url.pathname.endsWith('.webp')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
