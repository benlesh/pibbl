# Semantic bars and axes: first-slice evidence

> **Historical status: Slice evidence record; it does not define current shipped behavior.**

Status: slice ready for feedback after coordinator integration.

Approved contract: 2026-09-30 semantic `BarSeries` replacement and four-sided,
categorical `Axis` contract in `remaining-viz-roadmap.md`.

Owner: `audit_series`; branch: `codex/viz-semantic-bars`; worktree:
`/Users/benlesh/.codex/worktrees/viz-semantic-bars/crc`.

## Baseline and red evidence

The first focused browser invocation after dependency provisioning could not
start because fresh workspace package declarations had not been built
(`@crc/types` and `@crc/core` could not resolve). Building the workspace was
required before its normal public-test configuration could load. This was an
environment-provisioning failure, not a measured performance baseline.

After that build, the new public horizontal value-bar test failed as expected:
the existing Axis tried to read the band scale as linear and threw
`useScale requires type=linear; use useScale(id, "band") for band scales.`
The failed command was:

```sh
PATH=/Users/benlesh/.local/share/fnm/node-versions/v24.15.0/installation/bin:$PATH \
corepack pnpm@11.21.0 exec vitest run packages/viz/test/bar-series.test.tsx \
  --browser.headless --browser.ui=false
```

No controlled timing comparison was run: concurrent browser work makes a
timing result unreliable. The preserved structural behavior is one Rectangle
per bar, with no new retained cache, target registry, scheduler, or data
preprocessing.

## Focused pass

Fresh Node 24.15.0 / pnpm 11.21.0 evidence:

```sh
PATH=/Users/benlesh/.local/share/fnm/node-versions/v24.15.0/installation/bin:$PATH \
corepack pnpm@11.21.0 -C packages/viz run build && \
corepack pnpm@11.21.0 exec vitest run \
  packages/viz/test/bar-series.test.tsx \
  packages/viz/test/grouped-bars.test.tsx \
  packages/viz/test/stacked-bars.test.tsx \
  packages/viz/test/bars-example.test.ts \
  --browser.headless --browser.ui=false
```

Result: 4 files and 25 tests passed. The new test proves horizontal signed
value geometry plus categorical left labels and top numeric labels. Existing
vertical, grouped, stacked-range, threshold-fill, hit-target, and editable
example evidence remains in that focused run.

## Accepted-slice hardening

After hands-on approval, fresh Node 24.15.0 / pnpm 11.21.0 evidence:

```sh
PATH=/Users/benlesh/.local/share/fnm/node-versions/v24.15.0/installation/bin:$PATH \
corepack pnpm@11.21.0 -C packages/viz run build && \
corepack pnpm@11.21.0 exec vitest run \
  packages/viz/test/axis-runtime.test.tsx \
  packages/viz/test/bar-series.test.tsx \
  packages/viz/test/grouped-bars.test.tsx \
  packages/viz/test/stacked-bars.test.tsx \
  packages/viz/test/bars-example.test.ts \
  --browser.headless --browser.ui=false
```

Result: 5 files and 31 tests passed. New coverage proves normal and reversed
horizontal range bars with grouped bands, threshold pixels, and target routing.
Axis coverage proves explicit order, domain rejection before formatter calls,
zero/single generated ticks, and the 100-value cap before drawing allocation.
No controlled timing comparison was run.

## Feedback surface

After integration, open
`http://127.0.0.1:5187/#/examples/composition/viz-band-bars` and choose
**Horizontal bars**. Inspect left category labels, top value ticks, signed bar
directions around the vertical zero rule, the threshold colors, hover/tap
readout, then choose **Vertical bars** to confirm the existing presentation
returns.

Deferred: a grouped-stacked presentation example, package-consumer and
documentation hardening owned by the coordinator, and controlled timing.
