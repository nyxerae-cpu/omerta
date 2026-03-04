// WorldBuilder Service Worker - Offline Support & Caching Strategy

const CACHE_NAME = 'worldbuilder-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './editor.css',
  './editor.js',
  './scenes.css',
  './scenes.js',
  './manifest.json'
];

// Install - precache essential files
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Precaching app files');
      return cache.addAll(PRECACHE_URLS).catch(err => {
        // Some files might not exist yet, which is OK
        console.log('[SW] Precache warning:', err);
        return cache.addAll(PRECACHE_URLS.filter(url => !url.includes('editor')));
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle API requests differently (allow failures to pass through)
  if (event.request.url.includes('thief.min.js') || 
      event.request.url.includes('vis')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache CDN resources
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then(c => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Network first for HTML, CSS, JS
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const cache = caches.open(CACHE_NAME);
          cache.then(c => c.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache
        return caches.match(event.request).then(cached => {
          return cached || createOfflineResponse();
        });
      })
  );
});

// Create offline fallback response
function createOfflineResponse() {
  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WorldBuilder - Offline</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; 
           display: flex; align-items: center; justify-content: center; 
           height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    div { background: white; padding: 24px; border-radius: 8px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    h1 { margin: 0 0 12px 0; color: #1F2937; }
    p { margin: 0; color: #6B7280; }
  </style>
</head>
<body>
  <div>
    <h1>📖 WorldBuilder</h1>
    <p>Offline - Application content loading...</p>
  </div>
</body>
</html>`,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/html; charset=utf-8'
      })
    }
  );
}

// Handle background sync (if implemented)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-projects') {
    event.waitUntil(syncProjects());
  }
});

async function syncProjects() {
  // Future: Implement project sync when online
  console.log('[SW] Background sync triggered');
}

// Handle push notifications (if implemented)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'WorldBuilder notification',
    icon: './manifest.json',
    badge: './manifest.json',
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ]
  };
  event.waitUntil(self.registration.showNotification('WorldBuilder', options));
});

console.log('[SW] Service Worker script loaded');
