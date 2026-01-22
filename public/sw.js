const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `adivina-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `adivina-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/main.js',
  '/js/songs-loader.js',
  '/img/adivina.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => (key === CACHE_NAME || key === RUNTIME_CACHE ? null : caches.delete(key)))
      )
    )
  );
  self.clients.claim();
});

function isCacheableAsset(request) {
  if (request.method !== 'GET') return false;
  const destination = request.destination;
  return ['style', 'script', 'image', 'font'].includes(destination);
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const responseClone = response.clone();
          const responseCloneForRoot = response.clone();
          const cache = await caches.open(RUNTIME_CACHE);
          await Promise.all([
            cache.put('/index.html', responseClone),
            cache.put('/', responseCloneForRoot)
          ]);
          return response;
        } catch (error) {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/');
        }
      })()
    );
    return;
  }

  if (isCacheableAsset(request)) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then(response => {
          if (!response || !response.ok) {
            return response;
          }
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, responseClone));
          return response;
        });
      })
    );
  }
});
