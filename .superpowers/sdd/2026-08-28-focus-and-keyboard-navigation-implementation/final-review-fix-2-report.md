# Final review fix 2 report

Date: 2026-08-30  
Base: `df18e90caf6b6f55ef9ace8dbcb2afcc5ef71dd6`  
Environment: Node `24.15.0`, pnpm `11.21.0`, Playwright Chromium

## Finding and fix

A layer read its focus-render revision before rendering its child and stored
that stale value afterward. The child render can replace an inner focus
manager. Because revisions are manager-local, the old and replacement managers
can both reach revision `1`; the replacement target's first focus transition
then compares equal to the stale cached value and skips the required repaint.

The layer now reads the active policy's revision after the child render or
retained-subtree replay succeeds. Failed child renders still exit before the
cache metadata changes. No focus implementation import was added to the layer
runtime, and focus-free caching remains unchanged.

## Regression and TDD evidence

The browser regression uses the public runtime and real Canvas pixels. It:

- focuses a target rendered inside a layer-owned focus manager;
- invalidates the layer and replaces that manager and target;
- proves the replacement paints unfocused;
- Tabs to the replacement target; and
- requires both another child render and the focused pixel color.

RED on the unmodified base:

```text
packages/core/src/lib/focus/layer-focus-render.test.ts
Test Files  1 failed (1)
Tests       1 failed | 2 passed (3)
Failure: expected layer render count 4; received 3 after replacement Tab focus.
```

GREEN after refreshing the post-render revision:

```text
packages/core/src/lib/focus/layer-focus-render.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)
```

An initial policy-identity discriminator also passed the regression, but the
proportional focus/layer run showed it was too broad: a transient outer manager
before cached-layer replay forced a child render and disturbed the established
duplicate-manager failure cleanup path. That discriminator was removed. The
final production change is only the post-render active-policy revision read.

## Verification handoff

The focused regression passed on Node 24.15.0. The first broader focus/layer run
reported 137 passes and the single existing manager-replay failure caused by
the rejected identity discriminator; that discriminator is absent from the
final diff. Per coordination instruction, no further broad gates were run here.
The parent task will run the final aggregate trust gate from this commit.

