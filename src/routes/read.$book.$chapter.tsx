import { WordStudySheet } from "@/components/word-study";
import { Modal } from "@/components/modal";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchPanel } from "@/components/search-panel";
import { Studio } from "@/components/studio";
import { BookLinks } from "@/components/book-links";
import { VerseView } from "@/components/verse-view";
import { BOOKS, SECTIONS, bookMeta } from "@/data/edition";
import { LANGS, languageById } from "@/lib/languages";
import {
  TERM_NOTES,
  chapterCount,
  loadBook,
  loadParallel,
  studyWord,
  type WordGloss,
  type WordPlace,
  type WordStudy,
} from "@/lib/scripture";
import { usePrefs } from "@/lib/use-prefs";
import { useAnnotations } from "@/lib/annotations";
import { SITE_ORIGIN } from "@/lib/site";
import { noteChapter } from "@/lib/readings";
import { parseReaderChapter } from "@/lib/reader-reference";
import { useBindReadingSurface } from "@/lib/reading-surface";

export const Route = createFileRoute("/read/$book/$chapter")({
  loader: async ({ params }) => {
    if (parseReaderChapter(params.chapter, chapterCount(params.book)) === null) {
      throw notFound();
    }
    const doc = await loadBook(params.book);
    return { verses: doc.chapters[Number(params.chapter) - 1] };
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
  const { verses } = Route.useLoaderData();
  const [parallel, setParallel] = useState<string[][] | null>(null);
  const [parallel2, setParallel2] = useState<string[][] | null>(null);
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; roman: string; body: string } | { study: WordStudy } | null>(null);
  const [heard, setHeard] = useState<number | null>(null);
  const [studio, setStudio] = useState(false);
  const [picked, setPicked] = useState("");
  const [focus, setFocus] = useState(1);
  const [reading, setReading] = useState(false);

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
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (rect.top < 160 || rect.bottom > window.innerHeight - 32) {
      el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }
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
      <header className="sticky top-0 z-20 border-b border-line bg-paper pt-safe">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-2 py-1">
          <button type="button" className="flex size-11 items-center justify-center" aria-label="Books" onClick={() => setMenu(true)}>
            <Menu className="size-5" />
          </button>
          <Link to="/" className="min-w-0 text-center">
            <span className="block truncate font-serif text-lg leading-tight">{meta?.name ?? "Peshitta"}</span>
            <span className="block text-xs text-gold">Chapter {chapterNo || "—"}</span>
          </Link>
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
        <div className="toolbar-scroll mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
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
      </header>

      <main className={`mx-auto px-4 pb-player ${prefs.lang2 === "none" ? "max-w-3xl" : "max-w-5xl"}`}>
        <div className="flex items-stretch border-b border-line">
          <button
            type="button"
            onClick={() => setReading(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center truncate text-left text-sm text-muted"
          >
            {[
              "Reading",
              languageById(prefs.lang).label,
              prefs.lang2 !== "none" ? languageById(prefs.lang2).label : "",
              prefs.face === "sy" ? "Peshitta" : prefs.face === "both" ? "Both" : "",
              prefs.words ? "Words" : "",
            ].filter(Boolean).join(" · ")}
          </button>
          <Link to="/guide" hash="reading" className="flex min-h-11 shrink-0 items-center px-2 text-sm text-garnet">
            Guide
          </Link>
        </div>

        {verses?.map((verse, verseIndex) => (
          <VerseView
            key={verse.v}
            book={book}
            chapter={chapterNo}
            verse={verse}
            words={prefs.words}
            face={prefs.face}
            lang={languageById(prefs.lang).id}
            parallel={prefs.lang === "en" ? verse.en : (parallel?.[chapterNo - 1]?.[verseIndex] ?? "")}
            pending={prefs.lang !== "en" && !parallel}
            size={prefs.size}
            line={prefs.line}
            showNotes={prefs.notes}
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
            parallel2={prefs.lang2 === "none" ? "" : prefs.lang2 === "en" ? verse.en : (parallel2?.[chapterNo - 1]?.[verseIndex] ?? "")}
            pending2={prefs.lang2 !== "none" && prefs.lang2 !== "en" && !parallel2}
          />
        ))}

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
            <Link
              to="/guide"
              hash="reading"
              className="mb-3 flex min-h-11 w-full items-center border-b border-line text-garnet"
              onClick={() => setMenu(false)}
            >
              Guide
            </Link>
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
                      className={`flex min-h-11 items-center justify-between border-b border-line py-1 ${here ? "text-garnet" : ""}`}
                    >
                      <span>{item.name}</span>
                      <span className="font-syriac text-syriac" lang="syr" dir="rtl">{item.sy}</span>
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

      <SearchPanel open={search} onClose={() => setSearch(false)} />
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
              <p className="text-xs tracking-widest text-gold">PAGE</p>
              <div className="mt-1 flex flex-wrap">
                <FaceButton label="Both" active={prefs.face === "both"} onClick={() => patch({ face: "both" })} />
                <FaceButton label="Peshitta" active={prefs.face === "sy"} onClick={() => patch({ face: "sy" })} />
                <FaceButton label={languageById(prefs.lang).label} active={prefs.face === "tr"} onClick={() => patch({ face: "tr" })} />
                <FaceButton label="Words" active={prefs.words} onClick={() => patch({ words: !prefs.words })} />
                <FaceButton label="Notes" active={prefs.notes} onClick={() => patch({ notes: !prefs.notes })} />
                <button type="button" className="flex size-11 items-center justify-center" aria-label="Smaller type" onClick={() => patch({ size: Math.max(0, prefs.size - 1) as 0 | 1 | 2 | 3 | 4 })}>
                  A−
                </button>
                <button type="button" className="flex size-11 items-center justify-center text-lg" aria-label="Larger type" onClick={() => patch({ size: Math.min(4, prefs.size + 1) as 0 | 1 | 2 | 3 | 4 })}>
                  A+
                </button>
                <button type="button" className="flex size-11 items-center justify-center" aria-label="Tighter lines" onClick={() => patch({ line: Math.max(0, prefs.line - 1) as 0 | 1 | 2 })}>
                  ≡
                </button>
                <button type="button" className="flex size-11 items-center justify-center" aria-label="Looser lines" onClick={() => patch({ line: Math.min(2, prefs.line + 1) as 0 | 1 | 2 })}>
                  ≡+
                </button>
              </div>
              <p className="mt-4 text-xs tracking-widest text-gold">LANGUAGE</p>
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
              <button
                type="button"
                className="mt-1 min-h-11 text-left text-sm text-muted"
                onClick={() => {
                  setReading(false);
                  const selected = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
                  setPicked(selected || picked || verses?.[0]?.en || "");
                  setStudio(true);
                }}
              >
                Studio · AI voice and images
              </button>
              <Link to="/guide" hash="reading" className="mt-2 inline-flex min-h-11 items-center text-garnet" onClick={() => setReading(false)}>
                Guide to these controls
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FaceButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 px-3 ${active ? "text-garnet" : "text-muted"}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
