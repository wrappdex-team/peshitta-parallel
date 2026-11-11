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

test("a name's first verse is a verse that actually prints it", () => {
  const registry = JSON.parse(read("src/data/names.json"));
  const owners = new Map();
  for (const row of registry.names) {
    assert.notEqual(row.en, "Amen");
    assert.equal(row.kind === "person" || row.kind === "place" || row.kind === "people" || row.kind === "letter" || row.kind === "title", true, row.en);
    for (const form of row.forms) {
      assert.equal(owners.has(form), false, form);
      owners.set(form, row.id);
    }
    const ref = /^([a-z0-9]+) (\d+):(\d+)$/.exec(row.ref);
    assert.ok(ref, row.en);
    const book = JSON.parse(read(`src/data/nt/${ref[1]}.json`));
    const verse = book.chapters[Number(ref[2]) - 1].find((item) => item.v === Number(ref[3]));
    assert.ok(verse, row.ref);
    const printed = row.forms.some((form) => new RegExp(`(?<![A-Za-z'’\\-])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z'’\\-])`).test(verse.en || ""));
    assert.equal(printed, true, `${row.en} ${row.ref}`);
  }
  const yisrael = registry.names.find((row) => row.en === "Yisrael");
  assert.equal(yisrael.kind, "people");
  assert.ok(yisrael.spellings.length >= 2);
  const sara = registry.names.find((row) => row.en === "Sara");
  assert.ok(sara.count < 10, sara.count);
  assert.equal(registry.names.find((row) => row.en === "Hawwa").count, 1);
  assert.equal(registry.names.find((row) => row.en === "Korazin").kind, "place");
  assert.equal(registry.names.some((row) => row.en === "Kurazin"), false);
  assert.equal(registry.names.find((row) => row.en === "Shalem").known, "Salem");
  assert.equal(registry.names.find((row) => row.en === "Shalim").known, "Salim");
});

test("Hebrews keeps the Syriac letter mem where a Latin V had been written", () => {
  const files = readdirSync(new URL("src/data/nt", root)).filter((file) => file.endsWith(".json"));
  for (const file of files) {
    const book = JSON.parse(read(`src/data/nt/${file}`));
    for (const chapter of book.chapters) {
      for (const verse of chapter) {
        assert.equal(/[A-Za-z]/.test(verse.sy || ""), false, `${file}`);
      }
    }
  }
  const hebrews = JSON.parse(read("src/data/nt/hebrews.json"));
  const salem = hebrews.chapters[6].find((verse) => verse.v === 1);
  assert.match(salem.sy, /ܐܒܪܗܡ/);
  assert.match(salem.sy, /ܫܠܝܡ/);
});
