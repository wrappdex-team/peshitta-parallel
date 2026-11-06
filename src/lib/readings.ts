import { useEffect, useState } from "react";
import { CATALOG, chapterCount } from "@/lib/scripture";

const KEY = "injeel-readings";

export type Counts = Record<string, number>;

/** Once through, then five, then every ten readings up to a hundred. */
export const SEAL_MARKS = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export function readCounts(): Counts {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, unknown>;
    const counts: Counts = {};
    for (const [key, value] of Object.entries(raw)) {
      const times = typeof value === "number" ? Math.floor(value) : 0;
      if (times > 0 && key.includes(":")) counts[key] = times;
    }
    return counts;
  } catch {
    return {};
  }
}

let lastKey = "";
let lastAt = 0;

/** Count a finished chapter. A second credit for the same chapter inside a few seconds is ignored. */
export function noteChapter(book: string, chapter: number) {
  if (!book || chapter < 1) return readCounts();
  const key = `${book}:${chapter}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 8000) return readCounts();
  lastKey = key;
  lastAt = now;
  const counts = readCounts();
  counts[key] = (counts[key] ?? 0) + 1;
  localStorage.setItem(KEY, JSON.stringify(counts));
  window.dispatchEvent(new Event("injeel-readings"));
  return counts;
}

export function useReadings() {
  const [counts, setCounts] = useState<Counts>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const pull = () => setCounts(readCounts());
    pull();
    setReady(true);
    window.addEventListener("injeel-readings", pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener("injeel-readings", pull);
      window.removeEventListener("storage", pull);
    };
  }, []);

  return { counts, ready };
}

export function chapterTimes(counts: Counts, book: string, chapter: number) {
  return counts[`${book}:${chapter}`] ?? 0;
}

export function bookProgress(counts: Counts, book: string) {
  const of = chapterCount(book);
  let times = of ? Infinity : 0;
  let ahead = 0;
  for (let chapter = 1; chapter <= of; chapter++) {
    const read = chapterTimes(counts, book, chapter);
    if (read < times) times = read;
  }
  if (!Number.isFinite(times)) times = 0;
  for (let chapter = 1; chapter <= of; chapter++) {
    if (chapterTimes(counts, book, chapter) > times) ahead += 1;
  }
  return { times, ahead, of };
}

export function testamentProgress(counts: Counts) {
  let chapters = 0;
  let touched = 0;
  let times = Infinity;
  for (const book of CATALOG) {
    chapters += book.chapters;
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      const read = chapterTimes(counts, book.id, chapter);
      if (read > 0) touched += 1;
      if (read < times) times = read;
    }
  }
  if (!Number.isFinite(times)) times = 0;
  let ahead = 0;
  for (const book of CATALOG) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      if (chapterTimes(counts, book.id, chapter) > times) ahead += 1;
    }
  }
  const percent = chapters ? Math.round((touched / chapters) * 100) : 0;
  const nextPercent = chapters ? Math.round((ahead / chapters) * 100) : 0;
  return { chapters, touched, times, ahead, percent, nextPercent };
}

export function sealEarned(times: number) {
  let earned = 0;
  for (const mark of SEAL_MARKS) {
    if (times >= mark) earned = mark;
  }
  return earned;
}

export function timesPhrase(times: number) {
  if (times <= 0) return "not yet";
  if (times === 1) return "once";
  if (times === 2) return "twice";
  return `${times} times`;
}
