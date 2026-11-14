import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, BookOpen, CloudOff, Library, Quote, Search } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from "react";
import { BOOKS, SECTIONS } from "@/data/edition";
import { BookTitle, bookLabel } from "@/components/book-name";
import { BookLinks } from "@/components/book-links";
import { HelpSwitch, InfoMark } from "@/components/info-mark";
import { Modal } from "@/components/modal";
import { SiteHeader, requestSearch } from "@/components/site-header";
import { useAnnotations } from "@/lib/annotations";
import { chapterCountLabel } from "@/lib/chapter-label";
import { summarizeOffline } from "@/lib/offline";
import { bookProgress, testamentProgress, useReadings } from "@/lib/readings";
import { chapterCount } from "@/lib/scripture";
import { SITE_DESCRIPTION, SITE_ORIGIN } from "@/lib/site";
import { requestReadingIntro, usePrefs } from "@/lib/use-prefs";
import { useOfflineLibrary } from "@/lib/use-offline";
import { versesIn } from "@/lib/verse-counts";

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

const TILE = "ink-row flex min-h-12 min-w-0 flex-col items-start justify-center gap-0.5 px-3 py-2 text-left";

function inkNode(target: EventTarget | null, selector: string) {
  const found = target instanceof Element ? target.closest(selector) : null;
  return found instanceof HTMLElement ? found : null;
}

function pressInk(event: PointerEvent<HTMLElement>) {
  const node = inkNode(event.target, ".ink-row, .ink-link, .ink-icon");
  if (event.type === "pointerdown") {
    if (!node) return;
    const box = node.getBoundingClientRect();
    node.style.setProperty("--ink-x", `${event.clientX - box.left}px`);
    node.style.setProperty("--ink-y", `${event.clientY - box.top}px`);
    node.dataset.pressed = "true";
    return;
  }
  if (event.type === "pointerout") {
    if (!node) return;
    const next = event.relatedTarget;
    if (next instanceof Node && node.contains(next)) return;
    delete node.dataset.pressed;
    return;
  }
  if (node) delete node.dataset.pressed;
  for (const pressed of event.currentTarget.querySelectorAll<HTMLElement>("[data-pressed]")) delete pressed.dataset.pressed;
}

function markRowBusy(event: MouseEvent<HTMLElement>) {
  const node = inkNode(event.target, ".ink-row");
  if (node) node.setAttribute("aria-busy", "true");
}

