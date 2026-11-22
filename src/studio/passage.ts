import { bookMeta } from "../data/edition.ts";
import type { StudioScope, StudioVerse } from "./prefs.ts";

export function versesOf(rows: { v: number; en?: string; sy?: string }[]): StudioVerse[] {
  return rows.map((row) => ({ v: row.v, en: row.en || "", sy: row.sy || undefined }));
}

/** Keep from and to inside the chapter, with to at least from. */
export function clampPassage(verses: StudioVerse[], from?: number, to?: number) {
  const first = verses[0]?.v ?? 1;
  const last = verses[verses.length - 1]?.v ?? first;
  const start = Math.min(Math.max(from ?? first, first), last);
  const end = Math.min(Math.max(to ?? start, start), last);
  return { from: start, to: end };
}

export function scopeFromChapter(book: string, chapter: number, rows: StudioVerse[], from?: number, to?: number): StudioScope {
  const range = clampPassage(rows, from, to);
  return { book, bookName: bookMeta(book)?.name ?? book, chapter, verses: rows, ...range };
}
