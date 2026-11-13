import { WordStudySheet } from "@/components/word-study";
import { Modal } from "@/components/modal";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Studio } from "@/components/studio";
import { SearchPanel } from "@/components/search-panel";
import { VerseView } from "@/components/verse-view";
import { InfoMark } from "@/components/info-mark";
import { ReadingSheet, readingLabel } from "@/components/reading-sheet";
import { ReadingTongue } from "@/components/reading-tongue";
import { BOOKS } from "@/data/edition";
import { useAnnotations } from "@/lib/annotations";
import { RED_BOOKS, englishPhrases, foreignSpeech, nextRedBook, speechOf, type RedBook } from "@/lib/jesus";
import { languageById, type LangId } from "@/lib/languages";
import {
  TERM_NOTES,
  loadBook,
  loadParallel,
  studyWord,
  type BookFile,
  type Verse,
  type WordGloss,
  type WordPlace,
  type WordStudy,
} from "@/lib/scripture";
import { cleanEnglish, sayingLines } from "@/lib/speak";
import { SITE_ORIGIN } from "@/lib/site";
import { usePrefs } from "@/lib/use-prefs";
import { scrollLineToTop } from "@/lib/scroll-line";
import { useBindReadingSurface } from "@/lib/reading-surface";

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

function lineText(lang: LangId, verse: Verse, grid: string[][] | null, chapter: number, index: number) {
  if (lang === "en") return verse.en;
  return grid?.[chapter - 1]?.[index] ?? "";
}

