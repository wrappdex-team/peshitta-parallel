// Names study guide against the local production build.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

// Same-origin JS gzip on /names at main ff0c72e was 442,710 bytes.
const NAMES_JS_GZIP_CAP = 442_710 + 4 * 1024;
const registry = JSON.parse(readFileSync(new URL("../src/data/names.json", import.meta.url), "utf8"));
const NAMES = registry.names;
const SIZES = [
  { width: 206, height: 457 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

function seed(page, theme) {
  return page.addInitScript((stored) => {
    localStorage.setItem("peshitta-parallel", JSON.stringify(stored));
    const store = { utterances: [], cancels: 0 };
    window.__nameSpeech = store;
    const synth = {
      speak(utter) {
        store.utterances.push({ text: utter.text, lang: utter.lang, rate: utter.rate });
        if (store.utterances.length < 2) setTimeout(() => utter.onend?.(), 20);
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
  }, { theme, lang: "en", face: "tr", lang2: "none", intro: 1 });
}

async function englishMap(page) {
  return page.evaluate(() => {
    const out = {};
    for (const card of document.querySelectorAll("main li[id]")) {
      out[card.id] = card.querySelector("[data-name-english]")?.textContent ?? null;
    }
    return out;
  });
}

function assertEnglish(actual) {
  assert.equal(Object.keys(actual).length, NAMES.length);
  for (const row of NAMES) assert.equal(actual[row.id], row.known, row.id);
}

async function assertPlaced(page, id) {
  const ready = (name) => {
    const card = document.getElementById(name);
    const head = card?.querySelector("h2");
    const bar = document.querySelector(".names-tools");
    const header = document.querySelector("header");
    if (!card || !head || !bar || !header) return null;
    const cardBox = card.getBoundingClientRect();
    const headBox = head.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    const cover = barBox.bottom;
    const space = window.innerHeight - cover;
    const fits = cardBox.height <= space + 1;
    const headClear = headBox.top >= cover + 8 - 0.5;
    const centred = !fits || Math.abs(cardBox.top + cardBox.height / 2 - (cover + space / 2)) <= space * 0.15 + 1;
    const inView = !fits || (cardBox.top >= cover - 1 && cardBox.bottom <= window.innerHeight + 1);
    const focused = document.activeElement === head;
    const gap = barBox.top - headerBox.bottom;
    let bleed = false;
    for (let y = Math.ceil(headerBox.bottom) + 1; y < barBox.bottom; y += 12) {
      for (let x = 4; x < window.innerWidth; x += 48) {
        const node = document.elementFromPoint(x, y);
        if (node && node.closest(".name-card")) bleed = true;
      }
    }
    const ok = cardBox.height >= 40 && space >= 80 && headClear && centred && inView && focused && gap <= 1 && !bleed;
    window.__placeInfo = { ok, headClear, centred, inView, focused, gap, bleed, fits, headTop: headBox.top, cover, space, cardTop: cardBox.top, cardHeight: cardBox.height, focus: document.activeElement?.tagName ?? "" };
    return ok;
  };
  try {
    await page.waitForFunction(ready, id);
  } catch (error) {
    const info = await page.evaluate(() => window.__placeInfo ?? null);
    throw new Error(`${id} not placed ${JSON.stringify(info)}\n${error}`);
  }
}

async function overflow(page) {
  return page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ),
  );
}

let loadStamp = 0;

async function open(page, url) {
  const next = new URL(url);
  const here = page.url();
  if (here && here !== "about:blank") {
    const current = new URL(here);
    if (current.pathname === next.pathname && current.search === next.search) {
      loadStamp += 1;
      next.searchParams.set("load", String(loadStamp));
    }
  }
  await page.goto(next.href, { waitUntil: "domcontentloaded" });
}

async function shortLinks(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".name-card")];
    for (const card of cards) card.style.contentVisibility = "visible";
    const links = [...document.querySelectorAll("main a")];
    let short = 0;
    for (const link of links) {
      if (link.getBoundingClientRect().height < 24) short += 1;
    }
    for (const card of cards) card.style.contentVisibility = "";
    return { short, count: links.length };
  });
}

