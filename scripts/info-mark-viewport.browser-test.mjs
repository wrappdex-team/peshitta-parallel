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
    await button.click();
    const note = page.locator('[role="region"]').last();
    await note.waitFor({ state: "visible", timeout: 5000 });
    const box = await note.boundingBox();
    assert.ok(box, `${label}: the note has a box`);
    // Horizontal containment applies to every note.
    assert.ok(box.x >= 15, `${label}: left ${box.x}`);
    assert.ok(box.x + box.width <= width - 15 + 1, `${label}: right ${box.x + box.width}`);
    const after = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(after <= before + 1, `${label}: the note widened the page`);
    const fixed = await note.evaluate((node) => getComputedStyle(node).position === "fixed");
    if (fixed) {
      // A floating note cannot be scrolled to, so all of it must be on screen.
      assert.ok(box.y >= 0, `${label}: top ${box.y}`);
      assert.ok(box.y + box.height <= HEIGHT + 1, `${label}: bottom ${box.y + box.height}`);
    } else {
      // An in-flow note scrolls with the page: it must open on screen, and its
      // Close button must be reachable by scrolling, not clipped or covered.
      assert.ok(
        box.y >= 0 && box.y < HEIGHT,
        `${label}: in-flow note opens off screen at ${box.y}`,
      );
      const close = note.getByRole("button", { name: "Close" });
      await close.scrollIntoViewIfNeeded();
      const closeBox = await close.boundingBox();
      assert.ok(closeBox, `${label}: Close has a box`);
      assert.ok(
        closeBox.y >= 0 && closeBox.y + closeBox.height <= HEIGHT + 1,
        `${label}: Close unreachable`,
      );
      const hit = await close.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return node === top || node.contains(top);
      });
      assert.ok(hit, `${label}: Close is covered by another element`);
    }
    await page.keyboard.press("Escape");
    await note.waitFor({ state: "hidden", timeout: 5000 });
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
        await page.goto(`${server.url}${path}`, { waitUntil: "networkidle", timeout: 30000 });
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
