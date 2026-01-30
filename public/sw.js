const CACHE_NAME = 'adivina-cancion-v1.2.2';
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/main.js',
  'js/songs-loader.js',
  'img/adivina.png'
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
        keys.map(key => (key === CACHE_NAME ? null : caches.delete(key)))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    // 1️⃣ NUNCA cachear llamadas API
    if (requestUrl.pathname.startsWith('/api/')) {
        return;
    }

    // 2️⃣ Audio: siempre red
    if (
        requestUrl.pathname.startsWith('/audio/') ||
        event.request.headers.get('range') ||
        event.request.destination === 'audio'
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 3️⃣ NAVEGACIÓN (HTML) → NETWORK FIRST (CRÍTICO PARA STRIPE)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(() => caches.match('index.html'))
        );
        return;
    }

    // 4️⃣ ASSETS (JS, CSS, IMG) → CACHE FIRST
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then(response => {
                if (!response || response.status !== 200) return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
                return response;
            });
        })
    );
});

