// Cycle 023 (names study guide, UI cycle 4) against the local production build.
// W-129 verse links open the reader with the name marked, W-132 verse lists in
// canon order, W-141 Read label without a repeated name.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const NAMES = JSON.parse(readFileSync(new URL("../src/data/names.json", import.meta.url), "utf8")).names;
const edition = readFileSync(new URL("../src/data/edition.ts", import.meta.url), "utf8");
const CANON = [...edition.slice(edition.indexOf("export const BOOKS")).matchAll(/\{ id: "([a-z0-9]+)", name:/g)].map((match) => match[1]);

function seed(page, theme) {
  return page.addInitScript((stored) => {
    if (!sessionStorage.getItem("__seeded")) {
      localStorage.setItem("peshitta-parallel", JSON.stringify(stored));
      sessionStorage.setItem("__seeded", "1");
    }
    const store = { utterances: [], cancels: 0 };
    window.__nameSpeech = store;
    const synth = {
      speak(utter) {
        store.utterances.push({ text: utter.text, lang: utter.lang, rate: utter.rate });
        setTimeout(() => utter.onend?.(), 20);
      },
      cancel() {
        store.cancels += 1;
      },
      getVoices() {
        return [];
      },
      speaking: false,
      pending: false,
      paused: false,
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, get: () => synth });
  }, { theme, lang: "en", face: "both", lang2: "none", intro: 1 });
}

async function namesReady(page) {
  await page.waitForFunction(() => typeof window.__setReadingLive === "function", undefined, { timeout: 45000 });
}

async function setTheme(page, theme) {
  await page.evaluate((want) => {
    const raw = JSON.parse(localStorage.getItem("peshitta-parallel") || "{}");
    localStorage.setItem("peshitta-parallel", JSON.stringify({ ...raw, theme: want }));
  }, theme);
}

