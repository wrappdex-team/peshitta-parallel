import assert from "node:assert/strict";
import { test } from "node:test";
import { makeStill } from "./adapters/still.ts";

type Seen = { url: string; init: RequestInit };
function mock(reply: (url: string) => unknown, status = 200) {
  const seen: Seen[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(reply(url)), { status });
  }) as unknown as typeof fetch;
  return { seen, fetcher };
}
const base = { prompt: "A gold mosaic of Matthew 5:3", aspect: "16:9" as const, count: 2 };

test("OpenAI stills: GPT Image endpoint, bearer key, size from aspect, base64 back", async () => {
  const { seen, fetcher } = mock(() => ({ data: [{ b64_json: "AAA" }, { b64_json: "BBB" }] }));
  const out = await makeStill({ ...base, id: "openai", key: "sk-test", model: "gpt-image-2.6-flare" }, fetcher);
  assert.equal(out.ok && out.images.length, 2);
  assert.equal(out.ok && out.images[0].src, "data:image/png;base64,AAA");
  assert.equal(seen[0].url, "https://api.openai.com/v1/images/generations");
  assert.deepEqual(JSON.parse(String(seen[0].init.body)), { model: "gpt-image-2.6-flare", prompt: base.prompt, n: 2, size: "1536x1024", output_format: "png" });
});

test("xAI stills ask for b64_json and pass the aspect ratio", async () => {
  const { seen, fetcher } = mock(() => ({ data: [{ b64_json: "X" }] }));
  await makeStill({ ...base, id: "xai", key: "xai-test", model: "grok-imagine-image-2.0" }, fetcher);
  assert.equal(seen[0].url, "https://api.x.ai/v1/images/generations");
  const body = JSON.parse(String(seen[0].init.body));
  assert.equal(body.response_format, "b64_json");
  assert.equal(body.aspect_ratio, "16:9");
});

test("Gemini stills make one call per variation and read inlineData", async () => {
  const { seen, fetcher } = mock(() => ({ candidates: [{ content: { parts: [{ text: "here" }, { inlineData: { mimeType: "image/png", data: "G" } }] } }] }));
  const out = await makeStill({ ...base, id: "google", key: "AQ.test", model: "gemini-nano-banana-2.1" }, fetcher);
  assert.equal(seen.length, 2);
  assert.equal(out.ok && out.images[1].src, "data:image/png;base64,G");
  assert.equal((seen[0].init.headers as Record<string, string>)["x-goog-api-key"], "AQ.test");
});

test("fal uses the Key scheme, preset sizes, seed and its safety checker; NSFW flag reads as a safety stop", async () => {
  const { seen, fetcher } = mock(() => ({ images: [{ url: "https://v3.fal.media/files/a.png" }], has_nsfw_concepts: [false] }));
  const out = await makeStill({ ...base, id: "fal", key: "id:secret", model: "fal-ai/flux-2", seed: 7 }, fetcher);
  assert.equal(out.ok && out.images[0].src, "https://v3.fal.media/files/a.png");
  assert.equal(seen[0].url, "https://fal.run/fal-ai/flux-2");
  assert.equal((seen[0].init.headers as Record<string, string>).Authorization, "Key id:secret");
  assert.deepEqual(JSON.parse(String(seen[0].init.body)), { prompt: base.prompt, image_size: "landscape_16_9", num_images: 2, seed: 7, enable_safety_checker: true });
  const flagged = mock(() => ({ images: [{ url: "https://v3.fal.media/x.png" }], has_nsfw_concepts: [true] }));
  const stop = await makeStill({ ...base, id: "fal", key: "id:secret", model: "fal-ai/flux-2" }, flagged.fetcher);
  assert.equal(stop.ok === false && stop.safety, true);
});

test("Stability posts multipart to ultra or core and maps CONTENT_FILTERED to a safety stop", async () => {
  const { seen, fetcher } = mock(() => ({ image: "S", finish_reason: "SUCCESS" }));
  const out = await makeStill({ ...base, id: "stability", key: "sk-stab", model: "core", count: 1 }, fetcher);
  assert.equal(out.ok && out.images[0].src, "data:image/png;base64,S");
  assert.equal(seen[0].url, "https://api.stability.ai/v2beta/stable-image/generate/core");
  assert.ok(seen[0].init.body instanceof FormData);
  const filtered = mock(() => ({ image: "S", finish_reason: "CONTENT_FILTERED" }));
  const stop = await makeStill({ ...base, id: "stability", key: "sk-stab", model: "ultra" }, filtered.fetcher);
  assert.equal(stop.ok === false && stop.safety, true);
});

test("failures never echo the key; providers without stills refuse without a request", async () => {
  const { fetcher } = mock(() => ({ error: { message: "Invalid key sk-proj-secretsecretsecret" } }), 401);
  const out = await makeStill({ ...base, id: "openai", key: "sk-proj-secretsecretsecret", model: "gpt-image-2.6-flare" }, fetcher);
  assert.equal(out.ok, false);
  assert.ok(out.ok === false && !out.error.includes("secretsecret"));
  const none = mock(() => ({}));
  const refused = await makeStill({ ...base, id: "anthropic", key: "sk-ant-x", model: "x" }, none.fetcher);
  assert.equal(refused.ok, false);
  assert.equal(none.seen.length, 0);
});
