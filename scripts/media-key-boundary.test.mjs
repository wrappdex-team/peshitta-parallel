import assert from "node:assert/strict";
import * as nodeCrypto from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const siteKey = `xai-${"site-fixture-".repeat(3)}`;
const readerKey = `xai-${"reader-fixture-".repeat(3)}`;
const sources = {
  agent: "src/lib/agent.ts",
  rateLimit: "src/lib/local-rate-limit.ts",
  deadline: "src/lib/provider-deadline.ts",
  cacheScope: "src/lib/credential-cache-scope.ts",
  studio: "src/lib/studio.ts",
  speak: "src/lib/speak.ts",
  studioUI: "src/components/studio.tsx",
  keyStorage: "src/lib/provider-key-storage.ts",
};
const compiled = Object.fromEntries(
  Object.entries(sources).map(([name, path]) => [
    name,
    ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
      fileName: path,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
  ]),
);

function load(name, globals) {
  const exports = {};
  runInNewContext(
    compiled[name],
    { exports, ...globals },
    { filename: sources[name], timeout: 1000 },
  );
  return exports;
}

const syntheticCacheCrypto = {
  subtle: {
    async generateKey() {
      return { seed: Buffer.alloc(32, 1) };
    },
    async sign(algorithm, key, data) {
      assert.equal(algorithm, "HMAC");
      const signature = nodeCrypto.createHmac("sha256", key.seed).update(data).digest();
      return signature.buffer.slice(
        signature.byteOffset,
        signature.byteOffset + signature.byteLength,
      );
    },
  },
};
function fixture({ provider, signal, cacheCrypto = syntheticCacheCrypto } = {}) {
  let siteReads = 0;
  let bookLoads = 0;
  let time = 0;
  let callerIP = "192.0.2.1";
  const maps = [];
  class TrackedMap extends Map {
    constructor(...args) {
      super(...args);
      maps.push(this);
    }
  }
  const timers = new Map();
  let nextTimer = 0;
  const setTimer = (callback, ms) => {
    const id = ++nextTimer;
    timers.set(id, { callback, at: time + ms });
    return id;
  };
  const advance = (ms) => {
    time += ms;
    for (const [id, timer] of timers) {
      if (timer.at <= time) {
        timers.delete(id);
        timer.callback();
      }
    }
  };
  const calls = [];
  const agent = load("agent", {
    // Only this synthetic object exists in the VM; never inherit process.env.
    process: {
      env: new Proxy(
        { XAI_API_KEY: siteKey },
        {
          get(target, key) {
            assert.equal(key, "XAI_API_KEY");
            siteReads += 1;
            return target[key];
          },
        },
      ),
    },
  });
  const rateLimit = load("rateLimit", { Map: TrackedMap, performance: { now: () => time } });
  const deadline = load("deadline", {
    AbortController,
    setTimeout: setTimer,
    clearTimeout: (id) => timers.delete(id),
  });
  const cacheScope = load("cacheScope", { crypto: cacheCrypto, TextEncoder });
  const globals = {
    Buffer,
    AbortController,
    setTimeout: setTimer,
    clearTimeout: (id) => timers.delete(id),
    Map: TrackedMap,
    Date: { now: () => time },
    require(name) {
      if (name === "@/lib/agent") return agent;
      if (name === "@/lib/local-rate-limit") return rateLimit;
      if (name === "@/lib/provider-deadline") return deadline;
      if (name === "@/lib/credential-cache-scope") return cacheScope;
      if (name === "@/data/edition") return { BOOKS: [{ id: "fixture", name: "Fixture" }] };
      if (name === "@/lib/languages") return { languageById: () => ({ id: "en", tts: "en" }) };
      if (name === "@/lib/jesus") return { isJesus: () => false };
      if (name === "@/lib/scripture")
        return {
          async loadBook() {
            bookLoads += 1;
            return { chapters: [[{ v: 1, en: "fixture passage" }]] };
          },
          loadParallel: async () => null,
        };
      if (name === "@tanstack/react-start/server")
        return {
          getRequest: () =>
            new Request("https://fixture.invalid/", {
              headers: { "x-forwarded-for": callerIP },
              signal,
            }),
        };
      if (name === "@tanstack/react-start")
        return {
          createServerFn: () => ({
            validator: (validate) => ({
              handler: (handle) => (input) => handle({ data: validate(input) }),
            }),
          }),
        };
      throw new Error(`Unexpected test import: ${name}`);
    },
    async fetch(url, init) {
      calls.push({
        url,
        authorization: init.headers.Authorization ?? init.headers["x-api-key"],
        signal: init.signal,
      });
      if (provider) return provider(url, init);
      if (url.endsWith("/chat/completions"))
        return Response.json({ choices: [{ message: { content: "fixture prompt" } }] });
      if (url.endsWith("/messages"))
        return Response.json({ content: [{ text: "fixture prompt" }] });
      if (url.endsWith("/images/generations"))
        return Response.json({ data: [{ b64_json: "Zml4dHVyZQ==" }] });
      if (url.endsWith("/videos/generations")) return Response.json({ request_id: "fixture-job" });
      if (url.endsWith("/videos/fixture-job"))
        return Response.json({ status: "done", video: { url: "https://fixture.invalid/video" } });
      if (url.endsWith("/tts"))
        return Response.json({
          audio: "Zml4dHVyZQ==",
          duration: 1,
          audio_timestamps: { graph_chars: [], graph_times: [[0, 1]] },
        });
      if (url.endsWith("/audio/speech")) return new Response(new Uint8Array([1, 2, 3]));
      throw new Error(`Unexpected mocked provider URL: ${url}`);
    },
  };
  const studio = load("studio", globals);
  const speak = load("speak", globals);
  const keyStorage = load("keyStorage", {
    require(name) {
      assert.equal(name, "@/lib/agent");
      return agent;
    },
  });
  const ui = load("studioUI", {
    require(name) {
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "@/lib/agent") return agent;
      if (name === "@/lib/local-rate-limit") return rateLimit;
      if (name === "@/lib/provider-deadline") return deadline;
      if (name === "@/lib/credential-cache-scope") return cacheScope;
      if (name === "@/lib/studio") return studio;
      if (name === "@/lib/provider-key-storage") return keyStorage;
      throw new Error(`Unexpected UI test import: ${name}`);
    },
  });
  return {
    agent,
    studio,
    speak,
    ui,
    calls,
    siteReads: () => siteReads,
    bookLoads: () => bookLoads,
    maps,
    advance,
    pendingTimers: () => timers.size,
    setCaller: (ip) => {
      callerIP = ip;
    },
  };
}

