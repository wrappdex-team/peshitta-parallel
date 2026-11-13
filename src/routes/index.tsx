import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BOOKS, SECTIONS } from "@/data/edition";
import { BookLinks } from "@/components/book-links";
import { HelpSwitch, InfoMark } from "@/components/info-mark";
import { SiteHeader, requestSearch } from "@/components/site-header";
import { chapterCount } from "@/lib/scripture";
import { bookProgress, testamentProgress, useReadings } from "@/lib/readings";
import { SITE_DESCRIPTION, SITE_ORIGIN } from "@/lib/site";
import { usePrefs } from "@/lib/use-prefs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Injeel — the Peshitta New Testament" },
      { name: "description", content: SITE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/` }],
  }),
  component: Home,
});

function Home() {
  const { prefs, ready } = usePrefs();
  const { counts, ready: readingsReady } = useReadings();
  const whole = testamentProgress(counts);
  const [open, setOpen] = useState(false);
  const last = prefs.last;
  const lastBook = BOOKS.find((b) => b.id === last?.book);
  const readingPercent = whole.times > 0 ? whole.nextPercent : whole.percent;

  return (
    <div className="min-h-app bg-paper text-ink">
      <SiteHeader title="Injeel" onBooks={() => setOpen(true)} />

      <main className="mx-auto max-w-3xl px-5 pb-page pt-10 sm:px-8 lg:max-w-4xl lg:px-12">
        <p className="font-syriac text-3xl text-syriac" lang="syr" dir="rtl">
          ܐܘܢܓܠܝܘܢ
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-1">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Injeel</h1>
          <InfoMark id="open" place="flow" />
        </div>
        <p className="mt-2 font-serif text-xl text-garnet">The words of Y'shua, kept.</p>

        {ready && (
          <Link
            to="/read/$book/$chapter"
            params={{ book: last?.book ?? "john", chapter: String(last?.chapter ?? 1) }}
            hash={last?.verse ? `v-${last.verse}` : undefined}
            className="mt-6 flex min-h-14 items-center justify-between border border-line bg-raised px-4 py-3"
          >
            <span>
              <span className="block text-xs text-gold">{last && lastBook ? "Continue" : "Open"}</span>
              <span className="font-serif text-lg">
                {last && lastBook ? `${lastBook.name} ${last.chapter}:${last.verse}` : "John 1"}
              </span>
            </span>
            <span className="font-syriac text-2xl text-syriac" lang="syr" dir="rtl">
              {(lastBook ?? BOOKS.find((item) => item.id === "john"))?.sy}
            </span>
          </Link>
        )}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/seal" className="inline-flex min-h-11 items-center text-garnet">
            Your reading{readingsReady ? ` · ${readingPercent}%` : ""}
          </Link>
          <Link to="/saved" className="inline-flex min-h-11 items-center text-garnet">
            Saved
          </Link>
          <Link to="/offline" className="inline-flex min-h-11 items-center text-garnet">
            Offline
          </Link>
          <Link to="/words" className="inline-flex min-h-11 items-center text-garnet">
            Words of Y'shua
          </Link>
          <Link to="/names" className="inline-flex min-h-11 items-center text-garnet">
            Names
          </Link>
          <Link to="/study" className="inline-flex min-h-11 items-center text-garnet">
            About this Injeel
          </Link>
          <button type="button" className="min-h-11 text-garnet" onClick={() => requestSearch()}>
            Search
          </button>
          <InstallButton />
          <Link to="/privacy" className="inline-flex min-h-11 items-center text-muted">
            Privacy
          </Link>
        </div>

        {SECTIONS.map((section) => (
          <section key={section} className="mt-10">
            <h2 className="text-xs tracking-widest text-gold">{section.toUpperCase()}</h2>
            <ul className="mt-2 border-t border-line">
              {BOOKS.filter((b) => b.section === section).map((book) => (
                <li key={book.id} className="border-b border-line">
                  <Link
                    to="/read/$book/$chapter"
                    params={{ book: book.id, chapter: last?.book === book.id ? String(last.chapter) : "1" }}
                    hash={last?.book === book.id && last.verse > 1 ? `v-${last.verse}` : undefined}
                    className="flex min-h-14 items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-serif text-lg">{book.name}</span>
                      <span className="block text-sm text-muted">
                        {readingsReady ? bookCaption(book.id, counts) : `${chapterCount(book.id)} chapters`}
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

      {open && <BookDrawer onClose={() => setOpen(false)} place={last} />}
    </div>
  );
}

type InstallPrompt = Event & { prompt: () => Promise<void> };

function bookCaption(id: string, counts: Parameters<typeof bookProgress>[0]) {
  const progress = bookProgress(counts, id);
  if (progress.times > 0 && progress.ahead === 0) {
    return `read ${progress.times === 1 ? "once" : progress.times === 2 ? "twice" : `${progress.times} times`}`;
  }
  if (progress.times > 0) {
    return `read ${progress.times === 1 ? "once" : progress.times === 2 ? "twice" : `${progress.times} times`} · chapter ${progress.open} still open`;
  }
  if (progress.ahead > 0) return `${progress.ahead} of ${progress.of} · chapter ${progress.open} still open`;
  return `${progress.of} chapters`;
}

function InstallButton() {
  const prompt = useRef<InstallPrompt | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    function onPrompt(event: Event) {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
      setReady(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!ready) return null;
  return (
    <button
      type="button"
      className="min-h-11 text-garnet"
      onClick={() => {
        void prompt.current?.prompt();
        setReady(false);
      }}
    >
      Install
    </button>
  );
}

function BookDrawer({ onClose, place }: { onClose: () => void; place?: { book: string; chapter: number; verse: number } }) {
  return (
    <div className="fixed inset-0 z-30 flex bg-scrim" onClick={onClose}>
      <nav
        className="h-full w-80 max-w-[85%] overflow-y-auto bg-paper p-4 pt-safe pb-safe"
        onClick={(event) => event.stopPropagation()}
        aria-label="Books of the New Testament"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">New Testament</h2>
          <button type="button" className="min-h-11 px-2 text-sm text-garnet" onClick={onClose}>
            Close
          </button>
        </div>
        <HelpSwitch />
        {SECTIONS.map((section) => (
          <div key={section} className="mb-4">
            <p className="text-xs text-gold">{section}</p>
            {BOOKS.filter((b) => b.section === section).map((book) => (
              <Link
                key={book.id}
                to="/read/$book/$chapter"
                params={{ book: book.id, chapter: place?.book === book.id ? String(place.chapter) : "1" }}
                hash={place?.book === book.id && place.verse > 1 ? `v-${place.verse}` : undefined}
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
        <BookLinks onDone={onClose} />
      </nav>
    </div>
  );
}
