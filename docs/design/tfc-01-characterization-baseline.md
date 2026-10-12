# TFC-01 interaction and lifecycle characterization baseline

> **Historical status: CHARACTERIZATION BASELINE.** This pre-contract record is discovery evidence, not current normative behavior.

Date: 2026-08-11

This report freezes what Pibbl does before the interaction contract and ownership fixes. A recorded result is not automatically a supported behavior. TFC-02 decides semantics; TFC-03, TFC-04, and TFC-07 resolve the ownership, ordering, and cleanup findings.

## Trace method

The shared `interaction-trace-lab` scenario renders equal-sized left/right Pibbl regions and native DOM reference regions. Real Chromium input records monotonic order, source, event type, logical region, Canvas/reference-local coordinates, button state, transition kind, and symbolic related target. The headless fixture and manual gallery mount the same scenario definition.

Observed projections for one explicit movement per waypoint:

| Gesture                               | Current Pibbl projection                                 | Native Chromium projection                                                            |
| ------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Outside to left `(60, 90)`            | `mousemove(left)`, `mouseover(left)`                     | `mouseover(left, related=outside)`, `mousemove(left)`                                 |
| Within left `(80, 100)`               | `mousemove(left)`                                        | `mousemove(left)`                                                                     |
| Left to right `(300, 90)`             | `mouseout(left)`, `mousemove(right)`, `mouseover(right)` | `mouseout(left, related=right)`, `mouseover(right, related=left)`, `mousemove(right)` |
| Right to outside `(460, 200)`         | `mouseout(right)`                                        | `mouseout(right, related=outside)`                                                    |
| Primary activation at left `(60, 90)` | `mousedown(left)`, `mouseup(left)`, `click(left)`        | `mousedown(left)`, `mouseup(left)`, `click(left)`                                     |

The four historical WIP ordering expectations are consistent with the native trace: transitions precede the associated `mousemove`. TFC-01 does not change Pibbl to match them.

## Deterministic resource counts

The observer lives only under `packages/core/test`. Counts include the selected root Canvas and offscreen instances whose parent chain reaches that root.

### One region with all eight public mouse handlers

| Transition                        | Instances | Native listeners | Component teardown entries | Main teardown entries | Scheduled frames |
| --------------------------------- | --------: | ---------------: | -------------------------: | --------------------: | ---------------: |
| Mounted, before first frame       |         1 |                8 |                          0 |                     1 |                1 |
| Initial frame settled             |         1 |                8 |                          4 |                     3 |                0 |
| 100 awaited rerenders             |         1 |                8 |                        204 |                     3 |                0 |
| Handler replacement render        |         1 |                8 |                        206 |                     3 |                0 |
| Settled abort, from a fresh mount |         0 |                0 |                          0 |                     0 |                0 |

After the initial frame and every rerender, registry sizes remain:

`click=1`, `contextmenu=1`, `dblclick=1`, `mousedown=1`, `mousemove=3`, `mouseout=2`, `mouseover=0`, `mouseup=1`.

Only the replacement handler fires after the replacement render. The growing teardown count is therefore retained cleanup work, not duplicate live registry handlers.

### Fresh subtree removal

After removing the only interactive rectangle, instances remain 1, native listeners 8, component teardown entries fall to 1, main entries fall to 2, and scheduled frames are 0. Hover adapters are removed, but these registries retain the removed region:

`click=1`, `contextmenu=1`, `dblclick=1`, `mousedown=1`, `mousemove=1`, `mouseup=1`.

A synthetic click at the old geometry invokes the removed handler. This is frozen as a ghost-event characterization for TFC-03.

### Two nested layers

| Transition                 | Instances | Native listeners | Component teardown entries | Main teardown entries |
| -------------------------- | --------: | ---------------: | -------------------------: | --------------------: |
| Initial nested render      |         3 |                8 |                          6 |                    21 |
| Outer layer removed        |         3 |                8 |                          5 |                    20 |
| Root aborted after removal |         2 |                0 |                          4 |                    18 |

Initial and removed-layer registries are unchanged: `click/contextmenu/dblclick/mousedown/mouseup=3`, `mousemove=5`, `mouseout=4`, `mouseover=2`. After root abort, the two offscreen instances retain their bridges and registries: the five regular event sets are 2, `mousemove=4`, `mouseout=3`, and `mouseover=1`.

An immediate abort while the first render frame is still queued can later attempt to render a deleted instance. TFC-01 records that race but uses settled abort for the repeatable lifecycle table.

## Dispatch scaling baseline

Environment: Node 24.19.0, pnpm 11.21.0, HeadlessChrome 151.0.7922.34 on macOS arm64, DPR 1, reported hardware concurrency 8. Each workload uses 5 warm-up batches and 41 measured batches. Samples reuse one miss event and run without hit-test instrumentation; the structural probe is separate.

| Interactive regions | Dispatches per timing sample | Hit tests for one miss | Median per dispatch | p95 per dispatch |
| ------------------: | ---------------------------: | ---------------------: | ------------------: | ---------------: |
|                   0 |                        1,000 |                      0 |            0.001 ms |         0.001 ms |
|                 100 |                          100 |                    100 |            0.030 ms |         0.061 ms |
|               1,000 |                           10 |                  1,000 |            0.280 ms |         0.420 ms |
|              10,000 |                            1 |                 10,000 |            3.400 ms |         6.200 ms |

Timing is informational, not a CI speed budget. The deterministic assertions are registry size, exact hit-test count for a miss, zero callbacks on that miss, finite samples, and median no greater than p95. Low-cardinality rows are batch-average throughput observations; the 10,000-region row is single-dispatch latency.

## Artifact boundary

The diagnostic observer is outside every package build entry and package file list. After a clean build, `RuntimeDiagnostics`, `runtime-diagnostics`, `packages/core/test`, and `test/support` are absent from `packages/core/dist` and its source maps. Importing `@pibbl/core/test/support/runtime-diagnostics` fails as expected.

## Frozen findings routed forward

- TFC-02: decide transition-before-move, topmost targeting, click identity, and Canvas-specific related-target behavior from the native evidence.
- TFC-03: stop hover teardown growth and removed-subtree ghost handlers; establish exact listener/registry ownership.
- TFC-06: turn representative workloads into budgets only after correctness and dispatcher shape are stable.
- TFC-07: own and dispose nested offscreen instances, event bridges, and queued frames.
