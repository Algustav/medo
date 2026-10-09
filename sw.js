const CACHE_NAME = "medo-v31";
const APP_SHELL = [
  "./",
  "./index.html",
  "./src/app.js?v=20260803b",
  "./src/store.js?v=20260803b",
  "./src/ui/theme.js?v=20260625o",
  "./src/ui/page-theme.js?v=20260625o",
  "./src/styles/app.css?v=20260803c",
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
const SHELL_URLS = new Set(APP_SHELL.map(path => new URL(path, self.location.href).href));
const ENTRY_URL = new URL("./", self.location.href);
const INDEX_URL = new URL("./index.html", self.location.href);

self.addEventListener("install", event => {
  // Install a complete release. Keep the active worker until its tabs close,
  // so an open page cannot mix assets from two releases.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("medo-v") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isEntry = request.mode === "navigate" &&
    (url.pathname === ENTRY_URL.pathname || url.pathname === INDEX_URL.pathname);
  if (!isEntry && !SHELL_URLS.has(url.href)) return;

  // Query parameters (e.g. ?theme=...) do not change the entry document.
  // Never return HTML as a fallback for a missing script or stylesheet.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(isEntry ? ENTRY_URL.href : request);
    if (cached) return cached;
    // Do not overwrite the installed shell with redirects/login pages.
    return fetch(request);
  })());
});
