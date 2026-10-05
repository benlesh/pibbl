# Final review fix 4 report

> **Historical status: COMPLETED IMPLEMENTATION EVIDENCE.** This dated report is preserved for audit and is not current API guidance.

Date: 2026-08-30  
Base: `14383d243e6d8604c9ba38c92a737d27664d1997`  
Environment: Node `24.15.0`, pnpm `11.21.0`, Playwright Chromium

## Finding and fix

The released-manager snapshot guard fixed direct component rerenders, but a
cache-stable descendant `layer` could still retain focused pixels when its sole
focus manager lived on an ancestor. The layer had stored the manager's last
focus revision, and the released manager continued returning that same value
during the removal render. The cache therefore replayed metadata instead of
executing the child component that would observe the new unfocused snapshot.

A released manager now returns `undefined` from its internal per-layer focus
revision query. A layer that previously painted a focus revision sees a cache
miss and rerenders once during manager removal, then stores `undefined` from the
released policy. Layers with no prior focus revision already store `undefined`
and remain cached. No-focus behavior and the layer module's structural import
boundary are unchanged.

## TDD evidence

The regression mounts `withFocusManagement` on an ancestor above a stable
layer. A real Tab entry focuses the layer child and paints a green
focus-visible pixel. Removing only the ancestor enhancer must make the cached
layer execute exactly once more, expose an unfocused snapshot, paint blue, and
leave no active focus policy.

RED on the unmodified base:

```text
packages/core/src/lib/focus/layer-focus-render.test.ts
Test Files  1 failed (1)
Tests       1 failed | 4 passed (5)
Failure: expected layer render count 3 after manager removal; received 2.
```

GREEN after making released layer revisions inactive:

```text
Test Files  1 passed (1)
Tests       5 passed (5)
Duration    674ms
```

## Verification

```text
Full focus plus layer browser suites:
11 files passed; 140 tests passed; duration 2.28s

Lifecycle ownership suites:
2 files passed; 14 tests passed; duration 9.67s

Typecheck: passed
Lint and formatting: passed
@pibbl/core build: passed
Packed consumer and tree shaking: passed
  marker absent without focus and present with focus
  103186 no-focus bytes vs 126495 with-focus bytes
git diff --check: passed
```

The proportional focus matrix preserves manager replacement, failed-render
recovery, cached-manager replay, nested layers, unrelated/no-focus caching,
directional ownership, and DOM focus-host cleanup. The parent task owns the
final aggregate trust run.
