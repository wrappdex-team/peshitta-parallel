import { Pause, Play, Square } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BOOKS } from "@/data/edition";
import { languageById, type LangId } from "@/lib/languages";
import { chapterCount, loadBook, loadParallel } from "@/lib/scripture";
import { readingLines, type VoiceId } from "@/lib/speak";
import { speechOf } from "@/lib/jesus";
import { holdReading, type ReadingHold } from "@/lib/keep-reading";
import { setReadingLive } from "@/lib/speech-lock";
import { scrollLineToTop } from "@/lib/scroll-line";

type Line = { v: number; text: string; chapter?: number; key?: string };

type Props = {
  book: string;
  chapter: number;
  voice: VoiceId;
  deviceVoice: string;
  speed: number;
  lang: LangId;
  onVoice: (voice: VoiceId) => void;
  onDeviceVoice: (voice: string) => void;
  onSpeed: (speed: number) => void;
  onVerse: (verse: number | null) => void;
  onAdvance: (place: Place) => void;
  onChapter?: (place: Place) => void;
  fromVerse?: number;
  /** Speak this sequence instead of every verse in the chapter. */
  loadLines?: (place: Place, lang: LangId) => Promise<Line[]>;
  /** Where Continue goes. Defaults to the next chapter, then the next book. */
  nextPlaceOf?: (place: Place) => Place | null;
  /** `${chapter}:${verse}` to begin at, when a list jumps chapters. */
  startKey?: string;
  /** Shown on the idle bar, such as "From 5:3". */
  fromLabel?: string;
  onHeard?: (line: { book: string; chapter: number; verse: number } | null) => void;
  /** Keep the bar on the bottom of wide screens too. */
  pin?: boolean;
  /** Bar on a reading page, or a small corner once that page is left. */
  dock?: "bar" | "corner";
  onStatus?: (status: "idle" | "playing" | "paused") => void;
  kind?: "chapter" | "words";
};

type Place = { book: string; chapter: number };

function VoiceMark() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function place() {
      const anchor = rootRef.current;
      if (!anchor || typeof anchor.getBoundingClientRect !== "function" || !window.innerWidth) return;
      const rect = anchor.getBoundingClientRect();
      const view = window.innerWidth;
      const width = view < 480 ? view - 32 : Math.min(416, view - 32);
      const left = Math.max(16, Math.min(view < 480 ? 16 : rect.right - width, view - 16 - width));
      setBox({ left, width });
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector("button")?.focus();
    }
    function onPointer(event: PointerEvent) {
      const node = event.target;
      if (!(node instanceof Node)) return;
      if (rootRef.current?.contains(node)) return;
      if (noteRef.current?.contains(node)) return;
      setOpen(false);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center"
        aria-expanded={open}
        aria-label="Voice setup help"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex size-4 items-center justify-center rounded-full border border-gold font-serif text-[10px] leading-none text-gold" aria-hidden>
          i
        </span>
      </button>
      {open && (
        <div
          ref={noteRef}
          role="region"
          aria-label="Voice setup help"
          className="z-50 overflow-y-auto border border-line bg-paper p-3 text-left"
          style={{
            position: "fixed",
            left: box?.left ?? 16,
            width: box?.width ?? "auto",
            right: box ? undefined : 16,
            bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))",
            maxHeight: "min(70dvh, calc(100dvh - 9rem))",
          }}
        >
          <p className="font-serif text-lg text-ink">Voice setup</p>
          <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink">
            <p>Read uses your browser’s device speech, without a provider key. Studio creates media through a paid provider using your own key. INjeel cannot install voices or guarantee any accent, language, or Syriac voice. System settings and voices exposed to a browser can differ.</p>
            <p><strong>iPhone and iPad:</strong> In Settings → Accessibility, look for Read & Speak → Voices (called Spoken Content on older versions). Choose a language and dialect. For downloadable enhanced voices, Apple also documents VoiceOver → Speech → Add New Language; choose a voice/quality and allow the download to finish on Wi-Fi. You do not need to enable VoiceOver to use INjeel. <a className="text-garnet underline" href="https://support.apple.com/guide/iphone/hear-whats-on-the-screen-or-typed-iph96b214f0/ios">Apple’s current guide</a> · <a className="text-garnet underline" href="https://support.apple.com/en-us/111798">iOS/iPadOS voice downloads</a></p>
            <p><strong>Android:</strong> Open Settings → Accessibility → Text-to-speech output. Choose the preferred engine and language; use its voice-data/download options where available. Names and paths vary by manufacturer/engine; search Settings for “text-to-speech” if needed. <a className="text-garnet underline" href="https://support.google.com/accessibility/android/answer/6006983?hl=en">Google’s settings and voice-data guide</a></p>
            <p><strong>macOS:</strong> Apple menu → System Settings → Accessibility → Read & Speak. Choose System voice; open its additional voice controls to browse languages, country/region variants and downloadable voices. Wait until downloads finish, then choose the voice. Older versions may use Spoken Content. <a className="text-garnet underline" href="https://support.apple.com/guide/mac-help/mchlp2290/mac">Apple’s Mac voice guide</a></p>
            <p>Return here and reopen the voice selector. If new voices do not appear, refresh or reopen the app/browser. Select the voice and adjust Speed here; a system default need not override an explicit app selection. Android browsers may use their speech engine rather than a forced voice. Some voices use network services; availability and pronunciation depend on your device/browser, not the scripture’s historical pronunciation.</p>
          </div>
          <button type="button" className="mt-2 min-h-11 text-sm text-garnet" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </span>
  );
}

