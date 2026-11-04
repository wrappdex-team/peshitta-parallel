import { createServerFn } from "@tanstack/react-start";
import { BOOKS } from "@/data/edition";
import { loadBook, type Verse } from "@/lib/scripture";

export type VoiceId = "ara" | "rex";

export type Cue = { v: number; start: number; end: number };

export type SpeakOk = {
  ok: true;
  part: number;
  parts: number;
  audio: string;
  mime: string;
  duration: number;
  cues: Cue[];
};

export type SpeakResult = SpeakOk | { ok: false; error: string };

const VOICES = new Set<VoiceId>(["ara", "rex"]);
/** Keep each clip under the host response limit while staying near 128 kbps. */
const CHUNK = 1500;

const SPOKEN: Record<string, string> = {
  "1corinthians": "First Corinthians",
  "2corinthians": "Second Corinthians",
  "1thessalonians": "First Thessalonians",
  "2thessalonians": "Second Thessalonians",
  "1timothy": "First Timothy",
  "2timothy": "Second Timothy",
  "1peter": "First Peter",
  "2peter": "Second Peter",
  "1john": "First John",
  "2john": "Second John",
  "3john": "Third John",
};

type Span = { v: number; start: number; end: number };
type Piece = { text: string; spans: Span[] };

export function spokenName(book: string) {
  return SPOKEN[book] ?? BOOKS.find((item) => item.id === book)?.name ?? "This book";
}

export function cleanEnglish(en: string) {
  return en.replace(/[‹›]/g, "").replace(/\s+/g, " ").trim();
}

/** Continuous reading, split only on verse boundaries. */
export function chapterPieces(book: string, chapter: number, verses: Verse[]): Piece[] {
  const bits = verses
    .map((verse) => ({ v: verse.v, text: cleanEnglish(verse.en) }))
    .filter((bit) => bit.text.length > 0);
  if (!bits.length) return [];

  const pieces: Piece[] = [];
  let text = "";
  let spans: Span[] = [];
  const lead = `${spokenName(book)}, chapter ${chapter}. `;

  function flush() {
    if (!text) return;
    pieces.push({ text, spans });
    text = "";
    spans = [];
  }

  for (const bit of bits) {
    const prefix = text ? " " : pieces.length === 0 ? lead : "";
    if (text && text.length + prefix.length + bit.text.length > CHUNK) flush();
    if (!text && pieces.length === 0) text = lead;
    else if (text) text += " ";
    const start = text.length;
    text += bit.text;
    spans.push({ v: bit.v, start, end: text.length });
  }
  flush();
  return pieces;
}

const cache = new Map<string, SpeakOk>();
const CACHE_MAX = 10;
const hits = new Map<string, number[]>();

function allow(ip: string) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= 80) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function remember(key: string, value: SpeakOk) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function cuesFrom(text: string, spans: Span[], chars: string[], times: [number, number][]) {
  const same = chars.length === text.length && chars.join("") === text;
  return spans.map((span) => {
    let start = span.start;
    let end = Math.max(span.start, span.end - 1);
    if (!same && chars.length > 0) {
      start = Math.min(chars.length - 1, Math.floor((span.start / text.length) * chars.length));
      end = Math.min(chars.length - 1, Math.floor((span.end / text.length) * chars.length));
    }
    const a = times[start] ?? [0, 0];
    const b = times[end] ?? a;
    return { v: span.v, start: a[0], end: Math.max(a[0], b[1]) };
  });
}

export const speakPart = createServerFn({ method: "POST" })
  .validator((input: { book: string; chapter: number; voice: VoiceId; part: number }) => {
    const book = String(input?.book ?? "");
    const chapter = Number(input?.chapter);
    const part = Number(input?.part);
    const voice = input?.voice;
    if (!/^[a-z0-9]+$/.test(book) || !VOICES.has(voice) || !Number.isInteger(chapter) || chapter < 1 || chapter > 150 || !Number.isInteger(part) || part < 0 || part > 40) {
      throw new Error("That reading could not be requested.");
    }
    return { book, chapter, voice, part };
  })
  .handler(async ({ data }): Promise<SpeakResult> => {
    const key = `${data.book}:${data.chapter}:${data.voice}:${data.part}`;
    const cached = cache.get(key);
    if (cached) return cached;

    let doc;
    try {
      doc = await loadBook(data.book);
    } catch {
      return { ok: false, error: "That book is not in this edition." };
    }
    const verses = doc.chapters[data.chapter - 1];
    if (!verses) return { ok: false, error: "That chapter is not in this book." };
    const pieces = chapterPieces(data.book, data.chapter, verses);
    if (!pieces.length) return { ok: false, error: "This chapter has no English to read." };
    const piece = pieces[data.part];
    if (!piece) return { ok: false, error: "That part of the chapter is missing." };

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "The reading voice is not available right now." };

    let ip = "reader";
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const forwarded = getRequest().headers.get("x-forwarded-for");
      ip = forwarded?.split(",")[0]?.trim() || "reader";
    } catch {
      ip = "reader";
    }
    if (!allow(ip)) {
      return { ok: false, error: "The voice needs a short rest. Try this chapter again in a few minutes." };
    }

    const body = {
      text: piece.text,
      voice_id: data.voice,
      language: "en",
      speed: 1,
      text_normalization: false,
      with_timestamps: true,
      output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
    };

    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok || (res.status !== 429 && res.status !== 500 && res.status !== 503)) break;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    if (!res || !res.ok) {
      return { ok: false, error: "The voice could not read this passage. Try again in a moment." };
    }

    const payload = (await res.json()) as {
      audio?: string;
      content_type?: string;
      duration?: number;
      audio_timestamps?: { graph_chars?: string[]; graph_times?: [number, number][] };
    };
    if (!payload.audio || !payload.audio_timestamps?.graph_times) {
      return { ok: false, error: "The voice returned no reading." };
    }
    const chars = payload.audio_timestamps.graph_chars ?? [];
    const times = payload.audio_timestamps.graph_times;
    const result: SpeakOk = {
      ok: true,
      part: data.part,
      parts: pieces.length,
      audio: payload.audio,
      mime: payload.content_type || "audio/mpeg",
      duration: payload.duration ?? times.at(-1)?.[1] ?? 0,
      cues: cuesFrom(piece.text, piece.spans, chars, times),
    };
    remember(key, result);
    return result;
  });
