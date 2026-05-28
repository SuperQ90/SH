// public/sw.js
// Safe SW: never rewrites headers; never intercepts Supabase or non-GET.

const CACHE_NAME = "ai-music-radio-static-v1";
const ASSETS = ["/", "/src/main.tsx", "/src/index.css"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Do NOT touch Supabase or any non-GET; let headers pass through untouched.
  if (event.request.method !== "GET" || url.hostname.endsWith("supabase.co")) {
    return; // default browser handling (network)
  }

  // Network-first for other GETs; still no header changes.
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_CACHE") {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
});