const requests = {
  shapePrompt: { text: "fixture passage", style: "", kind: "image" },
  makeImage: { prompt: "fixture prompt" },
  startVideo: { prompt: "fixture prompt" },
  checkVideo: { requestId: "fixture-job" },
  makeAudio: { text: "fixture passage", voice: "ara", language: "English" },
};
const rejectedKeys = [
  undefined,
  null,
  "",
  "   ",
  "unrecognized-provider-fixture-key",
  "xai-short",
  `xai-${"x".repeat(301)}`,
  { invalid: true },
];
const legacyRequest = { book: "fixture", chapter: 1, part: 0, voice: "ara", lang: "en" };

test("recognized visitor key formats resolve without consulting site credentials", () => {
  const { agent, siteReads } = fixture();
  for (const [prefix, kind] of [
    ["xai-", "xai"],
    ["sk-", "openai"],
    ["sk-ant-", "anthropic"],
  ]) {
    const key = `${prefix}${"reader-fixture-".repeat(3)}`;
    const selected = agent.resolveAgent(` ${key} `);
    assert.equal(selected.kind, kind);
    assert.equal(selected.key, key);
  }
  assert.equal(siteReads(), 0);
});

test("missing, blank and unrecognized keys never fall back to the configured site fixture", () => {
  const { agent, siteReads } = fixture();
  for (const key of rejectedKeys) assert.equal(agent.resolveAgent(key), null);
  assert.equal(siteReads(), 0);
});

