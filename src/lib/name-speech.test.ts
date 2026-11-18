import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nameUtterances, type NameUtterance } from "./name-speech.ts";
import type { NameEntry } from "./names.ts";

const names = (JSON.parse(readFileSync(new URL("../data/names.json", import.meta.url), "utf8")) as { names: NameEntry[] }).names;

function entry(partial: Partial<NameEntry> & Pick<NameEntry, "say" | "known">): NameEntry {
  return {
    id: "fixture",
    sy: "",
    en: partial.known,
    kind: "person",
    count: 1,
    ref: "",
    note: "",
    ...partial,
  };
}

function texts(lines: NameUtterance[]) {
  return lines.map((line) => line.text);
}

test("Keefa is spoken root then English", () => {
  const row = names.find((item) => item.id === "keefa");
  assert.ok(row);
  const lines = nameUtterances(row);
  assert.deepEqual(texts(lines), ["keefa", "Peter"]);
  assert.deepEqual(
    lines.map((line) => line.lang),
    ["en-US", "en-US"],
  );
  assert.deepEqual(
    lines.map((line) => line.rate),
    [0.72, 0.9],
  );
  assert.deepEqual(
    lines.map((line) => line.part),
    ["root", "en"],
  );
});

test("Y'shua is read as Yeshua, not the raw yshua", () => {
  const row = names.find((item) => item.id === "yshua");
  assert.ok(row);
  assert.equal(row.pron?.root?.respell, "yeh-shoo-ah");
  const lines = nameUtterances(row);
  assert.equal(lines.find((line) => line.part === "root")?.text, "yeh shoo ah");
  assert.notEqual(lines[0].text, "yshua");
  assert.equal(lines[1].text, "Jesus");
});

test("aphsiya drops the glottal and the vowel marks", () => {
  const row = names.find((item) => item.id === "aphsiya");
  assert.equal(row?.say, "ʾepsāyā");
  assert.equal(nameUtterances(row!).find((line) => line.part === "root")?.text, "epsaya");
});

test("a respelling turns hyphens into pauses", () => {
  const lines = nameUtterances(entry({ say: "ignored", known: "Corinth", pron: { root: { respell: "kor-in-thos" } } }));
  assert.equal(lines[0].text, "kor in thos");
  assert.equal(lines[1].text, "Corinth");
});

test("no utterance keeps a combining mark or a glottal letter", () => {
  const marked = /\p{M}/u;
  const glottal = /[ʿʾ]/;
  for (const row of names) {
    for (const line of nameUtterances(row)) {
      assert.equal(marked.test(line.text), false, `${row.id} ${line.part} ${line.text}`);
      assert.equal(glottal.test(line.text), false, `${row.id} ${line.part} ${line.text}`);
    }
  }
  const extra = nameUtterances(entry({ say: "ʾepsāyā", known: "Apphia", pron: { root: { respell: "kor-in-thos" } } }));
  for (const line of extra) {
    assert.equal(marked.test(line.text), false);
    assert.equal(glottal.test(line.text), false);
  }
});

test("name speech stays on the device", () => {
  const speech = readFileSync(new URL("./name-speech.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../routes/names.tsx", import.meta.url), "utf8");
  for (const source of [speech, page]) {
    assert.equal(source.includes("fetch("), false);
    assert.equal(source.includes("createServerFn"), false);
    assert.equal(source.includes("process.env"), false);
  }
});

test("readLabel says the name once when the heading and English match", async () => {
  const { readLabel } = await import("./name-speech.ts");
  assert.equal(readLabel("Alexandria", "Alexandria"), "Read Alexandria (Syriac, then English)");
  assert.equal(readLabel("Abba", "abba"), "Read Abba (Syriac, then English)");
  assert.equal(readLabel("Keefa", "Peter"), "Read Keefa then Peter");
  assert.equal(readLabel("Ya'akov", "James"), "Read Ya'akov then James");
  assert.equal(readLabel("Ya'akov", "Ya’akov"), "Read Ya'akov (Syriac, then English)");
  for (const row of names) {
    const label = readLabel(row.root?.text ?? row.en, nameUtterances(row)[1].text);
    assert.doesNotMatch(label, /^Read (.+) then \1$/i, row.id);
  }
});
