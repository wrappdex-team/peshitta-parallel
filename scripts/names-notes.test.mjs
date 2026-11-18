// Guard for the factual names-card notes (W-165 / scorecard #11): every verse a note cites exists in this
// edition, every "double-quoted" phrase in a sentence that cites verses occurs in one of those verses, and
// each note stays within three sentences. Template notes ("The Peshitta writes this …") are skipped.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const NAMES = JSON.parse(readFileSync(new URL("../src/data/names.json", import.meta.url), "utf8")).names;
const NT = new URL("../src/data/nt/", import.meta.url);
const VERSES = new Map();
for (const file of readdirSync(NT).filter((f) => f.endsWith(".json"))) {
  const book = JSON.parse(readFileSync(new URL(file, NT), "utf8"));
  book.chapters.forEach((verses, i) => {
    for (const v of verses) VERSES.set(`${book.id} ${i + 1}:${v.v}`, v.en);
  });
}
const BOOKS = new Map();
for (const key of VERSES.keys()) {
  const id = key.split(" ")[0];
  const m = /^(\d)(.*)$/.exec(id);
  const shown = m ? `${m[1]} ${m[2][0].toUpperCase()}${m[2].slice(1)}` : `${id[0].toUpperCase()}${id.slice(1)}`;
  BOOKS.set(shown, id);
}
const BOOK = [...BOOKS.keys()].sort((a, b) => b.length - a.length).map((b) => b.replace(/ /g, " ")).join("|");
const VREF = String.raw`\d+:\d+(?:–\d+)?`;
const REF_RUN = new RegExp(`(${BOOK}) (${VREF}(?:(?:, |; )(?:(?:${BOOK}) )?${VREF})*)`, "g");
const TEMPLATE = /^The Peshitta writes this /;

/** Expand every verse reference in a piece of text ("Acts 9:33–35; 1 Peter 2:6") to "acts 9:33" keys. */
function citedVerses(text) {
  const out = [];
  for (const m of text.matchAll(REF_RUN)) {
    let book = BOOKS.get(m[1]);
    for (let part of m[2].split(/, |; /)) {
      const named = new RegExp(`^(${BOOK}) (.*)$`).exec(part);
      if (named) [book, part] = [BOOKS.get(named[1]), named[2]];
      const [c, v] = part.split(":");
      const [a, z = a] = v.split("–").map(Number);
      for (let x = a; x <= z; x++) out.push(`${book} ${c}:${x}`);
    }
  }
  return out;
}
const words = (s) => s.toLowerCase().replace(/[‹›]/g, "").replace(/’/g, "'").replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean).join(" ");
const sentenceCount = (note) =>
  note
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/"[^"]*?([.!?]?)"/g, "Q$1\"")
    .match(/[.!?]["”)]?(?=\s+[A-Z0-9"]|\s*$)/g)?.length ?? 0;

const NOTES = NAMES.filter((row) => row.note && !TEMPLATE.test(row.note) && citedVerses(row.note).length);

test("every verse a names note cites exists in this edition", () => {
  assert.ok(NOTES.length > 100, `only ${NOTES.length} cited notes found`);
  const missing = NOTES.flatMap((row) => citedVerses(row.note).filter((r) => !VERSES.has(r)).map((r) => `${row.id}: ${r}`));
  assert.deepEqual(missing, []);
});

test("every quoted phrase occurs in a verse cited by the same note", () => {
  const bad = [];
  for (const row of NOTES) {
    const cited = citedVerses(row.note).map((r) => words(VERSES.get(r) ?? "")).join(" | ");
    for (const [, q] of row.note.matchAll(/"([^"]+)"/g)) if (!cited.includes(words(q))) bad.push(`${row.id}: "${q}"`);
  }
  assert.deepEqual(bad, []);
});

// The factual descriptions (D4 onward) cite verses in parentheses; older hand-written notes with inline
// refs (split cards, terms) wait for their own pass and are not held to the three-sentence rule yet.
const FACTUAL = NOTES.filter((row) => new RegExp(`\\((?:${BOOK}) \\d`).test(row.note));

test("factual names notes stay within three sentences", () => {
  assert.ok(FACTUAL.length > 150, `only ${FACTUAL.length} factual notes found`);
  const long = FACTUAL.filter((row) => sentenceCount(row.note) > 3).map((row) => `${row.id}: ${sentenceCount(row.note)}`);
  assert.deepEqual(long, []);
});

test("fixed wording stays fixed (W-159, W-160, W-163, W-164)", () => {
  const note = (id) => NAMES.find((row) => row.id === id).note;
  assert.match(note("barnaba"), /brought him back to Antiokia/);
  assert.doesNotMatch(note("barnaba"), /taught there a whole year/);
  assert.match(note("shila"), /16:23–24/);
  assert.doesNotMatch(note("shila"), /at midnight in prison/);
  assert.doesNotMatch(note("lud"), /died there/);
  assert.match(note("lud"), /died in Yopa/);
  assert.doesNotMatch(note("tsiyon"), /Matthew and John quote/);
});
