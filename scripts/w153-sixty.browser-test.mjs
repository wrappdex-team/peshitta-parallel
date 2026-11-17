// W-153 against the built app: sixty cards vs a drink verse. Needs `npm run build:check`.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

function shotDir() {
  const preferred = "/workspace/injeel-loop/cycles/w153";
  try {
    mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = join(tmpdir(), "injeel-w153");
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function seed(page, theme) {
  return page.addInitScript((stored) => {
    localStorage.setItem("peshitta-parallel", JSON.stringify(stored));
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
  }, { theme, lang: "en", face: "both", lang2: "none", intro: 1, words: true });
}

async function openVerse(page, url, verse, minCards) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("[data-reading-tongue]").waitFor({ timeout: 45000 });
  await page.waitForFunction((spec) => {
    const node = document.getElementById(`v-${spec.verse}`);
    if (!node) return false;
    node.scrollIntoView({ block: "center" });
    return node.querySelectorAll("[data-word-card]").length >= spec.minCards;
  }, { verse, minCards }, { timeout: 20000 });
}

test("W-153: Revelation 13:18 and Luke 24:13 show sixty; Luke 5:30 still drinks", async () => {
  const SHOTS = shotDir();
  const server = await startBuiltServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    for (const theme of ["day", "night"]) {
      await seed(page, theme);
      await openVerse(page, `${server.url}/read/revelation/13`, 18, 16);
      await page.evaluate(() => {
        document.documentElement.dataset.theme = document.documentElement.dataset.theme;
      });
      await page.evaluate((want) => {
        document.documentElement.dataset.theme = want;
      }, theme);
      const cards = page.locator("#v-18 [data-word-card]");
      assert.equal(await cards.count(), 16, `rev 13:18 ${theme} count`);
      const sixty = cards.nth(14);
      const gloss = await sixty.locator("[data-word-gloss]").innerText();
      assert.match(gloss, /sixty/i, `rev 13:18 ${theme} ${gloss}`);
      assert.doesNotMatch(gloss, /drink/i, `rev 13:18 ${theme}`);
      const aria = await sixty.getAttribute("aria-label");
      assert.match(aria, /shtin/, `rev 13:18 aria ${aria}`);
      assert.doesNotMatch(aria ?? "", /wshatin|shatayn/i);
      await page.locator("#v-18").screenshot({ path: `${SHOTS}/rev-13-18-cards-390-${theme}.png` });
      await sixty.click();
      const word = page.getByRole("dialog", { name: "Word" });
      await word.getByText(/sixty/i).first().waitFor();
      await word.getByText("Draft, not reviewed by a scholar").waitFor();
      await word.getByText(/Needs a scholar:/).waitFor();
      const sheetText = (await word.innerText()).toLowerCase();
      assert.doesNotMatch(sheetText, /drink/);
      assert.match(sheetText, /this is a number/);
      assert.match(await word.locator("p.font-serif.text-xl").innerText(), /sixty/i);
      await page.evaluate(() => {
        window.__wordSpeech.length = 0;
      });
      await word.getByRole("button", { name: "Say Classical Syriac" }).click();
      await page.waitForFunction(() => (window.__wordSpeech ?? []).length > 0);
      const said = await page.evaluate(() => window.__wordSpeech);
      assert.ok(said.includes("w'shtin"), `rev spoke ${JSON.stringify(said)}`);
      assert.equal(said.some((t) => /wshatin|shatayn/i.test(t)), false, `rev spoke ${JSON.stringify(said)}`);
      await page.screenshot({ path: `${SHOTS}/rev-13-18-390-${theme}.png`, fullPage: false });
      await page.keyboard.press("Escape");
      await word.waitFor({ state: "hidden" });

      await openVerse(page, `${server.url}/read/luke/24`, 13, 15);
      await page.evaluate((want) => {
        document.documentElement.dataset.theme = want;
      }, theme);
      const luke = page.locator("#v-13 [data-word-card]").nth(14);
      const lukeGloss = await luke.locator("[data-word-gloss]").innerText();
      assert.equal(lukeGloss, "sixty", `luke 24:13 ${theme}`);
      const lukeAria = await luke.getAttribute("aria-label");
      assert.match(lukeAria ?? "", /shtin/);
      assert.doesNotMatch(lukeAria ?? "", /wshatin|shatayn/i);
      await page.locator("#v-13").screenshot({ path: `${SHOTS}/luke-24-13-cards-390-${theme}.png` });
      await luke.click();
      await word.getByText("sixty").first().waitFor();
      const lukeSheet = (await word.innerText()).toLowerCase();
      assert.doesNotMatch(lukeSheet, /drink/);
      assert.match(await word.locator("p.font-serif.text-xl").innerText(), /sixty/i);
      await page.evaluate(() => {
        window.__wordSpeech.length = 0;
      });
      await word.getByRole("button", { name: "Say Classical Syriac" }).click();
      await page.waitForFunction(() => (window.__wordSpeech ?? []).length > 0);
      const lukeSaid = await page.evaluate(() => window.__wordSpeech);
      assert.ok(lukeSaid.includes("shtin"), `luke spoke ${JSON.stringify(lukeSaid)}`);
      await page.screenshot({ path: `${SHOTS}/luke-24-13-390-${theme}.png`, fullPage: false });
      await page.keyboard.press("Escape");
    }

    await seed(page, "day");
    await openVerse(page, `${server.url}/read/luke/5`, 30, 8);
    const drinkCards = page.locator("#v-30 [data-word-card]");
    const texts = [];
    const n = await drinkCards.count();
    for (let i = 0; i < n; i++) {
      texts.push((await drinkCards.nth(i).locator("[data-word-gloss]").innerText()).toLowerCase());
    }
    assert.ok(texts.some((t) => t.includes("drink")), `luke 5:30 glosses ${JSON.stringify(texts)}`);
    assert.equal(texts.some((t) => t.includes("sixty")), false, `luke 5:30 unexpectedly has sixty: ${JSON.stringify(texts)}`);
    await page.locator("#v-30").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/luke-5-30-drink-390-day.png`, fullPage: false });

    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
