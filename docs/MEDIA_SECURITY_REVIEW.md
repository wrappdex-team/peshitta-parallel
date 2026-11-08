# Media access and key-routing review

Reviewed against main `af422bdde7244ccd1ac2a174b43f0e4de59c49a1`.
This is a bounded source/mocked-handler review, not a live penetration test or a
claim that public media generation has a durable spending limit.

## Active versus legacy paths

- Reader and Words pages mount `src/components/studio.tsx`. Its five POST server
  functions in `src/lib/studio.ts` shape prompts, generate images/audio, start
  videos and poll video status. They use `resolveAgent` and contain no explicit
  user authentication/authorization middleware.
- The current Read button uses browser `speechSynthesis`, not paid `speakPart`.
  `src/lib/speak.ts` still defines that legacy server function and is imported
  for reading-data helpers. No current UI call to `speakPart` was found, but
  the isolated compiled server-function manifest **still registers its handler**.
  It is UI-unused, not safely classified as a removed/unreachable backend path.
- The generic connector/auth scaffolding is not an authorization boundary for
  these Studio handlers. Framework POST/method protections are not spending
  authorization either.

## Proven defect and narrow safeguard

Previously an explicitly supplied, unrecognized key silently fell back to the
optional server `XAI_API_KEY`. Mocked execution of the actual Studio validator
and handler bodies reproduced provider calls with the site fixture's key rather
than rejecting the reader's invalid selection.

`resolveAgent` now rejects nonblank unrecognized input before consulting the
site environment. All five Studio handlers already return a failure when no
agent resolves, so those requests now make **zero** provider calls. Supported
reader-key formats still take precedence. Provider authentication remains the
provider's responsibility; prefix recognition does not establish key validity.

Omitted/blank keys still use the optional site-funded path, if configured. This
preserves the existing UI's explicit “Disconnected. The site agent will be used”
behavior. No site key was read, configured or verified during this review.
Keys supplied by the reader are sent through the backend to the selected
provider; local storage is not a promise that a key never leaves the device.

Tests transpile the real modules into isolated VM contexts. Only the small
framework registration/request adapters, provider fetch and process environment
are mocked; no application routing logic is copied. The environment contains
only synthetic key fixtures. These are handler/unit regressions, not deployed
HTTP or browser tests.

## Remaining decisions and limitations

- Site-funded generation remains intentionally possible without a reader key.
  Whether to retain anonymous site funding, require reader-owned keys, or gate
  an owner-funded allowance by verified identity is a **product decision**. This
  patch does not choose among those policies or claim to prevent public spending.
- Studio request counters are process-local, keyed by the first
  `x-forwarded-for` value (or a shared `reader` fallback), and reset across
  instances/restarts. They do not establish a global quota. Trust in that header
  depends on the actual hosting proxy; no spoofing test was made against live
  systems. Inactive identities are not globally pruned. Video-status polling
  currently has no application-level counter.
- Legacy `speakPart` has a process-local limiter/cache and the same resolver.
  Its cache is shared by reading reference, not provider identity. Separately
  decide whether to retain/expose this UI-unused server generation feature; this
  patch does not remove it or change playback.
- Provider calls in Studio lack explicit deadlines and consistently wrapped
  network/JSON error handling. Distributed limits, authorization, timeouts and
  cache ownership need their own reviewed work; no service, account, persistence,
  provider model/prompt, translation or media-generation policy is changed here.
- Aikido scanning remains unavailable from the previously established service
  setup failure. It was not retried and no completed scanner result is claimed.
