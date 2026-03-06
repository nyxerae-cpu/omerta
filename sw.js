const CACHE_VERSION = 'wb-cache-v12';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './scenes.css',
    './editor.css',
    './features.css',
    './app.js',
    './scenes.js',
    './editor.js',
    './features.js',
    './manifest.json',
    './icons/icon-192.svg',
    './icons/icon-512.svg',
    './icons/icon-maskable.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(key => key !== CACHE_VERSION)
                .map(key => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (new URL(event.request.url).origin !== self.location.origin) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', responseToCache));
                    return networkResponse;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request))
    );
});