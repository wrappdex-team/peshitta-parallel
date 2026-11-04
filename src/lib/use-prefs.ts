import { useEffect, useState } from "react";

export type Face = "both" | "sy" | "en";

export type Prefs = {
  theme: "day" | "night";
  words: boolean;
  face: Face;
  size: 0 | 1 | 2;
  notes: boolean;
  last?: { book: string; chapter: number };
};

const KEY = "peshitta-parallel";

const DEFAULTS: Prefs = {
  theme: "day",
  words: true,
  face: "both",
  size: 1,
  notes: true,
};

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULTS, ...parsed };
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
