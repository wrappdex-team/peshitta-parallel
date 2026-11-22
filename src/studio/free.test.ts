import assert from "node:assert/strict";
import { test } from "node:test";
import { freeClip, freeRecitation, freeStill } from "./adapters/free.ts";
import { makeSong } from "./adapters/song.ts";
import { makeStill } from "./adapters/still.ts";
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

test("Free services are keyless, say so, and never look like a pasted key", () => {
  assert.equal(provider("free").keyless, true);
  assert.match(FREE_NOTE, /third-party/);
  assert.equal(detectProvider("no-key-no-key-no-key-no-key"), null);
  assert.equal(keyFits("free", "no-key-no-key-no-key-no-key"), false);
});

test("testing the free connection makes no request", async () => {
  const { seen, fetcher } = mock(() => json({}));
  const out = await testConnection("free", "no-key", fetcher);
  assert.equal(out.ok, true);
  assert.equal(seen.length, 0);
});

test("free stills: Pollinations GET, private, sized from the aspect; no Authorization header", async () => {
  const { seen, fetcher } = mock(() => media("image/jpeg"));
  const out = await makeStill({ id: "free", key: "no-key", model: "sana", prompt: "A gold mosaic of Matthew 5:3", aspect: "16:9", count: 4 }, fetcher);
  assert.equal(out.ok && out.images.length, 2, "capped at 2 so a free service is not hammered");
  const url = new URL(seen[0].url);
  assert.equal(url.origin, "https://image.pollinations.ai");
  assert.equal(decodeURIComponent(url.pathname), "/prompt/A gold mosaic of Matthew 5:3");
  assert.equal(url.searchParams.get("private"), "true");
  assert.equal(url.searchParams.get("width"), "1152");
  assert.equal(seen[0].init.headers, undefined);
});

test("free stills: a busy service becomes one calm line that points to a key", async () => {
  const { fetcher } = mock(() => json({ error: "x" }, 402));
  const out = await freeStill("p", "1:1", 1, fetcher);
  assert.equal(out.ok, false);
  assert.match(!out.ok ? out.error : "", /busy or out of their free allowance.*connect your own key/);
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
});

test("free film: LTX Space; a file URL on another host is refused", async () => {
  const host = "https://lightricks-ltx-video-distilled.hf.space";
  const good = mock((url) => (url.endsWith("/text_to_video") ? json({ event_id: "e1" }) : url.endsWith("/e1") ? new Response(`event: complete\ndata: [{"video":{"url":"${host}/gradio_api/file=/tmp/o.mp4"}},1]\n\n`) : media("video/mp4")));
  const ok = await freeClip("A slow push in on a mosaic", "16:9", good.fetcher);
  assert.equal(ok.ok && ok.mime, "video/mp4");
  const data = JSON.parse(String(good.seen[0].init.body)).data;
  assert.equal(data.length, 13, "all of the Space's inputs, in order");
  assert.deepEqual([data[4], data[5], data[6], data[7]], [512, 704, "text-to-video", 2]);
  const evil = mock((url) => (url.endsWith("/text_to_video") ? json({ event_id: "e1" }) : new Response(`event: complete\ndata: [{"video":{"url":"https://evil.example/x.mp4"}},1]\n\n`)));
  const bad = await freeClip("p", "16:9", evil.fetcher);
  assert.equal(bad.ok, false);
  assert.equal(evil.seen.length, 2, "never fetched the foreign URL");
});

test("free recitation: an error event from the Space reads as busy", async () => {
  const { fetcher } = mock((url) => (url.includes("/call/generate_speech_from_ui/") ? new Response("event: error\ndata: null\n\n") : json({ event_id: "zz" })));
  const out = await freeRecitation("Blessed", fetcher);
  assert.equal(out.ok, false);
  assert.match(!out.ok ? out.error : "", /busy/);
});
