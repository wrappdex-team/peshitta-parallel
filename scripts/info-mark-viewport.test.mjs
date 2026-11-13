import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function openMarks(page, width, height) {
  const dialog = page.locator("dialog[open]");
  const root = (await dialog.count()) ? dialog.last() : page.locator("body");
  const buttons = root.locator('button[aria-label^="About "]');
  const count = await buttons.count();
  let opened = 0;
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    if (!(await button.isVisible())) continue;
    const before = await page.evaluate(() => document.documentElement.scrollWidth);
    await button.click();
    const note = page.locator('[role="region"]').last();
    await note.waitFor({ state: "visible", timeout: 2000 });
    const box = await note.boundingBox();
    assert.ok(box, "the note has a box");
    assert.ok(box.x >= 15, `left ${box.x} at ${width}`);
    assert.ok(box.x + box.width <= width - 15 + 1, `right ${box.x + box.width} at ${width}`);
    assert.ok(box.y >= 0, `top ${box.y}`);
    assert.ok(box.y + box.height <= height + 1, `bottom ${box.y + box.height} at ${height}`);
    const after = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(after <= before + 1, `the note widened the page at ${width}`);
    await page.keyboard.press("Escape");
    await note.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
    opened += 1;
  }
  return opened;
}

test("help notes stay inside 320 and 390", { timeout: 120000 }, async () => {
  let base = "http://127.0.0.1:8080";
  let child = null;
  if (!(await reachable(base))) {
    base = "http://127.0.0.1:8091";
    child = spawn("node", ["scripts/with-app-env.mjs", "vite", "dev", "--host", "127.0.0.1", "--port", "8091"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdio: "ignore",
    });
    for (let i = 0; i < 40 && !(await reachable(base)); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!(await reachable(base))) {
    child?.kill();
    throw new Error("the reader did not start");
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390]) {
      const height = 700;
      const page = await browser.newPage({ viewport: { width, height } });
      const paths = ["/", "/names", "/privacy", "/seal", "/words", "/study", "/read/john/1"];
      let opened = 0;
      for (const path of paths) {
        await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
        opened += await openMarks(page, width, height);
        if (path === "/") {
          await page.getByRole("button", { name: "Search" }).first().click();
          opened += await openMarks(page, width, height);
          await page.keyboard.press("Escape");
        }
        if (path === "/words" || path === "/read/john/1") {
          const reading = page.getByRole("button", { name: /^Reading/ }).first();
          if (await reading.isVisible()) {
            await reading.click();
            opened += await openMarks(page, width, height);
          }
        }
      }
      assert.ok(opened > 0, `opened a note at ${width}`);
      await page.close();
    }
  } finally {
    await browser.close();
    child?.kill();
  }
});
