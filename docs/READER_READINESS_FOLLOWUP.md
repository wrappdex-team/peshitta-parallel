# Initial reader readiness follow-up

No translation/source/locale edits. Reading routes load public initial text before
rendering; optional parallels remain lazy. The chapter loader returns only the
requested chapter, not keys, preferences or request headers. Words initially loads
Matthew for SSR; later book switches retain client loading. This uses existing
catalogue/edition data, including later-book flags, without certifying its accuracy.

## CSP boundary: staged, NOT fixed by this patch

Observed public policy permits inline scripts and Grok's extension origin.
`grokExtensionsHeadTags` in `scripts/grok-pwa-shared.mjs` injects the platform
extension by default; a supported opt-out exists, but its platform/preview effects
have not been browser-tested. No extension, protection or configuration is disabled
here. Core reader code does not directly import that extension; this is not proof
that removing platform behavior is deployment-compatible.

A nonce/hash solution must coordinate the response header with dynamic Start
hydration/streaming scripts, JSON-LD, theme initialization and platform injections.
A meta tag cannot safely replace that response-level work. Stage a separate change:
first inventory scripts and platform requirements, validate a restrictive policy
in report-only mode with approved deployment configuration, then prove hydration,
client navigation, PWA and Studio work before enforcing it. Never add broad policy
exceptions merely to silence CSP errors. This requires separately reviewed runtime
and real-browser work, not a cosmetic claim of XSS protection.

Existing BYOK/session-only storage, exact legacy cleanup, cache isolation, quotas
and provider deadlines are unchanged. Accurate privacy copy explicitly describes
server-to-provider credentials, network voice possibility, page-script access and
billing uncertainty. No proven XSS exploit or full security audit is claimed.

## Voice guidance

Public official guidance opened November 8, 2026:

- https://support.apple.com/guide/iphone/hear-whats-on-the-screen-or-typed-iph96b214f0/ios
- https://support.apple.com/en-us/111798
- https://support.apple.com/guide/mac-help/mchlp2290/mac
- https://support.google.com/accessibility/android/answer/6006983?hl=en

Instructions distinguish current Read & Speak from older Spoken Content labels,
engine/manufacturer variation and downloads. The app cannot install voices, promise
any accent/language/Syriac pronunciation, or guarantee browser exposure to system
voices. Missing automatic language matches now require explicit voice choice or
setup instead of silently falling back to another language. Existing Android
engine selection and synthesis-failed retry behavior are retained; a language
hint is not a guarantee that a browser honors the selected voice.

## Review boundaries

Component/provider tests use synthetic voices and mocked fetches. Compiled SSR
checks must assert actual rendered verse markup, not only loading shells. These
checks do not certify mobile/browser speech, assistive technology, hydration or
live-provider behavior. Review the expanded help drawer on narrow screens and
with the virtual keyboard, and exercise language/book changes, voice download
refresh, reader/Words navigation, native dialog focus and speech interruption in
real browsers before release. No paid test is necessary for that device pass.
