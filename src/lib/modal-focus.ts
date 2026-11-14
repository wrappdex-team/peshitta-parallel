type Entry = { dialog: HTMLDialogElement; opener: HTMLElement | null; skipFocus?: boolean };
const stacks = new WeakMap<Document, Entry[]>();
const SCROLL_LOCK = "modal-scroll-lock";

function visible(element: HTMLElement) {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return !element.matches(":disabled") && !element.closest("[hidden], [inert]") &&
    element.getClientRects().length > 0 && style?.visibility !== "hidden" && style?.visibility !== "collapse";
}

function controls(dialog: HTMLDialogElement) {
  return [...dialog.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex], [contenteditable='true']")]
    .filter((element) => element.tabIndex >= 0 && visible(element))
    .sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}

function focusInitial(dialog: HTMLDialogElement) {
  const initial = dialog.querySelector<HTMLElement>("[data-modal-initial]");
  const target = initial && visible(initial) ? initial : controls(dialog)[0] ?? dialog;
  target.focus();
}

export function isTopModal(dialog: HTMLDialogElement) {
  return stacks.get(dialog.ownerDocument)?.at(-1)?.dialog === dialog;
}

function lockScroll(document: Document) {
  const html = document.documentElement;
  const view = document.defaultView;
  if (!html?.classList || !view || typeof view.scrollTo !== "function" || html.classList.contains(SCROLL_LOCK)) return;
  const y = view.scrollY || 0;
  html.dataset.modalScrollY = String(y);
  html.classList.add(SCROLL_LOCK);
  if (view.scrollY !== y) view.scrollTo(0, y);
}

function holdScroll(document: Document) {
  const html = document.documentElement;
  const view = document.defaultView;
  if (!html?.classList?.contains(SCROLL_LOCK) || !view || typeof view.scrollTo !== "function") return;
  const y = Number(html.dataset.modalScrollY || "0");
  if (view.scrollY !== y) view.scrollTo(0, y);
}

function unlockScroll(document: Document) {
  const html = document.documentElement;
  const view = document.defaultView;
  if (!html?.classList?.contains(SCROLL_LOCK)) return;
  const y = Number(html.dataset.modalScrollY || "0");
  html.classList.remove(SCROLL_LOCK);
  delete html.dataset.modalScrollY;
  view?.scrollTo?.(0, y);
}

/** Native modality owns background inertness; this adds tested keyboard boundaries
 * and opener restoration, including sheets whose opener disappears in a switch. */
export function activateModal(dialog: HTMLDialogElement, dismiss: () => void) {
  const document = dialog.ownerDocument;
  const active = document.activeElement;
  const entry: Entry = { dialog, opener: active instanceof HTMLElement ? active : null };
  const stack = stacks.get(document) ?? [];
  // Do not use the open attribute or show(): neither establishes native modality.
  dialog.showModal();
  stack.push(entry);
  stacks.set(document, stack);
  if (stack.length === 1) lockScroll(document);
  focusInitial(dialog);
  holdScroll(document);

  function cancel(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (isTopModal(dialog)) dismiss();
  }
  function keydown(event: KeyboardEvent) {
    if (!isTopModal(dialog) || event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (event.key === "Enter") {
      const target = event.target;
      const tag = target && typeof target === "object" && "tagName" in target ? String(target.tagName) : "";
      if (tag === "INPUT") {
        event.preventDefault();
        entry.skipFocus = true;
      }
      return;
    }
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const items = controls(dialog);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (!items.length || (event.shiftKey ? at <= 0 : at < 0 || at === items.length - 1)) {
      event.preventDefault();
      (items[event.shiftKey ? items.length - 1 : 0] ?? dialog).focus();
    }
  }
  function scrollPort(target: EventTarget | null) {
    const view = dialog.ownerDocument.defaultView;
    let node: EventTarget | null = target;
    while (node && node !== dialog && typeof node === "object" && "parentElement" in node) {
      const element = node as HTMLElement;
      const over = view?.getComputedStyle(element).overflowY;
      if ((over === "auto" || over === "scroll" || over === "overlay") && element.scrollHeight > element.clientHeight + 1) return element;
      node = element.parentElement;
    }
    return null;
  }
  function gesture(event: Event) {
    if (event.type === "touchmove") {
      if (event.target === dialog) event.preventDefault();
      return;
    }
    const scroller = scrollPort(event.target);
    event.preventDefault();
    if (!scroller || !("deltaY" in event)) return;
    const delta = Number((event as WheelEvent).deltaY) || 0;
    const max = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTop = Math.max(0, Math.min(max, scroller.scrollTop + delta));
  }
  dialog.addEventListener("cancel", cancel);
  dialog.addEventListener("keydown", keydown);
  dialog.addEventListener("wheel", gesture, { passive: false });
  dialog.addEventListener("touchmove", gesture, { passive: false });

  return () => {
    const at = stack.indexOf(entry);
    if (at < 0) return;
    const wasTop = at === stack.length - 1;
    stack.splice(at, 1);
    // A child may outlive a parent sheet that contained its original opener.
    for (const other of stack) {
      if (other.opener && dialog.contains(other.opener)) other.opener = entry.opener;
    }
    dialog.removeEventListener("cancel", cancel);
    dialog.removeEventListener("keydown", keydown);
    dialog.removeEventListener("wheel", gesture);
    dialog.removeEventListener("touchmove", gesture);
    if (dialog.open) dialog.close();
    if (!stack.length) unlockScroll(document);
    const top = stack.at(-1);
    if (wasTop && !entry.skipFocus && entry.opener?.isConnected && (!top || top.dialog.contains(entry.opener))) {
      entry.opener.focus({ preventScroll: true });
    }
    if (top && !top.dialog.contains(document.activeElement)) focusInitial(top.dialog);
    holdScroll(document);
    if (!stack.length) stacks.delete(document);
  };
}
