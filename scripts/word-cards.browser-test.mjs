// Word cards phase 1A against the built app. Needs `npm run build:check`.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const WIDTHS = [206, 360, 390, 1280];
const SHOTS = "/tmp/injeel-word-cards";

function seed(page, theme) {
  return page.addInitScript((stored) => {
    if (!localStorage.getItem("peshitta-parallel")) {
      localStorage.setItem("peshitta-parallel", JSON.stringify(stored));
    }
    const uttered = [];
    window.__wordSpeech = uttered;
    const synth = {
      speak(utter) {
        uttered.push(utter.text);
        utter.onend?.();
      },
      cancel() {},
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
  }, { theme, lang: "en", face: "both", lang2: "none", intro: 1, words: false });
}

async function ready(page) {
  await page.locator("[data-reading-tongue]").waitFor({ timeout: 45000 });
  await page.locator("#v-1").waitFor();
}

async function wordsOn(page) {
  await page.locator("[data-reading-tongue]").click();
  const sheet = page.getByRole("dialog", { name: "Reading" });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Words", exact: true }).click();
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet.waitFor({ state: "hidden" });
}

function card(page, verse, index) {
  return page.locator(`#v-${verse} [data-word-card]`).nth(index);
}

test("word cards use the occurrence gloss and the lexicon stays off the home page", async () => {
  mkdirSync(SHOTS, { recursive: true });
  const server = await startBuiltServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    const requested = [];
    page.on("request", (request) => requested.push(request.url()));
    await seed(page, "day");
    await page.goto(`${server.url}/read/john/1`, { waitUntil: "domcontentloaded" });
    await ready(page);
    assert.equal(requested.filter((url) => url.includes("/words/")).length, 0, "words chunk loaded while Words was off");

    await wordsOn(page);
    await page.locator("#v-1 [data-word-card]").nth(14).waitFor();

    for (const theme of ["day", "night"]) {
      await page.evaluate((want) => {
        document.documentElement.dataset.theme = want;
      }, theme);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
        const cards = page.locator("#v-1 [data-word-card]");
        await cards.nth(0).scrollIntoViewIfNeeded();
        assert.equal(await cards.count(), 15, `${theme} ${width}`);
        await cards.nth(1).scrollIntoViewIfNeeded();
        assert.equal(await cards.nth(1).locator("[data-word-gloss]").innerText(), "he (existing)");
        assert.notEqual(await cards.nth(1).locator("[data-word-gloss]").innerText(), "he is");
        assert.notEqual(await cards.nth(1).locator("[data-word-gloss]").innerText(), "was");
        await cards.nth(4).scrollIntoViewIfNeeded();
        assert.equal(await cards.nth(4).locator("[data-word-gloss]").innerText(), "and he");
        await cards.nth(13).scrollIntoViewIfNeeded();
        assert.equal(await cards.nth(13).locator("[data-word-gloss]").innerText(), "he");
        await cards.nth(3).scrollIntoViewIfNeeded();
        assert.equal(await cards.nth(3).locator("[data-word-gloss]").innerText(), "the Word");
        assert.equal(await cards.nth(3).locator("[data-word-parse]").count(), 0);
        assert.doesNotMatch(await cards.nth(3).innerText(), /Draft|Sourced|Reviewed|n · f · sg · emph|part · 3ms|prep/);
        assert.match(await cards.nth(3).getAttribute("aria-label"), /meltha/);
        await cards.nth(5).scrollIntoViewIfNeeded();
        assert.equal(await cards.nth(5).locator("[data-word-gloss]").innerText(), "Word");
        await cards.nth(9).scrollIntoViewIfNeeded();
        assert.equal(await cards.nth(9).locator("[data-word-gloss]").innerText(), "Elohim");
        assert.match(await cards.nth(9).getAttribute("aria-label"), /Alaha/);
        const second = page.locator("#v-2 [data-word-card]").nth(0);
        await second.scrollIntoViewIfNeeded();
        assert.equal(await second.locator("[data-word-gloss]").innerText(), "this");
        const secondIth = page.locator("#v-2 [data-word-card]").nth(1);
        await secondIth.scrollIntoViewIfNeeded();
        assert.equal(await secondIth.locator("[data-word-gloss]").innerText(), "he (existing)");
        const box = await cards.nth(3).boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44, `${theme} ${width} target ${JSON.stringify(box)}`);
        const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0));
        assert.equal(overflow, 0, `${theme} ${width} horizontal scroll ${overflow}`);
        await page.locator("#v-1").scrollIntoViewIfNeeded();
        if (width !== 360) await page.screenshot({ path: `${SHOTS}/john-${theme}-${width}.png`, fullPage: false });
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "day";
    });
    await card(page, 1, 3).click();
    const word = page.getByRole("dialog", { name: "Word" });
    await word.getByText("Noun · feminine · singular · emphatic").waitFor();
    await word.getByText("word, speech, matter").waitFor();
    await word.getByText("Source not yet attached.").waitFor();
    await word.getByText("Draft, not reviewed by a scholar").waitFor();
    await word.getByText("ܡܠܠ").waitFor();
    await word.getByRole("button", { name: "Show every place this spelling occurs" }).click();
    const countLine = word.getByText(/^[1-9]\d* · same spelling/);
    await countLine.waitFor();
    assert.match(await countLine.innerText(), /^[1-9]/);
    const link = word.getByRole("link").first();
    assert.match(await link.innerText(), /^[A-Z]/);
    await page.keyboard.press("Escape");
    await word.waitFor({ state: "hidden" });

    await card(page, 1, 1).click();
    await word.getByText("In context: was").waitFor();
    assert.equal(await word.getByText("Literal: he (existing)").count(), 1);
    assert.equal(await word.getByText("Literal: he is").count(), 0);
    await page.keyboard.press("Escape");

    await page.goto(`${server.url}/read/matthew/6`, { waitUntil: "domcontentloaded" });
    await ready(page);
    await page.waitForFunction(() => {
      const node = document.getElementById("v-9");
      if (!node) return false;
      node.scrollIntoView({ block: "center" });
      return node.querySelectorAll("[data-word-card]").length >= 8;
    });
    const name = page.locator("#v-9 [data-word-card]").nth(7);
    assert.equal(await name.locator("[data-word-gloss]").innerText(), "your name");
    const heaven = page.locator("#v-9 [data-word-card]").nth(5);
    assert.equal(await heaven.locator("[data-word-gloss]").innerText(), "who in heaven");
    await name.click();
    await word.getByRole("button", { name: "Say Classical Syriac" }).click();
    await page.waitForFunction(() => (window.__wordSpeech ?? []).length > 0);
    const said = await page.evaluate(() => window.__wordSpeech);
    assert.ok(said.includes("shmakh"), `spoke ${JSON.stringify(said)}`);
    await page.keyboard.press("Escape");

    await page.locator("#v-9 [data-word-card]").nth(4).click();
    await word.getByText(/Needs a scholar:/).waitFor();
    await page.keyboard.press("Escape");

    await heaven.click();
    await word.getByText("In context: who is in heaven").waitFor();
    assert.equal(await word.getByText("Literal: who in heaven").count(), 1);
    assert.equal(await word.getByText("who", { exact: true }).count(), 1);
    assert.equal(await word.getByText("in", { exact: true }).count(), 1);
    await page.keyboard.press("Escape");

    for (const theme of ["day", "night"]) {
      await page.evaluate((want) => {
        document.documentElement.dataset.theme = want;
      }, theme);
      for (const width of [206, 390, 1280]) {
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
        await page.locator("#v-9").scrollIntoViewIfNeeded();
        const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0));
        assert.equal(overflow, 0, `matthew ${theme} ${width} scroll ${overflow}`);
        await page.screenshot({ path: `${SHOTS}/matthew-${theme}-${width}.png`, fullPage: false });
      }
    }

    const home = await context.newPage();
    home.on("pageerror", (error) => pageErrors.push(String(error)));
    await seed(home, "day");
    await home.goto(`${server.url}/`, { waitUntil: "domcontentloaded" });
    await home.getByRole("button", { name: "Books" }).waitFor();
    const leaked = await home.evaluate(() => {
      const entries = performance
        .getEntriesByType("resource")
        .filter((entry) => /\.m?js(\?|$)/.test(new URL(entry.name).pathname) && new URL(entry.name).origin === location.origin);
      const measured = entries.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
      return { urls: entries.map((entry) => entry.name), measured };
    });
    let sentinel = false;
    for (const url of leaked.urls) {
      const response = await fetch(url);
      if (!response.ok) continue;
      if ((await response.text()).includes("A light connective")) sentinel = true;
    }
    console.log(`home js bytes after lexicon split ${leaked.measured}`);
    assert.equal(sentinel, false, "lexicon sentinel is in the home JS");
    assert.ok(1_231_366 - leaked.measured >= 700_000, `home JS only fell by ${1_231_366 - leaked.measured} (now ${leaked.measured})`);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
