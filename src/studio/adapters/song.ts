/**
 * Songs from a verse on the reader's own account: Google Lyria, ElevenLabs
 * Music, fal MiniMax Music, or a reverent recitation with OpenAI TTS.
 * Shapes follow provider docs (Nov 2026); untested against live accounts.
 */
import { provider, type ProviderId } from "../catalog.ts";
import { failure, networkFailure, type Failure, type Fetch } from "../http.ts";
import { falQueue } from "./fal.ts";
import { freeRecitation } from "./free.ts";

export type SongAsk = { id: ProviderId; key: string; model: string; prompt: string; lyrics: string; seconds: number; instrumental: boolean };
export type SongResult = { ok: true; src: string; mime: string } | Failure;

function plain(lyrics: string) {
  return lyrics.replace(/^\[[^\]]*\]\s*$/gm, "").replace(/\n{2,}/g, "\n").trim();
}

/** media-src allows blob: but not data:, so inline audio becomes a blob URL. */
export function inlineMedia(data: string, mime: string) {
  const raw = atob(data);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

async function bytes(res: Response, fallback: string): Promise<SongResult> {
  const blob = await res.blob();
  if (!blob.size) return { ok: false, error: "The provider returned no audio. Try again." };
  return { ok: true, src: URL.createObjectURL(blob), mime: blob.type || fallback };
}

export async function makeSong(ask: SongAsk, fetcher: Fetch = fetch, signal?: AbortSignal, onWait?: (n: number) => void): Promise<SongResult> {
  const name = provider(ask.id).name;
  const words = ask.instrumental ? "" : `\n\nLyrics (scripture; sing exactly):\n${ask.lyrics}`;
  try {
    if (ask.id === "google") {
      const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ask.model)}:generateContent`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": ask.key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${ask.prompt}${words}` }] }] }),
      });
      if (!res.ok) return await failure(name, res, ask.key);
      const body = (await res.json()) as { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] };
      if (body.promptFeedback?.blockReason || /SAFETY|PROHIBITED|BLOCKLIST/.test(body.candidates?.[0]?.finishReason ?? "")) return { ok: false, safety: true, error: `${name} declined this for safety. Try a gentler description.` };
      const audio = body.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.mimeType?.startsWith("audio/"))?.inlineData;
      return audio?.data ? { ok: true, src: inlineMedia(audio.data, audio.mimeType as string), mime: audio.mimeType as string } : { ok: false, error: `${name} returned no audio. Try again.` };
    }
    if (ask.id === "elevenlabs") {
      const res = await fetcher("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "xi-api-key": ask.key },
        body: JSON.stringify({ prompt: `${ask.prompt}${words}`.slice(0, 4000), music_length_ms: Math.max(3000, Math.min(600000, ask.seconds * 1000)), model_id: ask.model, force_instrumental: ask.instrumental }),
      });
      if (!res.ok) return await failure(name, res, ask.key);
      return await bytes(res, "audio/mpeg");
    }
    if (ask.id === "fal") {
      const out = await falQueue(ask.model, ask.key, { prompt: ask.prompt.slice(0, 2000), lyrics: ask.instrumental ? "[Instrumental]" : ask.lyrics.slice(0, 3000), duration: Math.min(300, ask.seconds) }, fetcher, signal, { onWait });
      if (!out.ok) return out;
      const url = (out.body.audio as { url?: string } | undefined)?.url ?? "";
      return /^https:\/\//.test(url) ? { ok: true, src: url, mime: "audio/mpeg" } : { ok: false, error: "fal returned no audio. Try again." };
    }
    if (ask.id === "free") return await freeRecitation(plain(ask.lyrics), fetcher, signal);
    if (ask.id === "openai") {
      const res = await fetcher("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ask.key}` },
        body: JSON.stringify({ model: ask.model, voice: "cedar", input: plain(ask.lyrics).slice(0, 4000), instructions: "Recite this scripture reverently and slowly, like a lector in a quiet church. Pause between lines.", response_format: "mp3" }),
      });
      if (!res.ok) return await failure(name, res, ask.key);
      return await bytes(res, "audio/mpeg");
    }
    return { ok: false, error: `${name} does not make songs.` };
  } catch (error) {
    return networkFailure(name, error);
  }
}
