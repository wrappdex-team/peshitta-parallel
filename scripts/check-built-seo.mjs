#!/usr/bin/env node
// Exercise local compiled SSR only: no HTTP listener, browser, credentials or deployment.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "../.vercel/output/functions/__server.func/index.mjs";

// Rendered text of one verse article: words may be split into tappable elements.
const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
function verseText(visible, v) {
  const article = visible.match(new RegExp(`<article\\b[^>]*id="v-${v}"[^>]*>([\\s\\S]*?)</article>`));
  assert.ok(article, `verse ${v} article rendered`);
  return decode(article[1].replace(/<[^>]+>/g, ""));
}

for (const path of ["/", "/seal", "/words", "/read/john/1", "/read/john/21", "/read/philemon/1"]) {
  const syntheticKey = "synthetic-private-key-never-serialize";
  const response = await app.fetch(
    new Request(`http://127.0.0.1:8081${path}`, {
      headers: { authorization: `Bearer ${syntheticKey}`, cookie: `fixture=${syntheticKey}` },
    }),
  );
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.match(html, /<main\b/);
  assert.ok(!html.includes(syntheticKey), "request secrets must not enter public SSR/loader data");
  // Inspect rendered markup, not serialized loader JSON or script contents.
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  if (path.startsWith("/read/")) {
    const [, , book, chapter] = path.split("/");
    const doc = JSON.parse(
      readFileSync(new URL(`../src/data/nt/${book}.json`, import.meta.url), "utf8"),
    );
    const verses = doc.chapters[Number(chapter) - 1];
    assert.equal(
      (visible.match(/<article\b[^>]*id="v-/g) ?? []).length,
      verses.length,
      "every chapter verse must be SSR-rendered",
    );
    assert.ok(
      verseText(visible, verses[0].v).includes(verses[0].sy),
      "first source verse visible without JavaScript",
    );
    assert.ok(
      verseText(visible, verses.at(-1).v).includes(verses.at(-1).sy),
      "last source verse visible without JavaScript",
    );
    assert.doesNotMatch(visible, /Opening the chapter/);
  }
  if (path === "/words") {
    const saying = visible.match(
      /<article[^>]*data-saying="(\d+):(\d+)"[^>]*>([\s\S]*?)<\/article>/,
    );
    assert.ok(saying, "Words must SSR-render a saying, not just loader JSON");
    const matthew = JSON.parse(
      readFileSync(new URL("../src/data/nt/matthew.json", import.meta.url), "utf8"),
    );
    const verse = matthew.chapters[Number(saying[1]) - 1].find(
      (item) => item.v === Number(saying[2]),
    );
    // Word and name links may split a line across elements and line breaks, so
    // compare with whitespace collapsed; the words themselves must still match.
    const squash = (value) => value.replace(/\s+/g, " ").trim();
    const text = squash(decode(saying[3].replace(/<[^>]+>/g, "")));
    assert.ok(
      (verse.sy && text.includes(squash(verse.sy))) || (verse.en && text.includes(squash(verse.en))),
      "Words includes actual source text",
    );
    assert.doesNotMatch(visible, /Opening the words/);
  }
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
  assert.ok(canonicals[0].includes(`href="https://injeel.news${path}"`), path);
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
