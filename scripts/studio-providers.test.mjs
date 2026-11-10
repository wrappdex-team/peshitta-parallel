import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
      fileName: path,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports },
  );
  return exports;
}

const agent = load("src/lib/agent.ts");
const models = load("src/lib/studio-models.ts");

test("new free-key prefixes do not steal xAI, OpenAI or Claude", () => {
  const openrouter = `sk-or-v1-${"a".repeat(24)}`;
  const groq = `gsk_${"a".repeat(32)}`;
  const gemini = `AIza${"a".repeat(32)}`;
  const account = "a".repeat(32);
  const token = "b".repeat(40);
  const cloudflare = `cf-${account}-${token}`;
  assert.equal(agent.detectAgent(openrouter).kind, "openrouter");
  assert.equal(agent.detectAgent(groq).kind, "groq");
  assert.equal(agent.detectAgent(gemini).kind, "gemini");
  const cf = agent.detectAgent(cloudflare);
  assert.equal(cf.kind, "cloudflare");
  assert.equal(cf.accountId, account);
  assert.equal(cf.key, token);
  assert.equal(agent.detectAgent(`sk-${"reader-fixture-".repeat(3)}`).kind, "openai");
  assert.equal(agent.detectAgent(`sk-ant-${"reader-fixture-".repeat(3)}`).kind, "anthropic");
  assert.equal(agent.detectAgent("unrecognized-provider-fixture-key"), null);
  assert.equal(agent.detectAgent(`cf-${account}-short`), null);
  assert.equal(agent.resolveAgent(` ${openrouter} `).key, openrouter);
});

test("realistic free keys are recognized, including new Gemini and Cloudflare shapes", () => {
  const openrouter = `sk-or-v1-${"ab".repeat(32)}`;
  const groq = `gsk_${"a".repeat(52)}`;
  const legacyGemini = `AIzaSy${"b".repeat(33)}`;
  const gemini = `AQ.Ab${"c".repeat(48)}`;
  const account = "a".repeat(32);
  const token = `cfut_${"d".repeat(48)}`;
  assert.equal(agent.detectAgent(openrouter).kind, "openrouter");
  assert.equal(agent.detectAgent(`Bearer ${openrouter}`).key, openrouter);
  assert.equal(agent.detectAgent(`"${groq}"`).kind, "groq");
  assert.equal(agent.detectAgent(legacyGemini).kind, "gemini");
  assert.equal(agent.detectAgent(gemini).kind, "gemini");
  assert.equal(agent.detectAgent(`sk-or-v1-${"a".repeat(20)}.${"b".repeat(20)}`).kind, "openrouter");
  assert.equal(agent.detectAgent(token), null);
  assert.equal(agent.cloudflareHint(token), "token");
  assert.equal(agent.cloudflareHint(`cfk_${"e".repeat(48)}`), "global");
  const saved = agent.normalizeProviderKey(token, account);
  const cf = agent.detectAgent(saved);
  assert.equal(cf.kind, "cloudflare");
  assert.equal(cf.accountId, account);
  assert.equal(cf.key, token);
  assert.equal(agent.detectAgent(`${account}\n${token}`).key, token);
  assert.equal(agent.detectAgent(`cf-${account}-short`), null);
  assert.equal(agent.detectAgent(`xai-${"x".repeat(301)}`), null);
  assert.equal(agent.detectAgent("not-a-provider-key"), null);
});

test("model ids outside the catalog cannot be selected", () => {
  assert.equal(models.resolveModel("xai", "image", "grok-imagine-image"), "grok-imagine-image");
  assert.equal(models.resolveModel("xai", "image", "https://evil.example/model"), "grok-imagine-image-2.0");
  assert.equal(models.resolveModel("openrouter", "image", "openrouter/free"), null);
  assert.equal(models.resolveModel("openrouter", "shape", "openai/gpt-4o"), "openrouter/free");
  assert.equal(models.supportsTask("cloudflare", "image"), true);
  assert.equal(models.supportsTask("groq", "video"), false);
  assert.equal(models.supportsTask("xai", "audio"), true);
});

test("synthetic AQ., gsk_, sk-or-v1- and cfut_ plus account id keys are recognized; cfk_ and bare tokens are not saved", () => {
  const account = "0123456789abcdef0123456789abcdef";
  assert.equal(agent.detectAgent(`AQ.Ab${"c".repeat(48)}`).kind, "gemini");
  assert.equal(agent.detectAgent(`gsk_${"a".repeat(52)}`).kind, "groq");
  assert.equal(agent.detectAgent(`sk-or-v1-${"ab".repeat(32)}`).kind, "openrouter");
  const cf = agent.detectAgent(agent.normalizeProviderKey(`cfat_${"d".repeat(40)}`, account));
  assert.equal(cf.kind, "cloudflare");
  assert.equal(cf.accountId, account);
  assert.equal(agent.detectAgent(`cfut_${"d".repeat(40)}`), null);
  assert.equal(agent.detectAgent(agent.normalizeProviderKey(`cfk_${"d".repeat(40)}`, account)), null);
  assert.equal(agent.detectAgent(`AQ.${"x".repeat(10)}`), null, "length floor stays 20");
});

test("only providers with an image API light the still button", () => {
  for (const kind of ["cloudflare", "openai", "xai"]) assert.equal(models.supportsTask(kind, "image"), true, kind);
  for (const kind of ["groq", "openrouter", "gemini", "anthropic"]) {
    assert.equal(models.supportsTask(kind, "image"), false, kind);
    assert.match(models.blockLine(kind, "image"), /cannot make the still\. For a free still, save a Cloudflare/);
  }
  assert.equal(models.blockLine("cloudflare", "image"), "");
  assert.equal(models.supportsTask("cloudflare", "video"), false, "film stays xAI-only");
  assert.equal(models.supportsTask("groq", "audio"), false, "voice stays xAI or OpenAI");
});

test("shaped status never promises a still a text-only key cannot make", () => {
  assert.equal(
    models.shapedLine("groq", "image"),
    "The prompt is ready. This Groq key shapes prompts only and cannot make the still. For a free still, save a Cloudflare Workers AI token (cfut_ or cfat_) with its account id. An xAI or OpenAI key also works.",
  );
  assert.equal(models.shapedLine("cloudflare", "image"), "The prompt is ready. You can change it before making the still.");
  assert.doesNotMatch(models.shapedLine("openrouter", "image"), /You can change/);
});

test("free shaping defaults are ids the providers listed on 9 Nov 2026, and unknown ids fall back to them", () => {
  assert.equal(models.resolveModel("groq", "shape", "llama-3.3-70b-versatile"), "openai/gpt-oss-20b");
  assert.equal(models.resolveModel("gemini", "shape", "gemini-99-flash"), "gemini-3.5-flash-lite");
  assert.equal(models.resolveModel("cloudflare", "shape", "@cf/unknown"), "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.equal(models.resolveModel("cloudflare", "image", "@cf/unknown"), "@cf/black-forest-labs/flux-1-schnell");
  assert.equal(
    JSON.stringify(models.modelsFor("openrouter", "shape").map((model) => model.id)),
    JSON.stringify(["openrouter/free", "google/gemma-4-31b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free"]),
  );
  assert.equal(JSON.stringify(models.availableModels("groq", "shape", ["openai/gpt-oss-120b"]).map((m) => m.id)), JSON.stringify(["openai/gpt-oss-120b"]));
  assert.equal(models.availableModels("groq", "shape", ["unrelated"]).length, 2, "an unhelpful list keeps the catalog");
});
