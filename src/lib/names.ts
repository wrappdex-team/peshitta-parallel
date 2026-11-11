import registry from "@/data/names.json";

export type NameSource = {
  script: string;
  text: string;
  say?: string;
  note?: string;
};

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
};

export const NAME_CLASS =
  "rounded-sm bg-gold-soft px-0.5 font-semibold text-inherit underline decoration-gold/70 underline-offset-2";

export const NAMES = (registry.names as NameEntry[]).slice().sort((a, b) => a.en.localeCompare(b.en, "en"));

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

