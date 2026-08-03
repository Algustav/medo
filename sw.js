const CACHE_NAME = "medo-v29";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/app.js?v=20260803a",
  "./src/store.js?v=20260803a",
  "./src/ui/theme.js?v=20260625o",
  "./src/ui/page-theme.js?v=20260625o",
  "./src/styles/app.css?v=20260629h",
  "./public/favicon.ico",
  "./public/favicon-16.png",
  "./public/favicon-32.png",
  "./public/favicon-48.png",
  "./public/favicon-64.png",
  "./public/favicon-256.png",
  "./public/apple-touch-icon.png",
  "./public/icon-192.png",
  "./public/icon-512.png"
];

function cacheFirst(request) {
  return caches.match(request)
    .then(cached => cached || fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      }));
}

function staleWhileRevalidate(request) {
  return caches.match(request)
    .then(cached => {
      const fresh = fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => cached || caches.match("./index.html"));

      return cached || fresh;
    });
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate("./index.html"));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
