import { Pause, Play, Square } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BOOKS } from "@/data/edition";
import { languageById, type LangId } from "@/lib/languages";
import { chapterCount, loadBook, loadParallel } from "@/lib/scripture";
import { readingLines, type VoiceId } from "@/lib/speak";
import { holdReading, type ReadingHold } from "@/lib/keep-reading";

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
  kind?: "chapter" | "words";
};

type Place = { book: string; chapter: number };

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
  const doc = await loadBook(place.book);
  const verses = doc.chapters[place.chapter - 1];
  if (!verses) throw new Error("That chapter is not in this book.");
  const lines = lang === "en" ? verses.map((verse) => verse.en) : (await loadParallel(lang, place.book))?.[place.chapter - 1];
  if (!lines) throw new Error("That language is not ready for this chapter yet.");
  const rows = readingLines(place.book, place.chapter, verses, lines, lang, from);
  if (!rows.length) throw new Error("This chapter has nothing to read in that language.");
  return rows;
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
  pin = false,
  kind = "chapter",
}: Props, ref) {
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [carry, setCarry] = useState(false);
  const [cornerReady, setCornerReady] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
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
  const marks = useRef<{ t: number; cursor: number; phrase: number; book: string; chapter: number; verse: number }[]>([]);
  const phraseFrom = useRef(0);
  const stopping = useRef<"none" | "pause" | "halt">("none");
  const loop = useRef(0);
  const runner = useRef<(token: number, at: number) => Promise<void>>(async () => {});
  const startRef = useRef<(from: number) => Promise<void>>(async () => {});
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
  langRef.current = lang;
  fromRef.current = fromVerse;
  startKeyRef.current = startKey;

  function heard(row: Line | null) {
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
    const chapter = row.chapter ?? place.current.chapter;
    hold.current?.caption({
      text: row.text,
      place: placeLabel(place.current.book, chapter, row.v),
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
      onBack: () => void back15(),
    });
  }

  function pauseReading() {
    if (statusRef.current !== "playing") return;
    stopping.current = "pause";
    loop.current += 1;
    silence();
    releaseHold();
    setStatus("paused");
  }

  function resumeReading() {
    if (statusRef.current !== "paused" || !lines.current.length) return;
    stopping.current = "none";
    takeHold();
    setStatus("playing");
    void speakFrom(run.current, index.current);
  }

  function halt() {
    stopping.current = "halt";
    loop.current += 1;
    run.current += 1;
    lines.current = [];
    index.current = 0;
    spoken.current = null;
    marks.current = [];
    silence();
    releaseHold();
    setStatus("idle");
    setError("");
    heard(null);
  }

  useEffect(() => {
    const here = spoken.current;
    if (here && here.book === book && here.chapter === chapter && here.lang === lang) return;
    halt();
    // A new chapter, voice, or language must not keep speaking the previous one.
    // An automatic advance sets `spoken` first, so the reading continues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter, lang]);

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
        if ((reason === "interrupted" || reason === "canceled") && document.visibilityState === "visible") {
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

  function note(row: Line, phrase: number, cursor: number) {
    marks.current.push({
      t: Date.now(),
      cursor,
      phrase,
      book: place.current.book,
      chapter: row.chapter ?? place.current.chapter,
      verse: row.v,
    });
    if (marks.current.length > 120) marks.current.splice(0, marks.current.length - 120);
  }

  async function back15() {
    if (statusRef.current === "idle" || !marks.current.length) return;
    const aim = Date.now() - 15000;
    let hit = marks.current[0];
    for (const mark of marks.current) {
      if (mark.t <= aim) hit = mark;
    }
    const token = run.current;
    stopping.current = "none";
    loop.current += 1;
    silence();
    if (statusRef.current !== "playing") {
      takeHold();
      setStatus("playing");
    }
    if (hit.book !== place.current.book || hit.chapter !== place.current.chapter) {
      const there = { book: hit.book, chapter: hit.chapter };
      place.current = there;
      spoken.current = { ...there, lang: langRef.current };
      onAdvanceRef.current(there);
      try {
        lines.current = await loadRows(there, langRef.current);
      } catch {
        return;
      }
    }
    if (run.current !== token || stopping.current !== "none") return;
    const cursor = lines.current.findIndex((row) => (row.chapter ?? hit.chapter) === hit.chapter && row.v === hit.verse);
    const at = cursor >= 0 ? cursor : Math.min(hit.cursor, Math.max(0, lines.current.length - 1));
    phraseFrom.current = hit.phrase;
    index.current = at;
    void speakFrom(token, at);
  }

  async function speakFrom(token: number, startAt: number) {
    const mine = ++loop.current;
    let cursor = startAt;
    let skip = phraseFrom.current;
    phraseFrom.current = 0;
    while (run.current === token && loop.current === mine && stopping.current === "none") {
      const row = lines.current[cursor];
      if (!row) {
        const done = place.current;
        onChapterRef.current?.(done);
        heard(null);
        if (!carryRef.current) {
          spoken.current = null;
          releaseHold();
          setStatus("idle");
          return;
        }
        const nxt = nextPlaceOfRef.current ? nextPlaceOfRef.current(done) : nextPlace(done.book, done.chapter);
        if (!nxt) {
          spoken.current = null;
          releaseHold();
          setStatus("idle");
          return;
        }
        spoken.current = { ...nxt, lang: langRef.current };
        onAdvanceRef.current(nxt);
        place.current = nxt;
        try {
          lines.current = await loadRows(nxt, langRef.current);
        } catch (err) {
          if (run.current !== token) return;
          spoken.current = null;
          releaseHold();
          setStatus("idle");
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
      const parts = phrases(row.text);
      for (let phraseAt = 0; phraseAt < parts.length; phraseAt += 1) {
        if (skip > 0) {
          skip -= 1;
          continue;
        }
        if (run.current !== token || loop.current !== mine || stopping.current !== "none") return;
        note(row, phraseAt, cursor);
        const result = await speakPhrase(parts[phraseAt], token);
        if (result !== "done" || run.current !== token || loop.current !== mine || stopping.current !== "none") return;
      }
      skip = 0;
      cursor += 1;
    }
  }

  runner.current = speakFrom;

  async function start(from: number) {
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
        spoken.current = null;
        releaseHold();
        setStatus("idle");
        setError(err instanceof Error ? err.message : "The voice could not read this chapter.");
        return;
      }
    }
    if (run.current !== token) return;
    lines.current = rows;
    const startAt = locate(rows, from, startKeyRef.current);
    index.current = startAt;
    marks.current = [];
    phraseFrom.current = 0;
    // Speak the first words in this tap, before any later wait, or a phone will stay silent.
    const first = rows[index.current];
    if (first) {
      heard(first);
      const parts = phrases(first.text);
      note(first, 0, index.current);
      const opened = speakPhrase(parts[0] ?? first.text, token);
      const head = await opened;
      if (head !== "done" || run.current !== token || stopping.current !== "none") return;
      for (let phraseAt = 1; phraseAt < parts.length; phraseAt += 1) {
        if (run.current !== token || stopping.current !== "none") return;
        note(first, phraseAt, index.current);
        const result = await speakPhrase(parts[phraseAt], token);
        if (result !== "done" || run.current !== token || stopping.current !== "none") return;
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
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      if (statusRef.current !== "playing" || stopping.current !== "none") return;
      const synth = window.speechSynthesis;
      if (!synth || synth.speaking || synth.pending || !lines.current.length) return;
      loop.current += 1;
      void runner.current(run.current, index.current);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  function chooseDeviceVoice(next: string) {
    deviceVoiceRef.current = next;
    onDeviceVoice(next);
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    if (statusRef.current === "playing" || statusRef.current === "paused") {
      stopping.current = "none";
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

  return (
    <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-safe ${pin ? "" : "md:static md:z-auto md:border-t-0 md:border-b md:pb-0"}`}>
      {active && (
        <div className="mx-auto flex max-w-5xl items-center border-b border-line">
          <button
            type="button"
            onClick={() => void back15()}
            className="min-h-11 shrink-0 px-3 text-garnet"
            aria-label="Hear the last 15 seconds again"
          >
            15s
          </button>
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-garnet"
            aria-label={playing ? "Pause the reading" : "Resume the reading"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {label}
          </button>
          <button
            type="button"
            onClick={toggleCarry}
            aria-pressed={carry}
            aria-label={carry ? continueOn : continueOff}
            className={`min-h-11 shrink-0 px-3 ${carry ? "text-garnet" : "text-muted"}`}
          >
            {carry ? "Continuing" : "Continue"}
          </button>
          <button type="button" onClick={halt} className="flex min-h-11 shrink-0 items-center gap-1 px-3 text-muted">
            <Square className="size-3.5" />
            Stop
          </button>
          {cornerReady ? (
            <button
              type="button"
              onClick={() => void hold.current?.corner()}
              className="min-h-11 shrink-0 px-3 text-garnet"
              aria-label="Keep the reading in the corner over other apps"
            >
              Corner
            </button>
          ) : null}
          <span className="ml-auto flex min-h-11 shrink-0 items-center px-3 text-sm text-gold">
            {status === "paused" ? "Paused" : carry ? throughLabel : hereLabel}
          </span>
        </div>
      )}
      <div className="toolbar-scroll mx-auto flex max-w-5xl items-center overflow-x-auto">
        {!active && (
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-garnet"
            aria-label={wordsMode ? "Read these words aloud" : fromVerse > 1 ? "Read from this verse" : "Read this chapter aloud"}
          >
            <Play className="size-4" />
            {label}
          </button>
        )}
        <label className="flex min-h-11 shrink-0 items-center px-2">
          <span className="sr-only">Voice on this device</span>
          <select
            value={voices.some((item) => voiceKey(item) === deviceVoice) ? deviceVoice : ""}
            onFocus={() => setVoices(orderedVoices(lang))}
            onChange={(event) => chooseDeviceVoice(event.target.value)}
            className="max-w-[11rem] min-h-11 bg-paper text-sm text-ink"
            aria-label="Voice on this device"
          >
            <option value="">Automatic language match</option>
            {voices.map((item) => (
              <option key={voiceKey(item)} value={voiceKey(item)}>
                {item.name} · {item.lang}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 shrink-0 items-center gap-2 px-3">
          <span className="text-xs tracking-widest text-muted">SPEED</span>
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
            onChange={(event) => setSpeed(Number(event.target.value))}
            className="h-11 w-32 accent-gold"
          />
          <span className="w-11 text-sm tabular-nums text-gold">{speed}%</span>
        </label>
        <span className="ml-auto flex min-h-11 shrink-0 items-center px-3 text-sm text-gold">
          {status === "idle" && fromLabel ? fromLabel : status === "idle" && fromVerse > 1 ? `From ${fromVerse}` : status === "idle" ? languageById(lang).label : ""}
        </span>
      </div>
      <details className="mx-auto max-w-5xl px-3 text-sm text-muted">
        <summary className="min-h-11 cursor-pointer py-3 text-garnet">Voice setup help</summary>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pb-4">
          <p>Read uses your browser’s device speech, without a provider key. Studio creates media through a paid provider using your own key. INjeel cannot install voices or guarantee any accent, language, or Syriac voice. System settings and voices exposed to a browser can differ.</p>
          <p><strong>iPhone and iPad:</strong> In Settings → Accessibility, look for Read &amp; Speak → Voices (called Spoken Content on older versions). Choose a language and dialect. For downloadable enhanced voices, Apple also documents VoiceOver → Speech → Add New Language; choose a voice/quality and allow the download to finish on Wi-Fi. You do not need to enable VoiceOver to use INjeel. <a className="underline" href="https://support.apple.com/guide/iphone/hear-whats-on-the-screen-or-typed-iph96b214f0/ios">Apple’s current guide</a> · <a className="underline" href="https://support.apple.com/en-us/111798">iOS/iPadOS voice downloads</a></p>
          <p><strong>Android:</strong> Open Settings → Accessibility → Text-to-speech output. Choose the preferred engine and language; use its voice-data/download options where available. Names and paths vary by manufacturer/engine; search Settings for “text-to-speech” if needed. <a className="underline" href="https://support.google.com/accessibility/android/answer/6006983?hl=en">Google’s settings and voice-data guide</a></p>
          <p><strong>macOS:</strong> Apple menu → System Settings → Accessibility → Read &amp; Speak. Choose System voice; open its additional voice controls to browse languages, country/region variants and downloadable voices. Wait until downloads finish, then choose the voice. Older versions may use Spoken Content. <a className="underline" href="https://support.apple.com/guide/mac-help/mchlp2290/mac">Apple’s Mac voice guide</a></p>
          <p>Return here and reopen the voice selector. If new voices do not appear, refresh or reopen the app/browser. Select the voice and adjust Speed here; a system default need not override an explicit app selection. Android browsers may use their speech engine rather than a forced voice. Some voices use network services; availability and pronunciation depend on your device/browser, not the scripture’s historical pronunciation.</p>
        </div>
      </details>
      {error && <p className="px-3 pb-2 text-sm text-garnet">{error}</p>}
    </div>
  );
});
