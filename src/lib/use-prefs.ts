import { useEffect, useSyncExternalStore } from "react";
import { isIntroduced, parseStoredPrefs, visitorStanding, type Prefs } from "./prefs-store.ts";

export type { Face, Prefs } from "./prefs-store.ts";

const KEY = "peshitta-parallel";
const DEFAULTS: Prefs = parseStoredPrefs(null);

let memory: Prefs | null = null;
/** False while this device still owes an answer. A place-save must not flip it. */
let introduced = true;
const listeners = new Set<() => void>();
let clientReady = false;
const readyListeners = new Set<() => void>();
let storageWatch = false;
const introListeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function paint() {
  if (typeof document !== "undefined" && memory) document.documentElement.dataset.theme = memory.theme;
}

function load() {
  if (typeof window === "undefined") {
    memory = { ...DEFAULTS };
    introduced = true;
    return;
  }
  const raw = localStorage.getItem(KEY);
  memory = parseStoredPrefs(raw);
  introduced = isIntroduced(raw);
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

function persist() {
  if (typeof window === "undefined" || !memory) return;
  // A late place-save must not wipe an answer another tab just stored.
  if (!introduced && memory.intro !== 1 && visitorStanding(localStorage.getItem(KEY)) === "answered") {
    introduced = true;
    memory = parseStoredPrefs(localStorage.getItem(KEY));
    paint();
    return;
  }
  const payload: Record<string, unknown> = { ...memory };
  if (memory.intro === 1) payload.intro = 1;
  else if (!introduced) payload.intro = 0;
  else delete payload.intro;
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* private mode still keeps the choice for this visit */
  }
}

function patch(partial: Partial<Prefs>) {
  if (!memory) ensure();
  if (typeof window !== "undefined" && partial.intro !== 1) {
    const raw = localStorage.getItem(KEY);
    const standing = visitorStanding(raw);
    if (standing === "answered" || standing === "returning") {
      introduced = true;
      const saved = parseStoredPrefs(raw);
      memory = { ...saved, ...partial };
      if (saved.intro === 1) memory.intro = 1;
      else delete memory.intro;
      persist();
      paint();
      emit();
      return;
    }
  }
  const base = memory ?? { ...DEFAULTS };
  memory = { ...base, ...partial };
  if (partial.intro === 1) {
    memory.intro = 1;
    introduced = true;
  } else if (memory.intro !== 1) delete memory.intro;
  persist();
  paint();
  emit();
}

function watchStorage() {
  if (storageWatch || typeof window === "undefined") return;
  storageWatch = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== KEY) return;
    const raw = localStorage.getItem(KEY);
    memory = parseStoredPrefs(raw);
    introduced = isIntroduced(raw);
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
