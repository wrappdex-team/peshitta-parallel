import { Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BOOKS } from "@/data/edition";
import { languageById, type LangId } from "@/lib/languages";
import { chapterCount, loadBook, loadParallel } from "@/lib/scripture";
import { readingLines, type VoiceId } from "@/lib/speak";

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
};

type Place = { book: string; chapter: number };
type Line = { v: number; text: string };

function nextPlace(book: string, chapter: number): Place | null {
  const total = chapterCount(book);
  if (chapter < total) return { book, chapter: chapter + 1 };
  const index = BOOKS.findIndex((item) => item.id === book);
  if (index >= 0 && index < BOOKS.length - 1) return { book: BOOKS[index + 1].id, chapter: 1 };
  return null;
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

function findVoice(key: string, lang: LangId) {
  const all = listVoices();
  if (key) {
    const exact = all.find((voice) => voiceKey(voice) === key);
    if (exact) return exact;
  }
  const prefix = languageById(lang).tts.toLowerCase().split("-")[0];
  if (prefix === "syr") return all[0];
  return all.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(prefix)) ?? all[0];
}

function orderedVoices(lang: LangId) {
  const prefix = languageById(lang).tts.toLowerCase().split("-")[0];
  return [...listVoices()].sort((a, b) => {
    const aMatch = prefix !== "syr" && a.lang.toLowerCase().replace("_", "-").startsWith(prefix) ? 0 : 1;
    const bMatch = prefix !== "syr" && b.lang.toLowerCase().replace("_", "-").startsWith(prefix) ? 0 : 1;
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

export function ReadAloud({ book, chapter, deviceVoice, speed, lang, onDeviceVoice, onSpeed, onVerse, onAdvance, onChapter, fromVerse = 1 }: Props) {
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [carry, setCarry] = useState(false);
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
  const deviceVoiceRef = useRef(deviceVoice);
  const speedRef = useRef(speed);
  const langRef = useRef(lang);
  const readyLines = useRef<Line[] | null>(null);
  const fromRef = useRef(fromVerse);
  const resumeOnVisible = useRef(false);
  const stopping = useRef<"none" | "pause" | "halt">("none");
  const loop = useRef(0);
  const runner = useRef<(token: number, at: number) => Promise<void>>(async () => {});
  statusRef.current = status;
  carryRef.current = carry;
  onVerseRef.current = onVerse;
  onAdvanceRef.current = onAdvance;
  onChapterRef.current = onChapter;
  deviceVoiceRef.current = deviceVoice;
  speedRef.current = speed;
  langRef.current = lang;
  fromRef.current = fromVerse;

  function silence() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // The device had already stopped.
    }
  }

  function halt() {
    stopping.current = "halt";
    loop.current += 1;
    resumeOnVisible.current = false;
    run.current += 1;
    lines.current = [];
    index.current = 0;
    spoken.current = null;
    silence();
    setStatus("idle");
    setError("");
    onVerseRef.current(null);
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
    linesFor({ book, chapter }, lang, 1)
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
    };
  }, []);

  useEffect(() => {
    setVoices(orderedVoices(lang));
  }, [lang]);

  function speakPhrase(text: string, token: number) {
    return new Promise<"done" | "stopped">((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth || run.current !== token) {
        resolve("stopped");
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      const picked = findVoice(deviceVoiceRef.current, langRef.current);
      if (picked) {
        utter.voice = picked;
        utter.lang = picked.lang;
      } else {
        const tongue = languageById(langRef.current).tts;
        if (tongue !== "syr") utter.lang = tongue;
      }
      utter.rate = speedRef.current / 100;
      utter.pitch = 1;
      let settled = false;
      const phrase = loop.current;
      const finish = (result: "done" | "stopped") => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      utter.onend = () => finish(loop.current === phrase && stopping.current === "none" && run.current === token ? "done" : "stopped");
      utter.onerror = () => finish("stopped");
      synth.resume();
      synth.speak(utter);
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
        onVerseRef.current(null);
        if (!carryRef.current) {
          spoken.current = null;
          setStatus("idle");
          return;
        }
        const nxt = nextPlace(done.book, done.chapter);
        if (!nxt) {
          spoken.current = null;
          setStatus("idle");
          return;
        }
        spoken.current = { ...nxt, lang: langRef.current };
        onAdvanceRef.current(nxt);
        place.current = nxt;
        lines.current = await linesFor(nxt, langRef.current, 1);
        cursor = 0;
        index.current = 0;
        if (run.current !== token || loop.current !== mine || stopping.current !== "none") return;
        continue;
      }
      index.current = cursor;
      onVerseRef.current(row.v);
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
    if (typeof window.speechSynthesis === "undefined") {
      setError("This device has no speaking voice.");
      return;
    }
    setError("");
    stopping.current = "none";
    const token = ++run.current;
    loop.current += 1;
    const here = { book, chapter };
    place.current = here;
    spoken.current = { ...here, lang };
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    setStatus("playing");
    let rows = readyLines.current;
    if (!rows) {
      try {
        rows = await linesFor(here, lang, 1);
        readyLines.current = rows;
      } catch (err) {
        if (run.current !== token) return;
        spoken.current = null;
        setStatus("idle");
        setError(err instanceof Error ? err.message : "The voice could not read this chapter.");
        return;
      }
    }
    if (run.current !== token) return;
    lines.current = rows;
    const startAt = rows.findIndex((row) => row.v >= from);
    index.current = startAt >= 0 ? startAt : 0;
    // Speak the first words in this tap, before any later wait, or a phone will stay silent.
    const first = rows[index.current];
    if (first) {
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

  function toggle() {
    if (status === "playing") {
      stopping.current = "pause";
      loop.current += 1;
      resumeOnVisible.current = false;
      silence();
      setStatus("paused");
      return;
    }
    if (status === "paused" && lines.current.length) {
      stopping.current = "none";
      resumeOnVisible.current = false;
      setStatus("playing");
      const token = run.current;
      void speakFrom(token, index.current);
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
    function pauseForInterruption() {
      if (statusRef.current !== "playing") return;
      stopping.current = "pause";
      loop.current += 1;
      resumeOnVisible.current = true;
      silence();
      setStatus("paused");
    }
    function resumeAfterInterruption() {
      if (!resumeOnVisible.current || document.visibilityState === "hidden") return;
      resumeOnVisible.current = false;
      if (!lines.current.length) return;
      stopping.current = "none";
      setStatus("playing");
      void runner.current(run.current, index.current);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") pauseForInterruption();
      else resumeAfterInterruption();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", pauseForInterruption);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", pauseForInterruption);
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

  function setSpeed(next: number, restart: boolean) {
    const value = Math.min(150, Math.max(50, Math.round(next)));
    speedRef.current = value;
    onSpeed(value);
    if (!restart) return;
    if (statusRef.current !== "playing" && statusRef.current !== "paused") return;
    window.speechSynthesis?.cancel();
    stopping.current = "none";
    setStatus("playing");
    void speakFrom(run.current, index.current);
  }

  const playing = status === "playing";
  const active = status !== "idle";
  const label = playing ? "Pause" : status === "paused" ? "Resume" : "Read";

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-safe md:static md:z-auto md:border-t-0 md:border-b md:pb-0">
      {active && (
        <div className="mx-auto flex max-w-5xl items-center border-b border-line">
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
            aria-label={carry ? "Stop after this chapter" : "Keep reading through this book and into the next"}
            className={`min-h-11 shrink-0 px-3 ${carry ? "text-garnet" : "text-muted"}`}
          >
            {carry ? "Continuing" : "Continue"}
          </button>
          <button type="button" onClick={halt} className="flex min-h-11 shrink-0 items-center gap-1 px-3 text-muted">
            <Square className="size-3.5" />
            Stop
          </button>
          <span className="ml-auto flex min-h-11 shrink-0 items-center px-3 text-sm text-gold">
            {status === "paused" ? "Paused" : carry ? "Through the book" : "This chapter"}
          </span>
        </div>
      )}
      <div className="toolbar-scroll mx-auto flex max-w-5xl items-center overflow-x-auto">
        {!active && (
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-garnet"
            aria-label={fromVerse > 1 ? "Read from this verse" : "Read this chapter aloud"}
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
            <option value="">This device</option>
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
            onChange={(event) => setSpeed(Number(event.target.value), false)}
            onPointerUp={() => setSpeed(speedRef.current, true)}
            onKeyUp={() => setSpeed(speedRef.current, true)}
            className="h-11 w-32 accent-gold"
          />
          <span className="w-11 text-sm tabular-nums text-gold">{speed}%</span>
        </label>
        <span className="ml-auto flex min-h-11 shrink-0 items-center px-3 text-sm text-gold">
          {status === "idle" && fromVerse > 1 ? `From ${fromVerse}` : status === "idle" ? languageById(lang).label : ""}
        </span>
      </div>
      {error && <p className="px-3 pb-2 text-sm text-garnet">{error}</p>}
    </div>
  );
}
