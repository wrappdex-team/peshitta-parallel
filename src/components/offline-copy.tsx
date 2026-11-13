import { InfoMark } from "@/components/info-mark";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { languageById } from "@/lib/languages";
import { chapterPhrase, copyBook, copyChapter, copyInjeel, copyingSentence, summarizeOffline } from "@/lib/offline";
import { useOfflineLibrary } from "@/lib/use-offline";
import { usePrefs } from "@/lib/use-prefs";

export function OfflineCopy({ book, chapter, bookName }: { book: string; chapter?: number; bookName: string }) {
  const { prefs } = usePrefs();
  const { rows, job } = useOfflineLibrary();
  const [error, setError] = useState("");
  const language = languageById(prefs.lang);
  const summary = summarizeOffline(rows).find((item) => item.lang === prefs.lang);
  const heldBook = summary?.books.find((item) => item.id === book);
  const bookHeld = !!heldBook?.all;
  const whole = !!summary?.whole;
  const held =
    whole
      ? `The whole Injeel is on this device in ${language.label}.`
      : bookHeld
        ? `${bookName} is on this device in ${language.label}.`
        : heldBook
          ? `${bookName} ${chapterPhrase(heldBook.chapters, heldBook.total, false)} ${heldBook.chapters.length === 1 ? "is" : "are"} on this device in ${language.label}.`
          : `Nothing from ${bookName} is on this device in ${language.label} yet.`;

  async function run(kind: "chapter" | "book" | "all") {
    if (job) return;
    setError("");
    try {
      if (kind === "chapter" && chapter) await copyChapter(prefs.lang, book, chapter);
      else if (kind === "book") await copyBook(prefs.lang, book);
      else await copyInjeel(prefs.lang);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (message === "A copy is already running.") return;
      setError("The copy did not finish. Stay on this page and try again.");
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-1">
        <p className="text-xs tracking-widest text-gold">OFFLINE</p>
        <InfoMark id="offline" />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        A copy of {language.label} only. It stays in this browser. The Syriac is not copied.
      </p>
      <div className="mt-1 flex flex-wrap">
        {chapter ? (
          <button type="button" className="min-h-11 px-3 text-left" disabled={!!job} onClick={() => void run("chapter")}>
            {job?.kind === "chapter" ? "Copying…" : "Copy this chapter"}
          </button>
        ) : null}
        <button type="button" className="min-h-11 px-3 text-left" disabled={!!job} onClick={() => void run("book")}>
          {job?.kind === "book" ? "Copying…" : `Copy ${bookName}`}
        </button>
        <button type="button" className="min-h-11 px-3 text-left" disabled={!!job} onClick={() => void run("all")}>
          {job?.kind === "all" ? "Copying…" : "Copy the whole Injeel"}
        </button>
      </div>
      <p className="mt-1 text-sm leading-relaxed">{job ? copyingSentence(job) : held}</p>
      {error ? <p className="mt-1 text-sm text-garnet">{error}</p> : null}
      <Link to="/offline" className="inline-flex min-h-11 items-center text-sm text-garnet">
        What is on this device
      </Link>
    </div>
  );
}
