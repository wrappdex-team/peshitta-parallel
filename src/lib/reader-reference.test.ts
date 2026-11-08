import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseReaderChapter } from "./reader-reference.ts";

const catalog = JSON.parse(
  readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"),
) as {
  id: string;
  chapters: number;
}[];

test("every catalogued chapter accepts its canonical spelling", () => {
  let checked = 0;
  for (const book of catalog) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      assert.equal(parseReaderChapter(String(chapter), book.chapters), chapter, book.id);
      checked++;
    }
    assert.equal(parseReaderChapter(String(book.chapters + 1), book.chapters), null, book.id);
  }
  assert.equal(checked, 260);
});

test("unknown book limits and noncanonical, nonfinite or out-of-range chapter inputs are rejected", () => {
  for (const chapter of [
    "",
    "0",
    "-1",
    "+1",
    "01",
    "1.0",
    "1e0",
    "0x1",
    " 1",
    "1 ",
    "NaN",
    "Infinity",
    "１",
    "1/2",
    "1%00",
    "9".repeat(400),
  ]) {
    assert.equal(parseReaderChapter(chapter, 21), null, chapter);
  }
  for (const limit of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal(parseReaderChapter("1", limit), null);
  }
});
