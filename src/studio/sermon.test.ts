import assert from "node:assert/strict";
import { test } from "node:test";
import { labelFor } from "./prompt.ts";
import { applyCitations, findCitations, SERMON_SYSTEM, sermonUser, shareOrCopy } from "./sermon.ts";

const john1 = "In the beginning was the Word, and the Word was with Elohim, and Elohim was the Word.";
const john14 = "And the Word became flesh and dwelt among us, and we saw his glory, a glory as of the Only Begotten from the Father, full of grace and truth.";

test("the sermon prompt quotes the passage and keeps the reverence framing", () => {
  const user = sermonUser("John 1:1", [{ en: john1 }], "Apologetic", "medium");
  assert.match(user, /Passage: John 1:1/);
  assert.ok(user.includes(john1));
  assert.match(user, /Tone: Apologetic/);
  assert.match(user, /about 600 words/);
  assert.match(SERMON_SYSTEM, /respectful Christian apologetic/);
  assert.match(SERMON_SYSTEM, /hateful content toward other faiths/);
  assert.match(SERMON_SYSTEM, /not claim the sermon was reviewed by a human/);
  assert.match(SERMON_SYSTEM, /Do not claim the sermon was reviewed by a human, or that it was made directly from the Syriac text/);
});

test("citations in the sermon are checked against this edition, and our wording replaces a paraphrase", () => {
  const draft = 'The Gospel opens at John 1:1. It later says John 1:14 "the Word was made flesh." Compare Isaiah 9:6 and the invented John 99:1. See also 1 John 1:1–2.';
  const cites = findCitations(draft);
  const display = cites.map((cite) => [cite.display, cite.ok, cite.reason ?? "", cite.book ?? ""]);
  assert.deepEqual(display, [
    ["John 1:1", true, "", "john"],
    ["John 1:14", true, "", "john"],
    ["Isaiah 9:6", false, "not in this edition", ""],
    ["John 99:1", false, "no such verse", ""],
    ["1 John 1:1–2", true, "", "1john"],
  ]);
  const out = applyCitations(draft, { "John 1:1": john1, "John 1:14": john14, "1 John 1:1–2": "That which was from the beginning." });
  assert.ok(out.text.includes(`John 1:1 — “${john1}”`));
  assert.ok(out.text.includes(`John 1:14 — “${john14}”`));
  assert.doesNotMatch(out.text, /the Word was made flesh/);
  assert.match(out.text, /Isaiah 9:6 \[not in this edition\]/);
  assert.match(out.text, /John 99:1 \[no such verse\]/);
  assert.ok(out.text.includes("1 John 1:1–2 — “That which was from the beginning.”"));
  assert.deepEqual(out.flags, [
    { ref: "Isaiah 9:6", reason: "not in this edition" },
    { ref: "John 99:1", reason: "no such verse" },
  ]);
});

test("the sermon label names the provider and never says it was reviewed", () => {
  const label = labelFor({ kind: "sermon", provider: "Claude", model: "Claude Sonnet 5.5", ref: "John 1:1" });
  assert.equal(label, "AI-generated sermon · Claude · Claude Sonnet 5.5 · John 1:1 · not reviewed");
  assert.doesNotMatch(label, /(?<!not )reviewed/);
  assert.doesNotMatch(label, /Syriac/);
});

test("Share falls back to copying the sermon and the passage reference", async () => {
  let copied = "";
  const text = "John 1:1\n\nA short sermon.\n\nAI-generated sermon · Claude · Claude Sonnet 5.5 · John 1:1 · not reviewed";
  const result = await shareOrCopy("John 1:1", text, { copy: async (value) => { copied = value; } });
  assert.equal(result, "copied");
  assert.equal(copied, text);
  const shared = await shareOrCopy("John 1:1", text, { share: async () => undefined, copy: async () => { throw new Error("unused"); } });
  assert.equal(shared, "shared");
  const closed = await shareOrCopy("John 1:1", text, { share: async () => { const error = new Error("closed"); error.name = "AbortError"; throw error; }, copy: async () => { copied = "no"; } });
  assert.equal(closed, "closed");
});

test("Claude writes a sermon with the system prompt and the passage, on the reader's key", async () => {
  const { complete } = await import("./adapters/director.ts");
  let seen: { url: string; init: RequestInit } | null = null;
  const fetcher = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ content: [{ type: "text", text: "A brief apologetic on the Word." }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const user = sermonUser("John 1:1", [{ en: john1 }], "Pastoral", "short");
  const out = await complete("anthropic", "sk-ant-test-" + "a".repeat(20), SERMON_SYSTEM, user, { maxTokens: 2500, maxChars: 12000 }, fetcher);
  assert.deepEqual(out, { ok: true, text: "A brief apologetic on the Word." });
  const s = seen as unknown as { url: string; init: RequestInit };
  assert.equal(s.url, "https://api.anthropic.com/v1/messages");
  const body = JSON.parse(s.init.body as string);
  assert.equal(body.max_tokens, 2500);
  assert.equal(body.system, SERMON_SYSTEM);
  assert.ok(String(body.messages[0].content).includes(john1));
  assert.equal((s.init.headers as Record<string, string>)["x-api-key"], "sk-ant-test-" + "a".repeat(20));
});
