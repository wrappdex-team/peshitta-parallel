import { createServerFn } from "@tanstack/react-start";
import { BOOKS } from "@/data/edition";
import { type LangId, languageById } from "@/lib/languages";
import { loadBook, loadParallel, type Verse } from "@/lib/scripture";

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
const CHUNK: Record<LangId, number> = {
  en: 1500,
  es: 1500,
  de: 1500,
  zh: 480,
  ja: 700,
  aii: 900,
};

const LOCAL_NAMES: Record<Exclude<LangId, "en">, Record<string, string>> = {
  es: {
    matthew: "Mateo", mark: "Marcos", luke: "Lucas", john: "Juan", acts: "Hechos", romans: "Romanos",
    "1corinthians": "Primera de Corintios", "2corinthians": "Segunda de Corintios", galatians: "Gálatas",
    ephesians: "Efesios", philippians: "Filipenses", colossians: "Colosenses",
    "1thessalonians": "Primera de Tesalonicenses", "2thessalonians": "Segunda de Tesalonicenses",
    "1timothy": "Primera de Timoteo", "2timothy": "Segunda de Timoteo", titus: "Tito", philemon: "Filemón",
    hebrews: "Hebreos", james: "Santiago", "1peter": "Primera de Pedro", "2peter": "Segunda de Pedro",
    "1john": "Primera de Juan", "2john": "Segunda de Juan", "3john": "Tercera de Juan", jude: "Judas",
    revelation: "Apocalipsis",
  },
  zh: {
    matthew: "马太福音", mark: "马可福音", luke: "路加福音", john: "约翰福音", acts: "使徒行传", romans: "罗马书",
    "1corinthians": "哥林多前书", "2corinthians": "哥林多后书", galatians: "加拉太书", ephesians: "以弗所书",
    philippians: "腓立比书", colossians: "歌罗西书", "1thessalonians": "帖撒罗尼迦前书", "2thessalonians": "帖撒罗尼迦后书",
    "1timothy": "提摩太前书", "2timothy": "提摩太后书", titus: "提多书", philemon: "腓利门书", hebrews: "希伯来书",
    james: "雅各书", "1peter": "彼得前书", "2peter": "彼得后书", "1john": "约翰一书", "2john": "约翰二书",
    "3john": "约翰三书", jude: "犹大书", revelation: "启示录",
  },
  de: {
    matthew: "Matthäus", mark: "Markus", luke: "Lukas", john: "Johannes", acts: "Apostelgeschichte", romans: "Römer",
    "1corinthians": "Erster Korinther", "2corinthians": "Zweiter Korinther", galatians: "Galater", ephesians: "Epheser",
    philippians: "Philipper", colossians: "Kolosser", "1thessalonians": "Erster Thessalonicher", "2thessalonians": "Zweiter Thessalonicher",
    "1timothy": "Erster Timotheus", "2timothy": "Zweiter Timotheus", titus: "Titus", philemon: "Philemon",
    hebrews: "Hebräer", james: "Jakobus", "1peter": "Erster Petrus", "2peter": "Zweiter Petrus",
    "1john": "Erster Johannes", "2john": "Zweiter Johannes", "3john": "Dritter Johannes", jude: "Judas",
    revelation: "Offenbarung",
  },
  ja: {
    matthew: "マタイ", mark: "マルコ", luke: "ルカ", john: "ヨハネ", acts: "使徒行伝", romans: "ローマ",
    "1corinthians": "コリント人への手紙一", "2corinthians": "コリント人への手紙二", galatians: "ガラテヤ",
    ephesians: "エペソ", philippians: "ピリピ", colossians: "コロサイ",
    "1thessalonians": "テサロニケ人への手紙一", "2thessalonians": "テサロニケ人への手紙二",
    "1timothy": "テモテへの手紙一", "2timothy": "テモテへの手紙二", titus: "テトス", philemon: "ピレモン",
    hebrews: "ヘブル", james: "ヤコブ", "1peter": "ペテロの手紙一", "2peter": "ペテロの手紙二",
    "1john": "ヨハネの手紙一", "2john": "ヨハネの手紙二", "3john": "ヨハネの手紙三", jude: "ユダ",
    revelation: "黙示録",
  },
  aii: {},
};

