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
  const books = new Map();
  const bookOf = (id) => {
    if (!books.has(id)) books.set(id, JSON.parse(read(`src/data/nt/${id}.json`)));
    return books.get(id);
  };
  const prints = (row, ref) => {
    const parsed = /^([a-z0-9]+) (\d+):(\d+)$/.exec(ref);
    assert.ok(parsed, `${row.en} ${ref}`);
    const verse = bookOf(parsed[1]).chapters[Number(parsed[2]) - 1].find((item) => item.v === Number(parsed[3]));
    assert.ok(verse, ref);
    return row.forms.some((form) => new RegExp(`(?<![A-Za-z'’\\-])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z'’\\-])`).test(verse.en || ""));
  };
  for (const row of registry.names) {
    assert.notEqual(row.en, "Amen");
    assert.equal(row.kind === "person" || row.kind === "place" || row.kind === "people" || row.kind === "letter" || row.kind === "title", true, row.en);
    for (const form of row.forms) {
      assert.equal(owners.has(form), false, form);
      owners.set(form, row.id);
    }
    assert.equal(prints(row, row.ref), true, `${row.en} ${row.ref}`);
    if (row.refs) {
      assert.ok(row.refs.length >= 2 && row.refs.length <= 12, row.en);
      assert.equal(row.refs[0], row.ref, row.en);
      for (const ref of row.refs) assert.equal(prints(row, ref), true, `${row.en} ${ref}`);
    }
  }
  const yisrael = registry.names.find((row) => row.en === "Yisrael");
  assert.equal(yisrael.kind, "people");
  assert.ok(yisrael.spellings.length >= 2);
  const sara = registry.names.find((row) => row.en === "Sara");
  assert.ok(sara.count < 10, sara.count);
  assert.equal(registry.names.find((row) => row.en === "Hawwa").count, 2);
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

test("the name index keeps the cry Abba off Bar Abba and records the people the audit was missing", () => {
  const registry = JSON.parse(read("src/data/names.json"));
  const row = (en) => registry.names.find((item) => item.en === en);
  const abba = row("Abba");
  assert.equal(abba.count, 3);
  assert.equal(abba.ref, "mark 14:36");
  const bar = row("Bar-Abba");
  assert.ok(bar.forms.includes("Bar Abba"));
  assert.ok(bar.count > abba.count);
  assert.equal(row("Pergama"), undefined);
  const pergamos = row("Pergamos");
  assert.equal(pergamos.kind, "place");
  assert.equal(pergamos.known, "Pergamum");
  assert.ok(pergamos.forms.includes("Pergama"));
  assert.equal(row("Shalom").known, "Salome");
  assert.equal(row("Shapira").known, "Sapphira");
  assert.equal(row("Shushan").known, "Susanna");
  assert.equal(row("Shamrin").known, "Samaria");
  assert.equal(row("Yochan").known, "Joanna");
  assert.equal(row("Yochan").count, 2);
  assert.equal(row("Pharisees").kind, "people");
  assert.ok(row("Pharisees").count > 80);
  assert.equal(row("Malek").count, 1);
  assert.equal(row("Malek").ref, "john 18:10");
  assert.ok(row("Epenetos"));
  assert.ok(row("Hermas"));
  assert.equal(row("Qolosos").known, "Colossae");
  assert.equal(row("Rephan").ref, "acts 7:43");
  assert.equal(row("Shekim").kind, "place");
  assert.equal(row("Shekim").known, "Shechem");
  assert.equal(row("Lasa").kind, "place");
  assert.equal(row("Sarqusa").known, "Syracuse");
  assert.equal(row("Bar-Shuma").known, "Bar-Jesus");
  assert.equal(row("Arios Pagos").known, "Areopagus");
  assert.equal(row("Arios Pagos").kind, "place");
  assert.ok(row("Hawwa").forms.includes("Eve"));
  assert.equal(row("Yawnaye").id, "junia");
  const luke = JSON.parse(read("src/data/nt/luke.json"));
  const wife = luke.chapters[7].find((verse) => verse.v === 3);
  assert.match(wife.en, /Yochan the wife of Kuza/);
  assert.equal(/Yochanan the wife/.test(wife.en), false);
  const forms = [...registry.names.flatMap((item) => item.forms)].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![A-Za-z'’\\-])(${forms.map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![A-Za-z'’\\-])`, "u");
  const owner = new Map(registry.names.flatMap((item) => item.forms.map((form) => [form, item.id])));
  assert.equal(owner.get("Bar Abba".match(re)[1]), bar.id);
  assert.equal(owner.get("Abba, my Father".match(re)[1]), abba.id);
  assert.equal(owner.get("the king".match(re)), undefined);
  assert.equal(owner.get("His name was Malek.".match(re)[1]), row("Malek").id);
  assert.equal(owner.get("Yochanan".match(re)[1]), row("Yochanan").id);
});

