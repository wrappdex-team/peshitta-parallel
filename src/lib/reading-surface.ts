import { useLayoutEffect, useRef } from "react";
import type { LangId } from "@/lib/languages";
import type { VoiceId } from "@/lib/speak";

export type ReadingPlace = { book: string; chapter: number };

export type ReadingLine = { v: number; text: string; chapter?: number; key?: string };

export type ReadingSurface = {
  book: string;
  chapter: number;
  voice: VoiceId;
  deviceVoice: string;
  speed: number;
  lang: LangId;
  fromVerse?: number;
  loadLines?: (place: ReadingPlace, lang: LangId) => Promise<ReadingLine[]>;
  nextPlaceOf?: (place: ReadingPlace) => ReadingPlace | null;
  startKey?: string;
  fromLabel?: string;
  onHeard?: (line: { book: string; chapter: number; verse: number } | null) => void;
  onVerse: (verse: number | null) => void;
  onAdvance: (place: ReadingPlace) => void;
  onChapter?: (place: ReadingPlace) => void;
  onVoice: (voice: VoiceId) => void;
  onDeviceVoice: (voice: string) => void;
  onSpeed: (speed: number) => void;
  kind?: "chapter" | "words";
};

type Handle = { readFrom: (key?: string) => void };

let current: ReadingSurface | null = null;
let owner: symbol | null = null;
let handle: Handle | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Publish the open page. A leaving page can clear only its own surface. */
export function publishReadingSurface(next: ReadingSurface | null, token?: symbol) {
  if (next === null) {
    if (token && owner !== token) return;
    owner = null;
    current = null;
    emit();
    return;
  }
  if (token) owner = token;
  current = next;
  emit();
}

export function subscribeReadingSurface(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReadingSurface() {
  return current;
}

export function setReadingHandle(next: Handle | null) {
  handle = next;
}

export function readingReadFrom(key?: string) {
  handle?.readFrom(key);
}

/** Keep the open page's reading controls without clearing them between renders. */
export function useBindReadingSurface(surface: ReadingSurface) {
  const box = useRef(surface);
  const token = useRef(Symbol());
  box.current = surface;
  useLayoutEffect(() => {
    publishReadingSurface(box.current, token.current);
  });
  useLayoutEffect(() => {
    const mine = token.current;
    return () => publishReadingSurface(null, mine);
  }, []);
}