function Home() {
  const { prefs, ready } = usePrefs();
  const { counts, ready: readingsReady } = useReadings();
  const savedCount = useAnnotations().list().length;
  const { rows } = useOfflineLibrary();
  const whole = testamentProgress(counts);
  const pending = useRouterState({ select: (state) => state.status === "pending" });
  const [open, setOpen] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const last = prefs.last;
  const lastBook = BOOKS.find((b) => b.id === last?.book);
  const john = BOOKS.find((item) => item.id === "john");
  const returning = Boolean(last && lastBook);
  const readingPercent = whole.times > 0 ? whole.nextPercent : whole.percent;
  const verses = returning && last ? versesIn(last.book, last.chapter) : 0;
  const chapters = returning && last ? chapterCount(last.book) : 0;
  const percent = verses && last ? Math.round((last.verse / verses) * 100) : 0;
  const offlineBooks = summarizeOffline(rows).reduce((sum, language) => sum + language.books.length, 0);
  const offlineMeta = offlineBooks === 0 ? "Nothing on this device yet" : offlineBooks === 1 ? "1 book on this device" : `${offlineBooks} books on this device`;

  useEffect(() => {
    if (!pending) {
      setShowPending(false);
      return;
    }
    const timer = window.setTimeout(() => setShowPending(true), 150);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <div
      className="min-h-app bg-paper text-ink"
      onPointerDown={pressInk}
      onPointerUp={pressInk}
      onPointerCancel={pressInk}
      onPointerOut={pressInk}
      onClick={markRowBusy}
    >
      <SiteHeader title="Injeel" onBooks={() => setOpen(true)}>
        {showPending ? <div role="progressbar" aria-label="Opening" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gold" /> : null}
      </SiteHeader>

      <main className="mx-auto max-w-3xl px-5 pb-page pt-10 sm:px-8 lg:max-w-4xl lg:px-12">
        <p className="font-syriac text-3xl text-syriac" lang="syr" dir="rtl">
          ܐܘܢܓܠܝܘܢ
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-1">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Injeel</h1>
          <InfoMark id="open" place="flow" />
        </div>
        <p className="mt-2 font-serif text-xl text-garnet">The words of Y'shua, kept.</p>

        <div className="continue-slot mt-6">
          {ready ? (
            <Link
              to="/read/$book/$chapter"
              params={{ book: last?.book ?? "john", chapter: String(last?.chapter ?? 1) }}
              hash={last?.verse ? `v-${last.verse}` : undefined}
              aria-label={bookLabel(
                returning && lastBook ? `Continue ${lastBook.name}` : "Open John",
                (lastBook ?? john)?.say ?? "Yochanan",
                returning && last ? `${last.chapter}:${last.verse}` : "1",
              )}
              className="continue-card ink-row block border border-line px-4 py-3"
            >
              {returning && last && lastBook ? (
                <>
                  <span className="block text-xs text-gold">Continue</span>
                  <BookTitle name={lastBook.name} say={lastBook.say} sy={lastBook.sy} nameClass="font-serif text-lg" syClass="text-2xl" />
                  <span className="block font-serif text-lg">
                    {last.chapter}:{last.verse}
                  </span>
                  <span className="block text-sm text-muted">
                    verse {last.verse} of {verses} · chapter {last.chapter} of {chapters}
                  </span>
                  <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Through this chapter" className="mt-3 h-0.5 bg-line">
                    <div className="h-full bg-garnet" style={{ width: `${percent}%` }} />
                  </div>
                </>
              ) : (
                <span className="block font-serif text-lg">Begin with John · {john?.say ?? "Yochanan"} · {chapterCount("john")} chapters</span>
              )}
            </Link>
          ) : null}
        </div>

        <nav data-study="" className="mt-4 grid grid-cols-2 gap-2 min-[481px]:grid-cols-3 min-[1024px]:grid-cols-6" aria-label="Study">
          <button type="button" className={TILE} onClick={() => requestSearch()}>
            <Search className="size-4 text-garnet" aria-hidden />
            <span className="font-serif text-sm leading-tight">Search</span>
            <span className="text-xs leading-snug text-muted">Find a verse or word</span>
          </button>
          <Link to="/saved" className={TILE}>
            <Bookmark className="size-4 text-garnet" aria-hidden />
            <span className="font-serif text-sm leading-tight">Saved</span>
            <span className="text-xs leading-snug text-muted">{savedCount ? `${savedCount} saved` : "Nothing saved yet"}</span>
          </Link>
          <Link to="/words" className={TILE}>
            <Quote className="size-4 text-garnet" aria-hidden />
            <span className="font-serif text-sm leading-tight">Words of Y'shua</span>
            <span className="text-xs leading-snug text-muted">In red</span>
          </Link>
          <Link to="/names" className={TILE}>
            <BookOpen className="size-4 text-garnet" aria-hidden />
            <span className="font-serif text-sm leading-tight">Names</span>
            <span className="text-xs leading-snug text-muted">People and places</span>
          </Link>
          <Link to="/seal" className={TILE}>
            <Library className="size-4 text-garnet" aria-hidden />
            <span className="font-serif text-sm leading-tight">Your reading</span>
            <span className="text-xs leading-snug text-muted">{readingPercent}%</span>
          </Link>
          <Link to="/offline" className={TILE}>
            <CloudOff className="size-4 text-garnet" aria-hidden />
            <span className="font-serif text-sm leading-tight">Offline</span>
            <span className="text-xs leading-snug text-muted">{offlineMeta}</span>
          </Link>
        </nav>

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
                    aria-label={bookLabel(book.name, book.say, `${readingsReady ? bookCaption(book.id, counts) : chapterCountLabel(chapterCount(book.id))}${book.later ? ", later Syriac" : ""}`)}
                    className="ink-row block min-h-14 py-2"
                  >
                    <span className="block min-w-0">
                      <BookTitle name={book.name} say={book.say} sy={book.sy} nameClass="font-serif text-lg" syClass="text-2xl" />
                      <span className="block text-sm text-muted">
                        {readingsReady ? bookCaption(book.id, counts) : chapterCountLabel(chapterCount(book.id))}
                        {book.later ? " · later Syriac" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/study" className="ink-link inline-flex min-h-11 items-center text-muted">
            About this Injeel
          </Link>
          <Link to="/privacy" className="ink-link inline-flex min-h-11 items-center text-muted">
            Privacy
          </Link>
          <InstallButton />
        </footer>
      </main>

      {open ? <BookDrawer onClose={() => setOpen(false)} place={last} /> : null}
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
  return chapterCountLabel(progress.of);
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
      className="ink-link min-h-11 text-garnet"
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
  const stored = BOOKS.some((book) => book.id === place?.book);
  return (
    <Modal label="New Testament" labelledBy="book-drawer-title" announce className="book-scrim fixed inset-0 z-30 flex" onClose={onClose}>
      <nav className="book-drawer h-full w-80 max-w-[85%] overflow-y-auto bg-paper p-4 pt-safe pb-safe" onClick={(event) => event.stopPropagation()} aria-label="Books of the New Testament">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="book-drawer-title" className="font-serif text-lg">
            New Testament
          </h2>
          <button type="button" className="min-h-11 px-2 text-sm text-garnet" data-modal-initial={stored ? undefined : true} onClick={onClose}>
            Close
          </button>
        </div>
        <button
          type="button"
          className="mb-3 flex min-h-11 w-full items-center text-left text-garnet"
          onClick={() => {
            onClose();
            requestReadingIntro();
          }}
        >
          Choose how you read
        </button>
        <HelpSwitch />
        {SECTIONS.map((section) => (
          <div key={section} className="mb-4">
            <p className="text-xs text-gold">{section}</p>
            {BOOKS.filter((b) => b.section === section).map((book) => {
              const current = place?.book === book.id;
              return (
                <Link
                  key={book.id}
                  to="/read/$book/$chapter"
                  params={{ book: book.id, chapter: current ? String(place?.chapter ?? 1) : "1" }}
                  hash={current && place && place.verse > 1 ? `v-${place.verse}` : undefined}
                  onClick={onClose}
                  aria-label={bookLabel(book.name, book.say)}
                  aria-current={current ? "true" : undefined}
                  data-modal-initial={current ? true : undefined}
                  className="ink-row block min-h-11 border-b border-line py-1"
                >
                  <BookTitle name={book.name} say={book.say} sy={book.sy} nameClass="font-serif" />
                </Link>
              );
            })}
          </div>
        ))}
        <BookLinks onDone={onClose} />
      </nav>
    </Modal>
  );
}