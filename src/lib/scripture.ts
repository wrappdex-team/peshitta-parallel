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

const parallelLoaders = import.meta.glob("../data/tr/*/*.json", {
  import: "default",
}) as Record<string, () => Promise<string[][]>>;

export async function loadParallel(lang: string, book: string): Promise<string[][] | null> {
  const loader = parallelLoaders[`../data/tr/${lang}/${book}.json`];
  if (!loader) return null;
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

export async function loadLanguageSearch(lang: string): Promise<SearchRow[]> {
  const books = await Promise.all(CATALOG.map((item) => loadBook(item.id)));
  const grids = await Promise.all(books.map((book) => loadParallel(lang, book.id)));
  const rows: SearchRow[] = [];
  books.forEach((book, index) => {
    const grid = grids[index];
    if (!grid) return;
    book.chapters.forEach((chapter, chapterIndex) => {
      chapter.forEach((verse, verseIndex) => {
        const text = grid[chapterIndex]?.[verseIndex];
        if (text) rows.push([book.id, chapterIndex + 1, verse.v, text]);
      });
    });
  });
  return rows;
}

let syriacCache: SearchRow[] | null = null;

export async function loadSyriacSearch(): Promise<SearchRow[]> {
  if (syriacCache) return syriacCache;
  const books = await Promise.all(CATALOG.map((item) => loadBook(item.id)));
  const rows: SearchRow[] = [];
  for (const book of books) {
    book.chapters.forEach((chapter, index) => {
      for (const verse of chapter) {
        if (verse.sy) rows.push([book.id, index + 1, verse.v, verse.sy]);
      }
    });
  }
  syriacCache = rows;
  return rows;
}

const PUNCT = /[\u0700-\u070d.,:;]/g;

export type SyriacPiece = { kind: "space"; text: string } | { kind: "word"; text: string; word: string };

export function syriacPieces(sy: string): SyriacPiece[] {
  const out: SyriacPiece[] = [];
  for (const part of sy.split(/(\s+)/)) {
    if (!part) continue;
    if (!part.trim()) {
      out.push({ kind: "space", text: part });
      continue;
    }
    const word = part.replace(PUNCT, "");
    if (!word) out.push({ kind: "space", text: part });
    else out.push({ kind: "word", text: part, word });
  }
  return out;
}

export function syriacWords(sy: string): string[] {
  const out: string[] = [];
  for (const part of sy.split(/\s+/)) {
    const key = part.replace(PUNCT, "");
    if (key) out.push(key);
  }
  return out;
}

const PREFIXES = ["ܘܕܒ", "ܘܕܠ", "ܘܒܕ", "ܘܕ", "ܘܒ", "ܘܠ", "ܕܒ", "ܕܠ", "ܘ", "ܕ", "ܒ", "ܠ"] as const;

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
  "ܘܕܒ": "and that in",
  "ܘܕܠ": "and that to",
  "ܘܒܕ": "and in of",
};

const SUFFIXES: [string, string][] = [
  ["ܟܘܢ", "your"],
  ["ܟܝܢ", "your"],
  ["ܗܘܢ", "their"],
  ["ܗܝܢ", "their"],
  ["ܘܗܝ", "his"],
  ["ܬܘܢ", "you"],
  ["ܟܝ", "your"],
  ["ܗ", "his"],
  ["ܟ", "your"],
  ["ܝ", "my"],
  ["ܢ", "our"],
];

function lexeme(stem: string): LexEntry | undefined {
  if (lex[stem]) return lex[stem];
  if (stem.length >= 2 && !stem.endsWith("ܐ") && lex[stem + "ܐ"]) return lex[stem + "ܐ"];
  return undefined;
}

function nominal(gloss: string) {
  return !/^(he|she|they|I|you|we|let) /i.test(gloss);
}

function joinPrefix(pre: string, gloss: string) {
  if (pre.endsWith("ܕ") && /^(in|to|of|from|upon|with|and) /i.test(gloss)) return `that ${gloss}`;
  return `${PREFIX_GLOSS[pre]} ${gloss}`;
}

