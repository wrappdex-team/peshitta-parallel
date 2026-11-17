import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadWordChapter, resolveGloss, tokenAt, wordDataImports, type WordToken } from "./word-data.ts";

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
