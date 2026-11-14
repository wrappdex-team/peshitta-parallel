const SHELL = "injeel-shell-__INJEEL_SHELL_ID__";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/offline-shell.html"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API or preview routes. Keys stay in sessionStorage, not here.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__grok/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (!/\.(?:js|css|woff2|svg|png|json)$/.test(url.pathname) && !url.pathname.startsWith("/assets/")) return;
  event.respondWith(asset(request));
});

async function navigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok) void store(request.url, response.clone());
    return response;
  } catch {
    const exact = await caches.match(request);
    if (exact) return exact;
    // Do not reuse the home document. A foreign URL hydrates as the wrong page.
    const shell = await caches.match("/offline-shell.html");
    return shell || Response.error();
  }
}

async function store(url, response) {
  try {
    const cache = await caches.open(SHELL);
    await cache.put(url, response);
  } catch {
    // A cache miss must not replace a page that already loaded.
  }
}

async function asset(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return cached || Response.error();
  }
}
