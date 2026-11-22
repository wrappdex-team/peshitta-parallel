import { BOOKS } from "@/data/edition";
import { chapterCount, loadBook } from "@/lib/scripture";
import { useRef, useState } from "react";
import { scopeFromChapter, versesOf } from "./passage.ts";
import type { StudioScope } from "./prefs.ts";

async function loadScope(book: string, chapter: number, from?: number, to?: number): Promise<StudioScope> {
  const id = BOOKS.some((row) => row.id === book) ? book : "matthew";
  const max = chapterCount(id) || 1;
  const n = Math.min(Math.max(chapter, 1), max);
  const doc = await loadBook(id);
  return scopeFromChapter(id, n, versesOf(doc.chapters[n - 1] ?? []), from, to);
}

const select = "min-h-11 w-full min-w-0 max-w-full bg-transparent text-ink";

/** Book, then chapter, then a from–to verse range. A single verse is from = to. */
export function PassagePicker({ scope, onChange }: { scope: StudioScope; onChange: (next: StudioScope) => void }) {
  const [pending, setPending] = useState(false);
  const token = useRef(0);
  const chapters = chapterCount(scope.book) || 1;
  const numbers = scope.verses.map((verse) => verse.v);
  const from = numbers.includes(scope.from) ? scope.from : (numbers[0] ?? 1);

  async function move(book: string, chapter: number, start?: number, end?: number) {
    const n = ++token.current;
    setPending(true);
    try {
      const next = await loadScope(book, chapter, start, end);
      if (token.current === n) onChange(next);
    } catch {
      /* Leave the current passage in place if the book cannot be loaded. */
    } finally {
      if (token.current === n) setPending(false);
    }
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted sm:grid-cols-4" aria-label="Passage">
      <label className="grid min-w-0">
        Book
        <select aria-label="Book" disabled={pending} className={select} value={scope.book} onChange={(event) => void move(event.target.value, 1)}>
          {BOOKS.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
        </select>
      </label>
      <label className="grid min-w-0">
        Chapter
        <select aria-label="Chapter" disabled={pending} className={select} value={scope.chapter} onChange={(event) => void move(scope.book, Number(event.target.value))}>
          {Array.from({ length: chapters }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="grid min-w-0">
        From
        <select aria-label="From" disabled={pending} className={select} value={from} onChange={(event) => onChange({ ...scope, from: Number(event.target.value), to: Math.max(Number(event.target.value), scope.to) })}>
          {numbers.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="grid min-w-0">
        To
        <select aria-label="To" disabled={pending} className={select} value={Math.max(scope.to, from)} onChange={(event) => onChange({ ...scope, to: Number(event.target.value) })}>
          {numbers.filter((n) => n >= from).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  );
}
