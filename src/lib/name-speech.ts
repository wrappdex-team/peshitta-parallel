import type { NameEntry } from "./names.ts";

export type NameUtterance = {
  part: "root" | "en";
  text: string;
  lang: "en-US";
  rate: number;
};

const MARK = /\p{M}/gu;
const DROPPED = /[ʿʾ'’]/g;

/** Device voices have no Syriac, so the root is a plain English respelling. */
export function foldedSay(say: string) {
  return say.normalize("NFD").replace(MARK, "").replace(DROPPED, "").toLowerCase();
}

function respell(value: string) {
  return value.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

/** Two device utterances: the root name, then the English name. */
export function nameUtterances(row: NameEntry): NameUtterance[] {
  const root = row.pron?.root?.respell ? respell(row.pron.root.respell) : foldedSay(row.say);
  const english = row.pron?.en?.respell ? respell(row.pron.en.respell) : row.known.split(",")[0]?.trim() || row.en;
  return [
    { part: "root", text: root, lang: "en-US", rate: 0.72 },
    { part: "en", text: english, lang: "en-US", rate: 0.9 },
  ];
}

function sameName(value: string) {
  return value.normalize("NFC").replace(/[’ʼ]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Read button label. When the heading and the English are the same text, the name is said once. */
export function readLabel(root: string, english: string) {
  return sameName(root) === sameName(english) ? `Read ${root} (Syriac, then English)` : `Read ${root} then ${english}`;
}
