import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { nameUtterances } from "@/lib/name-speech";
import {
  NAME_KIND_FILTERS,
  filterNames,
  kindLabel,
  nameKindCounts,
  rootDisplay,
  rootLanguage,
  type NameEntry,
  type NameKindFilter,
} from "@/lib/names";
import { nameVersesFrom, studyPeople, studySee, type NameVerse } from "@/lib/name-verse-decode";
import { loadNameVersePack } from "@/lib/name-verse-load";
import { readingSessionLive, setReadingLive, subscribeReadingLive } from "@/lib/speech-lock";
import { SITE_ORIGIN } from "@/lib/site";
import { SiteHeader } from "@/components/site-header";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COUNTS = nameKindCounts();

function noteWithSyriac(text: string) {
  return text.split(/([\u0700-\u074F]+)/).map((part, index) =>
    /[\u0700-\u074F]/.test(part) ? (
      <span key={index} className="font-syriac" lang="syr" dir="rtl" data-note-syriac="">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

type NamesSearch = { q?: string; kind?: NameKindFilter; notes?: boolean };

function readSearch(search: Record<string, unknown>): NamesSearch {
  const kindRaw = typeof search.kind === "string" ? search.kind : "";
  const kind = NAME_KIND_FILTERS.some((item) => item.id === kindRaw && item.id !== "all") ? (kindRaw as NameKindFilter) : undefined;
  const q = typeof search.q === "string" && search.q ? search.q : undefined;
  const notes = search.notes === true || search.notes === "1" || search.notes === "true" ? true : undefined;
  return { q, kind, notes };
}

export const Route = createFileRoute("/names")({
  validateSearch: readSearch,
  loader: () => loadNameVersePack(),
  head: () => ({
    meta: [
      { title: "Names — Injeel" },
      {
        name: "description",
        content: "Persons and places in this New Testament, in the Syriac spelling, the English of this book, and a reading of the letters.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/names` }],
  }),
  component: Names,
});

function syncHeaderHeight() {
  const header = document.querySelector("header");
  if (!header) return;
  document.documentElement.style.setProperty("--header-h", `${header.getBoundingClientRect().height}px`);
}

let measuredCount = -1;

function measureNameCards() {
  const cards = document.querySelectorAll<HTMLElement>(".name-card");
  if (measuredCount === cards.length && cards[0]?.style.containIntrinsicSize) return;
  for (const card of cards) card.style.contentVisibility = "visible";
  const heights: number[] = [];
  for (const card of cards) heights.push(card.getBoundingClientRect().height);
  for (let index = 0; index < cards.length; index += 1) {
    cards[index].style.containIntrinsicSize = `${Math.ceil(heights[index])}px`;
    cards[index].style.contentVisibility = "";
  }
  measuredCount = cards.length;
}

/** Centre the card in the space under the sticky find bar. A taller card parks its heading 16px below the bar. */
function placeNameCard(id: string, focus: boolean) {
  const node = document.getElementById(id);
  if (!node) return;
  if (focus) measureNameCards();
  syncHeaderHeight();
  const heading = node.querySelector("h2");
  node.style.contentVisibility = "visible";
  const behavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  for (let pass = 0; pass < 4; pass += 1) {
    const bar = document.querySelector(".names-tools")?.getBoundingClientRect();
    const header = document.querySelector("header")?.getBoundingClientRect();
    const cover = Math.max(bar?.bottom ?? 0, header?.bottom ?? 0);
    const space = window.innerHeight - cover;
    const card = node.getBoundingClientRect();
    const head = (heading ?? node).getBoundingClientRect();
    const delta = card.height <= space ? card.top + card.height / 2 - (cover + space / 2) : head.top - (cover + 16);
    if (!Number.isFinite(delta) || Math.abs(delta) <= 1) break;
    window.scrollBy(0, delta);
  }
  document.documentElement.style.scrollBehavior = behavior;
  if (focus && heading instanceof HTMLElement) heading.focus({ preventScroll: true });
}

type SpeechWindow = Window & { __setReadingLive?: (next: boolean) => void };

let stopActive: (() => void) | null = null;

function claimSpeech(stop: () => void) {
  if (stopActive && stopActive !== stop) stopActive();
  stopActive = stop;
}

function releaseSpeech(stop: () => void) {
  if (stopActive === stop) stopActive = null;
}

function Names() {
  const search = Route.useSearch();
  const versePack = Route.useLoaderData();
  const navigate = useNavigate();
  const routeHash = useRouterState({ select: (state) => state.location.hash });
  const [query, setQuery] = useState(search.q ?? "");
  const [kind, setKind] = useState<NameKindFilter>(search.kind ?? "all");
  const [notes, setNotes] = useState(Boolean(search.notes));
  const [canSpeak, setCanSpeak] = useState(true);
  const deferredQuery = useDeferredValue(query);
  const blocked = useSyncExternalStore(subscribeReadingLive, readingSessionLive, () => false);
  const writing = useRef(false);
  const rows = useMemo(() => filterNames(deferredQuery, kind, notes), [deferredQuery, kind, notes]);
  const letters = useMemo(() => new Set(rows.map((row) => (row.en[0] ?? "").toUpperCase())), [rows]);

  useEffect(() => {
    if (writing.current) {
      writing.current = false;
      return;
    }
    setQuery(search.q ?? "");
    setKind(search.kind ?? "all");
    setNotes(Boolean(search.notes));
  }, [search.q, search.kind, search.notes]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = { q: query || undefined, kind: kind === "all" ? undefined : kind, notes: notes ? true : undefined };
      const same = (search.q ?? "") === query && (search.kind ?? "all") === kind && Boolean(search.notes) === notes;
      if (same) return;
      writing.current = true;
      const hash = window.location.hash.replace(/^#/, "");
      void navigate({
        to: "/names",
        search: next,
        hash: hash || undefined,
        replace: true,
        resetScroll: false,
        hashScrollIntoView: false,
      });
    }, 120);
    return () => window.clearTimeout(id);
  }, [query, kind, notes, search.q, search.kind, search.notes, navigate]);

  useLayoutEffect(() => {
    syncHeaderHeight();
    const onResize = () => {
      measuredCount = -1;
      syncHeaderHeight();
    };
    window.addEventListener("resize", onResize);
    void document.fonts.ready.then(() => syncHeaderHeight());
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    if (!routeHash) return;
    let cancel = false;
    let frame = 0;
    const place = (measure: boolean) => {
      if (!cancel) placeNameCard(routeHash, measure);
    };
    // Scroll anchoring applies after the measuring frame, so place again once it lands.
    const follow = (count: number) => {
      if (frame) window.cancelAnimationFrame(frame);
      const step = (left: number) => {
        if (cancel || left <= 0) return;
        frame = window.requestAnimationFrame(() => {
          place(false);
          step(left - 1);
        });
      };
      step(count);
    };
    place(true);
    follow(2);
    void document.fonts.ready.then(() => {
      if (cancel) return;
      measuredCount = -1;
      place(true);
      follow(4);
    });
    return () => {
      cancel = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [routeHash]);

  useEffect(() => {
    setCanSpeak(typeof window.speechSynthesis !== "undefined");
    const view = window as SpeechWindow;
    view.__setReadingLive = setReadingLive;
    return () => {
      if (view.__setReadingLive === setReadingLive) delete view.__setReadingLive;
      if (!readingSessionLive()) window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (blocked) stopActive?.();
  }, [blocked]);

  function jump(letter: string) {
    const row = rows.find((item) => (item.en[0] ?? "").toUpperCase() === letter);
    if (!row) return;
    void navigate({
      to: "/names",
      search: { q: query || undefined, kind: kind === "all" ? undefined : kind, notes: notes ? true : undefined },
      hash: row.id,
      resetScroll: false,
      hashScrollIntoView: false,
    });
  }

  function pickKind(next: NameKindFilter) {
    setKind(next);
  }

  return (
    <div className="min-h-app bg-paper text-ink">
      <SiteHeader title="Names" mark="names" />
      <main className="mx-auto max-w-3xl px-5 pb-page sm:px-8 lg:px-12">
        <div className="names-tools">
          <label className="block">
            <span className="text-xs tracking-widest text-gold">FIND A NAME</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Peter, Maryam, Jerusalem"
              className="mt-2 min-h-11 w-full border border-line bg-raised px-3 text-base"
            />
          </label>
          <nav aria-label="Letters" className="names-az mt-2">
            {LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                className="ink-icon flex size-11 shrink-0 items-center justify-center text-sm"
                disabled={!letters.has(letter)}
                onClick={() => jump(letter)}
              >
                {letter}
              </button>
            ))}
          </nav>
        </div>
        <div role="radiogroup" aria-label="Kind of name" className="mt-3 flex flex-wrap gap-2" onKeyDown={onKindKey}>
          {NAME_KIND_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={kind === item.id}
              title={item.id === "all" ? "Person, Place, People, Title, and Letter" : item.id === "other" ? "Title and Letter" : kindLabel(item.id)}
              className="names-chip ink-row inline-flex min-h-11 items-center gap-1 px-3 text-sm"
              onClick={() => pickKind(item.id)}
            >
              {item.label}
              <span className="tabular-nums text-muted">{COUNTS[item.id]}</span>
            </button>
          ))}
        </div>
        <label className="mt-1 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={notes} onChange={(event) => setNotes(event.target.checked)} />
          Search descriptions too
        </label>
        <p aria-live="polite" className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? "name" : "names"}
        </p>
        <NameResults rows={rows} active={routeHash} pack={versePack} blocked={blocked} canSpeak={canSpeak} />
      </main>
    </div>
  );
}

function onKindKey(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='radio']")];
  const index = radios.findIndex((item) => item === document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next = radios[(index + (event.key === "ArrowRight" ? 1 : radios.length - 1)) % radios.length];
  next?.focus();
  next?.click();
}

const NameResults = memo(function NameResults({
  rows,
  active,
  pack,
  blocked,
  canSpeak,
}: {
  rows: NameEntry[];
  active: string;
  pack: string;
  blocked: boolean;
  canSpeak: boolean;
}) {
  return (
    <ul className="mt-2 border-t border-line">
      {rows.map((row) => (
        <NameCard key={row.id} row={row} active={active === row.id} pack={pack} blocked={blocked} canSpeak={canSpeak} />
      ))}
    </ul>
  );
});

const NameCard = memo(function NameCard({
  row,
  active,
  pack,
  blocked,
  canSpeak,
}: {
  row: NameEntry;
  active: boolean;
  pack: string;
  blocked: boolean;
  canSpeak: boolean;
}) {
  const spoken = nameUtterances(row);
  const root = rootDisplay(row);
  const lang = rootLanguage(row);
  const ipa = row.pron?.root?.ipa && row.pron.root.source ? row.pron.root.ipa : "";
  const [part, setPart] = useState<"" | "root" | "en">("");
  const token = useRef(0);
  const running = useRef(false);
  const stop = useCallback(() => {
    token.current += 1;
    running.current = false;
    setPart("");
    releaseSpeech(stop);
    if (!readingSessionLive()) window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    return () => {
      token.current += 1;
      if (!running.current) return;
      running.current = false;
      releaseSpeech(stop);
      if (!readingSessionLive()) window.speechSynthesis?.cancel();
    };
  }, [stop]);

  async function play() {
    if (readingSessionLive() || !canSpeak) return;
    if (running.current) {
      stop();
      return;
    }
    const mine = token.current + 1;
    token.current = mine;
    running.current = true;
    claimSpeech(stop);
    if (!readingSessionLive()) window.speechSynthesis?.cancel();
    for (let index = 0; index < spoken.length; index += 1) {
      if (token.current !== mine) return;
      const line = spoken[index];
      setPart(line.part);
      await speakLine(line.text, line.lang, line.rate);
      if (token.current !== mine) return;
      if (index === 0) await pause(300);
    }
    if (token.current === mine) {
      running.current = false;
      setPart("");
      releaseSpeech(stop);
    }
  }

  return (
    <li id={row.id} className={`name-card border-b border-line py-4 ${active ? "-mx-3 bg-gold-soft px-3" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 tabIndex={-1} className="font-serif text-2xl font-semibold leading-tight outline-none">{root}</h2>
            <span className={`text-xs ${lang.pending ? "text-muted" : "tracking-wide text-gold"}`}>{lang.text}</span>
          </div>
          <p className="name-spoken mt-1 text-sm" data-name-english-line aria-current={part === "en" ? "true" : undefined}>
            <span className="text-[0.65rem] font-semibold tracking-[0.14em] text-gold small-caps">ENGLISH</span>{" "}
            <span data-name-english>{row.known}</span>
          </p>
        </div>
        <p className="max-w-[46%] min-w-0 text-end font-syriac text-2xl leading-none text-syriac [overflow-wrap:anywhere] min-[360px]:text-3xl min-[800px]:text-4xl" lang="syr" dir="rtl">
          {row.sy}
        </p>
      </div>
      {row.spellings && row.spellings.filter((spelling) => spelling !== row.sy).length > 0 ? (
        <p className="mt-2 font-syriac text-2xl leading-none text-syriac [overflow-wrap:anywhere]" lang="syr" dir="rtl">
          {row.spellings.filter((spelling) => spelling !== row.sy).join("  ")}
        </p>
      ) : null}
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="name-spoken min-w-0 text-sm" data-name-say aria-current={part === "root" ? "true" : undefined}>
          <span className="text-gold">Say:</span> {spoken[0].text}
          {ipa ? (
            <span className="text-muted" title={row.pron?.root?.source}>
              {" "}
              · {ipa}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          data-name-read
          className="ink-icon inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 px-3 text-sm"
          aria-label={`Read ${root} then ${spoken[1].text}`}
          aria-pressed={part ? "true" : "false"}
          disabled={blocked || !canSpeak}
          title={canSpeak ? undefined : "This device can't read aloud"}
          onClick={() => void play()}
        >
          <SpeakerIcon />
          Read
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{noteWithSyriac(row.note)}</p>
      {studyPeople(row).map((person) => (
        <p key={person.label} className="mt-2 text-sm leading-relaxed" data-name-person="">
          {person.label}
          {person.links.length ? " — " : ""}
          {person.links.map((link) => (
            <Link
              key={link.ref}
              to="/read/$book/$chapter"
              params={{ book: link.book, chapter: String(link.chapter) }}
              hash={`v-${link.verse}`}
              className="ink-link inline-flex min-h-6 min-w-0 max-w-full items-center px-1.5 text-garnet"
            >
              {link.label}
            </Link>
          ))}
        </p>
      ))}
      {studySee(row).length ? (
        <p className="mt-2 text-sm" data-name-see-line="">
          See also{" "}
          {studySee(row).map((item) => (
            <Link
              key={item.id}
              to="/names"
              hash={item.id}
              resetScroll={false}
              hashScrollIntoView={false}
              data-name-see={item.id}
              className="ink-link inline-flex min-h-6 items-center px-1.5 text-garnet"
            >
              {item.label}
            </Link>
          ))}
        </p>
      ) : null}
      {row.sources?.map((source) => (
        <p key={`${source.script}-${source.text}`} className="mt-2 text-sm leading-relaxed">
          <span className="text-gold">{source.script}</span>{" "}
          <span className={`font-semibold ${source.script === "Greek" ? "font-greek" : source.script === "Hebrew" || source.script === "Aramaic" ? "font-hebrew text-lg" : ""}`}>
            {source.text}
          </span>
          {source.say ? <span className="text-muted"> · {source.say}</span> : null}
          {source.note ? <span> {noteWithSyriac(source.note)}</span> : null}
        </p>
      ))}
      <VerseList row={row} pack={pack} />
    </li>
  );
});

function VerseList({ row, pack }: { row: NameEntry; pack: string }) {
  const verses = useMemo(() => nameVersesFrom(pack, row), [pack, row]);
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState("");
  const shown = open ? verses : verses.slice(0, 6);
  const books = useMemo(() => {
    const seen: { id: string; name: string }[] = [];
    for (const verse of verses) {
      const name = verse.label.replace(/\s+\d+:\d+$/, "");
      if (!seen.some((item) => item.id === verse.book)) seen.push({ id: verse.book, name });
    }
    return seen;
  }, [verses]);
  const filtered = book ? shown.filter((verse) => verse.book === book) : shown;
  const groups: { id: string; name: string; verses: NameVerse[] }[] = [];
  for (const verse of filtered) {
    const name = verse.label.replace(/\s+\d+:\d+$/, "");
    const last = groups[groups.length - 1];
    if (last?.id === verse.book) last.verses.push(verse);
    else groups.push({ id: verse.book, name, verses: [verse] });
  }
  return (
    <>
      <p className="mt-2 text-sm text-muted">
        <span data-name-kind>{kindLabel(row.kind)}</span>
        {" · "}
        {verses.length} {verses.length === 1 ? "verse" : "verses"}
      </p>
      {open && books.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Books in this list">
          <button type="button" aria-pressed={book === ""} className="ink-row inline-flex min-h-11 items-center px-3 text-sm" onClick={() => setBook("")}>
            All
          </button>
          {books.map((item) => (
            <button key={item.id} type="button" aria-pressed={book === item.id} className="ink-row inline-flex min-h-11 items-center px-3 text-sm" onClick={() => setBook(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="name-verses mt-1">
        {groups.map((group) => (
          <div key={group.id} className="name-verse-book">
            <span className="name-verse-book-label">{group.name}</span>
            {group.verses.map((verse) => (
              <Link
                key={`${verse.book}-${verse.chapter}-${verse.verse}`}
                to="/read/$book/$chapter"
                params={{ book: verse.book, chapter: String(verse.chapter) }}
                hash={`v-${verse.verse}`}
                data-name-verse=""
                className="ink-link inline-flex min-h-6 min-w-0 max-w-full items-center px-1.5 text-garnet [overflow-wrap:anywhere]"
              >
                {verse.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      {verses.length > 6 ? (
        <button
          type="button"
          data-name-more=""
          aria-expanded={open}
          className="ink-link mt-1 inline-flex min-h-6 items-center px-1.5 text-sm text-garnet"
          onClick={() => {
            setOpen((value) => !value);
            setBook("");
          }}
        >
          {open ? "Show fewer" : `+ ${verses.length - 6} more`}
        </button>
      ) : null}
    </>
  );
}

function speakLine(text: string, lang: string, rate: number) {
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth || !text.trim()) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.speak(utter);
  });
}

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 10h3l4-3v10l-4-3H4z" strokeLinejoin="round" />
      <path d="M16.5 9.2a3.8 3.8 0 0 1 0 5.6" strokeLinecap="round" />
    </svg>
  );
}
