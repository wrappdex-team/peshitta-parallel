// Home interaction system against the local production build.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

// Home script transfer on main 0fdc48d was 1,440,788 bytes. The cap is main + 6 KB.
const HOME_JS_CAP = 1_440_788 + 6 * 1024;
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

async function assertStill(page, label) {
  const y = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(y - 200) < 1, `${label} scrollY ${y}`);
}

async function touchDrag(page, x, from, to) {
  const client = await page.context().newCDPSession(page);
  const steps = 6;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from, id: 0 }] });
  for (let step = 1; step <= steps; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: from + ((to - from) * step) / steps, id: 0 }],
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
}

async function assertScrollLock(page, width, touch) {
  await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForFunction(() => Math.abs(window.scrollY - 200) < 1);
  const books = page.getByRole("button", { name: "Books" });
  const before = width === 1280 ? (await books.boundingBox())?.x : null;
  await books.click();
  const dialog = page.getByRole("dialog", { name: "New Testament" });
  await dialog.waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("modal-scroll-lock")), true, "Books did not lock the page");
  const list = dialog.locator(".book-drawer");
  await page.waitForFunction(() => (document.querySelector(".book-drawer")?.getBoundingClientRect().x ?? -1) >= -1);
  await page.mouse.move(width - 16, 360);
  await page.mouse.wheel(0, 600);
  await assertStill(page, `${width} scrim wheel`);
  const zoom = await page.evaluate(() => {
    const open = document.querySelector("dialog[open]");
    const event = new WheelEvent("wheel", { deltaY: 100, ctrlKey: true, cancelable: true, bubbles: true });
    open.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(zoom, false, `${width} zoom wheel was cancelled`);
  if (touch) {
    await touchDrag(page, width - 16, 520, 220);
    await assertStill(page, `${width} scrim touch`);
  }
  const listBox = await list.boundingBox();
  assert.ok(listBox && listBox.x >= -1, "drawer list has no box");
  const top = await list.evaluate((node) => node.scrollTop);
  await page.mouse.move(listBox.x + 48, Math.min(listBox.y + 280, listBox.y + listBox.height - 24));
  await page.mouse.wheel(0, 480);
  const next = await list.evaluate((node) => node.scrollTop);
  assert.ok(next > top, `${width} drawer list did not scroll (${top} -> ${next})`);
  await assertStill(page, `${width} drawer wheel`);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await assertStill(page, `${width} close`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Books");
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("modal-scroll-lock")), false);
  if (before != null) {
    const after = (await books.boundingBox())?.x;
    assert.ok(after != null && Math.abs(after - before) < 1, `header shifted ${before} -> ${after}`);
  }

  await page.evaluate(() => window.scrollTo(0, 200));
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search the New Testament" });
  await search.waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("modal-scroll-lock")), true);
  await page.mouse.move(Math.min(200, width - 16), width === 1280 ? 700 : 760);
  await page.mouse.wheel(0, 600);
  await assertStill(page, `${width} search scrim wheel`);
  await page.keyboard.press("Escape");
  await search.waitFor({ state: "hidden" });
  await assertStill(page, `${width} search close`);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("modal-scroll-lock")), false);
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

async function titleLineStarts(page) {
  return page.evaluate(() => {
    const name = document.querySelector(".continue-card [data-book-name]");
    const lines = [];
    const walker = document.createTreeWalker(name, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest(".sr-only") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let current = null;
    while (walker.nextNode()) {
      const value = walker.currentNode.textContent || "";
      for (let index = 0; index < value.length; index += 1) {
        const range = document.createRange();
        range.setStart(walker.currentNode, index);
        range.setEnd(walker.currentNode, index + 1);
        const rect = range.getClientRects()[0];
        if (!rect || rect.width < 0.2) continue;
        const ch = value[index];
        if (!ch.trim()) continue;
        if (!current || Math.abs(current.top - rect.top) > 3) {
          current = { top: rect.top, first: ch };
          lines.push(current);
        }
      }
    }
    return lines.map((line) => line.first);
  });
}

async function assertTitleLines(page) {
  for (const width of [206, 320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
    const starts = await titleLineStarts(page);
    assert.ok(starts.length > 0, `${width} title had no lines`);
    for (const first of starts) assert.notEqual(first, "·", `${width} title line starts with a dot ${JSON.stringify(starts)}`);
    if (width === 1280) assert.equal(starts.length, 1, `${width} title lines ${JSON.stringify(starts)}`);
  }
}

async function assertKeyboard(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => document.body.focus());
  await page.evaluate(() => {
    const marker = document.createElement("button");
    document.body.prepend(marker);
    marker.focus();
    marker.remove();
  });
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => {
    const el = document.activeElement;
    const box = el.getBoundingClientRect();
    return { text: (el.textContent || "").replace(/\s+/g, " ").trim(), top: box.top, height: box.height };
  });
  assert.equal(skip.text, "Skip to books");
  assert.ok(skip.top >= -1 && skip.top < 140 && skip.height > 8, `skip link hidden ${JSON.stringify(skip)}`);
  await page.keyboard.press("Enter");
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""), /^Matthew/);

  await page.keyboard.press("/");
  const search = page.getByRole("dialog", { name: "Search the New Testament" });
  await search.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Search words or a reference");
  await page.keyboard.type("/");
  assert.equal(await search.locator("input[type='search']").inputValue(), "/");
  await page.keyboard.press("Escape");
  await search.waitFor({ state: "hidden" });

  await page.keyboard.press("Control+k");
  await search.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Search words or a reference");
  await page.keyboard.press("Escape");
  await search.waitFor({ state: "hidden" });
  assert.match(await page.getByRole("button", { name: "Search", exact: true }).getAttribute("aria-keyshortcuts") || "", /Control\+K/);

  await page.getByRole("button", { name: "Books" }).click();
  const books = page.getByRole("dialog", { name: "New Testament" });
  await books.waitFor();
  await page.keyboard.press("/");
  assert.equal(await page.getByRole("dialog", { name: "Search the New Testament" }).count(), 0);
  await page.keyboard.press("Escape");
  await books.waitFor({ state: "hidden" });
}

