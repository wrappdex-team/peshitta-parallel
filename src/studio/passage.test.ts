import assert from "node:assert/strict";
import { test } from "node:test";
import { clampPassage, scopeFromChapter, versesOf } from "./passage.ts";
import { scopeRef, scopeVerses } from "./prefs.ts";

const matt5 = [
  { v: 3, en: "Blessed are the poor in spirit, for theirs is the kingdom of heaven!", sy: "sy-3" },
  { v: 4, en: "Blessed are they who mourn, for they will be comforted!", sy: "sy-4" },
  { v: 5, en: "Blessed are the meek, for they will inherit the earth!" },
];

test("clampPassage keeps to at least from, and both inside the chapter", () => {
  assert.deepEqual(clampPassage(matt5, 3, 4), { from: 3, to: 4 });
  assert.deepEqual(clampPassage(matt5, 4, 3), { from: 4, to: 4 });
  assert.deepEqual(clampPassage(matt5, 1, 99), { from: 3, to: 5 });
  assert.deepEqual(clampPassage(matt5), { from: 3, to: 3 });
});

test("scopeFromChapter names the book and quotes a from–to range", () => {
  const scope = scopeFromChapter("matthew", 5, versesOf(matt5), 3, 4);
  assert.equal(scope.bookName, "Matthew");
  assert.equal(scopeRef(scope), "Matthew 5:3–4");
  assert.deepEqual(scopeVerses(scope).map((row) => row.en), [matt5[0].en, matt5[1].en]);
  assert.equal(scopeRef(scopeFromChapter("john", 1, versesOf([{ v: 1, en: "In the beginning was the Word." }]), 1, 1)), "John 1:1");
  assert.equal(scopeRef(scopeFromChapter("matthew", 5, versesOf(matt5), 3, 5)), "Matthew 5:3–5");
  const chapter = [{ v: 1, en: "a" }, { v: 2, en: "b" }, { v: 3, en: "c" }];
  assert.equal(scopeRef(scopeFromChapter("matthew", 5, versesOf(chapter), 1, 3)), "Matthew 5", "a full chapter from verse 1 is named without a range");
});
