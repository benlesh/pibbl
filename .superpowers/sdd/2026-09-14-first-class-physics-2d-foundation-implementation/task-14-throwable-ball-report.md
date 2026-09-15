# Task 14 throwable-ball follow-up report

## Files changed

- `packages/scenarios/src/learning/composition/physics-2d.example.tsx`
- `packages/core/test/learning-examples.test.ts`
- `packages/scenarios/src/learning-catalog.ts`
- `packages/core/test/physics-2d-lab.test.ts`
- `docs/scenario-index.md` (generated through `pnpm scenarios:write-index`)

## RED evidence

The new browser tests were written before production changes. The initial source-mode command was:

```sh
corepack pnpm@11.21.0 vitest run packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false -t 'physics lesson ball|captured pointer'
```

It produced the expected behavior failure against the old implementation:

```text
hands a measured rightward release velocity to the physics lesson ball
AssertionError: expected 440 to be greater than 448
```

The old authored-position implementation therefore left the ball at the release position instead of giving it a rightward velocity. Five other focused checks passed on the old behavior because they covered the retained drag contract or the required command-order handoff; this one failure established the missing throw behavior.

## Implementation decisions

- The physics body now belongs to a translated `Group` with local-circle collider geometry, lower damping, enabled rotation, and the required ball friction.
- Dragging captures one pointer, preserves grab offset and starting rotation, tracks at most eight timestamped samples over the last 120 ms, and clamps body-center poses to the existing bounds.
- Normal release enqueues, in order: final teleport, enable with zero velocity, and the capped release velocity. Cancel and lost capture re-enable at the last teleported pose with zero velocity.
- Imperative disable stops physics presentation by design. The lesson uses the active drag session’s teleported pose solely for an inner visual translation while disabled, with a redraw revision state; it contains no authored-position state and resets to the body-owned pose at release. No runtime changes were needed.
- Metadata names the four command APIs and the generated scenario index was regenerated rather than edited directly.

## Verification

All browser runs used Chromium headless. The environment supplied Node `v26.7.0` and pnpm `11.21.0` (the requested Node 24.15.0 was not installed).

```sh
corepack pnpm@11.21.0 vitest run packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false -t 'physics lesson ball|captured pointer'
# PASS: 5 passed, 194 skipped

corepack pnpm@11.21.0 vitest run packages/core/test/physics-2d-lab.test.ts --browser.headless --browser.ui=false
# PASS: 1 passed

corepack pnpm@11.21.0 --filter @crc/core --filter @crc/physics run build
# PASS

corepack pnpm@11.21.0 vitest run packages/core/test/learning-examples.test.ts --mode built --browser.headless --browser.ui=false -t 'physics lesson ball|captured pointer'
# PASS: 5 passed, 194 skipped

corepack pnpm@11.21.0 vitest run packages/core/test/physics-2d-lab.test.ts --mode built --browser.headless --browser.ui=false
# PASS: 1 passed

corepack pnpm@11.21.0 scenarios:write-index
# PASS: wrote docs/scenario-index.md for 54 lessons, 12 tutorial snapshots, and 21 test labs

corepack pnpm@11.21.0 scenarios:check
# PASS: validated 54 lessons, 12 tutorial snapshots, 21 test labs, and the generated index

corepack pnpm@11.21.0 exec eslint packages/core/test/learning-examples.test.ts packages/core/test/physics-2d-lab.test.ts packages/scenarios/src/learning-catalog.ts packages/scenarios/src/learning/composition/physics-2d.example.tsx
# PASS

corepack pnpm@11.21.0 exec prettier --check docs/scenario-index.md
# PASS

git diff --check
# PASS
```

`corepack pnpm@11.21.0 typecheck` was also attempted. It fails on five pre-existing errors in the untouched `packages/core/src/lib/backend/physics-presentation.test.tsx` (three `false` to `true` assignments and two physics attachment typing errors). No changed file appeared in that output.

## Self-review

- [x] The ball can be grabbed off-center, dragged, released, and thrown from captured pointer samples.
- [x] The release velocity is pointer-event-only, zero for a nonpositive span, and capped at 1000 logical pixels/second.
- [x] The implementation has no timer, loop, scheduler, or animation-frame callback.
- [x] Normal release preserves required body-command order and clears ownership before pointer-capture release.
- [x] Cancel/lost capture safely restore zero-velocity physics ownership; an explicit-release lost-capture event is a no-op.
- [x] A competing pointer cannot mutate the active gesture.
- [x] Required damping, friction, copy, catalog metadata, API expectation, and generated index changes are present.
- [x] New source and built browser regressions cover coalescing, throwing, off-center offset, bounds, post-release motion, and captured-pointer cleanup.

## Commit

`0a81f22256e3d3f95577f055d99fc695c282cb1b` — `feat(physics): make the lesson ball throwable`

## Concerns

- The available Node version is v26.7.0 rather than the requested Node 24.15.0.
- Repository-wide typecheck remains blocked by unrelated, pre-existing errors in `packages/core/src/lib/backend/physics-presentation.test.tsx`.
