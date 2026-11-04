import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { ReadAloud } from "@/components/read-aloud";
import { SearchPanel } from "@/components/search-panel";
import { VerseView } from "@/components/verse-view";
import { BOOKS, SECTIONS, bookMeta } from "@/data/edition";
import {
  TERM_NOTES,
  chapterCount,
  loadBook,
  type BookFile,
  type WordGloss,
} from "@/lib/scripture";
import { usePrefs } from "@/lib/use-prefs";

export const Route = createFileRoute("/read/$book/$chapter")({
  component: Reader,
});

function Reader() {
  const { book, chapter } = Route.useParams();
  const chapterNo = Number(chapter);
  const navigate = useNavigate();
  const { prefs, patch } = usePrefs();
  const meta = bookMeta(book);
  const [doc, setDoc] = useState<BookFile | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; roman: string; body: string } | null>(null);
  const [heard, setHeard] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setErr("");
    setDoc(null);
    loadBook(book)
      .then((next) => {
        if (live) setDoc(next);
      })
      .catch((error: unknown) => {
        if (live) setErr(error instanceof Error ? error.message : "This book did not open.");
      });
    return () => {
      live = false;
    };
  }, [book]);

  useEffect(() => {
    if (!meta || !Number.isFinite(chapterNo) || chapterNo < 1) return;
    patch({ last: { book, chapter: chapterNo } });
    // patch identity changes every render; last-read only needs the location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapterNo]);

  useEffect(() => {
    setHeard(null);
  }, [book, chapterNo]);

  useEffect(() => {
    if (heard == null) return;
    const el = document.getElementById(`v-${heard}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (rect.top < 160 || rect.bottom > window.innerHeight - 32) {
      el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }
  }, [heard]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || !doc) return;
    document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, [doc, book, chapterNo]);

  const total = chapterCount(book);
  const verses = doc?.chapters[chapterNo - 1];
  const index = BOOKS.findIndex((b) => b.id === book);
  const prev = chapterNo > 1 ? { book, chapter: chapterNo - 1 } : index > 0 ? { book: BOOKS[index - 1].id, chapter: chapterCount(BOOKS[index - 1].id) } : null;
  const next = chapterNo < total ? { book, chapter: chapterNo + 1 } : index >= 0 && index < BOOKS.length - 1 ? { book: BOOKS[index + 1].id, chapter: 1 } : null;

  function go(target: { book: string; chapter: number } | null) {
    if (!target) return;
    void navigate({
      to: "/read/$book/$chapter",
      params: { book: target.book, chapter: String(target.chapter) },
    });
    window.scrollTo(0, 0);
  }

  function onWord(info: WordGloss | null, surface: string) {
    if (!info) {
      setSheet({
        title: surface,
        roman: "",
        body: "This form is not in the study lexicon. The English sentence above is still Murdock’s literal rendering of the whole verse.",
      });
      return;
    }
    setSheet({
      title: surface,
      roman: info.roman,
      body: [info.gloss, info.via, info.note].filter(Boolean).join(" "),
    });
  }

  function onTerm(key: string) {
    const note = TERM_NOTES[key];
    if (!note) return;
    setSheet({ title: note.title, roman: "", body: note.body });
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
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
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
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

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <div className="flex flex-wrap items-center gap-2 border-b border-line py-3 text-sm">
          <FaceButton label="Both" active={prefs.face === "both"} onClick={() => patch({ face: "both" })} />
          <FaceButton label="Aramaic" active={prefs.face === "sy"} onClick={() => patch({ face: "sy" })} />
          <FaceButton label="English" active={prefs.face === "en"} onClick={() => patch({ face: "en" })} />
          <FaceButton label="Words" active={prefs.words} onClick={() => patch({ words: !prefs.words })} />
          <FaceButton label="Notes" active={prefs.notes} onClick={() => patch({ notes: !prefs.notes })} />
          <span className="ml-auto flex items-center">
            <button type="button" className="flex size-11 items-center justify-center" aria-label="Smaller type" onClick={() => patch({ size: (Math.max(0, prefs.size - 1) as 0 | 1 | 2) })}>
              A
            </button>
            <button type="button" className="flex size-11 items-center justify-center text-lg" aria-label="Larger type" onClick={() => patch({ size: (Math.min(2, prefs.size + 1) as 0 | 1 | 2) })}>
              A
            </button>
          </span>
        </div>

        <ReadAloud
          book={book}
          chapter={chapterNo}
          voice={prefs.voice === "rex" ? "rex" : "ara"}
          onVoice={(voice) => patch({ voice })}
          onVerse={setHeard}
        />

        {meta?.later && chapterNo === 1 && (
          <p className="mt-4 border border-gold bg-gold-soft px-3 py-3 text-sm leading-relaxed text-ink">
            {meta.blurb}
          </p>
        )}
        {meta && !meta.later && chapterNo === 1 && (
          <p className="mt-4 text-sm leading-relaxed text-muted">{meta.blurb}</p>
        )}

        {err && <p className="mt-6 text-garnet">{err}</p>}
        {!doc && !err && <p className="mt-6 text-muted">Opening the chapter…</p>}
        {doc && !verses && <p className="mt-6 text-muted">That chapter is not in this book.</p>}
        {verses?.map((verse) => (
          <VerseView
            key={verse.v}
            book={book}
            chapter={chapterNo}
            verse={verse}
            words={prefs.words}
            face={prefs.face}
            size={prefs.size}
            showNotes={prefs.notes}
            onWord={onWord}
            onTerm={onTerm}
            listening={heard === verse.v}
          />
        ))}

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

      {menu && (
        <div className="fixed inset-0 z-30 flex bg-scrim" onClick={() => setMenu(false)}>
          <nav className="h-full w-80 max-w-[85%] overflow-y-auto bg-paper p-4" onClick={(event) => event.stopPropagation()} aria-label="Books">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg">New Testament</h2>
              <button type="button" className="min-h-11 px-2 text-sm text-garnet" onClick={() => setMenu(false)}>
                Close
              </button>
            </div>
            {SECTIONS.map((section) => (
              <div key={section} className="mb-4">
                <p className="text-xs text-gold">{section}</p>
                {BOOKS.filter((b) => b.section === section).map((item) => (
                  <Link
                    key={item.id}
                    to="/read/$book/$chapter"
                    params={{ book: item.id, chapter: "1" }}
                    onClick={() => setMenu(false)}
                    className={`flex min-h-11 items-center justify-between border-b border-line py-1 ${item.id === book ? "text-garnet" : ""}`}
                  >
                    <span>{item.name}</span>
                    <span className="font-syriac text-syriac" lang="syr" dir="rtl">{item.sy}</span>
                  </Link>
                ))}
              </div>
            ))}
            <Link to="/study" className="inline-flex min-h-11 items-center text-garnet" onClick={() => setMenu(false)}>
              About this edition
            </Link>
          </nav>
        </div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-30 flex items-end bg-scrim" onClick={() => setSheet(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full border-t border-line bg-paper px-5 py-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl">
              <p
                className={/[\u0700-\u074F]/.test(sheet.title) ? "font-syriac text-3xl text-syriac" : "font-serif text-2xl"}
                lang={/[\u0700-\u074F]/.test(sheet.title) ? "syr" : "en"}
                dir={/[\u0700-\u074F]/.test(sheet.title) ? "rtl" : "ltr"}
              >
                {sheet.title}
              </p>
              {sheet.roman && <p className="mt-1 text-sm text-gold">{sheet.roman}</p>}
              <p className="mt-3 leading-relaxed">{sheet.body}</p>
              <button type="button" className="mt-4 min-h-11 text-garnet" onClick={() => setSheet(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <SearchPanel open={search} onClose={() => setSearch(false)} />
    </div>
  );
}

function FaceButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 px-2 ${active ? "text-garnet" : "text-muted"}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
