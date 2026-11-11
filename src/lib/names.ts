import registry from "@/data/names.json";

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
};

export const NAMES = (registry.names as NameEntry[]).slice().sort((a, b) => a.en.localeCompare(b.en, "en"));

const byForm = new Map<string, NameEntry>();
for (const name of [...NAMES].sort((a, b) => a.count - b.count)) {
  for (const form of name.forms?.length ? name.forms : [name.en]) byForm.set(form, name);
}

const PREFIXES = ["ܘܕܒ", "ܘܕܠ", "ܘܒܕ", "ܘܕ", "ܘܒ", "ܘܠ", "ܕܒ", "ܕܠ", "ܘ", "ܕ", "ܒ", "ܠ"] as const;
const byStem = new Map<string, NameEntry>();
for (const name of [...NAMES].sort((a, b) => a.count - b.count)) byStem.set(name.sy, name);

function stemOf(word: string) {
  let stem = word.replace(/[܀-܍.,:;]/g, "");
  for (const prefix of PREFIXES) {
    if (stem.startsWith(prefix) && stem.length - prefix.length >= 2) {
      stem = stem.slice(prefix.length);
      break;
    }
  }
  return stem;
}

export function nameOfSyriac(word: string) {
  return byStem.get(stemOf(word)) ?? null;
}

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NAME_RE = new RegExp(
  `(?<![A-Za-z'’])(${[...byForm.keys()].sort((a, b) => b.length - a.length).map(escapeReg).join("|")})(?![A-Za-z'’])`,
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