function leadIn(lang: LangId, name: string, chapter: number) {
  if (lang === "es") return `${name}, capítulo ${chapter}. `;
  if (lang === "zh") return `${name}，第${chapter}章。`;
  if (lang === "de") return `${name}, Kapitel ${chapter}. `;
  if (lang === "ja") return `${name}、第${chapter}章。`;
  if (lang === "aii") return `${name} ${chapter}. `;
  return `${name}, chapter ${chapter}. `;
}

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

export function spokenName(book: string, lang: LangId = "en"): string {
  if (lang === "aii") return BOOKS.find((item) => item.id === book)?.sy ?? spokenName(book, "en");
  if (lang !== "en") return LOCAL_NAMES[lang][book] ?? spokenName(book, "en");
  return SPOKEN[book] ?? BOOKS.find((item) => item.id === book)?.name ?? "This book";
}

export function cleanEnglish(en: string) {
  return en.replace(/[‹›]/g, "").replace(/\s+/g, " ").trim();
}

/** Continuous reading, split only on verse boundaries. */
export function chapterPieces(book: string, chapter: number, verses: Verse[], lines: string[], lang: LangId): Piece[] {
  const bits = verses
    .map((verse, index) => ({ v: verse.v, text: cleanEnglish(lines[index] || "") }))
    .filter((bit) => bit.text.length > 0);
  if (!bits.length) return [];

  const pieces: Piece[] = [];
  let text = "";
  let spans: Span[] = [];
  const lead = leadIn(lang, spokenName(book, lang), chapter);
  const limit = CHUNK[lang];

  function flush() {
    if (!text) return;
    pieces.push({ text, spans });
    text = "";
    spans = [];
  }

  for (const bit of bits) {
    const prefix = text ? " " : pieces.length === 0 ? lead : "";
    if (text && text.length + prefix.length + bit.text.length > limit) flush();
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
  .validator((input: { book: string; chapter: number; voice: VoiceId; part: number; lang: LangId }) => {
    const book = String(input?.book ?? "");
    const chapter = Number(input?.chapter);
    const part = Number(input?.part);
    const voice = input?.voice;
    const lang = languageById(String(input?.lang ?? "")).id;
    if (!/^[a-z0-9]+$/.test(book) || !VOICES.has(voice) || lang !== input?.lang || !Number.isInteger(chapter) || chapter < 1 || chapter > 150 || !Number.isInteger(part) || part < 0 || part > 40) {
      throw new Error("That reading could not be requested.");
    }
    return { book, chapter, voice, part, lang };
  })
  .handler(async ({ data }): Promise<SpeakResult> => {
    const key = `${data.book}:${data.chapter}:${data.voice}:${data.lang}:${data.part}`;
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
    const lines = data.lang === "en" ? verses.map((verse) => verse.en) : (await loadParallel(data.lang, data.book))?.[data.chapter - 1];
    if (!lines) return { ok: false, error: "That language is not ready for this chapter yet." };
    const pieces = chapterPieces(data.book, data.chapter, verses, lines, data.lang);
    if (!pieces.length) return { ok: false, error: "This chapter has nothing to read in that language." };
    const piece = pieces[data.part];
    if (!piece) return { ok: false, error: "That part of the chapter is missing." };

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "The reading voice is not available right now." };

    let ip = "reader";
    let signal: AbortSignal | undefined;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      signal = request.signal;
      const forwarded = request.headers.get("x-forwarded-for");
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
      language: languageById(data.lang).tts,
      speed: 1,
      text_normalization: false,
      with_timestamps: true,
      output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
    };

    try {
      if (signal?.aborted) return { ok: false, error: "The voice was cut off. Press Read to continue." };
      let res: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal?.aborted) return { ok: false, error: "The voice was cut off. Press Read to continue." };
        res = await fetch("https://api.x.ai/v1/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal,
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
    } catch {
      return { ok: false, error: "The voice was cut off. Press Read to continue." };
    }
  });
