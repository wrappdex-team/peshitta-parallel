// W-153: the nine "sixty" tokens, and drink verses left on the lexicon.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { collectIssues, loadModel } from "./check-word-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SIXTY = [
  { book: "1timothy", ch: 5, v: "9", index: 8, w: "ܫܬܝܢ", say: "shtin", g: /sixty/ },
  { book: "luke", ch: 24, v: "13", index: 14, w: "ܫܬܝܢ", say: "shtin", g: /sixty/ },
  { book: "mark", ch: 4, v: "8", index: 13, w: "ܕܫܬܝܢ", say: "d'shtin", g: /sixty/ },
  { book: "mark", ch: 4, v: "20", index: 12, w: "ܘܒܫܬܝܢ", say: "w'bashtin", g: /sixty/ },
  { book: "matthew", ch: 13, v: "8", index: 9, w: "ܕܫܬܝܢ", say: "d'shtin", g: /sixty/ },
  { book: "matthew", ch: 13, v: "23", index: 17, w: "ܕܫܬܝܢ", say: "d'shtin", g: /sixty/ },
  { book: "revelation", ch: 11, v: "3", index: 7, w: "ܘܫܬܝܢ", say: "w'shtin", g: /sixty/ },
  { book: "revelation", ch: 12, v: "6", index: 16, w: "ܘܫܬܝܢ", say: "w'shtin", g: /sixty/ },
  { book: "revelation", ch: 13, v: "18", index: 14, w: "ܘܫܬܝܢ", say: "w'shtin", g: /sixty/ },
];

function loadChapter(book, ch) {
  return JSON.parse(readFileSync(join(ROOT, "src/data/words", book, `${ch}.json`), "utf8"));
}

test("each of the nine number tokens is sixty, not a drink gloss or wshatin/shatayn", () => {
  for (const row of SIXTY) {
    const token = loadChapter(row.book, row.ch).v[row.v][row.index];
    const at = `${row.book} ${row.ch}:${row.v}[${row.index}]`;
    assert.equal(token.w, row.w, at);
    assert.match(token.g, row.g, `${at} g=${token.g}`);
    assert.doesNotMatch(token.g, /drink/i, at);
    assert.equal(token.say, row.say, at);
    assert.doesNotMatch(token.say, /wshatin|shatayn/i, at);
    assert.doesNotMatch(token.tr, /wshatin|shatayn/i, at);
    assert.equal(token.l, "ܫܬܝܢ#1", at);
    assert.equal(token.p, "NUM", at);
    assert.equal(token.prov, "draft-loop", at);
    assert.notEqual(token.prov, "reviewed", at);
    assert.match(token.flag ?? "", /^needs-scholar/, at);
  }
});

test("drink verses are not given word files, so they keep the lexicon drink gloss", () => {
  // Luke 5:30 ܘܫܬܝܢ "and drinking"; 1 Cor 11:25 ܕܫܬܝܢ "as you drink"
  assert.equal(existsSync(join(ROOT, "src/data/words/luke/5.json")), false);
  assert.equal(existsSync(join(ROOT, "src/data/words/1corinthians")), false);
  const lex = JSON.parse(readFileSync(join(ROOT, "src/data/lexicon.json"), "utf8"));
  assert.equal(lex["ܘܫܬܝܢ"].g, "and drinking");
  assert.equal(lex["ܕܫܬܝܢ"].g, "as you drink");
});

test("reviewers stay empty and the new shards pass the validator", () => {
  const reviewers = JSON.parse(readFileSync(join(ROOT, "src/data/words/reviewers.json"), "utf8"));
  assert.deepEqual(reviewers, []);
  const issues = collectIssues(loadModel(ROOT));
  assert.deepEqual(issues, []);
});
