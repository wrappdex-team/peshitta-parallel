import { BOOKS } from "../data/edition.ts";

export type SearchVerse = { book: string; chapter: number; verse: number; text: string };

export type MatchMode = "word" | "syriac" | "plain";

export type NameLite = { id: string; en: string; known: string; forms?: string[]; count?: number };

export type NameHit = { id: string; en: string; matched: string; alias: boolean; count: number };

export type Placed = { book: string; chapter: number; verse: number };

const PUNCT = /[\u0700-\u070d.,:;]/g;

/** Longest attached prefix first. The same list the word gloss uses. */
const PREFIXES = ["ܘܕܒ", "ܘܕܠ", "ܘܒܕ", "ܘܕ", "ܘܒ", "ܘܠ", "ܕܒ", "ܕܠ", "ܘ", "ܕ", "ܒ", "ܠ"] as const;

const SHORT: Record<string, string[]> = {
  matthew: ["mt", "matt"],
  mark: ["mk", "mrk"],
  luke: ["lk"],
  john: ["jn", "joh", "yochanan"],
  romans: ["rom", "ro"],
  "1corinthians": ["1 cor", "1cor", "1 co", "1corinthians"],
  "2corinthians": ["2 cor", "2cor", "2 co", "2corinthians"],
  galatians: ["gal"],
  ephesians: ["eph"],
  philippians: ["phil", "php"],
  colossians: ["col"],
  "1thessalonians": ["1 th", "1 thess", "1thess", "1 ths"],
  "2thessalonians": ["2 th", "2 thess", "2thess", "2 ths"],
  "1timothy": ["1 tim", "1tim", "1 ti"],
  "2timothy": ["2 tim", "2tim", "2 ti"],
  titus: ["tit"],
  philemon: ["phm", "phlm"],
  hebrews: ["heb"],
  james: ["jas"],
  "1peter": ["1 pet", "1pet", "1 pe"],
  "2peter": ["2 pet", "2pet", "2 pe"],
  "1john": ["1 jn", "1jn", "1 joh", "1john"],
  "2john": ["2 jn", "2jn", "2 joh", "2john"],
  "3john": ["3 jn", "3jn", "3 joh", "3john"],
  revelation: ["rev", "rv"],
};

const ALIASES: { id: string; alias: string }[] = [];
for (const book of BOOKS) {
  const names = new Set<string>([book.name.toLowerCase(), book.sy, ...(SHORT[book.id] ?? [])]);
  for (const alias of names) {
    const clean = alias.trim().toLowerCase();
    if (clean) ALIASES.push({ id: book.id, alias: clean });
  }
}
ALIASES.sort((a, b) => b.alias.length - a.alias.length);

const ORDER = new Map(BOOKS.map((book, index) => [book.id, index]));

