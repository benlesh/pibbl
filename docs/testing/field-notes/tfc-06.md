# TFC-06 field note — event hot-path performance

Date: 2026-08-11

## Scenario and risk

The shared `event-performance-lab` scenario exposes zero-region, sparse-hit, all-miss, dense-overlap, clipped, transformed, four-layer, cursor, and unchanged-rerender workloads through one trusted test-laboratory catalog entry. The gallery and browser suite load the same public-API scene definitions and workload metadata; the gallery source panel also uses the registered source adapter.

The main risk was optimizing the new global target resolver from intuition and weakening the TFC-04/TFC-05 targeting contract. The laboratory therefore checks the target, visible probe pixel, cursor, owned region/paint-entry counts, and exact structural work before using latency measurements. Timing never substitutes for correctness.

## Manual and headless method

The source gallery was exercised manually in the in-app Chromium browser at `http://127.0.0.1:5181`, viewport 1280×720 and DPR 1. The following observations matched the scenario checklist:

- zero regions reported zero counters and no target;
- sparse 100, 1,000, and 10,000 selected `region-0` with exactly `N` path, context, save, and restore operations;
- all-miss 100, 1,000, and 10,000 performed the same exact `N` operations with no target;
- dense 1,000 and 10,000 selected the last-painted region with one path test and one context/save/restore cycle;
- clipped 1,000 reported 2,000 path tests and 1,000 context/save/restore cycles;
- transformed 1,000 reported 1,000 path tests and 1,000 `setTransform` calls;
- four-layer 1,000 selected `layer-0-region-0` with 2,000 path tests and 1,000 context/save/restore cycles;
- cursor 1,000 selected `region-0` and visibly applied `pointer`;
- 25 unchanged rerenders at both 1,000 and 10,000 regions advanced the revision by 25, completed 26 total renders, and preserved the image, target, and structural counts;
- Reset restored the empty workload and cleared samples, counters, and target.

The metrics panel remained readable and the browser console had no errors. Live gallery latency includes laboratory instrumentation and general UI activity, so it is diagnostic rather than accepted benchmark evidence.

The headless suite imports the catalog entry and source marker, drives every exact workload, and asserts its target, probe pixel, cursor, instances, regions, paint entries, callbacks, and structural counters. It separately checks 25 unchanged rerenders with deterministic ownership ledgers. Controlled timing uses five warm-up batches followed by 101 measured batches, with workload-specific dispatch batching to reduce timer quantization. A correctness image is compared before timing. Three final budget runs and one independent completion-audit run passed without retries.

## Reference environment and stabilization

- macOS 26.5.1 (25F80), arm64
- Node 24.19.0 and pnpm 11.21.0
- HeadlessChrome 151.0.7922.34
- 800×600 headless viewport, DPR 1, reported hardware concurrency 8
- fixed 480×240 intrinsic and CSS Canvas size
- fixed paths, transforms, layer count, colors, probe points, and region order
- five warm-up batches and 101 measured batches
- median, p95, and p99 computed from per-dispatch batch averages

The opt-in reference guard requires DPR 1 and a Chrome user agent before applying machine-speed budgets. Ordinary correctness runs always enforce structural counts but skip volatile timing gates.

## Visual strategy and review

The 1,000-region sparse workload has one exact 480×240, text-free RGB baseline. It shows the pale background plus the deterministic blue region strip and green target at the probe. The baseline was inspected when created; the completion audit inspected it again rather than regenerating it. Every workload also probes the expected Canvas pixel: green `[22, 163, 74, 255]` when a target is expected and background `[248, 250, 252, 255]` for misses. Cursor state is asserted separately because it is not represented by the Canvas screenshot.

## Baseline and post-change results

The pre-change measurement is commit `a04e115`; the post-change measurement includes the focused optimization and calibrated dispatch guards in `8f38382`, `d608f5c`, and `55a69a7`. Commit `5bcb901` adds the separate unchanged-rerender guard. Values are milliseconds per dispatched move on the reference environment.

| Workload        | Pre median | Pre p95 | Post median | Post p95 |
| --------------- | ---------: | ------: | ----------: | -------: |
| Sparse 100      |      0.224 |   0.302 |       0.074 |    0.092 |
| Sparse 1,000    |      1.690 |   2.030 |       0.390 |    0.530 |
| Sparse 10,000   |     18.800 |  24.200 |       4.000 |    6.800 |
| All miss 100    |      0.214 |   0.252 |       0.074 |    0.082 |
| All miss 1,000  |      1.820 |   2.150 |       0.390 |    0.580 |
| All miss 10,000 |     19.000 |  23.900 |       4.000 |    6.000 |

Composition and early-exit rows use the most useful recorded statistic. Dense overlap is effectively best-case because reverse paint order finds the topmost hit immediately.

