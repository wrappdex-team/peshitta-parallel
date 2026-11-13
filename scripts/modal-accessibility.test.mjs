import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
function compile(path) {
  return ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return;
  if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean);
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}
function searchFixture() {
  const listeners = new Map(), effects = [], cleanups = [];
  const Modal = (props) => jsxRuntime.jsx("dialog", { "aria-label": props.label, children: props.children });
  const exports = {};
  runInNewContext(compile("src/components/search-panel.tsx"), { exports,
    window: { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } },
    require(name) {
      if (name === "react") return { useState: (initial) => [initial, () => {}], useMemo: (factory) => factory(), useEffect: (effect) => effects.push(effect), useRef: (initial) => ({ current: initial }) };
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "@/components/modal") return { Modal };
      if (name === "@tanstack/react-router") return { useNavigate: () => () => {}, Link: (props) => jsxRuntime.jsx("a", props) };
      if (name === "@/data/edition") return { bookMeta: () => null };
      if (name === "@/lib/scripture") return { loadSearch: async () => [], loadSyriacSearch: async () => [], loadLanguageSearch: async () => [] };
      if (name === "@/components/info-mark") return { InfoMark: () => null };
      if (name === "@/lib/use-prefs") return { usePrefs: () => ({ prefs: { lang: "en", theme: "day" }, patch() {} }) };
      if (name === "@/lib/search") return {
        bookTitle: (id) => id,
        cachedIndex: () => null,
        chipLangs: () => [{ id: "en", label: "English", face: "serif" }],
        clipParts: () => ({ before: "", hit: "", after: "" }),
        faceClass: () => "",
        foreignScript: () => null,
        loadIndex: async () => [],
        lookupNames: () => [],
        plainLabel: () => "English",
        prepareSearch: () => ({ hits: [], reference: null, referenceHit: null, aliases: [], direct: [] }),
        readReference: () => null,
        referenceNote: () => "",
        resultFace: () => ({ className: "", dir: "ltr", lang: "en" }),
        resultNote: () => "",
      };
      throw new Error(`Unexpected modal-search test import: ${name}`);
    },
  });
  let dismissed = 0;
  const tree = exports.SearchPanel({ open: true, onClose() { dismissed++; } });
  for (const effect of effects) cleanups.push(effect());
  return { tree, Modal, listeners, dismissed: () => dismissed, cleanup() { for (const cleanup of cleanups) cleanup?.(); } };
}

test("Search delegates to the shared named native modal without pre-mount autofocus", () => {
  const page = searchFixture();
  assert.equal(page.tree.type, page.Modal);
  assert.equal(page.tree.props.label, "Search the New Testament");
  assert.equal(find(page.tree, (node) => node.type === "input").props.autoFocus, undefined,
    "autofocus must not replace the opener before modal activation captures it");
  page.cleanup();
});

test("Search must not globally dismiss itself when Escape belongs to another sheet", () => {
  const page = searchFixture();
  page.listeners.get("keydown")?.({ key: "Escape" });
  assert.equal(page.dismissed(), 0, "global Escape currently closes a hidden/underlying Search");
  assert.equal(page.listeners.size, 0);
  page.cleanup();
});