test("all five Studio handlers, including video status, reject missing/blank/invalid keys without provider calls", async () => {
  const { studio, calls, siteReads } = fixture();
  for (const key of rejectedKeys) {
    for (const [name, input] of Object.entries(requests)) {
      const result = await studio[name]({ ...input, agentKey: key });
      assert.equal(result.ok, false, name);
      assert.match(result.error, /your own/);
    }
  }
  assert.equal(calls.length, 0);
  assert.equal(siteReads(), 0);
});

test("all five Studio handlers use the recognized visitor xAI key", async () => {
  const { studio, calls, siteReads } = fixture();
  for (const [name, input] of Object.entries(requests)) {
    assert.equal((await studio[name]({ ...input, agentKey: readerKey })).ok, true, name);
  }
  assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.authorization === `Bearer ${readerKey}`));
  assert.equal(siteReads(), 0);
});

test("OpenAI and Claude retain supported Studio operations without cross-provider fallback", async () => {
  for (const [prefix, supported] of [
    ["sk-", ["shapePrompt", "makeImage", "makeAudio"]],
    ["sk-ant-", ["shapePrompt"]],
  ]) {
    const { studio, calls, siteReads } = fixture();
    const key = `${prefix}${"reader-fixture-".repeat(3)}`;
    for (const [name, input] of Object.entries(requests)) {
      assert.equal(
        (await studio[name]({ ...input, agentKey: key })).ok,
        supported.includes(name),
        name,
      );
    }
    assert.equal(calls.length, supported.length);
    assert.ok(
      calls.every((call) => call.authorization === (prefix === "sk-ant-" ? key : `Bearer ${key}`)),
    );
    assert.equal(siteReads(), 0);
  }
});

test("registered legacy audio rejects missing/blank/invalid keys before loading data or calling providers", async () => {
  const { speak, calls, siteReads, bookLoads } = fixture();
  for (const key of rejectedKeys) {
    assert.equal((await speak.speakPart({ ...legacyRequest, agentKey: key })).ok, false);
  }
  assert.equal(bookLoads(), 0);
  assert.equal(calls.length, 0);
  assert.equal(siteReads(), 0);
});

test("legacy generated audio retains visitor xAI/OpenAI generation and authorized cache reuse", async () => {
  for (const prefix of ["xai-", "sk-"]) {
    const { speak, calls, siteReads } = fixture();
    const key = `${prefix}${"reader-fixture-".repeat(3)}`;
    const input = { ...legacyRequest, agentKey: key };
    assert.equal((await speak.speakPart(input)).ok, true);
    assert.equal((await speak.speakPart(input)).ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].authorization, `Bearer ${key}`);
    assert.equal(siteReads(), 0);
  }
});

test("a warm legacy cache cannot bypass the visitor-key requirement", async () => {
  const { speak, calls, siteReads } = fixture();
  assert.equal((await speak.speakPart({ ...legacyRequest, agentKey: readerKey })).ok, true);
  for (const key of [...rejectedKeys, `sk-ant-${"reader-fixture-".repeat(3)}`]) {
    assert.equal((await speak.speakPart({ ...legacyRequest, agentKey: key })).ok, false);
  }
  assert.equal(calls.length, 1);
  assert.equal(siteReads(), 0);
});

test("free browser-reading data helpers need no key or provider call", () => {
  const { speak, calls, siteReads } = fixture();
  const rows = speak.readingLines("fixture", 1, [{ v: 1 }], ["fixture passage"], "en");
  assert.equal(rows.length, 1);
  assert.match(rows[0].text, /fixture passage/);
  assert.equal(calls.length, 0);
  assert.equal(siteReads(), 0);
});

