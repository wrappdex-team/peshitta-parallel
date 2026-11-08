# Injeel

The original words, kept. Followers of Christ our Lord. Restored from the Peshitta — a multicultural study, side by side.

The classical Syriac stays on the page. Beside it: James Murdock’s English, or a study reading in Arabic, French, Russian, Spanish, Chinese, modern Syriac, German, or Japanese. **Read** speaks the language that is open, in Ara or Rex, and the verse follows the voice. **Studio** takes a highlighted line, shapes a prompt from it, and makes a still, a short film, or a voice.

## Run locally

```bash
npm ci --ignore-scripts
npm run dev
```

Open the app at `http://localhost:8080`.

## Scripts

- `npm run dev` — development server
- `npm run build:check` — production compilation only; safe verification path (no migrations)
- `npm run build` — legacy production compilation **and database migration**; not a routine CI check
- `npm test` — unit and repository regression tests (four upstream-document tests skip if their untracked source docs are absent)
- `npm run check:data` — structural audit; prints known gaps and fails new regressions
- `npm run check:data:strict` — fails on every remaining data gap
- `npm run check:seo:built` — validate compiled SSR metadata after `build:check`
- `npm run typecheck` — TypeScript check

## Readiness and source review

This is still a demo, not a certified translation or production-ready release.
See [readiness checks and unresolved gaps](docs/READINESS.md) and the
[original-names and source review policy](docs/SOURCE_REVIEW.md).
No new translations or scripture/licence changes are included in this pass.
