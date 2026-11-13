import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DECLARATION,
  GOSPEL_CHAPTERS,
  GOSPEL_IDS,
  NAME_HEBREW,
  clampName,
  declarationShareText,
  gospelProgress,
  gospelTotals,
  nextGospelChapter,
} from "./declaration.ts";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")) as {
  id: string;
  chapters: number;
}[];

test("the four Gospels match the catalog", () => {
  assert.equal(gospelTotals(), 89);
  for (const id of GOSPEL_IDS) {
    assert.equal(GOSPEL_CHAPTERS[id], catalog.find((book) => book.id === id)?.chapters);
  }
});

test("the declaration waits until every Gospel chapter is kept", () => {
  const empty = gospelProgress({});
  assert.equal(empty.complete, false);
  assert.equal(empty.remain, 89);
  assert.deepEqual(nextGospelChapter({}), { book: "matthew", chapter: 1 });

  const counts: Record<string, number> = {};
  for (const id of GOSPEL_IDS) {
    for (let chapter = 1; chapter <= GOSPEL_CHAPTERS[id]; chapter++) counts[`${id}:${chapter}`] = 1;
  }
  delete counts["john:21"];
  assert.equal(gospelProgress(counts).complete, false);
  assert.deepEqual(nextGospelChapter(counts), { book: "john", chapter: 21 });
  counts["john:21"] = 1;
  counts["acts:1"] = 0;
  assert.equal(gospelProgress(counts).complete, true);
  assert.equal(nextGospelChapter(counts), null);
});

test("the share keeps the confession and an optional name", () => {
  assert.equal(NAME_HEBREW, "ישוע");
  const text = declarationShareText("  Maryam   of  Nazareth  ", "2026-11-12");
  for (const line of DECLARATION) assert.match(text, new RegExp(line.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(text, /Signed, Maryam of Nazareth/);
  assert.match(text, /12 November 2026/);
  assert.equal(clampName("  a   b  "), "a b");
  assert.equal(declarationShareText("", "").includes("Signed"), false);
});
