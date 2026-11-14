// Offline shell, a hard-loaded copy, and the copy list. Built app only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const NOTE_PATHS = ["/saved", "/study", "/words", "/names"];
const SIZES = [
  { width: 390, height: 844, name: "390×844" },
  { width: 320, height: 568, name: "320×568" },
  { width: 206, height: 457, name: "206×457" },
];
const NOTE = "This page isn't on this device yet. Reconnect, or open it once while online.";
const MISSING = "This chapter is not on this device. Open it while you are connected, then copy it from Language.";
const SPANISH = "Jesús subió a Jerusalén";
const OPENING = "Después de estas cosas hubo una fiesta";
const DAY = "rgb(243, 239, 228)";
const NIGHT = "rgb(18, 17, 15)";

function seed(page, lang, theme = "day") {
  return page.addInitScript((prefs) => {
    localStorage.setItem("peshitta-parallel", JSON.stringify(prefs));
  }, { theme, lang, face: "tr", lang2: "none", intro: 1 });
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

async function paper(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function assertShell(page, label) {
  await page.getByText(NOTE).waitFor({ timeout: 15000 });
  const body = await page.locator("body").innerText();
  assert.equal(body.includes("Failed to fetch dynamically imported module"), false, label);
  assert.equal(body.includes("Something went wrong"), false, label);
  assert.ok((await page.locator("header").count()) > 0, `${label} has no header`);
  assert.ok(body.includes(NOTE), `${label} misses the offline note`);
  assert.equal(await paper(page), DAY, `${label} day paper`);
  const view = page.viewportSize();
  for (const name of ["All books", "Offline"]) {
    const link = page.getByRole("link", { name, exact: true });
    const box = await link.boundingBox();
    assert.ok(box && box.height + 0.5 >= 44, `${label} ${name} is ${box ? box.height : 0}px`);
    assert.ok(view && box.x >= -1 && box.x + box.width <= view.width + 1, `${label} ${name} is wider than the screen`);
    assert.ok(view && box.y >= -1 && box.y + box.height <= view.height + 1, `${label} ${name} is outside the screen`);
  }
  const note = await page.getByText(NOTE).boundingBox();
  assert.ok(view && note && note.y >= -1 && note.y < view.height, `${label} note is outside the screen`);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(scroll <= 1, `${label} horizontal scroll ${scroll}`);
}

async function assertOfflinePage(page, label) {
  await page.getByRole("heading", { name: /Offline/ }).first().waitFor({ timeout: 20000 });
  await page.getByText("Nothing is on this device yet").waitFor({ timeout: 20000 });
  const body = await page.locator("body").innerText();
  assert.equal(body.includes(NOTE), false, `${label} still shows the note`);
  assert.equal(body.includes("Something went wrong"), false, label);
  assert.ok((await page.locator("header").count()) > 0, `${label} has no header`);
}

async function assertUncopiedReader(page, label) {
  await page.getByText(MISSING).waitFor({ timeout: 20000 });
  const body = await page.locator("body").innerText();
  assert.equal(body.includes(NOTE), false, label);
  assert.equal(body.includes("Something went wrong"), false, label);
  assert.ok((await page.locator("header").count()) > 0, `${label} has no header`);
  const books = page.getByRole("button", { name: "Books" });
  const box = await books.boundingBox();
  const view = page.viewportSize();
  assert.ok(box && box.height + 0.5 >= 44, `${label} Books is ${box ? box.height : 0}px`);
  assert.ok(view && box.x >= -1 && box.x + box.width <= view.width + 1, `${label} Books is wider than the screen`);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(scroll <= 1, `${label} horizontal scroll ${scroll}`);
}

async function copyJohn(page) {
  const copy = page.getByRole("button", { name: "Copy John" });
  const tongue = page.locator("[data-reading-tongue]");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await tongue.click();
    try {
      await copy.waitFor({ state: "visible", timeout: 4000 });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  await copy.click();
  await page.getByText("John is on this device in Español.").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Close", exact: true }).click();
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
      await openPath(page, `${server.url}/offline`);
      await assertOfflinePage(page, `${size.name} /offline`);
      assert.deepEqual(crashes, [], `${size.name} /offline ${crashes.join(" | ")}`);
      for (const path of NOTE_PATHS) {
        await openPath(page, `${server.url}${path}`);
        await assertShell(page, `${size.name} ${path}`);
        assert.deepEqual(crashes, [], `${size.name} ${path} ${crashes.join(" | ")}`);
      }
      await openPath(page, `${server.url}/read/luke/2`);
      await assertUncopiedReader(page, `${size.name} /read/luke/2`);
      assert.deepEqual(crashes, [], `${size.name} /read/luke/2 ${crashes.join(" | ")}`);
      await openPath(page, `${server.url}/study`);
      await page.getByRole("link", { name: "All books", exact: true }).click();
      await page.getByRole("link", { name: /Matthew/ }).first().waitFor({ timeout: 20000 });
      assert.deepEqual(crashes, [], `${size.name} home link ${crashes.join(" | ")}`);
      await openPath(page, `${server.url}/study`);
      await page.getByRole("link", { name: "Offline", exact: true }).click();
      await assertOfflinePage(page, `${size.name} offline link`);
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
    await copyJohn(page);
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

test("a copied chapter opens from its address while offline", { timeout: 180000, concurrency: false }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      serviceWorkers: "allow",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await seed(page, "es");
    await takeControl(page, `${server.url}/read/john/1`);
    await copyJohn(page);
    await context.setOffline(true);
    await openPath(page, `${server.url}/read/john/5`);
    await page.getByText(OPENING).waitFor({ timeout: 20000 });
    assert.ok((await page.locator("header").count()) > 0, "hard load has no header");
    assert.equal((await page.locator("body").innerText()).includes(NOTE), false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(OPENING).waitFor({ timeout: 20000 });
    assert.ok((await page.locator("header").count()) > 0, "reload has no header");
    assert.deepEqual(errors, [], errors.join(" | "));
    await openPath(page, `${server.url}/read/mark/1`);
    await page.getByText(MISSING).waitFor({ timeout: 20000 });
    assert.equal((await page.locator("body").innerText()).includes("Something went wrong"), false);
    assert.deepEqual(errors.filter((item) => /418|Minified React error|Something went wrong/i.test(item)), []);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the offline note follows the night theme", { timeout: 180000, concurrency: false }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const context = await browser.newContext({
      viewport: { width: 320, height: 568 },
      reducedMotion: "reduce",
      serviceWorkers: "allow",
    });
    const page = await context.newPage();
    await seed(page, "en", "night");
    await takeControl(page, `${server.url}/`);
    await context.setOffline(true);
    await openPath(page, `${server.url}/study`);
    await page.getByText(NOTE).waitFor({ timeout: 15000 });
    assert.equal(await paper(page), NIGHT);
    assert.ok((await page.locator("header").count()) > 0);
  } finally {
    await browser.close();
    await server.close();
  }
});
