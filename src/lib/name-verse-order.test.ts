import assert from "node:assert/strict";
import test from "node:test";
import { BOOKS as EDITION } from "../data/edition.ts";
import { NAMES } from "./names.ts";
import { NAME_VERSE_PACK } from "./name-verse-pack.ts";
import { canonVerses, nameVersesFrom, parseRef, studyPeople } from "./name-verse-decode.ts";

const BOOKS = EDITION.map((book) => book.id);

function place(book: string, chapter: number, verse: number) {
  return { book, chapter, verse };
}

function inCanonOrder(list: { book: string; chapter: number; verse: number }[]) {
  for (let index = 1; index < list.length; index += 1) {
    const a = list[index - 1];
    const b = list[index];
    const ab = BOOKS.indexOf(a.book);
    const bb = BOOKS.indexOf(b.book);
    assert.ok(ab >= 0 && bb >= 0, `${a.book} ${b.book}`);
    if (ab !== bb) {
      if (ab > bb) return false;
      continue;
    }
    if (a.chapter > b.chapter || (a.chapter === b.chapter && a.verse >= b.verse)) return false;
  }
  return true;
}

test("canonVerses sorts mixed books by canon order, then chapter, then verse", () => {
  const sorted = canonVerses([place("acts", 1, 12), place("luke", 19, 29), place("matthew", 21, 1), place("john", 8, 1), place("mark", 11, 1)]);
  assert.deepEqual(
    sorted.map((item) => item.book),
    ["matthew", "mark", "luke", "john", "acts"],
  );
});

test("canonVerses puts chapter 2 before chapter 10, numerically", () => {
  const sorted = canonVerses([place("mark", 10, 1), place("mark", 2, 5), place("mark", 2, 14), place("mark", 1, 30)]);
  assert.deepEqual(
    sorted.map((item) => `${item.chapter}:${item.verse}`),
    ["1:30", "2:5", "2:14", "10:1"],
  );
});

test("canonVerses removes a repeated reference and keeps the rest of each item", () => {
  const first = { ...place("luke", 6, 14), label: "first" };
  const sorted = canonVerses([first, place("matthew", 4, 18), { ...place("luke", 6, 14), label: "again" }]);
  assert.equal(sorted.length, 2);
  assert.deepEqual(sorted[1], first);
});

test("Beth-Zayta's fallback refs list starts at Matthew 21:1", () => {
  const row = NAMES.find((item) => item.id === "bethzayta");
  assert.ok(row);
  assert.equal(row.refs?.[0], "luke 19:29", "fixture: the data still lists Luke first");
  const verses = nameVersesFrom(NAME_VERSE_PACK, row);
  assert.equal(verses[0]?.label, "Matthew 21:1");
  assert.ok(inCanonOrder(verses));
});

test("Keefa still starts at Matthew 4:18 with 92 verses", () => {
  const row = NAMES.find((item) => item.id === "keefa");
  assert.ok(row);
  const verses = nameVersesFrom(NAME_VERSE_PACK, row);
  assert.equal(verses.length, 92);
  assert.equal(verses[0]?.label, "Matthew 4:18");
});

test("every card's verse list and person list is in canon order with no repeats", () => {
  for (const row of NAMES) {
    const verses = nameVersesFrom(NAME_VERSE_PACK, row);
    assert.ok(inCanonOrder(verses), row.id);
    for (const person of studyPeople(row)) assert.ok(inCanonOrder(person.links), `${row.id} ${person.label}`);
  }
});

test("parseRef still builds the plain reader link", () => {
  assert.equal(parseRef("matthew 4:18")?.href, "/read/matthew/4#v-18");
});
