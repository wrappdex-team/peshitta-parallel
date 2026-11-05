import { Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BOOKS } from "@/data/edition";
import { AGENT_STORE, detectAgent } from "@/lib/agent";
import { languageById, type LangId } from "@/lib/languages";
import { chapterCount, loadBook, loadParallel } from "@/lib/scripture";
import { speakPart, type Cue, type VoiceId } from "@/lib/speak";

type Props = {
  book: string;
  chapter: number;
  voice: VoiceId;
  lang: LangId;
  onVoice: (voice: VoiceId) => void;
  onVerse: (verse: number | null) => void;
  onAdvance: (place: Place) => void;
  onStudio: () => void;
  fromVerse?: number;
};

type Place = { book: string; chapter: number };

type Clip = {
  bytes: ArrayBuffer;
  cues: Cue[];
  duration: number;
  parts: number;
};

type Scheduled = {
  source: AudioBufferSourceNode;
  when: number;
  duration: number;
  cues: Cue[];
  book: string;
  chapter: number;
  ended: boolean;
};

type Hop = Place & { at: number; done: boolean };

type Session = { token: number; place: Place; end: number };

const LEAD = 15;
const memory = new Map<string, Clip>();

function readerAgent() {
  try {
    return localStorage.getItem(AGENT_STORE) || "";
  } catch {
    return "";
  }
}

function keyOf(book: string, chapter: number, voice: VoiceId, lang: LangId, part: number) {
  const kind = readerAgent().slice(0, 6);
  return `${book}.${chapter}.${voice}.${lang}.${part}.${kind}`;
}

function nextPlace(book: string, chapter: number): Place | null {
  const total = chapterCount(book);
  if (chapter < total) return { book, chapter: chapter + 1 };
  const index = BOOKS.findIndex((item) => item.id === book);
  if (index >= 0 && index < BOOKS.length - 1) return { book: BOOKS[index + 1].id, chapter: 1 };
  return null;
}

function bytesFromBase64(audio: string) {
  const bin = atob(audio);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("peshitta-voice", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("parts");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cachedClip(key: string): Promise<Clip | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const req = db.transaction("parts").objectStore("parts").get(key);
    req.onsuccess = () => {
      const value = req.result as Clip | undefined;
      if (value?.bytes) {
        memory.set(key, value);
        resolve(value);
      } else resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

async function storeClip(key: string, clip: Clip) {
  memory.set(key, clip);
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction("parts", "readwrite").objectStore("parts").put(clip, key);
  } catch {
    // A full disk should not stop the reading already in memory.
  }
}

function abortError() {
  return new DOMException("The reading was stopped.", "AbortError");
}

function isAbortError(err: unknown) {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /AbortError|operation was aborted|signal is aborted/i.test(message);
}

function isTransportError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /content-type|failed to fetch|network|load failed|timed out|timeout|econn|socket|cut off|body stream|failed to load|invariant failed/i.test(message);
}

function calm(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (!message || isTransportError(err) || /invariant failed/i.test(message)) {
    return "The voice was cut off. Press Read to continue.";
  }
  return message;
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function waitUntilUsable(signal: AbortSignal) {
  if (!document.hidden && navigator.onLine !== false) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const maybe = () => {
      if (!document.hidden && navigator.onLine !== false) {
        cleanup();
        resolve();
      }
    };
    function cleanup() {
      signal.removeEventListener("abort", onAbort);
      document.removeEventListener("visibilitychange", maybe);
      window.removeEventListener("online", maybe);
    }
    signal.addEventListener("abort", onAbort, { once: true });
    document.addEventListener("visibilitychange", maybe);
    window.addEventListener("online", maybe);
  });
}

async function forgetClip(key: string) {
  memory.delete(key);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const req = db.transaction("parts", "readwrite").objectStore("parts").delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function loadClip(book: string, chapter: number, voice: VoiceId, lang: LangId, part: number, signal: AbortSignal): Promise<Clip> {
  const key = keyOf(book, chapter, voice, lang, part);
  const saved = await cachedClip(key);
  if (signal.aborted) throw abortError();
  if (saved) return saved;
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw abortError();
    try {
      const result = await speakPart({ data: { book, chapter, voice, lang, part, agentKey: readerAgent() }, signal });
      if (signal.aborted) throw abortError();
      if (!result.ok) throw new Error(result.error);
      const clip: Clip = {
        bytes: bytesFromBase64(result.audio),
        cues: result.cues,
        duration: result.duration,
        parts: result.parts,
      };
      await storeClip(key, clip);
      return clip;
    } catch (err) {
      if (signal.aborted || isAbortError(err)) throw abortError();
      last = err;
      if (!isTransportError(err) || attempt === 2) throw err;
      await waitUntilUsable(signal);
      await wait(450 * (attempt + 1), signal);
    }
  }
  throw last instanceof Error ? last : new Error("The voice was cut off. Press Read to continue.");
}

