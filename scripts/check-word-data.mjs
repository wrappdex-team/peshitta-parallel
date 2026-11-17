#!/usr/bin/env node
// Structural check for per-occurrence word files. It does not approve a gloss.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUNCT = /[\u0700-\u070d.,:;]/g;
const POS = new Set(["V", "N", "ADJ", "PRON", "PREP", "CONJ", "PART", "NUM", "NAME", "ADV"]);
const STEMS = new Set(["pe", "pa", "aph", "ethpe", "ethpa", "ettaph", "shaph"]);
const TENSES = new Set(["pf", "impf", "impv", "ptc", "ptcp", "inf"]);
const STATES = new Set(["abs", "cst", "emph"]);
const PGN = /^[123][mfc][sp]$/;
const FN = /\b(and|of|in|to|that|the)\b/i;
const ARCHAIC = /\b(ye|thou|thee|thy|thine|art)\b/i;
const SOURCES = new Set(["jennings-1926", "payne-smith-1903", "thesaurus-syriacus", "brockelmann-1928", "murdock", "project"]);
const LOCKED = [
  ["ܝܫܘܥ", "Y'shua"],
  ["ܐܠܗܐ", "Alaha"],
  ["ܟܐܦܐ", "Keefa"],
  ["ܡܫܝܚܐ", "Mashiyach"],
  ["ܝܘܚܢܢ", "Yochanan"],
];
const PREFIXES = ["ܘܕܒ", "ܘܕܠ", "ܘܒܕ", "ܘܕ", "ܘܒ", "ܘܠ", "ܕܒ", "ܕܠ", "ܘ", "ܕ", "ܒ", "ܠ"];
const SUF_SOUND = [
  ["ܟܘܢ", /khon$/i],
  ["ܗܘܢ", /hon$/i],
  ["ܘܗܝ", /(?:aw|ohi)$/i],
  ["ܟ", /(?:kh|k)$/i],
  ["ܗ", /(?:h|eh|ah)$/i],
  ["ܢ", /n$/i],
  ["ܝ", /(?:i|y)$/i],
];
const OT = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi)\s+\d+:\d+/i;
const SKIP_POS = new Set(["PREP", "CONJ", "PART", "PRON", "ADV"]);

export function syriacWords(sy) {
  const out = [];
  for (const part of String(sy ?? "").split(/\s+/)) {
    const key = part.replace(PUNCT, "");
    if (key) out.push(key);
  }
  return out;
}

function validParse(code) {
  const bits = String(code ?? "").split(".");
  if (!POS.has(bits[0])) return false;
  const rest = bits.slice(1);
  const take = (pred) => {
    if (rest.length && pred(rest[0])) rest.shift();
  };
  if (bits[0] === "V") {
    take((bit) => STEMS.has(bit));
    take((bit) => TENSES.has(bit));
    take((bit) => PGN.test(bit));
    take((bit) => STATES.has(bit));
    return rest.length === 0;
  }
  if (bits[0] === "N" || bits[0] === "ADJ") {
    take((bit) => bit === "m" || bit === "f");
    take((bit) => bit === "sg" || bit === "pl");
    take((bit) => STATES.has(bit));
    return rest.length === 0;
  }
  if (bits[0] === "PRON" || bits[0] === "PART") {
    take((bit) => PGN.test(bit));
    return rest.length === 0;
  }
  take((bit) => STATES.has(bit));
  return rest.length === 0;
}

function lockedIssue(form, say) {
  for (const [sy, need] of LOCKED) {
    if (form === sy || PREFIXES.some((pre) => form === pre + sy)) {
      if (!String(say ?? "").includes(need)) return `locked ${form} missing ${need}`;
    }
  }
  return "";
}

function push(issues, code, where) {
  issues.push(`${code}:${where}`);
}

export function collectIssues(model) {
  const issues = [];
  const reviewers = new Set(model.reviewers ?? []);
  for (const chapter of model.chapters) {
    const where = `${chapter.book}/${chapter.ch}`;
    if ((chapter.gzip ?? 0) > 8192) push(issues, "size", where);
    const verses = model.nt?.[chapter.book]?.[chapter.ch] ?? {};
    const lemmaRows = model.lemmas?.[chapter.book]?.rows ?? [];
    const byId = new Map(lemmaRows.map((row) => [row.id, row]));
    for (const [key, tokens] of Object.entries(chapter.body?.v ?? {})) {
      if (!Object.prototype.hasOwnProperty.call(verses, key)) {
        push(issues, "missing-verse", `${where}:${key}`);
        continue;
      }
      const words = syriacWords(verses[key]);
      if (!Array.isArray(tokens) || tokens.length !== words.length) {
        push(issues, "count", `${where}:${key}`);
        continue;
      }
      tokens.forEach((token, index) => checkToken(issues, token, words[index], index, where, key, byId, reviewers));
    }
  }
  for (const [book, pack] of Object.entries(model.lemmas ?? {})) {
    if ((pack.gzip ?? 0) > 61440) push(issues, "size", `lemmas/${book}`);
    for (const row of pack.rows ?? []) checkLemma(issues, row, book, reviewers);
  }
  return issues;
}

