import registry from "../data/names.json" with { type: "json" };

export type NameSource = {
  script: string;
  text: string;
  say?: string;
  note?: string;
};

export type NameSound = { respell: string; ipa?: string; source?: string };

export type NameRootLang = "Aramaic" | "Hebrew" | "Greek" | "Latin" | "needs owner decision";

export type NameEntry = {
  id: string;
  sy: string;
  en: string;
  forms?: string[];
  known: string;
  say: string;
  kind: string;
  count: number;
  ref: string;
  note: string;
  sources?: NameSource[];
  spellings?: string[];
  /** Other verses, when there are only a few. */
  refs?: string[];
  /** Distinct people who share this name. Optional until the names checker fills it. */
  people?: { label: string; refs: string[] }[];
  /** Other cards to open. Optional until the names checker fills it. */
  see?: string[];
  root?: { text: string; lang: NameRootLang; source?: string };
  pron?: { root?: NameSound; en?: NameSound };
};

export const NAME_CLASS =
  "rounded-sm bg-gold-soft px-0.5 font-semibold text-inherit underline decoration-gold/70 underline-offset-2";

export const NAMES = (registry.names as NameEntry[]).slice().sort((a, b) => a.en.localeCompare(b.en, "en"));

export type NameKindFilter = "all" | "person" | "place" | "people" | "other";

export const NAME_KIND_FILTERS: { id: NameKindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "person", label: "Persons" },
  { id: "place", label: "Places" },
  { id: "people", label: "Peoples" },
  { id: "other", label: "Other" },
];

