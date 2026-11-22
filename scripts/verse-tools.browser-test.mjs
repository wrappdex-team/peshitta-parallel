// Reader verse action row: no "Words of Y'shua" label, one line at phone widths.
// Needs `npm run build:check`. Run with `npm run test:browser`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const WIDTHS = [360, 390, 412];

function seed(page, theme) {
  return page.addInitScript((stored) => {
    localStorage.setItem("peshitta-parallel", JSON.stringify(stored));
  }, { theme, lang: "en", face: "both", lang2: "none", intro: 1, words: false });
}

async function toolsState(page) {
  await page.locator("#v-20 .verse-tools").waitFor({ timeout: 45000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.getElementById("v-20")?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  await page.locator("#v-20 .verse-tools").waitFor({ timeout: 15000 });
  return page.evaluate(() => {
    const article = document.querySelector("#v-20");
    const tools = article?.querySelector(".verse-tools");
    if (!article || !tools) return { missing: true };
    const buttonTops = [...new Set([...tools.querySelectorAll("button")].map((el) => el.offsetTop))];
    return {
      text: (tools.innerText || "").replace(/\s+/g, " ").trim(),
      hasLabel: /Words of Y['’]shua/.test(tools.innerText || ""),
      jesus: article.querySelectorAll(".text-jesus").length,
      lines: buttonTops.length,
      buttons: [...tools.querySelectorAll("button")].map((b) => (b.innerText || "").trim()),
    };
  });
}

test("a red-letter verse action row has no Words of Y'shua label and stays on one line", async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  const pageErrors = [];
  try {
    for (const theme of ["day", "night"]) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({
          serviceWorkers: "block",
          viewport: { width, height: 844 },
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => pageErrors.push(`${theme} ${width} ${error}`));
        await seed(page, theme);
        await page.goto(`${server.url}/read/john/6#v-20`, { waitUntil: "domcontentloaded" });
        const info = await toolsState(page);
        assert.equal(info.missing, undefined, `${theme} ${width}: tools missing`);
        assert.equal(info.hasLabel, false, `${theme} ${width}: visible label still present: ${info.text}`);
        assert.ok(info.jesus > 0, `${theme} ${width}: red-letter colouring is gone`);
        assert.deepEqual(info.buttons, ["Mark", "Save", "Note", "Share", "Copy", "Link"]);
        assert.equal(info.lines, 1, `${theme} ${width}: action row wrapped (${info.lines} lines): ${info.text}`);
        await context.close();
      }
    }
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