test("Studio renders honest key-required copy and disabled work actions without credentials", () => {
  const { ui, calls, siteReads } = fixture();
  const html = renderToStaticMarkup(
    React.createElement(ui.Studio, { open: true, passage: "fixture passage", onClose() {} }),
  );
  assert.match(html, /Studio requires your own provider key/);
  assert.match(html, /sent through this server to your provider/);
  assert.match(html, /Reading and device Read need no key/);
  assert.doesNotMatch(html, /site agent|key stays on this device/);
  const actions = [...html.matchAll(/<button\b[^>]*>[^<]*<\/button>/g)]
    .map((match) => match[0])
    .filter((button) => /Shape the prompt|Make the still/.test(button));
  assert.equal(actions.length, 2);
  assert.ok(actions.every((button) => button.includes('disabled=""')));
  assert.equal(calls.length, 0);
  assert.equal(siteReads(), 0);
});

test("expired Studio identities are reclaimed when a different caller returns", async () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) {
    f.setCaller(`fixture-caller-${i}`);
    assert.equal(
      (await f.studio.makeImage({ ...requests.makeImage, agentKey: readerKey })).ok,
      true,
    );
  }
  assert.equal(f.maps[0].size, 100);
  f.advance(10 * 60 * 1000 + 1);
  f.setCaller("fresh-fixture-caller");
  assert.equal((await f.studio.makeImage({ ...requests.makeImage, agentKey: readerKey })).ok, true);
  assert.equal(f.maps[0].size, 1);
});

test("parallel image requests retain the existing eight-request per-caller quota", async () => {
  const f = fixture();
  const results = await Promise.all(
    Array.from({ length: 24 }, () =>
      f.studio.makeImage({ ...requests.makeImage, agentKey: readerKey }),
    ),
  );
  assert.equal(results.filter((result) => result.ok).length, 8);
  assert.equal(f.calls.length, 8);
});

test("the existing 24-check video polling sequence remains available with a visitor key", async () => {
  const f = fixture();
  for (let i = 0; i < 24; i++) {
    assert.equal(
      (await f.studio.checkVideo({ ...requests.checkVideo, agentKey: readerKey })).ok,
      true,
    );
  }
  assert.equal(f.calls.length, 24);
});

test("expired legacy generation identities are reclaimed on a later uncached reading", async () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) {
    f.setCaller(`fixture-caller-${i}`);
    assert.equal(
      (await f.speak.speakPart({ ...legacyRequest, book: `fixture${i}`, agentKey: readerKey })).ok,
      true,
    );
  }
  assert.equal(f.maps[2].size, 100);
  f.advance(10 * 60 * 1000 + 1);
  f.setCaller("fresh-fixture-caller");
  assert.equal(
    (await f.speak.speakPart({ ...legacyRequest, book: "freshfixture", agentKey: readerKey })).ok,
    true,
  );
  assert.equal(f.maps[2].size, 1);
});

test("existing Studio action quotas remain 30/8/3/12 per caller and window", async () => {
  const f = fixture();
  for (const [name, quota] of [
    ["shapePrompt", 30],
    ["makeImage", 8],
    ["startVideo", 3],
    ["makeAudio", 12],
  ]) {
    const before = f.calls.length;
    for (let i = 0; i <= quota; i++) {
      assert.equal(
        (await f.studio[name]({ ...requests[name], agentKey: readerKey })).ok,
        i < quota,
        name,
      );
    }
    assert.equal(f.calls.length - before, quota, name);
  }
});

test("parallel uncached legacy requests retain the existing eighty-request quota", async () => {
  const f = fixture();
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      f.speak.speakPart({ ...legacyRequest, book: `parallelfixture${i}`, agentKey: readerKey }),
    ),
  );
  assert.equal(results.filter((result) => result.ok).length, 80);
  assert.equal(f.calls.length, 80);
});

async function flushWork() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

