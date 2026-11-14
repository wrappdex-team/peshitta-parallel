// Names study guide against the local production build.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

// Same-origin JS gzip on /names at main d0b00ed was 439,667 bytes.
const NAMES_JS_GZIP_CAP = 439_667 + 6 * 1024;
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

async function overflow(page) {
  return page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ),
  );
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
    await page.goto(`${server.url}/names`, { waitUntil: "networkidle" });
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
    await page.goto(`${server.url}/names#corinth`, { waitUntil: "networkidle" });
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

    await page.goto(`${server.url}/names#keefa`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const card = document.getElementById("keefa");
      if (!card) return false;
      const box = card.getBoundingClientRect();
      const mid = box.top + box.height / 2;
      return box.height > 40 && Math.abs(mid - window.innerHeight / 2) < 180;
    });

    const places = page.getByRole("radio", { name: /^Places\s+150$/ });
    assert.equal(await places.count(), 1);
    const persons = Number((await page.getByRole("radio", { name: /^Persons\s+/ }).innerText()).replace(/\D/g, ""));
    const peoples = Number((await page.getByRole("radio", { name: /^Peoples\s+/ }).innerText()).replace(/\D/g, ""));
    const other = Number((await page.getByRole("radio", { name: /^Other\s+/ }).innerText()).replace(/\D/g, ""));
    const all = Number((await page.getByRole("radio", { name: /^All\s+/ }).innerText()).replace(/\D/g, ""));
    assert.equal(persons + 150 + peoples + other, all);
    assert.equal(all, 503);
    await places.click();
    await page.waitForFunction(() => document.querySelectorAll("main h2").length === 150);

    await page.getByRole("radio", { name: /^All\s+/ }).click();
    await page.waitForFunction(() => document.querySelectorAll("main h2").length === 503);
    assert.equal(await page.getByRole("button", { name: "V", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Q", exact: true }).click();
    await page.waitForFunction(() => {
      const card = document.getElementById("qananya");
      if (!card) return false;
      const box = card.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });

    const find = page.getByRole("textbox", { name: "FIND A NAME" });
    await find.fill("yeshua");
    await page.waitForFunction(() => document.querySelector("main h2")?.innerText.trim() === "Y'shua");
    assert.equal(await page.locator("main h2").first().innerText(), "Y'shua");
    await page.waitForFunction(() => new URL(location.href).searchParams.get("q") === "yeshua");

    await find.fill("Corinth");
    await page.waitForFunction(() => document.querySelector("main h2")?.innerText.trim() === "Corinth");
    assert.equal(await page.locator("main h2").count(), 1);
    assert.equal(await page.getByRole("checkbox", { name: "Search descriptions too" }).isChecked(), false);

    await find.fill("Peter");
    await page.waitForFunction(() => document.querySelector("main h2")?.innerText.trim() === "Keefa");
    assert.equal(await page.locator("#keefa").count(), 1);

    await page.goto(`${server.url}/names?q=keefa&kind=person`, { waitUntil: "networkidle" });
    await page.locator("#keefa").waitFor();
    assert.equal(await find.inputValue(), "keefa");
    assert.equal(await page.getByRole("radio", { name: /^Persons\s+/ }).getAttribute("aria-checked"), "true");
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#keefa").waitFor();
    assert.equal(await page.getByRole("textbox", { name: "FIND A NAME" }).inputValue(), "keefa");
    assert.equal(await page.getByRole("radio", { name: /^Persons\s+/ }).getAttribute("aria-checked"), "true");
    assert.equal(await page.locator("main h2").count(), 1);

    await page.goto(`${server.url}/names#keefa`, { waitUntil: "networkidle" });
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

    await page.goto(`${server.url}/names`, { waitUntil: "networkidle" });
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
