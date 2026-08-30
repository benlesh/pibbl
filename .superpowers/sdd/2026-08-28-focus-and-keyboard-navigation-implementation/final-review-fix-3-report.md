# Final review fix 3 report

Date: 2026-08-30  
Base: `419cefcf555100a195ba4df749d5683345a3b5c2`  
Environment: Node `24.15.0`, pnpm `11.21.0`, Playwright Chromium

## Finding and fix

Removing the sole `withFocusManagement` enhancer releases its manager while
the successful render transaction is still open. The coordinator deliberately
keeps that manager transaction-visible until commit, but its `snapshot()`
method continued to report the prior target as focused during the same render.
A component using `isFocused` or `isFocusVisible` could therefore paint stale
focus pixels immediately before commit destroyed the released manager, with no
later focus transition available to schedule a corrective render.

`CRCFocusManager.snapshot()` now returns the shared unfocused snapshot once its
owner has been released. The change is limited to render snapshots; manager
replacement, failed-render cleanup, retained-layer replay, focus transitions,
and coordinator commit/rollback behavior are unchanged.

## TDD evidence

The new browser regression uses the public `crc`, `crcState`,
`crcEventTarget`, and `withFocusManagement` APIs with real Tab input. The same
target is first rendered with the identity-transparent manager enhancer, paints
a green focus-visible state after Tab entry, and is then rerendered without the
enhancer. The successful removal render must expose both focus flags as false,
paint a blue unfocused pixel, and leave no active focus policy.

RED on the unmodified base:

```text
packages/core/src/lib/focus/layer-focus-render.test.ts
Test Files  1 failed (1)
Tests       1 failed | 3 passed (4)
Failure: expected { isFocused: false, isFocusVisible: false } but received
         { isFocused: true, isFocusVisible: true } after manager removal.
```

GREEN after the released-owner snapshot guard:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
Duration    643ms
```

## Verification

```text
Full focus plus layer browser suites:
11 files passed; 139 tests passed; duration 2.27s

Lifecycle ownership suites:
2 files passed; 14 tests passed; duration 9.67s

Typecheck: passed
Lint and formatting: passed
@crc/core build: passed
Packed consumer and tree shaking: passed
  marker absent without focus and present with focus
  103186 no-focus bytes vs 126469 with-focus bytes
git diff --check: passed
```

The full focus matrix includes manager replacement, failed-render recovery,
cached-layer replay, nested directional ownership, and DOM focus-host teardown.
No aggregate trust run was performed in this fix task; the parent task owns that
final gate.

