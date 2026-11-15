/** Id-keyed verse ordinals. A missing id is absent, never the next card's list. */

export type NameVerseEntry = { id: string; ordinals: number[] };

const VERSION = 2;

function pushVar(bytes: number[], value: number) {
  let rest = value;
  while (rest > 127) {
    bytes.push((rest & 127) | 128);
    rest >>= 7;
  }
  bytes.push(rest);
}

function readVar(bytes: Uint8Array, cursor: { at: number }) {
  let value = 0;
  let shift = 0;
  let bite = 0;
  do {
    bite = bytes[cursor.at++] ?? 0;
    value |= (bite & 127) << shift;
    shift += 7;
  } while (bite & 128);
  return value;
}

export function encodeNameVersePack(entries: NameVerseEntry[]) {
  const bytes: number[] = [VERSION];
  pushVar(bytes, entries.length);
  for (const entry of entries) {
    const id = [...entry.id].map((char) => char.charCodeAt(0));
    if (id.length > 255 || id.some((code) => code > 127)) throw new Error(`name verse id ${entry.id}`);
    bytes.push(id.length, ...id);
    const payload: number[] = [];
    let prev = -1;
    for (const at of entry.ordinals) {
      pushVar(payload, at - prev);
      prev = at;
    }
    if (payload.length > 65535) throw new Error(`name verse list ${entry.id}`);
    bytes.push(payload.length & 255, (payload.length >> 8) & 255, ...payload);
  }
  let binary = "";
  for (const bite of bytes) binary += String.fromCharCode(bite);
  return btoa(binary);
}

export function decodeNameVersePack(pack: string) {
  const map = new Map<string, number[]>();
  if (!pack) return map;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(pack), (char) => char.charCodeAt(0));
  } catch {
    return map;
  }
  if (bytes[0] !== VERSION) return map;
  const cursor = { at: 1 };
  try {
    const count = readVar(bytes, cursor);
    for (let index = 0; index < count; index += 1) {
      const length = bytes[cursor.at++] ?? 0;
      let id = "";
      for (let bite = 0; bite < length; bite += 1) id += String.fromCharCode(bytes[cursor.at++] ?? 0);
      const size = (bytes[cursor.at] ?? 0) | ((bytes[cursor.at + 1] ?? 0) << 8);
      cursor.at += 2;
      const end = cursor.at + size;
      const list: number[] = [];
      let prev = -1;
      while (cursor.at < end) {
        prev += readVar(bytes, cursor);
        list.push(prev);
      }
      if (id) map.set(id, list);
    }
  } catch {
    return new Map();
  }
  return map;
}

export function assertNameVersePackFresh(pack: string, entries: NameVerseEntry[]) {
  const next = encodeNameVersePack(entries);
  if (next !== pack) throw new Error("name verse pack is stale; run node scripts/build-name-verses.mjs");
}
