import assert from "node:assert/strict";
import { test } from "node:test";
import { placeNote } from "./note-place.ts";

function inside(frame: ReturnType<typeof placeNote>, width: number) {
  assert.ok(frame.left >= 16, `left ${frame.left}`);
  assert.ok(frame.left + frame.width <= width - 16, `right ${frame.left + frame.width} of ${width}`);
}

test("a narrow note is a card inside 320 and 390", () => {
  for (const width of [320, 390]) {
    const start = placeNote({ left: 280, right: 300, top: 40, bottom: 80 }, { width, height: 700 }, "start");
    const end = placeNote({ left: 4, right: 40, top: 400, bottom: 440 }, { width, height: 700 }, "end");
    assert.equal(start.narrow, true);
    assert.equal(end.narrow, true);
    inside(start, width);
    inside(end, width);
    assert.equal(start.left, 16);
    assert.equal(start.width, width - 32);
  }
});

test("a note below the screen is pulled back inside it", () => {
  const frame = placeNote({ left: 20, right: 60, top: 800, bottom: 853 }, { width: 390, height: 664 }, "end");
  assert.equal(frame.narrow, true);
  inside(frame, 390);
  const wide = placeNote({ left: 20, right: 60, top: 800, bottom: 853 }, { width: 800, height: 664 }, "end");
  assert.ok((wide.top ?? 0) >= 16);
  assert.ok((wide.top ?? 0) + 80 <= 664);
  inside(wide, 800);
});
test("a wide note clamps a left-aligned and a right-aligned mark", () => {
  const right = placeNote({ left: 900, right: 940, top: 20, bottom: 60 }, { width: 960, height: 800 }, "start");
  const left = placeNote({ left: -40, right: 8, top: 20, bottom: 60 }, { width: 960, height: 800 }, "end");
  inside(right, 960);
  inside(left, 960);
  assert.equal(right.narrow, false);
  assert.equal(left.left, 16);
});