export function ReadAloud({ book, chapter, voice, lang, onVoice, onVerse, onAdvance, onStudio, fromVerse = 1 }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [carry, setCarry] = useState(false);
  const [error, setError] = useState("");
  const [agentOn, setAgentOn] = useState(false);
  const [draft, setDraft] = useState("");
  const ctxRef = useRef<AudioContext | null>(null);
  const run = useRef(0);
  const chainGen = useRef(0);
  const fetching = useRef(false);
  const chaining = useRef(false);
  const scheduled = useRef<Scheduled[]>([]);
  const hops = useRef<Hop[]>([]);
  const session = useRef<Session | null>(null);
  const spoken = useRef<(Place & { voice: VoiceId; lang: LangId }) | null>(null);
  const statusRef = useRef(status);
  const carryRef = useRef(carry);
  const onVerseRef = useRef(onVerse);
  const onAdvanceRef = useRef(onAdvance);
  const bookRef = useRef(book);
  const chapterRef = useRef(chapter);
  const voiceRef = useRef(voice);
  const langRef = useRef(lang);
  const flight = useRef<AbortController | null>(null);
  const hold = useRef(false);
  const resumeOnVisible = useRef(false);
  const pausedAt = useRef(0);
  const chainTries = useRef(0);
  const fromRef = useRef(fromVerse);
  statusRef.current = status;
  carryRef.current = carry;
  onVerseRef.current = onVerse;
  onAdvanceRef.current = onAdvance;
  bookRef.current = book;
  chapterRef.current = chapter;
  voiceRef.current = voice;
  langRef.current = lang;
  fromRef.current = fromVerse;

  function stopSources() {
    for (const item of scheduled.current) {
      try {
        item.source.onended = null;
        item.source.stop();
      } catch {
        // already ended
      }
    }
    scheduled.current = [];
  }

  function markPausedClock() {
    const ctx = ctxRef.current;
    if (ctx) pausedAt.current = ctx.currentTime;
  }

  function onContextState() {
    const ctx = ctxRef.current;
    if (!ctx || hold.current) return;
    const state = ctx.state as string;
    if ((state === "suspended" || state === "interrupted") && (statusRef.current === "playing" || statusRef.current === "loading")) {
      markPausedClock();
      resumeOnVisible.current = true;
      setStatus("paused");
      setError("");
      return;
    }
    if (state === "running" && resumeOnVisible.current && statusRef.current === "paused") {
      resumeOnVisible.current = false;
      revive(ctx);
      setStatus("playing");
    }
  }

  function ensureCtx() {
    const existing = ctxRef.current;
    if (existing) return existing;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    ctx.addEventListener("statechange", onContextState);
    ctxRef.current = ctx;
    return ctx;
  }

  function abortFlight() {
    flight.current?.abort();
    flight.current = null;
  }

  function nextFlight() {
    abortFlight();
    const controller = new AbortController();
    flight.current = controller;
    return controller;
  }

  function activeSignal() {
    if (!flight.current || flight.current.signal.aborted) return nextFlight().signal;
    return flight.current.signal;
  }

  function revive(ctx: AudioContext) {
    const mark = pausedAt.current || ctx.currentTime;
    let cursor = ctx.currentTime + 0.06;
    const items = [...scheduled.current].sort((a, b) => a.when - b.when);
    for (const item of items) {
      const started = mark >= item.when - 0.05;
      const offset = started ? Math.min(item.duration, Math.max(0, mark - item.when)) : 0;
      const remaining = item.duration - offset;
      const stillQueued = !item.ended && item.when + item.duration > ctx.currentTime + 0.15;
      if (stillQueued && remaining > 0.2) {
        cursor = Math.max(cursor, item.when + item.duration);
        continue;
      }
      if (remaining < 0.3 || !item.source.buffer) continue;
      try {
        item.source.onended = null;
        item.source.stop();
      } catch {
        // The phone already stopped this buffer.
      }
      const source = ctx.createBufferSource();
      source.buffer = item.source.buffer;
      source.connect(ctx.destination);
      const startAt = Math.max(cursor, ctx.currentTime + 0.05);
      source.start(startAt, offset);
      source.onended = () => {
        if (item.source === source) item.ended = true;
      };
      item.source = source;
      item.when = startAt - offset;
      item.ended = false;
      cursor = startAt + remaining;
    }
    for (const hop of hops.current) {
      if (hop.done) continue;
      const item = scheduled.current.find((entry) => entry.book === hop.book && entry.chapter === hop.chapter);
      if (item) hop.at = item.when;
    }
    const live = session.current;
    if (live) live.end = endOf(live.place);
  }

  function halt() {
    abortFlight();
    resumeOnVisible.current = false;
    chainTries.current = 0;
    run.current += 1;
    chainGen.current += 1;
    fetching.current = false;
    chaining.current = false;
    hops.current = [];
    session.current = null;
    spoken.current = null;
    stopSources();
    hold.current = true;
    void ctxRef.current?.suspend().finally(() => {
      hold.current = false;
    });
    setStatus("idle");
    setError("");
    onVerseRef.current(null);
  }

  function endOf(place: Place) {
    let end = 0;
    for (const item of scheduled.current) {
      if (item.book === place.book && item.chapter === place.chapter) {
        end = Math.max(end, item.when + item.duration);
      }
    }
    return end;
  }

  function dropFuture() {
    const here = { book: bookRef.current, chapter: chapterRef.current };
    const now = ctxRef.current?.currentTime ?? 0;
    const keep: Scheduled[] = [];
    for (const item of scheduled.current) {
      const other = item.book !== here.book || item.chapter !== here.chapter;
      if (other && item.when + item.duration > now - 0.05) {
        try {
          item.source.onended = null;
          item.source.stop();
        } catch {
          // already ended
        }
      } else keep.push(item);
    }
    scheduled.current = keep;
    hops.current = [];
    const live = session.current;
    if (live && live.token === run.current) {
      session.current = { token: live.token, place: here, end: endOf(here) };
    }
  }

  useEffect(() => {
    setAgentOn(Boolean(detectAgent(readerAgent())));
  }, []);

  useEffect(() => {
    const place = spoken.current;
    if (place && place.book === book && place.chapter === chapter && place.voice === voice && place.lang === lang) return;
    halt();
    // A new chapter, voice, or language must not keep speaking the previous one.
    // An automatic advance sets `spoken` first, so the reading continues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter, voice, lang]);

  useEffect(() => {
    return () => {
      flight.current?.abort();
      run.current += 1;
      chainGen.current += 1;
      fetching.current = false;
      stopSources();
      const ctx = ctxRef.current;
      void ctx?.close();
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => {
    function pauseForInterruption() {
      if (statusRef.current !== "playing" && statusRef.current !== "loading") return;
      markPausedClock();
      resumeOnVisible.current = true;
      const ctx = ctxRef.current;
      if (ctx && (ctx.state as string) === "running") {
        hold.current = true;
        void ctx.suspend().finally(() => {
          hold.current = false;
        });
      }
      setStatus("paused");
      setError("");
    }
    function resumeAfterInterruption() {
      if (!resumeOnVisible.current || document.visibilityState === "hidden") return;
      resumeOnVisible.current = false;
      const ctx = ctxRef.current;
      if (!ctx) return;
      hold.current = true;
      void ctx.resume().then(() => {
        hold.current = false;
        if ((ctx.state as string) !== "running") {
          resumeOnVisible.current = true;
          setStatus("paused");
          return;
        }
        revive(ctx);
        setStatus("playing");
      }).catch(() => {
        hold.current = false;
        resumeOnVisible.current = true;
        setStatus("paused");
      });
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") pauseForInterruption();
      else resumeAfterInterruption();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", pauseForInterruption);
    window.addEventListener("pageshow", resumeAfterInterruption);
    window.addEventListener("online", resumeAfterInterruption);
    document.addEventListener("freeze", pauseForInterruption);
    document.addEventListener("resume", resumeAfterInterruption);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", pauseForInterruption);
      window.removeEventListener("pageshow", resumeAfterInterruption);
      window.removeEventListener("online", resumeAfterInterruption);
      document.removeEventListener("freeze", pauseForInterruption);
      document.removeEventListener("resume", resumeAfterInterruption);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last: number | null = null;
    const tick = () => {
      const ctx = ctxRef.current;
      if (ctx && statusRef.current === "playing") {
        const time = ctx.currentTime;
        let verse: number | null = null;
        let pending = false;
        let bestStart = -1;
        for (const item of scheduled.current) {
          const local = time - item.when;
          if (local >= 0 && local <= item.duration + 0.05 && item.when >= bestStart) {
            bestStart = item.when;
            verse = null;
            for (const cue of item.cues) {
              if (local >= cue.start && local < cue.end + 0.04) verse = cue.v;
            }
          }
          if (item.when > time) pending = true;
        }
        if (verse !== last) {
          last = verse;
          onVerseRef.current(verse);
        }
        for (const hop of hops.current) {
          if (hop.done || time < hop.at - 0.03) continue;
          hop.done = true;
          const here = spoken.current;
          if (!here || here.book !== hop.book || here.chapter !== hop.chapter) {
            spoken.current = { book: hop.book, chapter: hop.chapter, voice: voiceRef.current, lang: langRef.current };
            onAdvanceRef.current({ book: hop.book, chapter: hop.chapter });
          }
        }
        const lastPiece = scheduled.current[scheduled.current.length - 1];
        const finished = !fetching.current && scheduled.current.length > 0 && !pending && !!lastPiece && time > lastPiece.when + lastPiece.duration + 0.2;
        if (finished) {
          spoken.current = null;
          session.current = null;
          setStatus("idle");
          onVerseRef.current(null);
          last = null;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function waitUntil(ctx: AudioContext, time: number, token: number, gen: number) {
    return new Promise<void>((resolve) => {
      const step = () => {
        if (run.current !== token || chainGen.current !== gen || !carryRef.current) {
          resolve();
          return;
        }
        if (ctx.currentTime >= time) {
          resolve();
          return;
        }
        window.setTimeout(step, 200);
      };
      step();
    });
  }

  async function playChapter(place: Place, when: number, token: number, live: () => boolean, arm: boolean, signal: AbortSignal, from = 1) {
    const ctx = ctxRef.current;
    if (!ctx) return when;
    let part = 0;
    let parts = 1;
    let cursor = when;
    let armed = false;
    while (part < parts) {
      if (run.current !== token || !live() || signal.aborted) return cursor;
      if (document.hidden && ctx.state === "running") {
        markPausedClock();
        resumeOnVisible.current = true;
        hold.current = true;
        await ctx.suspend();
        hold.current = false;
        setStatus("paused");
      }
      const clipKey = keyOf(place.book, place.chapter, voiceRef.current, langRef.current, part);
      let clip = await loadClip(place.book, place.chapter, voiceRef.current, langRef.current, part, signal);
      if (run.current !== token || !live() || signal.aborted) return cursor;
      parts = clip.parts;
      let audio: AudioBuffer;
      try {
        audio = await ctx.decodeAudioData(clip.bytes.slice(0));
      } catch (err) {
        await forgetClip(clipKey);
        if (signal.aborted || !live() || run.current !== token) return cursor;
        clip = await loadClip(place.book, place.chapter, voiceRef.current, langRef.current, part, signal);
        if (run.current !== token || !live() || signal.aborted) return cursor;
        parts = clip.parts;
        try {
          audio = await ctx.decodeAudioData(clip.bytes.slice(0));
        } catch {
          throw err instanceof Error ? err : new Error("The voice was cut off. Press Read to continue.");
        }
      }
      if (run.current !== token || !live() || signal.aborted) return cursor;
      let offset = 0;
      if (from > 1) {
        const cue = clip.cues.find((item) => item.v >= from);
        if (!cue) {
          part += 1;
          continue;
        }
        offset = Math.min(Math.max(0, cue.start), Math.max(0, audio.duration - 0.25));
        from = 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.connect(ctx.destination);
      const startAt = Math.max(cursor, ctx.currentTime + 0.05);
      const item: Scheduled = {
        source,
        when: startAt - offset,
        duration: audio.duration,
        cues: clip.cues,
        book: place.book,
        chapter: place.chapter,
        ended: false,
      };
      source.onended = () => {
        if (item.source === source) item.ended = true;
      };
      source.start(startAt, offset);
      scheduled.current.push(item);
      if (arm && !armed) {
        hops.current.push({ book: place.book, chapter: place.chapter, at: startAt, done: false });
        armed = true;
      }
      cursor = startAt + Math.max(0.1, audio.duration - offset);
      if ((ctx.state as string) === "running") setStatus("playing");
      part += 1;
    }
    return cursor;
  }

  async function runChain(token: number, signal: AbortSignal) {
    if (chaining.current || !carryRef.current || signal.aborted) return;
    const ctx = ctxRef.current;
    const seeded = session.current;
    if (!ctx || !seeded || seeded.token !== token) return;
    chaining.current = true;
    fetching.current = true;
    const gen = chainGen.current;
    let retry = false;
    try {
      let place = seeded.place;
      let end = seeded.end;
      while (run.current === token && chainGen.current === gen && carryRef.current && !signal.aborted) {
        const nxt = nextPlace(place.book, place.chapter);
        if (!nxt) break;
        await waitUntil(ctx, end - LEAD, token, gen);
        if (run.current !== token || chainGen.current !== gen || !carryRef.current || signal.aborted) break;
        void loadBook(nxt.book).catch(() => {});
        if (langRef.current !== "en") void loadParallel(langRef.current, nxt.book).catch(() => {});
        const nextEnd = await playChapter(
          nxt,
          end,
          token,
          () => run.current === token && chainGen.current === gen && carryRef.current && !signal.aborted,
          true,
          signal,
        );
        if (run.current !== token || chainGen.current !== gen || !carryRef.current || signal.aborted) break;
        chainTries.current = 0;
        place = nxt;
        end = nextEnd;
        session.current = { token, place, end };
      }
    } catch (err) {
      if (run.current !== token || signal.aborted || isAbortError(err)) return;
      if (isTransportError(err) && carryRef.current && chainTries.current < 3) {
        chainTries.current += 1;
        setError("");
        retry = true;
        return;
      }
      setError(calm(err));
    } finally {
      const aborted = chainGen.current !== gen;
      chaining.current = false;
      if (run.current === token) fetching.current = false;
      if (retry && run.current === token && carryRef.current && !signal.aborted) {
        void (async () => {
          try {
            await waitUntilUsable(signal);
            await wait(800, signal);
          } catch {
            return;
          }
          if (run.current === token && carryRef.current && !signal.aborted) void runChain(token, signal);
        })();
        return;
      }
      if (aborted && run.current === token && carryRef.current && !signal.aborted) void runChain(token, signal);
    }
  }

  async function start() {
    setError("");
    chainTries.current = 0;
    const controller = nextFlight();
    const token = ++run.current;
    chainGen.current += 1;
    hops.current = [];
    session.current = null;
    stopSources();
    const ctx = ensureCtx();
    hold.current = true;
    try {
      if ((ctx.state as string) !== "running") await ctx.resume();
    } catch {
      // A phone interruption can refuse resume until the next tap.
    } finally {
      hold.current = false;
    }
    if (controller.signal.aborted || run.current !== token) return;
    spoken.current = { book, chapter, voice, lang };
    if (document.hidden) {
      markPausedClock();
      resumeOnVisible.current = true;
      setStatus("paused");
    } else {
      setStatus("loading");
    }
    fetching.current = true;

    try {
      const from = Math.max(1, fromRef.current || 1);
      let end = await playChapter(
        { book, chapter },
        ctx.currentTime + 0.06,
        token,
        () => run.current === token && !controller.signal.aborted,
        false,
        controller.signal,
        from,
      );
      if (run.current === token && !controller.signal.aborted && from > 1 && scheduled.current.length === 0) {
        end = await playChapter(
          { book, chapter },
          ctx.currentTime + 0.06,
          token,
          () => run.current === token && !controller.signal.aborted,
          false,
          controller.signal,
          1,
        );
      }
      if (run.current !== token || controller.signal.aborted) return;
      session.current = { token, place: { book, chapter }, end };
      if ((ctx.state as string) === "running") setStatus("playing");
      if (carryRef.current) await runChain(token, controller.signal);
    } catch (err) {
      if (run.current !== token || controller.signal.aborted || isAbortError(err)) return;
      if (isTransportError(err) && scheduled.current.length > 0) {
        setError("");
        if ((ctx.state as string) !== "running") {
          markPausedClock();
          resumeOnVisible.current = true;
          setStatus("paused");
        }
        return;
      }
      stopSources();
      spoken.current = null;
      session.current = null;
      setStatus("idle");
      onVerseRef.current(null);
      setError(calm(err));
    } finally {
      if (run.current === token && !chaining.current) fetching.current = false;
    }
  }

  async function toggle() {
    if (status === "loading") return;
    if (status === "playing") {
      resumeOnVisible.current = false;
      markPausedClock();
      hold.current = true;
      try {
        await ctxRef.current?.suspend();
      } finally {
        hold.current = false;
      }
      setStatus("paused");
      return;
    }
    if (status === "paused") {
      resumeOnVisible.current = false;
      const ctx = ctxRef.current;
      if (!ctx || scheduled.current.length === 0) {
        await start();
        return;
      }
      hold.current = true;
      try {
        await ctx.resume();
        if ((ctx.state as string) === "running") revive(ctx);
      } finally {
        hold.current = false;
      }
      setStatus((ctx.state as string) === "running" ? "playing" : "paused");
      return;
    }
    await start();
  }

  function toggleCarry() {
    const next = !carryRef.current;
    carryRef.current = next;
    setCarry(next);
    if (!next) {
      chainGen.current += 1;
      dropFuture();
      return;
    }
    const live = session.current;
    if (live && live.token === run.current) void runChain(live.token, activeSignal());
  }

  const playing = status === "playing";
  const label = status === "loading" ? "Preparing" : playing ? "Pause" : status === "paused" ? "Resume" : "Read";

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-safe md:static md:z-auto md:border-t-0 md:border-b md:pb-0">
      <div className="toolbar-scroll mx-auto flex max-w-5xl items-center overflow-x-auto">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={status === "loading"}
          className="flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-garnet disabled:opacity-60"
          aria-label={playing ? "Pause the reading" : status === "paused" ? "Resume the reading" : fromVerse > 1 ? "Read from this verse" : "Read this chapter aloud"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {label}
        </button>
        <VoiceButton name="Ara" detail="warm" active={voice === "ara"} onClick={() => onVoice("ara")} />
        <VoiceButton name="Rex" detail="clear" active={voice === "rex"} onClick={() => onVoice("rex")} />
        <button
          type="button"
          onClick={toggleCarry}
          aria-pressed={carry}
          aria-label={carry ? "Stop after this chapter" : "Continue into the next chapter"}
          className={`min-h-11 shrink-0 px-3 ${carry ? "text-garnet" : "text-muted"}`}
        >
          Continue
        </button>
        {status !== "idle" && (
          <button type="button" onClick={halt} className="flex min-h-11 shrink-0 items-center gap-1 px-3 text-muted">
            <Square className="size-3.5" />
            Stop
          </button>
        )}
        <button type="button" onClick={onStudio} className="min-h-11 shrink-0 px-3 text-muted">
          Studio
        </button>
        <span className="ml-auto flex min-h-11 shrink-0 items-center px-3 text-sm text-gold">
          {status === "loading" ? "Preparing the voice…" : status === "paused" ? "Paused" : carry && playing ? "Continues" : status === "idle" && fromVerse > 1 ? `From ${fromVerse}` : status === "idle" ? languageById(lang).label : ""}
        </span>
      </div>
      {error && <p className="px-3 pb-2 text-sm text-garnet">{error}</p>}
      {!agentOn && (
        <form
          className="flex gap-2 px-3 pb-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = draft.trim();
            if (!detectAgent(next)) {
              setError("Use an xAI key (xai-), an OpenAI key (sk-), or a Claude key (sk-ant-).");
              return;
            }
            localStorage.setItem(AGENT_STORE, next);
            setDraft("");
            setAgentOn(true);
            setError("");
          }}
        >
          <input
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Connect xAI, OpenAI, or Claude"
            autoComplete="off"
            className="min-h-11 flex-1 border border-line bg-raised px-3 text-ink"
          />
          <button type="submit" className="min-h-11 bg-garnet px-3 text-paper">
            Connect
          </button>
        </form>
      )}
    </div>
  );
}

function VoiceButton({
  name,
  detail,
  active,
  onClick,
}: {
  name: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}, ${detail} voice`}
      aria-pressed={active}
      className={`min-h-11 shrink-0 px-3 ${active ? "text-garnet" : "text-muted"}`}
    >
      {name}
      <span className="ml-1 hidden text-sm text-muted sm:inline">{detail}</span>
    </button>
  );
}
