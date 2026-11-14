// The Read bar must keep every control on screen, and a short screen must keep the verse in view.
// Built app only (scripts/serve-built.mjs). No vite dev server.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, devices } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const SIZES = [
  { width: 390, height: 844, name: "390×844" },
  { width: 320, height: 568, name: "320×568" },
  { width: 206, height: 457, name: "206×457" },
  { width: 844, height: 390, name: "844×390" },
];

const PAGES = [
  { path: "/read/john/3", readName: "Read this chapter aloud" },
  { path: "/words", readName: "Read these words aloud" },
];

function speechStub(hold) {
  const voices = [
    {
      name: "English Test",
      lang: "en-US",
      voiceURI: "en-test",
      localService: true,
      default: true,
    },
  ];
  const synth = window.speechSynthesis;
  let speaking = false;
  let paused = false;
  let ticket = 0;
  // Each phrase ends so the reading moves on, unless this check holds the phrase.
  // A phrase that ends scrolls the page, which races a focus sample.
  const speak = (utter) => {
    speaking = true;
    paused = false;
    const mine = ++ticket;
    if (hold) return;
    window.setTimeout(() => {
      if (mine !== ticket || paused) return;
      speaking = false;
      if (utter && typeof utter.onend === "function") utter.onend();
    }, 1000);
  };
  const cancel = () => {
    ticket += 1;
    speaking = false;
    paused = false;
  };
  try {
    Object.defineProperty(synth, "speaking", { configurable: true, get: () => speaking });
    Object.defineProperty(synth, "pending", { configurable: true, get: () => false });
    Object.defineProperty(synth, "paused", { configurable: true, get: () => paused });
  } catch {
    // The native flags stay. The stub still never ends an utterance.
  }
  synth.getVoices = () => voices;
  synth.speak = speak;
  synth.cancel = cancel;
  synth.pause = () => {
    paused = true;
    speaking = false;
  };
  synth.resume = () => {
    if (paused) {
      paused = false;
      speaking = true;
    }
  };
  synth.addEventListener = () => {};
  synth.removeEventListener = () => {};

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
      this.lang = "";
      this.voice = null;
      this.onend = null;
      this.onerror = null;
    }
  }
  window.SpeechSynthesisUtterance = FakeUtterance;

  const define = (target, key, get) => {
    try {
      Object.defineProperty(target, key, { configurable: true, get });
    } catch {
      // Already exposed by this browser.
    }
  };
  define(document, "pictureInPictureEnabled", () => true);
  define(Document.prototype, "pictureInPictureEnabled", () => true);

  if (!HTMLCanvasElement.prototype.captureStream) {
    HTMLCanvasElement.prototype.captureStream = () => ({
      addTrack() {},
      getAudioTracks: () => [],
      getTracks: () => [],
    });
  }
  HTMLVideoElement.prototype.requestPictureInPicture = function requestPictureInPicture() {
    window.__corner = (window.__corner || 0) + 1;
    return Promise.resolve(this);
  };
  HTMLVideoElement.prototype.play = () => Promise.resolve();
}

async function fitReport(page) {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-read-bar]");
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    if (!bar) return { missing: true, vw, vh, scroll: 0, controls: [], pageJumped: false };
    const pageY = window.scrollY;
    const controls = [...bar.querySelectorAll("button, select, input")].flatMap((el) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return [];
      const panel = el.closest("#read-bar-more");
      if (panel instanceof HTMLElement) {
        const panelStyle = getComputedStyle(panel);
        if (panelStyle.overflowY === "auto" || panelStyle.overflowY === "scroll") {
          const panelBox = panel.getBoundingClientRect();
          const before = el.getBoundingClientRect();
          if (before.height > 1 && before.top < panelBox.top - 1) panel.scrollTop -= panelBox.top - before.top;
          else if (before.height > 1 && before.bottom > panelBox.bottom + 1) panel.scrollTop += before.bottom - panelBox.bottom;
        }
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return [];
      let clipped = "";
      for (let node = el.parentElement; node; node = node.parentElement) {
        const parent = getComputedStyle(node);
        const clipsX = ["hidden", "clip", "auto", "scroll"].includes(parent.overflowX);
        const clipsY = ["hidden", "clip", "auto", "scroll"].includes(parent.overflowY);
        if (!clipsX && !clipsY) continue;
        const box = node.getBoundingClientRect();
        const cut =
          (clipsX && (rect.left < box.left - 1 || rect.right > box.right + 1)) ||
          (clipsY && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1));
        if (cut) {
          clipped = node.getAttribute("data-read-bar") != null ? "read-bar" : node.tagName.toLowerCase();
          break;
        }
      }
      const name = el.getAttribute("aria-label") || (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
      return [
        {
          name,
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          clipped,
        },
      ];
    });
    const header = document.querySelector("header");
    const tongue = document.querySelector("[data-reading-tongue]");
    const tongueStyle = tongue ? getComputedStyle(tongue) : null;
    const tongueBox = tongue ? tongue.getBoundingClientRect() : null;
    const tongueVisible = Boolean(tongueStyle && tongueStyle.display !== "none" && tongueBox && tongueBox.height > 1);
    const stackBottom = Math.max(header ? header.getBoundingClientRect().bottom : 0, tongueVisible ? tongueBox.bottom : 0);
    const barTop = bar.getBoundingClientRect().top;
    const verse = document.querySelector("[data-listening]");
    const verseBox = verse ? verse.getBoundingClientRect() : null;
    const intersects = Boolean(
      verseBox &&
        verseBox.width > 1 &&
        verseBox.height > 1 &&
        verseBox.bottom > stackBottom + 0.5 &&
        verseBox.top < barTop - 0.5,
    );
    return {
      missing: false,
      vw,
      vh,
      scroll: document.documentElement.scrollWidth - vw,
      controls,
      gap: barTop - stackBottom,
      stackBottom,
      barTop,
      barHeight: bar.getBoundingClientRect().height,
      tongueVisible,
      intersects,
      verseTop: verseBox ? verseBox.top : null,
      verseBottom: verseBox ? verseBox.bottom : null,
      error: (bar.querySelector("p.text-garnet")?.textContent || "").trim(),
      pageJumped: window.scrollY !== pageY,
    };
  });
}

