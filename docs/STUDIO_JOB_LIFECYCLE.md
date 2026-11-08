# Studio asynchronous results and video job lifecycle

## Reproduced defect

The reader and Words pages keep Studio mounted while it is closed. A visitor can
start work for passage A, close Studio, and reopen it with another selection B.
The existing passage effect clears prompt/media/status, but an outstanding promise
could subsequently put A's prompt, media URL or error into B's Studio. Returning
A → B → A could also revive the obsolete result. A stale shaped prompt could then
be used by a later explicit Make action for the wrong selection.

The component tests reproduce this with the real handlers, dummy Map-backed
storage, mocked server functions and manually advanced five-second delays. On the
previous code, old video URLs/errors and shaped prompts repopulate the reset UI;
completion also attempts state writes after unmount. No real provider is called.

## Narrow safeguard

Each committed passage has a distinct effect-owned activity object. Passage
changes and unmount invalidate it permanently. Async prompt/media/status writes
publish only to their original still-active passage. Comparing passage strings
alone would not protect A → B → A, hence the activity identity.

The original operation continues to own busy until its existing terminal path;
changing selection does not release the controls early or submit another job.
Finally releases busy only while this Studio instance remains mounted. Closing
and reopening the same unchanged passage does not invalidate running work: that
existing background-completion behavior is preserved.

The video loop is unchanged: one submission, then at most 24 sequential status
requests, each preceded by a five-second delay. A pending lookup does not schedule
another overlapping lookup. Status failures stop the loop. No generation retry,
provider idempotency header, cancellation claim, new storage or dependency is
introduced. BYOK/session-key handling, provider deadlines and quotas are unchanged.

After exhaustion, the message now distinguishes stopped status checking from a
failed/cancelled provider job and explicitly says Make starts a new request. An
unexpected thrown generation/status call likewise advises checking the provider
before another request instead of blindly suggesting Try again. Provider bodies
and exception details are not displayed by these catch paths.

## Deliberately unresolved

- Navigation/close/unmount do not cancel the accepted remote job. The existing
  loop may continue making its remaining read-only status requests in the
  background; stale UI writes are suppressed, not provider work or billing.
- 24 is a poll-count bound, not a two-minute wall-clock deadline. Each lookup adds
  its own latency; the server provider phase has a 15-second deadline, but there
  is no new browser-to-server transport deadline here.
- The accepted job ID lives only in the running handler closure. It is not saved
  for recovery after reload, unmount, lookup failure or exhaustion. Make remains
  a fresh submission, not a resume action. No provider-supported idempotency
  guarantee has been established or invented.
- Explicit same-tab job recovery/resume, background-poll cancellation and what to
  show for a previous selection require a separately reviewed UX/policy choice.
  Do not implement these by automatically resubmitting potentially paid jobs.
- Video status has no application polling counter. Existing generation quotas
  are process-local, restart-reset and independent between instances. This patch
  is not a distributed abuse/spending/concurrency solution.

## Verification boundaries

Tests cover stale successes/errors, A → B → A, unmount, unchanged-passage close
and reopen, busy ownership, sequential polling, success, 24-check exhaustion,
late submission failure and sanitized thrown lookup errors. The existing dummy
key-storage tests still verify session-only behavior and exact legacy cleanup.
These are component event/effect mocks, not browser/hydration/mobile/audio or
live-provider QA. The known unavailable Aikido service was not retried.