// Minimal DOM/native-dialog seam. This tests our focus/stack/keyboard logic, not
// a browser's native inertness, CSS layout, top-layer rendering or AT behavior.
class Element {
  constructor(document, tag = "button", options = {}) {
    this.ownerDocument = document; this.tag = tag; this.children = []; this.parent = null;
    this.attrs = new Set(options.attrs ?? []); this.disabled = options.disabled ?? false;
    this.tabIndex = options.tabIndex ?? (["button", "input", "a", "select", "textarea"].includes(tag) ? 0 : -1);
    this.visibility = options.visibility ?? "visible"; this.display = options.display ?? true;
    this.isConnected = true; this.listeners = new Map(); this.focusCalls = [];
  }
  append(child) { child.parent = this; this.children.push(child); return child; }
  hasAttribute(name) { return this.attrs.has(name); }
  closest() { return this.attrs.has("hidden") || this.attrs.has("inert") ? this : this.parent?.closest() ?? null; }
  matches(selector) { assert.equal(selector, ":disabled"); return this.disabled; }
  getClientRects() { return this.display ? [{}] : []; }
  descendants() { return this.children.flatMap((node) => [node, ...node.descendants()]); }
  querySelectorAll() { return this.descendants().filter((node) => ["button", "input", "a", "select", "textarea"].includes(node.tag) || node.attrs.has("tabindex") || node.attrs.has("contenteditable")); }
  querySelector(selector) { assert.equal(selector, "[data-modal-initial]"); return this.descendants().find((node) => node.attrs.has("data-modal-initial")) ?? null; }
  contains(node) { return node === this || this.descendants().includes(node); }
  focus(options) {
    const top = this.ownerDocument.nativeStack.at(-1);
    if (!this.isConnected || !this.display || this.closest() || (top && !top.contains(this))) return;
    this.focusCalls.push(options); this.ownerDocument.activeElement = this;
  }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatch(name, values = {}) {
    const event = { key: "", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false,
      defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...values };
    for (const fn of this.listeners.get(name) ?? []) fn(event);
    return event;
  }
}
class Dialog extends Element {
  constructor(document) { super(document, "dialog"); this.open = false; this.shows = 0; this.closes = 0; }
  showModal() { assert.equal(this.open, false); this.open = true; this.shows++; this.ownerDocument.nativeStack.push(this); }
  close() { this.open = false; this.closes++; const stack = this.ownerDocument.nativeStack; stack.splice(stack.indexOf(this), 1); if (!stack.length) this.ownerDocument.activeElement = this.ownerDocument.body; }
}
function domFixture() {
  const document = { nativeStack: [], defaultView: { getComputedStyle: (node) => ({ visibility: node.visibility }) } };
  document.body = new Element(document, "body");
  document.activeElement = document.body;
  const opener = document.body.append(new Element(document)); opener.focus();
  const exports = {};
  runInNewContext(compile("src/lib/modal-focus.ts"), { exports, HTMLElement: Element });
  function dialog(options = [{}, {}]) {
    const node = document.body.append(new Dialog(document));
    const items = options.map((option) => node.append(new Element(document, option.tag ?? "button", option)));
    return { node, items };
  }
  return { document, opener, dialog, ...exports };
}

test("native activation captures the actual focused opener and restores it without scrolling", () => {
  const page = domFixture();
  const other = page.document.body.append(new Element(page.document)); other.focus();
  const { node, items } = page.dialog([{ tag: "input", attrs: ["data-modal-initial"] }, {}]);
  const cleanup = page.activateModal(node, () => {});
  assert.equal(node.shows, 1); assert.equal(node.open, true);
  assert.equal(page.document.activeElement, items[0]);
  cleanup();
  assert.equal(page.document.activeElement, other, "not a hardcoded toolbar or Close button");
  assert.equal(other.focusCalls.at(-1).preventScroll, true);
  assert.equal(node.closes, 1);
  assert.ok([...node.listeners.values()].every((set) => set.size === 0));
  cleanup(); assert.equal(node.closes, 1, "cleanup is idempotent");
});

test("Tab and ShiftTab wrap only at the visible enabled control boundaries", () => {
  const page = domFixture();
  const { node, items } = page.dialog([{}, { disabled: true }, { visibility: "hidden" }, { attrs: ["hidden"] }, { display: false }, {}, {}]);
  const cleanup = page.activateModal(node, () => {});
  items[6].focus(); const next = node.dispatch("keydown", { key: "Tab" });
  assert.equal(next.defaultPrevented, true); assert.equal(page.document.activeElement, items[0]);
  assert.notEqual(items[0].focusCalls.at(-1)?.preventScroll, true, "wrapped control must scroll into view in long panels");
  const previous = node.dispatch("keydown", { key: "Tab", shiftKey: true });
  assert.equal(previous.defaultPrevented, true); assert.equal(page.document.activeElement, items[6]);
  items[5].focus(); assert.equal(node.dispatch("keydown", { key: "Tab" }).defaultPrevented, false);
  items[6].disabled = true; items[5].focus();
  assert.equal(node.dispatch("keydown", { key: "Tab" }).defaultPrevented, true);
  assert.equal(page.document.activeElement, items[0]);
  cleanup();
});