function checkToken(issues, token, word, index, where, key, byId, reviewers) {
  const at = `${where}:${key}:${index}`;
  if (token?.w !== word) push(issues, "mismatch", at);
  if (token?.pre && (!word.startsWith(token.pre) || [...token.pre].length !== (token.prf ?? []).length)) push(issues, "affix", at);
  if (token?.prf && !token.pre) push(issues, "affix", at);
  if (token?.suf && !String(word).endsWith(token.suf)) push(issues, "affix", at);
  if (!validParse(token?.p)) push(issues, "parse", at);
  const lemma = byId.get(token?.l);
  if (!lemma) push(issues, "lemma", at);
  if (FN.test(token?.say ?? "") || FN.test(token?.tr ?? "")) push(issues, "say", at);
  if (token?.suf) {
    const sound = SUF_SOUND.find(([suf]) => suf === token.suf);
    if (!sound || !sound[1].test(token.say ?? "")) push(issues, "say", at);
  }
  const feminine = String(token?.p ?? "").split(".").some((bit) => /^3f[sp]$/.test(bit));
  const plural = String(token?.p ?? "").split(".").some((bit) => /^1[mfc]p$/.test(bit));
  if (feminine && /^he\s/i.test(token?.g ?? "")) push(issues, "person", at);
  if (plural && /^(he|she)\s/i.test(token?.g ?? "")) push(issues, "person", at);
  if ((token?.prf ?? []).some((bit) => /^(who|that|because)$/i.test(bit)) && /^of\s/i.test(token?.g ?? "")) push(issues, "of-gloss", at);
  const gloss = `${token?.g ?? ""}\n${token?.ctx ?? ""}`;
  if (!String(token?.g ?? "").trim() || String(token?.g ?? "").length > 40 || ARCHAIC.test(gloss)) push(issues, "gloss", at);
  const locked = lockedIssue(token?.w, token?.say);
  if (locked) push(issues, "locked", `${at}:${locked}`);
  if ((token?.prov === "reviewed" && !token.rv) || (token?.rv && !reviewers.has(token.rv))) push(issues, "review", at);
  for (const src of token?.src ?? []) if (!SOURCES.has(src)) push(issues, "src", `${at}:${src}`);
  if (lemma?.sy === "ܡܪܝܐ") {
    const flagged = String(token?.flag ?? "").startsWith("needs-scholar");
    if (!flagged && !OT.test(token?.n ?? "")) push(issues, "marya", at);
  }
}

function checkLemma(issues, row, book, reviewers) {
  const at = `lemmas/${book}:${row?.id ?? "?"}`;
  if (FN.test(row?.say ?? "") || FN.test(row?.tr ?? "")) push(issues, "say", at);
  const locked = lockedIssue(row?.sy, row?.say);
  if (locked) push(issues, "locked", `${at}:${locked}`);
  if ((row?.prov === "reviewed" && !row.rv) || (row?.rv && !reviewers.has(row.rv))) push(issues, "review", at);
  for (const src of row?.src ?? []) if (!SOURCES.has(src)) push(issues, "src", `${at}:${src}`);
}

export function glossReport(model) {
  let content = 0;
  let found = 0;
  for (const chapter of model.chapters) {
    const verses = model.nt?.[chapter.book]?.[chapter.ch] ?? {};
    const english = model.en?.[chapter.book]?.[chapter.ch] ?? {};
    for (const [key, tokens] of Object.entries(chapter.body?.v ?? {})) {
      const hay = String(english[key] ?? "").toLowerCase();
      for (const token of tokens ?? []) {
        const pos = String(token?.p ?? "").split(".")[0];
        if (SKIP_POS.has(pos)) continue;
        const words = String(token?.g ?? "")
          .toLowerCase()
          .split(/[^a-z']+/)
          .filter((bit) => bit.length > 2);
        if (!words.length) continue;
        content += 1;
        if (words.some((bit) => hay.includes(bit))) found += 1;
      }
    }
  }
  return `word-data report: ${found}/${content} content-word glosses appear in the English line`;
}

export function loadModel(root = ROOT) {
  const wordsDir = join(root, "src/data/words");
  const chapters = [];
  for (const book of readdirSync(wordsDir)) {
    const dir = join(wordsDir, book);
    if (book === "lemmas" || !statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
      const raw = readFileSync(join(dir, file));
      chapters.push({ book, ch: Number(file.replace(/\.json$/, "")), body: JSON.parse(raw.toString("utf8")), gzip: gzipSync(raw).length });
    }
  }
  const lemmas = {};
  const lemmaDir = join(wordsDir, "lemmas");
  for (const file of readdirSync(lemmaDir).filter((name) => name.endsWith(".json"))) {
    const raw = readFileSync(join(lemmaDir, file));
    const book = file.replace(/\.json$/, "");
    lemmas[book] = { rows: JSON.parse(raw.toString("utf8")), gzip: gzipSync(raw).length };
  }
  const reviewers = JSON.parse(readFileSync(join(wordsDir, "reviewers.json"), "utf8"));
  const nt = {};
  const en = {};
  for (const book of new Set(chapters.map((row) => row.book))) {
    const doc = JSON.parse(readFileSync(join(root, "src/data/nt", `${book}.json`), "utf8"));
    nt[book] = {};
    en[book] = {};
    for (const chapter of chapters.filter((row) => row.book === book)) {
      const verses = doc.chapters[chapter.ch - 1] ?? [];
      nt[book][chapter.ch] = Object.fromEntries(verses.map((verse) => [String(verse.v), verse.sy]));
      en[book][chapter.ch] = Object.fromEntries(verses.map((verse) => [String(verse.v), verse.en]));
    }
  }
  return { chapters, lemmas, reviewers, nt, en };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const model = loadModel();
  const issues = collectIssues(model);
  console.log(glossReport(model));
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exit(1);
  }
}
