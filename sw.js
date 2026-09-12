const CACHE = "flohmarkt-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/motive/ginkgo.jpg",
  "./icons/motive/regenbogen.jpg",
  "./icons/motive/capybara.jpg",
  "./icons/motive/fussspuren.jpg",
  "./icons/motive/naturmotive.jpg",
  "./icons/motive/kreis.jpg",
  "./icons/motive/kreis-punkte.jpg",
  "./icons/motive/kreis-halb.jpg",
  "./icons/motive/kaffeekanne.jpg",
  "./icons/motive/regenbogen-druck.jpg",
  "./icons/motive/ginkgo-druck.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
