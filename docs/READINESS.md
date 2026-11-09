# First readiness pass — not a production certification

Scope: INjeel only. Canonical origin is https://injeel.news. The previous host
https://peshitta-parallel.vercel.app stays live as an alias and is not the
canonical URL. No migration or licence change in this note.

## Reproducible checks

Use Node 22 (matching CI) or Node 24 and the committed npm lockfile:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run check:data
npm run typecheck
npm run build:check
npm run check:seo:built
```

`build:check` runs the production compiler through the existing app-env wrapper
but **does not run database migrations**. The legacy `npm run build` still calls
`db:migrate`; do not use it for routine local/CI verification. No secrets are
required by the readiness workflow. It uses a read-only GitHub token, disables
checkout credential persistence, and never calls a deployment CLI. Dependency
install hooks are disabled; do not automatically enable them to fix an install.

CI actions use full upstream commit-SHA pins with readable release comments.
Their Node 24 **action runtime** requires runner v2.327.1 or later; this is
separate from the application's unchanged Node 22 test/build version.
`.github/dependabot.yml` proposes weekly GitHub Actions-only updates, limited to
two open update PRs. It does not update npm dependencies or configure automatic
merging. Review action release notes and passing checks before approving updates.

The workflow is a regression gate, not a release gate. No external AI/media
API is exercised, and no hosted database is used. It does not establish that all
study interactions, accessibility, native packaging, auth or paid API abuse
controls are production-ready. Repository-wide lint/security/dependency auditing and end-to-end
study coverage need separate follow-up; a compiler passing does not replace them.

### Existing template-test portability

Eight generic PWA tests accidentally read this app's real title and `public/og.jpg`.
They now use an empty fixture workspace, preserving their original assertions;
an additional test protects INjeel's real identity. Four prose-contract tests
inspect upstream `.grok/skills/og` documentation that is not included in this
repository. They are explicitly skipped **only when those source documents are
absent**. Their runtime brand/atomic-write tests still execute. These skips must
not be described as complete upstream template coverage.

## Data audit and known unresolved gaps

`check:data` reads every catalogued source book and every parallel-language grid.
It checks book files, identities, chapter/verse counts, numbering, string types
and blank text. It rejects new gaps by exact path and reference, rather than
allowing a total missing-verse budget. Mutation tests exercise corrupt data.
It does not check semantic accuracy, manuscript variants, pronunciation, copyright
or name consistency. No scripture text is changed by the checker.

At baseline `859c62babd24f424c6b77d86833332452178399f` there are 27 books,
260 chapters, 7,957 verse slots and eight parallel locales. **78 blank fields
remain unresolved** (not 78 distinct verses):

- Seven source **English** fields: Acts 19:41 and 20:17; Luke 18:35;
  Mark 8:19, 9:31 and 11:19; Matthew 26:30. Classical Syriac fields are not blank
  at these references. All eight parallel locales also have these seven gaps
  (56 more blank fields).
- Chinese, Spanish, German, Japanese and Sureth additionally lack Mark 4:10,
  Matthew 26:45 and 2 Corinthians 13:14 (15 fields).

`docs/data-known-gaps.json` lists the exact 78 field references and why they
remain. The regression command prints these issues even when it exits zero.
`npm run check:data:strict` exits **nonzero while any gap remains**, including
known ones. Repair requires source and linguistic review; remove repaired
entries from the baseline in the same reviewed change. Do not expand the
baseline simply to make CI green. Invalid JSON or unreadable files are errors,
never treated as a missing translation that can be ignored.

## Conservative demo SEO

The sitemap contains all 260 catalogued chapter routes plus home, words, study
and privacy. `/seal` is a device-local personal-progress utility, not a useful
search landing page: it is omitted from the sitemap and marked `noindex, follow`.
It is deliberately not blocked in robots.txt, so crawlers can read the directive.
This is indexing hygiene, **not a claim of a private-data exposure or access
control**. Root public indexing, canonical URLs, existing structured data and
share assets are retained; no ratings are invented. Canonical URLs use
https://injeel.news.
Static regressions check these contracts. `check:seo:built` calls the compiled
Vercel SSR handler in-process for home, `/seal` and John 1, verifying status,
content markup, a single canonical and a single effective robots directive. It
requires `build:check` first and starts no server. Browser hydration and
mobile/desktop study interactions remain unverified; no claim is made that a
live crawler has already applied an undeployed change.

## Before widening language coverage

1. Resolve gaps with documented sources; audit edition provenance and rights
   independently from any proposed MIT licence for code.
2. Apply the [source and names review policy](SOURCE_REVIEW.md). Existing study
   readings are English-mediated; do not advertise them as direct Syriac translations.
3. Verify reading/navigation/search/word study/read-aloud/progress in real browsers,
   including RTL, non-Latin fonts, keyboard use and mobile layouts. API-dependent
   media and audio checks need a separate approved, capped test plan.
4. Review error handling, input validation, auth, rate limits, dependency security
   and CI branch protection before considering a release.
5. Only after backend/repository readiness and qualified review, resume language
   work in descending total-speaker priority. Daily expansion is a target, not
   grounds to release unreviewed scripture.

## Local verification record

Dependency installation with lifecycle scripts disabled succeeded. Unit and
repository tests (267 passed, four explicit upstream-document skips), scoped
ESLint on all changed code, the structural regression audit, TypeScript, compilation and
in-process built SSR SEO checks passed. Strict data completeness correctly
failed with all 78 unresolved fields reported. Four missing upstream-document
tests are skipped as described above; tracked AGENTS.md checks remain active.
No visual/browser-interaction or live-deployment verification was performed.

Aikido scanning was attempted for the changed code/configuration, but the
connector returned `The name org.freedesktop.secrets was not provided by any
.service files` rather than findings. **Security scanning is not complete**;
configure the Aikido connector (`/aikido:setup`) and rerun before treating this
as security-reviewed. No credentials were read to work around the error.

## Follow-up: reader route input boundary

A compiled-SSR reproduction showed that unknown books, chapter zero,
out-of-range chapters, scientific notation and leading-zero chapters returned
HTTP 200 with self-canonical URLs. These were successful, indexable shells for
references that do not exist in the edition (or duplicate numeric spellings).

The reader route now validates against catalog chapter limits in its loader,
rejects noncanonical/non-integer spellings, and returns a real 404 with a usable
"All books" recovery link. Missing-reference metadata is noindex/follow and has
no canonical. Canonical positive integer chapter URLs remain unchanged; this
pass deliberately rejects alternate numeric spellings rather than inventing
redirect destinations. Unit tests cover all 260 chapters and their upper bounds;
compiled SSR checks cover valid first/last/one-chapter references and seven
invalid paths. This is route reliability/indexing work, not translation review
or an authorization system.

No audio/player logic is changed. The reader route file also hosts player UI,
so the incoming manual voice update must be checked for overlapping hunks before
integration; do not blindly replace that file. Hosted readiness and Vercel
checks on the initial commit passed before this follow-up; new hosted checks
must be observed separately. The refreshed Aikido descriptor was retried once
for this slice and returned the same secret-service error, not scan findings.

### Browser follow-up for the PR preview

A browser-capable agent should check direct navigation and client-side recovery
on both desktop and mobile: `/read/john/1`, `/read/john/21`,
`/read/philemon/1`, `/read/not-a-book/1`, `/read/john/0`, `/read/john/22`,
`/read/john/01` and `/read/john/1e0`. Verify a visible not-found state, the
"All books" link returning home, normal book/chapter navigation afterwards,
no hydration/console errors, and exactly one effective robots/canonical policy
in the document head. Then smoke-test language switching, RTL, search, word
study and `/seal`; do not start paid media requests during that test. The
in-process SSR checks are not browser/hydration verification.

## Follow-up: non-media backend error contract

The non-media backend audit found a concrete connector-helper reliability bug:
`src/lib/app-data/client.server.ts` could report `{ ok: true }` for an HTTP 429
or 503 when an inconsistent upstream JSON body declared `ok: true`. An
unfollowed HTTP redirect could likewise be reported as success, despite the
request explicitly using `redirect: "manual"`.

A regression using a fully stubbed fetch failed before the fix (actual `ok`
was true, expected false). Non-2xx transport status is now authoritative while
existing 401 sign-in and 403 access-denied handling stays unchanged. New tests
cover contradictory 302/429/503 bodies, genuine 200 success and 200 application
failure. No real connector, credential, database or provider call was made.
An existing empty catch now documents its unchanged token-digest fallback so
scoped lint can run without disabling its rule.

Reachability matters: this connector helper/readiness hook is scaffold code,
not currently referenced by INjeel's reader/study routes; the root AuthProvider
is a passthrough, and no `src/routes/api/auth` handler exists. Compiled-bundle
inspection found no connector helper/readiness symbols. A local uncredentialed
GET of `/api/auth/get-session` returned 404, while the public PWA manifest
returned 200. This fix strengthens a retained library contract; it is **not**
proof of an active production authentication vulnerability or newly added
account functionality. Do not add login requirements to free reading merely
to make an auth audit look complete.

Review before enabling connector/auth scaffolding: gate error responses can
include upstream detail; failure memo identity uses decoded token claims;
`callTool` has no explicit request timeout; and an exceptional auth-cookie
logging branch includes a cookie preview. These are code-review concerns,
not verified live exploits. The separately identified media/site-key fallback
and process-local rate limits remain deferred; no media/player code is changed.

For this slice, unit tests (267 passed, four upstream-document skips),
TypeScript and scoped ESLint passed. Compilation and compiled-SSR regressions
ran in an isolated tracked-source INjeel snapshot outside the live QA checkout,
with only the current helper/test patch overlaid and shared installed
dependencies. Its environment was cleared and no migration was run. This
avoided replacing artifacts beneath the still-running local QA server, which
continues serving the earlier reader-validation build. Aikido remains
unavailable; no further retry or completed security scan is claimed.

The manual voice update reached remote main as `2eee55e` during this audit,
changing read-aloud, speak, jesus, words and styles files. No changed-file
overlap with this PR was found; none of that incoming work was integrated,
modified or overwritten. Local test claims do not certify the new voice build.
