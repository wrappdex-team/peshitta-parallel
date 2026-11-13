export const LANGS = [
  { id: "en", label: "English", tts: "en", dir: "ltr", face: "serif" },
  { id: "el", label: "Ελληνικά", tts: "el-GR", dir: "ltr", face: "greek" },
  { id: "he", label: "עברית", tts: "he-IL", dir: "rtl", face: "hebrew" },
  { id: "ar", label: "العربية", tts: "ar-SA", dir: "rtl", face: "arab" },
  { id: "fr", label: "Français", tts: "fr", dir: "ltr", face: "serif" },
  { id: "ru", label: "Русский", tts: "ru", dir: "ltr", face: "cyrl" },
  { id: "es", label: "Español", tts: "es-ES", dir: "ltr", face: "serif" },
  { id: "zh", label: "中文", tts: "zh", dir: "ltr", face: "cjk" },
  { id: "aii", label: "Sureth", tts: "syr", dir: "rtl", face: "syriac" },
  { id: "de", label: "Deutsch", tts: "de", dir: "ltr", face: "serif" },
  { id: "ja", label: "日本語", tts: "ja", dir: "ltr", face: "cjk" },
] as const;

export type LangId = (typeof LANGS)[number]["id"];

export function languageById(id: string) {
  return LANGS.find((item) => item.id === id) ?? LANGS[0];
}

const PHONE: Record<string, LangId> = {
  en: "en",
  el: "el",
  gr: "el",
  he: "he",
  iw: "he",
  ar: "ar",
  fr: "fr",
  ru: "ru",
  es: "es",
  zh: "zh",
  de: "de",
  ja: "ja",
  syr: "aii",
  sy: "aii",
  aii: "aii",
};

/** The phone's language, when this reader has it. Otherwise English. */
export function languageFromPhone(tags: readonly string[] | undefined): LangId {
  for (const tag of tags ?? []) {
    const primary = tag.toLowerCase().split("-")[0];
    const id = primary ? PHONE[primary] : undefined;
    if (id) return id;
  }
  return "en";
}