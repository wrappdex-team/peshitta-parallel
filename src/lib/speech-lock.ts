/** True while a chapter or words reading is playing or paused. Other speech must not cancel it. */

let live = false;

export function readingSessionLive() {
  return live;
}

export function setReadingLive(next: boolean) {
  live = next;
}
