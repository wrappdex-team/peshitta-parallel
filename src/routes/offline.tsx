import { SiteHeader } from "@/components/site-header";
import { languageById } from "@/lib/languages";
import { chapterPhrase, copyingSentence, removeOffline, summarizeOffline } from "@/lib/offline";
import { SITE_ORIGIN } from "@/lib/site";
import { useOfflineLibrary } from "@/lib/use-offline";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Offline — Injeel" },
      { name: "robots", content: "noindex, follow" },
      {
        name: "description",
        content: "A chapter, a book, or the New Testament in one language, stored in this browser.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/offline` }],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  const { rows, ready, job } = useOfflineLibrary();
  const languages = summarizeOffline(rows);

  return (
    <div className="min-h-app bg-paper text-ink">
      <SiteHeader title="Offline" mark="offline" />
      <main className="mx-auto max-w-3xl px-5 pb-page sm:px-8">
        <p className="mt-6 max-w-prose text-base leading-relaxed">
          A copy stays in this browser, in the language you chose. It is not an account, and it does not include the Syriac. Open a chapter to read it.
        </p>
        {job ? <p className="mt-6 text-base leading-relaxed">{copyingSentence(job)}</p> : null}
        {!ready ? <p className="mt-6 text-muted">Opening this device…</p> : null}
        {ready && languages.length === 0 && !job ? (
          <p className="mt-6 text-base leading-relaxed">
            Nothing is on this device yet. Open a chapter, then Language, and copy a chapter, a book, or the whole Injeel.
          </p>
        ) : null}
        {languages.map((language) => {
          const name = languageById(language.lang).label;
          const locked = job?.lang === language.lang;
          return (
            <section key={language.lang} className="mt-8">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl">{name}</h2>
                <button
                  type="button"
                  className="min-h-11 text-sm text-garnet disabled:opacity-40"
                  disabled={!!locked}
                  aria-label={`Remove ${name}`}
                  onClick={() => void removeOffline(language.lang)}
                >
                  Remove {name}
                </button>
              </div>
              {language.whole ? <p className="mt-1 text-sm text-muted">The whole Injeel.</p> : null}
              <ul className="mt-2 border-t border-line">
                {language.books.map((book) => {
                  const place = book.chapters[0] ?? 1;
                  return (
                    <li key={book.id} className="flex items-center justify-between gap-3 border-b border-line">
                      <Link to="/read/$book/$chapter" params={{ book: book.id, chapter: String(place) }} className="min-w-0 py-3">
                        <span className="block font-serif text-lg">{book.name}</span>
                        <span className="block text-sm text-muted">{chapterPhrase(book.chapters, book.total, book.all)}</span>
                      </Link>
                      <button
                        type="button"
                        className="min-h-11 shrink-0 px-2 text-sm text-garnet disabled:opacity-40"
                        disabled={!!locked}
                        aria-label={`Remove ${book.name}`}
                        onClick={() => void removeOffline(language.lang, book.id)}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
