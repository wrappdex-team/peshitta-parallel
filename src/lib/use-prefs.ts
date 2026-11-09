import { useEffect, useState } from "react";
import { languageById, type LangId } from "@/lib/languages";
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
  words: true,
  face: "both",
  size: 2,
  line: 1,
  notes: true,
  voice: "ara",
  deviceVoice: "",
  speed: 100,
  lang: "en",
  lang2: "none",
};

function clampSpeed(value: unknown) {
  const speed = Math.round(Number(value));
  if (!Number.isFinite(speed)) return 100;
  return Math.min(150, Math.max(50, speed));
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
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
    return DEFAULTS;
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = read();
    setPrefs(next);
    document.documentElement.dataset.theme = next.theme;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(prefs));
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs, ready]);

  function patch(partial: Partial<Prefs>) {
    setPrefs((prev) => ({ ...prev, ...partial }));
  }

  return { prefs, patch, ready };
}
