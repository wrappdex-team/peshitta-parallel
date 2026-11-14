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

function speechStub() {
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
  // Each phrase ends so the reading moves on. Cancel drops the phrase that was in flight.
  const speak = (utter) => {
    speaking = true;
    paused = false;
    const mine = ++ticket;
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
    if (!bar) return { missing: true, vw, vh, scroll: 0, controls: [] };
    const controls = [...bar.querySelectorAll("button, select, input")].flatMap((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width < 1 || rect.height < 1) return [];
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

function seedPrefs(page) {
  return page.addInitScript(() => {
    localStorage.setItem(
      "peshitta-parallel",
      JSON.stringify({ theme: "day", lang: "en", face: "tr", lang2: "none", intro: 1 }),
    );
  });
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
