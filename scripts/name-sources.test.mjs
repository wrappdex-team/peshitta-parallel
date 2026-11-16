import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertNameSourcesFresh, extractNameSources, sourceIds, sourcePack } from "./name-sources.mjs";

const NAMES = JSON.parse(readFileSync(new URL("../src/data/names.json", import.meta.url), "utf8")).names;

test("extractor keeps a stored citation, skips a card without one, and finds a URL", () => {
  const rows = [
    { id: "with", root: { source: "Strong’s G1 (https://example.com/g1)." } },
    { id: "plain", root: { lang: "Latin" } },
    { id: "blank", root: { source: "  " } },
    { id: "none" },
  ];
  const extracted = extractNameSources(rows);
  assert.deepEqual(extracted, [
    { id: "with", source: "Strong’s G1 (https://example.com/g1).", urls: ["https://example.com/g1"] },
  ]);
  assert.deepEqual(sourcePack(rows), { with: "Strong’s G1 (https://example.com/g1)." });
  assert.deepEqual(sourceIds(rows), ["with"]);
});

test("committed sources match names.json", () => {
  const pack = JSON.parse(readFileSync(new URL("../src/lib/name-source-pack.json", import.meta.url), "utf8"));
  const ids = JSON.parse(readFileSync(new URL("../src/lib/name-source-ids.json", import.meta.url), "utf8"));
  assertNameSourcesFresh(pack, ids, NAMES);
  const junia = NAMES.find((row) => row.id === "junia");
  assert.equal(pack.junia, junia.root.source);
  assert.equal(pack.keefa, undefined);
});

test("editing a source in names.json without regenerating fails the check", () => {
  const pack = sourcePack(NAMES);
  const ids = sourceIds(NAMES);
  const changed = NAMES.map((row) =>
    row.id === "junia" ? { ...row, root: { ...row.root, source: `${row.root.source} (edited)` } } : row,
  );
  assert.throws(() => assertNameSourcesFresh(pack, ids, changed), /stale: junia/);
});
