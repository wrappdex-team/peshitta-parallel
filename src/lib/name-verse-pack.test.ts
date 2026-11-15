import assert from "node:assert/strict";
import test from "node:test";
import { NAMES } from "./names.ts";
import { NAME_VERSE_PACK } from "./name-verse-pack.ts";
import { nameVersesFrom } from "./name-verse-decode.ts";
import { assertNameVersePackFresh, encodeNameVersePack } from "./name-verse-codec.ts";
import { collectNameVerseEntries, entriesFromVerses } from "./name-verse-build.ts";

test("a row inserted at index 0 does not move Keefa or Kandak", () => {
  const inserted = { ...NAMES[0], id: "inserted-row" };
  const shifted = [inserted, ...NAMES];
  const keefa = shifted.find((row) => row.id === "keefa");
  const kandak = shifted.find((row) => row.id === "kandak");
  assert.ok(keefa && kandak);
  assert.equal(nameVersesFrom(NAME_VERSE_PACK, keefa, shifted).length, 92);
  assert.equal(nameVersesFrom(NAME_VERSE_PACK, kandak, shifted).length, 1);
});

test("the committed pack matches the verse text", () => {
  assertNameVersePackFresh(NAME_VERSE_PACK, collectNameVerseEntries());
});

test("changing a verse's English name without regenerating fails the check", () => {
  const names = NAMES.filter((row) => row.id === "keefa" || row.id === "kandak");
  const verses = [{ en: "Keefa spoke" }, { en: "Keefa again" }, { en: "Kandak the queen" }];
  const pack = encodeNameVersePack(entriesFromVerses(names, verses));
  const changed = [{ en: "Peter spoke" }, verses[1], verses[2]];
  assert.throws(() => assertNameVersePackFresh(pack, entriesFromVerses(names, changed)), /stale/);
});