async function infoLineAverage(page) {
  return page.evaluate(() => {
    const body = document.querySelector(".help-sheet-body p");
    const lines = [];
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let current = null;
    while (walker.nextNode()) {
      const value = walker.currentNode.textContent || "";
      for (let index = 0; index < value.length; index += 1) {
        const range = document.createRange();
        range.setStart(walker.currentNode, index);
        range.setEnd(walker.currentNode, index + 1);
        const rect = range.getClientRects()[0];
        if (!rect || rect.width < 0.2) continue;
        if (!value[index].trim()) continue;
        if (!current || Math.abs(current.top - rect.top) > 3) {
          current = { top: rect.top, count: 0 };
          lines.push(current);
        }
        current.count += 1;
      }
    }
    return lines.reduce((sum, line) => sum + line.count, 0) / lines.length;
  });
}

async function assertInfoSheet(page, width, height, touch) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForFunction(() => Math.abs(window.scrollY - 200) < 1);
  await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="About Injeel"]');
    button.focus({ preventScroll: true });
    button.click();
  });
  const sheet = page.locator(".help-sheet");
  await sheet.waitFor();
  const box = await sheet.boundingBox();
  const view = page.viewportSize();
  assert.ok(box && view, "info sheet has no box");
  if (width < 640) {
    assert.ok(box.width >= view.width - 2, `${width} info width ${box.width}`);
    assert.ok(box.height >= view.height - 2, `${width} info height ${box.height}`);
  } else {
    assert.ok(box.width >= 560, `wide info width ${box.width}`);
    assert.ok(Math.abs(box.x + box.width / 2 - view.width / 2) <= 16, `info not centred ${box.x}`);
  }
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(scroll <= 1, `${width} info horizontal scroll ${scroll}`);
  if (width === 390) assert.ok((await infoLineAverage(page)) >= 25, "info lines are too short");
  if (width === 390) {
    const ring = await page.evaluate(() => {
      const sheet = document.querySelector(".help-sheet");
      const close = sheet.querySelector(".help-sheet-bar button");
      close.focus({ focusVisible: true });
      const style = getComputedStyle(close);
      const closeBox = close.getBoundingClientRect();
      const sheetBox = sheet.getBoundingClientRect();
      const offset = parseFloat(style.outlineOffset) || 0;
      const widthPx = parseFloat(style.outlineWidth) || 0;
      return {
        visible: close.matches(":focus-visible"),
        room: closeBox.top - (offset + widthPx) - sheetBox.top,
      };
    });
    assert.equal(ring.visible, true, "Close is not showing its ring");
    assert.ok(ring.room >= 0, `Close ring clipped ${JSON.stringify(ring)}`);
  }
  await page.mouse.move(Math.min(width - 20, 180), Math.min(height - 40, 360));
  await page.mouse.wheel(0, 600);
  await assertStill(page, `${width} info wheel`);
  if (touch) {
    await touchDrag(page, Math.min(70, width / 2), Math.min(520, height - 30), Math.min(240, height / 2));
    await assertStill(page, `${width} info touch`);
  }
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "hidden" });
  await assertStill(page, `${width} info escape`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "About Injeel");
  await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="About Injeel"]');
    button.focus({ preventScroll: true });
    button.click();
  });
  await sheet.waitFor();
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet.waitFor({ state: "hidden" });
  await assertStill(page, `${width} info close`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "About Injeel");
}

