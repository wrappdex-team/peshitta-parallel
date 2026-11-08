import assert from "node:assert/strict";
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
  studio: "src/lib/studio.ts",
  speak: "src/lib/speak.ts",
  studioUI: "src/components/studio.tsx",
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

function fixture() {
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
  const globals = {
    Buffer,
    Map: TrackedMap,
    Date: { now: () => time },
    require(name) {
      if (name === "@/lib/agent") return agent;
      if (name === "@/lib/local-rate-limit") return rateLimit;
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
      calls.push({ url, authorization: init.headers.Authorization ?? init.headers["x-api-key"] });
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
  const ui = load("studioUI", {
    require(name) {
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "@/lib/agent") return agent;
      if (name === "@/lib/local-rate-limit") return rateLimit;
      if (name === "@/lib/studio") return studio;
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
    advance: (ms) => {
      time += ms;
    },
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
