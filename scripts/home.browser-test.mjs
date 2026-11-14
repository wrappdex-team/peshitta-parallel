// Home interaction system against the local production build.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

// Home script transfer on origin/main edd6bfc was 1,430,820 bytes.
// This branch measured 1,439,024 (8,204 more). The cap is main + 12 KB.
const HOME_JS_CAP = 1_430_820 + 12 * 1024;
const SIZES = [
  { width: 390, height: 844, columns: 2 },
  { width: 206, height: 457, columns: 2 },
  { width: 834, height: 1112, columns: 3 },
  { width: 320, height: 568, columns: 2 },
  { width: 1280, height: 800, columns: 6 },
];

function seed(page, prefs) {
  return page.addInitScript((stored) => {
    localStorage.setItem("peshitta-parallel", JSON.stringify(stored));
    window.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          const hit = (entry.sources || []).some((source) => {
            const node = source.node;
            return node instanceof Element && !!node.closest(".continue-slot, .continue-card");
          });
          if (hit) window.__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      /* layout-shift is unavailable */
    }
  }, prefs);
}

function basePrefs(extra = {}) {
  return { theme: "day", lang: "en", face: "tr", lang2: "none", intro: 1, ...extra };
}

async function garnet(page) {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--garnet)";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

async function contrast(page) {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--gold)";
    probe.style.backgroundColor = "var(--paper)";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const read = (value) => value.match(/\d+/g).map(Number).slice(0, 3).map((channel) => {
      const unit = channel / 255;
      return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    });
    const lum = (channels) => 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    const gold = lum(read(style.color));
    const paper = lum(read(style.backgroundColor));
    probe.remove();
    const [hi, lo] = gold > paper ? [gold, paper] : [paper, gold];
    return (hi + 0.05) / (lo + 0.05);
  });
}

async function paint(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { bg: style.backgroundColor, deco: style.textDecorationLine, shadow: style.boxShadow };
  });
}

async function changesOnHover(locator, label) {
  const before = await paint(locator);
  await locator.hover();
  await locator.page().waitForTimeout(200);
  const after = await paint(locator);
  assert.ok(
    before.bg !== after.bg || before.deco !== after.deco || before.shadow !== after.shadow,
    `${label} did not change on hover ${JSON.stringify({ before, after })}`,
  );
}

async function press(page, locator, reduced) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element) => {
    element.dataset.pressProbe = "1";
  });
  const box = await locator.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + 8 < 800, `control is off screen ${JSON.stringify(box)}`);
  await page.mouse.move(box.x + Math.min(24, box.width / 2), box.y + Math.min(24, box.height / 2));
  await page.mouse.down();
  await page.waitForTimeout(120);
  const style = await page.evaluate(() => {
    const target = document.querySelector("[data-press-probe]");
    const computed = getComputedStyle(target);
    const result = {
      transform: computed.transform,
      duration: computed.transitionDuration,
      pressed: target.getAttribute("data-pressed") || "",
      active: target.matches(":active"),
    };
    delete target.dataset.pressProbe;
    return result;
  });
  await page.mouse.move(1, 1);
  await page.mouse.up();
  if (reduced) {
    assert.equal(style.transform, "none", `reduced transform ${style.transform}`);
    assert.ok(style.duration.split(",").every((part) => part.trim() === "0s"), `reduced duration ${style.duration}`);
  } else {
    assert.notEqual(style.transform, "none", `press transform stayed ${style.transform} ${JSON.stringify(style)}`);
  }
}

async function tabStops(page, count) {
  await page.evaluate(() => {
    const marker = document.createElement("button");
    document.body.prepend(marker);
    marker.focus();
    marker.remove();
  });
  const ring = await garnet(page);
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press("Tab");
    const style = await page.evaluate(() => {
      const element = document.activeElement;
      const computed = getComputedStyle(element);
      return {
        label: element?.getAttribute?.("aria-label") || element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 60),
        outlineStyle: computed.outlineStyle,
        outlineWidth: computed.outlineWidth,
        outlineColor: computed.outlineColor,
      };
    });
    assert.equal(style.outlineStyle, "solid", `stop ${index + 1} ${JSON.stringify(style)}`);
    assert.equal(style.outlineWidth, "2px", `stop ${index + 1} ${JSON.stringify(style)}`);
    assert.equal(style.outlineColor, ring, `stop ${index + 1} ${JSON.stringify(style)} garnet ${ring}`);
  }
}

async function layout(page, size) {
  await page.setViewportSize({ width: size.width, height: size.height });
  const report = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll("[data-study] .ink-row")];
    const rows = [...document.querySelectorAll("main section .ink-row")];
    const columns = getComputedStyle(document.querySelector("[data-study]")).gridTemplateColumns.split(" ").filter(Boolean).length;
    return {
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns,
      tiles: tiles.map((tile) => tile.getBoundingClientRect().height),
      rows: rows.map((row) => row.getBoundingClientRect().height),
    };
  });
  assert.ok(report.scroll <= 1, `${size.width} horizontal scroll ${report.scroll}`);
  assert.equal(report.columns, size.columns, `${size.width} columns`);
  assert.equal(report.tiles.length, 6, `${size.width} tiles`);
  for (const height of report.tiles) assert.ok(height + 0.5 >= 48, `${size.width} tile ${height}`);
  for (const height of report.rows) assert.ok(height + 0.5 >= 44, `${size.width} row ${height}`);
}