function locate(rows: Line[], from: number, key: string) {
  if (key) {
    const hit = rows.findIndex((row) => row.key === key);
    if (hit >= 0) return hit;
  }
  if (rows.some((row) => row.key)) return 0;
  const startAt = rows.findIndex((row) => row.v >= from);
  return startAt >= 0 ? startAt : 0;
}

function nextPlace(book: string, chapter: number): Place | null {
  const total = chapterCount(book);
  if (chapter < total) return { book, chapter: chapter + 1 };
  const index = BOOKS.findIndex((item) => item.id === book);
  if (index >= 0 && index < BOOKS.length - 1) return { book: BOOKS[index + 1].id, chapter: 1 };
  return null;
}

function placeLabel(book: string, chapter: number, verse: number) {
  const name = BOOKS.find((item) => item.id === book)?.name || book;
  return `${name} ${chapter}:${verse}`;
}

function phrases(text: string) {
  if (text.length <= 220) return [text];
  const bits = text.split(/(?<=[.!?;:؟。！？])\s+/).filter(Boolean);
  if (bits.length < 2) return [text];
  const out: string[] = [];
  let buf = "";
  for (const bit of bits) {
    if (buf && buf.length + 1 + bit.length > 220) {
      out.push(buf);
      buf = bit;
    } else buf = buf ? `${buf} ${bit}` : bit;
  }
  if (buf) out.push(buf);
  return out.length ? out : [text];
}

function voiceKey(voice: SpeechSynthesisVoice) {
  return voice.voiceURI || `${voice.name}::${voice.lang}`;
}

