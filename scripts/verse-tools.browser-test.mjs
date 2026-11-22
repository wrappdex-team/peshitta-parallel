// Reader verse action row: no "Words of Y'shua" label, Studio feather only when
// Studio is on, and one line at phone widths. Needs `npm run build:check`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const WIDTHS = [360, 390, 412];

function seed(page, { theme, studio = false }) {
  return page.addInitScript((stored) => {
    localStorage.setItem("peshitta-parallel", JSON.stringify(stored.prefs));
    if (stored.studio) localStorage.setItem("injeel-studio", JSON.stringify({ enabled: true }));
  }, { prefs: { theme, lang: "en", face: "both", lang2: "none", intro: 1, words: false }, studio });
}

async function toolsState(page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.locator("#v-20 .verse-tools").waitFor({ timeout: 45000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.getElementById("v-20")?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
    const article = document.querySelector("#v-20");
    const tools = article?.querySelector(".verse-tools");
    if (!article || !tools) return { missing: true };
    const buttonTops = [...new Set([...tools.querySelectorAll("button")].map((el) => el.offsetTop))];
    return {
      text: (tools.innerText || "").replace(/\s+/g, " ").trim(),
      hasLabel: /Words of Y['’]shua/.test(tools.innerText || ""),
      jesus: article.querySelectorAll(".text-jesus").length,
      lines: buttonTops.length,
      buttons: [...tools.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.innerText || "").trim()),
      labels: [...tools.querySelectorAll("button")].map((b) => (b.innerText || "").trim()),
      featherInRow: Boolean(tools.querySelector(".studio-mark")),
      featherBesideVerse: [...article.querySelectorAll(".studio-mark")].some((el) => !el.closest(".verse-tools")),
      openStudio: (tools.querySelector(".studio-mark")?.getAttribute("aria-label") || ""),
    };
    });
    if (!info.missing) return info;
    await page.waitForTimeout(250);
  }
  return { missing: true };
}

async function measure(browser, server, { theme, width, studio }) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width, height: 844 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(`${theme} ${width} studio=${studio} ${error}`));
  await seed(page, { theme, studio });
  await page.goto(`${server.url}/read/john/6#v-20`, { waitUntil: "domcontentloaded" });
  const info = await toolsState(page);
  await context.close();
  return { info, pageErrors };
}

test("a red-letter verse action row has no Words of Y'shua label and stays on one line", async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  const pageErrors = [];
  try {
    for (const studio of [false, true]) {
      for (const theme of ["day", "night"]) {
        for (const width of WIDTHS) {
          const { info, pageErrors: errors } = await measure(browser, server, { theme, width, studio });
          pageErrors.push(...errors);
          const where = `${theme} ${width} studio=${studio}`;
          assert.equal(info.missing, undefined, `${where}: tools missing`);
          assert.equal(info.hasLabel, false, `${where}: visible label still present: ${info.text}`);
          assert.ok(info.jesus > 0, `${where}: red-letter colouring is gone`);
          assert.equal(info.lines, 1, `${where}: action row wrapped (${info.lines} lines): ${info.text}`);
          assert.equal(info.featherBesideVerse, false, `${where}: feather still sits beside the verse`);
          if (studio) {
            assert.equal(info.featherInRow, true, `${where}: feather missing from the action row`);
            assert.equal(info.openStudio, "Open in AI Studio");
            assert.deepEqual(info.buttons, ["Mark", "Bookmark", "Note", "Open in AI Studio", "Share", "Copy", "Link"]);
          } else {
            assert.equal(info.featherInRow, false, `${where}: feather shown while Studio is off`);
            assert.deepEqual(info.labels, ["Mark", "Save", "Note", "Share", "Copy", "Link"]);
          }
        }
      }
    }
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
