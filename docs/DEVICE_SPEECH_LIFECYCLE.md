# Device speech: phrase error ownership

## Proven, narrowly fixed defect

`ReadAloud` already invalidates run/loop tokens on Stop, navigation, pause/resume
and unmount. Its `onend` and delayed `go` paths check those tokens. The utterance
`onerror` path did not: a late event could display an obsolete error after Stop,
a chapter/language change, pause/resume or unmount. It could also enter the
existing plain-device fallback path for an already paused phrase (the subsequent
`go` guard prevented that inactive phrase from actually speaking).

Tests compile the real component and invoke its buttons/effects with a fake
speech engine and synthetic lines. Seven assertions fail against the previous
code: stale chapter/language errors, errors after Stop/unmount, old-loop errors,
paused fallback construction, and a late error from a finished phrase while the
next phrase uses the same run/loop. These are deterministic component
reproductions, not observations on a real phone or speech engine.

The five-line guard at the start of `utter.onerror` now checks:
- whether this phrase already settled;
- whether its run and loop still own playback;
- whether playback is still in the normal running state.

Invalidated events settle the old promise as stopped and return before setting
errors or entering the fallback path. The settled check also protects successive
phrases within the same loop. No speech text, original names, voice choice,
rate/pitch/volume, player controls/layout or navigation policy changed. Current
errors remain visible; the existing current `synthesis-failed` plain-device
fallback and silent canceled/interrupted behavior remain intact. No new retry,
provider, dependency, storage access or network call was introduced.

## Compatibility checks and limits

Twelve mocked component tests cover the above cases plus active error display,
current fallback completion, normal verse order/chapter completion and listener
cleanup. All speech engine operations in these tests are in-memory mocks. There
is no live speech playback, provider request or browser automation.

This does not certify Android/iOS speech reliability, browser cancellation event
ordering, screen-reader output, mobile sizing, keyboard access or hydration.
Current terminal errors retain the existing player state; deciding whether to
pause or reset the UI on failure remains a separately reviewed behavior choice.
No unsupported language/pronunciation data is added or inferred.

## Remaining source-review checklist (not changed here)

- Studio is currently a labeled `section`, not an explicit dialog, and has no
  component-level initial/contained/restored focus or Escape handling.
- Search has dialog/modal semantics, autofocus and Escape handling, but no
  component-level focus containment/restoration. Reader/Words overlays also need
  a coordinated keyboard/screen-reader review rather than isolated ARIA claims.
- Player controls use minimum-height utilities and a horizontally scrolling
  mobile toolbar; these source styles do not establish actual viewport fit,
  safe-area behavior, zoom usability or touch/screen-reader operability.
- In an isolated credential-free browser, test keyboard opening/closing/focus,
  320/375px layouts and zoom; native Read → Pause → Resume → Stop, navigation,
  language/voice changes, background/foreground and failure recovery need a
  separate real-device speech QA pass. Never use real saved Studio keys or
  generation requests for that pass.

The existing unavailable Aikido service was not retried. No completed security
scan or real-device/browser QA is claimed by these local mocks.
