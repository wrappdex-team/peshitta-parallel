// AI Studio against the local production build, with every provider mocked.
// Needs `npm run build:check` and Playwright Chromium. Run with `npm run test:browser`.
// Real provider calls are NOT exercised here: no real keys exist in tests.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { deflateSync, crc32 } from "node:zlib";
import { chromium } from "playwright";
import { startBuiltServer } from "./serve-built.mjs";

const SHOTS = process.env.STUDIO_SHOTS || "";
const SIZES = [206, 360, 390, 412, 1280];
const FAKE_OPENAI = `sk-proj-${"o".repeat(40)}`;
const FAKE_OPENROUTER = `sk-or-v1-${"r".repeat(48)}`;

/** A small mosaic-like PNG so screenshots show a plausible still. */
function mockPng(w = 160, h = 200) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    rows.push(0);
    for (let x = 0; x < w; x++) {
      const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
      const inner = x > 50 && x < 110 && y > 40 && y < 170;
      rows.push(...(inner ? (on ? [232, 223, 200] : [140, 59, 42]) : on ? [201, 162, 39] : [31, 63, 107]));
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from(rows))), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}
const PNG = mockPng();

async function setup(browser, url, { theme = "day", width = 390, enabled = false, session = null, replies = [] } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const calls = [];
  await context.route(/^https:\/\/(api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.x\.ai|openrouter\.ai|api\.elevenlabs\.io|queue\.fal\.run|fal\.run|api\.stability\.ai)\//, async (route) => {
    const request = route.request();
    calls.push({ url: request.url(), method: request.method(), headers: request.headers(), body: request.postData() });
    const href = request.url();
    const custom = replies.find((reply) => reply.match.test(href));
    if (custom) {
      const out = custom.reply(request);
      return route.fulfill({ status: out.status ?? 200, contentType: out.contentType ?? "application/json", headers: { "access-control-allow-origin": "*" }, body: typeof out.body === "string" || Buffer.isBuffer(out.body) ? out.body : JSON.stringify(out.body) });
    }
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
  return page.evaluate(() => {
    if (document.documentElement.scrollWidth > window.innerWidth + 1) return false;
    // Inside Studio, scrolling panes must not be pushed wider than the sheet either.
    const pane = document.querySelector('dialog[aria-label="Studio"] section > div.overflow-y-auto');
    return !pane || pane.scrollWidth <= pane.clientWidth + 1;
  });
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

test("connections: paste a key, it is recognised, tested with one read, kept only in this tab", async () => {
  const { context, page, calls } = await setup(browser, server.url, { enabled: true });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  await dialog.getByRole("button", { name: "Connections" }).click();
  assert.equal(await dialog.getByRole("button", { name: "Done" }).getAttribute("aria-pressed"), "true");
  await dialog.getByLabel("PASTE ANY KEY").fill(FAKE_OPENAI);
  await dialog.getByRole("button", { name: "Connect OpenAI" }).click();
  await dialog.getByText("OpenAI connected · 2 models visible.").waitFor();
  const probe = calls.find((call) => call.url === "https://api.openai.com/v1/models");
  assert.ok(probe, "one models read");
  assert.equal(probe.headers.authorization, `Bearer ${FAKE_OPENAI}`);
  assert.equal(calls.filter((call) => call.method === "POST").length, 0, "testing never makes media");
  assert.equal(await dialog.getByRole("table", { name: "What your connections can make" }).getByText("OpenAI").count(), 1);
  const stored = await page.evaluate(() => ({ session: sessionStorage.getItem("injeel-agent"), local: JSON.stringify({ ...localStorage }) }));
  assert.deepEqual(JSON.parse(stored.session).keys, { openai: FAKE_OPENAI });
  assert.ok(!stored.local.includes(FAKE_OPENAI), "never in localStorage");
  await dialog.locator('[data-provider="openai"]').getByRole("button", { name: "Disconnect" }).click();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("injeel-agent")), null);
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
      await dialog.getByRole("button", { name: "Connections" }).click();
      assert.ok(await noHorizontalScroll(page), `connections ${width} ${theme}`);
      if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/connections-${theme}-390.png` });
      assert.deepEqual(errors, [], `${width} ${theme}`);
      await context.close();
    }
  });
}

const GOOGLE = `AQ.${"g".repeat(30)}`;
const geminiImage = { match: /:generateContent$/, reply: () => ({ body: { candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG } }] } }] } }) };

test("Still: century style + aspect shape the verse-aware prompt; the result carries its label", async () => {
  const { context, page, calls, errors } = await setup(browser, server.url, { enabled: true, session: JSON.stringify({ v: 2, keys: { google: GOOGLE } }), replies: [geminiImage] });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  await dialog.getByRole("radio", { name: /Rabbula Gospels/ }).click();
  await dialog.getByRole("radio", { name: "16:9" }).click();
  const prompt = await dialog.getByRole("textbox").inputValue();
  assert.match(prompt, /Rabbula Gospels \(586 AD\)/);
  assert.match(prompt, /Blessed are the poor in spirit/);
  assert.match(prompt, /No text, letters or captions/);
  await dialog.getByRole("button", { name: "Make the still" }).click();
  const label = dialog.locator("[data-studio-label]");
  await label.waitFor();
  assert.equal(await label.textContent(), "AI-generated · Google Gemini · Nano Banana 2.1 · Matthew 5:3 · not reviewed");
  const call = calls.find((c) => c.url.includes("gemini-nano-banana-2.1:generateContent"));
  assert.equal(call.headers["x-goog-api-key"], GOOGLE);
  const body = JSON.parse(call.body);
  assert.deepEqual(body.generationConfig, { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } });
  assert.equal(await dialog.getByRole("link", { name: "Download" }).getAttribute("download"), "injeel-matthew-5-3-rabbula-gospels.png");
  if (SHOTS) {
    await label.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/still-result-day-390.png` });
  }
  const prefs = JSON.parse(await page.evaluate(() => localStorage.getItem("injeel-studio")));
  assert.equal(prefs.style, "rabbula");
  assert.ok(!JSON.stringify(prefs).includes(GOOGLE));
  assert.deepEqual(errors, []);
  await context.close();
});

test("Still: a provider safety stop is shown as one calm line, nothing else", async () => {
  const blocked = { match: /:generateContent$/, reply: () => ({ body: { candidates: [{ finishReason: "IMAGE_SAFETY" }] } }) };
  const { context, page } = await setup(browser, server.url, { theme: "night", enabled: true, session: JSON.stringify({ v: 2, keys: { google: GOOGLE } }), replies: [blocked] });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/still-panel-night-390.png` });
  await dialog.getByRole("button", { name: "Make the still" }).click();
  await dialog.getByText("Google Gemini declined this for safety. Try a gentler, more reverent description.").waitFor();
  assert.equal(await dialog.locator("[data-studio-output]").count(), 0);
  await context.close();
});
