import type { LangId } from "@/lib/languages";

type Face = "both" | "sy" | "tr";

/** The reading language. Choosing the second column swaps the two, so neither one is stuck. */
export function chooseLanguage(
  current: { lang: LangId; lang2: LangId | "none" },
  next: LangId,
): { lang: LangId; lang2: LangId | "none" } | null {
  if (next === current.lang) return null;
  if (next === current.lang2) return { lang: next, lang2: current.lang };
  return { lang: next, lang2: current.lang2 };
}

/** A second column. Peshitta-only would hide it, so that choice opens both. */
export function chooseSecond(
  current: { lang: LangId; lang2: LangId | "none"; face: Face },
  next: LangId | "none",
): { lang2: LangId | "none"; face?: Face } {
  if (next === "none" || next === current.lang) return { lang2: "none" };
  if (next === current.lang2) return { lang2: next };
  if (current.face === "sy") return { lang2: next, face: "both" };
  return { lang2: next };
}
