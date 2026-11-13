import { languageById, type LangId } from "./languages.ts";

export type Face = "both" | "sy" | "tr";

export type Prefs = {
  theme: "day" | "night";
  words: boolean;
  face: Face;
  size: 0 | 1 | 2 | 3 | 4;
  line: 0 | 1 | 2;
  notes: boolean;
  voice: "ara" | "rex";
  deviceVoice: string;
  speed: number;
  lang: LangId;
  lang2: LangId | "none";
  /** Set only when the visitor has answered the first-run card. */
  intro?: 1;
  last?: { book: string; chapter: number; verse: number };
};

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

function clampSpeed(value: unknown) {
  const speed = Math.round(Number(value));
  if (!Number.isFinite(speed)) return 100;
  return Math.min(150, Math.max(50, speed));
}

/** Read a saved prefs blob. An intro value other than 1 is dropped. */
export function parseStoredPrefs(raw: string | null): Prefs {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs> & { intro?: unknown };
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ...DEFAULTS };
    const face = parsed.face === "sy" || parsed.face === "tr" || parsed.face === "both" ? parsed.face : DEFAULTS.face;
    const size = [0, 1, 2, 3, 4].includes(Number(parsed.size)) ? (Number(parsed.size) as 0 | 1 | 2 | 3 | 4) : DEFAULTS.size;
    const line = [0, 1, 2].includes(Number(parsed.line)) ? (Number(parsed.line) as 0 | 1 | 2) : DEFAULTS.line;
    const voice = parsed.voice === "rex" ? "rex" : "ara";
    const deviceVoice = typeof parsed.deviceVoice === "string" ? parsed.deviceVoice.slice(0, 300) : "";
    const speed = clampSpeed(parsed.speed);
    const lang2 = parsed.lang2 && parsed.lang2 !== "none" ? languageById(String(parsed.lang2)).id : "none";
    const saved = parsed.last;
    const last =
      saved && typeof saved.book === "string"
        ? { book: saved.book, chapter: Number(saved.chapter) || 1, verse: Number(saved.verse) || 1 }
        : undefined;
    const prefs: Prefs = {
      ...DEFAULTS,
      ...parsed,
      face,
      size,
      line,
      voice,
      deviceVoice,
      speed,
      lang: languageById(typeof parsed.lang === "string" ? parsed.lang : "en").id,
      lang2,
      last,
    };
    if (parsed.intro === 1) prefs.intro = 1;
    else delete prefs.intro;
    return prefs;
  } catch {
    return { ...DEFAULTS };
  }
}

/** True when this device already has a prefs object, even without an intro field. */
export function hasStoredPrefs(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
