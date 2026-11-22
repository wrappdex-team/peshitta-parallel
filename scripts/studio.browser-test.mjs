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

/** Screenshots wait out the 160–200 ms colour transitions so the selected control reads correctly. */
async function shot(page, path) {
  await page.waitForTimeout(350);
  await page.screenshot({ path });
}

async function setup(browser, url, { theme = "day", width = 390, enabled = false, session = null, replies = [] } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  const calls = [];
  await context.route(/^https:\/\/(api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|api\.x\.ai|openrouter\.ai|api\.elevenlabs\.io|queue\.fal\.run|fal\.run|api\.stability\.ai|image\.pollinations\.ai|[\w-]+\.hf\.space)\//, async (route) => {
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
  // The test server sends production's CSP, so a blocked request shows up here.
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) errors.push(message.text().slice(0, 240));
  });
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
      if (SHOTS && width === 390) await shot(page, `${SHOTS}/reader-mark-${theme}-390.png`);
      await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
      const dialog = page.getByRole("dialog", { name: "Studio" });
      await dialog.waitFor();
      assert.ok(await noHorizontalScroll(page), `studio ${width} ${theme}`);
      if (SHOTS && (width === 390 || width === 1280)) await shot(page, `${SHOTS}/studio-${theme}-${width}.png`);
      await dialog.getByRole("tab", { name: "Song" }).click();
      await dialog.locator("[data-studio-song]").waitFor();
      assert.ok(await noHorizontalScroll(page), `song ${width} ${theme}`);
      if (SHOTS && width === 390) await shot(page, `${SHOTS}/song-${theme}-390.png`);
      await dialog.getByRole("tab", { name: "Film" }).click();
      await dialog.locator("[data-studio-film]").waitFor();
      assert.ok(await noHorizontalScroll(page), `film ${width} ${theme}`);
      if (SHOTS && width === 390) await shot(page, `${SHOTS}/film-${theme}-390.png`);
      await dialog.getByRole("tab", { name: "Still" }).click();
      await dialog.getByRole("button", { name: "Connections" }).click();
      assert.ok(await noHorizontalScroll(page), `connections ${width} ${theme}`);
      if (SHOTS && width === 390) await shot(page, `${SHOTS}/connections-${theme}-390.png`);
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
    await shot(page, `${SHOTS}/still-result-day-390.png`);
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
  if (SHOTS) await shot(page, `${SHOTS}/still-panel-night-390.png`);
  await dialog.getByRole("button", { name: "Make the still" }).click();
  await dialog.getByText("Google Gemini declined this for safety. Try a gentler, more reverent description.").waitFor();
  assert.equal(await dialog.locator("[data-studio-output]").count(), 0);
  await context.close();
});

