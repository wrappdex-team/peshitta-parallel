# Seven verse gaps: bounded source repair proposal

**AI-assisted additions; independent qualified Syriac/English/modern Greek/modern
Hebrew review remains pending. Not a recovery of ancient Greek/Hebrew originals,
not a whole-edition direct-Syriac claim, and not a publication approval.**

## Exact scope and accounting

Starting main: `30ff2b3e06e977068106927d08c2168c4c3f9cab`.
Matthew 26:30; Mark 8:19, 9:31, 11:19; Luke 18:35; Acts 19:41, 20:17.
Only the 21 empty `en`/`el`/`he` positions are filled. All existing nonempty text,
verse IDs, Syriac strings, other languages and runtime behavior are preserved.
Each of `en`/`el`/`he` now has 7,957 nonblank slots across 27 books/260 chapters; this is
positional coverage, not a claim of semantic completeness or perfect alignment.

The initial full audit found **92 blank fields**. This proposal resolves **21**,
leaving **71**, not zero: `aii/de/es/ja/zh` have 10 each; `ar/fr/ru` have 7 each.
The exact remaining references stay enumerated in `data-known-gaps.json`.
The eight older parallels still lack the seven references above; additionally
`aii/de/es/ja/zh` lack Mark 4:10, Matthew 26:45 and 2 Corinthians 13:14.
Those texts are not silently fabricated or repaired in this proposal.

## Identified English evidence, not invented module contents

James Murdock, _The New Testament … A Literal Translation from the Syriac Peshito
Version_, N.Y.: Stanford and Swords, **1852**, is the identified print comparator:
https://archive.org/details/newtestamentorbo1852murd . Its item metadata reports
`possible-copyright-status: NOT_IN_COPYRIGHT`; this concerns the historical work,
not a blanket licence to redistribute archive images. No images are in this PR.

The seven passages were visually read in the print. OCR was only a locator:
its object indexes differ from actual scan leaves by three here. The explicit
resource mappings, not assumed OCR indexes, locate leaves **78, 102, 105, 110,
171, 280, 281**, printed pages **54, 78, 81, 86, 147, 256, 257** respectively.
Per-verse URLs, source image hashes and exact transcribed verse quotations are
in `scripture-gap-sources.json`. Line wrapping is joined; verse numbers and
superscript footnote markers are not included in the quotation. No modern
copyrighted translation is copied.

CrossWire identifies its Murdock 1.2 module (2002-01-01; About says Published 1852) as **Public Domain**, but the actual downloaded module is **empty at all
seven references**. It therefore cannot supply these quotations:

- https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Murdock
- https://www.crosswire.org/sword/copyright/ModInfoCopyright.jsp?modName=Murdock

The additions are **not verbatim Murdock quotations**. English is a modernized
AI-assisted adaptation checked against the existing Syriac; modern Greek and
modern Hebrew use that Syriac and the identified English evidence/adaptation.
The manifest distinguishes source quotes from all three proposed renderings.
Notable decisions include Luke 18:35's singular approach in the existing Syriac
versus Murdock's plural “they”; edition-consistent Irikho/Ιεριχώ/איריחו; plural
“they” at Mark 11:19; and assembly/σύναξη/עדה rather than silently claiming
Murdock wrote “assembly” where Acts 20:17 prints “church.” These choices remain
open to qualified lexical/grammatical review. Names follow adjacent existing
edition spellings; no comprehensive original-names certification is made.

## Bounded Syriac comparison and rights limits

Comparator: BFBS 1905 digital text courtesy John Richards, distributed by
CrossWire as **Peshitta 2.0 (2020-02-08)**, declared Public Domain:

- https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Peshitta
- https://www.crosswire.org/sword/copyright/ModInfoCopyright.jsp?modName=Peshitta

The exact seven module extracts are recorded. Four match the existing app after
only removing the module's trailing ASCII spaces for comparison. Mark 8:19,
Luke 18:35 and Acts 20:17 have four total U+0723/U+0724 spelling differences;
all edits are explicit in the manifest. **Neither source nor app was normalized
or substituted.** This is verse-level reference compatibility, not historical
import provenance, manuscript identification or whole-corpus print collation.
Source metadata/hashes do not establish vocalization or interpretive certainty.

Public-domain declarations concern the identified historical texts, not every
font, editorial layer, scan image or other edition. New AI-assisted wording has
no blanket rights warranty; the repository/edition licence still needs an
explicit maintainer decision. Existing Murdock year discrepancies elsewhere are
not silently resolved by this bounded 1852 citation.

## Validation and existing editions

`el`/`he` are added to the structural coverage declaration because their 27-book
arrays are now present and checked. This is **not** a qualified linguistic-review
allowlist. The validator still rejects undeclared locales, new blanks, malformed
values and misalignment; its exact known-gap list shrinks by seven English
entries and does not acquire any Greek/Hebrew gap exceptions. Negative mutations
reintroduce repaired blanks and corrupt/remove Greek/Hebrew data to prove failure.
Source tests pin the seven Syriac strings and all 21 proposed values.

The existing `translate_el_he.py` remains untouched: its original edition workflow
uses English as its generation input. This repair does not relabel the entire
Greek/Hebrew edition as independently translated directly from Syriac, reviewed
by humans or free of errors. No generator, provider or paid service was called.
PR12's separate runtime/SSR/voice help changes are not imported here.
