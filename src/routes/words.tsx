import { Modal } from "@/components/modal";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Studio } from "@/components/studio";
import { BOOKS } from "@/data/edition";
import { RED_BOOKS, englishPhrases, foreignSpeech, nextRedBook, speechOf, speechRanges, syriacPhrases, type RedBook } from "@/lib/jesus";
import { LANGS, languageById, type LangId } from "@/lib/languages";
import { loadBook, loadParallel, type BookFile, type Verse } from "@/lib/scripture";
import { cleanEnglish, sayingLines } from "@/lib/speak";
import { SITE_ORIGIN } from "@/lib/site";
import { NameText, SyriacNames } from "@/components/name-text";
import { shareCard, verseShare } from "@/lib/share";
import { usePrefs } from "@/lib/use-prefs";
import { readingReadFrom, useBindReadingSurface } from "@/lib/reading-surface";

export const Route = createFileRoute("/words")({
  loader: () => loadBook("matthew"),
  head: () => ({
    meta: [
      { title: "Words of Y'shua — Injeel" },
      {
        name: "description",
        content: "The words Y'shua spoke, in red. Classical Syriac beside a modern reading, read aloud on this device.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/words` }],
  }),
  component: Words,
});

type Saying = { chapter: number; verse: Verse; index: number };
type Heard = { book: string; chapter: number; verse: number };

function readingFace(id: LangId) {
  const language = languageById(id);
  const face =
    language.face === "syriac"
      ? "font-syriac text-2xl leading-normal"
      : language.face === "arab"
        ? "font-arab text-xl leading-relaxed"
        : language.face === "hebrew"
          ? "font-hebrew text-xl leading-relaxed"
          : language.face === "greek"
            ? "font-greek text-lg leading-relaxed"
            : language.face === "cyrl"
              ? "font-cyr text-lg leading-relaxed"
              : "font-serif text-lg leading-relaxed";
  return { dir: language.dir, face, code: language.face === "syriac" ? "syr" : language.id };
}

function lineText(lang: LangId, verse: Verse, grid: string[][] | null, chapter: number, index: number) {
  if (lang === "en") return verse.en;
  return grid?.[chapter - 1]?.[index] ?? "";
}

function Words() {
  const { prefs, patch } = usePrefs();
  const [book, setBook] = useState<RedBook>("matthew");
  const initialBook = Route.useLoaderData();
  const [otherBook, setDoc] = useState<BookFile | null>(null);
  const doc = book === initialBook.id ? initialBook : otherBook?.id === book ? otherBook : null;
  const [parallel, setParallel] = useState<string[][] | null>(null);
  const [parallel2, setParallel2] = useState<string[][] | null>(null);
  const [err, setErr] = useState("");
  const [shared, setShared] = useState("");
  const [heard, setHeard] = useState<Heard | null>(null);
  const [focusKey, setFocusKey] = useState("");
  const [reading, setReading] = useState(false);
  const [studio, setStudio] = useState(false);
  const [picked, setPicked] = useState("");
  const meta = BOOKS.find((item) => item.id === book);
  const tongue = languageById(prefs.lang);
  const second = prefs.lang2 !== "none" ? languageById(prefs.lang2) : null;

  useEffect(() => {
    let live = true;
    setDoc(null);
    setErr("");
    if (book === initialBook.id) return;
    loadBook(book)
      .then((next) => {
        if (live) setDoc(next);
      })
      .catch(() => {
        if (live) setErr("This book did not open.");
      });
    return () => {
      live = false;
    };
  }, [book, initialBook.id]);

  useEffect(() => {
    let live = true;
    setParallel(null);
    if (prefs.lang === "en") return;
    loadParallel(prefs.lang, book)
      .then((next) => {
        if (live) setParallel(next);
      })
      .catch(() => {
        if (live) setParallel(null);
      });
    return () => {
      live = false;
    };
  }, [book, prefs.lang]);

  useEffect(() => {
    let live = true;
    setParallel2(null);
    if (prefs.lang2 === "none" || prefs.lang2 === "en") return;
    loadParallel(prefs.lang2, book)
      .then((next) => {
        if (live) setParallel2(next);
      })
      .catch(() => {
        if (live) setParallel2(null);
      });
    return () => {
      live = false;
    };
  }, [book, prefs.lang2]);

  useEffect(() => {
    setFocusKey("");
  }, [book]);

  const sayings: Saying[] = [];
  doc?.chapters.forEach((chapter, index) => {
    chapter.forEach((verse, verseIndex) => {
      const speech = speechOf(book, index + 1, verse.v);
      if ((verse.sy || verse.en) && speech) {
        sayings.push({ chapter: index + 1, verse, index: verseIndex });
      }
    });
  });

  useEffect(() => {
    if (!heard || heard.book !== book) return;
    const el = document.getElementById(`w-${heard.chapter}-${heard.verse}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (rect.top < 96 || rect.bottom > window.innerHeight - 150) {
      el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }
  }, [heard, doc, book]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("article[data-saying]"));
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const key = (hit?.target as HTMLElement | undefined)?.dataset.saying;
        if (key) setFocusKey(key);
      },
      { rootMargin: "-15% 0px -60% 0px" },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [doc, book, prefs.lang, prefs.lang2]);

  useBindReadingSurface({
    book,
    chapter: 1,
    voice: prefs.voice === "rex" ? "rex" : "ara",
    deviceVoice: prefs.deviceVoice,
    speed: prefs.speed,
    lang: tongue.id,
    startKey: focusKey,
    fromLabel: focusKey ? `From ${focusKey}` : "",
    kind: "words",
    loadLines: (place, lang) => sayingLines(place.book, lang),
    nextPlaceOf: (place) => {
      const next = nextRedBook(place.book);
      return next ? { book: next, chapter: 1 } : null;
    },
    onVoice: (voice) => patch({ voice }),
    onDeviceVoice: (deviceVoice) => patch({ deviceVoice }),
    onSpeed: (speed) => patch({ speed }),
    onVerse: () => {},
    onHeard: (line) => {
      setHeard((prev) => {
        if (!line) return null;
        if (prev && prev.book === line.book && prev.chapter === line.chapter && prev.verse === line.verse) return prev;
        return line;
      });
    },
    onAdvance: (place) => setBook(place.book as RedBook),
  });

  function passageFor(key: string) {
    const saying = sayings.find((item) => `${item.chapter}:${item.verse.v}` === key) ?? sayings[0];
    if (!saying) return "";
    const speech = speechOf(book, saying.chapter, saying.verse.v);
    const phrases = englishPhrases(book, saying.chapter, saying.verse.v, saying.verse.en);
    const line = lineText(tongue.id, saying.verse, parallel, saying.chapter, saying.index) || saying.verse.en;
    const text =
      tongue.id === "en"
        ? phrases?.join(" ") || saying.verse.en
        : (speech?.kind === "whole" && phrases && foreignSpeech(line, tongue.id)) || line;
    return cleanEnglish(text);
  }

  function openStudio() {
    const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    const key = heard && heard.book === book ? `${heard.chapter}:${heard.verse}` : focusKey;
    setPicked(selected || picked || passageFor(key));
    setReading(false);
    setStudio(true);
  }

  const pending = prefs.lang !== "en" && !parallel;
  const pending2 = prefs.lang2 !== "none" && prefs.lang2 !== "en" && !parallel2;

  return (
    <main className="mx-auto min-h-app max-w-3xl bg-paper px-5 pt-safe pb-player text-ink">
      <div className="pt-6">
        <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
          All books
        </Link>
        <p className="mt-6 font-syriac text-4xl text-syriac" lang="syr" dir="rtl">
          {meta?.sy}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">Words of Y'shua</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-muted">
          The words in red, in the order this book keeps them. Hear them on this device, or open a line in the studio.
        </p>
        {doc && <p className="mt-2 text-xs tracking-widest text-gold">{sayings.length} SAYINGS</p>}
        <div className="toolbar-scroll mt-4 flex gap-1 overflow-x-auto border-b border-line">
          {RED_BOOKS.map((id) => {
            const item = BOOKS.find((entry) => entry.id === id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={book === id}
                onClick={() => setBook(id)}
                className={`min-h-11 shrink-0 px-3 ${book === id ? "text-garnet" : "text-muted"}`}
              >
                {item?.name ?? id}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setReading(true)}
          className="flex min-h-11 w-full items-center truncate border-b border-line text-left text-sm text-muted"
        >
          {["Reading", tongue.label, second ? second.label : ""].filter(Boolean).join(" · ")}
        </button>
        {err && <p className="mt-6 text-garnet">{err}</p>}
        {!doc && !err && <p className="mt-6 text-muted">Opening the words…</p>}
        <div className="mt-2">
          {sayings.map(({ chapter, verse, index }, position) => {
            const showChapter = position === 0 || sayings[position - 1].chapter !== chapter;
            const key = `${chapter}:${verse.v}`;
            const listening = heard?.book === book && heard.chapter === chapter && heard.verse === verse.v;
            const speech = speechOf(book, chapter, verse.v);
            const phrases = englishPhrases(book, chapter, verse.v, verse.en);
            const ownWords = phrases?.join(" ") ?? "";
            const solid = speech?.kind === "whole" && !phrases;
            const mainLine = lineText(tongue.id, verse, parallel, chapter, index);
            const mainCut = tongue.id !== "en" && speech?.kind === "whole" && phrases ? foreignSpeech(mainLine, tongue.id) : null;
            const primary = tongue.id === "en" ? (phrases ? ownWords : mainLine) : (mainCut ?? mainLine);
            const sideLine = second
              ? lineText(second.id, verse, second.id === "en" ? null : parallel2, chapter, index)
              : "";
            const sideCut = second && second.id !== "en" && speech?.kind === "whole" && phrases ? foreignSpeech(sideLine, second.id) : null;
            const extra = second ? (second.id === "en" ? (phrases ? ownWords : sideLine) : (sideCut ?? sideLine)) : "";
            const mainRed = tongue.id === "en" ? solid || !!phrases : solid || !!mainCut;
            const sideRed = !second ? false : second.id === "en" ? solid || !!phrases : solid || !!sideCut;
            const syMark = syriacPhrases(book, chapter, verse.v, verse.sy || "", verse.en);
            const syRanges = syMark && verse.sy ? speechRanges(verse.sy, syMark.say, syMark.which) : null;
            const syRed = speech?.kind === "whole" && !syRanges;
            const mainFace = readingFace(tongue.id);
            const sideFace = second ? readingFace(second.id) : null;
            return (
              <article
                key={key}
                id={`w-${chapter}-${verse.v}`}
                data-saying={key}
                aria-current={listening ? "true" : undefined}
                className={`border-b border-line py-4 ${listening ? "bg-gold-soft -mx-5 px-5" : ""}`}
              >
                {showChapter && <p className="mb-2 text-xs tracking-widest text-gold">CHAPTER {chapter}</p>}
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to="/read/$book/$chapter"
                    params={{ book, chapter: String(chapter) }}
                    hash={`v-${verse.v}`}
                    className="text-sm text-gold"
                  >
                    {meta?.name} {chapter}:{verse.v}
                  </Link>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      className="min-h-11 px-2 text-sm text-garnet"
                      onClick={() => {
                        const lines = [verse.sy, primary, extra].filter((line) => Boolean(line && line.trim()));
                        void shareCard(
                          verseShare({ bookName: meta?.name ?? "Reading", book, chapter, verse: verse.v, lines }),
                        ).then((result) => {
                          if (result === "copied" || result === "shared") {
                            setShared(key);
                            window.setTimeout(() => setShared(""), 1200);
                          }
                        });
                      }}
                    >
                      {shared === key ? "Sent" : "Share"}
                    </button>
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center text-garnet"
                      aria-label={`Read ${meta?.name ?? "this book"} ${chapter}:${verse.v}`}
                      onClick={() => {
                        setFocusKey(key);
                        readingReadFrom(key);
                      }}
                    >
                      <Play className="size-4" />
                    </button>
                  </div>
                </div>
                {verse.sy && (
                  <p dir="rtl" lang="syr" className={`mt-2 font-syriac text-2xl leading-normal ${syRed ? "text-jesus" : "text-syriac"}`}>
                    <SyriacNames text={verse.sy} english={verse.en} ranges={syRanges} />
                  </p>
                )}
                {speech?.kind === "part" && tongue.id !== "en" && (
                  <p className="mt-2 font-serif leading-relaxed text-jesus">{ownWords}</p>
                )}
                {pending && position === 0 && <p className="mt-2 text-muted">Opening this language…</p>}
                {!pending && (primary || sideFace) && (
                  <div className={sideFace ? "mt-2 grid gap-4 md:grid-cols-2" : ""}>
                    {primary && (
                      <p dir={mainFace.dir} lang={mainFace.code} className={`mt-2 leading-relaxed ${mainRed ? "text-jesus" : "text-ink"} ${mainFace.face}`}>
                        {tongue.id === "en" ? <NameText text={primary} /> : primary}
                      </p>
                    )}
                    {sideFace && (extra || (pending2 && position === 0)) && (
                      <p dir={sideFace.dir} lang={sideFace.code} className={`mt-2 leading-relaxed ${pending2 ? "text-muted" : `${sideRed ? "text-jesus" : "text-ink"} ${sideFace.face}`}`}>
                        {pending2 ? "Opening this language…" : second?.id === "en" ? <NameText text={extra} /> : extra}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
      <Studio open={studio} passage={picked} onClose={() => setStudio(false)} />
      {reading && (
        <Modal label="Reading" className="fixed inset-0 z-40 flex items-end bg-scrim" onClose={() => setReading(false)}>
          <div
            className="max-h-sheet w-full overflow-y-auto border-t border-line bg-paper px-5 py-5 pb-safe"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-serif text-lg">Reading</h2>
                <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => setReading(false)}>
                  Close
                </button>
              </div>
              <p className="text-xs tracking-widest text-gold">LANGUAGE</p>
              <div className="mt-1 flex flex-wrap">
                {LANGS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={prefs.lang === item.id}
                    onClick={() => patch({ lang: item.id === prefs.lang2 ? prefs.lang : item.id, lang2: item.id === prefs.lang2 ? "none" : prefs.lang2 })}
                    className={`min-h-11 px-3 ${prefs.lang === item.id ? "text-garnet" : "text-muted"} ${item.face === "syriac" ? "font-syriac text-lg" : item.face === "arab" ? "font-arab text-lg" : item.face === "hebrew" ? "font-hebrew text-lg" : item.face === "greek" ? "font-greek" : item.face === "cyrl" ? "font-cyr" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs tracking-widest text-gold">ALSO</p>
              <div className="mt-1 flex flex-wrap">
                <button
                  type="button"
                  aria-pressed={prefs.lang2 === "none"}
                  onClick={() => patch({ lang2: "none" })}
                  className={`min-h-11 px-3 ${prefs.lang2 === "none" ? "text-garnet" : "text-muted"}`}
                >
                  None
                </button>
                {LANGS.filter((item) => item.id !== prefs.lang).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={prefs.lang2 === item.id}
                    onClick={() => patch({ lang2: item.id })}
                    className={`min-h-11 px-3 ${prefs.lang2 === item.id ? "text-garnet" : "text-muted"} ${item.face === "syriac" ? "font-syriac text-lg" : item.face === "arab" ? "font-arab text-lg" : item.face === "hebrew" ? "font-hebrew text-lg" : item.face === "greek" ? "font-greek" : item.face === "cyrl" ? "font-cyr" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-xs tracking-widest text-gold">PREMIUM</p>
              <button type="button" className="mt-1 min-h-11 text-left text-sm text-muted" onClick={openStudio}>
                Studio · AI voice and images
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
