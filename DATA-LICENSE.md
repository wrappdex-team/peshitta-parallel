# Data licence (pending legal review)

> **Status: pending legal review.** This file states the project owner's
> intended licensing, decided on 2026-11-13. It has not yet been reviewed by a
> lawyer, and the origin of some source texts is still being traced. Until that
> review is complete, treat every third-party text below as **all rights
> reserved by its owner unless its own terms say otherwise**, and do not rely on
> this file as a grant for any text the project did not create.

## Three layers

| Layer                      | What it covers                                                      | Licence                                                                  |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Code                       | Application source, scripts, tests, configuration                   | **MIT** (see [`LICENSE`](LICENSE))                                       |
| Project-original data      | Material written by INjeel contributors themselves (see below)      | **CC0 1.0 Universal** (public-domain dedication), _pending legal review_ |
| Third-party texts and data | Scripture editions, historical translations, lexicons, fonts, logos | **Their own terms.** Nothing here relicenses them.                       |

## Project-original data: CC0 1.0 (intended)

To the extent possible under law, INjeel contributors intend to waive all
copyright and related rights in the following **project-original** material
under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/):

- Study notes, name notes, guide and help text written by the project.
- The name index structure and the project's own transliterations (`say` forms)
  in `src/data/names.json`, and the learner word/name tables in
  `src/lib/word-say.ts`.
- Verse-range selections (such as the Words of Y'shua list), book blurbs,
  catalogue counts and other editorial metadata in `src/data/edition.ts` and
  `src/data/catalog.json`.
- Lexicon glosses and notes in `src/data/lexicon.json`, **only where they were
  written by the project** and not copied from a third-party lexicon (to be
  confirmed in the legal review).

CC0 applies only to rights the contributors actually hold. It does not waive
anyone else's rights, and it does not apply to the third-party material below,
even where that material is stored in the same file.

## Third-party material: keeps its own terms

| Material                                                                     | Where                                                                                           | Origin as currently recorded                                                                                                                                                                                                                                                       | Status                                                                                                                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Syriac Peshitta New Testament text (`sy` fields)                             | `src/data/nt/*.json`                                                                            | Imported in the first commit (2026-11-04) with no recorded source file or script. The edition's Revelation note names John Gwynn's Crawford-manuscript edition and the Bible Society's 1905 printing.                                                                              | **Origin unverified; tracing in progress.** The underlying ancient text is public domain, but a specific digital edition may carry its own terms. |
| James Murdock's English (1851/1852)                                          | `src/data/murdock/*.json` (original wording) and `src/data/nt/*.json` `en` (displayed, adapted) | Murdock's translation is generally regarded as public domain by age. The displayed `en` is a **modernized adaptation**: it differs from the stored Murdock text in 7,907 of 7,957 verses (modern pronouns, Semitic name forms, edited lines). How it was produced is not recorded. | The age-based public-domain status needs confirmation. Rights in the adaptation (and whether it was machine-assisted) need legal review.          |
| Arabic, French, Russian, Spanish, Chinese, Sureth, German, Japanese readings | `src/data/tr/<lang>/`                                                                           | AI-assisted study translations from the English pivot (`scripts/translate_nt.py`).                                                                                                                                                                                                 | **Not human-reviewed.** Rights in machine-assisted output and provider terms need legal review.                                                   |
| Contemporary Greek and modern Hebrew readings                                | `src/data/tr/el`, `src/data/tr/he`                                                              | AI-assisted study translations from the edition's English (`scripts/translate_el_he.py`). Not direct Syriac translation and not an original-language NT.                                                                                                                           | Same as above.                                                                                                                                    |
| Fonts                                                                        | npm `@fontsource/*` packages                                                                    | Upstream font licences (typically SIL OFL 1.1).                                                                                                                                                                                                                                    | Their own terms.                                                                                                                                  |
| Platform install assets and logos                                            | `public/__grok/`                                                                                | Platform-provided assets.                                                                                                                                                                                                                                                          | Their own terms. Not covered by MIT or CC0.                                                                                                       |

Resources such as SEDRA (Beth Mardutho, CC BY-NC 4.0) or ETCBC Text-Fabric
datasets are **not** currently identified as sources of repository data. If any
future data is derived from them, it keeps their terms (for example SEDRA's
non-commercial condition) and must be listed here before merge.

## Contributors

By contributing project-original data, you agree that your contribution may be
released under CC0 1.0. Do not contribute text you did not write unless its
licence is recorded in this table.
