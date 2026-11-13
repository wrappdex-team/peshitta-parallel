// Guards the CI harness itself, so a unit test can never again hang `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function walk(dir, match, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(entry.name)) out.push(relative(ROOT, full));
  }
  return out;
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

test("unit tests never launch a browser or a dev server", () => {
  for (const file of walk(join(ROOT, "scripts"), (name) => name.endsWith(".test.mjs"))) {
    const source = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(
      source,
      /from\s+["']playwright/,
      `${file}: browser tests belong in *.browser-test.mjs`,
    );
    assert.doesNotMatch(
      source,
      /["']vite["'],\s*["']dev["']/,
      `${file}: unit tests must not start a dev server`,
    );
  }
});

test("every src unit test is wired into npm test", () => {
  for (const file of walk(join(ROOT, "src"), (name) => /\.test\.tsx?$/.test(name))) {
    assert.ok(pkg.scripts.test.includes(file), `${file} is not run by npm test`);
  }
});

test("every node --test run has a timeout and force-exit", () => {
  for (const name of ["test", "test:browser"]) {
    const runs = pkg.scripts[name].split("&&").filter((part) => part.includes("--test"));
    assert.ok(runs.length > 0, `${name} runs node --test`);
    for (const run of runs) {
      assert.match(run, /--test-timeout=\d+/, `${name}: ${run.trim()} needs --test-timeout`);
      assert.match(run, /--test-force-exit/, `${name}: ${run.trim()} needs --test-force-exit`);
    }
  }
});

test("CI installs the browser, runs the browser tests and bounds every step", () => {
  const workflow = readFileSync(join(ROOT, ".github/workflows/readiness.yml"), "utf8");
  assert.match(workflow, /playwright install/);
  assert.match(workflow, /npm run test:browser/);
  let bounded = 0;
  for (const step of workflow.matchAll(/^\s+- name: (.+)\n((?:\s{8,}.+\n)+)/gm)) {
    if (!/\brun:/.test(step[2])) continue;
    assert.match(step[2], /timeout-minutes:/, `step "${step[1]}" needs timeout-minutes`);
    bounded += 1;
  }
  assert.ok(bounded >= 7, `expected every run step to be named and bounded, found ${bounded}`);
  assert.doesNotMatch(
    workflow,
    /^\s+- run:/m,
    "every run step must be named so it can carry a timeout",
  );
});
