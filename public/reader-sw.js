const SHELL = "injeel-shell-__INJEEL_SHELL_ID__";

self.addEventListener("install", (event) => {
  event.waitUntil(install().then(() => self.skipWaiting()));
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

async function install() {
  const cache = await caches.open(SHELL);
  await cache.addAll(["/", "/offline", "/offline-shell.html"]);
  await keepAssets(cache, "/");
  await keepAssets(cache, "/offline");
  await keepReader(cache);
}

async function keepAssets(cache, path) {
  const cached = await cache.match(path);
  if (!cached) return;
  await addAssets(cache, assetUrls(await cached.text()));
}

async function keepReader(cache) {
  const response = await fetch("/read/matthew/1");
  if (!response.ok) return;
  const html = await response.text();
  const urls = assetUrls(html);
  await addAssets(cache, urls);
  const entry = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
  if (!entry) return;
  const css = urls.find((url) => url.endsWith(".css"));
  const preloads = urls
    .filter((url) => url.endsWith(".js"))
    .map((url) => `<link rel="modulepreload" href="${url}">`)
    .join("");
  const style = css ? `<link rel="stylesheet" href="${css}">` : "";
  const page = `<!DOCTYPE html><html lang="en" data-shell="read"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Injeel</title><script>try{var p=JSON.parse(localStorage.getItem("peshitta-parallel")||"{}");if(p.theme==="night")document.documentElement.dataset.theme="night"}catch(e){}</script>${style}${preloads}</head><body><script type="module" src="${entry[1]}"></script></body></html>`;
  await cache.put("/reader-shell.html", new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } }));
}

function assetUrls(html) {
  const found = new Set();
  for (const tag of html.matchAll(/<(?:link|script)\b[^>]*>/g)) {
    const url = tag[0].match(/(?:href|src)="(\/assets\/[^"]+)"/);
    if (url) found.add(url[1]);
  }
  return [...found];
}

async function addAssets(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // One missing file must not throw away the shell.
      }
    }),
  );
}

async function navigate(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok) void store(request.url, response.clone());
    return response;
  } catch {
    const exact = await caches.match(request);
    if (exact) return exact;
    // A chapter can open from the copy on this device. Home HTML must not stand in.
    if (url.pathname.startsWith("/read/")) {
      const reader = await caches.match("/reader-shell.html");
      if (reader) return fresh(reader);
    }
    const shell = await caches.match("/offline-shell.html");
    return shell ? fresh(shell) : Response.error();
  }
}

function fresh(response) {
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, headers });
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
