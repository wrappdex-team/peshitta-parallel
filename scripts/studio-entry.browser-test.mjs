// Entry points for AI Studio: the menu and the home footer, even when Studio is off.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const SHOTS = process.env.STUDIO_ENTRY_SHOTS || "";
const SIZES = [206, 360, 390, 412, 1280];

async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function shot(page, path) {
  await page.waitForTimeout(350);
  await page.screenshot({ path });
}

async function openHome(browser, url, { theme = "day", width = 390 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript((t) => {
    if (sessionStorage.getItem("__s")) return;
    sessionStorage.setItem("__s", "1");
    localStorage.setItem("peshitta-parallel", JSON.stringify({ theme: t, lang: "en", face: "tr", lang2: "none", intro: 1 }));
  }, theme);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Injeel", exact: true }).first().waitFor();
  return { context, page, errors };
}

let server;
let browser;
test.before(async () => {
  server = await startBuiltServer();
  browser = await chromium.launch();
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
});
test.after(async () => {
  await browser?.close();
  await server?.close();
});

test("home footer and the menu both offer AI Studio while it is off, and both open the Studio page", async () => {
  const { context, page, errors } = await openHome(browser, server.url);
  assert.equal(await page.evaluate(() => localStorage.getItem("injeel-studio")), null, "still off");
  const home = page.locator("[data-studio-entry=home]");
  assert.equal(await home.count(), 1);
  assert.equal((await home.textContent())?.replace(/\s+/g, " ").trim(), "AI Studio");
  assert.equal(await page.locator("footer").getByRole("link", { name: "AI Studio" }).count(), 0, "no second home link");
  await page.getByRole("button", { name: "Books" }).click();
  const menu = page.getByRole("navigation").getByRole("link", { name: "AI Studio", exact: true });
  await menu.waitFor();
  await menu.scrollIntoViewIfNeeded();
  if (SHOTS) await shot(page, `${SHOTS}/menu-day-390.png`);
  await menu.click();
  await page.waitForURL(/\/studio$/);
  await page.locator("[data-studio-page]").waitFor();
  assert.equal(await page.getByRole("switch", { name: /AI Studio/ }).getAttribute("aria-checked"), "false");
  assert.equal(await page.getByRole("button", { name: "Connections" }).count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test("the home AI Studio button opens Studio at the last verse you were reading", async () => {
  const { context, page } = await openHome(browser, server.url);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("peshitta-parallel") || "{}");
    raw.last = { book: "matthew", chapter: 5, verse: 3 };
    localStorage.setItem("peshitta-parallel", JSON.stringify(raw));
  });
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.locator("[data-studio-entry=home]").click();
  await page.waitForURL(/\/studio$/);
  await page.locator("[data-studio-ref]").waitFor();
  await page.waitForFunction(() => /Matthew 5:3/.test(document.querySelector("[data-studio-ref]")?.textContent ?? ""));
  assert.match(await page.locator("[data-studio-ref]").textContent(), /Matthew 5:3/);
  await context.close();
});

for (const theme of ["day", "night"]) {
  test(`AI Studio entry fits at 206/360/390/412/1280 px in ${theme}`, async () => {
    for (const width of SIZES) {
      const { context, page, errors } = await openHome(browser, server.url, { theme, width });
      assert.ok(await noHorizontalScroll(page), `home ${width} ${theme}`);
      const home = page.locator("[data-studio-entry=home]");
      await home.scrollIntoViewIfNeeded();
      if (SHOTS && width === 390) await shot(page, `${SHOTS}/home-${theme}-390.png`);
      await page.getByRole("button", { name: "Books" }).click();
      const menu = page.getByRole("navigation").getByRole("link", { name: "AI Studio", exact: true });
      await menu.waitFor();
      await menu.scrollIntoViewIfNeeded();
      assert.ok(await noHorizontalScroll(page), `menu ${width} ${theme}`);
      if (SHOTS && width === 390) await shot(page, `${SHOTS}/menu-${theme}-390.png`);
      await menu.click();
      await page.waitForURL(/\/studio$/);
      await page.locator("[data-studio-page]").waitFor();
      assert.ok(await noHorizontalScroll(page), `studio ${width} ${theme}`);
      if (SHOTS && (width === 390 || width === 1280)) await shot(page, `${SHOTS}/studio-${theme}-${width}.png`);
      assert.deepEqual(errors, [], `${width} ${theme}`);
      await context.close();
    }
  });
}