function contextOptions(device) {
  const { defaultBrowserType, ...options } = device;
  return options;
}

const FOLLOW = [
  { name: "750×342", options: contextOptions(devices["iPhone 13 landscape"]) },
  { name: "Pixel 7 landscape", options: contextOptions(devices["Pixel 7 landscape"]) },
  { name: "844×390", options: { viewport: { width: 844, height: 390 } } },
  { name: "206×457", options: { viewport: { width: 206, height: 457 } } },
];

async function bandReport(page) {
  return page.evaluate(() => {
    const bar = document.querySelector("[data-read-bar]");
    const header = document.querySelector("header");
    const tongue = document.querySelector("[data-reading-tongue]");
    const tongueStyle = tongue ? getComputedStyle(tongue) : null;
    const tongueBox = tongue ? tongue.getBoundingClientRect() : null;
    const tongueVisible = Boolean(tongueStyle && tongueStyle.display !== "none" && tongueBox && tongueBox.height > 1);
    const stackBottom = Math.max(header ? header.getBoundingClientRect().bottom : 0, tongueVisible ? tongueBox.bottom : 0);
    const barBox = bar ? bar.getBoundingClientRect() : null;
    const barTop = barBox ? barBox.top : window.innerHeight;
    const verse = document.querySelector("[data-listening]");
    const verseBox = verse ? verse.getBoundingClientRect() : null;
    const intersects = Boolean(
      verseBox &&
        verseBox.height > 1 &&
        verseBox.bottom > stackBottom + 0.5 &&
        verseBox.top < barTop - 0.5,
    );
    return {
      gap: barTop - stackBottom,
      intersects,
      id: verse ? verse.id : "",
      top: verseBox ? verseBox.top : null,
      bottom: verseBox ? verseBox.bottom : null,
      stackBottom,
      barTop,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      barHeight: barBox ? barBox.height : 0,
    };
  });
}

async function settledVerse(page, verse) {
  const id = `v-${verse}`;
  await page.waitForFunction(
    (want) => {
      const el = document.getElementById(want);
      if (!el || !el.hasAttribute("data-listening")) return false;
      const top = Math.round(el.getBoundingClientRect().top);
      const now = performance.now();
      const sample = window.__bandSample || { id: "", top: null, n: 0, since: 0, moved: false };
      if (sample.id !== want) {
        window.__bandSample = { id: want, top, n: 1, since: now, moved: false };
        return false;
      }
      if (sample.top !== top) {
        sample.top = top;
        sample.n = 1;
        sample.moved = true;
        sample.since = now;
        window.__bandSample = sample;
        return false;
      }
      sample.n += 1;
      window.__bandSample = sample;
      // Stable after the smooth scroll, or still where it started once that scroll would have finished.
      return sample.n >= 3 && (sample.moved || now - sample.since > 400);
    },
    id,
    { timeout: 15000 },
  );
}

function assertBand(report, label) {
  assert.ok(report.scroll <= 1, `${label} horizontal scroll ${report.scroll}`);
  assert.ok(report.gap + 0.5 >= 120, `${label} band is ${report.gap}px (bar ${report.barTop}, stack ${report.stackBottom})`);
  assert.equal(report.intersects, true, `${label} ${report.id} ${report.top}–${report.bottom} misses ${report.stackBottom}–${report.barTop}`);
  assert.ok(report.top >= report.stackBottom - 4, `${label} ${report.id} starts at ${report.top} under the stack ${report.stackBottom}`);
}

function seedPrefs(page, theme = "day") {
  return page.addInitScript((mode) => {
    localStorage.setItem(
      "peshitta-parallel",
      JSON.stringify({ theme: mode, lang: "en", face: "tr", lang2: "none", intro: 1 }),
    );
  }, theme);
}

