/**
 * Verse-aware prompts, lyrics and storyboards. The verse is quoted, never edited.
 * Every prompt carries the reverence guard; every output carries its label.
 */
import type { CenturyStyle } from "./styles.ts";

/** A century preset, or a reader's custom pre-prompt, used only as style text. */
export type StylePrompt = Pick<CenturyStyle, "prompt">;

export type Verse = { v: number; en: string; sy?: string };
export const REVERENCE = "Reverent, dignified sacred art. No gore, no nudity, no mockery, no modern objects or logos. No text, letters or captions in the image.";
export const ASPECTS = ["1:1", "4:5", "3:2", "16:9", "9:16"] as const;
export type Aspect = (typeof ASPECTS)[number];

function quote(text: string, max = 600) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function stillPrompt(ref: string, verses: Verse[], style: StylePrompt) {
  const text = quote(verses.map((verse) => verse.en).join(" "));
  return `${style.prompt}. Depict the scene of ${ref}: “${text}”. ${REVERENCE}`;
}

/** Light check before a request leaves the tab. Providers keep their own safety systems. */
export function irreverent(text: string) {
  // The guard itself says "no gore, no nudity…": only what the reader asks for counts.
  const asked = text.split(REVERENCE).join(" ").replace(/\b(?:no|without|avoid)\s+[\w-]+/gi, " ");
  return /\b(nude|naked|gore|blood\s*bath|sexy|porn|mock(?:ing|ery)?\s+(?:jesus|christ|god)|satanic\s+ritual)\b/i.test(asked);
}

export type SongLanguage = "english" | "syriac" | "both";

export function lyricsFor(verses: Verse[], language: SongLanguage) {
  const lines: string[] = [];
  for (const verse of verses) {
    const en = verse.en.replace(/\s+/g, " ").trim();
    const sy = (verse.sy ?? "").replace(/\s+/g, " ").trim();
    if (language !== "english" && sy) lines.push(sy);
    if (language !== "syriac" || !sy) lines.push(en);
  }
  return lines.length > 1 ? `[Verse]\n${lines.join("\n")}` : `[Verse]\n${lines[0] ?? ""}`;
}

export type SongShape = { genre: string; mood: string; bpm: number; vocal: string; seconds: number; language: SongLanguage };

export function songPrompt(ref: string, shape: SongShape) {
  const voice = shape.vocal === "instrumental" ? "instrumental only, no vocals" : `${shape.vocal} vocals singing the given lyrics exactly`;
  const tongue = shape.language === "syriac" ? "sung in Classical Syriac (Aramaic)" : shape.language === "both" ? "alternating Classical Syriac (Aramaic) and English lines" : "sung in English";
  return `A reverent ${shape.genre} piece setting ${ref} to music, ${shape.mood} mood, about ${shape.bpm} BPM, ${voice}, ${tongue}, about ${shape.seconds} seconds. Sacred and dignified.`;
}

export type Shot = { id: string; ref: string; verses: Verse[]; prompt: string };

/** A verse or chapter becomes at most `max` shots, verses grouped evenly. */
export function storyboard(bookName: string, chapter: number, verses: Verse[], style: StylePrompt, max = 8): Shot[] {
  if (!verses.length) return [];
  const count = Math.min(max, verses.length);
  const size = Math.ceil(verses.length / count);
  const shots: Shot[] = [];
  for (let i = 0; i < verses.length; i += size) {
    const group = verses.slice(i, i + size);
    const first = group[0].v;
    const last = group[group.length - 1].v;
    const ref = `${bookName} ${chapter}:${first === last ? first : `${first}–${last}`}`;
    const text = quote(group.map((verse) => verse.en).join(" "), 400);
    shots.push({ id: `${chapter}-${first}`, ref, verses: group, prompt: `${style.prompt}, as a slow cinematic shot with gentle camera movement. Scene of ${ref}: “${text}”. ${REVERENCE.replace(" in the image", " on screen")}` });
  }
  return shots;
}

export type Made = { kind: "still" | "song" | "film" | "voice"; provider: string; model: string; ref: string };

/** The line shown with, and stored beside, everything Studio makes. */
export function labelFor(made: Made) {
  return `AI-generated · ${made.provider} · ${made.model} · ${made.ref} · not reviewed`;
}

export function fileName(ref: string, detail: string, ext: string) {
  const slug = `${ref}-${detail}`
    .toLowerCase()
    .replace(/[–:]/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `injeel-${slug}.${ext}`;
}
