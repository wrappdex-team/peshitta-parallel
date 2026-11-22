/**
 * Verse-aware sermon prompts and citation checks. Cited verses are quoted
 * from this edition; references that cannot be found here are flagged.
 */
import { BOOKS, bookMeta } from "../data/edition.ts";
import { parseReference, referenceFault } from "../lib/search-match.ts";
import { VERSE_COUNTS, versesIn } from "../lib/verse-counts.ts";

export const SERMON_SYSTEM = `You are writing a motivational Christian apologetic sermon for a reader of this Peshitta New Testament edition (INjeel).

Write a sermon that:
- explains what Jesus or the given passage is saying, in clear, motivational language;
- offers a respectful Christian apologetic defence or explanation of the passage;
- cross-references related verses that truly illuminate it.

Rules for cross-references:
- Cite only real scripture, with book, chapter and verse (for example John 1:14 or Romans 8:3).
- Do not invent verses, chapters or quotations.
- This edition contains the New Testament only. Prefer New Testament references, which can be checked and quoted from this text. If you mention a book that is not in the New Testament, say so plainly and do not invent its wording.
- After a citation, do not paraphrase the cited verse at length; the edition will supply the wording.

Safety and reverence:
- Be reverent and dignified.
- Do not write hateful content toward other faiths. Apologetics must stay respectful.
- Do not claim the sermon was reviewed by a human, or that it was made directly from the Syriac text.

Reply with the sermon only, in plain prose. No title page and no commentary about these instructions.`;

export const TONES = ["Apologetic", "Pastoral", "Evangelistic"] as const;
export type SermonTone = (typeof TONES)[number];
export const LENGTHS = [
  { id: "short", label: "Short", words: 300 },
  { id: "medium", label: "Medium", words: 600 },
  { id: "long", label: "Long", words: 1000 },
] as const;
export type SermonLength = (typeof LENGTHS)[number]["id"];

export function sermonUser(ref: string, verses: { en: string }[], tone: string, length: SermonLength, guidance = "") {
  const text = verses.map((verse) => verse.en.replace(/\s+/g, " ").trim()).join(" ");
  const words = LENGTHS.find((row) => row.id === length)?.words ?? 600;
  const lines = [`Passage: ${ref}`, `The English of this edition: “${text}”`, `Tone: ${tone}.`, `Length: about ${words} words.`];
  if (guidance.trim()) lines.push(`Further guidance from the reader: ${guidance.trim()}`);
  lines.push("Write the sermon now.");
  return lines.join("\n\n");
}

function chaptersOf(id: string) {
  return VERSE_COUNTS[id]?.length ?? 0;
}

const SKIP = /^(chapter|verse|volume|version|part|page|line|section|note|act)$/i;
const CITE = /\b(?:(?:1st|2nd|3rd|[123]|III|II|I)\s+)?[A-Za-z][A-Za-z']+\s+\d+:\d+(?:\s*[–-]\s*\d+)?/g;
const AFTER_QUOTE = /^\s*[:—,]?\s*[“"']([^”"']+)[”"']/;

export type Citation = {
  raw: string;
  index: number;
  end: number;
  ok: boolean;
  display: string;
  book?: string;
  chapter?: number;
  from?: number;
  to?: number;
  reason?: string;
};

/** Every book-chapter-verse mention in a sermon, checked against this edition. */
export function findCitations(text: string): Citation[] {
  const found: Citation[] = [];
  for (const match of text.matchAll(CITE)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const bookPart = raw.replace(/\s+\d+:\d+(?:\s*[–-]\s*\d+)?$/, "").trim();
    if (SKIP.test(bookPart)) continue;
    const range = raw.match(/(\d+):(\d+)(?:\s*[–-]\s*(\d+))?$/);
    if (!range) continue;
    const head = `${bookPart} ${range[1]}:${range[2]}`;
    const place = parseReference(head, undefined, chaptersOf, versesIn);
    const last = range[3] ? Number(range[3]) : Number(range[2]);
    const first = Number(range[2]);
    if (!place) {
      const fault = referenceFault(head, undefined, chaptersOf, versesIn);
      found.push({ raw, index, end: index + raw.length, ok: false, display: raw.replace(/\s+/g, " "), reason: fault ? "no such verse" : "not in this edition" });
      continue;
    }
    const endVerse = Math.max(first, last);
    let ok = endVerse >= first;
    for (let v = first; v <= endVerse; v++) {
      if (versesIn(place.book, place.chapter) < v) ok = false;
    }
    const name = bookMeta(place.book)?.name ?? BOOKS.find((row) => row.id === place.book)?.name ?? place.book;
    const display = `${name} ${place.chapter}:${first === endVerse ? first : `${first}–${endVerse}`}`;
    found.push({ raw, index, end: index + raw.length, ok, display, book: place.book, chapter: place.chapter, from: first, to: endVerse, reason: ok ? undefined : "no such verse" });
  }
  return found;
}

/** Insert this edition's wording after valid citations; flag the rest in place. */
export function applyCitations(text: string, quotes: Record<string, string>) {
  const flags: { ref: string; reason: string }[] = [];
  const citations = findCitations(text);
  let out = text;
  for (const cite of [...citations].reverse()) {
    if (cite.ok) {
      const quote = quotes[cite.display];
      if (!quote) continue;
      const tail = out.slice(cite.end);
      const had = tail.match(AFTER_QUOTE);
      let insert = ` — “${quote}”`;
      let used = had ? had[0].length : 0;
      const rest = tail.slice(used);
      if (/^\./.test(rest)) {
        insert = /[.!?]$/.test(quote) ? ` — “${quote}”` : ` — “${quote}.”`;
        used += 1;
      }
      out = `${out.slice(0, cite.end)}${insert}${tail.slice(used)}`;
    } else if (cite.reason) {
      flags.push({ ref: cite.display, reason: cite.reason });
      const already = out.slice(cite.end).match(/^\s*\[[^\]]+\]/);
      if (!already) out = `${out.slice(0, cite.end)} [${cite.reason}]${out.slice(cite.end)}`;
    }
  }
  return { text: out, flags: flags.reverse() };
}

export async function shareOrCopy(title: string, text: string, api: { share?: (data: { title: string; text: string }) => Promise<void>; copy: (text: string) => Promise<void> }) {
  if (api.share) {
    try {
      await api.share({ title, text });
      return "shared" as const;
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return "closed" as const;
    }
  }
  try {
    await api.copy(text);
    return "copied" as const;
  } catch {
    return "failed" as const;
  }
}
