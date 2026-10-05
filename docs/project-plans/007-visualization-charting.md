# Plan 007 — Visualization charting

> API correction approved 2026-10-05: **every scale family has a dedicated
> provider and hook**, with a fixed return type and no family-selector argument.
> Current families: `LinearScale` / `useLinearScale`, `BarScale` / `useBarScale`,
> `UTCScale` / `useUTCScale`. UTC nicening is `niceUTCDomain(domain, { count? })`.
> Generic `Scale`, `ScaleProps`, and `useScale` are removed, without aliases.
> Future log, symlog, power, square-root, point, ordinal, local-time, sequential,
> diverging, quantile, quantize, and threshold variations must follow this rule;
> listing them here does not claim implementation. Family modules must tree shake
> independently. This decision supersedes selector-based API examples below.

Status: active, 2026-10-05. User requests planning and implementation of the
[visualization roadmap](viz-charting-priorities.md), complete API explanations,
minimal demos for each public feature, and compelling real-data examples.

## Baseline and scope

Preserve unrelated animation/machines, game, package, and Studio edits in this
shared checkout. The charting priorities document supplies ordering and visual
acceptance; its advanced families remain in scope after basic charting. Existing
UTC and pie-label approvals remain authoritative. New contracts are resolved
only as needed for each slice. No commit or push is requested.

## Status board

| Step                                             | State              |
| ------------------------------------------------ | ------------------ |
| UTC scales, helpers, minimal demo and NOAA chart | Ready for feedback |
| Numeric/categorical scales and axis presentation | Next               |
| Chart furniture and shared visual defaults       | Queued             |
| Everyday marks, curves, areas and bands          | Queued             |
| Responsive exploration and shared selection      | Queued             |
| Statistics, diagrams, hierarchies, geography     | Queued             |
| Accepted-slice hardening and integration         | Per slice          |

## [IN PROGRESS] UTC scale vertical slice

Implement the approved epoch-number UTC scale, continuous lookup, pure extent
and UTC nice-domain helpers. Preserve linear/band compatibility. Add a focused
failing public test, minimal API demo, and a real NOAA CO2 example using the
attributed checked-in snapshot. Verify the same example headlessly and visually.
Done for feedback when focused checks pass and the exact Studio URL is supplied.
Broader edge cases, competitor review and package evidence follow feedback.

## [NEXT] Numeric/categorical scales and axis presentation

Resolve domain/tick policies, implement focused examples for numeric niceness,
log/symlog, point/category coordinates and label-density presentation. Include
minimal demos and public API docs for each addition. Keep existing semantics
unless a change is explicitly designed and documented.

## Queued slices

Follow P0.3–P4 in the priorities document. Every new public API gets a minimal
runnable demo, documented signatures/options/defaults/errors and one realistic
composition showing why it exists. Reuse attributed snapshots, record units,
dates, source and transformations; never present synthetic values as measured.

## Integration and visual test contract

Use supported public imports and the same scenarios manually/headlessly. Assert
semantic values and geometry before screenshots. Inspect desktop and phone
allocations and interaction states. Preserve one scheduler and exact ownership.
Provide runnable feedback before broad hardening. Feature completion requires
accepted appearance, docs/declarations, packed Bundler/NodeNext consumers, Studio
source/built evidence, proportional checks and final integrated trust. Do not
claim all roadmap features complete after one slice.

## Session log

- 2026-10-05: Activated at user request. Prior Plan 004 retains its unfinished
  status and evidence; it is not marked complete by this switch. Source audit
  confirms only linear/band scales are currently exported. Node 24.15 is available.

- UTC boundary clarification during implementation: two-tick output is always
  the original endpoints. If no epoch-aligned cadence avoids an interior
  boundary when count=2, niceDomain preserves already integral millisecond
  bounds rather than seeking overflowing years. This previously unspecified
  year-zero case is explicit in API docs and a regression assertion.

- First slice is ready for experiential feedback at
  http://127.0.0.1:5192/#/examples/composition/viz-utc-climate and
  http://127.0.0.1:5192/#/examples/composition/viz-utc-basics. Minimal website
  source, complete UTC API reference, and Studio declarations are updated.
  [Fresh verification and findings](../testing/field-notes/2026-10-05-viz-utc-slice.md)
  record passing latest focused results and remaining hardening. Await visual
  feedback before broader hardening; the implementation step remains in progress
  until acceptance. No full-roadmap completion or competitive-quality claim.
