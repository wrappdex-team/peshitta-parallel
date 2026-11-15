import { BOOKS, bookMeta } from "../data/edition.ts";
import { VERSE_COUNTS } from "./verse-counts.ts";
import { NAMES, type NameEntry } from "./names.ts";

export type NameVerse = { book: string; chapter: number; verse: number; label: string };

const places = buildPlaces();
const byId = new Map(NAMES.map((row, index) => [row.id, index]));
let cachedPack = "";
let cachedLists: number[][] = [];

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

function decode(pack: string) {
  const bytes = Uint8Array.from(atob(pack), (char) => char.charCodeAt(0));
  const out: number[][] = [];
  let cursor = 0;
  const readVar = () => {
    let value = 0;
    let shift = 0;
    let bite = 0;
    do {
      bite = bytes[cursor++] ?? 0;
      value |= (bite & 127) << shift;
      shift += 7;
    } while (bite & 128);
    return value;
  };
  for (let name = 0; name < NAMES.length; name += 1) {
    const length = (bytes[cursor] ?? 0) | ((bytes[cursor + 1] ?? 0) << 8);
    cursor += 2;
    if (!length) {
      out.push([]);
      continue;
    }
    const end = cursor + length;
    const list: number[] = [];
    let prev = -1;
    while (cursor < end) {
      prev += readVar();
      if (places[prev]) list.push(prev);
    }
    out.push(list);
  }
  return out;
}

function listsFor(pack: string) {
  if (pack !== cachedPack) {
    cachedPack = pack;
    cachedLists = decode(pack);
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

/** Every verse nameRuns links to this card, in canon order. Falls back to refs. */
export function nameVersesFrom(pack: string, row: NameEntry): NameVerse[] {
  const index = byId.get(row.id);
  const ordinals = index === undefined ? [] : listsFor(pack)[index] ?? [];
  if (!ordinals.length) return fromRefs(row);
  return ordinals.map((at) => {
    const place = places[at];
    return { ...place, label: labelOf(place.book, place.chapter, place.verse) };
  });
}
