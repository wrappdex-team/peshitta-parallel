import assert from "node:assert/strict";
import { test } from "node:test";
import { freeRecitation } from "./adapters/free.ts";
import { makeSong } from "./adapters/song.ts";
import { FREE_NOTE, detectProvider, keyFits, provider } from "./catalog.ts";
import { testConnection } from "./connect.ts";

globalThis.URL.createObjectURL = (blob: Blob) => `blob:test/${blob.type}/${blob.size}`;
type Seen = { url: string; init: RequestInit };
function mock(reply: (url: string, init: RequestInit) => Response) {
  const seen: Seen[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    seen.push({ url, init });
    return reply(url, init);
  }) as unknown as typeof fetch;
  return { seen, fetcher };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const media = (type: string) => new Response(new Blob([new Uint8Array([1, 2, 3, 4])], { type }));

test("Free services are keyless, offer recitation only, and never look like a pasted key", () => {
  const free = provider("free");
  assert.equal(free.keyless, true);
  assert.deepEqual(free.caps.voice?.map((m) => m.id), ["kokoro"]);
  assert.equal(free.caps.still, undefined);
  assert.equal(free.caps.film, undefined);
  assert.equal(free.caps.song, undefined);
  assert.match(FREE_NOTE, /recitation/);
  assert.doesNotMatch(free.blurb, /Pollinations|LTX/);
  assert.equal(detectProvider("no-key-no-key-no-key-no-key"), null);
  assert.equal(keyFits("free", "no-key-no-key-no-key-no-key"), false);
});

test("testing the free connection makes no request", async () => {
  const { seen, fetcher } = mock(() => json({}));
  const out = await testConnection("free", "no-key", fetcher);
  assert.equal(out.ok, true);
  assert.equal(seen.length, 0);
});

test("free recitation: Gradio call, then stream, then the file from the same Space only", async () => {
  const host = "https://remsky-kokoro-tts-zero.hf.space";
  const { seen, fetcher } = mock((url) => {
    if (url === `${host}/gradio_api/call/generate_speech_from_ui`) return json({ event_id: "abc123" });
    if (url.endsWith("/abc123")) return new Response(`event: complete\ndata: [{"url":"${host}/gradio_api/file=/tmp/a.wav"},{"type":"matplotlib"}]\n\n`);
    return media("audio/wav");
  });
  const out = await makeSong({ id: "free", key: "no-key", model: "kokoro", prompt: "", lyrics: "[Verse]\nBlessed are the poor in spirit", seconds: 30, instrumental: false }, fetcher);
  assert.deepEqual(out, { ok: true, src: "blob:test/audio/wav/4", mime: "audio/wav" });
  assert.deepEqual(JSON.parse(String(seen[0].init.body)).data, ["Blessed are the poor in spirit", ["bm_george"], 0.9]);
  assert.ok(seen.every((call) => call.url.startsWith(host)), "never leaves the Kokoro Space");
});

test("free recitation: an error event from the Space reads as busy", async () => {
  const { fetcher } = mock((url) => (url.includes("/call/generate_speech_from_ui/") ? new Response("event: error\ndata: null\n\n") : json({ event_id: "zz" })));
  const out = await freeRecitation("Blessed", fetcher);
  assert.equal(out.ok, false);
  assert.match(!out.ok ? out.error : "", /busy/);
});

test("free recitation: a file URL on another host is refused", async () => {
  const host = "https://remsky-kokoro-tts-zero.hf.space";
  const { seen, fetcher } = mock((url) => (url === `${host}/gradio_api/call/generate_speech_from_ui` ? json({ event_id: "e1" }) : new Response(`event: complete\ndata: [{"url":"https://evil.example/x.wav"}]\n\n`)));
  const out = await freeRecitation("Blessed", fetcher);
  assert.equal(out.ok, false);
  assert.equal(seen.length, 2, "never fetched the foreign URL");
});
