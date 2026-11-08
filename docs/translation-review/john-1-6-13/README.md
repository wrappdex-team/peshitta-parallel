# John 1:6–13 working packet; John 1:1–5 follow-up

**AI-ASSISTED · UNREVIEWED · NEW TRANSLATION FROM SYRIAC · NOT PUBLISHABLE**

This is an isolated, docs-only review packet under `docs/translation-review/`. It is not a released Bible,
ancient Greek/Hebrew original, expert-certified translation, or independent human review.
No runtime, corpus, locale, public asset, configuration, dependency, or migration changed.
No provider or translation-generator calls; no English scripture pivot or copied target
Bible/NC lexicon database. All target clauses and their analyses are **proposals**.

## Exact bounds and audit record

- New proposed contemporary Greek and biblical-style Hebrew: **John 1:6–13**, eight verses.
- Existing John 1:1–5: **append-only reassessment**, not replacement. `john-1-1-5-review-02.json`
  pins the existing pilot's byte hash and preserves all original target/source texts.
- `DRAFTS.md`: readable proposed Syriac/Greek/Hebrew pairs; not approved verse text.
- `pilot.json`: eight target pairs, direct source phrase alignments, stated additions,
  reordering, register labels, review gates and unresolved decisions.
- `source-john-1-6-13.json`: verbatim frozen app fields at PR11 head
  `f2c46a209d3ef9bdfe919beea6ecd33d5b1f7c02`, file `src/data/nt/john.json`.
  Whole-file SHA256: `594428548d96fb2667b4db39e457f520db94876bff5cbdaf5c3f96505944f8cb`.
  Eight-pair SHA256: `c93e694eb286bf55d2be9dcffc8b24edd0771a5300c369ede7ac805819a0a7e0`.
- `module-extract-john-1-6-13.json`: fresh raw/clean extraction using the published
  `pysword==0.2.8` reader. No hand-typed replacement of module source.
- `source-verification.json`: exact character edits per verse, preserving both witnesses.
  This records a digital comparison, **not** a textual-critical edition or proof of the
  application's historical import provenance.

## Important: not eight exact matches

The cached official package hash was verified and extraction rerun.
CrossWire Peshitta **2.0** (2020-02-08), UTF8/OSIS/zText, KJV verse mapping;
its bundled configuration is copied here, not the stale public SVN 1.1 configuration.
ZIP SHA256: `badce0aa0a9b70a9c81891ed48d5a9e86de1e24d12ad4ad378e060e03cabc7b9`.
Configuration SHA256: `a4b45f9fdfed3c514f6acd55f90022ae19b4ae4a5c0953adfd17d549ea9e71c7`.

All eight fields are present and nonempty. All raw/clean pairs are equal. Every module
verse has exactly one extra trailing U+0020. After removing that space only, **five**
match: 1:6,9,10,11,12. At **1:7,8,13**, four additional substitutions remain:

| Verse | Zero-based source character position | App                | Module                   |
| ----- | -----------------------------------: | ------------------ | ------------------------ |
| 1:7   |                                 9,18 | U+0723 `ܣ` SEMKATH | U+0724 `ܤ` FINAL SEMKATH |
| 1:8   |                                   22 | U+0723 `ܣ`         | U+0724 `ܤ`               |
| 1:13  |                                   32 | U+0723 `ܣ`         | U+0724 `ܤ`               |

They are not NFC-equivalent. A separately named diagnostic fold maps U+0724→U+0723
and demonstrates no further character difference beyond those four forms and eight
spaces. **The fold is neither Unicode canonical normalization nor an applied source
repair.** Both strings remain unchanged. This looks like letter-form encoding variation,
not evidence of a different lexical root; that assessment still needs qualified review.
No punctuation edit, vowel-mark edit, word-boundary edit, blank verse, or missing verse
was observed in these eight digital fields. Absence of marks here is not a collation
of the pointed printed edition. No later-correction/manuscript-critical claims made.

**Working-source policy:** the proposals analyze the frozen app Syriac verbatim and
retain the module as the identified comparator/reference. Do not label all eight as
byte-identical to licensed CrossWire or assert a verified historical app import. Before
any public corpus integration, explicitly decide and document the source policy for
these encoding differences; do not silently replace runtime fields.

## Material review findings

- **1:5:** existing Greek expresses mastery/overpowering while Hebrew expresses
  reach/overtake. The mismatch is material. Review02 provides explicitly paired
  reaching, cognitive, and domination alternatives, with rationale and **no selected
  final answer**. Payne Smith's historical lexicon, printed p97 (PDF103, visually read),
  supports physical and mental drk ranges but does not adjudicate this verse.
- **1:1:** mltha/title, divine predication, article/definiteness and lwth relation remain
  unresolved; Greek article rules must not be reverse-imposed on Syriac.
- **1:3–4:** by-hand agency, hwa eventivity and mdm dhwa attachment need review. The
  source's module verse division is not an ancient sentence-punctuation decision.
  At 1:4 the existing second-clause past copula is also editorial: an explicit present
  alternative is now recorded, not falsely certified as the only possible tense.
- **1:6:** source name `ܝܘܚܢܢ`; proposed Hebrew `יוחנן` and Greek `Γιοχανάν` are in
  `names-registry.json`. Greek is provisional orthographic accommodation, not proof of
  ancient pronunciation, stress, vowel tradition or gemination. The Syriac identity is
  preserved; no automatic localized `Ιωάννης` substitution. No name validation claimed.