test("single-control and empty dialogs cannot Tab out into the background", () => {
  for (const options of [[{}], []]) {
    const page = domFixture(); const { node, items } = page.dialog(options);
    const cleanup = page.activateModal(node, () => {});
    for (const shiftKey of [false, true]) {
      assert.equal(node.dispatch("keydown", { key: "Tab", shiftKey }).defaultPrevented, true);
      assert.equal(page.document.activeElement, items[0] ?? node);
    }
    cleanup();
  }
});

test("an explicitly focused non-tabstop title advances to the first control", () => {
  const page = domFixture();
  const { node, items } = page.dialog([{ tag: "p", tabIndex: -1, attrs: ["data-modal-initial", "tabindex"] }, {}, {}]);
  const cleanup = page.activateModal(node, () => {});
  assert.equal(page.document.activeElement, items[0]);
  assert.notEqual(items[0].focusCalls.at(-1)?.preventScroll, true, "initial title must be visible even if native focus first scrolled to Close");
  assert.equal(node.dispatch("keydown", { key: "Tab" }).defaultPrevented, true);
  assert.equal(page.document.activeElement, items[1]);
  cleanup();
});

test("native cancel and Escape dismiss only the top sheet, not an underlying sibling", () => {
  const page = domFixture(); let a = 0, b = 0;
  const parent = page.dialog(), child = page.dialog();
  const closeA = page.activateModal(parent.node, () => { a++; });
  const closeB = page.activateModal(child.node, () => { b++; });
  parent.node.dispatch("keydown", { key: "Escape" }); parent.node.dispatch("cancel");
  assert.equal(a, 0);
  const escape = child.node.dispatch("keydown", { key: "Escape" });
  assert.equal(escape.defaultPrevented, true); assert.equal(escape.stopped, true);
  assert.equal(a, 0); assert.equal(b, 1);
  assert.equal(child.node.dispatch("cancel").defaultPrevented, true); assert.equal(b, 2);
  closeB(); closeA();
});

test("nested sheet closure restores its opener inside the remaining parent", () => {
  const page = domFixture(); const parent = page.dialog(), child = page.dialog();
  const closeA = page.activateModal(parent.node, () => {});
  parent.items[1].focus();
  const closeB = page.activateModal(child.node, () => {});
  closeB(); assert.equal(page.document.activeElement, parent.items[1]);
  assert.equal(page.isTopModal(parent.node), true);
  closeA(); assert.equal(page.document.activeElement, page.opener);
});

test("closing an underlying sheet cannot steal top focus or lose the root opener", () => {
  const page = domFixture(); const parent = page.dialog(), child = page.dialog();
  const closeA = page.activateModal(parent.node, () => {});
  parent.items[1].focus();
  const closeB = page.activateModal(child.node, () => {});
  closeA(); parent.items[1].isConnected = false;
  assert.equal(page.document.activeElement, child.items[0]);
  closeB(); assert.equal(page.document.activeElement, page.opener, "removed opener inherits its parent sheet's opener");
});

test("switching menu/Reading into Studio preserves the original connected opener", () => {
  const page = domFixture(); const reading = page.dialog(), studio = page.dialog();
  const closeReading = page.activateModal(reading.node, () => {});
  reading.items[1].focus(); closeReading(); reading.items[1].isConnected = false;
  const closeStudio = page.activateModal(studio.node, () => {});
  closeStudio(); assert.equal(page.document.activeElement, page.opener);
});

test("disconnected openers are not focused, and strict cleanup/replay does not leak stack entries", () => {
  const page = domFixture(); const { node } = page.dialog();
  const first = page.activateModal(node, () => {}); first();
  const second = page.activateModal(node, () => {}); page.opener.isConnected = false;
  second();
  assert.equal(page.isTopModal(node), false); assert.equal(node.shows, 2); assert.equal(node.closes, 2);
  assert.equal(page.document.activeElement, page.document.body);
});

