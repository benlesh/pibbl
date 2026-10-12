# Signals-centric authoring pre-change baseline

> **Historical status: PRE-IMPLEMENTATION PERFORMANCE EVIDENCE.** This dated
> field note records the fixed baseline captured before Signals-centric runtime
> changes and is not a current API contract.

Date: 2026-09-24

## Environment

- Commit: `c3ccd0ff93905315f43b83e1f7d6d53d0ef60d1e`
- Runtime: Node 24.15.0 through `fnm exec --using=24.15.0`
- Package manager: pnpm 11.21.0 through Corepack
- Browser: Headless Chromium 151.0.7922.34
- Browser viewport: 800 × 600 CSS pixels
- Device pixel ratio: 1
- Reported logical processors: 18
- Worktree: clean app-managed isolated checkout before Task 1 changes

The shell's default Node 26 run was exploratory and is intentionally excluded
from comparison evidence. All values below came from the required Node 24 LTS
run.

## Command

```sh
fnm exec --using=24.15.0 env VITE_PIBBL_REPORT_PERF=1 \
  corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/signal-scheduler-performance.test.ts \
  packages/core/test/performance-characterization.test.ts \
  --browser.headless --browser.ui=false
```

Result: 2 files passed, 11 tests passed, 0 failed.

## Signals-centric comparison workloads

Each timing is one 41-sample run after five warmup updates. These are baseline
observations, not machine-independent budgets. Task 13 repeats the same harness
in isolated processes and applies the approved median/p95 gates.

| Workload                              | Median |    p95 | User component traversals/update |
| ------------------------------------- | -----: | -----: | -------------------------------: |
| `useState`, one change / 1,000 slots  | 1.0 ms | 1.5 ms |                            1,001 |
| `useSignal().get()`, 1 / 1,000 slots  | 1.1 ms | 1.6 ms |                            1,001 |
| Plain inputs, 1,000 Rectangles        | 3.5 ms | 4.3 ms |                                2 |
| Explicit `.get()` inputs, 1,000 Rects | 3.4 ms | 4.2 ms |                                2 |

The explicit-get workload reads geometry, text, and an opaque data array in the
enclosing component before passing plain values to receivers. Direct
signal-valued component inputs are not supported at this commit, so this record
does not invent a pre-change timing for them.

Task 13 replayed this committed harness from detached commit `2cbe7af` in three
fresh Node 24.15 processes immediately beside the final implementation. The
median of the three process-level observations was `1.3 / 1.7 ms` for old
`useState`, `1.2 / 1.6 ms` for explicit signal reads, `3.9 / 4.9 ms` for plain
inputs, and `3.7 / 4.6 ms` for explicit-get inputs (median / p95). Those
contemporaneous values, rather than this note's earlier single process, are the
comparison basis in the final verification record.

Additional structural observations:

- 1,000 sequential writes scheduled one host request and one root traversal;
  enqueue time was 0.2 ms in the reporting run.
- One dirty child across 100 stable Layer bitmaps constructed zero replacement
  OffscreenCanvases and completed the repaint/composition path in 1.1 ms.
- Shared explicit signal fan-out created exactly 1, 10, 100, and 1,000 renderer
  edges for the corresponding receiver counts, requested one host frame per
  update, and returned to the starting live-edge count after disposal.
- The future diagnostics for lazy consumers, reused edges, plain/signal input
  resolution, shallow copies, receiver provisions/adoption/rollback, and batched
  invalidation all began at zero.

## Existing dispatch characterization

| Miss workload  | Dispatches/sample | Exact hit tests | Median/dispatch | p95/dispatch |
| -------------- | ----------------: | --------------: | --------------: | -----------: |
| 0 regions      |             1,000 |               0 |        0.000 ms |     0.000 ms |
| 100 regions    |               100 |             100 |        0.116 ms |     0.130 ms |
| 1,000 regions  |                10 |           1,000 |        1.120 ms |     1.320 ms |
| 10,000 regions |                 1 |          10,000 |       12.000 ms |    13.000 ms |

This event-dispatch evidence is retained because Task 4 adds one automatic batch
around a complete logical dispatch and must not change hit-test scaling.
