#!/usr/bin/env node
// Exercise local compiled SSR only: no HTTP listener, browser, credentials or deployment.
import assert from "node:assert/strict";
import app from "../.vercel/output/functions/__server.func/index.mjs";

for (const path of ["/", "/seal", "/read/john/1", "/read/john/21", "/read/philemon/1"]) {
  const response = await app.fetch(new Request(`http://127.0.0.1:8081${path}`));
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.match(html, /<main\b/);
  const robots = [...html.matchAll(/<meta[^>]*name="robots"[^>]*>/g)].map((match) => match[0]);
  assert.equal(robots.length, 1, `${path}: one effective robots directive`);
  assert.match(
    robots[0],
    path === "/seal" ? /content="noindex, follow"/ : /content="index, follow/,
  );
  const canonicals = [...html.matchAll(/<link[^>]*rel="canonical"[^>]*>/g)].map(
    (match) => match[0],
  );
  assert.equal(canonicals.length, 1, `${path}: one canonical`);
  assert.ok(canonicals[0].includes(`href="https://peshitta-parallel.vercel.app${path}"`), path);
  console.log(
    JSON.stringify({ path, status: response.status, robots, canonical: canonicals[0], main: true }),
  );
}

// Invalid references must be rejected at the route boundary, not served as
// successful, indexable "loading" shells. These requests call no paid APIs.
for (const path of [
  "/read/not-a-book/1",
  "/read/john/0",
  "/read/john/22",
  "/read/john/1e0",
  "/read/john/01",
  "/read/john/1.5",
  "/read/john/9007199254740992",
]) {
  const response = await app.fetch(new Request(`http://127.0.0.1:8081${path}`));
  const html = await response.text();
  assert.equal(response.status, 404, path);
  assert.match(html, /Reading not found/);
  assert.match(html, /<meta name="robots" content="noindex, follow"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  console.log(JSON.stringify({ path, status: response.status, noindex: true, canonical: false }));
}