export function fold(value: string) {
  return value.replace(/['’ʼʻ]/g, "'").toLowerCase();
}

function bare(value: string) {
  return value.replace(PUNCT, "");
}

/** The word, and the word with one attached prefix taken off. A prefix that is the whole word stays. */
export function syriacForms(word: string) {
  const stem = bare(word);
  if (!stem) return [];
  for (const prefix of PREFIXES) {
    if (prefix.length < stem.length && stem.startsWith(prefix)) return [stem, stem.slice(prefix.length)];
  }
  return [stem];
}

function normRef(query: string) {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .replace(/([A-Za-z])\./g, "$1")
    .replace(/(\d)\.(\d)/g, "$1:$2")
    .toLowerCase()
    .replace(/\b1st\b/g, "1")
    .replace(/\b2nd\b/g, "2")
    .replace(/\b3rd\b/g, "3")
    .replace(/^(iii|ii|i)\s+/g, (roman) => ({ i: "1 ", ii: "2 ", iii: "3 " })[roman.trim()] ?? roman);
}

function boundary(query: string, at: number) {
  if (at >= query.length) return true;
  const mark = query[at];
  return mark === " " || /\d/.test(mark);
}

/** A verse address, or null. A bare 3:16 needs the open book. A person is not a book. */
export function parseReference(query: string, currentBook: string | undefined, chapters: (id: string) => number): Placed | null {
  const text = normRef(query);
  if (!text) return null;
  const bareHit = text.match(/^(\d+):(\d+)$/);
  if (bareHit && currentBook) {
    const chapter = Number(bareHit[1]);
    const verse = Number(bareHit[2]);
    if (chapter >= 1 && verse >= 1 && chapter <= chapters(currentBook)) return { book: currentBook, chapter, verse };
    return null;
  }
  for (const item of ALIASES) {
    if (!text.startsWith(item.alias) || !boundary(text, item.alias.length)) continue;
    const rest = text.slice(item.alias.length).trim();
    const hit = rest.match(/^(\d+)(?::(\d+))?$/);
    if (!hit) continue;
    const chapter = Number(hit[1]);
    const verse = hit[2] ? Number(hit[2]) : 1;
    if (chapter < 1 || verse < 1 || chapter > chapters(item.id)) return null;
    return { book: item.id, chapter, verse };
  }
  return null;
}

function knownParts(known: string) {
  return known.split(",").map((part) => part.trim()).filter(Boolean);
}

/** Exact name, in this book’s spelling or under its ordinary name. Not a substring. */
export function nameMatches(query: string, names: NameLite[]): NameHit[] {
  const folded = fold(query.trim());
  if (folded.length < 2) return [];
  const hits: NameHit[] = [];
  for (const name of names) {
    const keys = [name.en, ...knownParts(name.known), ...(name.forms ?? [])];
    const matched = keys.find((key) => fold(key) === folded);
    if (!matched) continue;
    hits.push({
      id: name.id,
      en: name.en,
      matched: knownParts(name.known).find((part) => fold(part) === folded) ?? matched,
      alias: fold(name.en) !== folded,
      count: name.count ?? 0,
    });
  }
  return hits.sort((a, b) => b.count - a.count || a.en.localeCompare(b.en, "en"));
}

export function verseNeedles(query: string, hits: NameHit[]) {
  const aliases = hits.filter((hit) => hit.alias);
  if (aliases.length) return [...new Set(aliases.map((hit) => hit.en))];
  const trimmed = query.trim();
  return trimmed ? [trimmed] : [];
}

export function nameSentence(hits: NameHit[]) {
  const aliases = hits.filter((hit) => hit.alias);
  if (!aliases.length) return "";
  const typed = aliases[0].matched;
  const spellings = [...new Set(aliases.map((hit) => hit.en))];
  const list = spellings.length === 1 ? spellings[0] : `${spellings.slice(0, -1).join(", ")} and ${spellings.at(-1)}`;
  return `${typed} is ${list} in this book.`;
}

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenPattern(token: string) {
  return [...fold(token)].map((mark) => (mark === "'" ? "['’ʼʻ]" : escapeReg(mark))).join("");
}

function wordSpan(text: string, needle: string): [number, number] | null {
  const parts = needle.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const body = parts.map(tokenPattern).join("\\s+");
  const match = new RegExp(`(?:^|[^\\p{L}0-9'])(${body})(?=$|[^\\p{L}0-9'])`, "iu").exec(text);
  if (!match || match.index === undefined || match[1] === undefined) return null;
  const start = match.index + match[0].length - match[1].length;
  return [start, start + match[1].length];
}

function syriacSpan(text: string, needle: string): [number, number] | null {
  const wants = needle.split(/\s+/).map(bare).filter(Boolean);
  if (!wants.length) return null;
  const words: { start: number; end: number; forms: string[] }[] = [];
  let index = 0;
  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) index += 1;
    if (index >= text.length) break;
    const start = index;
    while (index < text.length && !/\s/.test(text[index])) index += 1;
    words.push({ start, end: index, forms: syriacForms(text.slice(start, index)) });
  }
  for (let from = 0; from <= words.length - wants.length; from += 1) {
    let fits = true;
    for (let step = 0; step < wants.length; step += 1) {
      if (!words[from + step].forms.includes(wants[step])) {
        fits = false;
        break;
      }
    }
    if (fits) return [words[from].start, words[from + wants.length - 1].end];
  }
  return null;
}

function plainSpan(text: string, needle: string): [number, number] | null {
  const folded = fold(text);
  const want = fold(needle.trim());
  if (!want || folded.length !== text.length) return null;
  const at = folded.indexOf(want);
  if (at < 0) return null;
  return [at, at + want.length];
}

function looseSpan(text: string, needle: string): [number, number] | null {
  const parts = needle.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const body = parts.map(tokenPattern).join("[^\\p{L}0-9']+");
  const match = new RegExp(`(?:^|[^\\p{L}0-9'])(${body})(?=$|[^\\p{L}0-9'])`, "iu").exec(text);
  if (!match || match.index === undefined || match[1] === undefined) return null;
  const start = match.index + match[0].length - match[1].length;
  return [start, start + match[1].length];
}

/** Word, then phrase, then a leftover broken by punctuation. 0 means no match. A letter inside a word is not a match. */
export function scoreSpan(text: string, needle: string, mode: MatchMode): { rank: number; start: number; end: number } | null {
  if (!needle.trim()) return null;
  if (mode === "syriac") {
    const span = syriacSpan(text, needle);
    if (!span) return null;
    const pieces = needle.trim().split(/\s+/).filter(Boolean);
    return { rank: pieces.length <= 1 ? 3 : 2, start: span[0], end: span[1] };
  }
  if (mode === "plain") {
    const span = plainSpan(text, needle);
    if (!span) return null;
    return { rank: 1, start: span[0], end: span[1] };
  }
  const word = wordSpan(text, needle);
  if (word) {
    const pieces = needle.trim().split(/\s+/).filter(Boolean);
    return { rank: pieces.length <= 1 ? 3 : 2, start: word[0], end: word[1] };
  }
  const loose = looseSpan(text, needle);
  if (!loose) return null;
  return { rank: 1, start: loose[0], end: loose[1] };
}