export type WordGloss = {
  word: string;
  gloss: string;
  roman: string;
  note: string;
  via?: string;
};

export type WordAffix = { sy: string; gloss: string };

export type WordStudy = {
  word: string;
  gloss: string;
  roman: string;
  note: string;
  via: string;
  prefixes: WordAffix[];
  stem: string;
  suffixes: WordAffix[];
  root: string[];
  rootKind: "triliteral" | "skeleton";
  rootNote: string;
  kin: { word: string; gloss: string; roman: string }[];
};

const LETTER_GLOSS: Record<string, string> = { "ܘ": "and", "ܕ": "of", "ܒ": "in", "ܠ": "to" };

const ROOT_ROMAN: Record<string, string> = {
  "ܐ": "ʾ", "ܒ": "b", "ܓ": "g", "ܕ": "d", "ܗ": "h", "ܘ": "w", "ܙ": "z",
  "ܚ": "ḥ", "ܛ": "ṭ", "ܝ": "y", "ܟ": "k", "ܠ": "l", "ܡ": "m", "ܢ": "n",
  "ܣ": "s", "ܥ": "ʿ", "ܦ": "p", "ܨ": "ṣ", "ܩ": "q", "ܪ": "r", "ܫ": "š", "ܬ": "t",
};

const WEAK = new Set(["ܐ", "ܘ", "ܝ"]);

export function rootRoman(letters: string[]) {
  return letters.map((letter) => ROOT_ROMAN[letter] ?? letter).join("–");
}

function consonantsOf(stem: string) {
  return [...stem].filter((letter) => ROOT_ROMAN[letter]);
}

function proposeRoot(stem: string): { letters: string[]; kind: "triliteral" | "skeleton"; note: string } {
  let body = stem;
  let letters = consonantsOf(body);
  if (body.endsWith("ܬܐ") && letters.length > 3) {
    body = body.slice(0, -2);
    letters = consonantsOf(body);
  }
  if (body.startsWith("ܐܬ") && letters.length > 3) {
    const rest = consonantsOf(body.slice(2));
    const reduced = dropWeak(rest);
    if (reduced.length === 3) return { letters: reduced, kind: "triliteral", note: "The eth- prefix is set aside. What remains is a triliteral." };
  }
  if (letters[0] === "ܡ" && letters.length >= 4) {
    const reduced = dropWeak(letters.slice(1));
    if (reduced.length === 3) return { letters: reduced, kind: "triliteral", note: "The mem of a derived noun or participle is set aside. What remains is a triliteral." };
  }
  if (letters.length === 3) return { letters, kind: "triliteral", note: "Three consonants stand in the stem." };
  const reduced = dropWeak(letters);
  if (reduced.length === 3 && letters.length !== reduced.length) {
    return { letters: reduced, kind: "triliteral", note: "Weak letters are set aside. The triliteral under the form is proposed, not proved from a photograph." };
  }
  if (letters.length > 3) return { letters, kind: "skeleton", note: "More than three consonants. The skeleton is shown whole, not forced into three." };
  return { letters, kind: "skeleton", note: letters.length ? "Fewer than three consonants. A particle, or a root that has worn thin." : "No consonants to set under a root." };
}

function dropWeak(letters: string[]) {
  if (letters.length === 4 && letters.filter((letter) => WEAK.has(letter)).length === 1) {
    return letters.filter((letter) => !WEAK.has(letter));
  }
  const strong = letters.filter((letter) => !WEAK.has(letter));
  return strong.length === 3 ? strong : letters;
}

function letterPrefixes(pre: string): WordAffix[] {
  return [...pre].map((sy) => ({ sy, gloss: LETTER_GLOSS[sy] ?? "" }));
}

type Parse = {
  prefixes: WordAffix[];
  stem: string;
  suffixes: WordAffix[];
  gloss: string;
  roman: string;
  note: string;
  via: string;
  score: number;
};

