// First-run reading card against the local production build.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const NAME = "How would you like to read?";

function dialog(page) {
  return page.getByRole("dialog", { name: NAME });
}

async function openFresh(browser, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, page };
}

async function prefsOf(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("peshitta-parallel") || "null"));
}

async function verseFace(page) {
  return page.locator("#v-1").evaluate((verse) => {
    const syriac = [...verse.querySelectorAll("[lang='syr']")].filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.hidden || node.closest("[hidden]")) return false;
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    return {
      text: (verse.textContent ?? "").replace(/\s+/g, " ").trim(),
      syriac: syriac.length,
    };
  });
}

test("the server HTML keeps the verse and omits the first-run card", async () => {
  const server = await startBuiltServer();
  try {
    const html = await fetch(`${server.url}/read/john/1`).then((response) => response.text());
    assert.match(html, /In the beginning was the Word/);
    assert.doesNotMatch(html, /How would you like to read/);
  } finally {
    await server.close();
  }
});

test("a first visit can choose a layout, quick start, or leave", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const fresh = await openFresh(browser);
    await fresh.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    const card = dialog(fresh.page);
    await card.waitFor();
    const named = await card.evaluate((node) => ({
      role: node.getAttribute("role"),
      modal: node.getAttribute("aria-modal"),
      label: node.getAttribute("aria-label"),
      focused: node.contains(document.activeElement),
    }));
    assert.equal(named.role, "dialog");
    assert.equal(named.modal, "true");
    assert.equal(named.label, NAME);
    assert.equal(named.focused, true);

    const before = await fresh.page.evaluate(() => Object.keys(localStorage).sort());
    await card.getByRole("button", { name: "Quick start (English)" }).click();
    await card.waitFor({ state: "hidden" });
    const quick = await prefsOf(fresh.page);
    assert.equal(quick.face, "tr");
    assert.equal(quick.lang, "en");
    assert.equal(quick.intro, 1);
    const added = (await fresh.page.evaluate(() => Object.keys(localStorage).sort())).filter(
      (key) => !before.includes(key),
    );
    assert.deepEqual(added, ["peshitta-parallel"]);
    await fresh.page.waitForFunction(() => {
      const main = document.querySelector("main");
      return !!main && (main === document.activeElement || main.contains(document.activeElement));
    });

    await fresh.page.goto(`${server.url}/read/john/1`, { waitUntil: "networkidle" });
    await dialog(fresh.page).waitFor({ state: "hidden" });
    const english = await verseFace(fresh.page);
    assert.match(english.text, /In the beginning was the Word/);
    assert.equal(english.syriac, 0);
    await fresh.page.reload({ waitUntil: "networkidle" });
    await fresh.page.locator("#v-1").waitFor();
    assert.equal(await dialog(fresh.page).count(), 0);
    await fresh.context.close();

    const spanish = await openFresh(browser);
    await spanish.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    const choice = dialog(spanish.page);
    await choice.waitFor();
    await choice.getByRole("radio", { name: "Syriac side by side" }).check();
    await choice.getByRole("radio", { name: "Español" }).check();
    await choice.getByRole("button", { name: "Start reading" }).click();
    await choice.waitFor({ state: "hidden" });
    const chosen = await prefsOf(spanish.page);
    assert.equal(chosen.face, "both");
    assert.equal(chosen.lang, "es");
    assert.equal(chosen.intro, 1);
    await spanish.page.goto(`${server.url}/read/john/1`, { waitUntil: "networkidle" });
    const both = await verseFace(spanish.page);
    assert.match(both.text, /En el principio era la Palabra/);
    assert.doesNotMatch(both.text, /Elohim/);
    assert.ok(both.syriac > 0, "Syriac column is missing");
    await spanish.page.reload({ waitUntil: "networkidle" });
    await spanish.page.locator("#v-1").waitFor();
    assert.equal(await dialog(spanish.page).count(), 0);
    await spanish.context.close();

    const escape = await openFresh(browser);
    await escape.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await dialog(escape.page).waitFor();
    const keysBefore = await escape.page.evaluate(() => Object.keys(localStorage).sort());
    await escape.page.keyboard.press("Escape");
    await dialog(escape.page).waitFor({ state: "hidden" });
    const left = await prefsOf(escape.page);
    assert.equal(left.face, "tr");
    assert.equal(left.lang, "en");
    assert.equal(left.intro, 1);
    const keysAdded = (await escape.page.evaluate(() => Object.keys(localStorage).sort())).filter(
      (key) => !keysBefore.includes(key),
    );
    assert.deepEqual(keysAdded, ["peshitta-parallel"]);
    await escape.context.close();

    const returning = await openFresh(browser);
    await returning.page.addInitScript(() => {
      localStorage.setItem(
        "peshitta-parallel",
        JSON.stringify({ theme: "day", lang: "fr", face: "both", lang2: "none" }),
      );
    });
    await returning.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await returning.page.getByRole("link", { name: /Open John/ }).waitFor();
    assert.equal(await dialog(returning.page).count(), 0);
    await returning.context.close();
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});