test("the home page keeps a manuscript interaction system", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await seed(page, basePrefs({ last: { book: "mark", chapter: 4, verse: 12 } }));
    await page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    const card = page.locator(".continue-card");
    await card.getByText("verse 12 of 41").waitFor();
    await page.waitForTimeout(400);
    const cls = await page.evaluate(() => window.__cls ?? 0);
    assert.ok(cls < 0.05, `continue card CLS ${cls}`);
    await card.getByText("Mark", { exact: true }).waitFor();
    await card.getByText("4:12", { exact: true }).waitFor();
    assert.equal(await card.getByRole("progressbar").getAttribute("aria-valuenow"), "29");
    assert.match(await card.getAttribute("aria-label"), /Continue Mark/);

    for (const size of SIZES) await layout(page, size);
    assert.ok(await contrast(page) >= 4.5, "day gold contrast");

    await page.setViewportSize({ width: 1280, height: 800 });
    const study = page.locator("[data-study]");
    await changesOnHover(card, "Continue");
    await changesOnHover(study.getByRole("link", { name: /Saved/ }), "tile");
    await changesOnHover(page.getByRole("link", { name: /Matthew/ }).first(), "book row");
    await changesOnHover(page.getByRole("link", { name: "About this Injeel" }), "footer");
    await changesOnHover(page.getByRole("button", { name: "Search", exact: true }), "Search icon");

    await press(page, card, false);
    await press(page, study.getByRole("button", { name: /Search/ }), false);

    await tabStops(page, 12);
    await page.getByRole("button", { name: "Night theme" }).click();
    assert.equal(
      await page.getByRole("button", { name: "Day theme" }).evaluate((element) => getComputedStyle(element).outlineStyle),
      "none",
    );
    await page.waitForFunction(() => document.documentElement.dataset.theme === "night");
    assert.ok(await contrast(page) >= 4.5, "night gold contrast");
    for (const size of SIZES) await layout(page, size);
    await tabStops(page, 12);
    await page.getByRole("button", { name: "Day theme" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "day");

    await page.setViewportSize({ width: 1280, height: 800 });
    const books = page.getByRole("button", { name: "Books" });
    await books.click();
    const dialog = page.getByRole("dialog", { name: "New Testament" });
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute("aria-modal"), "true");
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true);
    const current = dialog.locator("[aria-current='true']");
    assert.equal(await current.count(), 1);
    assert.match(await current.getAttribute("aria-label"), /Mark/);
    for (let index = 0; index < 40; index += 1) await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true, "Tab left the dialog");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Books");

    await books.click();
    await dialog.waitFor();
    await page.mouse.click(700, 240);
    await dialog.waitFor({ state: "hidden" });

    const bytes = await page.evaluate(() =>
      performance.getEntriesByType("resource")
        .filter((entry) => /\.m?js(\?|$)/.test(new URL(entry.name).pathname))
        .reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0),
    );
    console.log(`home js bytes ${bytes}`);
    assert.ok(bytes > 0, "home JS was not measured");
    assert.ok(bytes <= HOME_JS_CAP, `home JS ${bytes} exceeds ${HOME_JS_CAP}`);
    await context.close();

    const plain = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const freshCard = await plain.newPage();
    await seed(freshCard, basePrefs());
    await freshCard.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await freshCard.getByText("Begin with John").waitFor();
    assert.match(await freshCard.locator(".continue-card").getAttribute("aria-label"), /Open John/);
    await plain.close();

    const visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const first = await visitor.newPage();
    await first.goto(`${server.url}/`, { waitUntil: "networkidle" });
    const intro = first.getByRole("dialog", { name: "How would you like to read?" });
    await intro.waitFor();
    const quick = intro.getByRole("button", { name: "Quick start (English)" });
    const box = await quick.boundingBox();
    const view = first.viewportSize();
    assert.ok(box && view && box.y >= -1 && box.y + box.height <= view.height + 1, "Quick start is off screen");
    const behind = await first.evaluate(() => {
      const tile = document.querySelector("[data-study] button, [data-study] a");
      if (tile instanceof HTMLElement) tile.focus();
      return document.querySelector("[data-study]")?.contains(document.activeElement) ?? false;
    });
    assert.equal(behind, false, "a tile behind the first-run card took focus");
    await visitor.close();

    const quiet = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
      serviceWorkers: "block",
    });
    const still = await quiet.newPage();
    await seed(still, basePrefs({ last: { book: "mark", chapter: 4, verse: 12 } }));
    await still.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await still.locator(".continue-card").waitFor();
    await press(still, still.locator(".continue-card"), true);
    await press(still, still.locator("[data-study]").getByRole("link", { name: /Saved/ }), true);
    await quiet.close();

    const offline = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const copy = await offline.newPage();
    copy.setDefaultTimeout(20000);
    await seed(copy, basePrefs());
    await copy.goto(`${server.url}/`, { waitUntil: "domcontentloaded" });
    await copy.getByText("Nothing on this device yet").waitFor();
    await copy.goto(`${server.url}/read/john/1`, { waitUntil: "domcontentloaded" });
    const copyJohn = copy.getByRole("button", { name: "Copy John" });
    const tongue = copy.locator("[data-reading-tongue]");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await tongue.click();
      try {
        await copyJohn.waitFor({ state: "visible", timeout: 4000 });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    await copyJohn.click();
    await copy.getByText("John is on this device in English.").waitFor({ timeout: 30000 });
    await copy.getByRole("button", { name: "Close", exact: true }).click();
    await copy.goto(`${server.url}/`, { waitUntil: "domcontentloaded" });
    await copy.getByText("1 book on this device").waitFor();
    await offline.close();
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});
