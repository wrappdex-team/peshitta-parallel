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

async function assertPlaced(page, id, timeout = 20000) {
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
    await page.waitForFunction(ready, id, { timeout });
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

/** The Read control is in the server HTML. Clicks before this effect are dropped. */
async function waitForNamesReady(page) {
  await page.waitForFunction(() => typeof window.__setReadingLive === "function");
}

async function textOf(page, selector) {
  const handle = await page.waitForFunction((sel) => {
    const text = (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").trim();
    return text || false;
  }, selector);
  return handle.jsonValue();
}

async function open(page, url, commit = false) {
  const next = new URL(url);
  const here = page.url();
  if (here && here !== "about:blank") {
    const current = new URL(here);
    if (current.pathname === next.pathname && current.search === next.search) {
      loadStamp += 1;
      next.searchParams.set("load", String(loadStamp));
    }
  }
  // A hash landing measures every card before DOMContentLoaded. Text checks
  // pass commit so they read the server HTML instead of waiting out that layout.
  await page.goto(next.href, { waitUntil: commit ? "commit" : "domcontentloaded" });
  // The previous names document stays private until GC. Four copies then stall
  // past the 20s budget. This does not change what the page renders.
  await page.evaluate(() => typeof gc === "function" && gc()).catch(() => {});
  if (!commit && next.pathname === "/names" && !next.hash) await waitForNamesReady(page);
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

test("names study guide: English line, Read, and finding", { timeout: 420000 }, async () => {
  const speech = readFileSync(new URL("../src/lib/name-speech.ts", import.meta.url), "utf8");
  const pageSource = readFileSync(new URL("../src/routes/names.tsx", import.meta.url), "utf8");
  for (const source of [speech, pageSource]) {
    assert.equal(source.includes("fetch("), false);
    assert.equal(source.includes("createServerFn"), false);
    assert.equal(source.includes("process.env"), false);
  }

  const server = await startBuiltServer();
  // expose-gc lets open() return the previous names document. See open().
  const browser = await chromium.launch({ args: ["--js-flags=--expose-gc"] });
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
        assert.equal(await page.locator("main h2").count(), 505, `${theme} ${size.width}`);
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
    await open(page,`${server.url}/names#corinth`, true);
    await page.waitForFunction(() => (document.querySelector("#corinth h2")?.textContent ?? "").trim() === "Qorinthos");
    assert.equal(await textOf(page, "#corinth h2"), "Qorinthos");
    assert.equal(await textOf(page, "#corinth [data-name-english-line]"), "ENGLISH Corinth");
    await page.waitForFunction(() => (document.querySelector("#keefa h2")?.textContent ?? "").trim() === "Keefa");
    assert.equal(await textOf(page, "#keefa h2"), "Keefa");
    assert.equal(await textOf(page, "#keefa [data-name-english-line]"), "ENGLISH Peter, Petros");

    await open(page,`${server.url}/names#keefa`);
    await assertPlaced(page, "keefa");
    await waitForNamesReady(page);

    const places = page.getByRole("radio", { name: /^Places\s+151$/ });
    assert.equal(await places.count(), 1);
    const persons = Number((await page.getByRole("radio", { name: /^Persons\s+/ }).innerText()).replace(/\D/g, ""));
    const peoples = Number((await page.getByRole("radio", { name: /^Peoples\s+/ }).innerText()).replace(/\D/g, ""));
    const other = Number((await page.getByRole("radio", { name: /^Other\s+/ }).innerText()).replace(/\D/g, ""));
    const all = Number((await page.getByRole("radio", { name: /^All\s+/ }).innerText()).replace(/\D/g, ""));
    assert.equal(persons + 151 + peoples + other, all);
    assert.equal(all, 505);
    const otherChip = page.getByRole("radio", { name: /^Other\s+5$/ });
    assert.equal(await otherChip.count(), 1);
    assert.match(await otherChip.getAttribute("title") || "", /Title/);
    await places.click();
    await page.waitForFunction(() => document.querySelectorAll("main h2").length === 151);

    await page.getByRole("radio", { name: /^All\s+/ }).click();
    await page.waitForFunction(() => document.querySelectorAll("main h2").length === 505);
    assert.equal(await page.getByRole("button", { name: "V", exact: true }).isDisabled(), true);
    await open(page,`${server.url}/names`);
    await page.getByRole("button", { name: "Q", exact: true }).click();
    await assertPlaced(page, "qananya");

    const find = page.getByRole("textbox", { name: "FIND A NAME" });
    await find.fill("yeshua");
    await page.waitForFunction(() => (document.querySelector("main h2")?.textContent ?? "").trim() === "Y'shua");
    assert.equal(((await page.locator("main h2").first().textContent()) ?? "").trim(), "Y'shua");
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
      await page.waitForFunction((name) => (document.querySelector("main h2")?.textContent ?? "").trim() === name, root);
      assert.equal(((await page.locator("main h2").first().textContent()) ?? "").trim(), root, typed);
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

    await waitForNamesReady(page);
    await find.fill("Corinth");
    await page.waitForFunction(() => (document.querySelector("main h2")?.textContent ?? "").trim() === "Qorinthos");
    assert.equal(await page.locator("main h2").count(), 1);
    assert.equal(await page.getByRole("checkbox", { name: "Search descriptions too" }).isChecked(), false);

    await find.fill("Peter");
    await page.waitForFunction(() => (document.querySelector("main h2")?.textContent ?? "").trim() === "Keefa");
    assert.equal(await page.locator("#keefa").count(), 1);

    await find.fill("Mary");
    await page.waitForFunction(() => (document.querySelector("main h2")?.textContent ?? "").trim() === "Maryam");
    const maryOrder = await page.locator("main h2").allTextContents();
    const yhwhAt = maryOrder.findIndex((text) => text.trim() === "YHWH");
    assert.equal(maryOrder[0].trim(), "Maryam");
    if (yhwhAt >= 0) assert.ok(yhwhAt > 0, `YHWH at ${yhwhAt}`);

    const keefa = NAMES.find((row) => row.id === "keefa");
    await open(page,`${server.url}/names#keefa`);
    await assertPlaced(page, "keefa");
    assert.equal(await textOf(page, "#keefa [data-name-kind]"), "Person");
    assert.equal(await page.locator("#keefa [data-name-verse]").count(), 6);
    assert.equal(await textOf(page, "#keefa [data-name-more]"), `+ ${keefa.count - 6} more`);
    const more = page.locator("#keefa [data-name-more]");
    assert.equal(await more.getAttribute("aria-expanded"), "false");
    await waitForNamesReady(page);
    await more.click();
    await page.waitForFunction((count) => document.querySelectorAll("#keefa [data-name-verse]").length === count, keefa.count);
    const labels = await page.locator("#keefa [data-name-verse]").allTextContents();
    assert.equal(labels[0].trim(), "Matthew 4:18");
    for (const label of labels) assert.match(label.trim(), /^[A-Z0-9]/);
    assert.match(await page.locator("#keefa [data-name-verse]").first().getAttribute("href") || "", /\/read\/matthew\/4#v-18$/);
    assert.equal(await page.locator("[data-name-see-line]").count(), 0);

    await open(page,`${server.url}/names#alap`, true);
    assert.equal(await textOf(page, "#alap [data-name-kind]"), "Letter");
    await open(page,`${server.url}/names#yhwh`, true);
    assert.equal(await textOf(page, "#yhwh [data-name-kind]"), "Title");
    await waitForNamesReady(page);

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
    await page.reload({ waitUntil: "load" });
    await page.locator("#keefa").waitFor();
    assert.equal(await page.getByRole("textbox", { name: "FIND A NAME" }).inputValue(), "keefa");
    assert.equal(await page.getByRole("radio", { name: /^Persons\s+/ }).getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("main h2").count(), 1);

    await open(page,`${server.url}/names#keefa`);
    await waitForNamesReady(page);
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
    assert.equal(await page.locator("[data-name-read]").count(), 505);
    await page.evaluate(() => window.__setReadingLive(false));

    await open(page, `${server.url}/names`);
    await page.waitForLoadState("load");
    await waitForNamesReady(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const domNodes = await page.evaluate(() => document.querySelectorAll("*").length);
    console.log(`names dom nodes ${domNodes}`);
    assert.ok(domNodes <= 9000, `DOM nodes ${domNodes} exceed 9000`);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    for (const theme of ["day", "night"]) {
      const toggle = page.getByRole("button", { name: theme === "night" ? "Night theme" : "Day theme" });
      if ((await toggle.count()) > 0) await toggle.click();
      await page.waitForFunction((want) => document.documentElement.dataset.theme === want, theme);
      for (const width of [206, 240, 320, 360, 390, 412, 1280]) {
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
        const broken = await page.evaluate(() => {
          for (const card of document.querySelectorAll(".name-card")) card.style.contentVisibility = "visible";
          const bad = [];
          for (const node of document.querySelectorAll("p.name-syriac")) {
            const text = (node.textContent || "").trim();
            if (!text || /\s/.test(text)) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const tops = new Set();
            for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
            if (tops.size > 1) bad.push({ id: node.closest("li")?.id || "", text, lines: tops.size });
          }
          const scroll = Math.max(
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            document.body.scrollWidth - document.body.clientWidth,
          );
          const read = document.querySelector("[data-name-read]");
          const readBox = read?.getBoundingClientRect();
          return { bad: bad.slice(0, 5), badCount: bad.length, scroll, readH: readBox?.height ?? 0, readW: readBox?.width ?? 0 };
        });
        assert.equal(broken.badCount, 0, `Syriac heading wraps at ${width} ${theme} ${JSON.stringify(broken.bad)}`);
        assert.ok(broken.scroll <= 1, `horizontal scroll ${broken.scroll} at ${width} ${theme}`);
        assert.ok(broken.readH + 0.5 >= 44 && broken.readW + 0.5 >= 44, `Read ${broken.readW}x${broken.readH} at ${width}`);
      }
      const say = await page.evaluate(() => {
        const card = document.querySelector("#aleksandros");
        if (card) card.style.contentVisibility = "visible";
        const node = document.querySelector("#aleksandros [data-source-say]");
        if (!node) return null;
        const probe = document.createElement("span");
        probe.style.color = "var(--muted)";
        document.body.appendChild(probe);
        const want = getComputedStyle(probe).color;
        probe.remove();
        return { got: getComputedStyle(node).color, want, text: (node.textContent || "").trim() };
      });
      assert.ok(say, `source pronunciation missing on ${theme}`);
      assert.equal(say.got, say.want, `source say ${say.got} is not --muted ${say.want} on ${theme}`);
      assert.match(say.text, /Alexandros/);
    }
    const dayTitle = page.getByRole("button", { name: "Day theme" });
    if ((await dayTitle.count()) > 0) await dayTitle.click();
    await page.setViewportSize({ width: 206, height: 457 });
    const title = await page.evaluate(() => {
      const node = document.querySelector("header h1");
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        text: (node.textContent || "").trim(),
        overflow: style.textOverflow,
        fits: node.scrollWidth <= node.clientWidth + 1,
        clipped: box.left < -1 || box.right > window.innerWidth + 1,
      };
    });
    assert.equal(title.text, "Names");
    assert.equal(title.clipped, false, `Names title clipped ${JSON.stringify(title)}`);
    assert.ok(title.fits || title.overflow === "ellipsis", `Names title ${JSON.stringify(title)}`);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
      const box = await page.locator("#abba [data-name-link]").boundingBox();
      assert.ok(box && box.width + 0.5 >= 44 && box.height + 0.5 >= 44, `Link ${box?.width}x${box?.height} at ${width}`);
    }
    await page.evaluate(() => {
      window.__shared = [];
      navigator.share = (data) => {
        window.__shared.push(data);
        return Promise.resolve();
      };
    });
    await page.locator("#abba [data-name-link]").click();
    const shared = await page.evaluate(() => window.__shared);
    assert.equal(shared.length, 1);
    assert.equal(shared[0].url, "https://www.injeel.news/names#abba");
    assert.match(shared[0].title, /Abba/);
    await page.evaluate(() => {
      window.__copied = "";
      window.__shareSettled = false;
      navigator.share = () => Promise.reject(new DOMException("cancelled", "AbortError"));
      navigator.clipboard.writeText = (text) => {
        window.__copied = text;
        window.__shareSettled = true;
        return Promise.resolve();
      };
    });
    await page.locator("#abba [data-name-link]").click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => window.__copied), "", "cancelling share copied the link");
    assert.equal(await page.evaluate(() => window.__shareSettled), false, "cancelling share wrote the clipboard");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      window.__copied = "";
      navigator.clipboard.writeText = (text) => {
        window.__copied = text;
        return Promise.resolve();
      };
    });
    await page.locator("#keefa [data-name-link]").click();
    assert.equal(await page.evaluate(() => window.__copied), "https://www.injeel.news/names#keefa");
    await page.waitForFunction(() => document.querySelector("[aria-live='polite']")?.textContent?.includes("Link copied"));
    assert.equal(pageErrors.length, 0, pageErrors.join("\n"));

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
    const samples = [];
    for (let sample = 0; sample < 5; sample += 1) {
      const letter = "qwxzv"[sample];
      const took = await page.evaluate((next) => {
        const input = document.querySelector("main input");
        const live = document.querySelector("[aria-live='polite']");
        const before = (live?.textContent || "").replace(/\s+/g, " ").trim();
        const start = performance.now();
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(input, next);
        input.dispatchEvent(new InputEvent("input", { bubbles: true }));
        return new Promise((resolve) => {
          const check = () => {
            const text = (live?.textContent || "").replace(/\s+/g, " ").trim();
            if (text !== before && /\d/.test(text)) resolve(performance.now() - start);
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
      }, letter);
      samples.push(took);
    }
    samples.sort((a, b) => a - b);
    const median = samples[2];
    console.log(`names keystroke median ${Math.round(median)}ms ${samples.map((n) => Math.round(n)).join(",")}`);
    assert.ok(median <= 150, `keystroke median ${median}ms`);
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    console.log(`names input paint ${Math.round(paint)}ms`);
    assert.ok(paint < 200, `input paint ${paint}ms`);

    const urls = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => /\.m?js(\?|$)/.test(new URL(entry.name).pathname) && new URL(entry.name).origin === location.origin)
        .map((entry) => entry.name),
    );
    const parts = [];
    let bytes = 0;
    let routeBytes = 0;
    for (const url of urls) {
      const body = Buffer.from(await (await fetch(url)).arrayBuffer());
      const gzip = gzipSync(body).length;
      bytes += gzip;
      const path = new URL(url).pathname;
      const isNames = /\/names[-.]/.test(path);
      if (isNames) routeBytes += gzip;
      parts.push(`${String(gzip).padStart(7)} ${String(body.length).padStart(8)} ${isNames ? "NAMES" : "     "} ${path}`);
    }
    console.log(parts.sort().join("\n"));
    console.log(`names js gzip ${bytes}`);
    console.log(`names route js gzip ${routeBytes}`);
    assert.ok(bytes <= NAMES_JS_GZIP_CAP, `names JS gzip ${bytes} exceeds ${NAMES_JS_GZIP_CAP}`);
    assert.ok(routeBytes > 0 && routeBytes <= 300 * 1024, `names route JS gzip ${routeBytes} exceeds ${300 * 1024}`);

    const early = await context.newPage();
    early.setDefaultTimeout(20000);
    await seed(early, "day");
    let holdScripts = true;
    await early.route("**/*", async (route) => {
      const sameOrigin = route.request().url().startsWith(server.url);
      if (holdScripts && sameOrigin && route.request().resourceType() === "script") {
        while (holdScripts) await new Promise((resolve) => setTimeout(resolve, 40));
      }
      await route.continue();
    });
    const earlyCdp = await context.newCDPSession(early);
    await earlyCdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await earlyCdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 300,
      downloadThroughput: 200 * 1024,
      uploadThroughput: 200 * 1024,
    });
    await earlyCdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    for (const width of [390, 1280]) {
      await early.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
      for (const id of ["perets", "keefa", "pergamos"]) {
        holdScripts = true;
        await early.goto("about:blank");
        await early.goto(`${server.url}/names#${id}`, { waitUntil: "commit" });
        await early.waitForFunction(
          (name) => {
            const card = document.getElementById(name);
            const head = card?.querySelector("h2");
            const bar = document.querySelector(".names-tools");
            if (!head || !bar) return false;
            const headBox = head.getBoundingClientRect();
            const barBox = bar.getBoundingClientRect();
            const clear = headBox.top >= barBox.bottom - 1 && headBox.bottom <= window.innerHeight + 1;
            return barBox.height > 40 && headBox.height > 8 && getComputedStyle(card).scrollMarginTop !== "0px" && clear;
          },
          id,
          { timeout: 20000 },
        );
        const landed = await early.evaluate((name) => {
          const card = document.getElementById(name);
          const head = card.querySelector("h2").getBoundingClientRect();
          const bar = document.querySelector(".names-tools").getBoundingClientRect();
          return {
            top: head.top,
            bottom: head.bottom,
            cover: bar.bottom,
            margin: getComputedStyle(card).scrollMarginTop,
            ready: typeof window.__setReadingLive === "function",
            height: window.innerHeight,
          };
        }, id);
        assert.equal(landed.ready, false, `${id} at ${width} hydrated before the hash landing`);
        assert.ok(landed.top >= landed.cover - 1, `${id} at ${width} heading ${Math.round(landed.top)} is under the find bar ${Math.round(landed.cover)} (margin ${landed.margin})`);
        assert.ok(landed.bottom <= landed.height + 1, `${id} at ${width} heading is cut off`);
        holdScripts = false;
        await early.waitForFunction(() => typeof window.__setReadingLive === "function", undefined, { timeout: 45000 });
        await assertPlaced(early, id, 20000);
      }
    }
    await early.close();
    await context.close();
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});
