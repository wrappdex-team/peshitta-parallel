// First-run reading card against the local production build.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const NAME = "How would you like to read?";

function dialog(page) {
  return page.getByRole("dialog", { name: NAME });
}

async function openFresh(browser, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, page };
}

async function prefsOf(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("peshitta-parallel") || "null"));
}

async function verseFace(page) {
  return page.locator("#v-1").evaluate((verse) => {
    const syriac = [...verse.querySelectorAll("[lang='syr']")].filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.hidden || node.closest("[hidden]")) return false;
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    return {
      text: (verse.textContent ?? "").replace(/\s+/g, " ").trim(),
      syriac: syriac.length,
    };
  });
}

test("the server HTML keeps the verse and omits the first-run card", async () => {
  const server = await startBuiltServer();
  try {
    const html = await fetch(`${server.url}/read/john/1`).then((response) => response.text());
    assert.match(html, /In the beginning was the Word/);
    assert.doesNotMatch(html, /How would you like to read/);
  } finally {
    await server.close();
  }
});

test("a first visit can choose a layout, quick start, or leave", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const fresh = await openFresh(browser);
    await fresh.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    const card = dialog(fresh.page);
    await card.waitFor();
    const named = await card.evaluate((node) => ({
      role: node.getAttribute("role"),
      modal: node.getAttribute("aria-modal"),
      label: node.getAttribute("aria-label"),
      focused: node.contains(document.activeElement),
    }));
    assert.equal(named.role, "dialog");
    assert.equal(named.modal, "true");
    assert.equal(named.label, NAME);
    assert.equal(named.focused, true);

    const before = await fresh.page.evaluate(() => Object.keys(localStorage).sort());
    await card.getByRole("button", { name: "Quick start (English)" }).click();
    await card.waitFor({ state: "hidden" });
    const quick = await prefsOf(fresh.page);
    assert.equal(quick.face, "tr");
    assert.equal(quick.lang, "en");
    assert.equal(quick.intro, 1);
    const added = (await fresh.page.evaluate(() => Object.keys(localStorage).sort())).filter(
      (key) => !before.includes(key),
    );
    assert.deepEqual(added, ["peshitta-parallel"]);
    await fresh.page.waitForFunction(() => {
      const main = document.querySelector("main");
      return !!main && (main === document.activeElement || main.contains(document.activeElement));
    });

    await fresh.page.goto(`${server.url}/read/john/1`, { waitUntil: "networkidle" });
    await dialog(fresh.page).waitFor({ state: "hidden" });
    const english = await verseFace(fresh.page);
    assert.match(english.text, /In the beginning was the Word/);
    assert.equal(english.syriac, 0);
    await fresh.page.reload({ waitUntil: "networkidle" });
    await fresh.page.locator("#v-1").waitFor();
    assert.equal(await dialog(fresh.page).count(), 0);
    await fresh.context.close();

    const spanish = await openFresh(browser);
    await spanish.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    const choice = dialog(spanish.page);
    await choice.waitFor();
    await choice.getByRole("radio", { name: "Syriac side by side" }).check();
    await choice.getByRole("radio", { name: "Español" }).check();
    await choice.getByRole("button", { name: "Start reading" }).click();
    await choice.waitFor({ state: "hidden" });
    const chosen = await prefsOf(spanish.page);
    assert.equal(chosen.face, "both");
    assert.equal(chosen.lang, "es");
    assert.equal(chosen.intro, 1);
    await spanish.page.goto(`${server.url}/read/john/1`, { waitUntil: "networkidle" });
    const both = await verseFace(spanish.page);
    assert.match(both.text, /En el principio era la Palabra/);
    assert.doesNotMatch(both.text, /Elohim/);
    assert.ok(both.syriac > 0, "Syriac column is missing");
    await spanish.page.reload({ waitUntil: "networkidle" });
    await spanish.page.locator("#v-1").waitFor();
    assert.equal(await dialog(spanish.page).count(), 0);
    await spanish.context.close();

    const escape = await openFresh(browser);
    await escape.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await dialog(escape.page).waitFor();
    const keysBefore = await escape.page.evaluate(() => Object.keys(localStorage).sort());
    await escape.page.keyboard.press("Escape");
    await dialog(escape.page).waitFor({ state: "hidden" });
    const left = await prefsOf(escape.page);
    assert.equal(left.face, "tr");
    assert.equal(left.lang, "en");
    assert.equal(left.intro, 1);
    const keysAdded = (await escape.page.evaluate(() => Object.keys(localStorage).sort())).filter(
      (key) => !keysBefore.includes(key),
    );
    assert.deepEqual(keysAdded, ["peshitta-parallel"]);
    await escape.context.close();

    const returning = await openFresh(browser);
    await returning.page.addInitScript(() => {
      localStorage.setItem(
        "peshitta-parallel",
        JSON.stringify({ theme: "day", lang: "fr", face: "both", lang2: "none" }),
      );
    });
    await returning.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await returning.page.getByRole("link", { name: /Open John/ }).waitFor();
    assert.equal(await dialog(returning.page).count(), 0);
    await returning.context.close();
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});

test("the card fits a narrow phone and 200% zoom", { timeout: 120000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 206, height: 457 },
    ]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto(`${server.url}/`, { waitUntil: "networkidle" });
      const card = dialog(page);
      await card.waitFor();
      const motion = await card.locator("> div").evaluate((node) => getComputedStyle(node).animationName);
      assert.equal(motion, "none", `${viewport.width} still animates`);
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert.ok(scroll <= 1, `${viewport.width} horizontal scroll ${scroll}`);
      const buttons = card.getByRole("button");
      const count = await buttons.count();
      assert.ok(count >= 2, `${viewport.width} buttons ${count}`);
      for (let i = 0; i < count; i += 1) {
        const box = await buttons.nth(i).boundingBox();
        assert.ok(box, `${viewport.width} button ${i} has no box`);
        assert.ok(box.width + 0.5 >= 44 && box.height + 0.5 >= 44, `${viewport.width} button ${i} is ${box.width}x${box.height}`);
        assert.ok(box.x + 0.5 >= 0 && box.x + box.width <= viewport.width + 1, `${viewport.width} button ${i} is outside`);
      }
      const start = card.getByRole("button", { name: "Start reading" });
      await start.scrollIntoViewIfNeeded();
      const startBox = await start.boundingBox();
      assert.ok(startBox, `${viewport.width} Start reading has no box`);
      assert.ok(startBox.y + 0.5 >= 0 && startBox.y + startBox.height <= viewport.height + 1, `${viewport.width} Start reading is off screen`);
      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});