function Words() {
  const { prefs, patch } = usePrefs();
  const annotations = useAnnotations();
  const [book, setBook] = useState<RedBook>("matthew");
  const initialBook = Route.useLoaderData();
  const [otherBook, setDoc] = useState<BookFile | null>(null);
  const doc = book === initialBook.id ? initialBook : otherBook?.id === book ? otherBook : null;
  const [parallel, setParallel] = useState<string[][] | null>(null);
  const [parallel2, setParallel2] = useState<string[][] | null>(null);
  const [err, setErr] = useState("");
  const [heard, setHeard] = useState<Heard | null>(null);
  const [focusKey, setFocusKey] = useState("");
  const [reading, setReading] = useState(false);
  const [studio, setStudio] = useState(false);
  const [picked, setPicked] = useState("");
  const [search, setSearch] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; roman: string; body: string } | { study: WordStudy } | null>(null);
  const meta = BOOKS.find((item) => item.id === book);
  const tongue = languageById(prefs.lang);
  const wide = prefs.lang2 !== "none";

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
    if (el) scrollLineToTop(el);
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
  }, [doc, book, prefs.lang, prefs.lang2, prefs.face]);

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

  function onWord(_info: WordGloss | null, surface: string, place?: WordPlace) {
    setSheet({ study: studyWord(surface, place) });
  }

  function onTerm(key: string) {
    const note = TERM_NOTES[key];
    if (!note) return;
    setSheet({ title: note.title, roman: "", body: note.body });
  }

  function openStudio() {
    const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    const key = heard && heard.book === book ? `${heard.chapter}:${heard.verse}` : focusKey;
    setPicked(selected || picked || passageFor(key));
    setReading(false);
    setStudio(true);
  }

  return (
    <div className="min-h-app bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper pt-safe">
        <div className={`mx-auto flex items-center justify-between px-2 py-1 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Link to="/" className="flex min-h-11 shrink-0 items-center px-2 text-sm text-garnet" aria-label="All books">
            Books
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="flex items-center justify-center gap-1 truncate font-serif text-lg leading-tight">
              Words of Y'shua
              <InfoMark id="red" />
            </h1>
            <span className="block text-xs text-gold">
              {meta?.name ?? "Gospel"}
              {doc ? ` · ${sayings.length}` : ""}
            </span>
          </div>
          <div className="flex">
            <button type="button" className="flex size-11 items-center justify-center" aria-label="Search" onClick={() => setSearch(true)}>
              <Search className="size-5" />
            </button>
            <button
              type="button"
              className="flex size-11 items-center justify-center"
              aria-label={prefs.theme === "night" ? "Day theme" : "Night theme"}
              onClick={() => patch({ theme: prefs.theme === "night" ? "day" : "night" })}
            >
              {prefs.theme === "night" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>
        <div className={`toolbar-scroll mx-auto flex gap-1 overflow-x-auto px-3 pb-2 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          {RED_BOOKS.map((id) => {
            const item = BOOKS.find((entry) => entry.id === id);
            const current = book === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={current}
                onClick={() => setBook(id)}
                className={`flex min-h-11 shrink-0 items-center px-3 text-sm ${current ? "bg-garnet text-paper" : "text-muted"}`}
              >
                {item?.name ?? id}
              </button>
            );
          })}
        </div>
      </header>

      <main className={`mx-auto px-4 pb-[calc(14rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
        <ReadingTongue
          label={readingLabel(prefs.lang, prefs.lang2, prefs.face)}
          pulse={heard ? heard.chapter * 1000 + heard.verse : 0}
          stickyTop="calc(env(safe-area-inset-top, 0px) + 7.5rem)"
          onClick={() => setReading(true)}
        />
        {err && <p className="mt-6 text-garnet">{err}</p>}
        {!doc && !err && <p className="mt-6 text-muted">Opening the words…</p>}
        {sayings.map(({ chapter, verse, index }, position) => {
          const showChapter = position === 0 || sayings[position - 1].chapter !== chapter;
          const key = `${chapter}:${verse.v}`;
          const listening = heard?.book === book && heard.chapter === chapter && heard.verse === verse.v;
          return (
            <div key={key}>
              {showChapter && <p className="mb-1 mt-6 text-xs tracking-widest text-gold">CHAPTER {chapter}</p>}
              <VerseView
                book={book}
                bookName={meta?.name ?? book}
                chapter={chapter}
                verse={verse}
                words={prefs.words}
                face={prefs.face}
                lang={tongue.id}
                parallel={prefs.lang === "en" ? verse.en : (parallel?.[chapter - 1]?.[index] ?? "")}
                pending={prefs.lang !== "en" && !parallel}
                lang2={prefs.lang2}
                parallel2={prefs.lang2 === "none" ? "" : prefs.lang2 === "en" ? verse.en : (parallel2?.[chapter - 1]?.[index] ?? "")}
                pending2={prefs.lang2 !== "none" && prefs.lang2 !== "en" && !parallel2}
                size={prefs.size}
                line={prefs.line}
                showNotes={prefs.notes}
                annotation={annotations.get(book, chapter, verse.v)}
                onHighlight={() => annotations.toggleHighlight(book, chapter, verse.v)}
                onNote={(note) => annotations.setNote(book, chapter, verse.v, note)}
                onBookmark={() => annotations.toggleBookmark(book, chapter, verse.v)}
                onWord={onWord}
                onTerm={onTerm}
                listening={listening}
                anchor={`w-${chapter}-${verse.v}`}
                saying={key}
                cite={`${chapter}:${verse.v}`}
                guideMark={position === 0}
                markSpeech={false}
              />
            </div>
          );
        })}
      </main>

      <Studio open={studio} passage={picked} onClose={() => setStudio(false)} />
      <SearchPanel open={search} onClose={() => setSearch(false)} />
      <ReadingSheet open={reading} onClose={() => setReading(false)} onStudio={openStudio} />
      {sheet && (
        <Modal label={"study" in sheet ? "Word" : sheet.title} className="fixed inset-0 z-30 flex items-end bg-scrim" onClose={() => setSheet(null)}>
          <div
            className="max-h-sheet w-full overflow-y-auto border-t border-line bg-paper px-5 py-5 pb-safe"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl">
              {"study" in sheet ? (
                <WordStudySheet
                  study={sheet.study}
                  langs={[tongue.id, ...(prefs.lang2 !== "none" ? [languageById(prefs.lang2).id] : [])]}
                  onPick={(surface) => setSheet({ study: studyWord(surface) })}
                />
              ) : (
                <>
                  <p className="font-serif text-2xl">{sheet.title}</p>
                  <p className="mt-3 leading-relaxed">{sheet.body}</p>
                </>
              )}
              <button type="button" className="mt-4 min-h-11 text-garnet" onClick={() => setSheet(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
