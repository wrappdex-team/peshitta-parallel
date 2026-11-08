# Bounded local media request state — review-only follow-up

Baseline: released main `bcc52d1e37229953e5b1441f482cd64ffd4ed328`.
This follow-up is prepared for review, not approved for merge or production
publication. BYOK, browser speech, player UI and generation behavior are unchanged.

## Evidence and scope

Studio and legacy `speakPart` previously retained a timestamp array for every
caller identity ever admitted. Only the caller that returned had its timestamps
filtered; identities that never returned stayed in the Map indefinitely.
A deterministic mocked test of the actual Studio handler admitted 100 distinct
identities, advanced beyond ten minutes and admitted a new identity: **101**
entries remained, where only one still needed state. The new regression fails
on the baseline and passes with this fix. Legacy admission uses the same pattern.

`createLocalRateLimiter` now supplies both existing process-local counters:

- At most **4,096 identity/action records per limiter instance** (one shared by
  Studio, one for legacy generation). Identifiers are capped at 128 characters;
  normal IPv4/IPv6 plus action suffixes fit. Oversized and empty identifiers fail
  closed rather than being retained. This length check is not IP validation or
  proof of caller identity; existing forwarded-header/fallback behavior remains.
- Successful admissions order records by their last accepted monotonic timestamp.
  On the next valid limiter call, wholly expired records are removed from the
  front, stopping at the first live record. No periodic timer or external store
  is introduced. An idle instance may retain expired records until another call,
  but never more than the configured bound.
- At capacity, **unknown identities are denied; active records are never evicted**.
  Otherwise an identity-rotation/LRU strategy could erase an exhausted caller's
  quota. Existing callers can still use their remaining quota. New legitimate
  callers may therefore receive the existing rest/retry error under saturation
  until records expire: this is the deliberate memory-safety tradeoff.
- Timestamp arrays keep the original rolling-window semantics and count admitted
  requests, not completions. Rejections do not renew expiry. Admission is fully
  synchronous before provider work awaits, preventing same-instance concurrency
  from overshooting the existing quota.
- The default clock is monotonic `performance.now()`. A backward injected clock
  is clamped and nonfinite readings fail closed; no wall-clock adjustment can
  create an early default-clock reset.

## Quotas and polling compatibility

The ten-minute limits remain unchanged: Studio shaping **30**, images **8**,
video starts **3**, audio **12**, per caller/action; legacy uncached generation
**80**, per caller. Cache-hit behavior is unchanged and BYOK remains checked
before legacy cache access. A quota admission is not a provider-call/currency
cap: retries or multi-step Studio work can make more than one provider operation.

Video-status polling still has **no application counter**. This is a known gap,
not covered by the new limiter. The UI's normal 24-check sequence at five-second
intervals is preserved and tested. A per-job/caller polling budget needs separate
review rather than an arbitrary new limit in a memory-retention fix.

## Tests and remaining limitations

Deterministic tests cover exact expiry, staggered rolling windows, expiry-order
refresh, rejected-attempt retention, capacity/long-key bounds, active-entry
protection under identity rotation, nonfinite/backward clocks and parity with
10,000 baseline rolling-window decisions. Mocked actual Studio/legacy handlers
exercise stale cleanup and parallel quota admission; all original quotas, BYOK
checks, free reading and normal polling remain covered. Only synthetic provider
responses and a synthetic clock/environment are used; no real API calls occur.

These remain **best-effort per-process controls**, reset on instance restart and
independent across multiple instances. Caller identity is still derived from the
first forwarded-header value or shared fallback; proxy trust was not live-tested.
There is no durable quota, authenticated identity, global spending cap or new
infrastructure. Shared legacy-cache ownership, existing browser credential/XSS
exposure and provider deadline/error handling remain separate concerns. No
provider key is added to limiter state or logs. Aikido's known setup outage was
not retried and no completed security scan is claimed.
