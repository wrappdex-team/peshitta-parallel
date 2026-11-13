import { useEffect, useState } from "react";
import type { LangId } from "@/lib/languages";
import {
  copyJob,
  listOffline,
  readOfflineChapter,
  subscribeOffline,
  type CopyJob,
  type OfflineChapter,
  type OfflinePlace,
} from "@/lib/offline";

export function useOfflineLibrary() {
  const [rows, setRows] = useState<OfflinePlace[]>([]);
  const [ready, setReady] = useState(false);
  const [job, setJob] = useState<CopyJob | null>(null);

  useEffect(() => {
    let live = true;
    const pull = () => {
      if (live) setJob(copyJob());
      listOffline()
        .then((next) => {
          if (!live) return;
          setRows(next);
          setReady(true);
        })
        .catch(() => {
          if (live) setReady(true);
        });
    };
    pull();
    const stop = subscribeOffline(pull);
    return () => {
      live = false;
      stop();
    };
  }, []);

  return { rows, ready, job };
}

export function useOfflineChapter(lang: LangId | "none", book: string, chapter: number) {
  const [state, setState] = useState<{ lang: string; book: string; chapter: number; row: OfflineChapter | null; ready: boolean }>({
    lang,
    book,
    chapter,
    row: null,
    ready: lang === "none",
  });

  useEffect(() => {
    if (lang === "none") return;
    let live = true;
    const pull = () => {
      readOfflineChapter(lang, book, chapter)
        .then((next) => {
          if (live) setState({ lang, book, chapter, row: next, ready: true });
        })
        .catch(() => {
          if (live) setState({ lang, book, chapter, row: null, ready: true });
        });
    };
    pull();
    const stop = subscribeOffline(pull);
    return () => {
      live = false;
      stop();
    };
  }, [lang, book, chapter]);

  if (lang === "none") return { row: null, ready: true };
  if (state.lang !== lang || state.book !== book || state.chapter !== chapter) return { row: null, ready: false };
  return { row: state.row, ready: state.ready };
}
