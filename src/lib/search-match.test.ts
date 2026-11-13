import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { versesIn } from "./verse-counts.ts";
import { HELP } from "./help.ts";
import { speechOf } from "./jesus.ts";
import { GUIDE } from "./guide.ts";
import {
  findSpan,
  foreignScript,
  matchRank,
  nameMatches,
  nameSentence,
  orderHits,
  parseReference,
  referenceFault,
  resultNote,
  searchVerses,
  verseNeedles,
  type NameLite,
} from "./search-match.ts";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")) as {
  id: string;
  chapters: number;
}[];
const names = (JSON.parse(readFileSync(new URL("../data/names.json", import.meta.url), "utf8")) as { names: NameLite[] }).names;

const chapters = (id: string) => catalog.find((book) => book.id === id)?.chapters ?? 0;

test("a reference opens the verse, including a space, a local title, and a chapter that is not there", () => {
  assert.deepEqual(parseReference("John 3:16", undefined, chapters), { book: "john", chapter: 3, verse: 16 });
  assert.deepEqual(parseReference("Jn 3:16", undefined, chapters), { book: "john", chapter: 3, verse: 16 });
  assert.deepEqual(parseReference("Joh 3.16", undefined, chapters), { book: "john", chapter: 3, verse: 16 });
  assert.deepEqual(parseReference("1 Cor 13", undefined, chapters), { book: "1corinthians", chapter: 13, verse: 1 });
  assert.deepEqual(parseReference("1 Corinthians 13:1", undefined, chapters), { book: "1corinthians", chapter: 13, verse: 1 });
  assert.deepEqual(parseReference("3:16", "john", chapters), { book: "john", chapter: 3, verse: 16 });
  assert.equal(parseReference("3:16", undefined, chapters), null);
  assert.deepEqual(parseReference("Yochanan 3:16", undefined, chapters), { book: "john", chapter: 3, verse: 16 });
  assert.deepEqual(parseReference("ܝܘܚܢܢ 3:16", undefined, chapters), { book: "john", chapter: 3, verse: 16 });
  assert.equal(parseReference("Keefa's gospel", undefined, chapters), null);
  assert.equal(parseReference("Keefa 1", undefined, chapters), null);
  assert.equal(parseReference("Yochanan's gospel", undefined, chapters), null);
  assert.equal(parseReference("John 99", undefined, chapters), null);
  assert.deepEqual(parseReference("john 3 16", undefined, chapters, versesIn), { book: "john", chapter: 3, verse: 16 });
  assert.deepEqual(parseReference("1 Cor 13 4", undefined, chapters, versesIn), { book: "1corinthians", chapter: 13, verse: 4 });
  assert.deepEqual(parseReference("3 16", "john", chapters, versesIn), { book: "john", chapter: 3, verse: 16 });
  assert.deepEqual(parseReference("Juan 3:16", undefined, chapters, versesIn), { book: "john", chapter: 3, verse: 16 });
  assert.deepEqual(parseReference("Johannes 3:16", undefined, chapters, versesIn), { book: "john", chapter: 3, verse: 16 });
  assert.equal(parseReference("John 22:1", undefined, chapters, versesIn), null);
  assert.equal(referenceFault("John 22:1", undefined, chapters, versesIn), "John has 21 chapters.");
  assert.equal(referenceFault("Philemon 2:1", undefined, chapters, versesIn), "Philemon has 1 chapter.");
  assert.equal(parseReference("John 3:99", undefined, chapters, versesIn), null);
  assert.equal(referenceFault("John 3:99", undefined, chapters, versesIn), "John 3 has 36 verses.");
  assert.equal(referenceFault("John 3:16", undefined, chapters, versesIn), "");
});

test("Jesus is Y'shua in this book, and Peter reaches Keefa and Petros", () => {
  const jesus = nameMatches("Jesus", names);
  assert.ok(jesus.some((hit) => hit.id === "yshua" && hit.en === "Y'shua" && hit.alias));
  assert.deepEqual(verseNeedles("Jesus", jesus), ["Y'shua"]);
  assert.equal(nameSentence(jesus), "Jesus is Y'shua in this book.");
  assert.equal(nameMatches("Y’shua", names).some((hit) => hit.en === "Y'shua" && !hit.alias), true);

  const peter = verseNeedles("Peter", nameMatches("Peter", names)).sort();
  assert.deepEqual(peter, ["Keefa", "Petros"]);
});

