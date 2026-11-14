import assert from "node:assert/strict";
import test from "node:test";
import { NAMES, filterNames, foldApostrophes, foldName, nameKindCounts } from "./names.ts";

test("kind counts add up to every card", () => {
  const counts = nameKindCounts();
  assert.equal(counts.all, 503);
  assert.equal(counts.person, 333);
  assert.equal(counts.place, 150);
  assert.equal(counts.people, 15);
  assert.equal(counts.person + counts.place + counts.people + counts.other, counts.all);
});

test("yeshua and Y'shua find Y'shua first", () => {
  assert.equal(foldName("Y'shua"), "yeshua");
  assert.equal(foldName("yeshua"), "yeshua");
  assert.equal(filterNames("yeshua", "all", false)[0]?.id, "yshua");
  assert.equal(filterNames("Y'shua", "all", false)[0]?.id, "yshua");
});

test("apostrophe folding is what makes yeshua match", () => {
  const stored = foldName("Y'shua");
  const stripped = foldName("Y'shua").replaceAll("e", "");
  assert.equal(stored, "yeshua");
  assert.notEqual(foldApostrophes("y'shua"), stripped);
  assert.equal(foldApostrophes("y'shua"), "yeshua");
});

test("hyphens fold to spaces, so bar abba is Bar-Abba", () => {
  assert.equal(foldName("Bar-Abba"), foldName("bar abba"));
  assert.equal(filterNames("bar abba", "all", false)[0]?.id, "barabba");
});

test("Corinth stays one card until descriptions are included", () => {
  assert.deepEqual(
    filterNames("Corinth", "all", false).map((row) => row.id),
    ["corinth"],
  );
  const withNotes = filterNames("Corinth", "all", true).map((row) => row.id);
  assert.ok(withNotes.includes("corinth"));
  assert.ok(withNotes.includes("hawwa"));
  assert.ok(withNotes.length > 1);
});

test("Peter ranks Keefa first", () => {
  assert.equal(filterNames("Peter", "all", false)[0]?.id, "keefa");
});

test("places are the place rows", () => {
  assert.equal(filterNames("", "place", false).length, NAMES.filter((row) => row.kind === "place").length);
});
