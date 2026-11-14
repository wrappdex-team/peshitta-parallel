import assert from "node:assert/strict";
import { test } from "node:test";
import { isIntroduced, parseStoredPrefs, visitorStanding } from "./prefs-store.ts";

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

test("intro 0 is not a parsed choice, and it does not count as a return visit", () => {
  const raw = JSON.stringify({ intro: 0, face: "tr", lang: "en", last: { book: "john", chapter: 3, verse: 1 } });
  const prefs = parseStoredPrefs(raw);
  assert.equal(prefs.intro, undefined);
  assert.equal(prefs.face, "tr");
  assert.equal(prefs.lang, "en");
  assert.deepEqual(prefs.last, { book: "john", chapter: 3, verse: 1 });
  assert.equal(visitorStanding(raw), "pending");
  assert.equal(isIntroduced(raw), false);
});

test("a prefs object with no intro field is a returning visitor", () => {
  const raw = JSON.stringify({ theme: "day", lang: "fr", face: "both" });
  assert.equal(visitorStanding(raw), "returning");
  assert.equal(isIntroduced(raw), true);
  assert.equal(visitorStanding(null), "new");
  assert.equal(isIntroduced(null), false);
  assert.equal(visitorStanding(JSON.stringify({ intro: 1 })), "answered");
  assert.equal(isIntroduced(JSON.stringify({ intro: 1 })), true);
  assert.equal(visitorStanding(JSON.stringify({ intro: "yes", lang: "es" })), "returning");
});
