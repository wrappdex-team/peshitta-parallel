import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { BOOKS, SECTIONS } from "@/data/edition";
import { SearchPanel } from "@/components/search-panel";
import { TOTAL_VERSES, chapterCount } from "@/lib/scripture";
import { usePrefs } from "@/lib/use-prefs";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { prefs, patch } = usePrefs();
  const [search, setSearch] = useState(false);
  const [open, setOpen] = useState(false);
  const last = prefs.last;
  const lastBook = BOOKS.find((b) => b.id === last?.book);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper px-4 py-3">
        <button type="button" className="flex min-h-11 items-center gap-2" onClick={() => setOpen(true)} aria-label="Books">
          <Menu className="size-5" />
          <span className="font-serif text-sm">Books</span>
        </button>
        <p className="font-syriac text-xl text-syriac" lang="syr" dir="rtl">
          ܦܫܝܛܬܐ
        </p>
        <div className="flex items-center">
          <button type="button" className="flex size-11 items-center justify-center" onClick={() => setSearch(true)} aria-label="Search">
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
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        <p className="font-syriac text-4xl text-syriac" lang="syr" dir="rtl">
          ܦܫܝܛܬܐ
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Peshitta Parallel</h1>
        <p className="mt-2 font-serif text-xl text-garnet">The New Testament, word for word.</p>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Classical Syriac of the 1905 Peshitta, beside James Murdock’s literal English of 1851. {TOTAL_VERSES.toLocaleString()} verses.
          His footnotes are marked Murdock. Notes on the Aramaic are marked Study.
        </p>

        {last && lastBook && (
          <Link
            to="/read/$book/$chapter"
            params={{ book: last.book, chapter: String(last.chapter) }}
            className="mt-6 flex min-h-11 items-center justify-between border border-line bg-raised px-4 py-3"
          >
            <span>
              <span className="block text-xs text-gold">Continue</span>
              <span className="font-serif text-lg">
                {lastBook.name} {last.chapter}
              </span>
            </span>
            <span className="font-syriac text-2xl text-syriac" lang="syr" dir="rtl">
              {lastBook.sy}
            </span>
          </Link>
        )}

        <div className="mt-8 flex gap-4 text-sm">
          <Link to="/study" className="text-garnet">
            How to read this edition
          </Link>
          <button type="button" className="text-garnet" onClick={() => setSearch(true)}>
            Search
          </button>
        </div>

        {SECTIONS.map((section) => (
          <section key={section} className="mt-10">
            <h2 className="text-xs tracking-widest text-gold">{section.toUpperCase()}</h2>
            <ul className="mt-2 border-t border-line">
              {BOOKS.filter((b) => b.section === section).map((book) => (
                <li key={book.id} className="border-b border-line">
                  <Link
                    to="/read/$book/$chapter"
                    params={{ book: book.id, chapter: "1" }}
                    className="flex min-h-14 items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-serif text-lg">{book.name}</span>
                      <span className="block text-sm text-muted">
                        {chapterCount(book.id)} chapters
                        {book.later ? " · later Syriac" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-syriac text-2xl text-syriac" lang="syr" dir="rtl">
                      {book.sy}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {open && <BookDrawer onClose={() => setOpen(false)} />}
      <SearchPanel open={search} onClose={() => setSearch(false)} />
    </div>
  );
}

function BookDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex bg-scrim" onClick={onClose}>
      <nav
        className="h-full w-80 max-w-[85%] overflow-y-auto bg-paper p-4"
        onClick={(event) => event.stopPropagation()}
        aria-label="Books of the New Testament"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">New Testament</h2>
          <button type="button" className="min-h-11 px-2 text-sm text-garnet" onClick={onClose}>
            Close
          </button>
        </div>
        {SECTIONS.map((section) => (
          <div key={section} className="mb-4">
            <p className="text-xs text-gold">{section}</p>
            {BOOKS.filter((b) => b.section === section).map((book) => (
              <Link
                key={book.id}
                to="/read/$book/$chapter"
                params={{ book: book.id, chapter: "1" }}
                onClick={onClose}
                className="flex min-h-11 items-center justify-between border-b border-line py-1"
              >
                <span>{book.name}</span>
                <span className="font-syriac text-syriac" lang="syr" dir="rtl">
                  {book.sy}
                </span>
              </Link>
            ))}
          </div>
        ))}
        <Link to="/study" onClick={onClose} className="mt-2 inline-flex min-h-11 items-center text-garnet">
          About this edition
        </Link>
      </nav>
    </div>
  );
}
