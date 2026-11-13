import { BOOKS } from "@/data/edition";
import type { LangId } from "@/lib/languages";
import { chapterCount, loadBook, loadParallel } from "@/lib/scripture";

export type OfflineVerse = { v: number; text: string };

export type OfflineChapter = {
  lang: LangId;
  book: string;
  chapter: number;
  verses: OfflineVerse[];
  at: number;
};

export type OfflinePlace = { lang: string; book: string; chapter: number };

export type CopyJob = {
  lang: string;
  kind: "chapter" | "book" | "all";
  done: number;
  total: number;
  label: string;
};

const DB = "injeel-offline";
const STORE = "chapters";

const listeners = new Set<() => void>();
let dbPromise: Promise<IDBDatabase> | null = null;
let job: CopyJob | null = null;

export function subscribeOffline(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

export function copyJob() {
  return job;
}

function setJob(next: CopyJob | null) {
  job = next;
  emit();
}

function claim(next: CopyJob) {
  if (job) throw new Error("A copy is already running.");
  setJob(next);
  void persistStorage();
}

async function persistStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // The copy remains until the browser clears this site.
  }
}

function keyOf(lang: string, book: string, chapter: number) {
  return `${lang}:${book}:${chapter}`;
}

function database(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function placeFromKey(key: IDBValidKey): OfflinePlace | null {
  if (typeof key !== "string") return null;
  const [lang, book, chapter] = key.split(":");
  const n = Number(chapter);
  if (!lang || !book || !Number.isInteger(n) || n < 1) return null;
  return { lang, book, chapter: n };
}

/** Chapter numbers only. The verse text stays in storage until a chapter is opened. */
export async function listOffline(): Promise<OfflinePlace[]> {
  const db = await database();
  const keys = await requestToPromise(db.transaction(STORE).objectStore(STORE).getAllKeys());
  return keys.flatMap((key) => {
    const place = placeFromKey(key);
    return place ? [place] : [];
  });
}

export async function readOfflineChapter(lang: string, book: string, chapter: number): Promise<OfflineChapter | null> {
  const db = await database();
  const row = await requestToPromise(db.transaction(STORE).objectStore(STORE).get(keyOf(lang, book, chapter)));
  return (row as OfflineChapter | undefined) ?? null;
}

async function writeChapters(rows: OfflineChapter[]) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const row of rows) store.put(row, keyOf(row.lang, row.book, row.chapter));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
}

async function chapterRows(lang: LangId, book: string): Promise<OfflineChapter[]> {
  const doc = await loadBook(book);
  const grid = lang === "en" ? null : await loadParallel(lang, book);
  if (lang !== "en" && !grid) throw new Error("That language is not in this book.");
  const at = Date.now();
  return doc.chapters.map((verses, index) => ({
    lang,
    book,
    chapter: index + 1,
    at,
    verses: verses.map((verse, verseIndex) => ({
      v: verse.v,
      text: lang === "en" ? verse.en || "" : grid?.[index]?.[verseIndex] || "",
    })),
  }));
}

export async function copyChapter(lang: LangId, book: string, chapter: number) {
  const name = BOOKS.find((item) => item.id === book)?.name ?? "This book";
  claim({ lang, kind: "chapter", done: 0, total: 1, label: name });
  try {
    const rows = await chapterRows(lang, book);
    const row = rows[chapter - 1];
    if (!row) throw new Error("That chapter is not in this book.");
    await writeChapters([row]);
  } finally {
    setJob(null);
  }
}

export async function copyBook(lang: LangId, book: string) {
  const name = BOOKS.find((item) => item.id === book)?.name ?? "This book";
  claim({ lang, kind: "book", done: 0, total: 1, label: name });
  try {
    await writeChapters(await chapterRows(lang, book));
  } finally {
    setJob(null);
  }
}

export async function copyInjeel(lang: LangId) {
  claim({ lang, kind: "all", done: 0, total: BOOKS.length, label: BOOKS[0]?.name ?? "Injeel" });
  try {
    for (let index = 0; index < BOOKS.length; index += 1) {
      const book = BOOKS[index];
      setJob({ lang, kind: "all", done: index, total: BOOKS.length, label: book.name });
      await writeChapters(await chapterRows(lang, book.id));
    }
  } finally {
    setJob(null);
  }
}

export async function removeOffline(lang: string, book?: string, chapter?: number) {
  const db = await database();
  const rows = await listOffline();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const row of rows) {
      if (row.lang !== lang) continue;
      if (book && row.book !== book) continue;
      if (chapter && row.chapter !== chapter) continue;
      store.delete(keyOf(row.lang, row.book, row.chapter));
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
}

export type OfflineBook = { id: string; name: string; chapters: number[]; total: number; all: boolean };

export type OfflineLanguage = { lang: string; whole: boolean; books: OfflineBook[] };

/** Group stored chapters into books, and mark a language whole when every chapter is present. */
export function summarizeOffline(rows: OfflinePlace[]): OfflineLanguage[] {
  const byLang = new Map<string, Map<string, number[]>>();
  for (const row of rows) {
    const books = byLang.get(row.lang) ?? new Map<string, number[]>();
    const chapters = books.get(row.book) ?? [];
    chapters.push(row.chapter);
    books.set(row.book, chapters);
    byLang.set(row.lang, books);
  }
  return [...byLang.entries()].map(([lang, books]) => {
    const listed = BOOKS.map((book) => {
      const chapters = [...new Set(books.get(book.id) ?? [])].sort((a, b) => a - b);
      const total = chapterCount(book.id);
      return { id: book.id, name: book.name, chapters, total, all: total > 0 && chapters.length === total };
    }).filter((book) => book.chapters.length > 0);
    return { lang, whole: listed.length === BOOKS.length && listed.every((book) => book.all), books: listed };
  });
}

export function chapterPhrase(chapters: number[], total: number, all: boolean) {
  if (all) return total === 1 ? "1 chapter" : `${total} chapters`;
  const sorted = [...new Set(chapters)].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return "no chapters";
  if (sorted.length === 1) return `chapter ${sorted[0]}`;
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let index = 1; index <= sorted.length; index += 1) {
    const n = sorted[index];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  return `chapters ${parts.join(", ")}`;
}

export function copyingSentence(current: CopyJob) {
  if (current.kind === "all") return `Copying ${current.label} · ${current.done + 1} of ${current.total}.`;
  if (current.kind === "book") return `Copying ${current.label}.`;
  return "Copying this chapter.";
}

type LoadedVerse = { v: number; sy: string; en: string };

/** Prefer the book when it opened. Otherwise use the language stored on this device. */
export function versesFromDevice<T extends LoadedVerse>(loaded: T[] | null, copy: OfflineChapter | null, lang: string) {
  if (loaded) return { verses: loaded, deviceOnly: false as const };
  if (!copy) return { verses: null, deviceOnly: false as const };
  return {
    deviceOnly: true as const,
    verses: copy.verses.map((row) => ({ v: row.v, sy: "", en: lang === "en" ? row.text : "" })),
  };
}
