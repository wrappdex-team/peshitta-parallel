#!/usr/bin/env node
// Serve the local production build (.vercel/output) on 127.0.0.1 for browser checks.
// Mirrors .vercel/output/config.json: static files first, then the SSR function.
// No credentials, no network beyond loopback, no dev compiler, so start-up is instant.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../.vercel/output/", import.meta.url));
const STATIC = join(ROOT, "static");
const SERVER = join(ROOT, "functions/__server.func/index.mjs");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

function staticFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = normalize(join(STATIC, decoded));
  if (!file.startsWith(STATIC + sep)) return null;
  try {
    return statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

/** Start the built app. Resolves to { url, close }. Throws if there is no build. */
export async function startBuiltServer({ port = 0 } = {}) {
  if (!existsSync(SERVER)) {
    throw new Error("No production build at .vercel/output. Run `npm run build:check` first.");
  }
  const { default: app } = await import(pathToFileURL(SERVER).href);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const file = req.method === "GET" || req.method === "HEAD" ? staticFile(url.pathname) : null;
      if (file) {
        res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
        if (req.method === "HEAD") return res.end();
        return createReadStream(file).pipe(res);
      }
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req);
      const response = await app.fetch(
        new Request(url, {
          method: req.method,
          headers: req.headers,
          body,
          duplex: body ? "half" : undefined,
        }),
      );
      const headers = {};
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") headers[key] = value;
      });
      const cookies = response.headers.getSetCookie?.() ?? [];
      if (cookies.length) headers["set-cookie"] = cookies;
      res.writeHead(response.status, headers);
      if (!response.body || req.method === "HEAD") return res.end();
      Readable.fromWeb(response.body).pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("server error");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  server.unref();
  const { port: bound } = server.address();
  return {
    url: `http://127.0.0.1:${bound}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { url } = await startBuiltServer({ port: Number(process.env.PORT ?? 8093) });
  process.stdout.write(`${url}\n`);
  setInterval(() => {}, 1 << 30);
}
