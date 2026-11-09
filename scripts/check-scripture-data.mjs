#!/usr/bin/env node
// Read-only structural audit. This cannot certify translation accuracy or rights.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./with-app-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Structural coverage declaration only, NOT a linguistic-review or rights certification.
export const PARALLEL_LANGUAGES = ["aii", "ar", "de", "el", "es", "fr", "he", "ja", "ru", "zh"];

export function auditScripture(root = ROOT) {
  const issues = [];
  const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
  const issue = (path, code, at = "") => issues.push(`${path}:${code}${at ? `:${at}` : ""}`);
  const catalog = read("src/data/catalog.json");
  const expectedFiles = catalog.map(({ id }) => `${id}.json`).sort();
  if (new Set(expectedFiles).size !== expectedFiles.length) issue("catalog", "duplicate-book");
  const checkFiles = (dir) => {
    const files = readdirSync(join(root, dir))
      .filter((file) => file.endsWith(".json"))
      .sort();
    for (const file of expectedFiles)
      if (!files.includes(file)) issue(`${dir}/${file}`, "missing-file");
    for (const file of files)
      if (!expectedFiles.includes(file)) issue(`${dir}/${file}`, "unexpected-file");
    return files;
  };
  const sourceFiles = checkFiles("src/data/nt");
  const locales = readdirSync(join(root, "src/data/tr"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const locale of PARALLEL_LANGUAGES)
    if (!locales.includes(locale)) issue(locale, "missing-locale");
  for (const locale of locales)
    if (!PARALLEL_LANGUAGES.includes(locale)) issue(locale, "unreviewed-locale");
  const localeFiles = Object.fromEntries(
    locales.map((locale) => [locale, checkFiles(`src/data/tr/${locale}`)]),
  );
  let verses = 0;
  for (const item of catalog) {
    if (!sourceFiles.includes(`${item.id}.json`)) continue;
    const path = `src/data/nt/${item.id}.json`;
    const book = read(path);
    if (book.id !== item.id) issue(path, "book-id");
    if (!Array.isArray(book.chapters)) {
      issue(path, "chapters-type");
      continue;
    }
    if (book.chapters.length !== item.chapters) issue(path, "chapter-count");
    let count = 0;
    book.chapters.forEach((chapter, ci) => {
      if (!Array.isArray(chapter)) {
        issue(path, "chapter-type", `${ci + 1}`);
        return;
      }
      if (!chapter.length) issue(path, "empty-chapter", `${ci + 1}`);
      chapter.forEach((verse, vi) => {
        count++;
        const ref = `${ci + 1}:${vi + 1}`;
        if (!verse || verse.v !== vi + 1) issue(path, "verse-number", ref);
        for (const field of ["sy", "en"]) {
          if (typeof verse?.[field] !== "string") issue(path, `${field}-type`, ref);
          else if (!verse[field].trim()) issue(path, `${field}-blank`, ref);
        }
      });
    });
    verses += count;
    if (count !== item.verses) issue(path, "verse-count");
    for (const locale of locales) {
      if (!localeFiles[locale].includes(`${item.id}.json`)) continue;
      const gridPath = `src/data/tr/${locale}/${item.id}.json`;
      const grid = read(gridPath);
      if (!Array.isArray(grid)) {
        issue(gridPath, "chapters-type");
        continue;
      }
      if (grid.length !== book.chapters.length) issue(gridPath, "chapter-count");
      book.chapters.forEach((chapter, ci) => {
        if (!Array.isArray(chapter)) return;
        const row = grid[ci];
        if (!Array.isArray(row)) {
          issue(gridPath, "chapter-type", `${ci + 1}`);
          return;
        }
        if (row.length !== chapter.length) issue(gridPath, "verse-count", `${ci + 1}`);
        chapter.forEach((_, vi) => {
          const ref = `${ci + 1}:${vi + 1}`;
          if (typeof row[vi] !== "string") issue(gridPath, "text-type", ref);
          else if (!row[vi].trim()) issue(gridPath, "text-blank", ref);
        });
      });
    }
  }
  return { books: catalog.length, verses, locales, issues: issues.sort() };
}

export function classifyIssues(issues, knownIssues) {
  const known = new Set(knownIssues);
  return {
    known: issues.filter((issue) => known.has(issue)),
    unexpected: issues.filter((issue) => !known.has(issue)),
  };
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--strict"))
    throw new Error("Usage: node scripts/check-scripture-data.mjs [--strict]");
  const result = auditScripture();
  const baseline = JSON.parse(readFileSync(join(ROOT, "docs/data-known-gaps.json"), "utf8"));
  const classified = classifyIssues(result.issues, baseline.issues);
  console.log(
    JSON.stringify(
      {
        ...result,
        ...classified,
        mode: args.includes("--strict") ? "strict" : "regression",
        notice:
          "Known gaps remain unresolved. Passing regression checks is not a translation-quality or release certification.",
      },
      null,
      2,
    ),
  );
  if (classified.unexpected.length || (args.includes("--strict") && result.issues.length))
    process.exitCode = 1;
}
