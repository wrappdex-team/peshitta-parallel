import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/local-rate-limit.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture(options = {}) {
  const exports = {};
  runInNewContext(compiled, { exports });
  let time = 0;
  const limiter = exports.createLocalRateLimiter({
    windowMs: 1000,
    maxEntries: 2,
    ...options,
    now: () => time,
  });
  return {
    limiter,
    setTime: (value) => {
      time = value;
    },
  };
}

test("rolling quota expires at the same exact boundary, not one request early", () => {
  const { limiter, setTime } = fixture();
  assert.equal(limiter.allow("a", 2), true);
  assert.equal(limiter.allow("a", 2), true);
  assert.equal(limiter.allow("a", 2), false);
  setTime(999);
  assert.equal(limiter.allow("a", 2), false);
  setTime(1000);
  assert.equal(limiter.allow("a", 2), true);
  assert.equal(limiter.size, 1);
});

test("staggered timestamps retain sliding-window rather than fixed-window semantics", () => {
  const { limiter, setTime } = fixture();
  assert.equal(limiter.allow("a", 2), true);
  setTime(500);
  assert.equal(limiter.allow("a", 2), true);
  setTime(1000);
  assert.equal(limiter.allow("a", 2), true);
  setTime(1499);
  assert.equal(limiter.allow("a", 2), false);
  setTime(1500);
  assert.equal(limiter.allow("a", 2), true);
});

test("capacity rejects unknown identities without evicting or resetting active quotas", () => {
  const { limiter, setTime } = fixture();
  assert.equal(limiter.allow("a", 1), true);
  assert.equal(limiter.allow("b", 1), true);
  for (let i = 0; i < 2000; i++) assert.equal(limiter.allow(`rotating-${i}`, 1), false);
  assert.equal(limiter.allow("a", 1), false);
  assert.equal(limiter.allow("b", 1), false);
  assert.equal(limiter.size, 2);
  setTime(1000);
  assert.equal(limiter.allow("new", 1), true);
  assert.equal(limiter.size, 1);
});

test("an existing identity can use its remaining quota when the table is full", () => {
  const { limiter } = fixture();
  assert.equal(limiter.allow("a", 2), true);
  assert.equal(limiter.allow("b", 2), true);
  assert.equal(limiter.allow("new", 2), false);
  assert.equal(limiter.allow("a", 2), true);
  assert.equal(limiter.allow("a", 2), false);
  assert.equal(limiter.allow("b", 2), true);
  assert.equal(limiter.size, 2);
});

test("successful refresh preserves expiry order and reclaims only expired identities", () => {
  const { limiter, setTime } = fixture();
  assert.equal(limiter.allow("a", 2), true);
  setTime(100);
  assert.equal(limiter.allow("b", 2), true);
  setTime(200);
  assert.equal(limiter.allow("a", 2), true);
  setTime(1100);
  assert.equal(limiter.allow("c", 2), true); // b expired, but a is still active.
  assert.equal(limiter.size, 2);
  assert.equal(limiter.allow("a", 2), true);
  assert.equal(limiter.allow("a", 2), false);
});

test("rejected requests do not renew an exhausted identity's retention", () => {
  const { limiter, setTime } = fixture({ maxEntries: 1 });
  assert.equal(limiter.allow("a", 1), true);
  setTime(999);
  assert.equal(limiter.allow("a", 1), false);
  setTime(1000);
  assert.equal(limiter.allow("b", 1), true);
  assert.equal(limiter.size, 1);
});

test("clock rollback/nonfinite readings cannot reset a quota or grow state", () => {
  const { limiter, setTime } = fixture();
  setTime(100);
  assert.equal(limiter.allow("a", 1), true);
  setTime(-100);
  assert.equal(limiter.allow("a", 1), false);
  setTime(NaN);
  assert.equal(limiter.allow("b", 1), false);
  setTime(Infinity);
  assert.equal(limiter.allow("b", 1), false);
  assert.equal(limiter.size, 1);
  setTime(1099);
  assert.equal(limiter.allow("a", 1), false);
  setTime(1100);
  assert.equal(limiter.allow("a", 1), true);
});

test("default capacity and retained identity length are bounded", () => {
  const { limiter } = fixture({ maxEntries: 4096 });
  assert.equal(limiter.allow("x".repeat(129), 1), false);
  assert.equal(limiter.allow("", 1), false);
  assert.equal(limiter.allow("invalid-limit", Infinity), false);
  assert.equal(limiter.allow("invalid-limit", 0), false);
  assert.equal(limiter.allow("x".repeat(128), 1), true);
  for (let i = 1; i < 4096; i++) assert.equal(limiter.allow(`fixture-${i}`, 1), true);
  assert.equal(limiter.allow("over-capacity", 1), false);
  assert.equal(limiter.size, 4096);
});

test("invalid internal capacity/window configuration fails explicitly", () => {
  assert.throws(() => fixture({ maxEntries: 0 }), /positive safe integers/);
  assert.throws(() => fixture({ windowMs: Infinity }), /positive safe integers/);
});

test("normal admission decisions match the original rolling-window model", () => {
  const { limiter, setTime } = fixture({ maxEntries: 8, windowMs: 100 });
  const reference = new Map();
  let seed = 123;
  let time = 0;
  for (let i = 0; i < 10000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    time += seed % 4;
    if (i % 500 === 0) time += 200;
    setTime(time);
    const key = `fixture-${seed % 5}`;
    const recent = (reference.get(key) ?? []).filter((stamp) => time - stamp < 100);
    const allowed = recent.length < 3;
    if (allowed) recent.push(time);
    reference.set(key, recent);
    assert.equal(limiter.allow(key, 3), allowed, `admission ${i}`);
  }
});
