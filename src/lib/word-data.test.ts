import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadWordChapter, occurrenceGloss, periphrasticAuxGloss, resolveGloss, tokenAt, wordDataImports, type WordToken } from "./word-data.ts";

const scripture = readFileSync(new URL("./scripture.ts", import.meta.url), "utf8");

function token(partial: Partial<WordToken> & Pick<WordToken, "w" | "g">): WordToken {
  return { l: "x#1", p: "N", say: "a", tr: "a", prov: "draft-loop", ...partial };
}

test("a word-file gloss wins, then a pin, then the lexicon, then the peel", () => {
  assert.equal(resolveGloss({ token: "he is", pinned: "was", lexicon: "is", peel: "x" }), "he is");
  assert.equal(resolveGloss({ token: null, pinned: "sparrows", lexicon: "morning", peel: "x" }), "sparrows");
  assert.equal(resolveGloss({ pinned: null, lexicon: "this", peel: "that" }), "this");
  assert.equal(resolveGloss({ lexicon: null, peel: "and of" }), "and of");
  assert.equal(resolveGloss({}), null);
});


test("a periphrastic ܐܝܬܘܗܝ ܗܘܐ card does not read as a present he is", () => {
  const ith = token({ w: "ܐܝܬܘܗܝ", g: "he is", ctx: "was" });
  assert.equal(occurrenceGloss({ word: "ܐܝܬܘܗܝ", next: "ܗܘܐ", token: ith }), "he (existing)");
  assert.equal(occurrenceGloss({ word: "ܐܝܬܘܗܝ", next: "ܡܠܬܐ", token: ith }), "he is");
  assert.equal(occurrenceGloss({ word: "ܐܝܬܘܗܝ", next: "ܗܘܐ", token: token({ w: "ܐܝܬܘܗܝ", g: "he (existing)" }) }), "he (existing)");
  assert.equal(occurrenceGloss({ word: "ܕܐܝܬܘܗܝ", next: "ܗܘܐ", fallback: "he is" }), "he (existing)");
  assert.equal(occurrenceGloss({ word: "ܐܝܬ", next: "ܗܘܐ", fallback: "there is" }), "there (existing)");
  assert.equal(occurrenceGloss({ word: "ܐܝܬܝܗ", next: "ܗܘܬ", fallback: "she is" }), "she (existing)");
  assert.equal(occurrenceGloss({ word: "ܐܝܬܝܗܘܢ", next: "ܗܘܘ", fallback: "they are" }), "they (existing)");
  assert.equal(occurrenceGloss({ word: "ܘܐܝܬ", next: "ܗܘܝ", fallback: "and there is" }), "and there (existing)");
  assert.equal(occurrenceGloss({ word: "ܗܘ", next: "ܡܠܬܐ", fallback: "he, that" }), "he, that");
  assert.equal(periphrasticAuxGloss("who is"), "who (existing)");
});

test("the same spelling can carry a different token at each index", () => {
  const words = ["ܡܠܬܐ", "ܡܠܬܐ"];
  const list = [token({ w: "ܡܠܬܐ", g: "the Word" }), token({ w: "ܡܠܬܐ", g: "Word" })];
  assert.equal(tokenAt(list, words, 0)?.g, "the Word");
  assert.equal(tokenAt(list, words, 1)?.g, "Word");
});

test("a token that is not the form at that index is ignored", () => {
  const list = [token({ w: "ܗܘ", g: "that" })];
  assert.equal(tokenAt(list, ["ܡܠܬܐ"], 0, "john:1:1"), null);
});

test("Words off does not import word data", async () => {
  const before = wordDataImports();
  assert.equal(await loadWordChapter("john", 1, false), null);
  assert.equal(wordDataImports(), before);
});

test("the lexicon is a dynamic import, not part of the scripture module", () => {
  assert.doesNotMatch(scripture, /import lexicon from "@\/data\/lexicon.json"/);
  assert.match(scripture, /import\("@\/data\/lexicon.json"\)/);
  assert.match(scripture, /SENSE_AT\[key\] \?\? EXTRA_SENSE\[key\]/);
});
