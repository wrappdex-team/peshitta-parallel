import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { snapshotOgIdentity } from "./grok-pwa-shared.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const origin = "https://injeel.news";

test("sitemap covers every catalog chapter exactly once, using only the current demo origin", () => {
  const catalog = JSON.parse(read("src/data/catalog.json"));
  const expected = ["/", "/words", "/study", "/names", "/privacy"];
  for (const book of catalog)
    for (let chapter = 1; chapter <= book.chapters; chapter++)
      expected.push(`/read/${book.id}/${chapter}`);
  const sitemap = read("public/sitemap.xml");
  assert.match(sitemap, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(urls).size, urls.length);
  assert.deepEqual(urls.sort(), expected.map((path) => origin + path).sort());
  assert.match(
    read("public/robots.txt"),
    /Sitemap: https:\/\/injeel\.news\/sitemap\.xml/,
  );
  assert.ok(read("src/lib/site.ts").includes(`SITE_ORIGIN = "${origin}"`));
});

test("personal reading utility is noindex but crawlable; public study routes retain canonicals", () => {
  assert.match(read("src/routes/seal.tsx"), /name: "robots", content: "noindex, follow"/);
  // No Disallow: /seal: crawlers must be able to see the noindex directive.
  assert.doesNotMatch(read("public/robots.txt"), /Disallow:\s*\/seal/);
  assert.doesNotMatch(read("public/sitemap.xml"), /\/seal<\/loc>/);
  for (const path of ["index.tsx", "words.tsx", "study.tsx", "read.$book.$chapter.tsx"]) {
    const source = read(`src/routes/${path}`);
    assert.match(source, /rel: "canonical"/);
    assert.match(source, /SITE_ORIGIN/);
  }
});

test("demo retains real share assets and free educational structured data without invented ratings", () => {
  const { site } = snapshotOgIdentity(new URL("../", import.meta.url).pathname);
  assert.equal(site.title, "Injeel");
  assert.equal(site.card, "custom");
  assert.equal(site.image, "/og.jpg");
  assert.ok(readFileSync(new URL("../public/og.jpg", import.meta.url)).length > 0);
  const root = read("src/routes/__root.tsx");
  assert.match(root, /"@type": "WebSite"/);
  assert.match(root, /"@type": "WebApplication"/);
  assert.match(root, /applicationCategory: "EducationalApplication"/);
  assert.match(root, /price: "0"/);
  assert.doesNotMatch(root, /aggregateRating|ratingValue/);
});

test("verification build cannot invoke migration; CI requests no production secrets", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["build:check"], "node scripts/with-app-env.mjs vite build");
  const workflow = read(".github/workflows/readiness.yml");
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run build:check/);
  assert.doesNotMatch(
    workflow,
    /\$\{\{\s*secrets\.|pull_request_target|npm run db:migrate|npm run build\s*$/m,
  );
});

test("CI actions use immutable pins with readable versions without changing application Node", () => {
  const workflow = read(".github/workflows/readiness.yml");
  const uses = workflow.split("\n").filter((line) => /^\s*- uses:/.test(line));
  assert.equal(uses.length, 2);
  for (const line of uses) {
    assert.match(line, /^\s*- uses: actions\/(?:checkout|setup-node)@[a-f0-9]{40} # v\d+\.\d+\.\d+$/);
  }
  assert.match(workflow, /^\s*node-version: 22$/m);
});
