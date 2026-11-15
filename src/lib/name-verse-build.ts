import { readFileSync } from "node:fs";
import { BOOKS } from "../data/edition.ts";
import { NAMES, nameRuns, type NameEntry } from "./names.ts";
import { encodeNameVersePack, type NameVerseEntry } from "./name-verse-codec.ts";

/** Hits longer than the card's own refs. Shorter lists stay on refs, so they are not stored. */
export function entriesFromVerses(names: readonly NameEntry[], verses: readonly { en?: string }[]): NameVerseEntry[] {
  const byId = new Map<string, number[]>(names.map((row) => [row.id, []]));
  verses.forEach((verse, ordinal) => {
    const seen = new Set<string>();
    for (const run of nameRuns(verse.en || "")) {
      if (run.kind === "name") seen.add(run.id);
    }
    for (const id of seen) byId.get(id)?.push(ordinal);
  });
  const entries: NameVerseEntry[] = [];
  for (const row of names) {
    const ordinals = byId.get(row.id) ?? [];
    const have = row.refs?.length || 1;
    if (ordinals.length <= have) continue;
    entries.push({ id: row.id, ordinals });
  }
  return entries;
}

export function collectNameVerseEntries() {
  const verses: { en?: string }[] = [];
  for (const book of BOOKS) {
    const data = JSON.parse(readFileSync(new URL(`../data/nt/${book.id}.json`, import.meta.url), "utf8")) as {
      chapters: { en?: string }[][];
    };
    for (const chapter of data.chapters) verses.push(...chapter);
  }
  return entriesFromVerses(NAMES, verses);
}

export function buildNameVersePack() {
  return encodeNameVersePack(collectNameVerseEntries());
}