/** The reader service worker caches navigations. A half-installed worker stalls the next page under CI load. */
async function openContext(browser, options = {}) {
  const context = await browser.newContext({ ...options, reducedMotion: "reduce", serviceWorkers: "block" });
  context.setDefaultNavigationTimeout(60000);
  return context;
}

/** Wait until smooth scroll has stopped, so a band sample is not taken mid-flight. */
async function scrollSettled(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let last = window.scrollY;
        let held = 0;
        const tick = () => {
          const y = window.scrollY;
          held = y === last ? held + 1 : 0;
          last = y;
          if (held >= 2) resolve(undefined);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

async function assertVoice(page, label) {
  const more = page.getByRole("button", { name: "More", exact: true });
  const moreVisible = await more.isVisible().catch(() => false);
  let opened = false;
  if (moreVisible && (await more.getAttribute("aria-expanded")) !== "true") {
    await more.click();
    opened = true;
  }
  const voice = page.getByRole("combobox", { name: "Voice on this device" });
  await voice.waitFor({ state: "visible" });
  const box = await voice.evaluate((el) => {
    const text = (el.selectedOptions?.[0]?.textContent || "").replace(/\s+/g, " ").trim();
    const probe = document.createElement("span");
    const style = getComputedStyle(el);
    probe.textContent = text;
    probe.style.cssText = `position:absolute;white-space:nowrap;font:${style.font};letter-spacing:${style.letterSpacing};visibility:hidden;`;
    document.body.appendChild(probe);
    const textWidth = probe.getBoundingClientRect().width;
    probe.remove();
    return { text, textWidth, scroll: el.scrollWidth, client: el.clientWidth };
  });
  const ellipsis = box.text.endsWith("…") || box.text.endsWith("...");
  const fits = (box.scroll <= box.client + 1 && box.textWidth <= box.client - 18) || ellipsis;
  assert.ok(fits, `${label} voice "${box.text}" is clipped (scroll ${box.scroll} client ${box.client} text ${box.textWidth})`);
  assert.equal(await voice.getAttribute("aria-label"), "Voice on this device");
  if (opened) await more.click();
}

async function readJohn(browser, url, options, label) {
  const context = await openContext(browser, options);
  const page = await context.newPage();
  await seedPrefs(page);
  await page.addInitScript(speechStub);
  await page.goto(`${url}/read/john/3`, { waitUntil: "domcontentloaded" });
  const read = page.getByRole("button", { name: "Read this chapter aloud" });
  await read.waitFor({ state: "visible", timeout: 20000 });
  const idle = await fitReport(page);
  assertFit(idle, `${label} idle`);
  await read.click();
  try {
    await page.getByRole("button", { name: "Pause the reading" }).waitFor({ state: "visible", timeout: 20000 });
  } catch (err) {
    const failed = await fitReport(page);
    throw new Error(`did not start (${failed.error || "no bar error"}): ${err instanceof Error ? err.message : err}`);
  }
  return { context, page };
}

function assertFit(report, label) {
  assert.equal(report.missing, false, `${label} has no Read bar`);
  assert.equal(report.pageJumped, false, `${label} moved the page to reach a control`);
  assert.ok(report.scroll <= 1, `${label} horizontal scroll ${report.scroll}`);
  assert.ok(report.controls.length > 0, `${label} has no visible Read bar controls`);
  for (const control of report.controls) {
    assert.ok(control.width + 0.5 >= 44, `${label} ${control.name} is ${control.width}px wide`);
    assert.ok(control.height + 0.5 >= 44, `${label} ${control.name} is ${control.height}px tall`);
    assert.ok(control.left >= -1 && control.top >= -1, `${label} ${control.name} starts off screen`);
    assert.ok(control.right <= report.vw + 1, `${label} ${control.name} ends at ${control.right} past ${report.vw}`);
    assert.ok(control.bottom <= report.vh + 1, `${label} ${control.name} ends at ${control.bottom} past ${report.vh}`);
    assert.equal(control.clipped, "", `${label} ${control.name} is clipped by ${control.clipped}`);
  }
}

async function hit(page, name) {
  const button = page.getByRole("button", { name, exact: true });
  await button.waitFor({ state: "visible" });
  const point = await button.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const target = document.elementFromPoint(x, y);
    const owned = target === el || el.contains(target);
    return { owned, x, y, target: target ? target.tagName : "none" };
  });
  assert.equal(point.owned, true, `${name} hit ${point.target} at ${point.x},${point.y}`);
}

