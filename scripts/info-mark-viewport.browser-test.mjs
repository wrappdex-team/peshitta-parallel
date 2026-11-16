// Browser check: every visible help note stays on screen at 320 and 390 px.
//
// Runs against the local production build (scripts/serve-built.mjs), never a dev
// server, so there is no cold compile and no child process that can outlive the
// test. Needs `npm run build:check` and a Playwright Chromium
// (`npx playwright install chromium`). Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const HEIGHT = 700;
const PATHS = ["/", "/names", "/privacy", "/seal", "/words", "/study", "/read/john/1"];

let server;
let browser;

before(async () => {
  server = await startBuiltServer();
  browser = await chromium.launch({ headless: true, timeout: 30000 });
});

after(async () => {
  await browser?.close().catch(() => {});
  await server?.close();
});

async function openMarks(page, width, where) {
  const dialog = page.locator("dialog[open]");
  const root = (await dialog.count()) ? dialog.last() : page.locator("body");
  const buttons = root.locator('button[aria-label^="About "]');
  const count = await buttons.count();
  let opened = 0;
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    if (!(await button.isVisible())) continue;
    const label = `${await button.getAttribute("aria-label")} on ${where} at ${width}`;
    const before = await page.evaluate(() => document.documentElement.scrollWidth);
    const handle = await button.elementHandle();
    assert.ok(handle, `${label}: missing button`);
    await handle.click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if ((await handle.getAttribute("aria-expanded")) !== "true") await handle.click();
    const note = page.locator(".help-sheet").last();
    try {
      await note.waitFor({ state: "visible", timeout: 15000 });
    } catch (error) {
      throw new Error(`${label}: the note did not open\n${error}`);
    }
    const box = await note.boundingBox();
    assert.ok(box, `${label}: the note has a box`);
    const after = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(after <= before + 1, `${label}: the note widened the page`);
    if (width < 640) {
      assert.ok(box.width >= width - 2, `${label}: width ${box.width}`);
      assert.ok(box.height >= HEIGHT - 2, `${label}: height ${box.height}`);
    } else {
      assert.ok(box.x >= 15, `${label}: left ${box.x}`);
      assert.ok(box.x + box.width <= width - 15 + 1, `${label}: right ${box.x + box.width}`);
    }
    const close = note.getByRole("button", { name: "Close" });
    const closeBox = await close.boundingBox();
    assert.ok(closeBox, `${label}: Close has a box`);
    assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= HEIGHT + 1, `${label}: Close unreachable`);
    await page.keyboard.press("Escape");
    await note.waitFor({ state: "hidden", timeout: 15000 });
    opened += 1;
  }
  return opened;
}

for (const width of [320, 390]) {
  test(`help notes stay inside ${width} px`, { timeout: 120000 }, async () => {
    const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
    await page.addInitScript(() => {
      localStorage.setItem(
        "peshitta-parallel",
        JSON.stringify({ theme: "day", lang: "en", face: "tr", lang2: "none" }),
      );
    });
    page.setDefaultTimeout(15000);
    try {
      let opened = 0;
      for (const path of PATHS) {
        await page.goto(`${server.url}${path}`, { waitUntil: "load", timeout: 30000 });
        await page.waitForFunction(() => window.__prefsWatch === true);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        opened += await openMarks(page, width, path);
        if (path === "/") {
          await page.getByRole("button", { name: "Search" }).first().click();
          opened += await openMarks(page, width, `${path} Search`);
          await page.keyboard.press("Escape");
        }
        if (path === "/words" || path === "/read/john/1") {
          const reading = page.getByRole("button", { name: /^Reading/ }).first();
          if (await reading.isVisible()) {
            await reading.click();
            opened += await openMarks(page, width, `${path} Reading`);
          }
        }
      }
      assert.ok(opened >= PATHS.length, `opened only ${opened} notes at ${width}`);
    } finally {
      await page.close();
    }
  });
}