test("a stalled image fetch settles with a sanitized deadline error and no retry", async () => {
  const f = fixture({ provider: () => new Promise(() => {}) });
  let result;
  void f.studio.makeImage({ ...requests.makeImage, agentKey: readerKey }).then((value) => {
    result = value;
  });
  await flushWork();
  assert.equal(f.calls.length, 1);
  f.advance(240000);
  await flushWork();
  assert.equal(result?.ok, false, "stalled fetch must not leave the handler pending");
  assert.match(result.error, /time|deadline/i);
  assert.equal(f.calls[0].signal.aborted, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.pendingTimers(), 0);
});

test("a rejected video status fetch returns a sanitized result instead of throwing", async () => {
  const f = fixture({ provider: () => Promise.reject(new Error(`fixture secret ${readerKey}`)) });
  const result = await f.studio.checkVideo({ ...requests.checkVideo, agentKey: readerKey });
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.error, /fixture secret|reader-fixture/);
});

const stalledCases = [
  { name: "shapePrompt", key: `sk-${"reader-fixture-".repeat(3)}`, input: requests.shapePrompt },
  {
    name: "shapePrompt",
    key: `sk-ant-${"reader-fixture-".repeat(3)}`,
    input: requests.shapePrompt,
  },
  { name: "makeImage", key: `sk-${"reader-fixture-".repeat(3)}`, input: requests.makeImage },
  ...Object.keys(requests).map((name) => ({ name, key: readerKey, input: requests[name] })),
  { name: "makeAudio", key: `sk-${"reader-fixture-".repeat(3)}`, input: requests.makeAudio },
  { name: "speakPart", key: readerKey, input: legacyRequest },
  { name: "speakPart", key: `sk-${"reader-fixture-".repeat(3)}`, input: legacyRequest },
];

test("every active provider boundary and registered legacy provider bounds stalled headers and bodies", async () => {
  for (const entry of stalledCases) {
    for (const stage of ["fetch", "body"]) {
      const pending = () => new Promise(() => {});
      const f = fixture({
        provider:
          stage === "fetch" ? pending : () => ({ ok: true, json: pending, arrayBuffer: pending }),
      });
      const handler = entry.name === "speakPart" ? f.speak.speakPart : f.studio[entry.name];
      let result;
      void handler({ ...entry.input, agentKey: entry.key }).then((value) => {
        result = value;
      });
      await flushWork();
      assert.equal(f.calls.length, 1, `${entry.name}/${stage}`);
      const deadline = entry.name === "checkVideo" ? 15000 : 240000;
      f.advance(deadline - 1);
      await flushWork();
      assert.equal(result, undefined, "no early deadline");
      f.advance(1);
      await flushWork();
      assert.equal(result?.ok, false, `${entry.name}/${stage} must settle`);
      assert.match(result.error, /timed out/);
      assert.equal(f.calls[0].signal.aborted, true);
      assert.equal(f.calls.length, 1, "no timeout retries");
      assert.equal(f.pendingTimers(), 0);
      assert.equal(f.siteReads(), 0);
    }
  }
});

test("aborted visitors make no provider requests and in-flight cancellation settles without retry", async () => {
  for (const entry of stalledCases) {
    for (const alreadyAborted of [true, false]) {
      const controller = new AbortController();
      if (alreadyAborted) controller.abort();
      const f = fixture({ signal: controller.signal, provider: () => new Promise(() => {}) });
      const handler = entry.name === "speakPart" ? f.speak.speakPart : f.studio[entry.name];
      const pending = handler({ ...entry.input, agentKey: entry.key });
      await flushWork();
      if (!alreadyAborted) controller.abort();
      const result = await pending;
      assert.equal(result.ok, false);
      assert.match(result.error, /cancelled/);
      assert.equal(f.calls.length, alreadyAborted ? 0 : 1);
      if (f.calls.length) assert.equal(f.calls[0].signal.aborted, true);
      assert.equal(f.pendingTimers(), 0);
    }
  }
});