test("the open band keeps each verse while Read follows", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const size of FOLLOW) {
      const { context, page } = await readJohn(browser, server.url, size.options, size.name);
      try {
        for (let verse = 1; verse <= 5; verse += 1) {
          await settledVerse(page, verse);
          await scrollSettled(page);
          const report = await bandReport(page);
          assert.equal(report.id, `v-${verse}`, `${size.name} was on ${report.id} instead of v-${verse}`);
          assertBand(report, `${size.name} v-${verse}`);
          if (verse === 1) {
            const playing = await fitReport(page);
            assertFit(playing, `${size.name} playing`);
          }
        }
      } finally {
        await context.close();
      }
    }

    for (const size of [
      { name: "206×457", options: { viewport: { width: 206, height: 457 } } },
      { name: "320×568", options: { viewport: { width: 320, height: 568 } } },
    ]) {
      for (const entry of [
        { path: "/read/john/3", readName: "Read this chapter aloud" },
        { path: "/words", readName: "Read these words aloud" },
      ]) {
        const context = await openContext(browser, size.options);
        const page = await context.newPage();
        await seedPrefs(page);
        await page.addInitScript(speechStub);
        await page.goto(`${server.url}${entry.path}`, { waitUntil: "domcontentloaded" });
        const read = page.getByRole("button", { name: entry.readName });
        await read.waitFor({ state: "visible", timeout: 20000 });
        await read.click();
        await page.getByRole("button", { name: "Pause the reading" }).waitFor({ state: "visible", timeout: 20000 });
        await page.locator("[data-listening]").waitFor({ state: "attached", timeout: 20000 });
        await scrollSettled(page);
        try {
          const more = page.getByRole("button", { name: "More", exact: true });
          await more.click();
          await page.waitForFunction(() => {
            const bar = document.querySelector("[data-read-bar]");
            const header = document.querySelector("header");
            const verse = document.querySelector("[data-listening]");
            if (!bar || !verse) return false;
            const tongue = document.querySelector("[data-reading-tongue]");
            const tongueBox = tongue && getComputedStyle(tongue).display !== "none" ? tongue.getBoundingClientRect() : null;
            const stackBottom = Math.max(header ? header.getBoundingClientRect().bottom : 0, tongueBox && tongueBox.height > 1 ? tongueBox.bottom : 0);
            const barTop = bar.getBoundingClientRect().top;
            const box = verse.getBoundingClientRect();
            const gap = barTop - stackBottom;
            const meets = box.height > 1 && box.bottom > stackBottom + 0.5 && box.top < barTop - 0.5 && box.top >= stackBottom - 4;
            return gap + 0.5 >= 120 && meets;
          }, undefined, { timeout: 1000 });
          await scrollSettled(page);
          const opened = await bandReport(page);
          assertBand(opened, `${entry.path} ${size.name} More open`);
          const fitted = await fitReport(page);
          assertFit(fitted, `${entry.path} ${size.name} More open`);
          await more.click();
          await page.waitForFunction(() => {
            const bar = document.querySelector("[data-read-bar]");
            const header = document.querySelector("header");
            const verse = document.querySelector("[data-listening]");
            if (!bar || !verse || bar.getAttribute("data-more") !== "closed") return false;
            const tongue = document.querySelector("[data-reading-tongue]");
            const tongueBox = tongue && getComputedStyle(tongue).display !== "none" ? tongue.getBoundingClientRect() : null;
            const stackBottom = Math.max(header ? header.getBoundingClientRect().bottom : 0, tongueBox && tongueBox.height > 1 ? tongueBox.bottom : 0);
            const barTop = bar.getBoundingClientRect().top;
            const box = verse.getBoundingClientRect();
            const gap = barTop - stackBottom;
            return gap + 0.5 >= 120 && box.bottom > stackBottom + 0.5 && box.top < barTop - 0.5 && box.top >= stackBottom - 4;
          }, undefined, { timeout: 1000 });
          await scrollSettled(page);
          const closed = await bandReport(page);
          assertBand(closed, `${entry.path} ${size.name} More closed`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the Read bar keeps its controls and the verse on short screens", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const size of SIZES) {
      for (const entry of PAGES) {
        const context = await openContext(browser, { viewport: size });
        const page = await context.newPage();
        await seedPrefs(page);
        await page.addInitScript(speechStub);
        await page.goto(`${server.url}${entry.path}`, { waitUntil: "domcontentloaded" });
        const read = page.getByRole("button", { name: entry.readName });
        await read.waitFor({ state: "visible", timeout: 20000 });
        const idle = await fitReport(page);
        assertFit(idle, `${entry.path} ${size.name} idle`);

        await read.click();
        try {
          await page.getByRole("button", { name: "Pause the reading" }).waitFor({ state: "visible", timeout: 20000 });
        } catch (err) {
          const failed = await fitReport(page);
          throw new Error(`${entry.path} ${size.name} did not start (${failed.error || "no bar error"}): ${err instanceof Error ? err.message : err}`);
        }
        await page.locator("[data-listening]").waitFor({ state: "attached", timeout: 20000 });
        await page.waitForFunction(() => {
          const verse = document.querySelector("[data-listening]");
          if (!verse) return false;
          const top = Math.round(verse.getBoundingClientRect().top);
          const sample = window.__fitSample || { id: "", top: null, n: 0 };
          const id = verse.id;
          if (sample.id !== id || sample.top !== top) {
            window.__fitSample = { id, top, n: 1 };
            return false;
          }
          sample.n += 1;
          window.__fitSample = sample;
          return sample.n >= 3;
        }, { timeout: 8000 });
        await scrollSettled(page);
        const playing = await fitReport(page);
        assertFit(playing, `${entry.path} ${size.name} playing`);
        if (playing.error) assert.fail(`${entry.path} ${size.name} ${playing.error}`);
        await hit(page, "Pause the reading");
        await hit(page, "Stop");

        if (size.height <= 500) {
          assert.ok(playing.gap + 0.5 >= 120, `${entry.path} ${size.name} gap is ${playing.gap}px (bar ${playing.barHeight}, stack ${playing.stackBottom})`);
          assert.equal(playing.intersects, true, `${entry.path} ${size.name} verse ${playing.verseTop}–${playing.verseBottom} misses ${playing.stackBottom}–${playing.barTop}`);
          assert.equal(playing.tongueVisible, false, `${entry.path} ${size.name} language bar stays stacked while reading`);
        }

        if (size.width === 320 && entry.path === "/read/john/3") {
          const voice = page.getByRole("combobox", { name: "Voice on this device" });
          const speed = page.getByRole("slider", { name: "Reading speed" });
          const corner = page.getByRole("button", { name: "Keep the reading in the corner over other apps" });
          await assert.equal(await voice.count(), 0, "voice is hidden while More is collapsed");
          await assert.equal(await speed.count(), 0, "speed is hidden while More is collapsed");
          await assert.equal(await corner.count(), 0, "corner is hidden while More is collapsed");
          const more = page.getByRole("button", { name: "More", exact: true });
          await more.click();
          await assert.equal(await more.getAttribute("aria-expanded"), "true");
          await voice.waitFor({ state: "visible" });
          await speed.waitFor({ state: "visible" });
          await corner.waitFor({ state: "visible" });
          const opened = await fitReport(page);
          assertFit(opened, `${entry.path} ${size.name} more open`);
          await voice.selectOption("en-test");
          await page.waitForFunction(() => {
            const select = document.querySelector("[data-read-bar] select");
            return select instanceof HTMLSelectElement && select.value === "en-test";
          });
          await speed.evaluate((el) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
            setter?.call(el, "130");
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          });
          await page.locator(".read-bar-compact").getByText("130%", { exact: true }).waitFor({ state: "visible" });
          await corner.click();
          await page.waitForFunction(() => window.__corner >= 1);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

const SPEED_CASES = [
  { width: 206, height: 457, name: "206×457", path: "/words", readName: "Read these words aloud" },
  { width: 320, height: 480, name: "320×480", path: "/words", readName: "Read these words aloud" },
  { width: 206, height: 457, name: "206×457", path: "/read/john/3", readName: "Read this chapter aloud" },
  { width: 320, height: 480, name: "320×480", path: "/read/john/3", readName: "Read this chapter aloud" },
  { width: 320, height: 568, name: "320×568", path: "/words", readName: "Read these words aloud" },
  { width: 320, height: 568, name: "320×568", path: "/read/john/3", readName: "Read this chapter aloud" },
  { width: 390, height: 844, name: "390×844", path: "/words", readName: "Read these words aloud" },
  { width: 390, height: 844, name: "390×844", path: "/read/john/3", readName: "Read this chapter aloud" },
];

function verseInBand(wantOpen) {
  const bar = document.querySelector("[data-read-bar]");
  const header = document.querySelector("header");
  const verse = document.querySelector("[data-listening]");
  if (!bar || !verse) return false;
  if (bar.getAttribute("data-more") !== (wantOpen ? "open" : "closed")) return false;
  const tongue = document.querySelector("[data-reading-tongue]");
  const tongueBox = tongue && getComputedStyle(tongue).display !== "none" ? tongue.getBoundingClientRect() : null;
  const stackBottom = Math.max(header ? header.getBoundingClientRect().bottom : 0, tongueBox && tongueBox.height > 1 ? tongueBox.bottom : 0);
  const barTop = bar.getBoundingClientRect().top;
  const box = verse.getBoundingClientRect();
  const meets = box.height > 1 && box.bottom > stackBottom + 0.5 && box.top < barTop - 0.5 && box.top >= stackBottom - 4;
  return barTop - stackBottom + 0.5 >= 120 && meets;
}

async function assertSpeedReachable(page, label) {
  const beforeY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => {
    const panel = document.querySelector("#read-bar-more");
    const row = panel?.querySelector(".read-bar-speed");
    if (!(panel instanceof HTMLElement) || !(row instanceof HTMLElement)) return;
    const panelBox = panel.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (rowBox.height < 1) return;
    if (rowBox.bottom > panelBox.bottom) panel.scrollTop += rowBox.bottom - panelBox.bottom;
    else if (rowBox.top < panelBox.top) panel.scrollTop -= panelBox.top - rowBox.top;
  });
  const afterY = await page.evaluate(() => window.scrollY);
  assert.equal(afterY, beforeY, `${label} page jumped to reach Speed`);
  const speed = page.locator(".read-bar-compact").getByRole("slider", { name: "Reading speed" });
  assert.equal(await speed.isVisible(), true, `${label} speed is not reachable`);
  assert.equal(await speed.isEnabled(), true, `${label} speed is disabled`);
  const box = await speed.boundingBox();
  assert.ok(box, `${label} speed has no box`);
  assert.ok(box.height + 0.5 >= 44, `${label} speed is ${box ? box.height : 0}px tall`);
  const view = page.viewportSize();
  assert.ok(view && box.y >= -1 && box.y + box.height <= view.height + 1, `${label} speed is outside the viewport`);
  assert.ok(view && box.x >= -1 && box.x + box.width <= view.width + 1, `${label} speed is wider than the screen`);
  const before = ((await page.locator(".read-bar-compact .read-bar-speed span.tabular-nums").textContent()) || "").trim();
  const jump = await speed.evaluate((el) => {
    const y0 = window.scrollY;
    el.focus();
    return [y0, window.scrollY];
  });
  assert.equal(jump[1], jump[0], `${label} focus moved the page ${jump[1]} !== ${jump[0]}`);
  await speed.press("ArrowRight");
  await page.waitForFunction(
    (prev) => {
      const node = document.querySelector(".read-bar-compact .read-bar-speed span.tabular-nums");
      return Boolean(node && (node.textContent || "").trim() && (node.textContent || "").trim() !== prev);
    },
    before,
    { timeout: 2000 },
  );
}

test("Speed stays reachable and the verse keeps a 120px band", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const entry of SPEED_CASES) {
      const label = `${entry.path} ${entry.name}`;
      const context = await openContext(browser, { viewport: { width: entry.width, height: entry.height } });
      const page = await context.newPage();
      await seedPrefs(page);
      await page.addInitScript(speechStub, true);
      await page.goto(`${server.url}${entry.path}`, { waitUntil: "domcontentloaded" });
      const read = page.getByRole("button", { name: entry.readName });
      await read.waitFor({ state: "visible", timeout: 20000 });
      await read.click();
      await page.getByRole("button", { name: "Pause the reading" }).waitFor({ state: "visible", timeout: 20000 });
      await page.locator("[data-listening]").waitFor({ state: "attached", timeout: 20000 });
      await scrollSettled(page);
      const more = page.getByRole("button", { name: "More", exact: true });
      await more.click();
      await page.waitForFunction(verseInBand, true, { timeout: 1000 });
      await scrollSettled(page);
      assertBand(await bandReport(page), `${label} More open`);
      await assertSpeedReachable(page, label);
      const fitted = await fitReport(page);
      assertFit(fitted, `${label} More open`);
      await more.click();
      await page.waitForFunction(verseInBand, false, { timeout: 1000 });
      await scrollSettled(page);
      assertBand(await bandReport(page), `${label} More closed`);
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

const VOICE_SIZES = [
  { width: 750, height: 342, name: "750×342" },
  { width: 844, height: 390, name: "844×390" },
  { width: 390, height: 844, name: "390×844" },
  { width: 320, height: 568, name: "320×568" },
  { width: 206, height: 457, name: "206×457" },
];

test("the voice label fits, and Escape closes one layer", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const size of VOICE_SIZES) {
      const context = await openContext(browser, { viewport: size });
      const page = await context.newPage();
      await seedPrefs(page);
      await page.addInitScript(speechStub);
      await page.goto(`${server.url}/read/john/3`, { waitUntil: "domcontentloaded" });
      const read = page.getByRole("button", { name: "Read this chapter aloud" });
      await read.waitFor({ state: "visible", timeout: 20000 });
      await assertVoice(page, `${size.name} idle`);
      await read.click();
      await page.getByRole("button", { name: "Pause the reading" }).waitFor({ state: "visible", timeout: 20000 });
      await assertVoice(page, `${size.name} playing`);
      if (size.width === 320 && size.height === 568) {
        const more = page.getByRole("button", { name: "More", exact: true });
        if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
        const help = page.getByRole("button", { name: "Voice setup help" });
        await help.click();
        await page.getByRole("region", { name: "Voice setup help" }).waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        await page.getByRole("region", { name: "Voice setup help" }).waitFor({ state: "hidden" });
        await page.waitForFunction(() => {
          const active = document.activeElement;
          return active instanceof HTMLButtonElement && active.getAttribute("aria-label") === "Voice setup help";
        });
        assert.equal(await more.getAttribute("aria-expanded"), "true");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => {
          const active = document.activeElement;
          return (
            active instanceof HTMLButtonElement &&
            active.getAttribute("aria-expanded") === "false" &&
            (active.textContent || "").includes("More")
          );
        });
        assert.equal(await page.locator("#read-bar-more").getAttribute("hidden"), "");
      }
      const fitted = await fitReport(page);
      assertFit(fitted, `${size.name} voice`);
      assert.ok(fitted.scroll <= 1, `${size.name} horizontal scroll`);
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

const HINT_CASES = [
  { width: 206, height: 457, name: "206×457", path: "/words", readName: "Read these words aloud", scroll: "more" },
  { width: 320, height: 480, name: "320×480", path: "/words", readName: "Read these words aloud", scroll: "more" },
  { width: 206, height: 457, name: "206×457", path: "/read/john/3", readName: "Read this chapter aloud", scroll: "none" },
  { width: 320, height: 480, name: "320×480", path: "/read/john/3", readName: "Read this chapter aloud", scroll: "none" },
  { width: 320, height: 568, name: "320×568", path: "/words", readName: "Read these words aloud", scroll: "none" },
  { width: 320, height: 568, name: "320×568", path: "/read/john/3", readName: "Read this chapter aloud", scroll: "none" },
  { width: 390, height: 844, name: "390×844", path: "/words", readName: "Read these words aloud", scroll: "none" },
  { width: 390, height: 844, name: "390×844", path: "/read/john/3", readName: "Read this chapter aloud", scroll: "none" },
  { width: 844, height: 390, name: "844×390", path: "/words", readName: "Read these words aloud", scroll: "wide" },
  { width: 844, height: 390, name: "844×390", path: "/read/john/3", readName: "Read this chapter aloud", scroll: "wide" },
  { width: 206, height: 457, name: "206×457 night", path: "/words", readName: "Read these words aloud", scroll: "more", theme: "night" },
];

const CORNER = "#read-bar-more button[aria-label='Keep the reading in the corner over other apps']";

function hintReport() {
  const panel = document.querySelector("#read-bar-more");
  const hint = document.querySelector("[data-read-more-hint]");
  const body = getComputedStyle(document.body).backgroundColor;
  if (!(panel instanceof HTMLElement) || !(hint instanceof HTMLElement)) return { missing: true, body };
  const style = getComputedStyle(hint);
  const box = hint.getBoundingClientRect();
  const panelBox = panel.getBoundingClientRect();
  const mask = style.maskImage && style.maskImage !== "none" ? style.maskImage : style.webkitMaskImage;
  const shown =
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    box.height > 8 &&
    box.bottom <= panelBox.bottom + 1 &&
    box.top >= panelBox.bottom - 20;
  return {
    missing: false,
    scroll: panel.getAttribute("data-scroll"),
    overflow: panel.scrollHeight - panel.clientHeight,
    sideways: panel.scrollWidth - panel.clientWidth,
    pageSideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    shown,
    mask: mask || "none",
    fade: style.backgroundColor,
    body,
    duration: style.transitionDuration,
    scrollbar: getComputedStyle(panel).scrollbarWidth,
  };
}

function rowInPanel(selector) {
  const el = document.querySelector(selector);
  const panel = document.querySelector("#read-bar-more");
  if (!(el instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  const panelBox = panel.getBoundingClientRect();
  return {
    height: rect.height,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    panelTop: panelBox.top,
    panelBottom: panelBox.bottom,
    vh: window.innerHeight,
    vw: window.innerWidth,
    inside: rect.height > 1 && rect.top >= panelBox.top - 1 && rect.bottom <= panelBox.bottom + 1,
  };
}

test("a short Words More panel shows that it scrolls", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const entry of HINT_CASES) {
      const label = `${entry.path} ${entry.name}`;
      const context = await openContext(browser, { viewport: { width: entry.width, height: entry.height } });
      const page = await context.newPage();
      await seedPrefs(page, entry.theme || "day");
      await page.addInitScript(speechStub, true);
      await page.goto(`${server.url}${entry.path}`, { waitUntil: "domcontentloaded" });
      const read = page.getByRole("button", { name: entry.readName });
      await read.waitFor({ state: "visible", timeout: 20000 });
      await read.click();
      await page.getByRole("button", { name: "Pause the reading" }).waitFor({ state: "visible", timeout: 20000 });
      await page.locator("[data-listening]").waitFor({ state: "attached", timeout: 20000 });
      await scrollSettled(page);

      if (entry.scroll === "wide") {
        assert.equal(await page.getByRole("button", { name: "More", exact: true }).count(), 0, `${label} shows More`);
        const compact = await page.locator(".read-bar-compact").evaluate((el) => getComputedStyle(el).display);
        assert.equal(compact, "none", `${label} compact bar is ${compact}`);
        assertFit(await fitReport(page), label);
        assertBand(await bandReport(page), label);
        assert.ok((await bandReport(page)).scroll <= 1, `${label} sideways`);
        await context.close();
        continue;
      }

      const more = page.getByRole("button", { name: "More", exact: true });
      await more.click();
      await page.waitForFunction(verseInBand, true, { timeout: 1000 });
      await scrollSettled(page);
      assertBand(await bandReport(page), `${label} More open`);
      await page.waitForFunction(
        (want) => document.querySelector("#read-bar-more")?.getAttribute("data-scroll") === want,
        entry.scroll,
        { timeout: 2000 },
      );
      const hint = await page.evaluate(hintReport);
      assert.equal(hint.missing, false, `${label} has no More panel`);
      assert.equal(hint.scroll, entry.scroll, `${label} data-scroll`);
      assert.ok(hint.sideways <= 1, `${label} panel sideways ${hint.sideways}`);
      assert.ok(hint.pageSideways <= 1, `${label} page sideways ${hint.pageSideways}`);
      const duration = String(hint.duration || "");
      assert.ok(duration.split(",").every((part) => parseFloat(part) === 0), `${label} hint transition ${duration}`);

      if (entry.scroll === "more") {
        assert.ok(hint.overflow > 1, `${label} panel does not scroll (${hint.overflow})`);
        assert.equal(hint.shown, true, `${label} hint is hidden`);
        assert.notEqual(hint.mask, "none", `${label} hint has no mask`);
        assert.equal(hint.fade, hint.body, `${label} fade ${hint.fade} is not paper ${hint.body}`);
        assert.equal(hint.scrollbar, "thin", `${label} scrollbar is ${hint.scrollbar}`);
        const voice = await page.evaluate(rowInPanel, "#read-bar-more select");
        const speed = await page.evaluate(rowInPanel, "#read-bar-more .read-bar-speed");
        assert.ok(voice?.inside, `${label} voice is outside the panel`);
        assert.ok(speed?.inside, `${label} speed is outside the panel`);
        assert.ok(speed && speed.height + 0.5 >= 44, `${label} speed is ${speed ? speed.height : 0}px`);

        const pageY = await page.evaluate(() => {
          const panel = document.querySelector("#read-bar-more");
          const y = window.scrollY;
          if (panel instanceof HTMLElement) panel.scrollTop = panel.scrollHeight;
          return y;
        });
        await page.waitForFunction(
          () => document.querySelector("#read-bar-more")?.getAttribute("data-scroll") === "end",
          undefined,
          { timeout: 2000 },
        );
        const ended = await page.evaluate(hintReport);
        assert.equal(ended.scroll, "end", `${label} did not reach the end`);
        assert.equal(ended.shown, false, `${label} hint stays at the end`);
        assert.equal(await page.evaluate(() => window.scrollY), pageY, `${label} scrolling the panel moved the page`);
        const cornerBox = await page.evaluate(rowInPanel, CORNER);
        assert.ok(cornerBox, `${label} corner is missing`);
        assert.ok(cornerBox.height + 0.5 >= 44, `${label} corner is ${cornerBox.height}px`);
        assert.ok(cornerBox.inside, `${label} corner is outside the panel`);
        assert.ok(cornerBox.top >= -1 && cornerBox.bottom <= cornerBox.vh + 1 && cornerBox.left >= -1 && cornerBox.right <= cornerBox.vw + 1, `${label} corner is outside the viewport`);

        await page.evaluate(() => {
          const panel = document.querySelector("#read-bar-more");
          if (panel instanceof HTMLElement) panel.scrollTop = 0;
        });
        await page.waitForFunction(
          () => document.querySelector("#read-bar-more")?.getAttribute("data-scroll") === "more",
          undefined,
          { timeout: 2000 },
        );
        const speedSlider = page.locator("#read-bar-more").getByRole("slider", { name: "Reading speed" });
        const tabY = await speedSlider.evaluate((el) => {
          const y = window.scrollY;
          el.focus();
          return y;
        });
        await page.keyboard.press("Tab");
        await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Keep the reading in the corner over other apps");
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))));
        const afterTab = await page.evaluate(rowInPanel, CORNER);
        assert.equal(await page.evaluate(() => window.scrollY), tabY, `${label} Tab moved the page`);
        assert.ok(afterTab?.inside, `${label} Tab did not bring Corner into the panel`);
        assert.ok(afterTab && afterTab.height + 0.5 >= 44, `${label} Corner is ${afterTab ? afterTab.height : 0}px after Tab`);
        assert.ok(afterTab && afterTab.top >= -1 && afterTab.bottom <= afterTab.vh + 1, `${label} Corner left the viewport`);
        await page.keyboard.press("Shift+Tab");
        await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Reading speed");
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))));
        const back = await page.evaluate(rowInPanel, "#read-bar-more .read-bar-speed");
        assert.equal(await page.evaluate(() => window.scrollY), tabY, `${label} Shift+Tab moved the page`);
        assert.ok(back?.inside, `${label} Shift+Tab did not bring Speed back`);
      } else {
        assert.ok(hint.overflow <= 1, `${label} panel scrolls (${hint.overflow})`);
        assert.equal(hint.shown, false, `${label} shows a hint`);
        assertFit(await fitReport(page), `${label} More open`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

