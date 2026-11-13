/** Where a help note sits so it stays inside the viewport. */

export type NoteFrame = {
  left: number;
  width: number;
  top: number | null;
  bottom: number | null;
  narrow: boolean;
};

const INSET = 16;
const NARROW = 480;
const CARD = 288;
const CARD_HEIGHT = 180;

export function placeNote(
  anchor: { left: number; right: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  align: "start" | "end",
): NoteFrame {
  const widthRoom = Math.max(0, viewport.width - INSET * 2);
  if (viewport.width < NARROW) {
    return { left: INSET, width: widthRoom, top: null, bottom: 132, narrow: true };
  }
  const width = Math.min(CARD, widthRoom);
  let left = align === "end" ? anchor.right - width : anchor.left;
  left = Math.max(INSET, Math.min(left, viewport.width - INSET - width));
  let top = anchor.bottom + 8;
  if (top + CARD_HEIGHT > viewport.height - INSET) top = Math.max(INSET, anchor.top - 8 - CARD_HEIGHT);
  const lowest = Math.max(INSET, viewport.height - INSET - Math.min(CARD_HEIGHT, viewport.height - INSET * 2));
  top = Math.max(INSET, Math.min(top, lowest));
  return { left, width, top, bottom: null, narrow: false };
}
