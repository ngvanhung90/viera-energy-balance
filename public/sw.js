const name = 'viera-energy-shell-v3';
const shell = [
  './', './index.html', './app.css', './manifest.webmanifest', './assets/icon.png', './assets/icon-large.png',
  './src/main.js', './src/planner.js', './src/catalog.js', './src/storage.js', './src/ai.js',
  './vendor/firebase-ai.js', './vendor/firebase-app.js', './vendor/firebase-app-check.js',
  './assets/lemongrass.webp', './assets/pasta.webp', './assets/soba.webp',
  './assets/salmon.webp', './assets/rolls.webp', './assets/chickpea.webp'
];
const config = new URL('./firebase-config.json', self.location).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(name).then(cache => cache.addAll(shell)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('viera-energy-shell-') && key !== name)
      .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.url === config) {
    event.respondWith(caches.open(name).then(async cache => {
      try {
        const response = await fetch(request, { signal: AbortSignal.timeout(2200) });
        if (response.ok) await cache.put(request, response.clone());
        else if (response.status === 404) await cache.delete(request);
        return response;
      } catch {
        return await cache.match(request) ?? Response.error();
      }
    }));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(response => response ?? fetch(request)));
});
