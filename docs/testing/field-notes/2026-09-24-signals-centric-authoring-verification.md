# Signals-centric authoring verification

> **Historical status: IMPLEMENTATION VERIFICATION RECORD.** This field note records
> dated evidence for the approved Signals-centric authoring design. Public
> behavior remains defined by the contracts under `docs/design/`.

Date: 2026-09-24

## Environment

- Runtime: Node 24.15.0 through `fnm exec --using=24.15.0`
- Package manager: pnpm 11.21.0 through Corepack
- Browser: provisioned Playwright Chromium 151.0.7922.34
- Browser viewport: 800 × 600 CSS pixels
- Device pixel ratio: 1
- Comparison baseline: detached commit
  `2cbe7afe5b16eaf8f55b6937059e238488dcdee6`
- Implementation checkout: app-managed isolated worktree

## Controlled performance comparison

The frozen baseline and final implementation each ran in three isolated Node
processes. Each process used five warm-up updates followed by 41 measured
updates. The table reports the median of the three process medians and the
median of the three process p95 values.

```sh
fnm exec --using=24.15.0 env VITE_CRC_REPORT_PERF=1 \
  corepack pnpm@11.21.0 exec vitest run \
  packages/core/test/signal-scheduler-performance.test.ts \
  --browser.headless --browser.ui=false \
  -t "records matched|records direct"
```

| Matched workload                 | Frozen median / p95 | Final median / p95 |          Change |
| -------------------------------- | ------------------: | -----------------: | --------------: |
| 1,000 local state/signal slots   |        1.3 / 1.7 ms |       1.2 / 1.5 ms |  -7.7% / -11.8% |
| 1,000 explicit signal-read slots |        1.2 / 1.6 ms |       1.1 / 1.3 ms |  -8.3% / -18.8% |
| 1,000 plain-input Rectangles     |        3.9 / 4.9 ms |       3.4 / 4.0 ms | -12.8% / -18.4% |
| 1,000 explicit-get Rectangles    |        3.7 / 4.6 ms |       3.1 / 3.6 ms | -16.2% / -21.7% |

The final receiver-owned forms measured:

| Receiver-owned workload                         | Median |    p95 | Versus final explicit-get median |
| ----------------------------------------------- | -----: | -----: | -------------------------------: |
| Signal-valued style field, 1,000 Rectangles     | 3.3 ms | 4.0 ms |                  +0.2 ms / +6.5% |
| Whole-style signal, 1,000 Rectangles            | 3.1 ms | 3.9 ms |                    0.0 ms / 0.0% |
| Text plus data/domain signals, 1,000 Rectangles | 3.1 ms | 4.0 ms |                    0.0 ms / 0.0% |

The direct-field median is 0.2 ms above the enclosing-component explicit-read
form because it deliberately maintains and recollects 1,000 receiver-owned
edges instead of one parent-owned edge. At Chromium's 0.1 ms timer resolution,
that is 6.5%, slightly above the plan's 5% diagnostic threshold, while the
absolute work remains small. The runtime therefore keeps the documented
optimization choice: use direct signals when receiver ownership or Layer
isolation is valuable; use one explicit read when one component intentionally
coordinates a very large fan-out. CRC does not add bitmap caches or a retained
scene graph to erase this bookkeeping cost.

The matched results include the final hot-path optimizations: no renderer
consumer before a first signal read, pooled dependency edges, direct reuse of a
warm single edge, reuse of an existing consumer as its collector, and a
synchronous active-collector pointer rather than an array lookup per read.

## Structural work elimination

Exact diagnostics establish behavior that wall-clock sampling cannot reliably
prove:

- One hundred plain Rectangles create zero renderer consumers, dependency
  edges, lazy consumers, shallow input copies, or receiver provisions.
- One hundred receiver-owned layout fields adopt exactly 100 transactional
  provisions. Their next frame reuses exactly 100 edges and creates none.
- A batch of 1,000 writes produces one notification per changed source, one
  deduplicated renderer invalidation, one host request, and one root traversal.
