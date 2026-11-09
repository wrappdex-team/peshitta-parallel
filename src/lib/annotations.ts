import { useEffect, useState } from "react";

export type Highlight = "gold" | "garnet" | "ink";

export type Annotation = {
  highlight?: Highlight;
  note?: string;
  bookmark?: boolean;
  updated: number;
};

export type Annotations = Record<string, Annotation>;

const KEY = "injeel-annotations";

function keyOf(book: string, chapter: number, verse: number) {
  return `${book}.${chapter}.${verse}`;
}

function read(): Annotations {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Annotations;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(data: Annotations) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function useAnnotations() {
  const [data, setData] = useState<Annotations>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(read());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    write(data);
  }, [data, ready]);

  function get(book: string, chapter: number, verse: number) {
    return data[keyOf(book, chapter, verse)];
  }

  function patch(book: string, chapter: number, verse: number, partial: Partial<Annotation>) {
    const k = keyOf(book, chapter, verse);
    setData((prev) => {
      const current = prev[k] ?? { updated: 0 };
      const next = { ...current, ...partial, updated: Date.now() };
      if (!next.highlight && !next.note && !next.bookmark) {
        const { [k]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [k]: next };
    });
  }

  function toggleHighlight(book: string, chapter: number, verse: number) {
    const current = get(book, chapter, verse)?.highlight;
    const next: Highlight | undefined = current === "gold" ? "garnet" : current === "garnet" ? "ink" : current === "ink" ? undefined : "gold";
    patch(book, chapter, verse, { highlight: next });
  }

  function setNote(book: string, chapter: number, verse: number, note: string) {
    const trimmed = note.trim();
    patch(book, chapter, verse, { note: trimmed || undefined });
  }

  function toggleBookmark(book: string, chapter: number, verse: number) {
    const current = !!get(book, chapter, verse)?.bookmark;
    patch(book, chapter, verse, { bookmark: !current });
  }

  function exportJson() {
    return JSON.stringify(data, null, 2);
  }

  function importJson(raw: string) {
    try {
      const parsed = JSON.parse(raw) as Annotations;
      if (!parsed || typeof parsed !== "object") return false;
      setData(parsed);
      return true;
    } catch {
      return false;
    }
  }

  function list() {
    return Object.entries(data)
      .map(([key, value]) => {
        const [book, chapter, verse] = key.split(".");
        return { book, chapter: Number(chapter), verse: Number(verse), ...value };
      })
      .sort((a, b) => b.updated - a.updated);
  }

  return { ready, get, toggleHighlight, setNote, toggleBookmark, exportJson, importJson, list };
}
