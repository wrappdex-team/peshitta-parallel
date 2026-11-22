// AI Studio against the local production build, with every provider mocked.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
// Real provider calls are NOT exercised here: no real keys exist in tests.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const SHOTS = process.env.STUDIO_SHOTS || "";
const SIZES = [206, 360, 390, 412, 1280];
const FAKE_OPENAI = `sk-proj-${"o".repeat(40)}`;
const FAKE_OPENROUTER = `sk-or-v1-${"r".repeat(48)}`;

async function setup(browser, url, { theme = "day", width = 390, enabled = false, session = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const calls = [];
  await context.route(/^https:\/\/(api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.x\.ai|openrouter\.ai|api\.elevenlabs\.io|queue\.fal\.run|fal\.run|api\.stability\.ai)\//, async (route) => {
    const request = route.request();
    calls.push({ url: request.url(), method: request.method(), headers: request.headers(), body: request.postData() });
    const href = request.url();
    if (href.endsWith("/api/v1/auth/keys")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ key: FAKE_OPENROUTER }) });
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(
    ({ theme, enabled, session }) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("peshitta-parallel", JSON.stringify({ theme, lang: "en", face: "tr", lang2: "none", intro: 1 }));
      if (enabled) localStorage.setItem("injeel-studio", JSON.stringify({ enabled: true }));
      if (session) sessionStorage.setItem("injeel-agent", session);
    },
    { theme, enabled, session },
  );
  return { context, page, calls, errors, url };
}

async function reader(page, url) {
  await page.goto(`${url}/read/matthew/5`, { waitUntil: "networkidle" });
  await page.locator("article").first().waitFor();
}

async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
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

test("Studio is off by default: no verse mark, header icon or drawer row", async () => {
  const { context, page, errors } = await setup(browser, server.url);
  await reader(page, server.url);
  assert.equal(await page.locator(".studio-mark").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Studio", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /Create from verse/ }).count(), 0);
  await page.getByRole("button", { name: "Books" }).click();
  assert.equal(await page.getByRole("navigation", { name: "Books" }).getByRole("button", { name: "Studio", exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("turning Studio on in the Reading sheet adds one quiet mark per verse and a header icon; off removes them", async () => {
  const { context, page } = await setup(browser, server.url);
  await reader(page, server.url);
  const verses = await page.locator("article").count();
  await page.locator("main").getByRole("button").filter({ hasText: "Language" }).first().click();
  const toggle = page.getByRole("switch", { name: /AI Studio/ });
  assert.equal(await toggle.getAttribute("aria-checked"), "false");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: /Create from verse/ }).count(), verses);
  assert.equal(await page.getByRole("button", { name: "Studio", exact: true }).count(), 1);
  const prefs = await page.evaluate(() => localStorage.getItem("injeel-studio"));
  assert.deepEqual(JSON.parse(prefs), { enabled: true });
  await page.locator("main").getByRole("button").filter({ hasText: "Language" }).first().click();
  await page.getByRole("switch", { name: /AI Studio/ }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".studio-mark").count(), 0);
  await context.close();
});

test("a verse mark opens Studio pre-filled with that verse; range widens to the chapter", async () => {
  const { context, page, errors } = await setup(browser, server.url, { enabled: true });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  await dialog.waitFor();
  assert.equal(await dialog.locator("[data-studio-ref]").textContent(), "Matthew 5:3");
  assert.match(await dialog.locator("[data-studio-passage]").textContent(), /poor in spirit/);
  await dialog.getByRole("button", { name: "Whole chapter" }).click();
  assert.equal(await dialog.locator("[data-studio-ref]").textContent(), "Matthew 5");
  assert.equal(await dialog.getByRole("tab").count(), 3);
  await dialog.getByRole("button", { name: "Close" }).click();
  await dialog.waitFor({ state: "detached" });
  assert.deepEqual(errors, []);
  await context.close();
});

test("OpenRouter sign-in: PKCE callback exchanges the code once and keeps the key in this tab", async () => {
  const pending = JSON.stringify({ v: 2, keys: {}, pending: { verifier: "v".repeat(43), returnTo: "/read/matthew/5", at: Date.now() } });
  const { context, page, calls } = await setup(browser, server.url, { enabled: true, session: pending });
  await page.goto(`${server.url}/connected?code=auth_code_abc123`, { waitUntil: "domcontentloaded" });
  await page.getByText("OpenRouter is connected").waitFor();
  const exchange = calls.find((call) => call.url.endsWith("/api/v1/auth/keys"));
  assert.deepEqual(JSON.parse(exchange.body), { code: "auth_code_abc123", code_verifier: "v".repeat(43), code_challenge_method: "S256" });
  await page.waitForURL(/\/read\/matthew\/5$/);
  const vault = JSON.parse(await page.evaluate(() => sessionStorage.getItem("injeel-agent")));
  assert.deepEqual(vault, { v: 2, keys: { openrouter: FAKE_OPENROUTER } });
  await context.close();
});

for (const theme of ["day", "night"]) {
  test(`Studio fits at 206/360/390/412/1280 px in ${theme}`, async () => {
    for (const width of SIZES) {
      const { context, page, errors } = await setup(browser, server.url, { theme, width, enabled: true, session: JSON.stringify({ v: 2, keys: { google: `AQ.${"g".repeat(30)}`, anthropic: `sk-ant-${"a".repeat(30)}` } }) });
      await reader(page, server.url);
      assert.ok(await noHorizontalScroll(page), `reader ${width} ${theme}`);
      if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/reader-mark-${theme}-390.png` });
      await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
      const dialog = page.getByRole("dialog", { name: "Studio" });
      await dialog.waitFor();
      assert.ok(await noHorizontalScroll(page), `studio ${width} ${theme}`);
      if (SHOTS && (width === 390 || width === 1280)) await page.screenshot({ path: `${SHOTS}/studio-${theme}-${width}.png` });
      assert.deepEqual(errors, [], `${width} ${theme}`);
      await context.close();
    }
  });
}
