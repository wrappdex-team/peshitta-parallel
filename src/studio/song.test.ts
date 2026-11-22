import assert from "node:assert/strict";
import { test } from "node:test";
import { falQueue } from "./adapters/fal.ts";
import { makeSong } from "./adapters/song.ts";

type Seen = { url: string; init: RequestInit };
function mock(reply: (url: string) => Response) {
  const seen: Seen[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    seen.push({ url, init });
    return reply(url);
  }) as unknown as typeof fetch;
  return { seen, fetcher };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const ask = { prompt: "Byzantine chant, solemn", lyrics: "[Verse]\nBlessed are the poor in spirit", seconds: 60, instrumental: false };

globalThis.URL.createObjectURL = (blob: Blob) => `blob:test/${blob.type}/${blob.size}`;

test("Lyria songs go to generateContent with the reader's key and come back as inline audio", async () => {
  const { seen, fetcher } = mock(() => json({ candidates: [{ content: { parts: [{ text: "ok" }, { inlineData: { mimeType: "audio/mpeg", data: "QUJD" } }] } }] }));
  const out = await makeSong({ ...ask, id: "google", key: "AIzaTest", model: "lyria-3.5" }, fetcher);
  assert.deepEqual(out, { ok: true, src: "blob:test/audio/mpeg/3", mime: "audio/mpeg" }, "a blob URL, because media-src has no data:");
  assert.equal(seen[0].url, "https://generativelanguage.googleapis.com/v1beta/models/lyria-3.5:generateContent");
  assert.equal((seen[0].init.headers as Record<string, string>)["x-goog-api-key"], "AIzaTest");
  assert.match(String(seen[0].init.body), /Blessed are the poor in spirit/);
});

test("Lyria safety blocks become a calm message", async () => {
  const { fetcher } = mock(() => json({ promptFeedback: { blockReason: "SAFETY" } }));
  const out = await makeSong({ ...ask, id: "google", key: "AIzaTest", model: "lyria-3.5" }, fetcher);
  assert.equal(out.ok, false);
  assert.equal(!out.ok && out.safety, true);
});

test("Instrumental ElevenLabs songs drop the lyrics and clamp the length", async () => {
  const { seen, fetcher } = mock(() => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" })));
  const out = await makeSong({ ...ask, id: "elevenlabs", key: "sk_test", model: "music_v2_5", seconds: 1, instrumental: true }, fetcher);
  assert.equal(out.ok, true);
  const body = JSON.parse(String(seen[0].init.body));
  assert.equal(body.music_length_ms, 3000);
  assert.equal(body.force_instrumental, true);
  assert.doesNotMatch(body.prompt, /Blessed/);
});

test("fal queue: submit, poll until COMPLETED, read the result; Key auth throughout", { timeout: 20000 }, async () => {
  let polls = 0;
  const { seen, fetcher } = mock((url) => {
    if (url === "https://queue.fal.run/fal-ai/minimax-music") return json({ status_url: "https://queue.fal.run/fal-ai/minimax-music/requests/1/status", response_url: "https://queue.fal.run/fal-ai/minimax-music/requests/1" });
    if (url.endsWith("/status")) return json({ status: ++polls < 2 ? "IN_PROGRESS" : "COMPLETED" });
    return json({ audio: { url: "https://v3.fal.media/files/song.mp3" } });
  });
  const out = await makeSong({ ...ask, id: "fal", key: "id:secret", model: "fal-ai/minimax-music" }, fetcher, undefined, undefined);
  assert.equal(out.ok, true);
  assert.equal(out.ok && out.src, "https://v3.fal.media/files/song.mp3");
  assert.ok(seen.every((call) => (call.init.headers as Record<string, string>).Authorization === "Key id:secret"));
  assert.equal(JSON.parse(String(seen[0].init.body)).lyrics, ask.lyrics);
});

test("fal queue refuses job URLs that point off queue.fal.run", async () => {
  const { seen, fetcher } = mock(() => json({ status_url: "https://evil.example/status", response_url: "https://evil.example/r" }));
  const out = await falQueue("m", "id:secret", {}, fetcher, undefined, { every: 1 });
  assert.equal(out.ok, false);
  assert.equal(seen.length, 1, "the key is never sent to another host");
});

test("OpenAI recitation sends plain scripture (no section tags) to TTS", async () => {
  const { seen, fetcher } = mock(() => new Response(new Blob([new Uint8Array([9])], { type: "audio/mpeg" })));
  await makeSong({ ...ask, id: "openai", key: "sk-test", model: "gpt-4o-mini-tts" }, fetcher);
  assert.equal(seen[0].url, "https://api.openai.com/v1/audio/speech");
  assert.equal(JSON.parse(String(seen[0].init.body)).input, "Blessed are the poor in spirit");
});
