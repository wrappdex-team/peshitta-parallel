import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../src/components/read-aloud.tsx", import.meta.url), "utf8"), {
  fileName: "read-aloud.tsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
async function flushWork() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return;
  if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean);
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}
const button = (tree, label) => find(tree, (node) => node.type === "button" && node.props["aria-label"] === label);
const stopButton = (tree) => find(tree, (node) => node.type === "button" && Array.isArray(node.props.children) && node.props.children.includes("Stop"));

// Real component handlers/effects; fake synthesis, DOM events and synthetic lines.
// No browser, storage, real voices, scripture loads, providers or network access.
function fixture({ rows = [{ v: 1, text: "Synthetic fixture words." }], synthBusy = false, voices = [{ name: "Synthetic English", lang: "en-US", voiceURI: "fixture-en", localService: true }] } = {}) {
  const states = [], refs = [], deps = [], cleanups = [];
  const utterances = [], spoken = [], timers = [], heard = [], chapters = [];
  let stateAt = 0, refAt = 0, effectAt = 0, effects = [], dirty = false, unmounted = false, writes = 0, unmountedWrites = 0;
  function events() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
      removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    };
  }
  const synth = { ...events(), speaking: synthBusy, pending: false,
    cancel() {}, resume() {}, getVoices: () => voices, speak(utterance) { spoken.push(utterance); } };
  const document = { ...events(), visibilityState: "visible" };
  const window = { ...events(), speechSynthesis: synth, setTimeout(fn, ms) { timers.push({ fn, ms }); } };
  const props = {
    book: "fixture", chapter: 1, voice: "ara", deviceVoice: "", speed: 115, lang: "en",
    onVoice() {}, onDeviceVoice() {}, onSpeed() {}, onVerse(v) { heard.push(v); }, onAdvance() {},
    onChapter(at) { chapters.push(at); }, loadLines: async () => rows,
  };
  const hooks = {
    forwardRef: (fn) => fn,
    useImperativeHandle(ref, factory) { ref.current = factory(); },
    useRef(initial) { return refs[refAt++] ??= { current: initial }; },
    useState(initial) {
      const slot = stateAt++;
      if (slot >= states.length) states[slot] = typeof initial === "function" ? initial() : initial;
      return [states[slot], (next) => {
        writes++; if (unmounted) unmountedWrites++;
        const value = typeof next === "function" ? next(states[slot]) : next;
        if (!Object.is(value, states[slot])) { states[slot] = value; dirty = true; }
      }];
    },
    useEffect(effect, next) {
      const slot = effectAt++;
      if (!deps[slot] || next.some((value, i) => !Object.is(value, deps[slot][i]))) {
        effects.push(() => { cleanups[slot]?.(); cleanups[slot] = effect(); });
      }
      deps[slot] = next;
    },
  };
  const unavailable = () => { throw new Error("Real content/provider loading forbidden in lifecycle fixture"); };
  const exports = {};
  runInNewContext(source, { exports, window, document, navigator: { userAgent: "synthetic-desktop" },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; utterances.push(this); } },
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "lucide-react") return { Pause: () => null, Play: () => null, Square: () => null };
      if (name === "@/data/edition") return { BOOKS: [{ id: "fixture" }] };
      if (name === "@/lib/languages") return { languageById: (lang) => ({ tts: lang, label: "Fixture language" }) };
      if (name === "@/lib/scripture") return { chapterCount: () => 1, loadBook: unavailable, loadParallel: unavailable };
      if (name === "@/lib/speak") return { readingLines: unavailable };
      if (name === "@/lib/keep-reading") return { holdReading: () => ({ release() {}, async corner() {}, caption() {} }) };
      if (name === "@/lib/jesus") return { isJesus: () => false, speechOf: () => null };
      if (name === "@/lib/speech-lock") return { setReadingLive() {}, readingSessionLive: () => false };
      if (name === "@/lib/scroll-line") return { scrollLineToTop() {} };
      throw new Error(`Unexpected speech-fixture import: ${name}`);
    },
  });
  const ref = { current: null };
  function render(next = {}) {
    Object.assign(props, next);
    for (let i = 0; i < 8; i++) {
      stateAt = refAt = effectAt = 0; effects = []; dirty = false;
      const tree = exports.ReadAloud(props, ref);
      for (const effect of effects) effect();
      if (!dirty) return tree;
    }
    throw new Error("Mock component did not settle");
  }
  return {
    render, utterances, spoken, timers, heard, chapters, synth, window, document,
    html: () => renderToStaticMarkup(render()),
    writes: () => writes,
    unmountedWrites: () => unmountedWrites,
    unmount() { unmounted = true; for (const cleanup of cleanups) cleanup?.(); },
    async read() {
      render(); await flushWork();
      button(render(), "Read this chapter aloud").props.onClick();
      await flushWork();
      assert.equal(spoken.length, 1);
      return spoken[0];
    },
  };
}