function bestParse(word: string): Parse | null {
  let best: Parse | null = null;
  const consider = (next: Parse) => {
    if (!best || next.score > best.score) best = next;
  };
  for (const pre of PREFIXES) {
    if (!word.startsWith(pre)) continue;
    const stem = word.slice(pre.length);
    if (stem.length < 2) continue;
    const hit = lexeme(stem);
    if (hit) {
      consider({
        prefixes: letterPrefixes(pre),
        stem,
        suffixes: [],
        gloss: joinPrefix(pre, hit.g),
        roman: hit.r ? `${PREFIX_GLOSS[pre]} ${hit.r}` : "",
        note: hit.n,
        via: `Prefixed “${PREFIX_GLOSS[pre]}.” The stem is ${hit.g}.`,
        score: stem.length + 20,
      });
    }
    for (const [suf, who] of SUFFIXES) {
      if (!stem.endsWith(suf) || stem.length - suf.length < 2) continue;
      const core = stem.slice(0, -suf.length);
      const base = lexeme(core);
      if (!base || !nominal(base.g)) continue;
      consider({
        prefixes: letterPrefixes(pre),
        stem: core,
        suffixes: [{ sy: suf, gloss: who }],
        gloss: joinPrefix(pre, `${who} ${base.g}`),
        roman: base.r,
        note: base.n,
        via: `Prefix “${PREFIX_GLOSS[pre]},” ending “${who}.” The stem is ${base.g}.`,
        score: core.length,
      });
    }
  }
  for (const [suf, who] of SUFFIXES) {
    if (!word.endsWith(suf) || word.length - suf.length < 2) continue;
    const core = word.slice(0, -suf.length);
    const base = lexeme(core);
    if (!base || !nominal(base.g)) continue;
    consider({
      prefixes: [],
      stem: core,
      suffixes: [{ sy: suf, gloss: who }],
      gloss: `${who} ${base.g}`,
      roman: base.r,
      note: base.n,
      via: `The ending is “${who}.” The stem is ${base.g}.`,
      score: core.length,
    });
  }
  return best;
}

let rootIndex: Map<string, string[]> | null = null;

function kinOf(letters: string[], surface: string) {
  if (!rootIndex) {
    rootIndex = new Map();
    for (const key of Object.keys(lex)) {
      const parsed = bestParse(key);
      const stem = parsed?.stem || key;
      const root = proposeRoot(stem).letters.join("");
      if (root.length < 2) continue;
      const list = rootIndex.get(root) ?? [];
      if (list.length < 40) list.push(key);
      rootIndex.set(root, list);
    }
  }
  const keys = rootIndex.get(letters.join("")) ?? [];
  return keys
    .filter((key) => key !== surface)
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, 8)
    .map((key) => ({ word: key, gloss: lex[key]?.g ?? "", roman: lex[key]?.r ?? "" }));
}

export function studyWord(word: string): WordStudy {
  const direct = lex[word];
  const parsed = bestParse(word);
  const stem = parsed?.stem || word;
  const root = proposeRoot(stem);
  return {
    word,
    gloss: direct?.g || parsed?.gloss || "",
    roman: direct?.r || parsed?.roman || "",
    note: direct?.n || parsed?.note || "",
    via: parsed?.via || "",
    prefixes: parsed?.prefixes ?? [],
    stem,
    suffixes: parsed?.suffixes ?? [],
    root: root.letters,
    rootKind: root.kind,
    rootNote: root.note,
    kin: kinOf(root.letters, word),
  };
}

export function glossWord(word: string): WordGloss | null {
  const direct = lex[word];
  if (direct) return { word, gloss: direct.g, roman: direct.r, note: direct.n };
  const parsed = bestParse(word);
  if (!parsed) return null;
  return { word, gloss: parsed.gloss, roman: parsed.roman, note: parsed.note, via: parsed.via || undefined };
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
    body: "The rendering of the root ܚܝܐ, “to live,” in the causative: to make alive. In Matthew 1:21 this is the verb tied to the name Y'shua.",
  };
}
