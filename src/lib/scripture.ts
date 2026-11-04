import catalog from "@/data/catalog.json";
import lexicon from "@/data/lexicon.json";

export type Verse = {
  v: number;
  sy: string;
  en: string;
  fn?: string[];
  col?: string;
};

export type BookFile = {
  id: string;
  name: string;
  chapters: Verse[][];
};

export type LexEntry = { g: string; r: string; n: string };

const lex = lexicon as Record<string, LexEntry>;

const loaders = import.meta.glob("../data/nt/*.json", {
  import: "default",
}) as Record<string, () => Promise<BookFile>>;

export const CATALOG = catalog as { id: string; chapters: number; verses: number }[];

export function chapterCount(id: string) {
  return CATALOG.find((b) => b.id === id)?.chapters ?? 0;
}

export function verseCount(id: string) {
  return CATALOG.find((b) => b.id === id)?.verses ?? 0;
}

export const TOTAL_VERSES = CATALOG.reduce((n, b) => n + b.verses, 0);

export async function loadBook(id: string): Promise<BookFile> {
  const loader = loaders[`../data/nt/${id}.json`];
  if (!loader) throw new Error(`No book named ${id}.`);
  return loader();
}

export type SearchRow = [string, number, number, string];

let searchCache: SearchRow[] | null = null;

export async function loadSearch(): Promise<SearchRow[]> {
  if (!searchCache) {
    const mod = await import("@/data/search.json");
    searchCache = mod.default as SearchRow[];
  }
  return searchCache;
}

const PUNCT = /[\u0700-\u070d.,:;]/g;

export function syriacWords(sy: string): string[] {
  const out: string[] = [];
  for (const part of sy.split(/\s+/)) {
    const key = part.replace(PUNCT, "");
    if (key) out.push(key);
  }
  return out;
}

const PREFIXES = ["ܘܕ", "ܘܒ", "ܘܠ", "ܕܒ", "ܕܠ", "ܘ", "ܕ", "ܒ", "ܠ"] as const;

const PREFIX_GLOSS: Record<string, string> = {
  "ܘ": "and",
  "ܕ": "of",
  "ܒ": "in",
  "ܠ": "to",
  "ܘܕ": "and of",
  "ܘܒ": "and in",
  "ܘܠ": "and to",
  "ܕܒ": "that in",
  "ܕܠ": "that to",
};

export type WordGloss = {
  word: string;
  gloss: string;
  roman: string;
  note: string;
  via?: string;
};

export function glossWord(word: string): WordGloss | null {
  const direct = lex[word];
  if (direct) {
    return { word, gloss: direct.g, roman: direct.r, note: direct.n };
  }
  for (const pre of PREFIXES) {
    if (!word.startsWith(pre)) continue;
    const stem = word.slice(pre.length);
    if (stem.length < 2) continue;
    const hit = lex[stem];
    if (!hit) continue;
    return {
      word,
      gloss: `${PREFIX_GLOSS[pre]} · ${hit.g}`,
      roman: hit.r ? `${PREFIX_GLOSS[pre]} ${hit.r}` : "",
      note: hit.n,
      via: `The prefixed letter is “${PREFIX_GLOSS[pre]}.” The stem ${stem} is ${hit.g}.`,
    };
  }
  return null;
}

export const TERM_NOTES: Record<string, { title: string; body: string }> = {
  Legate: {
    title: "Legate",
    body: "Murdock’s word for ܫܠܝܚܐ, shliha, “one who is sent.” He would not use the Latin word apostle.",
  },
  Legates: {
    title: "Legates",
    body: "Murdock’s word for the apostles: ܫܠܝܚܐ, those who are sent.",
  },
  Vivifier: {
    title: "Vivifier",
    body: "Murdock’s word for ܡܚܝܢܐ, mahyana, “life-giver.” The Syriac title comes from the root “to make alive,” which he judged truer than the Latin Saviour.",
  },
  Cephas: {
    title: "Cephas",
    body: "ܟܐܦܐ, Kepha, a rock. In Matthew 16:18 the name and the stone are the same Syriac word.",
  },
  calumniator: {
    title: "Calumniator",
    body: "Murdock’s rendering of the idiom “eater of pieces,” a feeder on detraction: his name for the slanderer, where Greek has the devil.",
  },
};

const TERM_RE =
  /\b(Legates|Legate|Vivifier|resuscitated|resuscitate|resuscitation|calumniator|Cephas)\b/g;

export type TextRun =
  | { kind: "text"; text: string }
  | { kind: "em"; text: string }
  | { kind: "term"; text: string; key: string };

export function englishRuns(input: string): TextRun[] {
  const runs: TextRun[] = [];
  const pieces = input.split(/(‹[^›]*›)/g);
  for (const piece of pieces) {
    if (!piece) continue;
    if (piece.startsWith("‹") && piece.endsWith("›")) {
      runs.push({ kind: "em", text: piece.slice(1, -1) });
      continue;
    }
    let last = 0;
    TERM_RE.lastIndex = 0;
    for (const match of piece.matchAll(TERM_RE)) {
      const index = match.index ?? 0;
      if (index > last) runs.push({ kind: "text", text: piece.slice(last, index) });
      const word = match[1];
      const key = word.startsWith("resuscitat") ? "resuscitate" : word;
      runs.push({ kind: "term", text: word, key });
      last = index + word.length;
    }
    if (last < piece.length) runs.push({ kind: "text", text: piece.slice(last) });
  }
  return runs;
}

if (!TERM_NOTES.resuscitate) {
  TERM_NOTES.resuscitate = {
    title: "Resuscitate",
    body: "Murdock’s rendering of the root ܚܝܐ, “to live,” in the causative: to make alive. In Matthew 1:21 this is the verb tied to the name Jesus.",
  };
}
