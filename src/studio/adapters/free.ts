/**
 * "Free services": third-party, no key, no account. A public Hugging Face Space
 * (Gradio) for a Kokoro recitation. Calls go straight from this tab. Nothing
 * here is a credential, and INjeel pays for none of it. Availability and
 * limits belong to the Space's owners.
 */
import { networkFailure, type Failure, type Fetch } from "../http.ts";

const NAME = "Free services";
const KOKORO = "https://remsky-kokoro-tts-zero.hf.space";
const BUSY = `${NAME} are busy or out of their free allowance right now. Try again later, or connect your own key.`;
const gone = (what: string): Failure => ({ ok: false, error: `${NAME} could not make the ${what}. They are community-run and may be paused. Try again later, or connect your own key.` });

async function blobUrl(res: Response, fallback: string) {
  const blob = await res.blob();
  return blob.size ? { src: URL.createObjectURL(blob), mime: blob.type || fallback } : null;
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
    const first = rows[0] as { url?: string } | null;
    const url = first?.url ?? "";
    return url.startsWith(`${host}/gradio_api/file=`) ? { ok: true, file: url } : gone("media");
  } catch {
    return gone("media");
  }
}

/** Kokoro 82M: a calm male reader (British), a little slower than normal. */
export async function freeRecitation(text: string, fetcher: Fetch = fetch, signal?: AbortSignal): Promise<{ ok: true; src: string; mime: string } | Failure> {
  try {
    const out = await gradio(KOKORO, "generate_speech_from_ui", [text.slice(0, 1000), ["bm_george"], 0.9], fetcher, signal);
    if (!out.ok) return out;
    const res = await fetcher(out.file, { signal });
    const media = res.ok ? await blobUrl(res, "audio/wav") : null;
    return media ? { ok: true, ...media } : gone("recitation");
  } catch (error) {
    return networkFailure(NAME, error);
  }
}
