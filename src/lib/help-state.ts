/** Help marks on or off. Stored only in this browser. */

const KEY = "injeel-help";

export type HelpMode = "on" | "off";

export type HelpState = {
  mode: HelpMode;
};

const EMPTY: HelpState = { mode: "on" };

let state = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function readHelp(): HelpState {
  if (loaded || typeof localStorage === "undefined") return state;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return state;
    const parsed = JSON.parse(raw) as Partial<HelpState>;
    state = { mode: parsed.mode === "off" ? "off" : "on" };
    paint(state.mode);
  } catch {
    state = EMPTY;
  }
  return state;
}

function paint(mode: HelpMode) {
  if (typeof document !== "undefined") document.documentElement.dataset.help = mode;
}

function write(mode: HelpMode) {
  state = { mode };
  loaded = true;
  paint(mode);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
  emit();
}

export function subscribeHelp(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setHelpMode(mode: HelpMode) {
  if (readHelp().mode === mode) return;
  write(mode);
}
