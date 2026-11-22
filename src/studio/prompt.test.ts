import assert from "node:assert/strict";
import { test } from "node:test";
import { STYLES, styleById } from "./styles.ts";
import { fileName, irreverent, labelFor, lyricsFor, REVERENCE, songPrompt, stillPrompt, storyboard } from "./prompt.ts";

const v3 = { v: 3, en: "Blessed are the poor in spirit, for theirs is the kingdom of heaven!", sy: "ܛܘܒܝܗܘܢ ܠܡܣܟܢܐ ܒܪܘܚ" };

test("century styles are real traditions, unique, with dates and three swatches", () => {
  assert.ok(STYLES.length >= 13);
  assert.equal(new Set(STYLES.map((s) => s.id)).size, STYLES.length);
  for (const id of ["catacomb", "mosaic", "rabbula", "icon", "insular", "ethiopian", "romanesque", "stained-glass", "rublev", "renaissance", "baroque", "rembrandt", "dore", "modern"]) {
    const style = styleById(id);
    assert.equal(style.id, id);
    assert.equal(style.palette.length, 3);
    assert.ok(style.era && style.prompt.length > 60, id);
  }
  assert.match(styleById("rabbula").era, /586/);
  assert.equal(styleById("nope").id, "icon", "unknown falls back to the Byzantine icon");
});

test("still prompt quotes the verse verbatim, names the style and always carries the reverence guard", () => {
  const prompt = stillPrompt("Matthew 5:3", [v3], styleById("mosaic"));
  assert.ok(prompt.includes(v3.en));
  assert.ok(prompt.includes("Matthew 5:3"));
  assert.ok(prompt.includes("San Vitale"));
  assert.ok(prompt.endsWith(REVERENCE));
});

test("lyrics: English, Syriac or both, verse text untouched", () => {
  assert.equal(lyricsFor([v3], "english"), `[Verse]\n${v3.en}`);
  assert.equal(lyricsFor([v3], "syriac"), `[Verse]\n${v3.sy}`);
  assert.equal(lyricsFor([v3], "both"), `[Verse]\n${v3.sy}\n${v3.en}`);
  assert.equal(lyricsFor([{ v: 1, en: "No Syriac here." }], "syriac"), "[Verse]\nNo Syriac here.", "falls back to English when there is no Syriac");
  assert.match(songPrompt("Matthew 5:3", { genre: "Syriac chant", mood: "peaceful", bpm: 70, vocal: "choir", seconds: 60, language: "both" }), /Classical Syriac.*English/);
});

test("storyboard groups a chapter into at most 8 shots covering every verse once", () => {
  const verses = Array.from({ length: 48 }, (_, i) => ({ v: i + 1, en: `Verse ${i + 1}.` }));
  const shots = storyboard("Matthew", 5, verses, styleById("dore"));
  assert.ok(shots.length <= 8);
  assert.deepEqual(shots.flatMap((s) => s.verses.map((v) => v.v)), verses.map((v) => v.v));
  assert.equal(shots[0].ref, "Matthew 5:1–6");
  assert.match(shots[0].prompt, /No text, letters or captions on screen/);
  assert.equal(storyboard("Matthew", 5, [v3], styleById("dore"))[0].ref, "Matthew 5:3");
});

test("labels never say reviewed; file names are tidy; abusive asks are caught kindly", () => {
  const label = labelFor({ kind: "still", provider: "Google Gemini", model: "Nano Banana 2.1", ref: "Matthew 5:3" });
  assert.equal(label, "AI-generated · Google Gemini · Nano Banana 2.1 · Matthew 5:3 · not reviewed");
  assert.doesNotMatch(label, /\breviewed\b(?<!not reviewed)/);
  assert.equal(fileName("Matthew 5:3–7", "Byzantine mosaic", "png"), "injeel-matthew-5-3-7-byzantine-mosaic.png");
  assert.equal(irreverent("a gentle shepherd at dawn"), false);
  assert.equal(irreverent("make it gory and nude"), true);
  assert.equal(irreverent(stillPrompt("Matthew 5:3", [v3], styleById("baroque"))), false, "the reverence guard itself never trips the check");
  assert.equal(irreverent("a calm scene, no gore"), false);
});

test("director: Claude is called directly with the browser header and returns only the prompt text", async () => {
  const { direct } = await import("./adapters/director.ts");
  let seen: { url: string; init: RequestInit } | null = null;
  const fetcher = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ content: [{ type: "text", text: "“A gold mosaic of the Beatitudes.”" }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const out = await direct("anthropic", "sk-ant-test-" + "a".repeat(20), "still", "draft", fetcher);
  assert.deepEqual(out, { ok: true, text: "A gold mosaic of the Beatitudes." });
  const s = seen as unknown as { url: string; init: RequestInit };
  assert.equal(s.url, "https://api.anthropic.com/v1/messages");
  assert.equal((s.init.headers as Record<string, string>)["anthropic-dangerous-direct-browser-access"], "true");
  const google = await direct("google", "AQ." + "g".repeat(30), "song", "draft", (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hidden", thought: true }, { text: "Slow chant." }] } }] }), { status: 200 })) as unknown as typeof fetch);
  assert.deepEqual(google, { ok: true, text: "Slow chant." });
  const none = await direct("elevenlabs", "sk_" + "e".repeat(30), "still", "draft");
  assert.equal(none.ok, false);
});
