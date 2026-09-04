# Task 7 report: nested directional boundaries and key precedence

> **Historical status: COMPLETED IMPLEMENTATION EVIDENCE.** This dated report is preserved for audit and is not current API guidance.

## Outcome

Nested directional navigation is explicitly contained by the focused target's
nearest committed boundary. Inner candidates are absent from outer direct
candidate lists, a miss at an inner edge is terminal, and target or ancestor
`preventDefault()` continues to suppress the directional default. Tab traversal
still uses the manager's one global source-order candidate list.

The boundary collection path now prepares every frozen direct-list replacement
before exposing any of them. Failed collection leaves the prior successful
lists untouched until the repository's existing render-failure teardown clears
the manager. The directional enhancer also clears its active-manager scope in a
`finally` block after popping its boundary token.

## TDD and plan drift

The new focused contract was written before the hardening changes. After fixing
two test-fixture mistakes (a dynamically recreated component type and an
assertion against an obsolete array snapshot), the nested behavior cases were
already green on commit `965e04b`: Task 2 had implemented top-of-stack boundary
membership and atomic successful collection earlier than Task 7's plan
expected. The production work in this task therefore hardens and names those
already-shipped seams rather than changing their observable behavior.

The final tests cover:

- nearest-boundary arrows, inner-edge containment, and direct membership;
- form-like target prevention before directional defaults;
- one global nested Tab sequence;
- nested-boundary removal, restoration, and keyed reorder without target
  remount;
- partial render failure retaining the last committed lists until manager
  teardown;
- manager destruction and fresh recovery after render failure.

Existing focused manager coverage supplies transformed and cached offscreen
layer evidence, including nested-layer replay without outer direct enrollment.

## Implementation

- Added `nested-navigation.test.ts` with the Task 7 behavioral matrix.
- Added a nearest-boundary-only directional resolver used by the keyboard
  default; no ancestor fallback path exists.
- Centralized top-of-stack boundary reads for target observation and cached
  subtree replay.
- Prepared and froze all boundary direct lists before committing replacements.
- Deferred retained-target boundary metadata updates until candidate commit
  succeeds.
- Made directional enhancer scope cleanup `finally`-safe.

## Fresh verification

Environment: Node `v26.7.0`, pnpm `11.21.0`, Vitest Browser Mode with Playwright
Chromium.

- Focused Task 7 plus manager/runtime/Task 6/activation/Tab matrix: 6 files,
  75 tests passed.
- Full `packages/core/src/lib/focus` suite: 8 files, 113 tests passed.
- `corepack pnpm@11.21.0 typecheck`: passed.
- `corepack pnpm@11.21.0 lint`: passed.
- `corepack pnpm@11.21.0 -C packages/core run build`: passed.
- `git diff --check`: passed.

The checkout uses Node 26 rather than the repository's documented Node 24 LTS
line; the exact runtime is recorded here rather than represented as Node 24
evidence.
