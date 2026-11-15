import { BOOKS, bookMeta } from "../data/edition.ts";
import { VERSE_COUNTS } from "./verse-counts.ts";
import { NAMES, type NameEntry } from "./names.ts";
import { decodeNameVersePack } from "./name-verse-codec.ts";

export type NameVerse = { book: string; chapter: number; verse: number; label: string };

const places = buildPlaces();
let cachedPack = "";
let cachedLists = new Map<string, number[]>();

function buildPlaces() {
  const out: { book: string; chapter: number; verse: number }[] = [];
  for (const book of BOOKS) {
    const counts = VERSE_COUNTS[book.id] ?? [];
    counts.forEach((count, index) => {
      for (let verse = 1; verse <= count; verse += 1) out.push({ book: book.id, chapter: index + 1, verse });
    });
  }
  return out;
}

function listsFor(pack: string) {
  if (pack !== cachedPack) {
    cachedPack = pack;
    cachedLists = decodeNameVersePack(pack);
  }
  return cachedLists;
}

function labelOf(book: string, chapter: number, verse: number) {
  return `${bookMeta(book)?.name ?? book} ${chapter}:${verse}`;
}

export type StudyLink = { ref: string; book: string; chapter: number; verse: number; href: string; label: string };

export function parseRef(ref: string): StudyLink | null {
  const match = /^([a-z0-9]+)\s+(\d+):(\d+)$/.exec(ref.trim());
  if (!match || !bookMeta(match[1])) return null;
  const book = match[1];
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  return { ref, book, chapter, verse, href: `/read/${book}/${chapter}#v-${verse}`, label: labelOf(book, chapter, verse) };
}

export function studyPeople(row: NameEntry) {
  return (row.people ?? []).map((person) => ({
    label: person.label,
    links: person.refs.map((ref) => parseRef(ref)).filter((link): link is StudyLink => link !== null),
  }));
}

export function studySee(row: NameEntry) {
  return (row.see ?? []).map((id) => ({
    id,
    href: `/names#${id}`,
    label: NAMES.find((item) => item.id === id)?.en ?? id,
  }));
}

function fromRefs(row: NameEntry): NameVerse[] {
  const refs = row.refs?.length ? row.refs : [row.ref];
  const out: NameVerse[] = [];
  for (const ref of refs) {
    const place = parseRef(ref);
    if (place) out.push(place);
  }
  return out;
}

/** Every verse nameRuns links to this card, in canon order. An unknown id falls back to refs. */
export function nameVersesFrom(pack: string, row: NameEntry, catalog: readonly NameEntry[] = NAMES): NameVerse[] {
  const listed = catalog.find((item) => item.id === row.id) ?? row;
  const ordinals = listsFor(pack).get(listed.id) ?? [];
  if (!ordinals.length) return fromRefs(row);
  const out: NameVerse[] = [];
  for (const at of ordinals) {
    const place = places[at];
    if (place) out.push({ ...place, label: labelOf(place.book, place.chapter, place.verse) });
  }
  return out.length ? out : fromRefs(row);
}