| Workload                               | Statistic          |           Pre |          Post |
| -------------------------------------- | ------------------ | ------------: | ------------: |
| Dense overlap 1,000                    | median             |         0.027 |         0.022 |
| Dense overlap 10,000                   | median             |         0.048 |         0.044 |
| Clipped 1,000                          | p95                |         3.680 |         0.640 |
| Transformed 1,000                      | p95                |         3.680 |         2.010 |
| Four layers 1,000                      | p95                |         2.140 |         0.680 |
| Cursor 1,000                           | p95                |         1.970 |         0.550 |
| Unchanged 1,000-region render callback | median / p95       | 3.200 / 4.100 | 2.000 / 3.400 |
| Unchanged 1,000-region frame settle    | latest observation |        18.800 |        17.000 |

Frame-settle latency includes scheduling delay and is not used as render-execution cost. The callback wrapper isolates the actual scheduled render callback; even that timing remains diagnostic, while exact completed-render and ownership counts are deterministic gates.

## Structural work and allocation pressure

One probe now produces the following exact work. `N` is the region count.

| Workload class       | Context/save/restore | Path tests | `setTransform` | Matrix multiplies |
| -------------------- | -------------------: | ---------: | -------------: | ----------------: |
| Zero                 |                    0 |          0 |              0 |                 0 |
| Sparse, miss, cursor |                  `N` |        `N` |              0 |                 0 |
| Dense overlap        |                    1 |          1 |              0 |                 0 |
| Clipped              |                  `N` |       `2N` |              0 |                 0 |
| Transformed          |                  `N` |        `N` |            `N` |                 0 |
| Four layers          |                  `N` |       `2N` |              0 |                 0 |

Before the focused optimization, dense performed one matrix multiplication; sparse, miss, cursor, and transformed performed `N`; clipped performed `2N`; and the four-layer workload performed `N + 4`. Afterward all tested composition classes perform zero matrix multiplications. Returning an already-composed identity-side transform avoids the corresponding `DOMMatrix` result allocations. Empty/identity clip composition also returns an existing stack instead of mapping or spreading it. This is a deterministic allocation proxy, not a heap-size claim: target resolution still creates the root identity matrix and an `Array.from(paintEntries)` snapshot for each visited instance.

The remaining duplicate-looking path work is intentional. A clipped candidate tests its clip and region path; a layered candidate tests its layer bound and region path. Sparse, transformed, miss, and cursor candidates each test a path exactly once. Cursor selection reuses the resolved target rather than resolving again.

## Complexity and budgets

- Initial registration is `O(N)` time and `O(N)` retained regions, paint entries, component refs, and handlers. Each region performs constant Set/slot work.
- An unchanged rerender is `O(N)` because the public scene and component tree are revisited. Region identities and storage remain bounded at `O(N)`: after 25 rerenders the exact instance, component-ref, region, paint-entry, listener, teardown, and handler snapshots are unchanged, with zero duplicate releases and no pending frame.
- Target resolution walks reverse paint order. It is `O(1)` best-case for a topmost dense hit and `O(N)` for a sparse bottom hit or complete miss. With `C` active clips the worst candidate work is `O(C + 1)`, making a full scan `O(N(C + 1))`; nested layers add their visited paint entries and bounds without changing the linear worst-case class.
- One `mousemove` performs one target resolution, then constant hover-transition, cursor, and target-callback work, plus `O(O)` Canvas-wide observers when present.
- One `click` performs the same single target resolution plus constant down/up identity checks and one callback. A complete primary activation has three native resolutions—down, up, and click—so it is `O(3N) = O(N)`. A separate click timing row would duplicate the measured resolver curve; the complexity is confirmed directly from the dispatcher.

Reference-environment guards are inclusive median/p95 limits in milliseconds per dispatch:

| Workload                    | Median budget | p95 budget |
| --------------------------- | ------------: | ---------: |
| Zero                        |         0.050 |      0.100 |
| Sparse 100 / miss 100       |         0.100 |      0.250 |
| Sparse 1,000 / miss 1,000   |         0.750 |      1.500 |
| Sparse 10,000 / miss 10,000 |         6.000 |     12.000 |
| Dense 1,000                 |         0.750 |      1.500 |
| Dense 10,000                |         1.500 |      3.000 |
| Clipped 1,000               |         1.500 |      3.000 |
| Transformed 1,000           |         2.250 |      3.000 |
| Four layers 1,000           |         1.500 |      3.000 |
| Cursor 1,000                |         1.500 |      3.000 |

These thresholds leave measured headroom for run-to-run noise without obscuring a return to the pre-change curve. The transformed median has a narrower 2.250-ms allowance because `setTransform` is real required work; its p95 remains capped at 3.000 ms. p99 is recorded for tail visibility but is not a gate on this single reference machine.

