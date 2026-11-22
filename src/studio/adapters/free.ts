/**
 * "Free services": third-party, no key, no account. Pollinations for stills and
 * public Hugging Face Spaces (Gradio) for a Kokoro recitation and LTX Video.
 * Calls go straight from this tab. Nothing here is a credential, and INjeel
 * pays for none of it. Availability, marks and limits belong to their owners.
 */
import { networkFailure, type Failure, type Fetch } from "../http.ts";
import type { Aspect } from "../prompt.ts";

const NAME = "Free services";
const KOKORO = "https://remsky-kokoro-tts-zero.hf.space";
const LTX = "https://lightricks-ltx-video-distilled.hf.space";
const SIZE: Record<Aspect, [number, number]> = { "1:1": [1024, 1024], "4:5": [832, 1040], "3:2": [1152, 768], "16:9": [1152, 648], "9:16": [648, 1152] };
const BUSY = `${NAME} are busy or out of their free allowance right now. Try again later, or connect your own key.`;
const gone = (what: string): Failure => ({ ok: false, error: `${NAME} could not make the ${what}. They are community-run and may be paused. Try again later, or connect your own key.` });

async function blobUrl(res: Response, fallback: string) {
  const blob = await res.blob();
  return blob.size ? { src: URL.createObjectURL(blob), mime: blob.type || fallback } : null;
}

/** Pollinations: one GET per picture. `private` keeps it off their public feed. */
export async function freeStill(prompt: string, aspect: Aspect, count: number, fetcher: Fetch = fetch, signal?: AbortSignal): Promise<{ ok: true; images: { src: string; mime: string }[] } | Failure> {
  const [width, height] = SIZE[aspect];
  try {
    const seed0 = Math.floor(Math.random() * 1e6);
    const rows = await Promise.all(
      Array.from({ length: count }, async (_, n) => {
        const res = await fetcher(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1500))}?model=sana&width=${width}&height=${height}&seed=${seed0 + n}&nologo=true&private=true`, { signal });
        return res.ok && /^image\//.test(res.headers.get("content-type") ?? "") ? blobUrl(res, "image/jpeg") : null;
      }),
    );
    const images = rows.filter((row): row is { src: string; mime: string } => Boolean(row));
    return images.length ? { ok: true, images } : { ok: false, error: BUSY };
  } catch (error) {
    return networkFailure(NAME, error);
  }
}

/** Gradio "call" API: POST the inputs, then read the event stream once for the result. */
async function gradio(host: string, endpoint: string, data: unknown[], fetcher: Fetch, signal?: AbortSignal): Promise<{ ok: true; file: string } | Failure> {
  const start = await fetcher(`${host}/gradio_api/call/${endpoint}`, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
  if (!start.ok) return { ok: false, error: BUSY };
  const id = ((await start.json()) as { event_id?: string }).event_id ?? "";
  if (!/^[\w-]+$/.test(id)) return gone("media");
  const stream = await fetcher(`${host}/gradio_api/call/${endpoint}/${id}`, { signal });
  if (!stream.ok) return { ok: false, error: BUSY };
  const text = await stream.text();
  const done = /event: complete\s+data: (.+)/.exec(text);
  if (!done) return /event: error/.test(text) ? { ok: false, error: BUSY } : gone("media");
  try {
    const rows = JSON.parse(done[1]) as unknown[];
    const first = rows[0] as { url?: string; video?: { url?: string } } | null;
    const url = first?.url ?? first?.video?.url ?? "";
    return url.startsWith(`${host}/gradio_api/file=`) ? { ok: true, file: url } : gone("media");
  } catch {
    return gone("media");
  }
}

async function fetchFile(file: string, fallback: string, fetcher: Fetch, signal?: AbortSignal) {
  const res = await fetcher(file, { signal });
  return res.ok ? blobUrl(res, fallback) : null;
}

/** Kokoro 82M: a calm male reader (British), a little slower than normal. */
export async function freeRecitation(text: string, fetcher: Fetch = fetch, signal?: AbortSignal): Promise<{ ok: true; src: string; mime: string } | Failure> {
  try {
    const out = await gradio(KOKORO, "generate_speech_from_ui", [text.slice(0, 1000), ["bm_george"], 0.9], fetcher, signal);
    if (!out.ok) return out;
    const media = await fetchFile(out.file, "audio/wav", fetcher, signal);
    return media ? { ok: true, ...media } : gone("recitation");
  } catch (error) {
    return networkFailure(NAME, error);
  }
}

/** LTX Video (distilled): a short clip, a couple of seconds. */
export async function freeClip(prompt: string, aspect: "16:9" | "9:16" | "1:1", fetcher: Fetch = fetch, signal?: AbortSignal): Promise<{ ok: true; src: string; mime: string } | Failure> {
  const [width, height] = aspect === "9:16" ? [512, 704] : aspect === "1:1" ? [512, 512] : [704, 512];
  try {
    const out = await gradio(LTX, "text_to_video", [prompt.slice(0, 1200), "worst quality, blurry, jittery, distorted, text, gore", null, null, height, width, "text-to-video", 2, 9, Math.floor(Math.random() * 1e6), false, 1, true], fetcher, signal);
    if (!out.ok) return out;
    const media = await fetchFile(out.file, "video/mp4", fetcher, signal);
    return media ? { ok: true, ...media } : gone("shot");
  } catch (error) {
    return networkFailure(NAME, error);
  }
}