const KNOWN_KEYS = [
  "peshitta-parallel",
  "injeel-annotations",
  "injeel-readings",
  "injeel-help",
  "injeel-declaration",
  "injeel-studio",
];

function isBlue(value) {
  return /rgb\(\s*0\s*,\s*117\s*,\s*255\s*\)/i.test(value) || String(value).toLowerCase() === "accentcolor";
}

test("the card stays up until the visitor answers", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const fresh = await openFresh(browser);
    await fresh.page.goto(`${server.url}/read/john/3`, { waitUntil: "networkidle" });
    await dialog(fresh.page).waitFor();
    await fresh.page.waitForTimeout(2000);
    const pending = await prefsOf(fresh.page);
    assert.equal(pending.intro, 0);
    assert.equal(pending.last.book, "john");
    assert.equal(pending.last.chapter, 3);
    const keys = await fresh.page.evaluate(() => Object.keys(localStorage).sort());
    assert.deepEqual(
      keys.filter((key) => !KNOWN_KEYS.includes(key)),
      [],
    );
    await fresh.page.reload({ waitUntil: "networkidle" });
    await dialog(fresh.page).waitFor();
    await fresh.page.goto(`${server.url}/`, { waitUntil: "networkidle" });
    await dialog(fresh.page).waitFor();
    assert.equal((await prefsOf(fresh.page)).intro, 0);
    await fresh.context.close();

    const both = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tabA = await both.newPage();
    const tabB = await both.newPage();
    tabA.setDefaultTimeout(15000);
    tabB.setDefaultTimeout(15000);
    await tabA.goto(`${server.url}/read/john/1`, { waitUntil: "networkidle" });
    await tabB.goto(`${server.url}/read/john/1`, { waitUntil: "networkidle" });
    await dialog(tabA).waitFor();
    await dialog(tabB).waitFor();
    await dialog(tabA).getByRole("button", { name: "Quick start (English)" }).click();
    await dialog(tabA).waitFor({ state: "hidden" });
    await dialog(tabB).waitFor({ state: "hidden" });
    await tabB.waitForTimeout(400);
    assert.equal(await dialog(tabB).count(), 0);
    const answered = await prefsOf(tabB);
    assert.equal(answered.face, "tr");
    assert.equal(answered.lang, "en");
    assert.equal(answered.intro, 1);
    await both.close();
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});

