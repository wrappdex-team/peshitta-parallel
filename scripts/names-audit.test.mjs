import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const GONE = [
  "Jesus", "Christ", "Mary", "Peter", "God", "John", "James", "Joseph", "Moses",
  "Pilate", "Herod", "Herodus", "Barnabas", "Barnaba", "Andrew", "Thomas",
  "Timothy", "Ephesus", "Jews", "Lazarus", "Nathaniel", "Antioch", "Babylon",
  "Isaiah", "Damascus", "Noah", "Elizabeth", "Ananias", "Apollos", "Cornelius",
  "Silvanus", "Priscilla", "Onesimus",
];

test("the English Peshitta does not keep the familiar spellings that were changed", () => {
  const files = readdirSync(new URL("src/data/nt", root)).filter((file) => file.endsWith(".json"));
  for (const word of GONE) {
    const re = new RegExp(`\\b${word}\\b`);
    for (const file of files) {
      const book = JSON.parse(read(`src/data/nt/${file}`));
      for (const chapter of book.chapters) {
        for (const verse of chapter) {
          assert.equal(re.test(verse.en || ""), false, `${book.id} still has ${word}`);
        }
      }
    }
  }
});

test("the name index records the original English, the familiar finder, and the Syriac", () => {
  const registry = JSON.parse(read("src/data/names.json"));
  assert.ok(registry.names.length >= 90);
  const yshua = registry.names.find((row) => row.en === "Y'shua");
  const keefa = registry.names.find((row) => row.en === "Keefa");
  const herodes = registry.names.find((row) => row.en === "Herodes");
  assert.equal(yshua.known, "Jesus");
  assert.equal(yshua.sy, "ܝܫܘܥ");
  assert.ok(yshua.count > 1000);
  assert.equal(keefa.known, "Peter");
  assert.equal(herodes.known, "Herod");
  for (const row of registry.names) {
    assert.ok(row.sy && row.en && row.known && row.kind && row.ref);
    assert.ok(row.count > 0);
  }
});
