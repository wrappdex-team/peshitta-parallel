import { WordStudySheet } from "@/components/word-study";
import { Modal } from "@/components/modal";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Studio } from "@/components/studio";
import { BookTitle, bookLabel } from "@/components/book-name";
import { BookLinks } from "@/components/book-links";
import { HelpSwitch } from "@/components/info-mark";
import { VerseView } from "@/components/verse-view";
import { SiteHeader } from "@/components/site-header";
import { BOOKS, SECTIONS, bookMeta } from "@/data/edition";
import { languageById } from "@/lib/languages";
import {
  TERM_NOTES,
  chapterCount,
  loadBook,
  studyWord,
  type WordGloss,
  type WordPlace,
  type WordStudy,
} from "@/lib/scripture";
import { useOfflineChapter } from "@/lib/use-offline";
import { versesFromDevice } from "@/lib/offline";
import { usePrefs } from "@/lib/use-prefs";
import { useParallelText } from "@/lib/use-parallel";
import { useAnnotations } from "@/lib/annotations";
import { SITE_ORIGIN } from "@/lib/site";
import { noteChapter } from "@/lib/readings";
import { parseReaderChapter } from "@/lib/reader-reference";
import { scrollLineToTop } from "@/lib/scroll-line";
import { useBindReadingSurface } from "@/lib/reading-surface";
import { ReadingTongue } from "@/components/reading-tongue";
import { ReadingSheet, readingLabel } from "@/components/reading-sheet";

export const Route = createFileRoute("/read/$book/$chapter")({
  loader: async ({ params }) => {
    if (parseReaderChapter(params.chapter, chapterCount(params.book)) === null) {
      throw notFound();
    }
    try {
      const doc = await loadBook(params.book);
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
  const [sheet, setSheet] = useState<{ title: string; roman: string; body: string } | { study: WordStudy } | null>(null);
  const [heard, setHeard] = useState<number | null>(null);
  const [studio, setStudio] = useState(false);
  const [picked, setPicked] = useState("");
  const [focus, setFocus] = useState(1);
  const [reading, setReading] = useState(false);

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

  function onWord(_info: WordGloss | null, surface: string, place?: WordPlace) {
    setSheet({ study: studyWord(surface, place) });
  }

  function onTerm(key: string) {
    const note = TERM_NOTES[key];
    if (!note) return;
    setSheet({ title: note.title, roman: "", body: note.body });
  }

  useBindReadingSurface({
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
  });

  return (
    <div className="min-h-app bg-paper text-ink">
      <SiteHeader
        title={meta?.name ?? "Peshitta"}
        subtitle={`Chapter ${chapterNo || "—"}`}
        wide={prefs.lang2 !== "none"}
        onBooks={() => setMenu(true)}
        book={book}
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
          />
          );
        })}

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
      <Studio
        open={studio}
        passage={picked}
        onClose={() => setStudio(false)}
      />

      {menu && (
        <Modal label="Books" className="fixed inset-0 z-30 flex bg-scrim" onClose={() => setMenu(false)}>
          <nav className="h-full w-80 max-w-[85%] overflow-y-auto bg-paper p-4 pt-safe pb-safe" onClick={(event) => event.stopPropagation()} aria-label="Books">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg">New Testament</h2>
              <button type="button" className="min-h-11 px-2 text-sm text-garnet" onClick={() => setMenu(false)}>
                Close
              </button>
            </div>
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
            <button
              type="button"
              className="mt-2 block min-h-11 text-left text-sm text-muted"
              onClick={() => {
                setMenu(false);
                const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
                setPicked(selected || picked || verses?.[0]?.en || "");
                setStudio(true);
              }}
            >
              Studio · premium
            </button>
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
                <WordStudySheet
                  study={sheet.study}
                  langs={[languageById(prefs.lang).id, ...(prefs.lang2 !== "none" ? [languageById(prefs.lang2).id] : [])]}
                  onPick={(surface) => setSheet({ study: studyWord(surface) })}
                />
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
          const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
          setPicked(selected || picked || verses?.[0]?.en || "");
          setStudio(true);
        }}
      />
    </div>
  );
}
