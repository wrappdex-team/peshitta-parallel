import assert from "node:assert/strict";
import { test } from "node:test";
import { makeShot } from "./adapters/film.ts";

globalThis.URL.createObjectURL = (blob: Blob) => `blob:test/${blob.type}/${blob.size}`;
type Seen = { url: string; init: RequestInit };
function mock(reply: (url: string, n: number) => Response) {
  const seen: Seen[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    seen.push({ url, init });
    return reply(url, seen.length);
  }) as unknown as typeof fetch;
  return { seen, fetcher };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const ask = { prompt: "A Byzantine mosaic shot of Matthew 5:3", seconds: 8, aspect: "16:9" as const };
const fast = { every: 1, tries: 5 };

test("Gemini Omni: Interactions API with a video response format, polled until completed", async () => {
  const { seen, fetcher } = mock((url, n) => (n === 1 ? json({ id: "int-1", status: "in_progress" }) : json({ id: "int-1", status: "completed", steps: [{ content: [{ type: "text" }, { type: "video", data: "QUJD", mime_type: "video/mp4" }] }] })));
  const out = await makeShot({ ...ask, id: "google", key: "AIzaTest", model: "gemini-omni-1.2-flash" }, fetcher, fast);
  assert.deepEqual(out, { ok: true, src: "blob:test/video/mp4/3", mime: "video/mp4" });
  assert.equal(seen[0].url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.deepEqual(JSON.parse(String(seen[0].init.body)), { model: "gemini-omni-1.2-flash", input: ask.prompt, response_format: { type: "video", aspect_ratio: "16:9", resolution: "720p", duration: "8s" } });
  assert.equal(seen[1].url, "https://generativelanguage.googleapis.com/v1beta/interactions/int-1");
  assert.ok(seen.every((call) => (call.init.headers as Record<string, string>)["x-goog-api-key"] === "AIzaTest"));
});

test("Gemini Omni safety failures become one calm line", async () => {
  const { fetcher } = mock(() => json({ id: "int-2", status: "failed", error: { message: "Blocked by safety policy" } }));
  const out = await makeShot({ ...ask, id: "google", key: "AIzaTest", model: "gemini-omni-1.2-flash" }, fetcher, fast);
  assert.equal(!out.ok && out.safety, true);
});

test("Grok Imagine Video: submit, poll /v1/videos/{id} until done, return the video URL", async () => {
  const { seen, fetcher } = mock((url, n) => (n === 1 ? json({ request_id: "req-9" }) : n === 2 ? json({ status: "pending" }) : json({ status: "done", video: { url: "https://vidgen.x.ai/v.mp4", respect_moderation: true } })));
  const out = await makeShot({ ...ask, id: "xai", key: "xai-test", model: "grok-imagine-video-1.5" }, fetcher, fast);
  assert.equal(out.ok && out.src, "https://vidgen.x.ai/v.mp4");
  assert.equal(seen[0].url, "https://api.x.ai/v1/videos/generations");
  assert.equal(JSON.parse(String(seen[0].init.body)).duration, 8);
  assert.equal(seen[2].url, "https://api.x.ai/v1/videos/req-9");
});

test("fal Kling: queue flow with a 5 or 10 second clip", async () => {
  const { seen, fetcher } = mock((url) => {
    if (url.endsWith("text-to-video")) return json({ status_url: "https://queue.fal.run/x/requests/1/status", response_url: "https://queue.fal.run/x/requests/1" });
    if (url.endsWith("/status")) return json({ status: "COMPLETED" });
    return json({ video: { url: "https://v3.fal.media/files/shot.mp4" } });
  });
  const out = await makeShot({ ...ask, id: "fal", key: "id:secret", model: "fal-ai/kling-video/v3/pro/text-to-video" }, fetcher, fast);
  assert.equal(out.ok && out.src, "https://v3.fal.media/files/shot.mp4");
  assert.equal(JSON.parse(String(seen[0].init.body)).duration, "5");
});

test("a shot that never finishes says so (it may still bill)", async () => {
  const { fetcher } = mock((url, n) => (n === 1 ? json({ request_id: "req-1" }) : json({ status: "pending" })));
  const out = await makeShot({ ...ask, id: "xai", key: "xai-test", model: "grok-imagine-video-1.5" }, fetcher, fast);
  assert.equal(out.ok, false);
  assert.match(!out.ok ? out.error : "", /may finish and bill later/);
});
