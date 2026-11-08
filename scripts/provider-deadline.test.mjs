import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/provider-deadline.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture() {
  const exports = {};
  const timers = new Map();
  runInNewContext(compiled, {
    exports,
    AbortController,
    setTimeout: (callback, ms) => {
      const id = {};
      timers.set(id, { callback, ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  const controller = new AbortController();
  let added = 0;
  let removed = 0;
  const parent = {
    get aborted() {
      return controller.signal.aborted;
    },
    addEventListener(...args) {
      added++;
      controller.signal.addEventListener(...args);
    },
    removeEventListener(...args) {
      removed++;
      controller.signal.removeEventListener(...args);
    },
  };
  return { ...exports, timers, controller, parent, added: () => added, removed: () => removed };
}

test("whole-operation budgets are explicit and not reset for a second await", async () => {
  const f = fixture();
  let release;
  const pending = f.withProviderDeadline("generation", async () => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return new Promise(() => {});
  });
  await Promise.resolve();
  assert.equal(f.timers.size, 1);
  const timer = [...f.timers.values()][0];
  assert.equal(timer.ms, 240000);
  release();
  await Promise.resolve();
  assert.equal([...f.timers.values()][0], timer, "one timer spans all work");
  timer.callback();
  assert.equal((await pending).ok, false);
  assert.equal(f.timers.size, 0);
  const status = f.withProviderDeadline("status", () => new Promise(() => {}));
  assert.equal([...f.timers.values()][0].ms, 15000);
  [...f.timers.values()][0].callback();
  assert.equal((await status).ok, false);
});

test("success and failure remove parent listeners and timers; pre-aborted work never starts", async () => {
  const f = fixture();
  assert.equal(
    await f.withProviderDeadline("generation", async () => "fixture", f.parent),
    "fixture",
  );
  const failure = await f.withProviderDeadline(
    "generation",
    async () => {
      throw new Error("private fixture");
    },
    f.parent,
  );
  assert.equal(failure.ok, false);
  assert.doesNotMatch(failure.error, /private fixture/);
  assert.equal(f.added(), 2);
  assert.equal(f.removed(), 2);
  assert.equal(f.timers.size, 0);
  f.controller.abort();
  let called = false;
  assert.equal(
    (
      await f.withProviderDeadline(
        "generation",
        async () => {
          called = true;
        },
        f.parent,
      )
    ).ok,
    false,
  );
  assert.equal(called, false);
  assert.equal(f.added(), 2);
  assert.equal(f.timers.size, 0);
});

test("timeout requests abort a real pending response body and handle its rejection", async () => {
  const f = fixture();
  let body;
  let upstream;
  const pending = f.withProviderDeadline(
    "generation",
    async (signal) => {
      upstream = signal;
      const response = new Response(
        new ReadableStream({
          start(controller) {
            body = controller;
          },
        }),
      );
      signal.addEventListener("abort", () => body.error(new Error("private body failure")), {
        once: true,
      });
      return response.arrayBuffer();
    },
    f.parent,
  );
  await Promise.resolve();
  [...f.timers.values()][0].callback();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.match(result.error, /timed out/);
  assert.doesNotMatch(result.error, /private body failure/);
  assert.equal(upstream.aborted, true);
  assert.equal(f.removed(), 1);
  assert.equal(f.timers.size, 0);
});
