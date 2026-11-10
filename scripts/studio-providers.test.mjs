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
