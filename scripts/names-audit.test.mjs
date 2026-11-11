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

test("the name index records every studied person and place with the Syriac, the reading, and a note", () => {
  const registry = JSON.parse(read("src/data/names.json"));
  assert.ok(registry.names.length >= 250);
  const ids = new Set();
  const yshua = registry.names.find((row) => row.en === "Y'shua");
  const keefa = registry.names.find((row) => row.en === "Keefa");
  const herodes = registry.names.find((row) => row.en === "Herodes");
  const city = registry.names.find((row) => row.en === "Urishlim");
  assert.equal(yshua.known, "Jesus");
  assert.equal(yshua.sy, "ܝܫܘܥ");
  assert.equal(yshua.say, "Y'shua");
  assert.ok(yshua.count > 1000);
  assert.equal(keefa.known, "Peter");
  assert.equal(herodes.known, "Herod");
  assert.equal(city.kind, "place");
  assert.equal(city.known, "Jerusalem");
  assert.ok(registry.names.some((row) => row.kind === "person"));
  assert.ok(registry.names.some((row) => row.kind === "place"));
  for (const row of registry.names) {
    assert.ok(row.id && row.sy && row.en && row.known && row.say && row.kind && row.ref && row.note);
    assert.ok(row.count > 0);
    assert.equal(ids.has(row.id), false, row.id);
    ids.add(row.id);
    assert.ok(row.forms.includes(row.en));
  }
});
