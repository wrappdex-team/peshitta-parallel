# Provider key storage and legacy cache isolation — review-only follow-up

Baseline: released main `d88a2f1f0893cb7d7b9640ce6192fd2072be9f7c`.
Fresh explicit permission is required before merge/production publication.

## Authorized session-only storage policy

This follow-up replaces Studio's previous raw `localStorage` credential with raw
**sessionStorage** under the app's exact `injeel-agent` key. Same-tab refresh
normally retains it. Session data is normally tab-scoped, but browser restore,
opener and duplicate-tab behaviors can preserve/copy it. Tab/session storage is
not encrypted-key protection, a guarantee of secure erasure, or XSS prevention:
JavaScript executing in the origin can still access an in-use/saved session key.

On Studio component mount/open and Save/Clear, the app attempts to remove only
its exact old persistent `injeel-agent` entry, **without reading its value or
copying it to session storage**. Visitors with only a previously device-saved key
must re-enter it. Other settings/progress are not cleared; existing nonsecret
Studio preferences remain in localStorage. Cleanup and policy replacement occur
only when this code is used after deployment; no real browser values were
inspected, deleted or migrated during development.

Restore/Save/Clear catch denied storage access and operations. There is no
persistent or active-memory fallback when session storage fails: Studio remains
or becomes disconnected, while reading/device speech remains available. Save
failure also attempts to remove a stale session entry. If the browser blocks
legacy/session removal, fixed visible warnings explain that stored values may
remain and a session key may return after refresh. A blocked Clear disconnects
current React state; it cannot guarantee deletion from storage that denies access.
The password draft may remain for a manual retry after Save failure but is not
activated as a provider credential.

Compiled-component event/effect tests use only synthetic Map-backed local and
session stores, dummy keys and simulated denial. They cover Save/refresh/Clear,
legacy cleanup without reads/copying, no persistent credential writes or broad
clears, preserved unrelated values, blocked reads/writes/removal/accessors and
honest lifecycle/error copy. No real browser profile/storage, credential, account
or provider request is accessed. These are component tests, not browser QA.

This reduces retention; it is **not proof of fixing an exploitable XSS
vulnerability**. No raw HTML/eval or key-logging sink was found in the narrowly
reviewed Studio/agent/speech files, not a whole-app/third-party/dependency audit.
Studio still sends the supplied key through its server functions to the selected
provider for requested work. Format recognition is not provider validation or
human identity. No encryption or account/auth infrastructure is introduced.

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

## Review and remaining scope

The user explicitly approved preparation of session-only storage, not publication.
Memory-only or opt-in persistent alternatives are not implemented. Browser-specific
restore/duplicate behavior, mobile and hydration interactions still need real
browser review in an isolated profile; no real key or generation request is needed
for that smoke test. The cache-only initial patch left public assets identical;
this authorized storage follow-up intentionally changes the Studio client code.
HMAC cache isolation, BYOK, quotas, deadlines, free reader/browser speech, player
logic, content and other storage keys remain unchanged.

Aikido's known setup outage is not retried; no completed security scan or live
provider/browser security assessment is claimed. Shared-process rate-limit,
video polling/job recovery and other previously documented limitations remain.
