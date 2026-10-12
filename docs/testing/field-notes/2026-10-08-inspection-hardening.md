> **Historical status: Field evidence from the October 8, 2026 inspection API hardening pass.**

# Inspection foundation — accepted batch hardening, 2026-10-08

The user accepted Batch 0's three runnable capabilities and authorized hardening.
No fourth feature or new financial API was implemented. Current evidence uses
Node **24.19.0** from the bundled runtime, pnpm **11.21.0**, Playwright Chromium.
Earlier Node 26 slice evidence remains historical in Plan 008.

## Changes established by failing tests

- A retained cached Layer must rebase inspection coordinates and clip eligibility
  when the root transform changes, without reevaluating its data accessors.
  Root committed-generation publication previously missed scheduler-owned
  transactions; publication now occurs on every successful root transaction.
- A surviving inspection ref may bind to a keyed replacement after its old
  receiver is removed. Binding happens after successful transaction completion;
  simultaneous receivers still reject. Failure tears down the containing render
  under existing runtime semantics and invalidates borrowed metadata.
- The public workbench keeps measured text and risk geometry within allocations
  of 1000×640, 560×300, 360×300, 320×260 and 320×640. Short layouts now reserve
  room for both plots and their readouts.
- Keyboard selection clears previous nearest/painted pointer results. It does
  not synthesize pointer coordinates or run a painted query.

Additional focused evidence covers query misses, ties, filtering, duplicate
selection, memoized misses, reversed/grouped stroke-only bars, ownership and
teardown. Ordinary dispatch cleanup avoids allocating an empty resource array.
Inspection remains optional, with no registry, subscription, or spatial index.

## Fresh verification

Commands below used the bundled Node 24 runtime on PATH.

| Check                                                                                           | Fresh result                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest run packages/core/test/features/viz/inspection-* --browser.headless --browser.ui=false` | 7 files, **25 passed** after the final keyboard change                                                                                |
| Source visualization suite                                                                      | 68 passed files, 2 skipped; 368 passed tests, 2 skipped (earlier in this hardening session, before final compact/keyboard assertions) |
| Built visualization + event-performance suite                                                   | 69 passed files, 2 skipped; 383 passed tests, 6 skipped (before final keyboard assertion; controlled timing guards remain opt-in)     |
| `corepack pnpm@11.21.0 trust:lifecycle`                                                         | Lifecycle 33 passed; structural performance 48 passed, 4 controlled timing guards skipped                                             |
| `corepack pnpm@11.21.0 build`                                                                   | Public packages, declarations, convenience package, playground and 647-page website passed; website minimal validation 9 passed       |
| `playground:build` and `playground:build:built`                                                 | Source/built Studio builds and editor parity passed                                                                                   |
| `node tooling/verify-inspection-studio.mjs`                                                     | Final 4 examples × desktop/mobile passed: input, keyboard repaint, compiler, runtime errors, screenshots                              |
| `PIBBL_WEBSITE_URL=http://localhost:4323 node tooling/website-minimal-browser.mjs viz`          | Registered visualization minimal programs passed in Chromium, including all three inspection programs                                 |
| `node tooling/verify-packed-viz.mjs`                                                            | Packed Bundler/NodeNext types, runtime queries, composition and identity passed                                                       |
| `node tooling/verify-packed-pibbl.mjs`                                                          | Convenience entry subpaths, runtime identity and Bundler/NodeNext JSX passed                                                          |
| `node tooling/verify-inspection-bundles.mjs`                                                    | Render-only excludes inspection modules; nearest-x-only 832 minified bytes excludes capture/handler/paint/sample                      |
| `node tooling/verify-optional-feature-bundles.mjs`                                              | Source/packed optional-feature bundle checks passed after allowing package-store access                                               |
| `corepack pnpm@11.21.0 typecheck`                                                               | Passed after final keyboard change                                                                                                    |
| Focused ESLint                                                                                  | All 49 owned code files passed                                                                                                        |
| Public JSDoc, catalog and Studio docs                                                           | Passed: 50 entries/1173 declarations, 112 lessons/12 tutorials/33 labs, API coverage/search/routes/links                              |

Semantic source/value/geometry assertions preceded screenshots. Final desktop
and mobile captures are in `/tmp/pibbl-inspection-evidence/`; no visual baseline
was rewritten. Package-store access and local Chromium/servers required sandbox
escalation; automatic review approved the executions. Initial restricted-store
optional verification failed with SQLite access, then passed with store access.

## Repository-wide blockers, preserved

`corepack pnpm@11.21.0 trust` stopped at documentation classification for
unrelated `output/brand/` README files. Root code lint also encounters unrelated
brand scripts; root formatting encounters brand output and an unrelated
auxiliary-outputs spec. The inspection API doc classification was added normally.

`corepack pnpm@11.21.0 test:ci` discovered 425 files and stopped in shard 8/27
on `output/brand/pibbl-loading-study/motion.test.mjs`, which imports
`node:assert/strict` into the browser. No repository-wide pass is claimed, and
those working-tree files were not changed to make the gate green.

## Hands-on checklist and limits

- [Standalone](http://127.0.0.1:5176/#/examples/composition/viz-recorded-inspection): click or Enter; source row 1 and price 15 are selected.
- [Lazy adapter](http://127.0.0.1:5176/#/examples/composition/viz-lazy-inspection): repeated identical requests reuse the result; ordinary input executes no query without a request.
- [Painted marks](http://127.0.0.1:5176/#/examples/composition/viz-painted-inspection): compare nearest observation with overlapping painted coverage.
- [Workbench](http://127.0.0.1:5176/#/examples/composition/viz-inspection-workbench): select price, use arrows, then select risk columns. Keyboard readout says no painted-point request; risk selection preserves the original desk record.

The data is labeled deterministic simulation. Search is linear. Painted lookup
is receiver-local geometric coverage, without scene occlusion or pixel-alpha
analysis. Studio scales its broad logical canvas on mobile; independently tested
compact allocations preserve text and semantic selection. The coverage audit in
the public API reference distinguishes supported numeric/point/bar inspection
from pending area/band geometry, existing custom Plot/pie datum callbacks, and
future candles/volume.

Milestone: accepted Batch 0 behavior is hardened and its focused/public/package
checks pass. Aggregate verification remains blocked by unrelated working-tree
files; the whole financial feature set is not complete. The next checkpoint is
[volume and financial inspection design](../../project-plans/008-volume-inspection-proposal.md),
with previously accepted candle and trading-time decisions preserved.