- A computed value that remains equal validates without a renderer traversal.
- A reaction-only update performs its cleanup and setup without a component
  traversal, pixel readback, bitmap transfer, or OffscreenCanvas allocation.
- Shared fan-out remains linear at 1, 10, 100, and 1,000 receiver edges and
  returns to the starting live totals on disposal.
- A dirty Layer child preserves clean sibling bitmaps and causes no replacement
  OffscreenCanvas allocation, pixel readback, or graph-induced bitmap transfer.
- One logical event dispatch batches two directly consumed signal writes while
  preserving one exact hit test and deferring one traversal to the next frame.

These results exceed the plan's requirement for two 20% improvements by
eliminating renderer traversal entirely for computed-equal and reaction-only
work. Lazy consumers and warm edge reuse also eliminate all persistent
plain-component consumers and all post-warmup edge allocation.

## Verification and review

Completed focused and packaging gates:

| Gate                       | Fresh result                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `typecheck`                | passed                                                                                                                |
| `lint:code`                | passed                                                                                                                |
| `test:lifecycle`           | 13 files, 55 tests passed                                                                                             |
| `test:performance`         | 9 files, 64 passed, 4 opt-in reference guards skipped                                                                 |
| source Studio build        | passed; 329-type declaration coverage                                                                                 |
| built-package Studio build | passed; 329-type declaration coverage                                                                                 |
| packed consumers           | Bundler, NodeNext, declarations, runtime, deep-import, shared-identity, geometry-only, and friend-entry checks passed |
| built browser smoke        | 2 files, 4 tests passed                                                                                               |
| complete browser suite     | 302 files; 3,720 passed and 4 opt-in checks skipped                                                                   |
| visual safeguard           | destructive drill rejected, every protected baseline byte preserved, recovery green                                   |

The Studio visual review found two intentional documentation captures. The
`api-crc` sidebar now includes the new public `batch` function, and the diagram
editor landing page now teaches `useSignal`, stable refs, and reactions instead
of the removed hook vocabulary. Both captures were inspected before their
baselines were updated.

The same run also exposed unrelated Canvas-filter raster drift: the Filters
capture differed by 16,159 pixels in both the implementation worktree and the
untouched `c3ccd0f`-equivalent base checkout under the same provisioned browser.
The WebGL capture had a further 110-pixel renderer-sensitive difference with no
Signals-centric source change. Those two baseline rewrites were discarded; this
feature does not claim unrelated environment output as an intentional visual
change.

The final read-only review identified two contract gaps and both were reproduced
before repair. Plain primitives now prepare their style-free program-props view
once with the immutable element descriptor and reuse it on every signal-free
resolution instead of allocating another object during render. Optional exact
`Signal<T>` and `WritableSignal<T>` props now require preservation metadata and
remain signal objects. The focused descriptor, primitive-dispatch, public-type,
and performance suites passed after these changes (5 files, 52 browser tests),
as did repository typecheck and lint.

The approved contract-preservation update now covers 667 baseline and 866
current semantic units, retains the exact reviewed approval and evidence
mappings, and passes all 1,015 documentation RED mutation probes.

The final aggregate `trust` run passed the complete static and packed-package
stages, then stopped on one timing-sensitive physics learning-example sample:
the clamped ball did not acquire a nonzero synthetic release interval under
full browser-suite load. That exact test passed immediately in isolation. A
complete browser-suite rerun passed the physics test and instead missed one
time-based particle sample; that exact particle test also passed immediately
in isolation. No threshold or product code was changed for either load-only
failure. The aggregate command therefore is not recorded as green.

The browser stages that the early stop had hidden were run separately. Studio
documentation acceptance and the visual-baseline safeguard passed. Studio
visual verification again stopped only on the already documented 16,159-pixel
Filters capture mismatch reproduced on the untouched base. Built-package smoke
passed 4 tests, lifecycle ownership passed 55 tests, and the structural
performance gate passed 64 tests with 4 opt-in reference guards skipped.
