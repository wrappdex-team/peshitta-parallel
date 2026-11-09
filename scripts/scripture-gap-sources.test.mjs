import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const packet = read("docs/scripture-gap-sources.json");
const search = read("src/data/search.json");
// Canonical order comes from the app's edition table, independent of the index under test.
const BOOK_ORDER = [
  ...readFileSync(new URL("../src/data/edition.ts", import.meta.url), "utf8").matchAll(
    /^\s*\{ id: "([a-z0-9]+)"/gm,
  ),
].map((m) => m[1]);

test("seven provenance entries record Murdock evidence and match Build's shipped wording without claiming certification", () => {
  assert.equal(packet.entries.length, 7);
  assert.equal(new Set(packet.entries.map((r) => `${r.book}.${r.chapter}.${r.verse}`)).size, 7);
  assert.match(packet.scope, /not verbatim Murdock/);
  for (const entry of packet.entries) {
    const verse = read(`src/data/nt/${entry.book}.json`).chapters[entry.chapter - 1].find(
      (v) => v.v === entry.verse,
    );
    assert.equal(verse.sy, entry.sourceSyriac);
    assert.equal(createHash("sha256").update(verse.sy).digest("hex"), entry.sourceSyriacSha256);
    assert.match(entry.status, /UNSOURCED.*REVIEW_PENDING/);
    assert.equal(entry.murdockQuote.length > 20, true);
    assert.match(entry.printUrl, new RegExp(`/page/n${entry.printLeaf}/`));
    assert.ok(Array.isArray(entry.shippedEnVsMurdockWordDifferences));
    assert.equal(verse.en, entry.shippedRenderings.en, "packet must describe shipped English");
    for (const lang of ["el", "he"]) {
      const value = read(`src/data/tr/${lang}/${entry.book}.json`)[entry.chapter - 1][
        entry.verse - 1
      ];
      assert.equal(value, entry.shippedRenderings[lang]);
      assert.match(value, lang === "el" ? /[\u0370-\u03ff]/u : /[\u0590-\u05ff]/u);
    }
    const indexed = search.filter(
      ([book, chapter, number]) =>
        book === entry.book && chapter === entry.chapter && number === entry.verse,
    );
    assert.equal(indexed.length, 1, "each filled English verse is searchable exactly once");
  }
});

test("search index has exactly one row per populated English verse, in canonical order, matching the text", () => {
  assert.equal(BOOK_ORDER.length, 27);
  const expected = [];
  for (const book of BOOK_ORDER) {
    read(`src/data/nt/${book}.json`).chapters.forEach((chapter, i) => {
      for (const verse of chapter)
        if (verse.en?.trim()) expected.push([book, i + 1, verse.v, verse.en]);
    });
  }
  assert.equal(search.length, expected.length);
  assert.deepEqual(search, expected);
});
