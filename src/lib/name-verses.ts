import { type NameEntry } from "./names.ts";
import { NAME_VERSE_PACK } from "./name-verse-pack.ts";
import { nameVersesFrom } from "./name-verse-decode.ts";

export { nameVersesFrom, parseRef, studyPeople, studySee } from "./name-verse-decode.ts";
export type { NameVerse, StudyLink } from "./name-verse-decode.ts";

/** Every verse nameRuns links to this card, in canon order. Falls back to refs. */
export function nameVerses(row: NameEntry) {
  return nameVersesFrom(NAME_VERSE_PACK, row);
}

export function studySnapshot(row: NameEntry) {
  const verses = nameVerses(row);
  return {
    id: row.id,
    kind: row.kind,
    verses: verses.length,
    first: verses[0]?.label ?? "",
    people: row.people?.length ?? 0,
    see: row.see ?? [],
  };
}
