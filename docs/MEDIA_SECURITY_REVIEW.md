# Media access and visitor-key policy (prepared, not published)

Reviewed against main `af422bdde7244ccd1ac2a174b43f0e4de59c49a1`.
The user approved preparing a visitor-owned-key requirement in PR #3, **not**
merging or publishing it. Production retains its existing behavior until a
separately approved merge/release. This is not a live penetration test or a
claim that media generation has a complete abuse-control boundary.

## Application media policy in this PR

- `resolveAgent` recognizes only the key supplied with the request. It never
  reads a site credential or falls back to `XAI_API_KEY`. Missing, blank and
  unrecognized keys resolve to no agent.
- All five Studio POST handlers require a visitor key, including prompt shaping
  and video-status polling. Existing provider capabilities remain: xAI media,
  OpenAI images/audio and Claude prompt shaping. Provider authentication, job
  access and billing remain the provider's responsibility.
- Legacy `speakPart` checks for a supported visitor key **before** looking at
  cached audio or loading chapter data. Oversized keys are rejected rather than
  truncated into a different key. A warm cache cannot bypass the requirement.
- Prefix/length recognition is not proof of provider acceptance or key ownership.
  A rejected provider key is never retried with an owner's credential. Existing
  generated-audio cache entries are still shared by reading reference rather
  than provider identity; accepted-format keys may receive a cache hit without
  a provider authentication request. No new raw-key or fingerprint storage is
  introduced by this change.
- Studio states that a personal provider key is required and explains that it is
  saved on this device and sent through this server to the selected provider
  when Studio work is requested. Provider charges apply. Work actions are
  disabled without a recognized saved key and also guarded in their callbacks.
  The existing storage keys, save/remove operations and persistence scope are
  unchanged; no new credential logging or storage is added.

## Active versus legacy paths

Reader and Words pages actively mount Studio. The current Read button instead
uses browser `speechSynthesis`; normal scripture reading and device Read require
no provider key. The voice-player UI and reading/name/translation data helpers
are unchanged.

`src/lib/speak.ts` still defines legacy paid `speakPart` and is imported for
reading-data helpers. No current UI call to it was found, but the isolated
compiled server-function manifest registers its handler. It is UI-unused, not
safely classified as an unreachable backend path, so the policy covers it too.
The generic connector/auth scaffolding does not authorize these media handlers.

## Evidence and limits

Tests transpile the real agent, Studio and legacy speech modules into isolated
VM contexts. Framework adapters, fixture chapter data, fetch and a synthetic
process environment are mocked; no application key-selection or handler logic
is copied. Missing/blank/invalid keys are tested across all six handlers; valid
visitor keys, provider capabilities and the legacy warm-cache gate are covered.
The environment spy proves that the available synthetic site key is not read.
React static rendering checks the no-key Studio copy/disabled actions, and free
reading-data helpers are exercised without credentials. These are unit/SSR
checks, not deployed browser or real-provider integration tests. No real site
key was read, configured or verified.

BYOK removes the application's owner-key fallback, **not** all abuse risk:
request counters remain process-local and reset across instances/restarts;
unused identity entries are not pruned; video polling has no application counter.
The first `x-forwarded-for` value or a shared fallback identifies callers; proxy
trust was not live-tested. No durable quota, verified user identity, explicit
provider deadline or consistently wrapped network/JSON handling is introduced.
Existing local-storage/XSS exposure and legacy cache ownership require separate
review. No new infrastructure, provider model/prompt, generated content,
scripture, translation, names, pronunciation or licence data is changed.

Aikido remains unavailable from its previously established setup failure. It was
not retried and no completed scanner result is claimed.
