import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { auditScripture, classifyIssues } from "./check-scripture-data.mjs";

const root = new URL("../", import.meta.url);
const known = JSON.parse(
  readFileSync(new URL("../docs/data-known-gaps.json", import.meta.url)),
).issues;

test("all actual data is audited; known blanks are reported, not silently excused", () => {
  const report = auditScripture();
  assert.equal(report.books, 27);
  assert.equal(report.verses, 7957);
  assert.deepEqual(report.issues, [...known].sort());
  assert.equal(report.issues.length, 78);
});

test("only exact known references are accepted; new gaps fail even at the same count", () => {
  assert.deepEqual(classifyIssues(["old", "new"], ["old"]), {
    known: ["old"],
    unexpected: ["new"],
  });
  assert.deepEqual(classifyIssues([], ["old"]), { known: [], unexpected: [] });
});

test("mutated data detects blanks, malformed values, misalignment, missing files and verse numbering", (t) => {
  const temp = mkdtempSync(join(tmpdir(), "injeel-data-test-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  cpSync(new URL("src/data", root), join(temp, "src/data"), { recursive: true });
  const mutate = (rel, fn) => {
    const path = join(temp, rel);
    const data = JSON.parse(readFileSync(path));
    fn(data);
    writeFileSync(path, JSON.stringify(data));
  };
  mutate("src/data/nt/john.json", (book) => {
    book.chapters[0][0].v = 2;
    book.chapters[0][1].sy = " ";
  });
  mutate("src/data/tr/fr/john.json", (grid) => {
    grid[0][0] = " ";
    grid[0][1] = null;
    grid[1].pop();
  });
  rmSync(join(temp, "src/data/tr/ru/mark.json"));
  const { unexpected } = classifyIssues(auditScripture(temp).issues, known);
  for (const suffix of [
    "verse-number:1:1",
    "sy-blank:1:2",
    "text-blank:1:1",
    "text-type:1:2",
    "verse-count:2",
    "missing-file",
  ]) {
    assert.ok(
      unexpected.some((issue) => issue.endsWith(suffix)),
      suffix,
    );
  }
});

test("CLI distinguishes a regression pass from strict incompleteness and rejects unknown flags", async () => {
  const { spawnSync } = await import("node:child_process");
  const script = new URL("./check-scripture-data.mjs", import.meta.url);
  const run = (args) =>
    spawnSync(process.execPath, [script.pathname, ...args], { encoding: "utf8" });
  const regression = run([]);
  assert.equal(regression.status, 0, regression.stderr);
  const strict = run(["--strict"]);
  assert.equal(strict.status, 1, strict.stderr);
  const report = JSON.parse(strict.stdout);
  assert.equal(report.mode, "strict");
  assert.equal(report.known.length, known.length);
  assert.equal(report.unexpected.length, 0);
  assert.notEqual(run(["--ignore-all"]).status, 0);
});
