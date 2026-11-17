export type WordToken = {
  w: string;
  l: string;
  pre?: string;
  prf?: string[];
  suf?: string;
  sfn?: string;
  p: string;
  g: string;
  ctx?: string;
  say: string;
  tr: string;
  n?: string;
  src?: string[];
  prov: "draft-ai" | "draft-loop" | "sourced" | "reviewed";
  rv?: string;
  flag?: string;
};

export type WordChapter = { book: string; ch: number; v: Record<string, WordToken[]> };

export type Lemma = {
  id: string;
  sy: string;
  root?: string;
  pos: string;
  gen?: string;
  gloss: string;
  senses?: { g: string; src?: string[] }[];
  say: string;
  tr: string;
  cog?: { he?: string; ar?: string };
  src: string[];
  prov: WordToken["prov"];
  flag?: string;
};

const POS: Record<string, string> = {
  V: "Verb", N: "Noun", ADJ: "Adjective", PRON: "Pronoun", PREP: "Preposition",
  CONJ: "Conjunction", PART: "Particle", NUM: "Numeral", NAME: "Name", ADV: "Adverb",
};
const STEM: Record<string, string> = {
  pe: "Peal", pa: "Pael", aph: "Aphel", ethpe: "Ethpeel", ethpa: "Ethpaal", ettaph: "Ettaphal", shaph: "Shaphel",
};
const TENSE: Record<string, string> = {
  pf: "perfect", impf: "imperfect", impv: "imperative", ptc: "participle", ptcp: "passive participle", inf: "infinitive",
};
const STATE: Record<string, string> = { abs: "absolute", cst: "construct", emph: "emphatic" };
const GEN: Record<string, string> = { m: "masculine", f: "feminine", c: "common" };
const NUM: Record<string, string> = { s: "singular", p: "plural", sg: "singular", pl: "plural" };
const PER: Record<string, string> = { "1": "1st person", "2": "2nd person", "3": "3rd person" };

const warned = new Set<string>();
let wordImports = 0;
const chapters = new Map<string, Promise<WordChapter | null>>();
const lemmas = new Map<string, Promise<Lemma[]>>();

export function wordDataImports() {
  return wordImports;
}

/** Token at this index, or null when the stored form is not the form in the verse. */
export function tokenAt(list: WordToken[] | null | undefined, words: string[], index: number, verseKey?: string): WordToken | null {
  const token = list?.[index];
  if (!token) return null;
  if (token.w !== words[index]) {
    if (verseKey && import.meta.env?.DEV && !warned.has(verseKey)) {
      warned.add(verseKey);
      console.warn(`word data mismatch at ${verseKey}`);
    }
    return null;
  }
  return token;
}

/** Word-file gloss, else the pinned sense, else the lexicon, else today's peel. */
export function resolveGloss(input: {
  token?: string | null;
  pinned?: string | null;
  lexicon?: string | null;
  peel?: string | null;
  fallback?: string | null;
}): string | null {
  if (input.token) return input.token;
  if (input.pinned) return input.pinned;
  if (input.lexicon) return input.lexicon;
  if (input.fallback) return input.fallback;
  return input.peel ?? null;
}

/** Existential ܐܝܬ with an optional prefix and pronoun suffix, not the “bring” verbs. */
export const EXISTENTIAL_ITH = /^(?:ܘ|ܕ|ܒ|ܠ)*ܐܝܬ(?:ܘܗܝ|ܝܗܘܢ|ܝܗܝܢ|ܝܟܘܢ|ܝܟ|ܝܗ|ܝܢ|ܝ)?$/;
/** Past copula used as the auxiliary in ܐܝܬܘܗܝ ܗܘܐ. */
export const HWA_AUX = /^(?:ܘ|ܕ)*ܗܘ(?:ܐ|ܬ|ܘ|ܝ)$/;

/**
 * ܐܝܬܘܗܝ ܗܘܐ (and the same pair with other suffixes/prefixes) is one past
 * periphrastic “was”. A present “he is” beside “was” is the wrong tense for
 * this occurrence, so the card gloss is marked as the existential half.
 */
export function occurrenceGloss(input: {
  word: string;
  next?: string | null;
  token?: WordToken | null;
  fallback?: string | null;
}): string | null {
  const base = resolveGloss({ token: input.token?.g, fallback: input.fallback });
  if (!base) return base;
  if (!input.next || !EXISTENTIAL_ITH.test(input.word) || !HWA_AUX.test(input.next)) return base;
  return periphrasticAuxGloss(base);
}

