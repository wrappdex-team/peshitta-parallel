type Entry = { dialog: HTMLDialogElement; opener: HTMLElement | null };
const stacks = new WeakMap<Document, Entry[]>();

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
  target.focus({ preventScroll: true });
}

export function isTopModal(dialog: HTMLDialogElement) {
  return stacks.get(dialog.ownerDocument)?.at(-1)?.dialog === dialog;
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
  focusInitial(dialog);

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
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const items = controls(dialog);
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (!items.length || (event.shiftKey ? at <= 0 : at < 0 || at === items.length - 1)) {
      event.preventDefault();
      (items[event.shiftKey ? items.length - 1 : 0] ?? dialog).focus({ preventScroll: true });
    }
  }
  dialog.addEventListener("cancel", cancel);
  dialog.addEventListener("keydown", keydown);

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
    if (dialog.open) dialog.close();
    const top = stack.at(-1);
    if (wasTop && entry.opener?.isConnected && (!top || top.dialog.contains(entry.opener))) {
      entry.opener.focus({ preventScroll: true });
    }
    if (top && !top.dialog.contains(document.activeElement)) focusInitial(top.dialog);
    if (!stack.length) stacks.delete(document);
  };
}
