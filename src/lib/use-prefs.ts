import { useEffect, useSyncExternalStore } from "react";
import { languageById, languageFromPhone, type LangId } from "@/lib/languages";
import type { VoiceId } from "@/lib/speak";

export type Face = "both" | "sy" | "tr";

export type Prefs = {
  theme: "day" | "night";
  words: boolean;
  face: Face;
  size: 0 | 1 | 2 | 3 | 4;
  line: 0 | 1 | 2;
  notes: boolean;
  voice: VoiceId;
  deviceVoice: string;
  speed: number;
  lang: LangId;
  lang2: LangId | "none";
  last?: { book: string; chapter: number; verse: number };
};

const KEY = "peshitta-parallel";

const DEFAULTS: Prefs = {
  theme: "day",
  words: false,
  face: "tr",
  size: 2,
  line: 1,
  notes: false,
  voice: "ara",
  deviceVoice: "",
  speed: 100,
  lang: "en",
  lang2: "none",
};

function fresh(): Prefs {
  const tags = typeof navigator === "undefined" ? undefined : navigator.languages?.length ? navigator.languages : [navigator.language];
  return { ...DEFAULTS, lang: languageFromPhone(tags) };
}

function clampSpeed(value: unknown) {
  const speed = Math.round(Number(value));
  if (!Number.isFinite(speed)) return 100;
  return Math.min(150, Math.max(50, speed));
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const face = parsed.face === "sy" || parsed.face === "tr" || parsed.face === "both" ? parsed.face : DEFAULTS.face;
    const size = [0, 1, 2, 3, 4].includes(Number(parsed.size)) ? (Number(parsed.size) as 0 | 1 | 2 | 3 | 4) : DEFAULTS.size;
    const line = [0, 1, 2].includes(Number(parsed.line)) ? (Number(parsed.line) as 0 | 1 | 2) : DEFAULTS.line;
    const voice = parsed.voice === "rex" ? "rex" : "ara";
    const deviceVoice = typeof parsed.deviceVoice === "string" ? parsed.deviceVoice.slice(0, 300) : "";
    const speed = clampSpeed(parsed.speed);
    const lang2 = parsed.lang2 && parsed.lang2 !== "none" ? languageById(parsed.lang2).id : "none";
    const saved = parsed.last;
    const last =
      saved && typeof saved.book === "string"
        ? { book: saved.book, chapter: Number(saved.chapter) || 1, verse: Number(saved.verse) || 1 }
        : undefined;
    return { ...DEFAULTS, ...parsed, face, size, line, voice, deviceVoice, speed, lang: languageById(parsed.lang ?? "en").id, lang2, last };
  } catch {
    return fresh();
  }
}

let memory: Prefs | null = null;
const listeners = new Set<() => void>();
let clientReady = false;
const readyListeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (!memory) memory = read();
  return memory;
}

function getServerSnapshot() {
  return DEFAULTS;
}

function subscribeReady(listener: () => void) {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

function patch(partial: Partial<Prefs>) {
  const base = memory ?? (typeof window === "undefined" ? DEFAULTS : read());
  memory = { ...base, ...partial };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* private mode still keeps the choice for this visit */
  }
  if (typeof document !== "undefined") document.documentElement.dataset.theme = memory.theme;
  emit();
}

/** One reading setup for the whole site. The menu, the page, and the voice share it. */
export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribeReady, () => clientReady, () => false);

  useEffect(() => {
    document.documentElement.dataset.theme = getSnapshot().theme;
    clientReady = true;
    for (const listener of readyListeners) listener();
  }, []);

  return { prefs, patch, ready };
}
