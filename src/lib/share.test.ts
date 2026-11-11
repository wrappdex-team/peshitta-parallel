import assert from "node:assert/strict";
import test from "node:test";
import { APP_SHARE, shareData, verseShare } from "./share.ts";

test("a verse share keeps every language that is on the page, and no more", () => {
  const one = verseShare({ bookName: "John", book: "john", chapter: 1, verse: 1, lines: ["In the beginning"] });
  assert.match(one.text, /^John 1:1\nIn the beginning\n/);
  assert.match(one.text, /sent on/);
  assert.equal(one.url, "https://www.injeel.news/read/john/1#v-1");

  const three = verseShare({
    bookName: "John",
    book: "john",
    chapter: 1,
    verse: 1,
    lines: ["ܒܪܫܝܬ", "In the beginning", "في البدء"],
  });
  assert.match(three.text, /ܒܪܫܝܬ/);
  assert.match(three.text, /In the beginning/);
  assert.match(three.text, /في البدء/);
  assert.doesNotMatch(three.text, /Opening/);
});

test("the share block keeps the blessing and the link together", () => {
  const data = shareData(APP_SHARE);
  assert.equal(data.title, APP_SHARE.title);
  assert.match(data.text, /pass them on/);
  assert.match(data.text, /https:\/\/www\.injeel\.news\/$/);
  assert.equal("url" in data, false);
});
