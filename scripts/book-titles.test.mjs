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
  const base = "http://127.0.0.1:8094";
  const child = spawn("node", ["scripts/with-app-env.mjs", "vite", "dev", "--host", "127.0.0.1", "--port", "8094"], {
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

async function audit(page, label) {
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const rows = [...document.querySelectorAll("[data-book-name]")].map((name) => {
      const sy = name.parentElement?.querySelector("[data-book-syriac]");
      const nb = name.getBoundingClientRect();
      const sb = sy?.getBoundingClientRect();
      const overlap =
        sb &&
        nb.left < sb.right - 0.5 &&
        nb.right > sb.left + 0.5 &&
        nb.top < sb.bottom - 0.5 &&
        nb.bottom > sb.top + 0.5;
      const link = name.closest("a");
      const kids = [...name.querySelectorAll(":scope > span")]
        .filter((child) => !child.classList.contains("sr-only"))
        .map((child) => child.getBoundingClientRect())
        .filter((box) => box.width > 2);
      return {
        text: (name.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
        nameWidth: nb.width,
        nameRight: nb.right,
        syRight: sb ? sb.right : null,
        textRight: kids.reduce((end, box) => Math.max(end, box.right), 0),
        overlap: Boolean(overlap),
        rowHeight: link ? link.getBoundingClientRect().height : 0,
      };
    });
    return { vw, scroll: document.documentElement.scrollWidth - vw, rows };
  });
  assert.ok(report.rows.length > 0, `${label} found no book titles`);
  for (const row of report.rows) {
    assert.equal(row.overlap, false, `${label} overlap in ${row.text}`);
    assert.ok(row.nameWidth + 0.5 >= 96, `${label} name is ${row.nameWidth}px in ${row.text}`);
    assert.ok(row.rowHeight + 0.5 >= 44, `${label} row is ${row.rowHeight}px in ${row.text}`);
    assert.ok(row.nameRight <= report.vw + 1, `${label} name runs past ${report.vw} in ${row.text}`);
    assert.ok(row.textRight <= row.nameRight + 1, `${label} a word spills out of the name in ${row.text}`);
    if (row.syRight != null) assert.ok(row.syRight <= report.vw + 1, `${label} Syriac runs past ${report.vw} in ${row.text}`);
  }
  assert.ok(report.scroll <= 1, `${label} horizontal scroll ${report.scroll}`);
}

test("book titles stay readable at 320 and at 200% zoom", { timeout: 120000 }, async () => {
  const { base, child } = await appBase();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await page.addInitScript(() => {
      localStorage.setItem(
        "peshitta-parallel",
        JSON.stringify({
          theme: "day",
          lang: "en",
          lang2: "none",
          last: { book: "2thessalonians", chapter: 3, verse: 18 },
        }),
      );
    });
    for (const size of [
      { width: 320, height: 568 },
      { width: 206, height: 457 },
    ]) {
      await page.setViewportSize(size);
      const tag = `${size.width}`;
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      await page.getByRole("link", { name: "Continue 2 Thessalonians, Syriac title Tesaloniqa, 3:18" }).waitFor();
      const twoJohn = page.getByRole("link", { name: "2 John, Syriac title Yochanan, 1 chapter, later Syriac" });
      await twoJohn.waitFor();
      const snap = await twoJohn.ariaSnapshot();
      assert.match(snap, /Syriac title/);
      assert.match(snap, /1 chapter/);
      assert.doesNotMatch(snap, /1 chapters/);
      await audit(page, `home ${tag}`);

      await page.getByRole("button", { name: "Books" }).click();
      await page.getByRole("navigation", { name: "Books of the New Testament" }).waitFor();
      await audit(page, `drawer ${tag}`);
      await page.getByRole("button", { name: "Close" }).click();

      await page.goto(`${base}/read/john/3`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Books" }).click();
      const menu = page.getByRole("navigation", { name: "Books" });
      await menu.waitFor();
      await audit(page, `reader ${tag}`);
      const john = menu.getByRole("link", { name: "John, Syriac title Yochanan", exact: true });
      const mark = menu.getByRole("link", { name: "Mark, Syriac title Marqos", exact: true });
      const johnColor = await john.locator("[data-book-name]").evaluate((el) => getComputedStyle(el).color);
      const markColor = await mark.locator("[data-book-name]").evaluate((el) => getComputedStyle(el).color);
      assert.equal(johnColor, "rgb(122, 46, 56)", `current book is ${johnColor}`);
      assert.notEqual(markColor, johnColor);
    }
  } finally {
    await browser.close();
    child?.kill();
  }
});