test("the buttons stay on screen and the card is centred", { timeout: 180000 }, async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
      { width: 206, height: 457 },
    ]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto(`${server.url}/`, { waitUntil: "networkidle" });
      const card = dialog(page);
      await card.waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      const label = `${viewport.width}×${viewport.height}`;
      const motion = await card.locator("> div").evaluate((node) => getComputedStyle(node).animationName);
      assert.equal(motion, "none", `${label} still animates`);
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      assert.ok(scroll <= 1, `${label} horizontal scroll ${scroll}`);

      for (const name of ["Start reading", "Quick start (English)"]) {
        const hit = await card.getByRole("button", { name }).evaluate((node, boxLimit) => {
          const rect = node.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const top = document.elementFromPoint(cx, cy);
          return {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            hit: top === node || (!!top && node.contains(top)),
            limitW: boxLimit.width,
            limitH: boxLimit.height,
          };
        }, viewport);
        assert.ok(hit.width + 0.5 >= 44 && hit.height + 0.5 >= 44, `${label} ${name} is ${hit.width}×${hit.height}`);
        assert.ok(hit.left >= -1 && hit.top >= -1, `${label} ${name} starts off screen`);
        assert.ok(hit.right <= viewport.width + 1 && hit.bottom <= viewport.height + 1, `${label} ${name} ends off screen`);
        assert.equal(hit.hit, true, `${label} ${name} is covered`);
      }

      const layout = await page.locator("[data-first-run-card]").evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const langs = node.querySelector(".first-run-langs");
        const row = node.querySelector(".first-run-langs label");
        const columns = langs ? getComputedStyle(langs).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
        return {
          width: rect.width,
          height: rect.height,
          center: rect.left + rect.width / 2,
          columns,
          row: row ? row.getBoundingClientRect().height : 0,
        };
      });
      const title = await card.getByRole("heading", { name: NAME }).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      });
      assert.ok(title.top >= -1 && title.bottom <= viewport.height + 1, `${label} title is off screen (${title.top}, ${title.bottom})`);
      const pageChoice = await card.getByRole("radio", { name: "One language only" }).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: rect.height };
      });
      assert.ok(pageChoice.height + 0.5 >= 44, `${label} page row is ${pageChoice.height}`);
      assert.ok(pageChoice.top >= -1 && pageChoice.bottom <= viewport.height + 1, `${label} page row is off screen`);
      const arabic = await card.getByRole("radio", { name: "العربية" }).evaluate((input) => {
        const name = input.closest("label")?.querySelector("[lang]");
        return { lang: name?.getAttribute("lang") ?? "", dir: name?.getAttribute("dir") ?? "" };
      });
      assert.equal(arabic.lang, "ar", label);
      assert.equal(arabic.dir, "rtl", label);
      assert.ok(layout.row + 0.5 >= 44, `${label} language row is ${layout.row}`);
      if (layout.width >= 360) assert.equal(layout.columns, 2, `${label} columns ${layout.columns}`);
      else assert.equal(layout.columns, 1, `${label} columns ${layout.columns}`);

      if (viewport.width === 1280) {
        assert.ok(Math.abs(layout.center - viewport.width / 2) <= 8, `${label} centre ${layout.center}`);
        assert.ok(layout.height < viewport.height, `${label} card height ${layout.height}`);
        const selected = await card.getByRole("radio", { name: "One language only" }).evaluate((input) => {
          const row = input.closest("label");
          const rowStyle = row ? getComputedStyle(row) : null;
          const inputStyle = getComputedStyle(input);
          return {
            color: rowStyle ? rowStyle.color : "",
            background: rowStyle ? rowStyle.backgroundColor : "",
            accent: inputStyle.accentColor,
            shadow: rowStyle ? rowStyle.boxShadow : "",
          };
        });
        assert.equal(isBlue(selected.color), false, selected.color);
        assert.equal(isBlue(selected.background), false, selected.background);
        assert.equal(isBlue(selected.accent), false, selected.accent);
        const focus = await page.evaluate(() => {
          const el = document.activeElement;
          const row = el instanceof HTMLElement ? el.closest("label") : null;
          if (!row) return { ok: false, shadow: "", tag: el ? el.tagName : "" };
          const shadow = getComputedStyle(row).boxShadow;
          return { ok: shadow !== "none" && shadow !== "", shadow, tag: el.tagName };
        });
        assert.equal(focus.ok, true, `${label} focus ${focus.tag} ${focus.shadow}`);
        assert.equal(isBlue(focus.shadow), false, focus.shadow);
      }
      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
});
