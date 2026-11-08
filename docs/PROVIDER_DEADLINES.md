# Media provider I/O deadlines — review-only follow-up

Baseline: released main `953d638c61a43ebd2733170a4d58891873f1f930`.
This change requires fresh explicit permission before merge/production publication.

## Reproduced defects, not a live probe

Studio had no application deadline or catch around provider fetch/body reads.
A deterministic mocked actual `makeImage` handler stayed pending after the new
four-minute budget; mocked `checkVideo` rejected with its original transport
error containing synthetic sensitive text. These two regressions fail on the
baseline. This proves missing application-level termination/sanitization, **not**
an observed production credential leak: framework error serialization and real
provider/platform timeout behavior were not probed.

Registered legacy `speakPart` forwarded a caller signal and sanitized thrown
errors, but supplied no application deadline. A caller that did not disconnect
could still wait for transport/platform termination. It remains registered even
though the current reader uses free device speech rather than calling it.

## Explicit operation budgets and rationale

| Operation | Whole provider-phase budget | Why |
| --- | --- | --- |
| Prompt shaping, image generation, video submission, Studio audio, legacy speech | 240 seconds | A deliberately generous common ceiling rather than unsupported provider-specific latency guesses. It leaves 60 seconds of framework/finalization headroom under Vercel's documented 300-second Fluid default. Images/generation need more room than a status lookup; no existing provider/model is removed or shortened to a speculative few seconds. |
| One video-status lookup | 15 seconds | This only retrieves job state; it does not wait for video rendering. Three existing five-second UI polling intervals allow transient lookup latency without treating a stuck lookup as an indefinitely busy Studio. The existing 24-check count remains unchanged. |

These are reviewable **application budgets, not provider SLAs or measured latency
claims**. Vercel's current limits are documented at
https://vercel.com/docs/functions/limitations#max-duration (read November 8, 2026).
The emitted local function config has Node.js 24 and no duration override. The
live project's Fluid/duration settings were **not** read or changed: a lower
runtime/proxy limit may still terminate a request earlier. No setting increase,
new SDK, dependency or infrastructure is included.

A budget starts immediately before provider work, after existing BYOK/validation,
caller/quota checks and local scripture loading. It covers fetch **and complete
JSON/binary body consumption**, including any existing intermediate audio
translation and the legacy transient-status retry/backoff; a second step does
not reset the timer. Local loading/CPU serialization and total browser workflow
time are not newly bounded.

## Cancellation, errors and paid-job uncertainty

`withProviderDeadline` races the full operation against its deadline and any
available incoming request signal, forwarding one AbortSignal to all provider
fetches. An already-aborted request starts no provider work. The deadline timer and incoming
signal listener are removed on every terminal path; abort also releases unread
error bodies. A pending adapter that ignores abort cannot keep the **handler**
waiting, but arbitrary non-cooperating I/O cannot be forcibly stopped.

Network/parse failures and timeouts return fixed sanitized `{ ok: false, error }`
results without copying provider exception text, response bodies, keys or prompts
into errors/logs. Existing sanitized HTTP-status errors and successful payloads
remain unchanged. No new automatic retries are introduced; the existing legacy
xAI retry for 429/500/503 remains at most two attempts inside the same budget.
The existing 600 ms legacy backoff can finish after cancellation, but its next
iteration checks the aborted signal and cannot submit another provider request.
Timeout/cancellation must not add a retry or start a later paid audio step. Late
legacy results cannot fill the shared cache after the handler has timed out.

**Aborting HTTP is not confirmation that a provider job was cancelled or will not
be billed.** A video may have been accepted before its response was lost, leaving
no recovered request ID. Errors explicitly direct the reader to check their
provider before starting again. A status timeout stops the existing UI polling
loop with an error; the existing film can still finish, and no new film is
submitted automatically. Job recovery/idempotency or a revised polling UX needs
separate product/provider review, not automatic duplicate generation.

Incoming cancellation only propagates when the runtime actually aborts its
Request signal. No cancellation setting or player/UI behavior is changed.

## Verification and remaining scope

Synthetic clock/timer and provider tests exercise every supported provider branch:
stalled headers/body reads, exact budget boundaries, pre/in-flight cancellation,
transport/body errors, late translation/cache protection, preserved retries,
success/HTTP-error compatibility and listener/timer cleanup. A native Response
body cancellation test checks rejection handling. No real keys, provider calls,
paid work, production probes or DB operations are used.

BYOK/no-site-key fallback, process-local quotas/capacity, normal polling count,
free scripture/device speech, UI, models/prompts and corpus bytes are unchanged.
Deadlines are best-effort event-loop I/O bounds, not CPU preemption, response-size
limits, durable job recovery, global concurrency/spending caps or distributed
abuse protection. Shared-cache ownership and browser key-storage/XSS concerns
remain separate. Aikido's known setup outage is not retried; no completed security
scan or new browser/hydration/provider-integration QA is claimed.