The scheduled callback for an unchanged 1,000-region rerender has a separate median budget of 5 ms and p95 budget of 8 ms. That is roughly twice the accepted 2.0/3.4-ms observation while remaining below half of a 60 Hz frame. The same opt-in reference guard enforces it; the always-on 25-rerender ledger proves bounded registration and ownership independently of machine speed.

## Spatial-index decision and measured trigger

Linear reverse scanning remains acceptable for the current supported scale. The measured worst representative 10,000-region p95 is 6.8 ms against a 12 ms guard, dense overlap exits in one path test, and the simpler resolver preserves the proven global paint/clip/layer order.

A spatial index or scene-graph rewrite becomes eligible only when a real product workload or the shared sparse/miss workload exceeds its median or p95 budget in three consecutive controlled 101-sample runs after correctness, environment drift, and local constant-factor regressions are excluded. Concretely, the present 10,000-region trigger is median above 6 ms or p95 above 12 ms. Any replacement must preserve exact TFC-04/TFC-05 target and composition traces before its timing is considered.

## Deliberate regression drill

`VITE_CRC_PERF_COUNTER_DRILL=1` wraps `isPointInPath` with one redundant call. The focused suite failed exactly as intended on sparse 100: expected 100 path tests, received 200. Removing the drill restored the passing structural suite and budget guard. This deterministic failure is preferred to slowing the machine or adding arbitrary delays.

## Surprises and flakes

- Identity `DOMMatrix.multiply()` calls dominated the large sparse/miss baseline much more than the Canvas path tests. Eliminating only those provably redundant compositions reduced 10,000-region p95 by roughly 3.5–4× without changing one hit-test count.
- Transformed work remains meaningfully slower because 1,000 required `setTransform` calls cannot take the identity shortcut. Its median budget was calibrated to 2.250 ms while retaining a 3.000-ms p95 ceiling.
- Workload-selection time and frame-settle latency vary with scheduling and are reported, not gated. Render callback time is collected separately so scheduling delay is not mislabeled as registration cost.
- Low-cardinality workloads use batched dispatches to avoid sub-millisecond timer quantization. The 10,000-region rows use one dispatch per sample.
- No functional, visual, console, or retry flakes remained in the final manual and headless runs.

## Failed or rejected approaches

- Rejected spatial indexing: current measurements do not meet the documented trigger, and an index would add mutation/order complexity before it is needed.
- Rejected changing hit geometry, clip semantics, layer order, or stable target identity for speed.
- Rejected raw heap/garbage-collection thresholds. Exact matrix operations, context work, path tests, ownership ledgers, and bounded live collections are reproducible allocation/resource evidence.
- Rejected making general CI wall-clock timing a universal gate. The opt-in guard validates an identified reference environment; deterministic structural assertions always run.
- Rejected using frame-settle latency as render duration. Scheduled callback execution is measured separately.
- Rejected volatile raw timing dumps in version control; this note stores the concise accepted pre/post table.

## Helper and tooling friction

- Browser timing must separate instrumentation, warmup, batching, render callback execution, and frame scheduling to remain interpretable.
- Prototype/context wrappers need strict one-controller isolation and exact restoration.
- Matrix work, path tests, cursor state, pixels, and callbacks each expose different regressions; no single metric is a trustworthy oracle.
- Reference-environment timing is intentionally opt-in, so local and CI commands need clear naming in the later trust gate.

Candidate tools:

1. a reusable browser benchmark reporter that emits environment-tagged JSON plus a concise Markdown row;
2. a standard structural-counter wrapper with isolation/restoration checks and a deliberate-regression mode;
3. a reference-run helper that performs multiple controlled guard runs and summarizes budget headroom without committing volatile samples;
4. a render-cost helper that distinguishes scheduled callback execution from frame-settle latency.

## Decisions and follow-ups

- Keep the current linear, reverse-paint-order resolver and its exact semantic tests.
- Keep speed budgets opt-in to the declared reference environment; keep structural counts in every normal correctness run.
- Treat identity composition elision as the accepted focused optimization. Further micro-optimization needs a workload-level effect.
- Use the explicit repeated-budget trigger above before considering a spatial index.
- TFC-07 may reuse the bounded ownership snapshot, but broader lifecycle and asynchronous cleanup remain outside this performance step.

## Final verification

The final supported-environment gate passed under Node 24.19.0 and pnpm 11.21.0: 20 browser files passed with 151 tests passing and 4 intentionally skipped. Lint and formatting, TypeScript 7 checking, package builds, strict Bundler/NodeNext/Node package consumers, and both source and built gallery production builds passed. The final working tree was clean before advancing the plan marker.
