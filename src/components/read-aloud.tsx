import { Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { speakPart, type Cue, type VoiceId } from "@/lib/speak";
import { languageById, type LangId } from "@/lib/languages";

type Props = {
  book: string;
  chapter: number;
  voice: VoiceId;
  lang: LangId;
  onVoice: (voice: VoiceId) => void;
  onVerse: (verse: number | null) => void;
};

type Clip = {
  bytes: ArrayBuffer;
  cues: Cue[];
  duration: number;
  parts: number;
};

const memory = new Map<string, Clip>();

function keyOf(book: string, chapter: number, voice: VoiceId, lang: LangId, part: number) {
  return `${book}.${chapter}.${voice}.${lang}.${part}`;
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

async function loadClip(book: string, chapter: number, voice: VoiceId, lang: LangId, part: number): Promise<Clip> {
  const key = keyOf(book, chapter, voice, lang, part);
  const saved = await cachedClip(key);
  if (saved) return saved;
  const result = await speakPart({ data: { book, chapter, voice, lang, part } });
  if (!result.ok) throw new Error(result.error);
  const clip: Clip = {
    bytes: bytesFromBase64(result.audio),
    cues: result.cues,
    duration: result.duration,
    parts: result.parts,
  };
  await storeClip(key, clip);
  return clip;
}

type Scheduled = {
  source: AudioBufferSourceNode;
  when: number;
  duration: number;
  cues: Cue[];
};

export function ReadAloud({ book, chapter, voice, lang, onVoice, onVerse }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [error, setError] = useState("");
  const ctxRef = useRef<AudioContext | null>(null);
  const run = useRef(0);
  const fetching = useRef(false);
  const scheduled = useRef<Scheduled[]>([]);
  const statusRef = useRef(status);
  const onVerseRef = useRef(onVerse);
  statusRef.current = status;
  onVerseRef.current = onVerse;

  function stopSources() {
    for (const item of scheduled.current) {
      try {
        item.source.stop();
      } catch {
        // already ended
      }
    }
    scheduled.current = [];
  }

  function halt() {
    run.current += 1;
    fetching.current = false;
    stopSources();
    void ctxRef.current?.suspend();
    setStatus("idle");
    onVerseRef.current(null);
  }

  useEffect(() => {
    halt();
    // A new chapter or voice must not keep speaking the previous one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter, voice, lang]);

  useEffect(() => {
    return () => {
      run.current += 1;
      fetching.current = false;
      stopSources();
      void ctxRef.current?.close();
      ctxRef.current = null;
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
        for (const item of scheduled.current) {
          const local = time - item.when;
          if (local >= 0 && local <= item.duration + 0.05) {
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
        const lastPiece = scheduled.current[scheduled.current.length - 1];
        const finished = !fetching.current && scheduled.current.length > 0 && !pending && !!lastPiece && time > lastPiece.when + lastPiece.duration + 0.2;
        if (finished) {
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

  async function start() {
    setError("");
    const token = ++run.current;
    stopSources();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = ctxRef.current ?? new AudioCtx();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    setStatus("loading");
    fetching.current = true;

    try {
      let part = 0;
      let parts = 1;
      let when = ctx.currentTime + 0.06;
      while (part < parts) {
        if (run.current !== token) return;
        const clip = await loadClip(book, chapter, voice, lang, part);
        if (run.current !== token) return;
        parts = clip.parts;
        const audio = await ctx.decodeAudioData(clip.bytes.slice(0));
        if (run.current !== token) return;
        const source = ctx.createBufferSource();
        source.buffer = audio;
        source.connect(ctx.destination);
        const startAt = Math.max(when, ctx.currentTime + 0.04);
        source.start(startAt);
        scheduled.current.push({ source, when: startAt, duration: audio.duration, cues: clip.cues });
        when = startAt + audio.duration;
        setStatus("playing");
        part += 1;
      }
    } catch (err) {
      if (run.current !== token) return;
      stopSources();
      setStatus("idle");
      onVerseRef.current(null);
      setError(err instanceof Error ? err.message : "The voice could not read this chapter.");
    } finally {
      if (run.current === token) fetching.current = false;
    }
  }

  async function toggle() {
    if (status === "loading") return;
    if (status === "playing") {
      await ctxRef.current?.suspend();
      setStatus("paused");
      return;
    }
    if (status === "paused") {
      await ctxRef.current?.resume();
      setStatus("playing");
      return;
    }
    await start();
  }

  const playing = status === "playing";
  const label = status === "loading" ? "Preparing" : playing ? "Pause" : status === "paused" ? "Resume" : "Read";

  return (
    <div className="border-b border-line">
      <div className="flex flex-wrap items-center">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={status === "loading"}
          className="flex min-h-11 items-center gap-1.5 px-2 text-garnet disabled:opacity-60"
          aria-label={playing ? "Pause the reading" : status === "paused" ? "Resume the reading" : "Read this chapter aloud"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {label}
        </button>
        <VoiceButton name="Ara" detail="warm" active={voice === "ara"} onClick={() => onVoice("ara")} />
        <VoiceButton name="Rex" detail="clear" active={voice === "rex"} onClick={() => onVoice("rex")} />
        {status !== "idle" && (
          <button type="button" onClick={halt} className="flex min-h-11 items-center gap-1 px-2 text-muted">
            <Square className="size-3.5" />
            Stop
          </button>
        )}
        <span className="ml-auto flex min-h-11 items-center px-2 text-sm text-gold">
          {status === "loading" ? "Preparing the voice…" : status === "paused" ? "Paused" : status === "idle" ? languageById(lang).label : ""}
        </span>
      </div>
      {error && <p className="pb-3 text-sm text-garnet">{error}</p>}
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
      className={`min-h-11 px-2 ${active ? "text-garnet" : "text-muted"}`}
    >
      {name}
      <span className="ml-1 text-sm text-muted">{detail}</span>
    </button>
  );
}