test("IME Escape and browser shortcut modifiers are not intercepted", () => {
  const page = domFixture(); const { node } = page.dialog(); let closed = 0;
  const cleanup = page.activateModal(node, () => { closed++; });
  assert.equal(node.dispatch("keydown", { key: "Escape", isComposing: true }).defaultPrevented, false);
  for (const modifier of ["ctrlKey", "altKey", "metaKey"]) {
    assert.equal(node.dispatch("keydown", { key: "Tab", [modifier]: true }).defaultPrevented, false);
  }
  assert.equal(closed, 0); cleanup();
});

test("Modal rerenders retain native activation/focus and use the latest close callback", () => {
  const page = domFixture(); const { node, items } = page.dialog();
  const refs = [], dependencies = []; let refAt = 0, effectAt = 0, effects = []; const cleanups = [];
  const exports = {};
  runInNewContext(compile("src/components/modal.tsx"), { exports, require(name) {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "@/lib/modal-focus") return page;
    if (name === "react") return {
      useRef(initial) { return refs[refAt++] ??= { current: initial }; },
      useLayoutEffect(effect, deps) { const i = effectAt++; if (!dependencies[i]) effects.push(effect); dependencies[i] = deps; },
    };
    throw new Error(`Unexpected Modal fixture import: ${name}`);
  } });
  let old = 0, latest = 0;
  function render(onClose) {
    refAt = effectAt = 0; effects = [];
    const tree = exports.Modal({ label: "Fixture dialog", className: "fixed inset-0", onClose, children: null });
    tree.props.ref.current = node;
    for (const effect of effects) cleanups.push(effect());
    return tree;
  }
  const first = render(() => { old++; });
  assert.equal(first.type, "dialog"); assert.equal(first.props["aria-label"], "Fixture dialog");
  assert.equal(first.props.open, undefined, "open attribute alone would be nonmodal");
  assert.match(first.props.className, /backdrop:bg-transparent/);
  assert.match(first.props.className, /not\(\[open\]\)/);
  items[1].focus(); const second = render(() => { latest++; });
  assert.equal(node.shows, 1); assert.equal(page.document.activeElement, items[1]);
  second.props.onClick({ target: items[1], currentTarget: node }); assert.equal(latest, 0);
  second.props.onClick({ target: node, currentTarget: node }); assert.equal(latest, 1);
  node.dispatch("keydown", { key: "Escape" }); assert.equal(latest, 2); assert.equal(old, 0);
  for (const cleanup of cleanups) cleanup?.();
});

test("all six active reader/Words/Search/Studio overlays use the coordinated wrapper", () => {
  const expected = new Map([
    ["src/routes/read.$book.$chapter.tsx", 2],
    ["src/components/reading-sheet.tsx", 1],
    ["src/routes/words.tsx", 1],
    ["src/components/search-panel.tsx", 1],
    ["src/components/studio.tsx", 1],
  ]);
  for (const [path, count] of expected) {
    const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let actual = 0;
    function visit(node) {
      if (ts.isJsxOpeningElement(node)) {
        const attr = node.attributes.properties.find((a) => a.name?.getText(source) === "className");
        if (attr?.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text.includes("fixed inset-0")) {
          assert.equal(node.tagName.getText(source), "Modal", path);
          assert.ok(node.attributes.properties.some((a) => a.name?.getText(source) === "label"), path);
          actual++;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source); assert.equal(actual, count, path);
    assert.doesNotMatch(text, /role="dialog"|aria-modal="true"/, "do not nest duplicate dialog roles");
  }
});


test("Search has an explicit Close control for keyboard, touch and assistive technology", () => {
  const page = searchFixture();
  const close = find(page.tree, (node) => node.type === "button" && node.props.children === "Close");
  assert.ok(close, "Escape/backdrop alone are not a complete mobile/AT close mechanism");
  close.props.onClick(); assert.equal(page.dismissed(), 1); page.cleanup();
});
