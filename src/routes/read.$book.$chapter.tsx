import { Modal } from "@/components/modal";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { StudioHost } from "@/studio/host";
import { openStudio, useStudioEnabled } from "@/studio/prefs";
import { BookTitle, bookLabel } from "@/components/book-name";
import { BookLinks } from "@/components/book-links";
import { HelpSwitch } from "@/components/info-mark";
import { SiteHeader } from "@/components/site-header";
import { BOOKS, SECTIONS, bookMeta } from "@/data/edition";
import { languageById } from "@/lib/languages";
import {
  TERM_NOTES,
  chapterCount,
  loadBook,
  loadLexicon,
  studyWord,
  type WordGloss,
  type WordPlace,
  type WordStudy,
} from "@/lib/scripture";
import type { WordToken } from "@/lib/word-data";
import { useOfflineChapter } from "@/lib/use-offline";
import { versesFromDevice } from "@/lib/offline";
import { requestReadingIntro, usePrefs } from "@/lib/use-prefs";
import { useParallelText } from "@/lib/use-parallel";
import { useAnnotations } from "@/lib/annotations";
import { SITE_ORIGIN } from "@/lib/site";
import { noteChapter } from "@/lib/readings";
import { parseReaderChapter } from "@/lib/reader-reference";
import { scrollLineToTop } from "@/lib/scroll-line";
import { useBindReadingSurface } from "@/lib/reading-surface";
import { ReadingTongue } from "@/components/reading-tongue";
import { ReadingSheet, readingLabel } from "@/components/reading-sheet";

const VerseView = lazy(() => import("@/components/verse-view").then((mod) => ({ default: mod.VerseView })));
const WordStudySheet = lazy(() => import("@/components/word-study").then((mod) => ({ default: mod.WordStudySheet })));

/** `?name=keefa` comes from a /names verse link: mark that card in the #v-N verse. */
function readSearch(search: Record<string, unknown>): { name?: string } {
  const name = typeof search.name === "string" && /^[a-z0-9-]{1,48}$/.test(search.name) ? search.name : undefined;
  return name ? { name } : {};
}

