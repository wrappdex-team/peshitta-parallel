// Cycle 024: root-language sources (W-145) and the print study sheet (U8).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const NAMES = JSON.parse(readFileSync(new URL("../src/data/names.json", import.meta.url), "utf8")).names;
const byId = Object.fromEntries(NAMES.map((row) => [row.id, row]));
const OPEN = ["junia", "corinth", "clement", "crete", "boaz"];

function seed(page, theme) {
  return page.addInitScript((stored) => {
    localStorage.setItem("peshitta-parallel", JSON.stringify(stored));
  }, { theme, lang: "en", face: "both", lang2: "none", intro: 1 });
}

async function ready(page) {
  await page.waitForFunction(() => typeof window.__setReadingLive === "function", undefined, { timeout: 45000 });
}

function light(color) {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  assert.ok(match, color);
  return Number(match[1]) + Number(match[2]) + Number(match[3]) > 500;
}

test("sources stay out of the route bundle until opened, and the sheet prints", async () => {
  const server = await startBuiltServer();
  const browser = await chromium.launch();
  const pageErrors = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await seed(page, "day");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.url}/names`, { waitUntil: "domcontentloaded" });
    await ready(page);

    const domBefore = await page.evaluate(() => document.querySelectorAll("*").length);
    console.log(`names dom before sources ${domBefore}`);
    assert.ok(domBefore <= 9000, `DOM ${domBefore}`);
    assert.equal(await page.locator("#keefa [data-name-source]").count(), 1);
    assert.equal(await page.locator("#yochanan [data-name-source]").count(), 0);
    assert.equal(await page.locator("[data-name-source-text]").count(), 0);

    const earlyJs = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => /\.m?js(\?|$)/.test(new URL(entry.name).pathname) && new URL(entry.name).origin === location.origin)
        .map((entry) => entry.name),
    );
    let earlyGzip = 0;
    let leaked = false;
    for (const url of earlyJs) {
      const body = Buffer.from(await (await fetch(url)).arrayBuffer());
      earlyGzip += gzipSync(body).length;
      if (body.includes("belonging to Juno")) leaked = true;
    }
    console.log(`names js gzip before sources ${earlyGzip}`);
    assert.equal(leaked, false, "root source text is in the names route JS");
    assert.ok(earlyGzip <= 442_724, `names JS gzip ${earlyGzip} did not stay at or under main (442724)`);

    for (const theme of ["day", "night"]) {
      await page.evaluate((want) => {
        const raw = JSON.parse(localStorage.getItem("peshitta-parallel") || "{}");
        localStorage.setItem("peshitta-parallel", JSON.stringify({ ...raw, theme: want }));
        document.documentElement.dataset.theme = want;
      }, theme);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
        for (const id of ["junia", "corinth"]) {
          const card = page.locator(`#${id}`);
          await card.scrollIntoViewIfNeeded();
          const button = card.locator("[data-name-source]");
          await button.waitFor();
          const box = await button.boundingBox();
          assert.ok(box && box.height >= 44 && box.width >= 44, `${id} source target ${JSON.stringify(box)}`);
          if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
          await card.locator("[data-name-source-text]").waitFor();
          const shown = await card.locator("[data-name-source-text]").evaluate((node) => {
            node.closest(".name-card")?.style.setProperty("content-visibility", "visible");
            return (node.textContent || "").replace(/\s+/g, " ").trim();
          });
          const stored = byId[id].root.source.replace(/\s+/g, " ").trim();
          assert.equal(shown, stored, id);
        }
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of OPEN) {
      const button = page.locator(`#${id} [data-name-source]`);
      await button.scrollIntoViewIfNeeded();
      if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
      await page.locator(`#${id} [data-name-source-text]`).waitFor();
    }
    const domAfter = await page.evaluate(() => document.querySelectorAll("*").length);
    console.log(`names dom after 5 sources ${domAfter}`);
    assert.ok(domAfter <= 9000, `DOM after sources ${domAfter}`);

    await page.setViewportSize({ width: 206, height: 457 });
    const overflow = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0),
    );
    assert.equal(overflow, 0, `horizontal scroll ${overflow}`);

    for (const theme of ["day", "night"]) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.evaluate((want) => {
        document.documentElement.dataset.theme = want;
      }, theme);
      await page.emulateMedia({ media: "print" });
      await page.goto(`${server.url}/names#keefa`, { waitUntil: "domcontentloaded" });
      await ready(page);
      await page.locator("#keefa").waitFor();
      const hidden = await page.evaluate(() => {
        const read = document.querySelector("#keefa [data-name-read]");
        const header = document.querySelector("header");
        const tools = document.querySelector(".names-tools");
        const card = document.querySelector("#keefa");
        return {
          read: read ? getComputedStyle(read).display : "missing",
          header: header ? getComputedStyle(header).display : "missing",
          tools: tools ? getComputedStyle(tools).display : "missing",
          bg: card ? getComputedStyle(card).backgroundColor : "",
          text: (card?.textContent || "").replace(/\s+/g, " "),
        };
      });
      assert.equal(hidden.read, "none", theme);
      assert.equal(hidden.header, "none", theme);
      assert.equal(hidden.tools, "none", theme);
      assert.ok(light(hidden.bg), `${theme} card background ${hidden.bg}`);
      assert.match(hidden.text, /Keefa/);
      assert.match(hidden.text, /Peter/);
      assert.match(hidden.text, /Matthew 4:18/);
      const pdf = await page.pdf({ printBackground: true });
      assert.ok(pdf.byteLength > 0, "empty pdf");
      await page.emulateMedia({ media: "screen" });
    }
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