async function assertMarkTap(page) {
  for (const width of [206, 220, 230]) {
    await page.setViewportSize({ width, height: 520 });
    const hit = await page.evaluate(() => {
      const button = document.querySelector('button[aria-label="About Injeel"]');
      const box = button.getBoundingClientRect();
      const points = [
        [box.left + box.width / 2, box.top + box.height / 2],
        [box.right - 1, box.top + box.height / 2],
      ];
      const hits = points.map(([x, y]) => {
        const node = document.elementFromPoint(x, y);
        return node === button || button.contains(node);
      });
      const sy = document.querySelector(".home-mark")?.getBoundingClientRect();
      const overlap = Boolean(
        sy && box.left < sy.right - 0.5 && box.right > sy.left + 0.5 && box.top < sy.bottom - 0.5 && box.bottom > sy.top + 0.5,
      );
      return { hits, overlap };
    });
    assert.deepEqual(hit.hits, [true, true], `${width} (i) tap ${JSON.stringify(hit)}`);
    assert.equal(hit.overlap, false, `${width} Syriac covers the (i)`);
  }
  for (const width of [240, 320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 700 });
    const row = await page.evaluate(() => {
      const title = document.querySelector("main h1").getBoundingClientRect();
      const sy = document.querySelector(".home-mark").getBoundingClientRect();
      return title.bottom > sy.top + 2 && sy.bottom > title.top + 2;
    });
    assert.equal(row, true, `${width} title and Syriac are not one row`);
  }
}

async function assertBookSheet(page, theme) {
  if (theme === "night") {
    await page.getByRole("button", { name: "Night theme" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "night");
  }
  for (const width of [360, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Books" }).click();
    const dialog = page.getByRole("dialog", { name: "New Testament" });
    await dialog.waitFor();
    const report = await page.evaluate(() => {
      const sheet = document.querySelector(".book-drawer");
      const style = getComputedStyle(sheet);
      const sheetBox = sheet.getBoundingClientRect();
      const padL = parseFloat(style.paddingLeft);
      const padR = parseFloat(style.paddingRight);
      const current = sheet.querySelector("[aria-current='true']");
      const name = current.querySelector("[data-book-name]").getBoundingClientRect();
      const before = getComputedStyle(current, "::before");
      const barRight = current.getBoundingClientRect().left + (parseFloat(before.left) || 0) + (parseFloat(before.width) || 0);
      const heights = [...sheet.querySelectorAll("a.ink-row")].slice(0, 7).map((row) => row.getBoundingClientRect().height);
      const dividerPast = [...sheet.querySelectorAll("a.ink-row")].some((row) => row.getBoundingClientRect().right > sheetBox.right - padR + 1);
      const visible = [...sheet.querySelectorAll("a[href*='/read/']")].filter((link) => {
        const box = link.getBoundingClientRect();
        return box.height > 20 && box.top >= sheetBox.top - 1 && box.bottom <= sheetBox.bottom + 1;
      }).length;
      return {
        padL,
        textFromSheet: name.left - sheetBox.left,
        textFromBar: name.left - barRight,
        heights,
        dividerPast,
        visible,
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.ok(report.padL >= 16, `${theme} ${width} padding ${report.padL}`);
    assert.ok(report.textFromSheet >= 16, `${theme} ${width} text inset ${report.textFromSheet}`);
    assert.ok(report.textFromBar >= 8, `${theme} ${width} bar gap ${report.textFromBar}`);
    assert.equal(report.dividerPast, false, `${theme} ${width} divider escapes`);
    for (const height of report.heights) assert.ok(height <= 64, `${theme} ${width} row ${height}`);
    assert.ok(report.visible >= 7, `${theme} ${width} visible books ${report.visible}`);
    assert.ok(report.scroll <= 1, `${theme} ${width} horizontal scroll`);
    const close = dialog.getByRole("button", { name: "Close" });
    await dialog.locator(".book-drawer").evaluate((node) => {
      node.scrollTop = 480;
    });
    const parked = await close.boundingBox();
    assert.ok(parked && parked.y >= -1 && parked.y < 80 && parked.height >= 40, `${theme} ${width} header left ${JSON.stringify(parked)}`);
    if (width === 390 && theme === "day") {
      await close.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Books");
  }
  if (theme === "night") {
    await page.getByRole("button", { name: "Day theme" }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "day");
  }
}

test("the home page keeps a manuscript interaction system", { timeout: 240000 }, async () => {
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
    await assertTitleLines(page);
    await assertKeyboard(page);
    await assertMarkTap(page);

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
    await assertScrollLock(page, 1280, false);
    await assertInfoSheet(page, 1280, 800, false);
    await assertInfoSheet(page, 360, 800, false);
    await assertInfoSheet(page, 412, 915, false);
    await assertInfoSheet(page, 206, 457, false);
    await assertBookSheet(page, "day");
    await assertBookSheet(page, "night");

    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    const touchPage = await phone.newPage();
    touchPage.setDefaultTimeout(15000);
    await seed(touchPage, basePrefs({ last: { book: "mark", chapter: 4, verse: 12 } }));
    await touchPage.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await touchPage.locator(".continue-card").getByText("verse 12 of 41").waitFor();
    await assertScrollLock(touchPage, 390, true);
    await assertInfoSheet(touchPage, 390, 844, true);
    await phone.close();

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