for (const change of [{ chapter: 2 }, { lang: "es" }]) {
  test(`a ${Object.keys(change)[0]} change keeps the reading going`, async () => {
    const page = fixture();
    await page.read();
    page.render(change);
    assert.equal(page.spoken.length, 1, "navigation must not start or drop a phrase");
    assert.ok(button(page.render(), "Pause the reading"));
    assert.ok(stopButton(page.render()));
  });
}

test("late utterance error after Stop stays silent", async () => {
  const page = fixture(); const old = await page.read();
  stopButton(page.render()).props.onClick(); page.render();
  old.onerror({ error: "audio-hardware" }); await flushWork();
  assert.doesNotMatch(page.html(), /This phone did not speak/);
  assert.ok(button(page.render(), "Read this chapter aloud"));
});

test("late utterance error after unmount never writes component state", async () => {
  const page = fixture(); const old = await page.read(); page.unmount();
  old.onerror({ error: "network" }); await flushWork();
  assert.equal(page.unmountedWrites(), 0);
  assert.equal(page.spoken.length, 1);
  for (const listeners of [page.synth.listeners, page.window.listeners, page.document.listeners]) {
    assert.ok([...listeners.values()].every((set) => set.size === 0), "listeners cleaned up");
  }
});

test("pause/resume rejects old-loop errors even with the same reading token", async () => {
  const page = fixture(); const old = await page.read();
  button(page.render(), "Pause the reading").props.onClick();
  button(page.render(), "Resume the reading").props.onClick(); await flushWork();
  assert.equal(page.spoken.length, 2);
  old.onerror({ error: "network" }); await flushWork();
  assert.doesNotMatch(page.html(), /This phone did not speak/);
  assert.ok(button(page.render(), "Pause the reading"));
});

test("a paused old utterance cannot instantiate a synthesis-failed fallback", async () => {
  const page = fixture(); const old = await page.read();
  button(page.render(), "Pause the reading").props.onClick(); page.render();
  old.onerror({ error: "synthesis-failed" }); await flushWork();
  assert.equal(page.utterances.length, 1);
  assert.equal(page.spoken.length, 1);
  assert.ok(button(page.render(), "Resume the reading"));
});

test("current utterance errors remain visible instead of being suppressed", async () => {
  const page = fixture(); const current = await page.read();
  current.onerror({ error: "audio-busy" }); await flushWork();
  assert.match(page.html(), /This phone did not speak \(audio-busy\)/);
  assert.equal(page.spoken.length, 1);
});

test("current synthesis-failed keeps the existing one plain-device fallback", async () => {
  const page = fixture(); const current = await page.read();
  current.onerror({ error: "synthesis-failed" }); await flushWork();
  assert.equal(page.spoken.length, 2);
  const fallback = page.spoken[1];
  assert.equal(fallback.text, current.text);
  assert.equal(current.rate, 1.15);
  assert.equal(fallback.rate, 1);
  fallback.onend(); await flushWork();
  assert.equal(page.chapters.length, 1);
  assert.doesNotMatch(page.html(), /This phone did not speak/);
  assert.ok(button(page.render(), "Read this chapter aloud"));
});

