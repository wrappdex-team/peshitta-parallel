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

async function appBase() {
  const live = "http://127.0.0.1:8080";
  if (await reachable(live)) return { base: live, child: null };
  const base = "http://127.0.0.1:8093";
  const child = spawn("node", ["scripts/with-app-env.mjs", "vite", "dev", "--host", "127.0.0.1", "--port", "8093"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "ignore",
  });
  for (let i = 0; i < 40 && !(await reachable(base)); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!(await reachable(base))) {
    child.kill();
    throw new Error("the reader did not start");
  }
  return { base, child };
}

test("Enter on a reference closes Search and leaves the verse below the bars", { timeout: 120000 }, async () => {
  const { base, child } = await appBase();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
    assert.ok(box.y + 1 >= header.y + header.height, `verse top ${box.y} is under bars ending at ${header.y + header.height}`);

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
    await browser.close();
    child?.kill();
  }
});
