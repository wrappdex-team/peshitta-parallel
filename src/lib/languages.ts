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