# Seven formerly empty verses: provenance notes and search repair

**Documentation and search index only. No scripture text is changed. Not a
linguistic, source or publication certification.**

## What shipped, and by whom

Before main `442b8a8` ("Restore Peshitta verses that were blank or on the wrong
line.", 2026-11-08 20:31 EST), the `en`/`el`/`he` fields were empty at Matthew
26:30; Mark 8:19, 9:31, 11:19; Luke 18:35; Acts 19:41, 20:17. That Build commit
filled all 21 fields. **The shipped wording is Build's.** It is not verbatim
Murdock, and that commit records no source for it. An earlier AI-assisted
proposal in this PR was withdrawn in favour of the shipped wording.

`scripture-gap-sources.json` (schema 2, base `5206982`) records per verse:
the existing Syriac and its SHA-256, the CrossWire Peshitta 2.0 comparison
extract, the Murdock 1852 quotation with print leaf/page/URL/scan hash, the
shipped `en`/`el`/`he` strings, and a word-level list of where the shipped
English differs from Murdock (case and punctuation ignored). For example,
Acts 19:41 Murdock "assembly" vs shipped "crowd"; Acts 20:17 "called… church at"
vs "brought… assembly of"; Luke 18:35 "they came… Jericho… by the side of the
way" vs "he drew… Irikho… certain… beside the road". Mark 11:19 has no word
differences. Greek and Hebrew are Build's modern renderings; their source path
is not recorded and they are not compared with Murdock.

## Murdock 1852 reference (what the notes document)

James Murdock, _The New Testament … A Literal Translation from the Syriac Peshito
Version_, N.Y.: Stanford and Swords, **1852**:
https://archive.org/details/newtestamentorbo1852murd (item metadata:
`possible-copyright-status: NOT_IN_COPYRIGHT`; concerns the historical work, not
a licence for scan images; no images are included). Passages were read in the
print; OCR was only a locator (its object indexes are offset by three from the
scan leaves). Leaves 78, 102, 105, 110, 171, 280, 281; printed pages 54, 78, 81,
86, 147, 256, 257.

CrossWire's Murdock 1.2 module (Public Domain) is **empty at all seven
references**, so it cannot supply these quotations. CrossWire Peshitta 2.0
(BFBS 1905, Public Domain) matches the app's Syriac for four verses after
removing the module's trailing spaces; Mark 8:19, Luke 18:35 and Acts 20:17
differ by four U+0723/U+0724 spellings. Neither text was normalized or replaced.

## Search index

Main's `search.json` had 7,950 rows: the seven filled verses were unsearchable,
and Matthew 16:18 still held its English from before Build commit `403a097` ("on this rock"). The index
is rebuilt from main's current English in canonical order: 7,957 rows, one per
populated verse. Only those eight rows change. A test now requires the index to
equal the populated English verses exactly.

## Not changed

Scripture/translation JSON, the data-gap baseline, the audit allowlist, README,
the generator (`translate_el_he.py`) and all runtime code are main's. Review of
Build's wording, Matthew 16:18 and the realigned parallel lines remains open.