test("names study guide: English line, Read, and finding", async () => {
  const speech = readFileSync(new URL("../src/lib/name-speech.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("../src/routes/names.tsx", import.meta.url), "utf8");
  for (const source of [speech, pageSource]) {
    assert.equal(source.includes("fetch("), false);
    assert.equal(source.includes("createServerFn"), false);
    assert.equal(source.includes("process.env"), false);
  }

  const server = await startBuiltServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await seed(page, "day");
    await open(page,`${server.url}/names`);
    await page.locator("#keefa").waitFor();

    for (const theme of ["day", "night"]) {
      const toggle = page.getByRole("button", { name: theme === "night" ? "Night theme" : "Day theme" });
      if ((await toggle.count()) > 0) await toggle.click();
      await page.waitForFunction((want) => document.documentElement.dataset.theme === want, theme);
      for (const size of SIZES) {
        await page.setViewportSize(size);
        await page.waitForTimeout(50);
        assertEnglish(await englishMap(page));
        assert.equal(await page.locator("main h2").count(), 503, `${theme} ${size.width}`);
        const links = await shortLinks(page);
        assert.ok(links.count > 400, `verse links ${links.count}`);
        assert.equal(links.short, 0, `${links.short} verse links under 24px at ${size.width} ${theme}`);
        if (size.width === 206) {
          await page.locator(".names-az").evaluate((node) => {
            node.scrollLeft = node.scrollWidth;
          });
          const gap = await overflow(page);
          assert.ok(gap <= 1, `horizontal scroll ${gap} at 206 ${theme}`);
        }
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const day = page.getByRole("button", { name: "Day theme" });
    if ((await day.count()) > 0) await day.click();
    await open(page,`${server.url}/names#corinth`);
    await page.locator("#corinth").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#corinth h2")?.innerText.trim() === "Corinth");
    assert.equal((await page.locator("#corinth h2").innerText()).trim(), "Corinth");
    assert.equal(
      (await page.locator("#corinth [data-name-english-line]").innerText()).replace(/\s+/g, " ").trim(),
      "ENGLISH Corinth",
    );
    await page.locator("#keefa").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("#keefa h2")?.innerText.trim() === "Keefa");
    assert.equal((await page.locator("#keefa h2").innerText()).trim(), "Keefa");
    assert.equal(
      (await page.locator("#keefa [data-name-english-line]").innerText()).replace(/\s+/g, " ").trim(),
      "ENGLISH Peter, Petros",
    );

    await open(page,`${server.url}/names#keefa`);
    await assertPlaced(page, "keefa");

    const places = page.getByRole("radio", { name: /^Places\s+150$/ });
    assert.equal(await places.count(), 1);
    const persons = Number((await page.getByRole("radio", { name: /^Persons\s+/ }).innerText()).replace(/\D/g, ""));
    const peoples = Number((await page.getByRole("radio", { name: /^Peoples\s+/ }).innerText()).replace(/\D/g, ""));
    const other = Number((await page.getByRole("radio", { name: /^Other\s+/ }).innerText()).replace(/\D/g, ""));
    const all = Number((await page.getByRole("radio", { name: /^All\s+/ }).innerText()).replace(/\D/g, ""));
    assert.equal(persons + 150 + peoples + other, all);
    assert.equal(all, 503);
    const otherChip = page.getByRole("radio", { name: /^Other\s+5$/ });
    assert.equal(await otherChip.count(), 1);
    assert.match(await otherChip.getAttribute("title") || "", /Title/);
    await places.click();
    await page.waitForFunction(() => document.querySelectorAll("main h2").length === 150);

    await page.getByRole("radio", { name: /^All\s+/ }).click();
    await page.waitForFunction(() => document.querySelectorAll("main h2").length === 503);
    assert.equal(await page.getByRole("button", { name: "V", exact: true }).isDisabled(), true);
    await open(page,`${server.url}/names`);
    await page.getByRole("button", { name: "Q", exact: true }).click();
    await assertPlaced(page, "qananya");

    const find = page.getByRole("textbox", { name: "FIND A NAME" });
    await find.fill("yeshua");
    await page.waitForFunction(() => document.querySelector("main h2")?.innerText.trim() === "Y'shua");
    assert.equal(await page.locator("main h2").first().innerText(), "Y'shua");
    await page.waitForFunction(() => new URL(location.href).searchParams.get("q") === "yeshua");
    for (const [typed, root] of [
      ["yaakov", "Ya'akov"],
      ["Ya'akov", "Ya'akov"],
      ["yitzchak", "Yitz'chak"],
      ["ammanuel", "Ammanu'el"],
      ["fanuel", "Fanu'el"],
      ["rechavam", "Rechav'am"],
      ["Y'shua", "Y'shua"],
    ]) {
      await find.fill(typed);
      await page.waitForFunction((name) => document.querySelector("main h2")?.innerText.trim() === name, root);
      assert.equal(await page.locator("main h2").first().innerText(), root, typed);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await open(page,`${server.url}/names#kenaan`);
    await page.locator("#kenaan [data-note-syriac]").scrollIntoViewIfNeeded();
    const syriac = await page.evaluate(async () => {
      await document.fonts.load('16px "Noto Sans Syriac"');
      const run = document.querySelector("#kenaan [data-note-syriac]");
      const text = run.firstChild;
      const widths = [...text.textContent].map((_, index) => {
        const range = document.createRange();
        range.setStart(text, index);
        range.setEnd(text, index + 1);
        return range.getBoundingClientRect().width;
      });
      return {
        loaded: document.fonts.check('16px "Noto Sans Syriac"', "ܐ"),
        family: getComputedStyle(run).fontFamily,
        lang: run.lang,
        dir: run.dir,
        widths,
      };
    });
    assert.equal(syriac.loaded, true, "Noto Sans Syriac is not loaded");
    assert.match(syriac.family, /Noto Sans Syriac/);
    assert.equal(syriac.lang, "syr");
    assert.equal(syriac.dir, "rtl");
    assert.ok(syriac.widths.length >= 4, `kenaan syriac ${JSON.stringify(syriac.widths)}`);
    for (const width of syriac.widths) assert.ok(width > 0, `glyph width ${width}`);

    await find.fill("Corinth");
    await page.waitForFunction(() => document.querySelector("main h2")?.innerText.trim() === "Corinth");
    assert.equal(await page.locator("main h2").count(), 1);
    assert.equal(await page.getByRole("checkbox", { name: "Search descriptions too" }).isChecked(), false);

    await find.fill("Peter");
    await page.waitForFunction(() => document.querySelector("main h2")?.innerText.trim() === "Keefa");
    assert.equal(await page.locator("#keefa").count(), 1);

    await find.fill("Mary");
    await page.waitForFunction(() => document.querySelector("main h2")?.innerText.trim() === "Maryam");
    const maryOrder = await page.locator("main h2").allInnerTexts();
    const yhwhAt = maryOrder.findIndex((text) => text.trim() === "YHWH");
    assert.equal(maryOrder[0].trim(), "Maryam");
    if (yhwhAt >= 0) assert.ok(yhwhAt > 0, `YHWH at ${yhwhAt}`);

    const keefa = NAMES.find((row) => row.id === "keefa");
    await open(page,`${server.url}/names#keefa`);
    await assertPlaced(page, "keefa");
    assert.equal(await page.locator("#keefa [data-name-kind]").innerText(), "Person");
    assert.equal(await page.locator("#keefa [data-name-verse]").count(), 6);
    const more = page.locator("#keefa [data-name-more]");
    assert.equal((await more.innerText()).trim(), `+ ${keefa.count - 6} more`);
    assert.equal(await more.getAttribute("aria-expanded"), "false");
    await more.click();
    await page.waitForFunction((count) => document.querySelectorAll("#keefa [data-name-verse]").length === count, keefa.count);
    const labels = await page.locator("#keefa [data-name-verse]").allInnerTexts();
    assert.equal(labels[0].trim(), "Matthew 4:18");
    for (const label of labels) assert.match(label.trim(), /^[A-Z0-9]/);
    assert.match(await page.locator("#keefa [data-name-verse]").first().getAttribute("href") || "", /\/read\/matthew\/4#v-18$/);
    assert.equal(await page.locator("[data-name-see-line]").count(), 0);

    await open(page,`${server.url}/names#alap`);
    assert.equal(await page.locator("#alap [data-name-kind]").innerText(), "Letter");
    await open(page,`${server.url}/names#yhwh`);
    assert.equal(await page.locator("#yhwh [data-name-kind]").innerText(), "Title");

    for (const theme of ["day", "night"]) {
      const toggle = page.getByRole("button", { name: theme === "night" ? "Night theme" : "Day theme" });
      if ((await toggle.count()) > 0) await toggle.click();
      await page.waitForFunction((want) => document.documentElement.dataset.theme === want, theme);
      for (const width of [360, 390, 412, 1280]) {
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
        for (const id of ["perets", "keefa", "pergamos"]) {
          await open(page, `${server.url}/names#${id}`);
          await assertPlaced(page, id);
        }
      }
    }
    const dayAgain = page.getByRole("button", { name: "Day theme" });
    if ((await dayAgain.count()) > 0) await dayAgain.click();
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page,`${server.url}/read/matthew/1`);
    await page.locator("a[href*='#perets']:visible").first().click();
    await page.waitForURL(/\/names#perets/);
    await assertPlaced(page, "perets");

    await open(page,`${server.url}/names?q=keefa&kind=person`);
    await page.locator("#keefa").waitFor();
    assert.equal(await find.inputValue(), "keefa");
    assert.equal(await page.getByRole("radio", { name: /^Persons\s+/ }).getAttribute("aria-checked"), "true");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#keefa").waitFor();
    assert.equal(await page.getByRole("textbox", { name: "FIND A NAME" }).inputValue(), "keefa");
    assert.equal(await page.getByRole("radio", { name: /^Persons\s+/ }).getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("main h2").count(), 1);

    await open(page,`${server.url}/names#keefa`);
    await page.locator("#keefa [data-name-read]").waitFor();
    const read = page.locator("#keefa").getByRole("button", { name: "Read Keefa then Peter" });
    await read.click();
    await page.waitForFunction(() => window.__nameSpeech.utterances.length >= 2);
    const spoken = await page.evaluate(() => window.__nameSpeech.utterances);
    assert.deepEqual(
      spoken.map((item) => item.text),
      ["keefa", "Peter"],
    );
    assert.ok(spoken.every((item) => item.lang === "en-US"));
    assert.ok(Math.abs(spoken[0].rate - 0.72) < 0.001, `root rate ${spoken[0].rate}`);
    assert.ok(Math.abs(spoken[1].rate - 0.9) < 0.001, `english rate ${spoken[1].rate}`);
    await page.waitForFunction(() => document.querySelector("#keefa [data-name-english-line]")?.getAttribute("aria-current") === "true");
    const underline = await page.locator("#keefa [data-name-english-line]").evaluate((node) => getComputedStyle(node).textDecorationLine);
    assert.equal(underline, "underline");
    const cancels = await page.evaluate(() => window.__nameSpeech.cancels);
    await read.click();
    await page.waitForFunction((before) => window.__nameSpeech.cancels > before, cancels);
    assert.equal(await page.evaluate(() => window.__nameSpeech.utterances.length), 2);

    await page.waitForFunction(() => typeof window.__setReadingLive === "function");
    await page.evaluate(() => window.__setReadingLive(true));
    await page.waitForFunction(() => document.querySelectorAll("[data-name-read]:not(:disabled)").length === 0);
    assert.equal(await page.locator("[data-name-read]").count(), 503);
    await page.evaluate(() => window.__setReadingLive(false));

    await open(page, `${server.url}/names`);
    await page.waitForLoadState("networkidle");
    await page.setViewportSize({ width: 390, height: 844 });
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const paint = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const input = document.querySelector("main input");
          const start = performance.now();
          input.addEventListener(
            "input",
            () => {
              requestAnimationFrame(() => resolve(performance.now() - start));
            },
            { once: true },
          );
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          set.call(input, "ye");
          input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }),
    );
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    console.log(`names input paint ${Math.round(paint)}ms`);
    assert.ok(paint < 200, `input paint ${paint}ms`);

    const urls = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => /\.m?js(\?|$)/.test(new URL(entry.name).pathname) && new URL(entry.name).origin === location.origin)
        .map((entry) => entry.name),
    );
    let bytes = 0;
    for (const url of urls) {
      const body = Buffer.from(await (await fetch(url)).arrayBuffer());
      bytes += gzipSync(body).length;
    }
    console.log(`names js gzip ${bytes}`);
    assert.ok(bytes <= NAMES_JS_GZIP_CAP, `names JS gzip ${bytes} exceeds ${NAMES_JS_GZIP_CAP}`);
    await context.close();
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});
