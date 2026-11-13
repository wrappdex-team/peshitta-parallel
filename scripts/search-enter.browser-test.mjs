// Browser check against the local production build (scripts/serve-built.mjs).
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

test(
  "Enter on a reference closes Search and leaves the verse below the bars",
  { timeout: 120000 },
  async () => {
    const server = await startBuiltServer();
    const base = server.url;
    let browser;
    try {
      browser = await chromium.launch({ headless: true, timeout: 30000 });
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.addInitScript(() => {
        localStorage.setItem(
          "peshitta-parallel",
          JSON.stringify({ theme: "day", lang: "en", face: "tr", lang2: "none" }),
        );
      });
      await page.goto(`${base}/read/john/3`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Search" }).first().click();
      const dialog = page.locator("dialog[aria-label='Search the New Testament']");
      const input = dialog.getByRole("searchbox", { name: "Search words or a reference" });
      await input.fill("Mt 5:3");
      await input.press("Enter");
      await page.waitForURL(/\/read\/matthew\/5/);
      await assert.equal(await dialog.count(), 0);
      const verse = page.locator("#v-3");
      await verse.waitFor({ state: "visible" });
      const header = await page.locator("header").first().boundingBox();
      const box = await verse.boundingBox();
      assert.ok(header && box);
      assert.ok(
        box.y + 1 >= header.y + header.height,
        `verse top ${box.y} is under bars ending at ${header.y + header.height}`,
      );

      await page.setViewportSize({ width: 206, height: 457 });
      await page.getByRole("button", { name: "Search" }).first().click();
      const narrow = page.locator("dialog[aria-label='Search the New Testament']");
      const field = narrow.getByRole("searchbox", { name: "Search words or a reference" });
      await field.fill("John 3:16");
      const fieldBox = await field.boundingBox();
      assert.ok(fieldBox && fieldBox.width >= 120, `query width ${fieldBox?.width}`);

      await field.fill("John 22:1");
      await narrow.getByText("John has 21 chapters.").waitFor();
      await field.fill("john 3 16");
      await narrow.getByText("John 3:16").first().waitFor();

      await field.fill("ܐܠܗܐ");
      await narrow.getByRole("button", { name: "Peshitta", pressed: true }).waitFor();
      await field.fill("love");
      await narrow.getByText("No verse has that word.").waitFor({ state: "hidden" });
      await narrow.getByText(/of \d+\./).waitFor();
    } finally {
      await browser?.close().catch(() => {});
      await server.close();
    }
  },
);
