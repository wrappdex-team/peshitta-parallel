import { useEffect, useSyncExternalStore } from "react";
import { hasStoredPrefs, parseStoredPrefs, type Prefs } from "./prefs-store.ts";

export type { Face, Prefs } from "./prefs-store.ts";

const KEY = "peshitta-parallel";
const DEFAULTS: Prefs = parseStoredPrefs(null);

let memory: Prefs | null = null;
/** False only until the first read finds no saved prefs. A later write does not hide the card. */
let introduced = true;
const listeners = new Set<() => void>();
let clientReady = false;
const readyListeners = new Set<() => void>();
let storageWatch = false;
const introListeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function load() {
  if (typeof window === "undefined") {
    memory = { ...DEFAULTS };
    introduced = true;
    return;
  }
  const raw = localStorage.getItem(KEY);
  memory = parseStoredPrefs(raw);
  introduced = hasStoredPrefs(raw);
}

function ensure() {
  if (!memory) load();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensure();
  return memory ?? DEFAULTS;
}

function getServerSnapshot() {
  return DEFAULTS;
}

function getIntroduced() {
  ensure();
  return introduced;
}

function subscribeReady(listener: () => void) {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

function patch(partial: Partial<Prefs>) {
  if (!memory) ensure();
  const base = memory ?? { ...DEFAULTS };
  memory = { ...base, ...partial };
  if (partial.intro === 1) {
    memory.intro = 1;
    introduced = true;
  } else if (memory.intro !== 1) delete memory.intro;
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* private mode still keeps the choice for this visit */
  }
  if (typeof document !== "undefined") document.documentElement.dataset.theme = memory.theme;
  emit();
}

function watchStorage() {
  if (storageWatch || typeof window === "undefined") return;
  storageWatch = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== KEY) return;
    const raw = localStorage.getItem(KEY);
    memory = parseStoredPrefs(raw);
    introduced = hasStoredPrefs(raw);
    document.documentElement.dataset.theme = memory.theme;
    emit();
  });
}

/** Ask the first-run card to open again. Books and Reading both call this. */
export function requestReadingIntro() {
  for (const listener of introListeners) listener();
}

export function subscribeReadingIntro(listener: () => void) {
  introListeners.add(listener);
  return () => {
    introListeners.delete(listener);
  };
}

/** One reading setup for the whole site. The menu, the page, and the voice share it. */
export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribeReady, () => clientReady, () => false);
  const introduced = useSyncExternalStore(subscribe, getIntroduced, () => true);

  useEffect(() => {
    ensure();
    document.documentElement.dataset.theme = getSnapshot().theme;
    watchStorage();
    clientReady = true;
    for (const listener of readyListeners) listener();
  }, []);

  return { prefs, patch, ready, introduced };
}
