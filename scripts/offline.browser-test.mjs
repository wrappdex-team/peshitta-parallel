// Offline shell and the copy list. Built app only. The reader service worker stays on.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const PATHS = ["/saved", "/study", "/words", "/names", "/read/luke/2"];
const SIZES = [
  { width: 390, height: 844, name: "390×844" },
  { width: 320, height: 568, name: "320×568" },
  { width: 206, height: 457, name: "206×457" },
];
const NOTE = "This page isn't on this device yet. Reconnect, or open it once while online.";
const MISSING = "This chapter is not on this device. Open it while you are connected, then copy it from Language.";
const SPANISH = "Jesús subió a Jerusalén";

function seed(page, lang) {
  return page.addInitScript((id) => {
    localStorage.setItem(
      "peshitta-parallel",
      JSON.stringify({ theme: "day", lang: id, face: "tr", lang2: "none", intro: 1 }),
    );
  }, lang);
}

function watchCrashes(page) {
  const hits = [];
  const bad = (text) => /418|Minified React error|Failed to fetch dynamically imported module|Something went wrong/i.test(text);
  page.on("pageerror", (error) => {
    const text = String(error);
    if (bad(text)) hits.push(text);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (bad(text)) hits.push(text);
  });
  return hits;
}

async function openPath(page, url) {
  // A service worker can abort the first offline navigation while it claims the page.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      if (attempt === 1 || !String(error).includes("ERR_ABORTED")) throw error;
    }
  }
}
async function takeControl(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => navigator.serviceWorker.controller, undefined, { timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => navigator.serviceWorker.controller, undefined, { timeout: 20000 });
}

async function assertShell(page, label) {
  await page.getByText(NOTE).waitFor({ timeout: 15000 });
  const body = await page.locator("body").innerText();
  assert.equal(body.includes("Failed to fetch dynamically imported module"), false, label);
  assert.equal(body.includes("Something went wrong"), false, label);
  assert.ok((await page.locator("header").count()) > 0, `${label} has no header`);
  assert.ok(body.includes(NOTE), `${label} misses the offline note`);
  const view = page.viewportSize();
  for (const name of ["All books", "Offline"]) {
    const link = page.getByRole("link", { name, exact: true });
    const box = await link.boundingBox();
    assert.ok(box && box.height + 0.5 >= 44, `${label} ${name} is ${box ? box.height : 0}px`);
    assert.ok(view && box.x >= -1 && box.x + box.width <= view.width + 1, `${label} ${name} is wider than the screen`);
  }
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(scroll <= 1, `${label} horizontal scroll ${scroll}`);
}

test("an unvisited route stays inside the shell when offline", { timeout: 180000, concurrency: false }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        reducedMotion: "reduce",
        serviceWorkers: "allow",
      });
      const page = await context.newPage();
      const crashes = watchCrashes(page);
      await seed(page, "en");
      await takeControl(page, `${server.url}/`);
      await context.setOffline(true);
      for (const path of PATHS) {
        await openPath(page, `${server.url}${path}`);
        await assertShell(page, `${size.name} ${path}`);
        assert.deepEqual(crashes, [], `${size.name} ${path} ${crashes.join(" | ")}`);
      }
      await page.getByRole("link", { name: "All books", exact: true }).click();
      await page.getByRole("link", { name: /Matthew/ }).first().waitFor({ timeout: 20000 });
      assert.deepEqual(crashes, [], `${size.name} home link ${crashes.join(" | ")}`);
      await openPath(page, `${server.url}/study`);
      await page.getByRole("link", { name: "Offline", exact: true }).click();
      await page.getByText(NOTE).waitFor({ timeout: 20000 });
      assert.ok((await page.locator("header").count()) > 0, `${size.name} offline link has no header`);
      assert.deepEqual(crashes, [], `${size.name} offline link ${crashes.join(" | ")}`);
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
});

test("a copied book still reads offline, and Remove can be undone", { timeout: 180000, concurrency: false }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "allow",
    });
    const page = await context.newPage();
    const crashes = watchCrashes(page);
    await seed(page, "es");
    await takeControl(page, `${server.url}/read/john/1`);
    await page.locator("[data-reading-tongue]").click();
    await page.getByRole("button", { name: "Copy John" }).click();
    await page.getByText("John is on this device in Español.").waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await context.setOffline(true);
    await page.getByRole("banner").getByRole("link", { name: "5", exact: true }).click();
    await page.getByText(SPANISH).waitFor({ timeout: 20000 });
    assert.equal((await page.locator("body").innerText()).includes("Something went wrong"), false);
    await page.getByRole("button", { name: "Books" }).click();
    await page.getByRole("link", { name: /Mark/ }).first().click();
    await page.getByText(MISSING).waitFor({ timeout: 20000 });
    assert.deepEqual(crashes, [], crashes.join(" | "));

    await context.setOffline(false);
    await page.goto(`${server.url}/offline`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Remove Español" }).click();
    await page.getByText("Español will be removed.").waitFor();
    const live = page.locator("[aria-live='polite']");
    assert.match(await live.innerText(), /Español will be removed/);
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    const undoBox = await undo.boundingBox();
    assert.ok(undoBox && undoBox.height + 0.5 >= 44, `Undo is ${undoBox ? undoBox.height : 0}px`);
    await undo.click();
    await page.getByRole("heading", { name: "Español" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Remove now" }).count(), 0);
    await page.getByRole("button", { name: "Remove John" }).click();
    await page.getByText("John will be removed.").waitFor();
    const now = page.getByRole("button", { name: "Remove now" });
    const nowBox = await now.boundingBox();
    assert.ok(nowBox && nowBox.height + 0.5 >= 44, `Remove now is ${nowBox ? nowBox.height : 0}px`);
    await now.click();
    await page.getByRole("link", { name: /John/ }).waitFor({ state: "detached", timeout: 10000 });
    assert.equal((await page.locator("body").innerText()).includes("John"), false);
  } finally {
    await browser.close();
    await server.close();
  }
});
