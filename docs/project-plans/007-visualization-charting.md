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

| Step                                             | State                            |
| ------------------------------------------------ | -------------------------------- |
| UTC scales, helpers, minimal demo and NOAA chart | Accepted; merged into local main |
| Numeric/categorical scales and axis presentation | Next                             |
| Chart furniture and shared visual defaults       | Queued                           |
| Everyday marks, curves, areas and bands          | Queued                           |
| Responsive exploration and shared selection      | Queued                           |
| Statistics, diagrams, hierarchies, geography     | Queued                           |
| Accepted-slice hardening and integration         | Per slice                        |

## [ACCEPTED] UTC scale vertical slice

Implement the approved epoch-number UTC scale, continuous lookup, pure extent
and UTC nice-domain helpers. Preserve linear/band compatibility. Add a focused
failing public test, minimal API demo, and a real NOAA CO2 example using the
attributed checked-in snapshot. Verify the same example headlessly and visually.
Done for feedback when focused checks pass and the exact Studio URL is supplied.
Broader edge cases, competitor review and package evidence follow feedback.

## [IN PROGRESS] Numeric/categorical scales and axis presentation

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

### 2026-10-05 continuation — reconciled baseline

The user confirms the dedicated linear/bar/UTC APIs and responsive NOAA chart
were accepted and merged into local main. Earlier “only linear/band” and
“awaiting UTC feedback” statements above are dated history, superseded here.

Delivery order for this continuation:

1. Readable numeric ticks, explicit nicening, formatting, and collision-aware
   axes in NOAA; present a runnable slice before broad hardening.
2. Compact contextual UTC labels and explicit long-category wrap/truncate/skip
   policies, keeping label visibility separate from tick/data geometry.
3. Dedicated LogScale/useLogScale, SymlogScale/useSymlogScale, and
   PointScale/usePointScale, each with fixed return types, minimal demos,
   attributed data, domain/inversion/tick contracts, and family tree shaking.
4. Composable grid/reference lines/bands, axis titles, legends, titles/captions/
   source notes with explicit layout ownership.

First numeric slice implements pure `linearTicks`, `niceLinearDomain`, and
`formatNumber`, plus opt-in `Axis.labelOverlap` and `labelGap`. Existing linear
`scale.ticks()` remains unchanged. NOAA derives numeric density from plot height,
retains width/height `style.when` presentation, and hides colliding time labels
without deleting tick geometry. New API docs and Studio declarations are included.
Focused Chromium run: 16 tests passed on Node 24.15.0 / pnpm 11.21.0.
Preview: http://127.0.0.1:5195/#/examples/composition/viz-utc-climate.
Status: first numeric slice accepted by the user; broader feature verification remains pending.
Packed consumers, additional scale families, tree shaking expansion, full
interaction/cleanup evidence, and aggregate trust remain pending. No commit,
merge, or push in this continuation.

The minimal runnable numeric demo is also available at
http://127.0.0.1:5195/#/examples/composition/viz-numeric-axis.
Focused ESLint passed. A whole-repository typecheck encountered concurrent,
unrelated sprite-demo errors in `docs/site/minimal/sprites/atlas.tsx`; this is
not a passing aggregate check. Preserve concurrent website/minimal-demo edits.

Studio visual inspection: NOAA and minimal numeric demo render at desktop and
narrow/shallow allocations, with no page errors in the inspected source-mode
sessions. The minimal demo's canonical `PibblController` mount annotation is
required by the Studio source loader and has been verified in the live editor.

2026-10-05: User accepted the numeric-axis slice and requested its commit, then
continued work in priority order. This authorizes the slice commit only; no
merge or push was requested.

### 2026-10-05 — contextual UTC and long-label slice

Accepted numeric slice committed as `01afbb81`. The following slice remains
uncommitted and ready for visual feedback, not fully hardened:

- `utcTickLabels(values, { locale? })` returns fixed-type frozen strings with
  standalone calendar context at year/month/day/sub-day precision. Full-ISO
  scale formatting remains unchanged.
- Axis adds signal-capable `labelOverflow`, `labelMaxWidth`, `labelMaxLines`,
  and `labelLineHeight`. Wrapping and grapheme-safe ellipsis are measured in the
  actual font on all four edges. Collision checks use the final multiline box;
  tick and mark geometry never changes.
- The real NOAA long-label example compares wrap/truncate, preserves a full
  selected-value readout, and responds to both allocation width and height.
  Public docs and Studio declarations cover options, defaults, errors, and
  signals. UTC basics provides the runnable date-label demo.
- Native keyboard tests exposed the missing FocusManagement policy in NOAA and
  the new demo. Both now opt in explicitly; Tab and arrow-key inspection pass.

Preview URLs:

- http://127.0.0.1:5195/#/examples/composition/viz-long-labels
- http://127.0.0.1:5195/#/examples/composition/viz-utc-basics

Fresh focused verification: Node 24.15.0, pnpm 11.21.0, Chromium; 27 tests across
axis-labels, long-labels-example, axis-runtime, numeric-axis, and utc-example.
Typecheck passed. Source Studio visual inspection covered desktop and a narrow,
shallow panel with no page errors. Long-label bounds/control/touch/native keyboard
checks cover 360×300, 560×300, and 900×640. Signal-policy disposal is checked.
No broad packed/built/aggregate verification claim is made for this slice.

Next: dedicated log, symlog, and point scales with independent hooks/modules,
explicit domain/inversion/tick contracts, meaningful logarithmic real data, and
family-isolation evidence; then reusable furniture. Contextual labels and
long-label policies await visual feedback before broader hardening.

2026-10-05: User accepted the contextual UTC/long-label slice and authorized its
commit. Dedicated scales are the next active slice. Broader package and
integration verification remains pending; no merge or push is authorized.