export function periphrasticAuxGloss(gloss: string): string {
  if (/\(existing\)|\(aux\.?\)|\bwas\b|\bwere\b/i.test(gloss)) return gloss;
  const rewritten = gloss
    .replace(/\bthere is\b/gi, "there (existing)")
    .replace(/\bhe is\b/gi, "he (existing)")
    .replace(/\bshe is\b/gi, "she (existing)")
    .replace(/\bit is\b/gi, "it (existing)")
    .replace(/\bI am\b/g, "I (existing)")
    .replace(/\bwe are\b/gi, "we (existing)")
    .replace(/\byou are\b/gi, "you (existing)")
    .replace(/\bthey are\b/gi, "they (existing)")
    .replace(/\bwho is\b/gi, "who (existing)")
    .replace(/\bthat is\b/gi, "that (existing)")
    .replace(/\bwhich is\b/gi, "which (existing)");
  if (rewritten !== gloss) return rewritten;
  if (/\bis\b/i.test(gloss)) return gloss.replace(/\bis\b/i, "(existing)").replace(/\s+/g, " ").trim();
  if (/\bare\b/i.test(gloss)) return gloss.replace(/\bare\b/i, "(existing)").replace(/\s+/g, " ").trim();
  return gloss;
}

export function parseTag(code: string) {
  return code.split(".").join(" · ").toLowerCase();
}

function pgn(code: string) {
  return `${PER[code[0]] ?? code[0]} ${GEN[code[1]] ?? code[1]} ${NUM[code[2]] ?? code[2]}`;
}

export function parseLong(code: string) {
  const [pos, ...rest] = code.split(".");
  const out = [POS[pos] ?? pos];
  for (const bit of rest) {
    if (STEM[bit]) out.push(STEM[bit]);
    else if (TENSE[bit]) out.push(TENSE[bit]);
    else if (STATE[bit]) out.push(STATE[bit]);
    else if (GEN[bit] && bit.length === 1) out.push(GEN[bit]);
    else if (NUM[bit]) out.push(NUM[bit]);
    else if (/^[123][mfc][sp]$/.test(bit)) out.push(pgn(bit));
    else out.push(bit);
  }
  return out.join(" · ");
}

export function cardAria(token: WordToken, gloss?: string | null) {
  const bits = [token.w, token.say, gloss || token.g, parseLong(token.p).toLowerCase().replace(/ · /g, " ")];
  if (token.sfn) bits.push(`with ${token.sfn}`);
  return bits.join(", ");
}

export function provenanceLine(row: { prov: WordToken["prov"]; rv?: string }) {
  if (row.prov === "reviewed") return row.rv ? `Reviewed by ${row.rv}` : "Reviewed";
  if (row.prov === "sourced") return "Sourced";
  return "Draft, not reviewed by a scholar";
}

export function scholarLine(flag?: string) {
  if (!flag) return "";
  return `Needs a scholar: ${flag.replace(/^needs-scholar:\s*/i, "")}`;
}

function findLoader(map: Record<string, () => Promise<unknown>>, suffix: string) {
  if (map[suffix]) return map[suffix];
  const key = Object.keys(map).find((item) => item.endsWith(suffix));
  return key ? map[key] : undefined;
}

export function loadWordChapter(book: string, ch: number, wordsOn = true): Promise<WordChapter | null> {
  if (!wordsOn) return Promise.resolve(null);
  const key = `${book}:${ch}`;
  const hit = chapters.get(key);
  if (hit) return hit;
  wordImports += 1;
  const pending = import("./word-files").then(async (files) => {
    const load = findLoader(files.wordChapterFiles, `/words/${book}/${ch}.json`);
    if (!load || book === "lemmas") return null;
    return (await load()) as WordChapter;
  });
  chapters.set(key, pending);
  return pending;
}

export function loadLemmas(book: string): Promise<Lemma[]> {
  const hit = lemmas.get(book);
  if (hit) return hit;
  const pending = import("./word-files").then(async (files) => {
    const load = findLoader(files.lemmaFiles, `/words/lemmas/${book}.json`);
    return load ? ((await load()) as Lemma[]) : [];
  });
  lemmas.set(book, pending);
  return pending;
}