for (const reason of ["canceled", "interrupted"]) {
  test(`current ${reason} event remains a silent stop`, async () => {
    const page = fixture(); const current = await page.read();
    current.onerror({ error: reason }); await flushWork();
    assert.doesNotMatch(page.html(), /This phone did not speak/);
    assert.equal(page.spoken.length, 1);
  });
}

test("normal success preserves text, settings, verse order and chapter completion", async () => {
  const rows = [{ v: 1, text: "Synthetic first line." }, { v: 2, text: "Synthetic second line." }];
  const page = fixture({ rows }); const first = await page.read();
  assert.equal(first.text, rows[0].text); assert.equal(first.rate, 1.15);
  assert.equal(first.lang, "en-US"); assert.equal(first.volume, 1); assert.equal(first.pitch, 1);
  first.onend(); await flushWork();
  assert.equal(page.spoken.length, 2); assert.equal(page.spoken[1].text, rows[1].text);
  page.spoken[1].onend(); await flushWork();
  assert.deepEqual(page.heard.filter((v) => v !== null), [1, 2]);
  assert.equal(page.chapters.length, 1);
  assert.ok(button(page.render(), "Read this chapter aloud"));
});


test("a finished phrase cannot report a late error over the next phrase in the same loop", async () => {
  const page = fixture({ rows: [{ v: 1, text: `Synthetic ${"x".repeat(215)}. Synthetic remaining phrase.` }] });
  const first = await page.read();
  first.onend(); await flushWork();
  assert.equal(page.spoken.length, 2);
  first.onerror({ error: "network" }); await flushWork();
  assert.doesNotMatch(page.html(), /This phone did not speak/);
  assert.equal(page.spoken.length, 2);
});

test("missing language match does not silently speak with another language", async () => {
  const page = fixture();
  page.render({ lang: "es" }); await flushWork();
  button(page.render(), "Read this chapter aloud").props.onClick(); await flushWork();
  assert.equal(page.spoken.length, 0);
  assert.match(page.html(), /No matching voice/);
});

test("new Greek and Hebrew readings match their own voices and fail closed otherwise", async () => {
  const greekOnlyEnglish = fixture();
  greekOnlyEnglish.render({ lang: "el" }); await flushWork();
  button(greekOnlyEnglish.render(), "Read this chapter aloud").props.onClick(); await flushWork();
  assert.equal(greekOnlyEnglish.spoken.length, 0);
  assert.match(greekOnlyEnglish.html(), /No matching voice/);
  for (const [lang, voiceLang] of [["el", "el-GR"], ["he", "he-IL"], ["he", "iw_IL"]]) {
    const page = fixture({ voices: [
      { name: "Synthetic English", lang: "en-US", voiceURI: "fixture-en", localService: true },
      { name: `Synthetic ${voiceLang}`, lang: voiceLang, voiceURI: `fixture-${voiceLang}`, localService: false },
    ] });
    page.render({ lang }); await flushWork();
    button(page.render(), "Read this chapter aloud").props.onClick(); await flushWork();
    assert.equal(page.spoken.length, 1, voiceLang);
    assert.equal(page.spoken[0].lang, voiceLang, voiceLang);
  }
});

test("explicitly chosen fallback is allowed and setup help covers all requested platforms", async () => {
  const page = fixture();
  page.render({ lang: "es", deviceVoice: "fixture-en" }); await flushWork();
  button(page.render(), "Read this chapter aloud").props.onClick(); await flushWork();
  assert.equal(page.spoken.length, 1);
  assert.match(page.html(), /Voice setup help/);
  const file = readFileSync(new URL("../src/components/read-aloud.tsx", import.meta.url), "utf8");
  for (const copy of ["iPhone and iPad", "Android", "macOS", "cannot install voices", "Syriac"]) assert.ok(file.includes(copy), copy);
});
