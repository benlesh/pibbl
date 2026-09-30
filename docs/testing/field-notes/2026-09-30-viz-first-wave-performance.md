# Visualization first-wave performance observations

Date: 2026-09-30. This is measured work evidence, not a large-data API promise.
Baseline revision: d9c28931. Initial candidate: 2a247e3b. Corrected candidate:
0ee84b7d. Raw observations live in the adjacent JSON file.

Environment: macOS arm64, Node 24.15.0, pnpm 11.21.0, Playwright Chromium
151.0.7922.34. Runs were serial with other agent browser workloads stopped.
Each workload has two warmup redraws and seven measured observations. Data
replacement allocation occurs outside the update timing. Pointer dispatch
reports a 20-dispatch mean per observation and verifies 140 delivered hits.
Cold mount is a single descriptive observation, not a regression comparison.

Both trees use the identical `packages/viz/test/first-wave-performance.test.tsx`
fixture. The baseline selects legacy bar prop names; the candidate selects the
approved semantic names. Solid pies use the candidate's explicit `revision: 0`
cache contract versus the baseline's implicit identity caching. This protects
the supported unchanged-input path; it does not claim that the new safe default
without revision has constant-time accessor work.

| Workload         | Baseline redraw ms | Corrected redraw ms | Baseline update ms | Corrected update ms | Baseline / corrected pointer ms |
| ---------------- | -----------------: | ------------------: | -----------------: | ------------------: | ------------------------------: |
| 100 bars         |                1.6 |                 1.5 |                1.4 |                 1.3 |                   0.010 / 0.010 |
| 10,000 bars      |              129.0 |               121.0 |              130.6 |               121.0 |                   0.040 / 0.040 |
| 100,000 bars     |             1531.6 |              1480.9 |             1559.1 |              1475.8 |                   0.270 / 0.260 |
| 100 pie slices   |                3.3 |                 3.1 |                3.3 |                 3.5 |                   0.075 / 0.070 |
| 1,000 pie slices |               25.6 |                27.1 |               28.3 |                26.8 |                   0.940 / 0.885 |

The initial unconditional Path implementation measured a 29.4 ms dense solid-pie
redraw versus 25.6 ms (+14.8%). Investigation also found lost default focus
bounds. Restoring Wedge for innerRadius zero preserves the original inactive
path; the corrected measured redraw is 27.1 ms (+5.9%), and update is 26.8 ms
(-5.3%). No claim of zero impact or statistical equivalence is made from one
paired run. A repeat pair at b54e80f4 measured dense-pie redraw at 30.8 ms
versus baseline 32.3 ms, and update at 34.1 ms versus 29.7 ms. The direction
of these differences reversed; the initial slowdown is not consistently
reproduced, but update overhead remains under investigation. No arbitrary
percentage tolerance is treated as an approved regression budget. Both raw
pairs are retained, including outliers.

The 100,000-bar result is approximately 1.5 seconds per redraw: the existing
per-row Rectangle path is not an interactive large-data solution. This limitation
predates these slices and remains work for the approved large-data roadmap;
these results do not justify a batching/performance claim. Donut-specific work
has structural correctness/ownership evidence; this comparison measures inactive
solid-pie overhead, not a performance equivalence between pies and donuts.

To reproduce in the repository root with the documented Node environment:

```sh
VITE_CRC_VIZ_PERF=1 VITE_CRC_VIZ_RESULT="$PWD/viz-perf-result.json" \
  corepack pnpm@11.21.0 exec vitest run \
  packages/viz/test/first-wave-performance.test.tsx \
  --browser.headless --browser.ui=false --maxWorkers=1
```

For the baseline checkout, copy the same probe and additionally set
`VITE_CRC_VIZ_LEGACY=1`. Provision/build both locked checkouts first. Do not run
another browser suite concurrently. The probe is skipped in ordinary trust
runs; structural/ownership tests remain ordinary correctness gates.