const MARK = /\p{M}/gu;
const GLOTTAL = /[ʿʾ]/g;
const HYPHEN = /[\u2010\u2011\u2012\u2013\u2014-]/g;
const APOSTROPHE = /['’ʼʻ′]/g;

function plainName(value: string) {
  return value
    .normalize("NFD")
    .replace(MARK, "")
    .toLowerCase()
    .replace(GLOTTAL, "")
    .replace(HYPHEN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * An apostrophe in these spellings stands for the vowel a reader types.
 * Y'shua and yeshua are the same search. Removing this breaks that.
 */
export function foldApostrophes(value: string) {
  return value.replace(APOSTROPHE, "e").replace(/\s+/g, " ").trim();
}

function stripApostrophes(value: string) {
  return value.replace(APOSTROPHE, "").replace(/\s+/g, " ").trim();
}

/** Case, marks, glottal letters, apostrophes and hyphens, folded the same on both sides. */
export function foldName(value: string) {
  return foldApostrophes(plainName(value));
}

/** Apostrophe removed, and apostrophe spoken as e. A name matches either. */
function fieldFolds(field: string) {
  const plain = plainName(field);
  const removed = stripApostrophes(plain);
  const spoken = foldApostrophes(plain);
  return removed === spoken ? [removed] : [removed, spoken];
}

export function nameBucket(row: NameEntry): NameKindFilter {
  if (row.kind === "person" || row.kind === "place" || row.kind === "people") return row.kind;
  return "other";
}

export function nameKindCounts() {
  const counts: Record<NameKindFilter, number> = { all: NAMES.length, person: 0, place: 0, people: 0, other: 0 };
  for (const row of NAMES) counts[nameBucket(row)] += 1;
  return counts;
}

export function rootDisplay(row: NameEntry) {
  return row.root?.text ?? row.en;
}

export function rootLanguage(row: NameEntry) {
  const raw = row.root?.lang ?? row.sources?.[0]?.script ?? "Syriac reading";
  if (raw === "needs owner decision") return { text: "root language: owner to confirm", pending: true };
  return { text: raw, pending: false };
}

export function kindLabel(kind: string) {
  if (kind === "person") return "Person";
  if (kind === "place") return "Place";
  if (kind === "people") return "People";
  if (kind === "title") return "Title";
  if (kind === "letter") return "Letter";
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Other";
}

function foldedRank(fields: string[], query: string) {
  let best: number | null = null;
  for (const field of fields) {
    for (const folded of fieldFolds(field)) {
      if (!folded) continue;
      const rank = folded === query ? 0 : folded.startsWith(query) ? 1 : folded.includes(query) ? 2 : null;
      if (rank !== null && (best === null || rank < best)) best = rank;
    }
  }
  return best;
}

function rankOf(row: NameEntry, query: string, notes: boolean) {
  const primary = [row.en, row.known, row.root?.text ?? "", ...(row.forms ?? []), ...(row.spellings ?? [])];
  for (const part of row.known.split(",")) primary.push(part);
  if (notes) {
    if (row.note) primary.push(row.note);
    for (const source of row.sources ?? []) {
      if (source.note) primary.push(source.note);
      if (source.text) primary.push(source.text);
    }
  }
  const secondary = [row.say, row.sy];
  const written = foldedRank(primary, query);
  const spoken = foldedRank(secondary, query);
  const ranks = [written, spoken === null ? null : spoken + 3].filter((rank): rank is number => rank !== null);
  return ranks.length ? Math.min(...ranks) : null;
}

/** Finder rank. say/sy sit three steps under a written match of the same kind. */
export function matchRank(row: NameEntry, query: string, notes = false) {
  const folded = stripApostrophes(plainName(query));
  if (!folded) return 0;
  return rankOf(row, folded, notes);
}

/** Exact name, then prefix, then contains. Notes match only when asked. */
export function filterNames(query: string, kind: NameKindFilter, notes: boolean) {
  const pool = kind === "all" ? NAMES : NAMES.filter((row) => nameBucket(row) === kind);
  const folded = stripApostrophes(plainName(query));
  if (!folded) return pool;
  const hits: { row: NameEntry; rank: number }[] = [];
  for (const row of pool) {
    const rank = rankOf(row, folded, notes);
    if (rank !== null) hits.push({ row, rank });
  }
  hits.sort((a, b) => a.rank - b.rank);
  return hits.map((hit) => hit.row);
}

const byForm = new Map<string, NameEntry>();
for (const name of [...NAMES].sort((a, b) => a.count - b.count)) {
  for (const form of name.forms?.length ? name.forms : [name.en]) {
    const prev = byForm.get(form);
    if (!prev || name.count >= prev.count) byForm.set(form, name);
  }
}

const PREFIXES = ["ܘܕܒ", "ܘܕܠ", "ܘܒܕ", "ܘܕ", "ܘܒ", "ܘܠ", "ܕܒ", "ܕܠ", "ܘ", "ܕ", "ܒ", "ܠ"] as const;
const byStem = new Map<string, NameEntry[]>();

function addStem(key: string, name: NameEntry) {
  const list = byStem.get(key);
  if (!list) byStem.set(key, [name]);
  else if (!list.includes(name)) list.push(name);
}

for (const name of NAMES) {
  const keys = name.spellings?.length ? name.spellings : [name.sy];
  for (const key of keys) addStem(key, name);
  if (!keys.includes(name.sy)) addStem(name.sy, name);
}

function bareSy(word: string) {
  return word.replace(/[܀-܍.,:;]/g, "");
}

function stemOfWord(word: string) {
  const bare = bareSy(word);
  if (!bare) return "";
  if (byStem.has(bare)) return bare;
  for (const prefix of PREFIXES) {
    if (!bare.startsWith(prefix)) continue;
    const rest = bare.slice(prefix.length);
    if (rest.length >= 2 && byStem.has(rest)) return rest;
  }
  return "";
}

const EDGE = /[A-Za-z'’-]/;

function formHitLength(name: NameEntry, english: string) {
  let best = 0;
  for (const form of name.forms?.length ? name.forms : [name.en]) {
    let from = 0;
    while (from < english.length) {
      const at = english.indexOf(form, from);
      if (at < 0) break;
      const before = at > 0 ? english[at - 1] : "";
      const after = english[at + form.length] ?? "";
      if (!EDGE.test(before) && !EDGE.test(after) && form.length > best) best = form.length;
      from = at + Math.max(form.length, 1);
    }
  }
  return best;
}

function peels(word: string) {
  const out = [bareSy(word)];
  let cur = out[0];
  for (let n = 0; n < 3 && cur; n++) {
    const prefix = (["ܘ", "ܕ", "ܒ", "ܠ"] as const).find((item) => cur.startsWith(item) && cur.length - 1 >= 1);
    if (!prefix) break;
    cur = cur.slice(1);
    out.push(cur);
  }
  return out.filter(Boolean);
}

export function nameOfSyriac(word: string, english?: string, prev?: string) {
  const found: NameEntry[] = [];
  const stem = stemOfWord(word);
  if (stem) found.push(...(byStem.get(stem) ?? []));
  if (prev) {
    const rights = [...new Set([stem, bareSy(word)].filter(Boolean))];
    for (const left of peels(prev)) {
      for (const right of rights) found.push(...(byStem.get(`${left} ${right}`) ?? []));
    }
  }
  const unique: NameEntry[] = [];
  for (const name of found) if (!unique.includes(name)) unique.push(name);
  if (!unique.length) return null;
  if (english == null) return unique.slice().sort((a, b) => b.count - a.count)[0];
  let best: NameEntry | null = null;
  let bestLen = 0;
  for (const name of unique) {
    const len = formHitLength(name, english);
    if (len > bestLen || (len > 0 && len === bestLen && best && name.count > best.count)) {
      best = name;
      bestLen = len;
    }
  }
  return best;
}

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NAME_RE = new RegExp(
  `(?<![A-Za-z'’\\-])(${[...byForm.keys()].sort((a, b) => b.length - a.length).map(escapeReg).join("|")})(?![A-Za-z'’\\-])`,
  "gu",
);

export type NameRun = { kind: "text"; text: string } | { kind: "name"; text: string; id: string };

export function nameRuns(input: string): NameRun[] {
  const runs: NameRun[] = [];
  let last = 0;
  NAME_RE.lastIndex = 0;
  for (const match of input.matchAll(NAME_RE)) {
    const index = match.index ?? 0;
    const name = byForm.get(match[1]);
    if (!name) continue;
    if (index > last) runs.push({ kind: "text", text: input.slice(last, index) });
    runs.push({ kind: "name", text: match[1], id: name.id });
    last = index + match[1].length;
  }
  if (last < input.length) runs.push({ kind: "text", text: input.slice(last) });
  return runs;
}