- **1:7:** purpose does not assert universal actual belief. Through-him agency and its
  referent require review. Greek idiom omits the literal hand noun; this is disclosed.
- **1:8:** Greek “came” and Hebrew “ba” are supplied for the ellipsis, not source verbs
  repeated in this verse.
- **1:9:** draft attaches “coming into the world” to each human; attachment to the light
  remains an explicit alternative. Existential/referential opening and true/genuine/
  light-of-truth nuance remain provisional. Do not decide by a familiar target Bible.
- **1:10:** hand agency and knowing/recognizing remain open. Masculine personal Greek
  pronoun versus neuter “light” requires a reference decision, not automatic gender mapping.
- **1:11:** “his own” has no named nation/place/ethnicity supplied. First-clause domain/
  possession versus second-clause people is proposed, not an explicit pair of source nouns.
- **1:12:** shultana→right/entitlement is this draft's choice, not the proven exclusive
  meaning; authority/power/capacity alternatives must be weighed. Hebrew zkhut is a
  register decision, not claimed ancient biblical vocabulary. Children/sons scope and
  the relation of the receiving/believing groups need review.
- **1:13:** source-relative/plural birth construction is retained with disclosed Greek
  reordering. Blood number is not proved merely by missing plural points. Flesh/will
  and man/husband are unresolved; no sexual/moralizing or father gloss silently added.

“Original objects” means semantic fidelity, not blanket transliteration. Light/world/
blood/flesh are meaningful terms; no named place or named object was identified here.

## Rights, attribution and supporting research

Syriac comparator: BFBS 1905; digital text courtesy John Richards, distributed by
CrossWire Bible Society as Peshitta module 2.0. Bundled metadata explicitly declares
**DistributionLicense=Public Domain** for that module. This is not blanket permission
for all modern Syriac transcriptions, apparatus, scans, fonts or databases.

- Module: https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Peshitta
- Specific rights: https://www.crosswire.org/sword/copyright/ModInfoCopyright.jsp?modName=Peshitta
- Official documented distribution: https://crosswire.org/ftpmirror/pub/sword/packages/rawzip/Peshitta.zip
- Jessie Payne Smith/Margoliouth, _A Compendious Syriac Dictionary_ (Oxford, 1903), p97,
  drk Aphʿel. Specific Commons file has affirmative historical public-domain declarations:
  https://commons.wikimedia.org/wiki/File:A_compendious_Syriac_Dictionary.pdf
- Nöldeke/Crichton, _Compendious Syriac Grammar_ (1904), actual Orthography chapter,
  especially §§1–4,6–13,16,18–19. Historical-work PD declaration on work page:
  https://en.wikisource.org/wiki/Compendious_Syriac_Grammar
  Actual consulted chapter:
  https://en.wikisource.org/wiki/Compendious_Syriac_Grammar/Part_1/Chapter_1

Only our paraphrases/citations are included, not copied dictionaries, grammar HTML,
modern Wikisource contributions, OCR exports or apparatus. Historical aids help analyze
Syriac; they are not an English scripture pivot. The unread grammar syntax sections are
not cited as authorities. More source research is not a substitute for independent
qualified human judgment.

No scan image included. The earlier scan reference is
https://archive.org/details/newtestamentinsy00unse/page/n133/mode/1up ; printed-edition
pointing/punctuation of **1:6–13 has not been fully collated**. No image redistribution
permission was established. Do not attach the prior source-packet ZIP containing scans.
Detailed item-level rights scope and examination limits: `supporting-sources.json`.

## Validation versus language review

From the repository root, run both bounded packet validators:

```sh
python3 docs/translation-review/john-1-1-5/validate.py
python3 docs/translation-review/john-1-6-13/validate.py --self-test \
  --baseline-pilot docs/translation-review/john-1-1-5/pilot.json
(cd docs/translation-review/john-1-6-13 && sha256sum -c SHA256SUMS)
```

Python 3's standard library is sufficient for these offline checks. Optional
`--module <cached-official-Peshitta.zip>` re-extraction requires the separately
prepared, published PySword 0.2.8 reader. It is not an app dependency or an
instruction to install new packages or fetch any archive. No module or scan
archive is committed here. The source research worker performed the cited
lexicon/grammar inspections; this integration is not an independent linguistic
or printed-edition review.

The validator checks exact bounds, IDs, immutable source hashes, byte-preserved
comparisons/edits, config/version/rights metadata, target/alignment integrity, supplied
word records, source-name identity, registers, unreviewed/nonpublishable gates, original
1:1–5 audit retention and checksum manifest. Negative mutations test rejection of
selected violations. It **does not** prove lexical, grammatical, theological or
translation accuracy. The unchanged app CI does not automatically run this documentation validator; run it separately as above. App regression/types/data/build/SSR results are recorded in the PR, not treated as linguistic approval.

Before publication: independent qualified Syriac, contemporary-Greek and Hebrew human
review; resolve recorded alternatives and name policy; explicit provenance and source
selection; independent verse/alignment check; documented reviewer decisions and fresh
publication approval. User trust is not completed human review. No release is authorized
by these working drafts. No passage beyond John 1:13 is added by this integration.
