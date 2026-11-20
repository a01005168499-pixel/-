// Service Worker for "عالم الصوت والإلكترونيات" POS & Inventory System
// Enables 100% offline functionality without internet connection

const CACHE_NAME = 'audio-world-pos-v3';

// Core assets to cache immediately upon installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

// Install Event: pre-cache critical shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache core assets gracefully (don't fail install if a single asset 404s)
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (e) {
            console.warn(`[SW] Pre-caching failed for ${url}:`, e);
          }
        })
      );
    })
  );
  // Force active state immediately
  self.skipWaiting();
});

// Activate Event: purge older cache generations and claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Offline-first strategy with runtime cache storage
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests (e.g. POST/PUT) and non-http(s)
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // 1. Navigation Requests (Opening page, reloading, clicking links)
  // Network first with instant fallback to cached HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              cache.put('/', responseClone.clone());
              cache.put('/index.html', responseClone.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback
          const cache = await caches.open(CACHE_NAME);
          const cachedNavigate = await cache.match(request);
          if (cachedNavigate) return cachedNavigate;
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await cache.match('/');
          if (cachedRoot) return cachedRoot;
          return new Response('عالم الصوت والإلكترونيات - أنت تعمل في وضع عدم الاتصال بالإنترنت', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 2. Static Assets (Scripts, Styles, Fonts, Images, Google Fonts)
  // Stale-While-Revalidate: Return cached copy immediately for instant offline speed,
  // fetch in background to update cache if online.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // When offline, if we don't have a cached copy, return empty response or graceful fallback
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