function canonIndex(href) {
  const match = /\/read\/([a-z0-9]+)\/(\d+)(?:\?[^#]*)?#v-(\d+)$/.exec(href);
  assert.ok(match, `bad verse href ${href}`);
  const book = CANON.indexOf(match[1]);
  assert.ok(book >= 0, `unknown book ${href}`);
  return [book, Number(match[2]), Number(match[3])];
}

function assertCanon(hrefs, id) {
  for (let index = 1; index < hrefs.length; index += 1) {
    const a = canonIndex(hrefs[index - 1]);
    const b = canonIndex(hrefs[index]);
    const order = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    assert.ok(order < 0, `${id}: ${hrefs[index - 1]} before ${hrefs[index]}`);
  }
}

/** Marked verse: highlighted, below the sticky header and tongue, marks readable. */
async function markedVerse(page, verse) {
  await page.waitForFunction(
    (id) => {
      const node = document.querySelector(`article#${id}[data-name-target]`);
      if (!node) return false;
      const box = node.getBoundingClientRect();
      const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      const tongue = document.querySelector("[data-reading-tongue]");
      const tongueBox = tongue?.getBoundingClientRect();
      const cover = Math.max(header, tongueBox && tongueBox.height > 1 ? tongueBox.bottom : 0);
      return box.top >= cover - 1 && box.top < window.innerHeight - 40;
    },
    verse,
    { timeout: 20000 },
  );
  return page.evaluate((id) => {
    const parse = (value) => {
      const probe = document.createElement("span");
      probe.style.color = value;
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
      probe.remove();
      return rgb;
    };
    const lum = ([r, g, b]) => {
      const f = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const node = document.getElementById(id);
    const targets = document.querySelectorAll("article[data-name-target]").length;
    const marks = [...node.querySelectorAll("[data-name-mark]")].map((mark) => {
      const style = getComputedStyle(mark);
      const fg = lum(parse(style.color));
      const bg = lum(parse(style.backgroundColor));
      return {
        text: (mark.textContent || "").trim(),
        syriac: !!mark.closest("[lang='syr']"),
        contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
        alpha: style.backgroundColor.startsWith("rgba") ? Number(style.backgroundColor.split(",")[3]) : 1,
      };
    });
    const article = getComputedStyle(node);
    return { targets, marks, back: (node.querySelector("[data-name-back]")?.textContent || "").trim(), shadow: article.boxShadow };
  }, verse);
}

async function cleared(page) {
  await page.waitForFunction(() => document.querySelector("header h1, header [data-subtitle]") && document.querySelectorAll("[data-name-target], [data-name-mark], [data-name-back]").length === 0);
  await page.waitForTimeout(400);
  assert.equal(await page.locator("[data-name-target], [data-name-mark], [data-name-back]").count(), 0);
}

function assertMarks(info, english, label) {
  assert.equal(info.targets, 1, `${label}: one highlighted verse`);
  assert.notEqual(info.shadow, "none", `${label}: verse highlight`);
  assert.ok(info.marks.some((mark) => mark.syriac), `${label}: no marked Syriac word ${JSON.stringify(info.marks)}`);
  assert.ok(info.marks.some((mark) => !mark.syriac && mark.text === english), `${label}: "${english}" not marked ${JSON.stringify(info.marks)}`);
  for (const mark of info.marks) {
    assert.equal(mark.alpha, 1, `${label}: mark background must be opaque`);
    assert.ok(mark.contrast >= 4.5, `${label}: mark "${mark.text}" contrast ${mark.contrast.toFixed(2)}`);
  }
}

/** Storage keys, minus the ones a plain reader visit already writes; and whether any value holds the card id. */
async function storageSnapshot(page, id) {
  return page.evaluate((card) => {
    const plain = new Set(["injeel-annotations", "peshitta-parallel", "__seeded"]);
    const all = [...Object.entries(localStorage), ...Object.entries(sessionStorage)];
    return {
      extra: all.map(([key]) => key).filter((key) => !plain.has(key)).sort(),
      holdsCard: all.some(([, value]) => value.includes(card)),
    };
  }, id);
}

test("W-129: names verse links open the reader with the name marked", { timeout: 420000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch();
  try {
    for (const theme of ["day", "night"]) {
      for (const size of [
        { width: 390, height: 844 },
        { width: 1280, height: 800 },
      ]) {
        const label = `${theme} ${size.width}`;
        const context = await browser.newContext({ viewport: size, serviceWorkers: "block" });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await seed(page, theme);
        await page.goto(`${server.url}/names#keefa`, { waitUntil: "domcontentloaded" });
        await namesReady(page);
        await page.waitForFunction((want) => document.documentElement.dataset.theme === want, theme);
        const first = page.locator("#keefa [data-name-verse]").first();
        assert.equal((await first.textContent()).trim(), "Matthew 4:18");
        assert.match((await first.getAttribute("href")) || "", /\/read\/matthew\/4\?name=keefa#v-18$/);
        const before = await storageSnapshot(page, "keefa");
        await first.click();
        await page.waitForURL(/\/read\/matthew\/4\?name=keefa#v-18$/);
        const keefa = await markedVerse(page, "v-18");
        assertMarks(keefa, "Keefa", `${label} keefa`);
        assert.equal(keefa.back, "← Back to Keefa");
        const after = await storageSnapshot(page, "keefa");
        assert.deepEqual(after.extra, before.extra, `${label}: storage keys added`);
        assert.equal(after.holdsCard, false, `${label}: the card id was written to storage`);

        await page.locator("#v-18 [data-name-back]").click();
        await page.waitForURL(/\/names#keefa$/);
        await page.waitForFunction(() => document.activeElement === document.querySelector("#keefa h2"), undefined, { timeout: 20000 });
        const head = await page.evaluate(() => {
          const box = document.querySelector("#keefa h2").getBoundingClientRect();
          const bar = document.querySelector(".names-tools").getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, cover: bar.bottom, height: window.innerHeight };
        });
        assert.ok(head.top >= head.cover - 1 && head.bottom <= head.height + 1, `${label}: Back landing ${JSON.stringify(head)}`);

        if (theme === "day" && size.width === 390) {
          await page.goto(`${server.url}/names#tadai`, { waitUntil: "domcontentloaded" });
          await namesReady(page);
          const tadai = page.locator("#tadai [data-name-verse]").first();
          assert.equal((await tadai.textContent()).trim(), "Matthew 10:3");
          await tadai.click();
          await page.waitForURL(/\/read\/matthew\/10\?name=tadai#v-3$/);
          assertMarks(await markedVerse(page, "v-3"), "Lebbai", "tadai");

          // Keefa is not in Matthew 1:1: the verse is highlighted, nothing is marked.
          await page.goto(`${server.url}/read/matthew/1?name=keefa#v-1`, { waitUntil: "domcontentloaded" });
          const none = await markedVerse(page, "v-1");
          assert.equal(none.targets, 1);
          assert.equal(none.marks.length, 0, JSON.stringify(none.marks));
          assert.equal(none.back, "← Back to Keefa");

          // Chapter navigation clears the highlight.
          await page.goto(`${server.url}/read/matthew/4?name=keefa#v-18`, { waitUntil: "domcontentloaded" });
          await markedVerse(page, "v-18");
          await page.locator("header a[href$='/read/matthew/5']").first().click();
          await page.waitForURL(/\/read\/matthew\/5$/);
          await cleared(page);
          await page.goto(`${server.url}/read/matthew/4?name=keefa#v-18`, { waitUntil: "domcontentloaded" });
          await markedVerse(page, "v-18");
          await page.getByRole("button", { name: "Next" }).click();
          await page.waitForURL(/\/read\/matthew\/5$/);
          await cleared(page);

          // Plain #v-N without a name is unchanged: no highlight, no marks, no Back link.
          await page.goto(`${server.url}/read/matthew/4#v-18`, { waitUntil: "domcontentloaded" });
          await page.locator("article#v-18").waitFor();
          await page.waitForTimeout(500);
          assert.equal(await page.locator("[data-name-target], [data-name-mark], [data-name-back]").count(), 0);
          // A bad name value is ignored, never shown.
          await page.goto(`${server.url}/read/matthew/4?name=%3Cscript%3E#v-18`, { waitUntil: "domcontentloaded" });
          await page.locator("article#v-18").waitFor();
          await page.waitForTimeout(500);
          assert.equal(await page.locator("[data-name-target], [data-name-mark], [data-name-back]").count(), 0);
        }
        assert.deepEqual(errors, [], `${label}: page errors`);
        await context.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});

test("W-132 and W-141: verse lists in canon order, Read label without a repeat", { timeout: 420000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await seed(page, "day");
    await page.goto(`${server.url}/names`, { waitUntil: "domcontentloaded" });
    await namesReady(page);
    assert.equal(await page.locator("main h2").count(), 505);

    assert.equal((await page.locator("#bethzayta [data-name-verse]").first().textContent()).trim(), "Matthew 21:1");
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll(".name-card")].map((card) => ({
        id: card.id,
        hrefs: [...card.querySelectorAll("[data-name-verse]")].map((link) => link.getAttribute("href")),
      })),
    );
    assert.equal(visible.length, 505);
    for (const card of visible) {
      assertCanon(card.hrefs, card.id);
      for (const href of card.hrefs) assert.ok(href.includes(`?name=${card.id}#`), `${card.id} link ${href} has no name`);
    }

    const withMore = NAMES.filter((row) => row.count > 6).map((row) => row.id);
    const sample = ["keefa", "bethzayta", ...withMore.filter((id) => id !== "keefa" && id !== "bethzayta").filter((_, index, all) => index % Math.max(1, Math.floor(all.length / 18)) === 0)].slice(0, 20);
    assert.equal(sample.length, 20);
    for (const id of sample) {
      const more = page.locator(`#${id} [data-name-more]`);
      if ((await more.count()) === 0) continue;
      await more.scrollIntoViewIfNeeded();
      await more.click();
      await page.waitForFunction((name) => document.querySelector(`#${name} [data-name-more]`)?.getAttribute("aria-expanded") === "true", id);
      const hrefs = await page.locator(`#${id} [data-name-verse]`).evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      assertCanon(hrefs, id);
      if (id === "keefa") {
        assert.equal(hrefs.length, 92);
        assert.match(hrefs[0], /\/read\/matthew\/4\?name=keefa#v-18$/);
      }
      await more.click();
    }

    const labels = await page.locator("[data-name-read]").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") || ""));
    assert.equal(labels.length, 505);
    for (const text of labels) assert.doesNotMatch(text, /^Read (.+) then \1$/i, text);
    const alexandria = await page.locator("#alexandria [data-name-read]").getAttribute("aria-label");
    const words = alexandria.toLowerCase().match(/[\p{L}']+/gu);
    assert.equal(new Set(words).size, words.length, `Alexandria label repeats a word: ${alexandria}`);
    assert.equal(await page.locator("#abba [data-name-read]").getAttribute("aria-label"), "Read Abba (Syriac, then English)");

    const sizes = await page.evaluate(() => {
      for (const card of document.querySelectorAll(".name-card")) card.style.contentVisibility = "visible";
      const out = [...document.querySelectorAll("[data-name-read]")].map((button) => {
        const box = button.getBoundingClientRect();
        return Math.min(box.width, box.height);
      });
      for (const card of document.querySelectorAll(".name-card")) card.style.contentVisibility = "";
      return out;
    });
    assert.equal(sizes.length, 505);
    for (const side of sizes) assert.ok(side + 0.5 >= 44, `Read button ${side}px`);

    await page.locator("#keefa").getByRole("button", { name: "Read Keefa then Peter" }).click();
    await page.waitForFunction(() => window.__nameSpeech.utterances.length >= 2);
    await page.waitForFunction(() => document.querySelector("#keefa [data-name-read]")?.getAttribute("aria-pressed") === "false");
    assert.deepEqual(
      (await page.evaluate(() => window.__nameSpeech.utterances)).map((item) => item.text),
      ["keefa", "Peter"],
    );
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});
