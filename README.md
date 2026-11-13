# INjeel

**A Syriac New Testament reader and multilingual study application.**

The original words, kept. Followers of Christ our Lord.

INjeel keeps classical Syriac on the page beside James Murdock’s English and
additional study readings. It brings chapter navigation, word study, search,
device read-aloud and optional creative media into one reading experience.
Originally published as **Peshitta Parallel**, the repository retains that name.

[Live site](https://injeel.news) ·
[Previous host](https://peshitta-parallel.vercel.app) ·
[Developer checks](#verification) ·
[Source policy](docs/SOURCE_REVIEW.md) ·
[Security boundaries](#security-and-privacy-boundaries)

> **Status:** an actively developed study application, not a certified translation
> or a claim of complete production/security readiness. Known text gaps, source
> attribution work and device/accessibility checks remain. Passing CI does not
> certify linguistic accuracy, security or paid-provider compatibility.

## What the application does

| Area                          | Current behavior                                                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library `/`                   | Book catalogue, chapter entry points and access to reading tools.                                                                                                                                                           |
| Reader `/read/:book/:chapter` | Syriac with a selected parallel reading and optional second parallel; verse selection, notes, word glosses, reading preferences and chapter/book navigation. Invalid references return a real 404 with recovery navigation. |
| Search                        | Client-side text matching over English and Syriac, plus heuristic query routing to Arabic, Russian and French indexes. It is not universal multilingual or semantic search.                                                 |
| Words `/words`                | A red-letter sayings view using the repository’s selected verse ranges, with parallel text and device read-aloud.                                                                                                           |
| Study `/study`                | Project background and editorial explanation, distinct from scripture text.                                                                                                                                                 |
| Seal `/seal`                  | Device-local chapter completion and reading milestones; `noindex`, not an account-backed or private authenticated page.                                                                                                     |
| Privacy `/privacy`            | In-app privacy information. Review actual storage/provider behavior below when developing.                                                                                                                                  |
| Studio                        | Optional prompt shaping, images, short video and generated audio from a selected passage, using the visitor’s own supported provider key.                                                                                   |

### Device speech is not Studio generation

The current reader and Words player use the browser’s `speechSynthesis` API via
[`ReadAloud`](src/components/read-aloud.tsx). Reading and device speech need no
provider key. Available voices, pronunciation, language support and whether a
voice uses a device vendor’s network service depend on the browser/OS; do not
promise offline or historically authenticated Syriac pronunciation.

Studio instead sends requested work to external providers through server
functions. Prompt shaping supports xAI, OpenAI and Anthropic; images and generated
audio support xAI/OpenAI; video submission and status use xAI. Model access,
provider availability and charges depend on the visitor’s provider account.
Studio’s broader media-language menu is **not** the scripture-language catalogue:
generated speech or an on-demand translation is not a reviewed scripture edition.

## Quick start

### Prerequisites

- **Node.js 22** (CI version) or Node.js 24, with npm.
- An existing checkout of this repository and its committed `package-lock.json`.
- No provider key, database connection or account is needed for ordinary reading
  and the uncredentialed regression checks.

From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:8080` in a browser on the same computer. The explicit host
argument keeps this development session loopback-only: the unmodified `dev`
script defaults to `0.0.0.0`. A remote browser may not share the server’s localhost;
use only the environment’s supported preview path, not public tunnels or relaxed
network/security settings.

The npm commands retain the repository’s app-environment wrapper. `VITE_` values
are browser-visible build settings: **never put credentials in them**. Do not copy
production environments into a local checkout, commit `.env` files or enable
install hooks merely to get past an installation failure. No secret-value example
is needed for this onboarding path. For an approved optional integration, use
placeholders such as `<provider-key>` in documentation only, never real values.

**Do not use `npm run build` for routine verification.** It runs Vite compilation
and then `db:migrate`. Use `npm run build:check`, which compiles without invoking
that migration command. Likewise, do not run `db:migrate` as an onboarding step.

## Architecture and source map

The application uses React 19, TypeScript, TanStack Router/Start, Vite, Nitro and
Tailwind CSS. File routes handle page loading/metadata; TanStack server functions
handle provider-backed work. Scripture is bundled JSON, not fetched from a
production database for each reading.

```text
src/
  routes/                 Pages, reader reference validation and metadata
  components/             Reader/player, verse UI, Search, Studio and modal shell
  data/
    nt/                   Syriac + English books, chapter/verse records
    tr/<locale>/          Additional parallel readings as chapter/verse grids
    catalog.json          Book/chapter/verse counts
    edition.ts            Book labels, later-book flags and editorial notes
    lexicon.json          Word gloss/transliteration entries
    search.json           English search rows
  lib/
    scripture.ts          Lazy book/parallel loading, search rows and word helpers
    languages.ts          Reader language IDs, direction and typography metadata
    readings.ts           Device-local completion counts and milestones
    use-prefs.ts          Reader preferences and last position
    speak.ts              Speech text helpers + registered legacy speech handler
    studio.ts             Visitor-key prompt, image, video and audio, including limited free tiers
    provider-key-storage.ts  Session-only Studio credential lifecycle
    provider-deadline.ts   Bounded provider I/O and sanitized failure results
    local-rate-limit.ts    Bounded, process-local admission state
    credential-cache-scope.ts  Legacy audio credential isolation
    auth/, app-data/, db.ts   Retained integration/database scaffolding
scripts/                  Regression, data/SSR checks and developer tooling
server/                   Supporting server middleware
public/                   Static assets, robots directives and sitemap
migrations/               Retained database schema; not required for text loading
docs/                     Readiness, source policy and focused design/test records
.github/                  Readiness workflow and Actions update proposals
```

### Data flow

1. The reader validates a canonical book/chapter reference against the catalogue.
2. `loadBook()` imports the book’s `Verse[][]`; each record has `v`, `sy`, `en`
   and optional footnote/colophon fields.
3. `loadParallel()` imports a locale’s `string[][]` grid when needed. Chapter and
   verse **positions** align it with the base book; this is not an edition-aware
   reference crosswalk. Missing grids return `null` and the UI shows pending copy.
4. Word selection uses the local lexicon and prefix/suffix heuristics, not a
   certified morphological parser. Search indexes are loaded on demand.
5. Reading settings/progress stay in browser storage. Studio is a separate,
   explicitly requested server-to-provider flow, not necessary for reading.

### Retained backend scaffolding

`src/lib/auth/`, `src/lib/app-data/` and `src/lib/db.ts` are not evidence that
INjeel currently provides user accounts or cloud-synced reading. The root
`AuthProvider` is a passthrough, no auth API file route is registered, and current
reading/Studio handlers do not use the connector helper or SQL client.

The retained database layer supports configured PostgreSQL and an in-memory
PGlite fallback. Importing/initializing that scaffold can bootstrap local schema;
it is not an inert example to wire in casually. Enabling auth/connectors/database
features requires a separate security, migration and deployment review. Do not
configure a production database just to run the reader.

## Languages, coverage and source fidelity

The catalogue contains **27 books, 260 chapters and 7,957 verse slots**. Syriac is
the base text. The reader offers these parallel IDs:

| ID                            | Reading                                                               | Coverage caveat                                                                      |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `en`                          | Adapted from James Murdock’s English                                  | Stored beside Syriac; no known blank fields.                                         |
| `ar`, `fr`, `ru`              | Arabic, French, Russian                                               | 27 book grids each; no known blank fields.                                           |
| `es`, `zh`, `aii`, `de`, `ja` | Spanish, Simplified Chinese, Sureth (modern Syriac), German, Japanese | 27 book grids each; no known blank fields.                                           |
| `el`, `he`                    | Contemporary Greek, modern Hebrew                                     | AI-assisted English-pivot study readings; 27 book grids each, no known blank fields. |

These are structural counts, **not a completeness or translation-quality
certification**. The known-gap baseline in
[`data-known-gaps.json`](docs/data-known-gaps.json) is empty: no blank fields
remain, and any new gap fails the regression check.

The edition marks 2 Peter, 2/3 John, Jude and Revelation as later Syriac books,
not part of the original 22-book Peshitta collection. Its Revelation note names
John Gwynn’s Crawford-manuscript edition and the Bible Society’s 1905 printing.
These repository attributions still need source-level verification; they are not
independent manuscript or rights certification.

James Murdock’s English attribution is retained. Historical metadata conflicts:
the initial README says **1852**, while `scripts/translate_nt.py` says **1851**.
Do not silently choose a year or claim the imported wording is a verified,
unaltered edition. The initial README’s public-domain claim does not establish
permissions for every imported source or parallel reading.

The existing translation script describes an **English-pivot study-translation**
workflow, not direct Syriac translation, and includes localized-name instructions
that conflict with the desired source-grounded naming policy. **Do not run it as
an approved language pipeline.** Text, names and pronunciation need qualified
review under [the source policy](docs/SOURCE_REVIEW.md).

Contemporary Greek (`el`) and modern Hebrew (`he`) readings **are present**. They
are AI-assisted study translations from the edition’s English
(`scripts/translate_el_he.py`): not direct Syriac translations, not human
reviewed, and not an original Greek or Hebrew New Testament. The direction remains
**Peshitta-source, modern-language translations**, clearly labeled by
method/version, and never calling a Hebrew NT translation an original Hebrew NT.
Before any further language work: establish source and
rights evidence, verse mapping, Syriac personal/place/object-name handling and
qualified linguistic review. Do not generate scripture or silently substitute
names to make coverage counters pass.

## Security and privacy boundaries

- **Visitor-funded generation (BYOK):** missing, blank or unrecognized key formats
  are rejected before provider work; there is no site-funded key fallback. Format
  recognition is not provider acceptance or authenticated visitor identity.
  Requested text/prompts and the supplied credential pass through the app server
  to the selected provider. Do not describe Studio as client-only or zero-trust.
- **Session-only credential storage:** Save/restore/Clear use `sessionStorage`.
  Same-tab refresh normally retains a saved key. Browser restore/opener/duplicate
  behaviors may preserve or copy session data. This is not encrypted storage,
  secure-erasure assurance or XSS protection; same-origin script can access it.
  If storage is unavailable, Studio stays disconnected, with no persistent-save
  fallback. Reading and device speech remain available without a key.
- **Legacy credentials:** Studio lifecycle code attempts removal of only the old
  app-specific persistent key entry, without reading or silently copying it.
  Previously saved visitors must re-enter their key. Blocked cleanup/Clear shows
  a warning and cannot guarantee deletion. Other preferences/progress are not
  broadly cleared. See [storage/cache behavior](docs/KEY_STORAGE_AND_CACHE.md).
- **Other browser storage:** reader preferences/last position, completion counts
  and noncredential Studio options still use `localStorage`. There is no account
  sync or guaranteed private/backup storage. Do not paste keys into passage,
  prompt, issue, log or test-fixture fields.
- **Request limits:** bounded process-local admission state limits generation
  requests, not money spent or concurrent provider jobs. Counters reset with
  instances and are independent across instances; video status has no application
  quota. These are not distributed abuse controls or a global spending cap.
- **Deadlines and paid-job uncertainty:** provider phases have application I/O
  deadlines and sanitized transport failures. A timeout/aborted HTTP request does
  **not** prove the provider cancelled a job or will not bill it. Check provider
  state before resubmitting. Video polling is sequential and bounded, but job IDs
  are not durably saved for reload recovery. Make submits new work, not a resume.
- **Legacy speech cache:** `speakPart` remains registered but has no current UI
  caller. Its small process-local cache is credential-scoped, not human-account
  ownership; it is not a durable store or fresh provider-key revocation check.

Never commit credentials, dump environments, log raw provider requests or expose
preview-protection material. Report suspected vulnerabilities privately through
GitHub’s private vulnerability-reporting option **if enabled**, or an established
private maintainer channel; do not post secrets or exploit details in public
issues. No completed independent security certification is claimed; the previous
Aikido service setup failure remains unresolved.

## Verification

Run these checks without production credentials or real provider calls:

```sh
npm test
npm run check:data
npm run typecheck
npm run build:check
npm run check:seo:built
```

| Command                     | Purpose and boundary                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                  | Unit/repository regressions, including mocked media, storage, speech and modal behavior. Four upstream prose-contract tests skip when their untracked source documents are absent. |
| `npm run check:data`        | Structural regression gate; prints known gaps and rejects unexpected ones. Passing does not mean complete or accurate scripture.                                                   |
| `npm run check:data:strict` | Full structural completeness check; passes with no blank fields. Passing is not a translation-quality certification.                                                               |
| `npm run typecheck`         | TypeScript, without emitting output.                                                                                                                                               |
| `npm run build:check`       | Production compilation only; no `db:migrate` invocation.                                                                                                                           |
| `npm run check:seo:built`   | After compilation, invokes the compiled SSR handler in-process to check valid/invalid routes and SEO. Not browser hydration testing.                                               |
| `npm run lint`              | Repository-wide ESLint; not currently a readiness CI step or a clean-baseline guarantee. Scope lint to changed source when reviewing an isolated patch.                            |
| `npm run preview`           | Serve a previously built application locally; not a production publication command.                                                                                                |

The [readiness workflow](.github/workflows/readiness.yml) runs install, tests,
data regression, types, migration-free compilation and compiled SSR checks on
PRs and main. It uses pinned Actions, a read-only repository token and no injected
production credentials. Actions dependency updates are proposals, not auto-merges.

Mocks and SSR are not real-browser/mobile/assistive-technology or live-provider
QA. Review focus containment/restoration, keyboard and RTL navigation, responsive
layouts, browser speech interruption and device voices separately. Storage smoke
tests should use an isolated browser profile and dummy values; do not inspect or
remove someone’s real saved key. Paid-provider tests need explicit approval and
a capped plan. Historical verification records in `docs/` describe their specific
baseline and should not be read as timeless coverage claims.

## Contributing and release discipline

1. Branch from current `main`; inspect incoming changes before touching shared
   reader, player or Studio files. Keep changes small and reviewable.
2. Add deterministic regressions for behavior changes. Use dummy storage,
   synthetic credentials and mocked provider responses—never production keys.
3. Run the relevant checks above, review the full public diff for sensitive data
   and describe actual verification plus remaining gaps in a pull request.
4. Treat scripture, attribution, pronunciation and language changes as separate
   source-reviewed work. Do not expand known-gap allowances to obtain green CI.
5. **PR creation is not release approval.** Obtain explicit maintainer/owner
   approval before merge or production publication. Existing Git integration can
   deploy a merge automatically; do not bypass protections or manually deploy,
   run migrations or change production settings as an incidental review step.

## Further reading

- [Readiness and known data gaps](docs/READINESS.md)
- [Source, names, pronunciation and rights policy](docs/SOURCE_REVIEW.md)
- [Media security review](docs/MEDIA_SECURITY_REVIEW.md)
- [Session keys and legacy cache isolation](docs/KEY_STORAGE_AND_CACHE.md)
- [Local admission limits](docs/LOCAL_RATE_LIMITS.md)
- [Provider deadlines and cancellation limits](docs/PROVIDER_DEADLINES.md)
- [Studio asynchronous job lifecycle](docs/STUDIO_JOB_LIFECYCLE.md)
- [Device speech lifecycle](docs/DEVICE_SPEECH_LIFECYCLE.md)
- [Modal keyboard and focus behavior](docs/MODAL_ACCESSIBILITY.md)

## Attribution and licensing

> **Pending legal review.** The licences below were chosen by the project owner on
> 2026-11-13 and have not yet been reviewed by a lawyer.

- **Code:** [MIT](LICENSE). This covers the application source, scripts, tests
  and configuration only.
- **Project-original data:** [CC0 1.0](DATA-LICENSE.md). This covers study notes,
  name notes, guide text, the project’s own transliterations and editorial
  metadata written by INjeel contributors.
- **Third-party texts keep their own terms.** That includes the Syriac Peshitta
  digital text (origin still being traced), James Murdock’s English, AI-assisted
  study translations, fonts and platform assets. Neither MIT nor CC0 relicenses
  them. See [`DATA-LICENSE.md`](DATA-LICENSE.md) for the table.

Development is maintained in `wrappdex-team/peshitta-parallel`, with contributor
history preserved in Git. James Murdock and the Syriac edition attributions above
remain part of the project’s source history, subject to verification. Confirm
upstream terms and exact edition permissions before redistributing scripture
or parallel readings.