function listVoices() {
  const all = window.speechSynthesis?.getVoices() ?? [];
  const seen = new Set<string>();
  return all.filter((voice) => {
    const key = voiceKey(voice);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Some Android/Chrome engines still report Hebrew with the legacy ISO 639 code "iw".
const VOICE_ALIASES: Record<string, string[]> = { he: ["he", "iw"] };

function voiceMatches(voice: SpeechSynthesisVoice, lang: LangId) {
  const prefix = languageById(lang).tts.toLowerCase().split("-")[0];
  if (prefix === "syr") return false;
  const code = voice.lang.toLowerCase().replace("_", "-").split("-")[0];
  return (VOICE_ALIASES[prefix] ?? [prefix]).includes(code);
}

function findVoice(key: string, lang: LangId) {
  const all = listVoices();
  if (key) {
    const exact = all.find((voice) => voiceKey(voice) === key);
    if (exact) return exact;
  }
  return all.find((voice) => voiceMatches(voice, lang));
}

function orderedVoices(lang: LangId) {
  return [...listVoices()].sort((a, b) => {
    const aMatch = voiceMatches(a, lang) ? 0 : 1;
    const bMatch = voiceMatches(b, lang) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    if (a.localService !== b.localService) return a.localService ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function linesFor(place: Place, lang: LangId, from: number): Promise<Line[]> {
  try {
    const doc = await loadBook(place.book);
    const verses = doc.chapters[place.chapter - 1];
    if (!verses) throw new Error("That chapter is not in this book.");
    const lines = lang === "en" ? verses.map((verse) => verse.en) : (await loadParallel(lang, place.book))?.[place.chapter - 1];
    if (!lines) throw new Error("That language is not ready for this chapter yet.");
    const rows = readingLines(place.book, place.chapter, verses, lines, lang, from);
    if (!rows.length) throw new Error("This chapter has nothing to read in that language.");
    return rows;
  } catch (error) {
    try {
      const { readOfflineChapter } = await import("@/lib/offline");
      const copy = await readOfflineChapter(lang, place.book, place.chapter);
      if (copy?.verses.length) {
        const verses = copy.verses.map((row) => ({ v: row.v, sy: "", en: row.text }));
        const lines = copy.verses.map((row) => row.text);
        const rows = readingLines(place.book, place.chapter, verses, lines, lang, from);
        if (rows.length) return rows;
      }
    } catch {
      // No copy, or this browser has no storage.
    }
    if (error instanceof Error && !/fetch|import|network|dynamically/i.test(error.message)) throw error;
    throw new Error("This chapter is not on this device.");
  }
}

type PanelScroll = "more" | "end" | "none";

function panelScrollOf(panel: HTMLElement): PanelScroll {
  if (panel.scrollHeight - panel.clientHeight <= 1) return "none";
  if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1) return "end";
  return "more";
}

function revealInPanel(target: HTMLElement) {
  const panel = target.closest("#read-bar-more");
  if (!(panel instanceof HTMLElement)) return;
  const row = target.closest("label, button");
  if (!(row instanceof HTMLElement) || !panel.contains(row)) return;
  const x = window.scrollX;
  const y = window.scrollY;
  const panelBox = panel.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  if (rowBox.bottom > panelBox.bottom + 1) panel.scrollTop += rowBox.bottom - panelBox.bottom;
  else if (rowBox.top < panelBox.top - 1) panel.scrollTop -= panelBox.top - rowBox.top;
  const restore = () => {
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
  };
  restore();
  window.requestAnimationFrame(restore);
}

export type ReadAloudHandle = { readFrom: (key?: string) => void };

export const ReadAloud = forwardRef<ReadAloudHandle, Props>(function ReadAloud({
  book,
  chapter,
  deviceVoice,
  speed,
  lang,
  onDeviceVoice,
  onSpeed,
  onVerse,
  onAdvance,
  onChapter,
  fromVerse = 1,
  loadLines,
  nextPlaceOf,
  startKey = "",
  fromLabel = "",
  onHeard,
  kind = "chapter",
  dock = "bar",
  onStatus,
}: Props, ref) {
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [carry, setCarry] = useState(false);
  const [cornerReady, setCornerReady] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [spot, setSpot] = useState("");
  const run = useRef(0);
  const lines = useRef<Line[]>([]);
  const index = useRef(0);
  const place = useRef<Place>({ book, chapter });
  const spoken = useRef<(Place & { lang: LangId }) | null>(null);
  const statusRef = useRef(status);
  const carryRef = useRef(carry);
  const onVerseRef = useRef(onVerse);
  const onAdvanceRef = useRef(onAdvance);
  const onChapterRef = useRef(onChapter);
  const onHeardRef = useRef(onHeard);
  const loadLinesRef = useRef(loadLines);
  const nextPlaceOfRef = useRef(nextPlaceOf);
  const deviceVoiceRef = useRef(deviceVoice);
  const speedRef = useRef(speed);
  const langRef = useRef(lang);
  const readyLines = useRef<Line[] | null>(null);
  const fromRef = useRef(fromVerse);
  const startKeyRef = useRef(startKey);
  const hold = useRef<ReadingHold | null>(null);
  const stopping = useRef<"none" | "pause" | "halt">("none");
  const loop = useRef(0);
  const runner = useRef<(token: number, at: number) => Promise<void>>(async () => {});
  const startRef = useRef<(from: number) => Promise<void>>(async () => {});
  const followRef = useRef(true);
  const moreButton = useRef<HTMLButtonElement>(null);
  const morePanel = useRef<HTMLDivElement>(null);
  const [panelScroll, setPanelScroll] = useState<PanelScroll>("none");
  const followLineRef = useRef(() => {});
  const expecting = useRef<Place | null>(null);
  const rowRef = useRef<Line | null>(null);
  statusRef.current = status;
  carryRef.current = carry;
  onVerseRef.current = onVerse;
  onAdvanceRef.current = onAdvance;
  onChapterRef.current = onChapter;
  onHeardRef.current = onHeard;
  loadLinesRef.current = loadLines;
  nextPlaceOfRef.current = nextPlaceOf;
  deviceVoiceRef.current = deviceVoice;
  speedRef.current = speed;
  // A language change while a reading is going applies on the next Read, not mid-verse.
  if (status === "idle") langRef.current = lang;
  fromRef.current = fromVerse;
  startKeyRef.current = startKey;
  followLineRef.current = () => {
    if (statusRef.current === "idle" || !followRef.current) return;
    const row = rowRef.current;
    if (!row) return;
    const chapterNo = row.chapter ?? place.current.chapter;
    const id = kind === "words" ? `w-${chapterNo}-${row.v}` : `v-${row.v}`;
    const el = document.getElementById(id);
    if (el) scrollLineToTop(el);
  };

  function queueFollow() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => followLineRef.current());
    });
  }

  function toggleMore() {
    setMore((open) => !open);
    queueFollow();
  }

  function heard(row: Line | null) {
    rowRef.current = row;
    if (row) {
      const chapterNo = row.chapter ?? place.current.chapter;
      const bookId = place.current.book;
      const label = placeLabel(bookId, chapterNo, row.v);
      setSpot(label);
      hold.current?.caption({
        text: row.text,
        place: label,
        red: kind === "words" || speechOf(bookId, chapterNo, row.v)?.kind === "whole",
      });
    }
    if (!followRef.current) return;
    if (!row) {
      onVerseRef.current(null);
      onHeardRef.current?.(null);
      return;
    }
    onVerseRef.current(row.v);
    onHeardRef.current?.({
      book: place.current.book,
      chapter: row.chapter ?? place.current.chapter,
      verse: row.v,
    });
  }

  async function loadRows(at: Place, tongue: LangId) {
    if (loadLinesRef.current) return loadLinesRef.current(at, tongue);
    return linesFor(at, tongue, 1);
  }

  function silence() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // The device had already stopped.
    }
  }

  function releaseHold() {
    hold.current?.release();
    hold.current = null;
  }

  function takeHold() {
    releaseHold();
    hold.current = holdReading({
      onPause: () => pauseReading(),
      onPlay: () => resumeReading(),
    });
  }

  function pauseReading() {
    if (statusRef.current !== "playing") return;
    stopping.current = "pause";
    statusRef.current = "paused";
    loop.current += 1;
    silence();
    releaseHold();
    setStatus("paused");
  }

  function resumeReading() {
    if (statusRef.current !== "paused" || !lines.current.length) return;
    stopping.current = "none";
    statusRef.current = "playing";
    setReadingLive(true);
    takeHold();
    setStatus("playing");
    void speakFrom(run.current, index.current);
  }

  function halt() {
    stopping.current = "halt";
    statusRef.current = "idle";
    setReadingLive(false);
    loop.current += 1;
    run.current += 1;
    lines.current = [];
    index.current = 0;
    spoken.current = null;
    expecting.current = null;
    followRef.current = true;
    silence();
    releaseHold();
    setStatus("idle");
    setSpot("");
    setError("");
    heard(null);
  }

  function markIdle() {
    statusRef.current = "idle";
    setReadingLive(false);
    spoken.current = null;
    releaseHold();
    setStatus("idle");
  }

  useEffect(() => {
    if (statusRef.current === "idle") {
      followRef.current = true;
      setError("");
      return;
    }
    const want = expecting.current;
    if (want && want.book === book && want.chapter === chapter) {
      expecting.current = null;
      followRef.current = true;
      const row = rowRef.current;
      if (row) {
        onVerseRef.current(row.v);
        onHeardRef.current?.({ book, chapter: row.chapter ?? chapter, verse: row.v });
      }
      return;
    }
    if (place.current.book === book && place.current.chapter === chapter) {
      followRef.current = true;
      const row = rowRef.current;
      if (row) {
        onVerseRef.current(row.v);
        onHeardRef.current?.({ book, chapter: row.chapter ?? chapter, verse: row.v });
      }
      return;
    }
    // The open page moved. Keep speaking the place already underway.
    followRef.current = false;
    onVerseRef.current(null);
    onHeardRef.current?.(null);
  }, [book, chapter, dock]);

  useEffect(() => {
    onStatus?.(status);
    setReadingLive(status !== "idle");
  }, [onStatus, status]);

  useEffect(() => {
    if (!more) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[aria-label='Voice setup help'][aria-expanded='true']")) return;
      event.preventDefault();
      setMore(false);
      moreButton.current?.focus();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => followLineRef.current());
      });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [more]);

  useEffect(() => {
    let live = true;
    readyLines.current = null;
    const load = loadLinesRef.current;
    const pending = load ? load({ book, chapter }, lang) : linesFor({ book, chapter }, lang, 1);
    pending
      .then((rows) => {
        if (live) readyLines.current = rows;
      })
      .catch(() => {
        if (live) readyLines.current = null;
      });
    return () => {
      live = false;
    };
  }, [book, chapter, lang]);

  useEffect(() => {
    function refresh() {
      setVoices(orderedVoices(langRef.current));
    }
    refresh();
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
      stopping.current = "halt";
      statusRef.current = "idle";
      setReadingLive(false);
      loop.current += 1;
      run.current += 1;
      silence();
      hold.current?.release();
      hold.current = null;
    };
  }, []);

  useEffect(() => {
    setVoices(orderedVoices(lang));
  }, [lang]);

  function speakPhrase(text: string, token: number, plain = false) {
    return new Promise<"done" | "stopped">((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth || run.current !== token || !text.trim()) {
        resolve("stopped");
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      const tongue = languageById(langRef.current).tts;
      const android = /android/i.test(navigator.userAgent);
      // Android Chrome fails with synthesis-failed when a voice is forced.
      if (!plain && !android && deviceVoiceRef.current) {
        const picked = findVoice(deviceVoiceRef.current, langRef.current);
        if (picked) {
          utter.voice = picked;
          utter.lang = picked.lang;
        }
      }
      const chosen = findVoice(deviceVoiceRef.current, langRef.current);
      if (!utter.lang && chosen) utter.lang = chosen.lang;
      if (!utter.lang && tongue !== "syr") utter.lang = tongue === "en" ? "en-US" : tongue;
      utter.rate = plain ? 1 : speedRef.current / 100;
      utter.pitch = 1;
      utter.volume = 1;
      let settled = false;
      const phrase = loop.current;
      const finish = (result: "done" | "stopped") => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      utter.onend = () => finish(loop.current === phrase && stopping.current === "none" && run.current === token ? "done" : "stopped");
      utter.onerror = (event) => {
        // A canceled/replaced phrase no longer owns errors or fallback speech.
        if (settled || run.current !== token || loop.current !== phrase || stopping.current !== "none") {
          finish("stopped");
          return;
        }
        const reason = event.error || "unknown";
        if (!plain && reason === "synthesis-failed") {
          void speakPhrase(text, token, true).then(finish);
          return;
        }
        if (reason !== "interrupted" && reason !== "canceled") setError(`This phone did not speak (${reason}).`);
        if ((reason === "interrupted" || reason === "canceled") && stopping.current === "none" && document.visibilityState === "visible") {
          window.setTimeout(() => {
            if (settled || stopping.current !== "none" || run.current !== token || loop.current !== phrase) {
              finish("stopped");
              return;
            }
            void speakPhrase(text, token, true).then(finish);
          }, 350);
          return;
        }
        finish("stopped");
      };
      const go = () => {
        if (run.current !== token || stopping.current !== "none") {
          finish("stopped");
          return;
        }
        synth.resume();
        synth.speak(utter);
      };
      if (synth.speaking || synth.pending) {
        synth.cancel();
        window.setTimeout(go, 250);
      } else go();
    });
  }

  async function speakFrom(token: number, startAt: number) {
    const mine = ++loop.current;
    let cursor = startAt;
    while (run.current === token && loop.current === mine && stopping.current === "none") {
      const row = lines.current[cursor];
      if (!row) {
        const done = place.current;
        onChapterRef.current?.(done);
        heard(null);
        if (!carryRef.current) {
          markIdle();
          return;
        }
        const nxt = nextPlaceOfRef.current ? nextPlaceOfRef.current(done) : nextPlace(done.book, done.chapter);
        if (!nxt) {
          markIdle();
          return;
        }
        spoken.current = { ...nxt, lang: langRef.current };
        expecting.current = nxt;
        followRef.current = true;
        onAdvanceRef.current(nxt);
        place.current = nxt;
        try {
          lines.current = await loadRows(nxt, langRef.current);
        } catch (err) {
          if (run.current !== token) return;
          markIdle();
          setError(err instanceof Error ? err.message : "The voice could not continue.");
          heard(null);
          return;
        }
        cursor = 0;
        index.current = 0;
        if (run.current !== token || loop.current !== mine || stopping.current !== "none") return;
        continue;
      }
      index.current = cursor;
      heard(row);
      if (statusRef.current !== "playing") setStatus("playing");
      for (const phrase of phrases(row.text)) {
        if (run.current !== token || loop.current !== mine || stopping.current !== "none") return;
        const result = await speakPhrase(phrase, token);
        if (result !== "done" || run.current !== token || loop.current !== mine || stopping.current !== "none") return;
      }
      cursor += 1;
    }
  }

  runner.current = speakFrom;

  async function start(from: number) {
    langRef.current = lang;
    followRef.current = true;
    expecting.current = null;
    takeHold();
    if (typeof window.speechSynthesis === "undefined") {
      releaseHold();
      setError("This device has no speaking voice.");
      return;
    }
    if (!findVoice(deviceVoiceRef.current, langRef.current)) {
      releaseHold();
      setError("No matching voice is available. Open Voice setup help, then choose an available voice explicitly or download a compatible system voice.");
      return;
    }
    setError("");
    stopping.current = "none";
    statusRef.current = "playing";
    setReadingLive(true);
    const token = ++run.current;
    loop.current += 1;
    const here = { book, chapter };
    place.current = here;
    spoken.current = { ...here, lang };
    setStatus("playing");
    let rows = readyLines.current;
    if (!rows) {
      try {
        rows = await loadRows(here, langRef.current);
        readyLines.current = rows;
      } catch (err) {
        if (run.current !== token) return;
        markIdle();
        setError(err instanceof Error ? err.message : "The voice could not read this chapter.");
        return;
      }
    }
    if (run.current !== token) return;
    lines.current = rows;
    const startAt = locate(rows, from, startKeyRef.current);
    index.current = startAt;
    // Speak the first words in this tap, before any later wait, or a phone will stay silent.
    const first = rows[index.current];
    if (first) {
      heard(first);
      const piece = phrases(first.text)[0] ?? first.text;
      const opened = speakPhrase(piece, token);
      const rest = phrases(first.text).slice(1);
      const head = await opened;
      if (head !== "done" || run.current !== token) return;
      for (const phrase of rest) {
        if (run.current !== token || stopping.current !== "none") return;
        const result = await speakPhrase(phrase, token);
        if (result !== "done" || run.current !== token) return;
      }
      index.current += 1;
    }
    await speakFrom(token, index.current);
  }

  startRef.current = start;
  useImperativeHandle(ref, () => ({
    readFrom(key?: string) {
      if (key) startKeyRef.current = key;
      void startRef.current(Math.max(1, fromRef.current || 1));
    },
  }), []);

  function toggle() {
    if (status === "playing") {
      pauseReading();
      return;
    }
    if (status === "paused" && lines.current.length) {
      resumeReading();
      return;
    }
    void start(Math.max(1, fromRef.current || 1));
  }

  function toggleCarry() {
    const next = !carry;
    carryRef.current = next;
    setCarry(next);
  }

  useEffect(() => {
    const host = document as Document & { pictureInPictureEnabled?: boolean };
    if (host.pictureInPictureEnabled) setCornerReady(true);
  }, []);

  useEffect(() => {
    const panel = morePanel.current;
    if (!panel) return;
    const measure = () => {
      const next = panelScrollOf(panel);
      setPanelScroll((prev) => (prev === next ? prev : next));
    };
    measure();
    panel.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => {
      panel.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [more, cornerReady]);

  // A short screen hides the language bar while a reading is going, so the verse keeps a band.
  useEffect(() => {
    const root = document.documentElement;
    if (!root || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-height: 500px)");
    const apply = () => {
      if (media.matches && statusRef.current !== "idle") root.dataset.reading = "active";
      else delete root.dataset.reading;
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      delete root.dataset.reading;
    };
  }, [status]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      if (statusRef.current !== "playing" || stopping.current !== "none") return;
      const synth = window.speechSynthesis;
      if (!synth || !lines.current.length) return;
      try {
        synth.resume();
      } catch {
        // The engine had already stopped.
      }
      // The lock leaves the voice paused. If it is not speaking once the page is open, say the same line.
      window.setTimeout(() => {
        if (document.visibilityState !== "visible") return;
        if (statusRef.current !== "playing" || stopping.current !== "none") return;
        if (synth.speaking) return;
        try {
          synth.cancel();
        } catch {
          // Nothing was queued.
        }
        loop.current += 1;
        void runner.current(run.current, index.current);
      }, 450);
    }
    document.addEventListener("visibilitychange", onVisibility);
    function onGesture() {
      if (statusRef.current !== "playing" || stopping.current !== "none") return;
      const synth = window.speechSynthesis;
      if (!synth?.paused) return;
      try {
        synth.resume();
      } catch {
        // The engine had already stopped.
      }
    }
    document.addEventListener("pointerdown", onGesture);
    let silent = 0;
    let watch = 0;
    if (typeof window.setInterval === "function") {
      watch = window.setInterval(() => {
        if (statusRef.current !== "playing" || stopping.current !== "none") {
          silent = 0;
          return;
        }
        const synth = window.speechSynthesis;
        if (!synth || !lines.current.length) return;
        if (synth.paused) {
          try {
            synth.resume();
          } catch {
            // The engine had already stopped.
          }
          silent = 0;
          return;
        }
        if (synth.speaking || synth.pending) {
          silent = 0;
          return;
        }
        silent += 1;
        if (silent < 2) return;
        silent = 0;
        // The queue died without Stop. Say the same line again.
        loop.current += 1;
        try {
          synth.cancel();
        } catch {
          // Nothing was queued.
        }
        void runner.current(run.current, index.current);
      }, 1000);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onGesture);
      if (watch) window.clearInterval(watch);
    };
  }, []);

  function chooseDeviceVoice(next: string) {
    deviceVoiceRef.current = next;
    onDeviceVoice(next);
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    if (statusRef.current === "playing" || statusRef.current === "paused") {
      stopping.current = "none";
      statusRef.current = "playing";
      setReadingLive(true);
      setStatus("playing");
      void speakFrom(run.current, index.current);
      return;
    }
    const picked = findVoice(next, langRef.current);
    const utter = new SpeechSynthesisUtterance(picked?.name || "This voice");
    if (picked) {
      utter.voice = picked;
      utter.lang = picked.lang;
    }
    utter.rate = speedRef.current / 100;
    utter.pitch = 1;
    synth.resume();
    synth.speak(utter);
  }

  function setSpeed(next: number) {
    const value = Math.min(150, Math.max(50, Math.round(next)));
    speedRef.current = value;
    onSpeed(value);
  }

  const playing = status === "playing";
  const active = status !== "idle";
  const label = playing ? "Pause" : status === "paused" ? "Resume" : "Read";
  const wordsMode = kind === "words";
  const hereLabel = wordsMode ? "These words" : "This chapter";
  const throughLabel = wordsMode ? "Through the books" : "Through the book";
  const continueOn = wordsMode ? "Stop after this book" : "Stop after this chapter";
  const continueOff = wordsMode ? "Keep reading the words of Y'shua into the next book" : "Keep reading through this book and into the next";
  const placeText = status === "paused" ? (spot ? `Paused · ${spot}` : "Paused") : spot || (carry ? throughLabel : hereLabel);

  const idleNote =
    status === "idle" && fromLabel
      ? fromLabel
      : status === "idle" && fromVerse > 1
        ? `From ${fromVerse}`
        : status === "idle"
          ? languageById(lang).label
          : "";
  const readLabel = wordsMode ? "Read these words aloud" : fromVerse > 1 ? "Read from this verse" : "Read this chapter aloud";

  function voiceSelect() {
    return (
      <label className="flex h-11 min-w-0 flex-1 items-center px-2">
        <span className="sr-only">Voice on this device</span>
        <select
          value={voices.some((item) => voiceKey(item) === deviceVoice) ? deviceVoice : ""}
          onFocus={() => setVoices(orderedVoices(lang))}
          onChange={(event) => chooseDeviceVoice(event.target.value)}
          className="h-11 w-full min-w-0 max-w-full bg-paper text-sm text-ink"
          aria-label="Voice on this device"
        >
          <option value="">Auto voice</option>
          {voices.map((item) => (
            <option key={voiceKey(item)} value={voiceKey(item)}>
              {item.name} · {item.lang}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function speedControl(wide: boolean) {
    return (
      <label className="read-bar-speed flex h-11 min-w-11 max-w-full shrink-0 items-center gap-2 border-l border-line px-3">
        <span className="text-xs tracking-widest text-gold">SPEED</span>
        <input
          type="range"
          min={50}
          max={150}
          step={1}
          value={Math.min(150, Math.max(50, speed || 100))}
          aria-label="Reading speed"
          aria-valuemin={50}
          aria-valuemax={150}
          aria-valuenow={speed}
          aria-valuetext={`${speed} percent`}
          onFocus={(event) => revealInPanel(event.currentTarget)}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className={`h-11 w-16 accent-gold ${wide ? "sm:w-32" : ""}`}
        />
        <span className="w-11 shrink-0 text-sm tabular-nums text-gold">{speed}%</span>
      </label>
    );
  }

  function cornerButton() {
    if (!cornerReady) return null;
    return (
      <button
        type="button"
        onClick={() => void hold.current?.corner()}
        onFocus={(event) => revealInPanel(event.currentTarget)}
        className="flex min-h-11 min-w-11 shrink-0 items-center whitespace-nowrap px-3 text-garnet"
        aria-label="Keep the reading in the corner over other apps"
      >
        Corner
      </button>
    );
  }

  if (dock === "corner") {
    if (!active) return null;
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end px-3 pb-safe">
        <div className="pointer-events-auto mb-3 flex max-w-[min(100vw-1.5rem,22rem)] items-center border border-line bg-paper">
          <span className="min-w-0 truncate px-3 text-sm text-gold">{playing ? spot || "Reading" : spot ? `Paused · ${spot}` : "Paused"}</span>
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-11 shrink-0 items-center px-2 text-garnet"
            aria-label={playing ? "Pause the reading" : "Resume the reading"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button type="button" onClick={halt} className="flex min-h-11 shrink-0 items-center gap-1 px-3 text-muted">
            <Square className="size-3.5" />
            Stop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-read-bar="" data-kind={wordsMode ? "words" : "chapter"} data-more={more ? "open" : "closed"} className="fixed inset-x-0 bottom-0 z-20 w-full border-t border-line bg-paper pb-safe">
      <div className="read-bar-wide mx-auto hidden w-full min-[481px]:flex max-w-6xl flex-wrap items-center">
        {active ? (
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 whitespace-nowrap border-l-[3px] border-garnet px-3 font-serif text-lg text-garnet"
            aria-label={playing ? "Pause the reading" : "Resume the reading"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {label}
          </button>
        ) : (
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 whitespace-nowrap border-l-[3px] border-garnet px-3 font-serif text-lg text-garnet"
            aria-label={readLabel}
          >
            <Play className="size-4" />
            {label}
          </button>
        )}
        {active ? (
          <button
            type="button"
            onClick={toggleCarry}
            aria-pressed={carry}
            aria-label={carry ? continueOn : continueOff}
            className={`flex min-h-11 min-w-11 shrink-0 items-center whitespace-nowrap px-3 ${carry ? "text-garnet" : "text-muted"}`}
          >
            {carry ? "Continuing" : "Continue"}
          </button>
        ) : null}
        {active ? (
          <button type="button" onClick={halt} className="flex min-h-11 min-w-11 shrink-0 items-center gap-1 whitespace-nowrap px-3 text-muted">
            <Square className="size-3.5" />
            Stop
          </button>
        ) : null}
        {active ? cornerButton() : null}
        <span className="flex h-11 min-w-0 max-w-full shrink items-center overflow-hidden px-3 text-sm text-gold">
          <span className="truncate">{active ? placeText : idleNote}</span>
        </span>
        <div className="flex w-44 max-w-full shrink-0 items-center">
          {voiceSelect()}
          <VoiceMark />
        </div>
        {speedControl(true)}
      </div>

      <div className="read-bar-compact w-full min-[481px]:hidden">
        <div className="relative">
          <div id="read-bar-more" ref={morePanel} hidden={!more} data-scroll={panelScroll} className="border-b border-line">
            <div className="flex min-w-0 items-center">
              {voiceSelect()}
              <VoiceMark />
            </div>
            {speedControl(false)}
            {cornerButton()}
          </div>
          <div data-read-more-hint="" aria-hidden="true" />
        </div>
        {active || idleNote ? (
          <p className="max-w-full truncate px-3 pt-1 text-sm text-gold">{active ? placeText : idleNote}</p>
        ) : null}
        <div className="flex w-full flex-wrap items-center">
          {active ? (
            <button
              type="button"
              onClick={toggle}
              className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 whitespace-nowrap border-l-[3px] border-garnet px-3 font-serif text-lg text-garnet"
              aria-label={playing ? "Pause the reading" : "Resume the reading"}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {label}
            </button>
          ) : (
            <button
              type="button"
              onClick={toggle}
              className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 whitespace-nowrap border-l-[3px] border-garnet px-3 font-serif text-lg text-garnet"
              aria-label={readLabel}
            >
              <Play className="size-4" />
              {label}
            </button>
          )}
          {active ? (
            <button type="button" onClick={halt} className="flex min-h-11 min-w-11 shrink-0 items-center gap-1 whitespace-nowrap px-3 text-muted">
              <Square className="size-3.5" />
              Stop
            </button>
          ) : null}
          {active ? (
            <button
              type="button"
              onClick={toggleCarry}
              aria-pressed={carry}
              aria-label={carry ? continueOn : continueOff}
              className={`flex min-h-11 min-w-11 shrink-0 items-center whitespace-nowrap px-3 ${carry ? "text-garnet" : "text-muted"}`}
            >
              {carry ? "Continuing" : "Continue"}
            </button>
          ) : null}
          <button
            ref={moreButton}
            type="button"
            aria-expanded={more}
            aria-controls="read-bar-more"
            onClick={toggleMore}
            className="flex min-h-11 min-w-11 shrink-0 items-center whitespace-nowrap px-3 text-ink"
          >
            More
          </button>
        </div>
      </div>
      {error && <p className="px-3 pb-2 text-sm text-garnet">{error}</p>}
    </div>
  );
});
