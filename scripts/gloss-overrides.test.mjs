import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lex = JSON.parse(readFileSync(join(root, "src/data/lexicon.json"), "utf8"));
const overrides = JSON.parse(readFileSync(join(root, "src/data/gloss-overrides.json"), "utf8"));
const scripture = readFileSync(join(root, "src/lib/scripture.ts"), "utf8");
const verseView = readFileSync(join(root, "src/components/verse-view.tsx"), "utf8");

function glossAt(word, place) {
  const key = `${place.book}:${place.chapter}:${place.verse}:${word}`;
  if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
  return lex[word]?.g ?? null;
}

test("John 1:3 word card reads 'it was' for ܗܘܬ", () => {
  assert.equal(glossAt("ܗܘܬ", { book: "john", chapter: 1, verse: 3 }), "it was");
});

test("another ܗܘܬ verse about a woman still reads 'she was'", () => {
  assert.equal(glossAt("ܗܘܬ", { book: "acts", chapter: 9, verse: 36 }), "she was");
  assert.ok(!overrides["acts:9:36:ܗܘܬ"]);
});

test("the lexicon entry for ܗܘܬ stays 'she was'", () => {
  assert.equal(lex["ܗܘܬ"]?.g, "she was");
});

test("reader wires per-verse overrides through lexAt", () => {
  assert.match(scripture, /export function registerGlossOverrides/);
  assert.match(scripture, /SENSE_AT\[key\] \?\? EXTRA_SENSE\[key\]/);
  assert.match(verseView, /registerGlossOverrides\(glossOverrides/);
  assert.match(verseView, /gloss-overrides\.json/);
});
