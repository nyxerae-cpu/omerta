// Updated service worker for GitHub Pages subdirectory paths
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open('my-cache').then(function(cache) {
            return cache.addAll([
                '/omerta/index.html',
                '/omerta/style.css',
                '/omerta/script.js',
                // Add other cached files here
            ]);
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});

// Ensure service worker registration uses the appropriate path
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/omerta/sw.js')
            .then(function(registration) {
                console.log('Service Worker registered with scope:', registration.scope);
            });
    });
}