# Task 2 report — settle render queues and derive geometry interaction data

## Files changed

- `packages/webgl/src/lib/scene/settle.ts`
- `packages/webgl/src/lib/scene/settle.test.ts`
- `packages/webgl/src/lib/pick-ledger.ts`
- `packages/webgl/src/lib/pick-ledger.test.ts`
- `packages/webgl/src/lib/render-environment.ts` (approved temporary compatibility re-export)
- `packages/webgl/src/lib/scene/composer.ts` and `composer.test.ts` (approved ownership correction)

## RED evidence

1. `corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/pick-ledger.test.ts --browser.headless --browser.ui=false`
   initially failed because `./settle.js` did not exist.
2. After adding a mutation-sensitive navigation-bounds assertion, `corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/settle.test.ts --browser.headless --browser.ui=false`
   failed as intended: the pick entry exposed `{ x: 99, ... }` after the caller mutated its submitted bounds rather than the submitted `{ x: 1, ... }` snapshot.

The browser runner required the approved local-loopback execution mode; the sandbox-only attempt could not bind its Vite loopback port.

## GREEN evidence

`corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/pick-ledger.test.ts packages/webgl/src/lib/scene-picker.test.ts --browser.headless --browser.ui=false`

Fresh result: **3 files passed, 37 tests passed** (693 ms). `git diff --check` also passed.

## Design choices

- Settlement closes the composer exactly once, calculates `-viewPosition.z` from the immutable geometry-bounds center, preserves opaque source order, and explicitly sorts transparent meshes far-to-near with source-index tie breaking.
- Exact final alpha decides raster participation; alpha zero remains in the geometry pick/focus ledger.
- Geometry pick entries snapshot the same model and camera projection used by the settled scene and retain `less-equal` depth behavior.
- Pick participation release now lives in `pick-ledger.ts`, deduplicates targets, and keeps releases idempotent; `render-environment.ts` only re-exports it until its scheduled removal.
- The composer now snapshots navigation bounds at submission. This was necessary because settlement cannot reconstruct the original values once a caller mutates an aliased object.

## Self-review

Reviewed the Task 2 diff for exact alpha boundaries, transparent comparator direction/tie-break, no GPU interaction, source-order stability, zero-alpha interaction retention, target-release deduplication, and caller-input aliasing. No unrelated working-tree changes were touched.

## Commit

Implementation commit: `cabe5e0b9498053934ebc21dc2afbf62e5b39e41` — `feat(webgl): settle scene render and pick queues`.

## Deferred concern

The compatibility re-export in `render-environment.ts` is intentionally temporary. Task 6 removes that legacy environment; backend and layer consumers remain untouched here by instruction.