test("Gallery keeps what was made on this device, labelled, and can delete it", async () => {
  const { context, page, errors } = await setup(browser, server.url, { enabled: true, session: JSON.stringify({ v: 2, keys: { google: GOOGLE } }), replies: [geminiImage] });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  await dialog.getByRole("button", { name: "Make the still" }).click();
  await dialog.getByText("Kept in your gallery on this device.").waitFor();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await dialog.getByRole("button", { name: "Gallery" }).click();
  const works = dialog.locator("[data-studio-gallery] li");
  await works.first().waitFor();
  assert.equal(await works.count(), 1);
  assert.match(await works.first().locator("[data-studio-label]").textContent(), /^AI-generated · Google Gemini · Nano Banana 2\.1 · Matthew 5:3 · not reviewed$/);
  assert.match(await works.first().locator("img").getAttribute("src"), /^blob:/);
  if (SHOTS) await shot(page, `${SHOTS}/gallery-day-390.png`);
  const stored = await page.evaluate(() => new Promise((resolve) => { const r = indexedDB.open("injeel-studio-gallery"); r.onsuccess = () => { const all = r.result.transaction("works").objectStore("works").getAll(); all.onsuccess = () => resolve(JSON.stringify(all.result.map(({ blob, ...rest }) => rest))); }; }));
  assert.ok(!stored.includes(GOOGLE), "no key in the gallery");
  await works.first().getByRole("button", { name: "Delete from this device" }).click();
  await dialog.getByText("Nothing here yet.").waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test("Song: the verse becomes lyrics (English, Syriac or both) and ElevenLabs composes it on the reader's key", async () => {
  const ELEVEN = `sk_${"e".repeat(40)}`;
  const music = { match: /api\.elevenlabs\.io\/v1\/music/, reply: () => ({ contentType: "audio/mpeg", body: Buffer.from("ID3fake-mp3-bytes") }) };
  const { context, page, calls, errors } = await setup(browser, server.url, { enabled: true, session: JSON.stringify({ v: 2, keys: { elevenlabs: ELEVEN } }), replies: [music] });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  await dialog.getByRole("tab", { name: "Song" }).click();
  await dialog.getByRole("radio", { name: "Both" }).click();
  const box = dialog.getByLabel("LYRICS · SCRIPTURE");
  await page.waitForFunction(() => /[\u0700-\u074F]/.test(document.querySelector("[data-studio-song] textarea")?.value ?? ""), null, { timeout: 5000 });
  const lyrics = await box.inputValue();
  assert.match(lyrics, /[\u0700-\u074F]/, "Syriac line from the verse");
  assert.match(lyrics, /Blessed are the poor in spirit/);
  await dialog.getByLabel("Genre").selectOption("Byzantine chant");
  if (SHOTS) await shot(page, `${SHOTS}/song-panel-day-390.png`);
  await dialog.getByRole("button", { name: "Make the song" }).click();
  const label = dialog.locator("[data-studio-label]");
  await label.waitFor();
  assert.equal(await label.textContent(), "AI-generated · ElevenLabs · Eleven Music 2.5 · Matthew 5:3 · not reviewed");
  assert.equal(await dialog.locator("[data-studio-output=song] audio").count(), 1);
  const call = calls.find((c) => c.url.startsWith("https://api.elevenlabs.io/v1/music"));
  assert.equal(call.headers["xi-api-key"], ELEVEN);
  const body = JSON.parse(call.body);
  assert.equal(body.model_id, "music_v2_5");
  assert.equal(body.music_length_ms, 60000);
  assert.match(body.prompt, /Byzantine chant/);
  assert.ok(body.prompt.includes(lyrics), "scripture lyrics sent exactly");
  assert.deepEqual(errors, []);
  await context.close();
});

test("Film: a passage becomes a storyboard; Gemini Omni makes each shot in turn on the reader's key; they play in order", async () => {
  let made = 0;
  const omni = {
    match: /\/v1beta\/interactions/,
    reply: (request) => {
      if (request.method() === "POST") return { body: { id: `int-${++made}`, status: "in_progress" } };
      return { body: { id: "x", status: "completed", steps: [{ content: [{ type: "video", data: Buffer.from("fake-mp4").toString("base64"), mime_type: "video/mp4" }] }] } };
    },
  };
  const { context, page, calls, errors } = await setup(browser, server.url, { enabled: true, session: JSON.stringify({ v: 2, keys: { google: GOOGLE } }), replies: [omni] });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  await dialog.getByRole("tab", { name: "Film" }).click();
  await dialog.locator("[aria-label=Passage] select").nth(1).selectOption("4");
  await dialog.getByLabel("Film style").selectOption("rublev");
  await dialog.getByRole("radio", { name: "9:16" }).click();
  const shots = dialog.getByRole("list", { name: "Storyboard" }).getByRole("listitem");
  assert.equal(await shots.count(), 2);
  await dialog.getByLabel("Shot 2 prompt").fill("Rublev icon style: the meek, gently lit, slow push in.");
  if (SHOTS) await shot(page, `${SHOTS}/film-storyboard-day-390.png`);
  await dialog.getByRole("button", { name: "Make 2 shots" }).click();
  await dialog.locator("[data-studio-player]").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-studio-shot=done]").length === 2, null, { timeout: 60000 });
  const posts = calls.filter((call) => call.method === "POST" && call.url.endsWith("/v1beta/interactions"));
  assert.equal(posts.length, 2, "one request per shot, in turn");
  assert.ok(posts.every((call) => call.headers["x-goog-api-key"] === GOOGLE));
  const first = JSON.parse(posts[0].body);
  assert.equal(first.response_format.aspect_ratio, "9:16");
  assert.match(first.input, /Matthew 5:3/);
  assert.equal(JSON.parse(posts[1].body).input, "Rublev icon style: the meek, gently lit, slow push in.");
  assert.equal(await dialog.locator("[data-studio-label]").textContent(), "AI-generated · Google Gemini · Omni 1.2 Flash · Matthew 5:3–4 · not reviewed");
  assert.match(await dialog.locator("[data-studio-output=film]").textContent(), /Shot 1 of 2/);
  if (SHOTS) await shot(page, `${SHOTS}/film-result-day-390.png`);
  assert.deepEqual(errors, []);
  await context.close();
});

test("Free services: one tap turns them on (no key), the third-party note shows, and a still is made and kept", async () => {
  const pollinations = { match: /image\.pollinations\.ai\/prompt\//, reply: () => ({ contentType: "image/png", body: Buffer.from(PNG, "base64") }) };
  const { context, page, calls, errors } = await setup(browser, server.url, { enabled: true, replies: [pollinations] });
  await reader(page, server.url);
  await page.getByRole("button", { name: "Create from verse 3 in Studio" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio" });
  await dialog.getByRole("button", { name: "Connections" }).click();
  const row = dialog.locator("[data-provider=free]");
  assert.match(await row.textContent(), /Third-party/);
  assert.equal(await row.getByRole("textbox").count(), 0, "no key field for a keyless service");
  await row.getByRole("button", { name: "Turn on" }).click();
  assert.deepEqual(JSON.parse(await page.evaluate(() => sessionStorage.getItem("injeel-agent"))), { v: 2, keys: { free: "no-key" } });
  await dialog.getByRole("button", { name: "Done" }).click();
  assert.match(await dialog.locator("[data-studio-free]").textContent(), /Free third-party services/);
  await dialog.getByRole("button", { name: "Make the still" }).click();
  await dialog.locator("[data-studio-label]").waitFor();
  assert.equal(await dialog.locator("[data-studio-label]").textContent(), "AI-generated · Free services · Pollinations Sana · Matthew 5:3 · not reviewed");
  const call = calls.find((c) => c.url.startsWith("https://image.pollinations.ai/"));
  assert.ok(call, `pollinations call missing: ${calls.map((c) => c.url.slice(0, 60)).join(" ")}`);
  assert.ok(!call.headers.authorization, "no credentials sent");
  assert.match(call.url, /private=true/);
  await dialog.getByRole("button", { name: "Gallery" }).click();
  await dialog.locator("[data-studio-output=still]").first().waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});
