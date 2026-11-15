import assert from "node:assert/strict";
import test from "node:test";
import { NAMES, filterNames, foldApostrophes, foldName, kindLabel, matchRank, nameKindCounts } from "./names.ts";
import { nameVerses, studyPeople, studySee, studySnapshot } from "./name-verses.ts";
import { readFileSync } from "node:fs";

test("kind counts add up to every card", () => {
  const counts = nameKindCounts();
  assert.equal(counts.all, 505);
  assert.equal(counts.person, 332);
  assert.equal(counts.place, 151);
  assert.equal(counts.people, 17);
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

test("plain typing and the apostrophe both find the card first", () => {
  const queries = [
    ["yaakov", "yaakov"],
    ["Ya'akov", "yaakov"],
    ["yitzchak", "yitzchak"],
    ["ammanuel", "ammanuel"],
    ["fanuel", "fanuel"],
    ["rechavam", "rechavam"],
    ["yeshua", "yshua"],
    ["Y'shua", "yshua"],
  ];
  for (const [query, id] of queries) {
    assert.equal(filterNames(query, "all", false)[0]?.id, id, query);
  }
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

test("Mary ranks written names ahead of a say-prefix", () => {
  const hits = filterNames("Mary", "all", false);
  assert.equal(hits[0]?.id, "maryam");
  const yhwhAt = hits.findIndex((row) => row.id === "yhwh");
  assert.ok(yhwhAt > 0);
  const query = foldName("Mary");
  for (const row of hits) {
    const fields = [row.en, row.known, ...(row.forms ?? []), ...(row.spellings ?? []), ...row.known.split(",")];
    const written = fields.some((field) => {
      const folded = foldName(field);
      return folded === query || folded.startsWith(query) || folded.includes(query);
    });
    if (written) assert.ok(hits.indexOf(row) < yhwhAt, row.id);
  }
  const maryamRank = matchRank(NAMES.find((row) => row.id === "maryam")!, "Mary");
  const yhwhRank = matchRank(NAMES.find((row) => row.id === "yhwh")!, "Mary");
  assert.equal(maryamRank, 0);
  assert.ok(yhwhRank !== null && yhwhRank >= 3, `yhwh rank ${yhwhRank}`);
});

test("Other is the five titles and letters", () => {
  assert.equal(nameKindCounts().other, 5);
  assert.equal(kindLabel("title"), "Title");
  assert.equal(kindLabel("letter"), "Letter");
  assert.equal(kindLabel("person"), "Person");
  for (const row of NAMES.filter((item) => item.kind === "title" || item.kind === "letter")) {
    assert.equal(kindLabel(row.kind), row.kind === "title" ? "Title" : "Letter");
  }
});

test("keefa's verse list is the whole count, in canon order", () => {
  const row = NAMES.find((item) => item.id === "keefa");
  assert.ok(row);
  const verses = nameVerses(row);
  assert.equal(verses.length, row.count);
  assert.equal(verses[0]?.label, "Matthew 4:18");
  assert.equal(verses.length - 6, row.count - 6);
  assert.match(verses[0]?.label ?? "", /^[A-Z]/);
});

test("cards without people or see stay as they are", () => {
  const snap = ["keefa", "alap", "yhwh", "kandak", "magdu"].map((id) => {
    const row = NAMES.find((item) => item.id === id);
    assert.ok(row, id);
    return studySnapshot(row);
  });
  assert.deepEqual(
    snap.map((row) => ({ people: row.people, see: row.see })),
    [
      { people: 0, see: [] },
      { people: 0, see: [] },
      { people: 0, see: [] },
      { people: 0, see: [] },
      { people: 0, see: [] },
    ],
  );
});

test("a shared-name fixture renders two people and a see link", () => {
  const row = {
    ...NAMES.find((item) => item.id === "yaakov")!,
    people: [
      { label: "Ya'akov son of Zabdai", refs: ["matthew 4:21", "matthew 10:2"] },
      { label: "Ya'akov brother of Y'shua", refs: ["matthew 13:55"] },
    ],
    see: ["megdo"],
  };
  const lines = studyPeople(row);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.label, "Ya'akov son of Zabdai");
  assert.deepEqual(
    lines[0]?.links.map((link) => link.label),
    ["Matthew 4:21", "Matthew 10:2"],
  );
  assert.equal(lines[0]?.links[0]?.href, "/read/matthew/4#v-21");
  assert.equal(lines[1]?.label, "Ya'akov brother of Y'shua");
  assert.equal(lines[1]?.links[0]?.href, "/read/matthew/13#v-55");
  const see = studySee(row);
  assert.equal(see.length, 1);
  assert.equal(see[0]?.href, "/names#megdo");
  assert.equal(see[0]?.id, "megdo");
  const page = readFileSync(new URL("../routes/names.tsx", import.meta.url), "utf8");
  assert.match(page, /studyPeople\(row\)/);
  assert.match(page, /studySee\(row\)/);
  assert.match(page, /data-name-person/);
  assert.match(page, /data-name-see=\{item\.id\}/);
  assert.match(page, /hashScrollIntoView=\{false\}/);
  assert.equal(studySnapshot(NAMES.find((item) => item.id === "yaakov")!).people, 0);
  assert.deepEqual(studySee(NAMES.find((item) => item.id === "yaakov")!), []);
});