test("provider network and invalid-body failures are sanitized across all media handlers", async () => {
  for (const entry of stalledCases) {
    for (const stage of ["fetch", "body"]) {
      const fail = () => Promise.reject(new Error(`fixture private ${entry.key}`));
      const f = fixture({
        provider: stage === "fetch" ? fail : () => ({ ok: true, json: fail, arrayBuffer: fail }),
      });
      const handler = entry.name === "speakPart" ? f.speak.speakPart : f.studio[entry.name];
      const result = await handler({ ...entry.input, agentKey: entry.key });
      assert.equal(result.ok, false);
      assert.doesNotMatch(result.error, /fixture private|reader-fixture/);
      assert.equal(f.calls.length, 1);
      assert.equal(f.pendingTimers(), 0);
    }
  }
});

test("translated audio shares one budget and cannot initiate speech after a late translation", async () => {
  let release;
  const f = fixture({
    provider: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const pending = f.studio.makeAudio({
    ...requests.makeAudio,
    language: "Spanish",
    agentKey: readerKey,
  });
  await flushWork();
  assert.match(f.calls[0].url, /chat\/completions/);
  f.advance(240000);
  assert.equal((await pending).ok, false);
  release(Response.json({ choices: [{ message: { content: "synthetic test output" } }] }));
  await flushWork();
  assert.equal(f.calls.length, 1, "late translation must not start a paid audio operation");
});

test("late legacy speech cannot populate the cache after its handler timed out", async () => {
  let release;
  const f = fixture({
    provider: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const pending = f.speak.speakPart({ ...legacyRequest, agentKey: readerKey });
  await flushWork();
  f.advance(240000);
  assert.equal((await pending).ok, false);
  release(
    Response.json({
      audio: "Zml4dHVyZQ==",
      audio_timestamps: { graph_chars: [], graph_times: [[0, 1]] },
    }),
  );
  await flushWork();
  assert.equal(f.maps[1].size, 0, "late audio must not be cached");
  assert.equal(f.calls.length, 1);
});

test("existing legacy transient-status retry remains inside the shared deadline", async () => {
  let count = 0;
  const f = fixture({
    provider: () =>
      ++count === 1
        ? new Response(null, { status: 503 })
        : Response.json({
            audio: "Zml4dHVyZQ==",
            audio_timestamps: { graph_chars: [], graph_times: [[0, 1]] },
          }),
  });
  const pending = f.speak.speakPart({ ...legacyRequest, agentKey: readerKey });
  await flushWork();
  f.advance(600);
  assert.equal((await pending).ok, true);
  assert.equal(f.calls.length, 2, "preserve existing one transient-status retry only");
  assert.equal(f.pendingTimers(), 0);
});

test("success and existing HTTP failures release request timers without altering results", async () => {
  const success = fixture();
  for (const [name, input] of Object.entries(requests)) {
    assert.equal((await success.studio[name]({ ...input, agentKey: readerKey })).ok, true);
    assert.equal(success.pendingTimers(), 0);
  }
  const failure = fixture({ provider: () => new Response(null, { status: 401 }) });
  const result = await failure.studio.makeImage({ ...requests.makeImage, agentKey: readerKey });
  assert.equal(result.ok, false);
  assert.equal(result.error, "The image could not be made. Try a shorter prompt.");
  assert.equal(failure.pendingTimers(), 0);
  assert.equal(failure.calls[0].signal.aborted, true);
});

test("a different visitor credential cannot reuse another credential's warm legacy cache", async () => {
  const f = fixture({
    provider: (url, init) =>
      init.headers.Authorization === `Bearer ${readerKey}`
        ? Response.json({
            audio: "owner-a-audio",
            audio_timestamps: { graph_chars: [], graph_times: [[0, 1]] },
          })
        : new Response(null, { status: 401 }),
  });
  assert.equal((await f.speak.speakPart({ ...legacyRequest, agentKey: readerKey })).ok, true);
  const other = `xai-${"other-fixture-".repeat(3)}`;
  const result = await f.speak.speakPart({ ...legacyRequest, agentKey: other });
  assert.equal(
    result.ok,
    false,
    "unverified different credential must not receive owner A's cached audio",
  );
  assert.equal(f.calls.length, 2);
  assert.equal(f.siteReads(), 0);
});

test("one credential cannot seed a different credential's cached generated reading", async () => {
  const other = `xai-${"other-fixture-".repeat(3)}`;
  for (const [first, second] of [
    [readerKey, other],
    [other, readerKey],
  ]) {
    const f = fixture({
      provider: (url, init) =>
        Response.json({
          audio:
            init.headers.Authorization === `Bearer ${readerKey}`
              ? "owner-a-audio"
              : "owner-b-audio",
          audio_timestamps: { graph_chars: [], graph_times: [[0, 1]] },
        }),
    });
    const a = await f.speak.speakPart({ ...legacyRequest, agentKey: first });
    const b = await f.speak.speakPart({ ...legacyRequest, agentKey: second });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.notEqual(a.audio, b.audio, "each credential must get its own provider result");
    assert.equal(f.calls.length, 2);
    assert.equal((await f.speak.speakPart({ ...legacyRequest, agentKey: first })).audio, a.audio);
    assert.equal(f.calls.length, 2, "same credential still reuses its own result");
  }
});

test("legacy cache separates providers but normalizes whitespace for the same credential", async () => {
  const f = fixture();
  const xai = await f.speak.speakPart({ ...legacyRequest, agentKey: readerKey });
  assert.equal(xai.ok, true);
  const again = await f.speak.speakPart({ ...legacyRequest, agentKey: `  ${readerKey}  ` });
  assert.equal(again.audio, xai.audio);
  assert.equal(f.calls.length, 1);
  const openai = await f.speak.speakPart({
    ...legacyRequest,
    agentKey: `sk-${"reader-fixture-".repeat(3)}`,
  });
  assert.equal(openai.ok, true);
  assert.notEqual(openai.audio, xai.audio);
  assert.equal(f.calls.length, 2);
  const keys = [...f.maps[1].keys()];
  for (const key of keys) {
    const tuple = JSON.parse(key);
    assert.match(tuple[0], /^[0-9a-f]{64}$/);
    assert.equal(tuple[1], "fixture");
    assert.doesNotMatch(key, /reader-fixture|xai-|sk-/);
    assert.ok(!key.includes(Buffer.from(readerKey).toString("base64")));
  }
  assert.doesNotMatch(JSON.stringify([xai, openai]), new RegExp(JSON.parse(keys[0])[0]));
});

test("cache scoping failure fails closed without provider, book or site-credential access", async () => {
  const f = fixture({
    cacheCrypto: {
      subtle: {
        generateKey() {
          throw new Error("private synthetic failure");
        },
      },
    },
  });
  const result = await f.speak.speakPart({ ...legacyRequest, agentKey: readerKey });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Generated audio could not be prepared. Try again later.");
  assert.equal(f.calls.length, 0);
  assert.equal(f.bookLoads(), 0);
  assert.equal(f.siteReads(), 0);
});

test("scoped legacy cache keeps the existing ten-entry bound and reference dimensions", async () => {
  const f = fixture();
  for (let i = 0; i < 12; i++) {
    assert.equal(
      (await f.speak.speakPart({ ...legacyRequest, book: `cachefixture${i}`, agentKey: readerKey }))
        .ok,
      true,
    );
  }
  assert.equal(f.maps[1].size, 10);
  assert.ok(![...f.maps[1].keys()].some((key) => JSON.parse(key)[1] === "cachefixture0"));
  const before = f.calls.length;
  assert.equal(
    (await f.speak.speakPart({ ...legacyRequest, book: "cachefixture11", agentKey: readerKey })).ok,
    true,
  );
  assert.equal(f.calls.length, before);
});
