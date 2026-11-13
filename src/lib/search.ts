import { LANGS } from "@/lib/languages";
import { bookMeta } from "@/data/edition";
import { NAMES } from "@/lib/names";
import { speechOf } from "@/lib/jesus";
import { chapterCount, loadLanguageSearch, loadSearch, loadSyriacSearch } from "@/lib/scripture";
import {
  matchMode,
  nameMatches,
  orderHits,
  parseReference,
  searchVerses,
  verseNeedles,
  type NameHit,
  type Placed,
  type Ranked,
  type SearchVerse,
} from "@/lib/search-match";

export type { NameHit, Placed, Ranked, SearchVerse };
export {
  clipParts,
  foreignScript,
  nameSentence,
  plainLabel,
  resultNote,
} from "@/lib/search-match";

const memory = new Map<string, SearchVerse[]>();
const inflight = new Map<string, Promise<SearchVerse[]>>();

export function cachedIndex(lang: string) {
  return memory.has(lang) ? memory.get(lang)! : null;
}

export function loadIndex(lang: string): Promise<SearchVerse[]> {
  const ready = memory.get(lang);
  if (ready) return Promise.resolve(ready);
  let job = inflight.get(lang);
  if (!job) {
    job = (lang === "en" ? loadSearch() : lang === "sy" ? loadSyriacSearch() : loadLanguageSearch(lang))
      .then((rows) => {
        const verses = rows.map(([book, chapter, verse, text]) => ({ book, chapter, verse, text }));
        memory.set(lang, verses);
        inflight.delete(lang);
        return verses;
      })
      .catch((error) => {
        inflight.delete(lang);
        throw error;
      });
    inflight.set(lang, job);
  }
  return job;
}

export function bookTitle(id: string) {
  return bookMeta(id)?.name ?? id;
}

export function readReference(query: string, book?: string): Placed | null {
  return parseReference(query, book, chapterCount);
}

export function lookupNames(query: string) {
  return nameMatches(query, NAMES);
}

export function chipLangs(reading: string) {
  const faceOf = (id: string, face: string) => (id === "zh" ? "han" : id === "ja" ? "kana" : face);
  const current = LANGS.find((item) => item.id === reading);
  const chips: { id: string; label: string; face: string }[] = current
    ? [{ id: current.id, label: current.label, face: faceOf(current.id, current.face) }]
    : [];
  chips.push({ id: "sy", label: "Peshitta", face: "syriac" });
  for (const item of LANGS) {
    if (item.id !== reading) chips.push({ id: item.id, label: item.label, face: faceOf(item.id, item.face) });
  }
  return chips;
}

export function faceClass(face: string) {
  if (face === "syriac") return "font-syriac text-lg";
  if (face === "arab") return "font-arab text-lg";
  if (face === "hebrew") return "font-hebrew text-lg";
  if (face === "greek") return "font-greek";
  if (face === "cyrl") return "font-cyr";
  if (face === "han") return "font-han";
  if (face === "kana") return "font-kana";
  return "";
}

export function resultFace(lang: string) {
  if (lang === "sy" || lang === "aii") return { className: "font-syriac text-xl", dir: "rtl" as const, lang: "syr" };
  if (lang === "he") return { className: "font-hebrew text-lg", dir: "rtl" as const, lang: "he" };
  if (lang === "ar") return { className: "font-arab text-lg", dir: "rtl" as const, lang: "ar" };
  if (lang === "el") return { className: "font-greek", dir: "ltr" as const, lang: "el" };
  if (lang === "ru") return { className: "font-cyr", dir: "ltr" as const, lang: "ru" };
  if (lang === "zh") return { className: "font-han", dir: "ltr" as const, lang: "zh" };
  if (lang === "ja") return { className: "font-kana", dir: "ltr" as const, lang: "ja" };
  return { className: "", dir: "ltr" as const, lang };
}

export function prepareSearch(rows: SearchVerse[], query: string, lang: string, scope: "all" | "book" | "words", book?: string) {
  const names = lookupNames(query);
  const reference = readReference(query, book);
  const mode = matchMode(lang);
  let list = rows;
  if (scope === "book" && book) list = list.filter((row) => row.book === book);
  if (scope === "words") list = list.filter((row) => speechOf(row.book, row.chapter, row.verse));
  const ranked = orderHits(searchVerses(list, verseNeedles(query, names), mode), book, scope);
  const referenceHit = reference ? ranked.find((hit) => hit.book === reference.book && hit.chapter === reference.chapter && hit.verse === reference.verse) ?? null : null;
  const hits = ranked.filter(
    (hit) => !(reference && hit.book === reference.book && hit.chapter === reference.chapter && hit.verse === reference.verse),
  );
  const aliases: NameHit[] = [];
  const direct: NameHit[] = [];
  for (const name of names) (name.alias ? aliases : direct).push(name);
  return { hits, reference, referenceHit, aliases, direct };
}