export const Route = createFileRoute("/read/$book/$chapter")({
  validateSearch: readSearch,
  loader: async ({ params }) => {
    if (parseReaderChapter(params.chapter, chapterCount(params.book)) === null) {
      throw notFound();
    }
    try {
      const [doc] = await Promise.all([loadBook(params.book), loadLexicon()]);
      return { verses: doc.chapters[Number(params.chapter) - 1] ?? [] };
    } catch {
      return { verses: null };
    }
  },
  notFoundComponent: ReaderNotFound,
  head: ({ params }) => {
    if (parseReaderChapter(params.chapter, chapterCount(params.book)) === null) {
      return {
        meta: [
          { title: "Reading not found — Injeel" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const name = bookMeta(params.book)?.name ?? "Reading";
    return {
      meta: [
        { title: `${name} ${params.chapter} — Injeel` },
        {
          name: "description",
          content: `${name} ${params.chapter}. Classical Syriac of the Peshitta beside a modern reading.`,
        },
      ],
      links: [{ rel: "canonical", href: `${SITE_ORIGIN}/read/${params.book}/${params.chapter}` }],
    };
  },
  component: Reader,
});

function ReaderNotFound() {
  return (
    <main className="mx-auto min-h-app max-w-3xl bg-paper px-5 pt-safe pb-page text-ink">
      <h1 className="pt-6 font-serif text-3xl">Reading not found</h1>
      <p className="mt-3">That book or chapter is not in this edition.</p>
      <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-garnet">
        All books
      </Link>
    </main>
  );
}

function Reader() {
  const { book, chapter } = Route.useParams();
  // The root route passes raw params through, so check the value here too.
  const markId = readSearch(Route.useSearch()).name;
  const chapterNo = Number(chapter);
  const navigate = useNavigate();
  const { prefs, patch } = usePrefs();
  const annotations = useAnnotations();
  const meta = bookMeta(book);
  const { verses: loaded } = Route.useLoaderData();
  const primaryCopy = useOfflineChapter(prefs.lang, book, chapterNo);
  const secondCopy = useOfflineChapter(prefs.lang2 === "none" ? "none" : prefs.lang2, book, chapterNo);
  const offline = primaryCopy.row;
  const offline2 = secondCopy.row;
  const view = versesFromDevice(loaded, offline, prefs.lang);
  const verses = view.verses;
  const deviceOnly = view.deviceOnly;
  const primary = useParallelText(prefs.lang, book);
  const secondary = useParallelText(prefs.lang2, book);
  const parallel = primary.rows;
  const parallel2 = secondary.rows;
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; roman: string; body: string } | { study: WordStudy; word?: { token: WordToken; book: string } } | null>(null);
  const [heard, setHeard] = useState<number | null>(null);
  const studioOn = useStudioEnabled();
  const [focus, setFocus] = useState(1);
  const [reading, setReading] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const studioAt = (v: number, wholeChapter = false) => {
    const list = (verses ?? []).map((row) => ({ v: row.v, en: row.en || "", sy: row.sy || undefined }));
    if (!list.length) return;
    const last = list[list.length - 1].v;
    openStudio({ book, bookName: meta?.name ?? book, chapter: chapterNo, verses: list, from: wholeChapter ? list[0].v : v, to: wholeChapter ? last : v });
  };

  useEffect(() => {
    if (!meta || !Number.isFinite(chapterNo) || chapterNo < 1) return;
    patch({ last: { book, chapter: chapterNo, verse: focus } });
    // patch identity changes every render; the place only needs this location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapterNo, focus]);

  useEffect(() => {
    const marked = window.location.hash.match(/^#v-(\d+)$/);
    setFocus(marked ? Number(marked[1]) : 1);
  }, [book, chapterNo]);

  useEffect(() => {
    const marked = markId ? window.location.hash.match(/^#v-(\d+)$/) : null;
    setTarget(marked ? Number(marked[1]) : null);
  }, [book, chapterNo, markId]);

  useEffect(() => {
    if (target == null || !verses) return;
    let cancel = false;
    let frame = 0;
    const place = (left: number) => {
      if (cancel) return;
      const el = document.getElementById(`v-${target}`);
      if (el) scrollLineToTop(el);
      else if (left > 0) frame = window.requestAnimationFrame(() => place(left - 1));
    };
    // After the plain #v-N jump below, so the verse lands under the sticky header and tongue.
    frame = window.requestAnimationFrame(() => place(120));
    void document.fonts.ready.then(() => window.requestAnimationFrame(() => place(0)));
    return () => {
      cancel = true;
      window.cancelAnimationFrame(frame);
    };
  }, [target, verses]);

  useEffect(() => {
    if (heard == null) return;
    setFocus(heard);
    const el = document.getElementById(`v-${heard}`);
    if (el) scrollLineToTop(el);
  }, [heard]);

  const total = chapterCount(book);

  useEffect(() => {
    if (!verses?.length) return;
    const node = document.querySelector("[data-chapter-end]");
    if (!(node instanceof HTMLElement)) return;
    let noted = false;
    const reached = () => {
      if (noted) return;
      const rect = node.getBoundingClientRect();
      const lineShown = rect.top <= window.innerHeight - 80 && rect.bottom >= 0;
      const atEnd = document.documentElement.scrollHeight - window.scrollY - window.innerHeight <= 120;
      if (!lineShown && !atEnd) return;
      noted = true;
      noteChapter(book, chapterNo);
    };
    const observer = new IntersectionObserver(reached, { threshold: 0, rootMargin: "0px 0px -80px 0px" });
    observer.observe(node);
    const resize = new ResizeObserver(reached);
    resize.observe(document.documentElement);
    window.addEventListener("scroll", reached, { passive: true });
    reached();
    return () => {
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", reached);
    };
  }, [book, chapterNo, verses]);
  const index = BOOKS.findIndex((b) => b.id === book);
  const prev = chapterNo > 1 ? { book, chapter: chapterNo - 1 } : index > 0 ? { book: BOOKS[index - 1].id, chapter: chapterCount(BOOKS[index - 1].id) } : null;
  const next = chapterNo < total ? { book, chapter: chapterNo + 1 } : index >= 0 && index < BOOKS.length - 1 ? { book: BOOKS[index + 1].id, chapter: 1 } : null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") go(prev);
      else if (event.key === "ArrowRight") go(next);
      else if (event.key === "=" || event.key === "+") patch({ size: Math.min(4, prefs.size + 1) as 0 | 1 | 2 | 3 | 4 });
      else if (event.key === "-" || event.key === "_") patch({ size: Math.max(0, prefs.size - 1) as 0 | 1 | 2 | 3 | 4 });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, prefs.size, patch]);

  useEffect(() => {
    if (!verses) return;
    const marked = window.location.hash.match(/^#v-(\d+)$/);
    if (marked) document.getElementById(`v-${marked[1]}`)?.scrollIntoView({ block: "start" });
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("article[id^='v-']"));
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!hit) return;
        const verse = Number(hit.target.id.slice(2));
        const first = nodes[0];
        const stillAtTop = first.getBoundingClientRect().top > -8;
        if (stillAtTop) {
          const opening = Number(first.id.slice(2));
          if (opening) setFocus(opening);
          return;
        }
        if (verse) setFocus(verse);
      },
      { rootMargin: "-35% 0px -50% 0px" },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [verses, book, chapterNo]);

  function go(target: { book: string; chapter: number } | null) {
    if (!target) return;
    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    void navigate({
      to: "/read/$book/$chapter",
      params: { book: target.book, chapter: String(target.chapter) },
      hash: "",
    });
    window.scrollTo(0, 0);
  }

  function onWord(_info: WordGloss | null, surface: string, place?: WordPlace, token?: WordToken) {
    setSheet({
      study: studyWord(surface, place),
      ...(token && place ? { word: { token, book: place.book } } : {}),
    });
  }

  function onTerm(key: string) {
    const note = TERM_NOTES[key];
    if (!note) return;
    setSheet({ title: note.title, roman: "", body: note.body });
  }

  useBindReadingSurface(verses ? {
    book,
    chapter: chapterNo,
    voice: prefs.voice === "rex" ? "rex" : "ara",
    deviceVoice: prefs.deviceVoice,
    speed: prefs.speed,
    lang: languageById(prefs.lang).id,
    fromVerse: focus,
    onVoice: (voice) => patch({ voice }),
    onDeviceVoice: (deviceVoice) => patch({ deviceVoice }),
    onSpeed: (speed) => patch({ speed }),
    onVerse: setHeard,
    onAdvance: (place) => go(place),
    onChapter: (place) => noteChapter(place.book, place.chapter),
  } : null);

  return (
    <div className="min-h-app bg-paper text-ink">
      <SiteHeader
        title={meta?.name ?? "Peshitta"}
        subtitle={`Chapter ${chapterNo || "—"}`}
        wide={prefs.lang2 !== "none"}
        onBooks={() => setMenu(true)}
        book={book}
        onStudio={studioOn ? () => studioAt(focus) : undefined}
      >
        <div className="toolbar-scroll flex gap-1 overflow-x-auto px-3 pb-2">
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1;
            const current = n === chapterNo;
            return (
              <Link
                key={n}
                to="/read/$book/$chapter"
                params={{ book, chapter: String(n) }}
                className={`flex size-11 shrink-0 items-center justify-center text-sm ${current ? "bg-garnet text-paper" : "text-muted"}`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      </SiteHeader>

      <main className={`mx-auto px-4 pb-[calc(14rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-10 ${prefs.lang2 === "none" ? "max-w-3xl" : "max-w-6xl"}`}>
        <ReadingTongue
          label={readingLabel(prefs.lang, prefs.lang2, prefs.face)}
          pulse={heard ?? 0}
          stickyTop="calc(env(safe-area-inset-top, 0px) + 7.5rem)"
          onClick={() => setReading(true)}
        />
        {deviceOnly ? (
          <p className="mb-2 text-sm leading-relaxed text-muted">
            Reading the {languageById(prefs.lang).label} copy on this device. The Syriac is not in it.
          </p>
        ) : null}
        {!verses && !primaryCopy.ready ? <p className="mt-6 text-muted">Opening the copy on this device…</p> : null}
        {!verses && primaryCopy.ready ? (
          <p className="mt-6 text-base leading-relaxed">
            This chapter is not on this device. Open it while you are connected, then copy it from Language.
          </p>
        ) : null}

        <Suspense fallback={null}>
        {verses?.map((verse, verseIndex) => {
          const copied = offline?.verses.find((row) => row.v === verse.v)?.text ?? "";
          const copied2 = offline2?.verses.find((row) => row.v === verse.v)?.text ?? "";
          const net = parallel?.[chapterNo - 1]?.[verseIndex] ?? "";
          const net2 = parallel2?.[chapterNo - 1]?.[verseIndex] ?? "";
          return (
          <VerseView
            key={verse.v}
            book={book}
            chapter={chapterNo}
            verse={verse}
            words={prefs.words}
            face={deviceOnly ? "tr" : prefs.face}
            lang={languageById(prefs.lang).id}
            parallel={prefs.lang === "en" ? verse.en : net || copied}
            pending={prefs.lang !== "en" && primary.pending && !copied}
            size={prefs.size}
            line={prefs.line}
            showNotes={prefs.notes && !deviceOnly}
            annotation={annotations.get(book, chapterNo, verse.v)}
            onHighlight={() => annotations.toggleHighlight(book, chapterNo, verse.v)}
            onNote={(note) => annotations.setNote(book, chapterNo, verse.v, note)}
            onBookmark={() => annotations.toggleBookmark(book, chapterNo, verse.v)}
            onWord={onWord}
            onTerm={onTerm}
            listening={heard === verse.v}
            chapterEnd={verseIndex === verses.length - 1}
            bookName={meta?.name ?? book}
            lang2={prefs.lang2}
            parallel2={prefs.lang2 === "none" ? "" : prefs.lang2 === "en" ? verse.en : net2 || copied2}
            pending2={prefs.lang2 !== "none" && prefs.lang2 !== "en" && secondary.pending && !copied2}
            nameMark={target === verse.v ? markId : undefined}
            onStudio={studioOn ? () => studioAt(verse.v) : undefined}
          />
          );
        })}
        </Suspense>

        {prefs.notes && chapterNo === 1 && meta?.blurb && (
          <p className="mt-6 text-sm leading-relaxed text-muted">{meta.blurb}</p>
        )}
        {book === "matthew" && chapterNo === 28 && (
          <p className="mt-6 text-sm leading-relaxed text-muted">
            The tomb is empty. The <Link to="/study" className="text-garnet">Injeel</Link> is open.
          </p>
        )}

        <nav className="mt-4 flex items-center justify-between">
          <button type="button" disabled={!prev} onClick={() => go(prev)} className="flex min-h-11 items-center gap-1 disabled:opacity-40">
            <ChevronLeft className="size-5" />
            Previous
          </button>
          <button type="button" disabled={!next} onClick={() => go(next)} className="flex min-h-11 items-center gap-1 disabled:opacity-40">
            Next
            <ChevronRight className="size-5" />
          </button>
        </nav>
      </main>
      <StudioHost />

      {menu && (
        <Modal label="Books" className="fixed inset-0 z-30 flex bg-scrim" onClose={() => setMenu(false)}>
          <nav className="book-drawer" onClick={(event) => event.stopPropagation()} aria-label="Books">
            <div className="book-drawer-bar">
              <h2 className="font-serif text-lg">New Testament</h2>
              <button type="button" className="inline-flex size-11 items-center justify-center text-sm text-garnet" onClick={() => setMenu(false)}>
                Close
              </button>
            </div>
            <button
              type="button"
              className="mb-3 flex min-h-11 w-full items-center text-left text-garnet"
              onClick={() => {
                setMenu(false);
                requestReadingIntro();
              }}
            >
              Choose how you read
            </button>
            <HelpSwitch />
            {SECTIONS.map((section) => (
              <div key={section} className="mb-4">
                <p className="text-xs text-gold">{section}</p>
                {BOOKS.filter((b) => b.section === section).map((item) => {
                  const here = item.id === book;
                  return (
                    <Link
                      key={item.id}
                      to="/read/$book/$chapter"
                      params={{ book: item.id, chapter: String(here ? chapterNo : 1) }}
                      hash={here && focus > 1 ? `v-${focus}` : undefined}
                      onClick={() => setMenu(false)}
                      aria-label={bookLabel(item.name, item.say)}
                      className={`block min-h-11 border-b border-line py-1 ${here ? "text-garnet" : ""}`}
                    >
                      <BookTitle name={item.name} say={item.say} sy={item.sy} nameClass="font-serif" />
                    </Link>
                  );
                })}
              </div>
            ))}
            <BookLinks onDone={() => setMenu(false)} />
          </nav>
        </Modal>
      )}

      {sheet && (
        <Modal label={"study" in sheet ? "Word" : sheet.title} className="fixed inset-0 z-30 flex items-end bg-scrim" onClose={() => setSheet(null)}>
          <div
            className="max-h-sheet w-full overflow-y-auto border-t border-line bg-paper px-5 py-5 pb-safe"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl">
              {"study" in sheet ? (
                <Suspense fallback={null}>
                <WordStudySheet
                  study={sheet.study}
                  word={sheet.word}
                  langs={[languageById(prefs.lang).id, ...(prefs.lang2 !== "none" ? [languageById(prefs.lang2).id] : [])]}
                  onPick={(surface) => setSheet({ study: studyWord(surface) })}
                />
                </Suspense>
              ) : (
                <>
                  <p
                    tabIndex={-1}
                    data-modal-initial
                    className={/[\u0700-\u074F]/.test(sheet.title) ? "font-syriac text-3xl text-syriac" : "font-serif text-2xl"}
                    lang={/[\u0700-\u074F]/.test(sheet.title) ? "syr" : "en"}
                    dir={/[\u0700-\u074F]/.test(sheet.title) ? "rtl" : "ltr"}
                  >
                    {sheet.title}
                  </p>
                  {sheet.roman && <p className="mt-1 text-sm text-gold">{sheet.roman}</p>}
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

      <ReadingSheet
        open={reading}
        onClose={() => setReading(false)}
        book={book}
        chapter={chapterNo}
        bookName={meta?.name ?? book}
        onStudio={() => {
          setReading(false);
          studioAt(focus);
        }}
      />
    </div>
  );
}
