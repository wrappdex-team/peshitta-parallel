import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const siteKey = `xai-${"site-fixture-".repeat(3)}`;
const readerKey = `xai-${"reader-fixture-".repeat(3)}`;
const read = (name) => readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
const compiled = Object.fromEntries(
  ["agent", "studio"].map((name) => [
    name,
    ts.transpileModule(read(name), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  ]),
);

function load(name, globals) {
  const exports = {};
  runInNewContext(
    compiled[name],
    { exports, ...globals },
    { filename: `${name}.ts`, timeout: 1000 },
  );
  return exports;
}

function fixture(configuredKey = siteKey) {
  let siteReads = 0;
  const calls = [];
  const agent = load("agent", {
    process: {
      env: new Proxy(
        { XAI_API_KEY: configuredKey },
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
  const studio = load("studio", {
    Buffer,
    require(name) {
      if (name === "@/lib/agent") return agent;
      if (name === "@tanstack/react-start/server")
        return {
          getRequest: () =>
            new Request("https://fixture.invalid/", {
              headers: { "x-forwarded-for": "192.0.2.1" },
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
      calls.push({ url, authorization: init.headers.Authorization });
      if (url.endsWith("/chat/completions"))
        return Response.json({ choices: [{ message: { content: "fixture prompt" } }] });
      if (url.endsWith("/images/generations"))
        return Response.json({ data: [{ b64_json: "Zml4dHVyZQ==" }] });
      if (url.endsWith("/videos/generations")) return Response.json({ request_id: "fixture-job" });
      if (url.endsWith("/videos/fixture-job"))
        return Response.json({ status: "done", video: { url: "https://fixture.invalid/video" } });
      if (url.endsWith("/tts")) return Response.json({ audio: "Zml4dHVyZQ==" });
      throw new Error(`Unexpected mocked provider URL: ${url}`);
    },
  });
  return { agent, studio, calls, siteReads: () => siteReads };
}

const requests = {
  shapePrompt: { text: "fixture passage", style: "", kind: "image" },
  makeImage: { prompt: "fixture prompt" },
  startVideo: { prompt: "fixture prompt" },
  checkVideo: { requestId: "fixture-job" },
  makeAudio: { text: "fixture passage", voice: "ara", language: "English" },
};

test("recognized reader keys take precedence without reading the site's key", () => {
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

test("unrecognized explicit keys fail closed instead of falling back to site funding", () => {
  const { agent, siteReads } = fixture();
  for (const key of ["unrecognized-provider-fixture-key", "xai-short", `xai-${"x".repeat(301)}`]) {
    assert.equal(agent.resolveAgent(key), null);
  }
  assert.equal(siteReads(), 0);
});

test("omitted or blank keys preserve the existing optional site-funded behavior", () => {
  for (const key of [undefined, "", "   "]) {
    const { agent } = fixture();
    assert.equal(agent.resolveAgent(key).key, siteKey);
  }
  for (const configured of ["", "invalid", `sk-${"fixture-".repeat(4)}`]) {
    assert.equal(fixture(configured).agent.resolveAgent(), null);
  }
});

test("all five active studio handlers reject explicit unrecognized keys before provider calls", async () => {
  for (const key of [
    "unrecognized-provider-fixture-key",
    "xai-short",
    `xai-${"x".repeat(301)}`,
    { invalid: true },
  ]) {
    const { studio, calls, siteReads } = fixture();
    for (const [name, input] of Object.entries(requests)) {
      const result = await studio[name]({ ...input, agentKey: key });
      assert.equal(result.ok, false, name);
    }
    assert.equal(calls.length, 0);
    assert.equal(siteReads(), 0);
  }
});

test("all five active studio handlers retain optional site funding with mocked providers only", async () => {
  const { studio, calls } = fixture();
  for (const [name, input] of Object.entries(requests)) {
    assert.equal((await studio[name](input)).ok, true, name);
  }
  assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.authorization === `Bearer ${siteKey}`));
});

test("active studio generation uses the recognized reader key rather than the site's key", async () => {
  const { studio, calls, siteReads } = fixture();
  for (const [name, input] of Object.entries(requests)) {
    assert.equal((await studio[name]({ ...input, agentKey: readerKey })).ok, true, name);
  }
  assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.authorization === `Bearer ${readerKey}`));
  assert.equal(siteReads(), 0);
});