export function findSpan(text: string, needle: string, mode: MatchMode): [number, number] | null {
  const scored = scoreSpan(text, needle, mode);
  return scored ? [scored.start, scored.end] : null;
}

export function matchRank(text: string, needle: string, mode: MatchMode) {
  return scoreSpan(text, needle, mode)?.rank ?? 0;
}

export type Ranked = SearchVerse & { rank: number; start: number; end: number };

export function searchVerses(rows: SearchVerse[], needles: string[], mode: MatchMode): Ranked[] {
  const found: Ranked[] = [];
  for (const row of rows) {
    if (!row.text) continue;
    let best: { rank: number; start: number; end: number } | null = null;
    for (const needle of needles) {
      const scored = scoreSpan(row.text, needle, mode);
      if (!scored) continue;
      if (!best || scored.rank > best.rank) best = scored;
    }
    if (best) found.push({ ...row, ...best });
  }
  return found;
}

export function orderHits<T extends { book: string; chapter: number; verse: number; rank: number }>(
  hits: T[],
  current: string | undefined,
  scope: "all" | "book" | "words",
) {
  return hits.slice().sort((a, b) => {
    if (scope !== "book" && current) {
      const here = Number(a.book !== current) - Number(b.book !== current);
      if (here) return here;
    }
    if (a.rank !== b.rank) return b.rank - a.rank;
    return (ORDER.get(a.book) ?? 99) - (ORDER.get(b.book) ?? 99) || a.chapter - b.chapter || a.verse - b.verse;
  });
}

export function clipParts(text: string, start: number, end: number, radius = 70) {
  if (end <= start) {
    const cut = text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
    return { before: cut, hit: "", after: "" };
  }
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  return {
    before: `${from > 0 ? "…" : ""}${text.slice(from, start)}`,
    hit: text.slice(start, end),
    after: `${text.slice(end, to)}${to < text.length ? "…" : ""}`,
  };
}

export function matchMode(lang: string): MatchMode {
  if (lang === "sy") return "syriac";
  if (lang === "en" || lang === "fr" || lang === "es" || lang === "de" || lang === "el" || lang === "ru") return "word";
  return "plain";
}

/** A script that belongs to another reading. Null when the open language can hold these letters. */
export function foreignScript(query: string, lang: string) {
  if (/[\u0700-\u074F]/.test(query)) return lang === "sy" || lang === "aii" ? null : "sy";
  if (/[\u0590-\u05FF]/.test(query)) return lang === "he" ? null : "he";
  if (/[\u0600-\u06FF]/.test(query)) return lang === "ar" ? null : "ar";
  if (/[\u0370-\u03FF]/.test(query)) return lang === "el" ? null : "el";
  if (/[\u0400-\u04FF]/.test(query)) return lang === "ru" ? null : "ru";
  if (/[\u3040-\u30ff]/.test(query)) return lang === "ja" ? null : "ja";
  if (/[\u4e00-\u9fff]/.test(query)) return lang === "zh" || lang === "ja" ? null : "zh";
  return null;
}

const PLAIN: Record<string, string> = {
  en: "English",
  el: "Greek",
  he: "Hebrew",
  ar: "Arabic",
  fr: "French",
  ru: "Russian",
  es: "Spanish",
  zh: "Chinese",
  aii: "Sureth",
  de: "German",
  ja: "Japanese",
  sy: "Peshitta",
};

export function plainLabel(lang: string) {
  return PLAIN[lang] ?? "reading";
}

export function resultNote(input: {
  pending: boolean;
  failed: boolean;
  label: string;
  query: string;
  total: number;
  hasReference: boolean;
  offer: boolean;
  /** A known name already has its own line. Do not add a second empty sentence. */
  named?: boolean;
}) {
  const query = input.query.trim();
  if (!query) return "";
  if (input.pending) return `Opening the ${input.label}.`;
  if (input.failed) return `The ${input.label} did not open.`;
  if (input.offer) return "";
  if (query.length < 2 && !input.hasReference && !/[\u0700-\u074F]/.test(query)) return "Type a word, or a reference such as John 3:16.";
  if (input.named && input.total === 0 && !input.hasReference) return "";
  if (input.total === 0 && !input.hasReference && (query.length >= 2 || /[\u0700-\u074F]/.test(query))) return "No verse has that word.";
  return "";
}
