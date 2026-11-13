import assert from "node:assert/strict";
import test from "node:test";
import { chapterCountLabel } from "./chapter-label.ts";

test("a book of one chapter does not say chapters", () => {
  assert.equal(chapterCountLabel(1), "1 chapter");
  assert.equal(chapterCountLabel(2), "2 chapters");
  assert.equal(chapterCountLabel(21), "21 chapters");
});
