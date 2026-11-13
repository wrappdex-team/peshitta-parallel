/** True while a chapter or words reading is playing or paused. Other speech must not cancel it. */

let live = false;
const listeners = new Set<() => void>();

export function readingSessionLive() {
  return live;
}

export function subscribeReadingLive(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setReadingLive(next: boolean) {
  if (live === next) return;
  live = next;
  for (const listener of listeners) listener();
}
