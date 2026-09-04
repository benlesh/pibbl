# Accepted and deferred follow-ups

The existing-feature confidence phase closes correctness and evidence gaps in the current API. The remaining backlog contains only measured triggers or explicitly out-of-scope product work.

## Measured triggers

- Add a spatial index only after the controlled 10,000-region sparse/miss workload exceeds 6 ms median or 12 ms p95 in three reference runs after environment and constant-factor regressions are excluded.
- Add a deterministic bundled font only if exact glyph rasterization becomes a supported visual contract.
- Add another required browser only after executable native characterization identifies compatible behavior or an explicit CRC normalization decision.
- Promote internal test helpers only after their stable call shape recurs in another project phase; see [test tooling opportunities](./testing/test-tooling-opportunities.md).

## Explicit product deferrals

- Generated accessibility semantics, editable-input adapters, gestures, and
  semantic-control abstractions. CRC's shipped pointer, touch, wheel,
  drag/drop, pointer-capture, keyboard, and focus facades remain Canvas-local.
- New drawing primitives, rich text, margin/scrolling, Grid auto placement and
  intrinsic tracks, reverse/reordered Flexbox, advanced CSS intrinsic sizing,
  or a retained scene graph.
- A public scrolling or virtualization API. Applications currently own large
  datasets and pass a bounded visible window of descriptors to CRC.
- A worker renderer or spatial-index/event-architecture rewrite without the measured trigger.
- Populating or removing the separate empty `@crc/types` compatibility package.
- A published documentation site, generated API-reference renderer, search,
  versioning, or release campaign; see the [renderer
  brief](./documentation-follow-up.md). The current Markdown reference is
  shipped and checked in this repository.
- Cross-origin image policy beyond the browser's Canvas CORS/taint behavior.

## External repository administration

- Select the unified workflow's stable final job as a required branch-protection check after the workflow is pushed.
- Confirm the first hosted Linux run is green and that expected/actual/diff artifacts are retained on deliberate or real visual failures.

These administration actions cannot be proven by an unpushed local checkout and are not represented as product defects.
