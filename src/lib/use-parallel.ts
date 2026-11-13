import { useEffect, useState } from "react";
import type { LangId } from "@/lib/languages";
import { loadParallel } from "@/lib/scripture";

type Held = { lang: string; book: string; rows: string[][] | null };

/** The translation for this book. A change waits for its own text and never paints the previous language. */
export function useParallelText(lang: LangId | "none", book: string) {
  const [held, setHeld] = useState<Held | null>(null);

  useEffect(() => {
    if (lang === "none" || lang === "en") return;
    let live = true;
    loadParallel(lang, book)
      .then((rows) => {
        if (live) setHeld({ lang, book, rows });
      })
      .catch(() => {
        if (live) setHeld({ lang, book, rows: null });
      });
    return () => {
      live = false;
    };
  }, [lang, book]);

  if (lang === "en" || lang === "none") return { rows: null as string[][] | null, pending: false };
  if (!held || held.lang !== lang || held.book !== book) return { rows: null, pending: true };
  return { rows: held.rows, pending: false };
}
