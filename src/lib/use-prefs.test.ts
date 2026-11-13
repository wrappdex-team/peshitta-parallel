import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStoredPrefs } from "./prefs-store.ts";

test("an intro value that is not 1 is ignored and the other fields still parse", () => {
  const prefs = parseStoredPrefs(
    JSON.stringify({
      intro: "yes",
      face: "both",
      lang: "es",
      lang2: "fr",
      theme: "night",
      words: true,
      notes: true,
      size: 3,
      line: 0,
      speed: 80,
      voice: "rex",
      deviceVoice: "local",
      last: { book: "john", chapter: 3, verse: 16 },
    }),
  );
  assert.equal(prefs.intro, undefined);
  assert.equal(prefs.face, "both");
  assert.equal(prefs.lang, "es");
  assert.equal(prefs.lang2, "fr");
  assert.equal(prefs.theme, "night");
  assert.equal(prefs.words, true);
  assert.equal(prefs.notes, true);
  assert.equal(prefs.size, 3);
  assert.equal(prefs.line, 0);
  assert.equal(prefs.speed, 80);
  assert.equal(prefs.voice, "rex");
  assert.equal(prefs.deviceVoice, "local");
  assert.deepEqual(prefs.last, { book: "john", chapter: 3, verse: 16 });
});

test("intro 1 is kept", () => {
  const prefs = parseStoredPrefs(JSON.stringify({ intro: 1, lang: "de", face: "tr" }));
  assert.equal(prefs.intro, 1);
  assert.equal(prefs.lang, "de");
  assert.equal(prefs.face, "tr");
});
