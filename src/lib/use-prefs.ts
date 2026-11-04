import { useEffect, useState } from "react";
import { languageById, type LangId } from "@/lib/languages";
import type { VoiceId } from "@/lib/speak";

export type Face = "both" | "sy" | "tr";

export type Prefs = {
  theme: "day" | "night";
  words: boolean;
  face: Face;
  size: 0 | 1 | 2;
  notes: boolean;
  voice: VoiceId;
  lang: LangId;
  last?: { book: string; chapter: number };
};

const KEY = "peshitta-parallel";

const DEFAULTS: Prefs = {
  theme: "day",
  words: true,
  face: "both",
  size: 1,
  notes: true,
  voice: "ara",
  lang: "en",
};

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const face = parsed.face === "sy" || parsed.face === "tr" || parsed.face === "both" ? parsed.face : DEFAULTS.face;
    const voice = parsed.voice === "rex" ? "rex" : "ara";
    return { ...DEFAULTS, ...parsed, face, voice, lang: languageById(parsed.lang ?? "en").id };
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
