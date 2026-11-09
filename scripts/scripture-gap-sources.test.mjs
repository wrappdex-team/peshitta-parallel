import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const packet = read("docs/scripture-gap-sources.json");

test("seven sourced gap additions populate exactly 21 fields without claiming linguistic certification", () => {
  assert.equal(packet.entries.length, 7);
  assert.equal(new Set(packet.entries.map((r) => `${r.book}.${r.chapter}.${r.verse}`)).size, 7);
  for (const entry of packet.entries) {
    const verse = read(`src/data/nt/${entry.book}.json`).chapters[entry.chapter - 1].find(
      (v) => v.v === entry.verse,
    );
    assert.equal(verse.sy, entry.sourceSyriac);
    assert.equal(createHash("sha256").update(verse.sy).digest("hex"), entry.sourceSyriacSha256);
    assert.match(entry.status, /AI_ASSISTED.*REVIEW_PENDING/);
    assert.equal(entry.murdockQuote.length > 20, true);
    assert.match(entry.printUrl, new RegExp(`/page/n${entry.printLeaf}/`));
    assert.equal(verse.en, entry.renderings.en);
    for (const lang of ["el", "he"]) {
      const value = read(`src/data/tr/${lang}/${entry.book}.json`)[entry.chapter - 1][
        entry.verse - 1
      ];
      assert.equal(value, entry.renderings[lang]);
      assert.ok(value.trim());
      assert.match(value, lang === "el" ? /[\u0370-\u03ff]/u : /[\u0590-\u05ff]/u);
    }
  }
});
