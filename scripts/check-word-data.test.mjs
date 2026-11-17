import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { collectIssues, loadModel } from "./check-word-data.mjs";

const model = loadModel();

function john(copy) {
  return copy.chapters.find((row) => row.book === "john" && row.ch === 1);
}

function issuesOf(edit) {
  const copy = structuredClone(model);
  edit(copy);
  return collectIssues(copy);
}

function has(issues, code) {
  assert.ok(issues.some((issue) => issue.startsWith(`${code}:`)), issues.join("\n") || "no issues");
}

test("the committed word files pass", () => {
  assert.deepEqual(collectIssues(model), []);
});

test("a verse key that is not in the chapter fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["999"] = [];
  }), "missing-verse");
});

test("a token list that is not the verse's words fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"].pop();
  }), "count");
});

test("a token whose form is not the word at its index fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][0].w = "ܗܘ";
  }), "mismatch");
});

test("a prefix that is not on the word fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][0].pre = "ܩ";
  }), "affix");
});

test("a parse outside the code list fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][2].p = "V.nope";
  }), "parse");
});

test("a lemma id missing from the book shard fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][3].l = "missing#1";
  }), "lemma");
});

test("an English function word in say fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][2].say = "and hwa";
  }), "say");
});

test("a suffix whose sound is missing from say fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][1].say = "ith";
  }), "say");
});

test("a feminine 3rd person glossed he fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][1].p = "PART.3fs";
  }), "person");
});

test("who or that glossed of fails", () => {
  has(issuesOf((copy) => {
    const chapter = copy.chapters.find((row) => row.book === "matthew");
    chapter.body.v["9"][5].g = "of heaven";
  }), "of-gloss");
});

test("an archaic gloss fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][3].g = "thou";
  }), "gloss");
});

test("a locked name without its say fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][9].say = "alaha";
  }), "locked");
});

test("reviewed without a listed reviewer fails", () => {
  has(issuesOf((copy) => {
    john(copy).body.v["1"][2].prov = "reviewed";
    john(copy).body.v["1"][2].rv = "Pat";
  }), "review");
});

test("a word file over 8 KB gzip fails", () => {
  has(issuesOf((copy) => {
    john(copy).gzip = 9000;
  }), "size");
});

test("Marya without a scholar flag or an Old Testament quotation fails", () => {
  const broken = issuesOf((copy) => {
    const lemma = copy.lemmas.john.rows.find((row) => row.id === "ܐܠܗܐ#1");
    lemma.sy = "ܡܪܝܐ";
  });
  has(broken, "marya");
  const kept = issuesOf((copy) => {
    const lemma = copy.lemmas.john.rows.find((row) => row.id === "ܐܠܗܐ#1");
    lemma.sy = "ܡܪܝܐ";
    for (const token of john(copy).body.v["1"]) {
      if (token.l === "ܐܠܗܐ#1") token.flag = "needs-scholar: which Old Testament verse?";
    }
  });
  assert.equal(kept.some((issue) => issue.startsWith("marya:")), false, kept.join("\n"));
});

test("a source outside the public-domain list fails", () => {
  has(issuesOf((copy) => {
    copy.lemmas.john.rows[0].src = ["sedra"];
  }), "src");
});

test("the checker command passes on this tree", () => {
  const run = spawnSync("node", ["scripts/check-word-data.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /word-data report: \d+\/\d+/);
});
