# Coordinated modal keyboard/focus behavior

## Scope and reproduced gaps

This change covers the six existing overlays only: Studio, Search, reader Books,
reader information sheet, reader Reading, and Words Reading. Existing panel
content/layout classes and state transitions are retained. Search gains a small
explicit Close button because Escape/backdrop alone is insufficient for
keyboard-free or assistive-technology dismissal; its input shrinks within the
same header rather than forcing horizontal overflow.

Before this change, Studio was a labeled section rather than a modal dialog.
Search installed an unscoped window Escape listener that could dismiss an
underlying Search when Escape belonged to a different sheet. Its React autofocus
could also replace the focused opener before activation captured it. Search had
no explicit Close button. Four component regression tests were observed failing
before their respective changes. The new focus/stack tests separately exercise
implementation edge cases with a deterministic DOM/native-dialog seam.

## Implementation contract

- Shared `Modal` renders a named native `dialog` and calls **showModal()**, never
  the nonmodal `show()` or an `open` attribute. The browser owns top-layer
  placement, background inertness and native modal accessibility semantics.
  Redundant nested `role=dialog`/`aria-modal` attributes are removed.
- Existing full-viewport scrims, panels and sizing classes remain. Native default
  border/margin/padding/size limits and extra backdrop shading are neutralized;
  closed dialogs stay hidden before activation. The Search Close button is the
  only new visible control.
- A layout-effect captures the currently focused opener before activation and
  focuses the marked initial target, otherwise the first visible enabled
  control. Search marks its input. The informational reader sheet marks its
  existing title with a programmatic-only tab stop to avoid skipping its text.
- Tab/ShiftTab wrap visible enabled controls at their boundaries, including
  single-control/empty-content cases. Disabled, hidden, inert and negative-tab
  controls are excluded from sequential cycling. Browser shortcut modifiers and
  IME-composition Escape are not intercepted by our key handler.
- Escape and native cancel dismiss only the top registered modal. There is no
  global Search Escape listener. A backdrop click dismisses only its own top
  modal, never a click on panel content.
- Cleanup closes native modality, removes listeners and restores the captured
  connected opener without scrolling. A child whose opener belonged to a removed
  parent inherits the parent's opener. Closing a lower sheet does not steal
  focus from the top sheet. If the original opener is disconnected/unfocusable,
  it cannot be restored; a remaining parent gets focus if needed.
- Modal rerenders do not reactivate or steal focus. A ref supplies the latest
  close callback. Strict-effect cleanup/replay and repeated cleanup do not leak
  entries. The registry is a WeakMap per Document, accessed only on activation;
  SSR rendering does not read window/document.

Studio close still only calls its existing onClose state transition. No work is
canceled or resubmitted, and no key policy, generation deadline, quota, player,
speech text, scripture, names, content or navigation policy changes. No new
service, configuration or dependency is introduced.

## Browser contract and verification limits

Native dialog/showModal is widely available in modern browsers (MDN lists the
baseline since March 2022). We intentionally do not substitute a nonmodal open
attribute while claiming modal semantics. Older/embedded engines without this
API are not validated. Reference opened during review:
https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog

Tests compile the real Search/Studio/Modal components and focus helper, using
in-memory DOM events and a fake native-dialog API. They prove the application
requests native modality, initial/restored focus, keyboard boundaries, topmost
callbacks, teardown, sheet switching and rerender behavior. They **do not prove**
actual browser inertness, CSS/top-layer layout, native focus event ordering,
mobile virtual-keyboard behavior, hydration or screen-reader announcements.
Existing provider/storage tests retain their dummy mocks; no real keys, browser
storage, speech or provider calls are used. Known Aikido failure was not retried.

## Safe preview QA before publication

Use a fresh credential-free isolated context. Do not save keys, generate media or
repeat the separately completed storage smoke test.
1. On `/read/john/1`, use keyboard to open Books, Reading, Search and an available
   information sheet. Check announced dialog name and initial focus; cycle Tab
   and ShiftTab, Escape, explicit Close and backdrop; verify restoration to the
   actual still-connected opener. Background links/player controls must not be
   reachable while a modal is open.
2. Open Studio from Reading and Books, then close it: focus should return to the
   original page opener rather than a detached Studio-launch button. With no
   key, never press generation controls. Check topmost-only Escape if sheets are
   stacked by an existing reachable workflow.
3. Repeat Reading/Studio on `/words`. Test Search typing, results navigation and
   Close; there must be no repeated focus jumps during results updates.
4. At 320/375px and zoom, check Search input/Close, long Books and Reading lists,
   panel scrolling, safe areas and virtual keyboard. Test Chrome/Safari and
   assistive technology separately; native speech/mobile/audio QA remains open.

No real browser/AT/mobile checks were performed by this coding agent. A passing
unit/build/SSR check is not a substitute for these checks or release approval.
