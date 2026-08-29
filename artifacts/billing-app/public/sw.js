const VERSION = "mobilinq-shell-v2";
const SHELL = [".", "./", "./index.html", "./favicon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).pathname.includes("/api/")) return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached ?? caches.match("./index.html"))));
});