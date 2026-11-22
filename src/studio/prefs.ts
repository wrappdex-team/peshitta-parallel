/**
 * Studio on/off and the reader's "open Studio here" signal.
 * localStorage["injeel-studio"] holds non-secret preferences only. Off by default.
 */
import { useSyncExternalStore } from "react";

export const PREFS_KEY = "injeel-studio";
export type StudioVerse = { v: number; en: string; sy?: string };
export type StudioScope = { book: string; bookName: string; chapter: number; verses: StudioVerse[]; from: number; to: number };

const listeners = new Set<() => void>();

export function readStudioPrefs(): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function patchStudioPrefs(patch: Record<string, unknown>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readStudioPrefs(), ...patch }));
  } catch {
    /* Preferences are optional when storage is denied. */
  }
  for (const listener of listeners) listener();
}

export function studioEnabled() {
  return readStudioPrefs().enabled === true;
}

export function setStudioEnabled(on: boolean) {
  patchStudioPrefs({ enabled: on });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREFS_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** False on the server and until the reader turns Studio on. */
export function useStudioEnabled() {
  return useSyncExternalStore(subscribe, studioEnabled, () => false);
}

let opener: ((scope: StudioScope) => void) | null = null;

export function onOpenStudio(listener: (scope: StudioScope) => void) {
  opener = listener;
  return () => {
    if (opener === listener) opener = null;
  };
}

export function openStudio(scope: StudioScope) {
  opener?.(scope);
}

export function scopeRef(scope: StudioScope) {
  const head = `${scope.bookName} ${scope.chapter}`;
  const last = scope.verses[scope.verses.length - 1]?.v ?? scope.to;
  if (scope.from <= 1 && scope.to >= last && scope.verses.length > 1) return head;
  return scope.from === scope.to ? `${head}:${scope.from}` : `${head}:${scope.from}–${scope.to}`;
}

export function scopeVerses(scope: StudioScope) {
  return scope.verses.filter((verse) => verse.v >= scope.from && verse.v <= scope.to);
}
