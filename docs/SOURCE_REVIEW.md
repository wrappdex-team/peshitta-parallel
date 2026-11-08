# Source-grounded translation and original-names review policy

This is a review requirement, not a certification of the current corpus.

INjeel keeps the Syriac Aramaic source visible and aims to keep the identity and
original name of every person consistent across languages, including names of
places and historically specific objects. Language-local pronunciation guides
may help readers, but must not silently replace a source name with a localized
substitute or imply a certainty that the sources do not support.

Before approving a textual or pronunciation change, record in its pull request:

- Exact book/chapter/verse, source edition/manuscript identifier, stable citation
  and permitted usage. Identify later textual traditions, variants, missing
  source material and editorial decisions explicitly.
- Source-script name or term, an identity key linking occurrences across
  languages, and a sourced transliteration. Distinguish persons, places and
  culturally specific/relic objects rather than conflating similar spellings.
- The named pronunciation tradition (for example, an identified East or West
  Syriac tradition), reference evidence and reviewer. A modern tradition or
  synthesized voice is not proof of first-century pronunciation. Mark uncertain,
  reconstructed or disputed readings as such; do not fabricate audio evidence.
- Translation method: direct source translation, English-mediated study reading,
  human revision, or machine-generated draft. Name the intermediate edition and
  retain a traceable change history. Distinguish explanation from scripture.
- Qualified Syriac and target-language review, especially names, idioms,
  singular/plural distinctions, theological terms, omissions and variant readings.
  Automated structure checks alone are insufficient.
- Separate rights review for source scripture, parallel translations, lexicon,
  fonts and media. A proposed MIT code licence cannot confer scripture rights.

Repository evidence: `scripts/translate_nt.py` calls the existing readings study
translations of Murdock's English and contains localized-name instructions.
This conflicts with the desired original-name invariant and needs review before
any future generation. Do not execute that script or treat it as an approved
source-first pipeline. This pass intentionally changes no scripture, names,
pronunciation, licence or existing generation prompt. A future reviewed term
registry and linguistic test corpus should implement the policy, not replace
scholarly judgement with string substitution.

All study access should remain free. Do not trade source fidelity, review,
transparency or permissions for a daily language-release quota.
