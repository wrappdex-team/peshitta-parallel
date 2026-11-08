# Provider key storage and legacy cache isolation — review-only follow-up

Baseline: released main `d88a2f1f0893cb7d7b9640ce6192fd2072be9f7c`.
Fresh explicit permission is required before merge/production publication.

## Active storage behavior: observed in source and dummy-only tests

Studio reads `injeel-agent` from origin-local `localStorage`, keeps it in React
state, saves the trimmed recognized key back to that store and removes it when
the existing Clear control is used. The stored credential is raw, not encrypted;
the password input masks editing but does not protect the saved value from
JavaScript executing in the page's origin. Studio sends the supplied key through
its server functions to the selected provider for requested work, as existing
copy discloses. Format recognition is not provider validation or user identity.

A compiled-component event/effect harness proves restore, Save/reload and Clear
against an exclusively synthetic Map-backed storage object and dummy key. It also
checks that a restored key is not inserted into rendered markup or the blank
password field. No real browser profile/storage, provider credential, account or
provider request is accessed. These are component tests, not browser/hydration QA.

This is **potential credential exposure if same-origin JavaScript is injected or
compromised**, not proof of an exploitable XSS vulnerability. No raw HTML/eval or
key-logging sink was found in the narrowly reviewed Studio/agent/speech files;
that is not a whole-app XSS or dependency/third-party-script security audit.
This PR does not change persistence, migrate/delete saved keys, or claim encryption.

## Proven backend cache boundary defect

Registered legacy `speakPart` cached audio by book/chapter/voice/language/part only.
After one credential populated a reading, another recognized-format credential
could obtain that audio without its provider being consulted, even when the mock
provider would reject that second credential. A second regression seeded differing
synthetic provider results under two credentials: the later caller incorrectly
received the first caller's audio. Both actual-handler regressions fail on the
baseline and pass with isolation. These are offline mocked reproductions, not
production exploits or evidence of private scripture text exposure.

Reachability is precise: `speakPart` remains a registered server function, but no
current UI caller was found. The reader uses free browser/device speech; Studio
uses its separate generation handlers and does not use this legacy cache.

## Narrow fix and compatibility

The legacy cache key now includes a credential scope plus all original reading
reference dimensions. The scope is **HMAC-SHA-256(provider kind, normalized key)**
under a private 256-bit cryptographically random per-cache-instance secret. The
non-extractable signing key is initialized lazily with native Web Crypto only when
server cache scoping is requested, and remains only in process memory. No environment credential, new
service, dependency, file persistence or account infrastructure is needed.

Map keys contain only the opaque digest and reading reference, not raw provider
keys, reversible encodings or a public unsalted credential hash. No digest or
secret is added to responses/logs. Concurrent first requests initialize one seed;
a fresh cache instance uses a fresh seed. Cryptographic initialization failure
returns a fixed failure before book/provider work; there is no unscoped/raw-key
fallback. Existing source types, native Web Crypto and deterministic seeded tests
verify the implementation, not a substitute home-grown hash.

Same normalized credential/provider still reuses its own generated reading.
Different credentials/providers cannot seed or reuse each other's entries.
A different credential's first reading can therefore need its own provider work
and charges instead of reusing another credential's result; no automatic retry
is added. The cache remains globally bounded at ten entries with unchanged
eviction/reference behavior. BYOK is still checked before cache access; quota
and provider deadline/cancellation behavior, models/payloads/cues and all UI,
free reading/device speech and corpus bytes are unchanged.

This is credential isolation, **not authenticated human ownership**: people
sharing one provider key share a scope, and a same-key cache hit still does not
revalidate provider acceptance/revocation. Existing no-TTL, process-local/restart
and multi-instance cache limitations remain. Any fresh identity/expiry policy
requires separate review; this PR does not introduce accounts or durable storage.

## Storage policy decision deliberately left open

Possible separately approved choices are memory-only keys (re-enter after reload),
sessionStorage (tab/session retention, still JavaScript-readable), or explicit
opt-in device persistence with honest risk disclosure. None prevents hostile
JavaScript from accessing an in-use key; reducing storage lifetime is not an XSS
fix. Migration/deletion of existing saved keys needs an explicit user decision.
No such policy or real saved key was changed in this pass.
The isolated compiled public-asset manifest is byte-identical to the released
baseline; the HMAC helper is retained only in the server build.

Aikido's known setup outage is not retried; no completed security scan or live
provider/browser security assessment is claimed. Shared-process rate-limit,
video polling/job recovery and other previously documented limitations remain.