test("Mary does not match Maryam, and God does not match ungodly", () => {
  assert.equal(findSpan("Maryam the mother", "Mary", "word"), null);
  assert.ok(findSpan("Maryam the mother", "Maryam", "word"));
  assert.equal(findSpan("the ungodly will perish", "God", "word"), null);
  assert.deepEqual(findSpan("God is love", "God", "word"), [0, 3]);
  assert.ok(findSpan("Y’shua the Mashiyach", "Y'shua", "word"));
  assert.equal(matchRank("God is here", "God", "word"), 3);
  assert.equal(matchRank("the Son of God", "Son of God", "word"), 2);
  assert.equal(matchRank("Son, of God", "Son of God", "word"), 1);
  const hits = searchVerses(
    [
      { book: "matthew", chapter: 1, verse: 1, text: "the Son of God came" },
      { book: "mark", chapter: 1, verse: 1, text: "Son, of God" },
      { book: "luke", chapter: 1, verse: 1, text: "ungodly men" },
    ],
    ["Son of God"],
    "word",
  );
  assert.equal(hits.find((hit) => hit.book === "matthew")?.rank, 2);
  assert.equal(hits.find((hit) => hit.book === "mark")?.rank, 1);
  assert.equal(hits.some((hit) => hit.book === "luke"), false);
  assert.deepEqual(
    orderHits(
      [
        { book: "matthew", chapter: 1, verse: 1, rank: 1 },
        { book: "mark", chapter: 1, verse: 1, rank: 3 },
        { book: "luke", chapter: 1, verse: 1, rank: 2 },
      ],
      undefined,
      "all",
    ).map((hit) => hit.rank),
    [3, 2, 1],
  );
});

test("a Syriac prefix comes off, and a prefix that is the whole word stays", () => {
  assert.ok(findSpan("ܘܐܠܗܐ", "ܐܠܗܐ", "syriac"));
  assert.ok(findSpan("ܘܕܐܠܗܐ", "ܐܠܗܐ", "syriac"));
  assert.ok(findSpan("ܐܠܗܐ܆", "ܐܠܗܐ", "syriac"));
  assert.ok(findSpan("ܘ", "ܘ", "syriac"));
  assert.ok(findSpan("ܕ ܐܠܗܐ", "ܕ", "syriac"));
  assert.equal(findSpan("ܕܐܠܗܐ", "ܕ", "syriac"), null);
  assert.equal(findSpan("ܘ", "ܐܠܗܐ", "syriac"), null);
});

test("a language that is still opening does not say nothing matches", () => {
  const opening = resultNote({
    pending: true,
    failed: false,
    label: "Hebrew",
    query: "שלום",
    total: 0,
    hasReference: false,
    offer: false,
  });
  assert.equal(opening, "Opening the Hebrew.");
  assert.equal(/nothing matches/i.test(opening), false);
  assert.equal(/no verse/i.test(opening), false);
  assert.equal(
    resultNote({
      pending: true,
      failed: false,
      label: "Hebrew",
      query: "Jesus",
      total: 0,
      hasReference: false,
      offer: false,
      named: true,
    }),
    "Opening the Hebrew.",
  );
  assert.equal(
    resultNote({
      pending: false,
      failed: false,
      label: "English",
      query: "zzzzzz",
      total: 0,
      hasReference: false,
      offer: false,
    }),
    "No verse has that word.",
  );
  assert.equal(
    resultNote({
      pending: false,
      failed: false,
      label: "English",
      query: "Jesus",
      total: 0,
      hasReference: false,
      offer: false,
      named: true,
    }),
    "",
  );
  assert.match(
    resultNote({ pending: false, failed: true, label: "Hebrew", query: "שלום", total: 0, hasReference: false, offer: false }),
    /did not open/,
  );
  assert.equal(foreignScript("amor", "es"), null);
  assert.equal(foreignScript("Liebe", "de"), null);
  assert.equal(foreignScript("爱", "zh"), null);
  assert.equal(foreignScript("שלום", "en"), "he");
  assert.equal(foreignScript("ܐܠܗܐ", "en"), "sy");
  assert.equal(foreignScript("love", "sy"), "en");
  assert.equal(foreignScript("love", "aii"), "en");
  assert.equal(foreignScript("love", "en"), null);
  assert.equal(
    resultNote({ pending: false, failed: true, offline: true, label: "German", query: "Gott", total: 0, hasReference: false, offer: false }),
    "You're offline and the German isn't on this device. Copy it from Language › Offline.",
  );
});

test("the guide no longer says the alphabet chooses the index", () => {
  const section = GUIDE.find((item) => item.id === "search");
  const text = JSON.stringify(section);
  assert.equal(/no separate index/.test(text), false);
  assert.equal(/letters you type choose/i.test(text), false);
  assert.equal(/Spanish, German, Chinese, and Japanese/.test(text), false);
  assert.equal(
    HELP.search.line,
    "The language chip chooses the text, a reference jumps to the verse, and the name in this book is the name that is found.",
  );
});

test("words of Y'shua are only the verses that have a saying", () => {
  assert.equal(speechOf("john", 3, 16), null);
  assert.notEqual(speechOf("john", 3, 3), null);
  assert.notEqual(speechOf("matthew", 5, 3), null);
});
