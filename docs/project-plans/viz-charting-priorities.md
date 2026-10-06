# Visualization priorities and visual-quality bar

> API correction approved 2026-10-05: **every scale family has a dedicated
> provider and hook**, with a fixed return type and no family-selector argument.
> Current families: `LinearScale` / `useLinearScale`, `BarScale` / `useBarScale`,
> `UTCScale` / `useUTCScale`. UTC nicening is `niceUTCDomain(domain, { count? })`.
> Generic `Scale`, `ScaleProps`, and `useScale` are removed, without aliases.
> Future log, symlog, power, square-root, point, ordinal, local-time, sequential,
> diverging, quantile, quantize, and threshold variations must follow this rule;
> listing them here does not claim implementation. Family modules must tree shake
> independently. This decision supersedes selector-based API examples below.

Date: 2026-10-05.
Status: user-directed priorities; implementation is tracked in
[Plan 007](007-visualization-charting.md). The responsive NOAA UTC slice was accepted and merged into local main.
Reusable axis presentation and remaining foundations are in progress. Proposed component names are illustrative, not new public APIs.

## Direction and authority

The user wants extremely rich visualization support, with basic charting first:
time axes, updated/new scales, chart furniture, and visuals as good as or better
than leading alternatives. This supersedes the delivery order in the
[remaining visualization roadmap](remaining-viz-roadmap.md), not its historical
approvals, evidence, or shipped contracts. It also supersedes the initial
research recommendation to start with graph ports/connectors.

This is the current visualization prioritization source. It does not replace
the active numbered project plan or authorize unrelated runtime changes. Carry
the selected slice into execution planning when implementation is requested.
Keep public docs descriptive of shipped behavior. Earlier UTC and custom pie
label approvals remain recorded in their linked proposals; prioritization does
not silently amend their semantics.

## Baseline and gaps

Source inspection on 2026-10-05: the public entry is
`packages/core/src/features/viz/index.ts`, implementations are under
`packages/core/src/features/viz/lib/`, and authoring guidance is
`docs/site/learn/guides/data-visualization.md`. Old `packages/viz` paths in prior
records predate package consolidation. This is source evidence, not a fresh
runtime verification result.

Available: dedicated linear, bar, and UTC scales with family-specific hooks, axes on all four edges with categorical labels
and explicit bounded ticks, straight lines with missing-data gaps, point/custom
mark series, horizontal/vertical value and range bars, grouping and threshold
fills, pie/donut geometry with coordinated string labels, nearest-data queries,
hover cards, and anchored layout. Stacking is an explicit data transform.

Not yet exported: log/symlog/point scales, local-calendar time scales, general area/band series, automatic
legends or chart furniture, reusable brush/zoom/linked selection, graph/hierarchy
layouts, or geographic components. The line explorer's brush and the diagram
editor's connections are application examples, not reusable public APIs. Core
responsive styles and logical focus do not establish responsive viz marks or
screen-reader semantics.

## Priority order

Order within each tier follows dependencies and concrete example needs. Deliver
one runnable vertical slice at a time; do not build every foundation before
showing a chart. P0 is the first product milestone. Do not displace unfinished
P0 quality work with a more novel chart family without explicit reprioritization.

| Priority | Capability                                              | Why it matters / intended result                                                                                                                                                               |
| -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.1     | UTC calendar scale and excellent time-axis presentation | A truthful, readable time chart from subsecond to multiyear spans; use the approved UTC contract as the first slice                                                                            |
| P0.2     | Numeric/categorical scale and axis finish               | Useful numeric ticks/nice-domain helpers, formatting, spacing, band/point positions, log and symlog; consistent units and explicit domain policies                                             |
| P0.3     | Chart furniture and visual defaults                     | Grid lines, baselines, titles/subtitles, axis titles/units, legends, color/size keys, reference lines/bands, source/caveat text, and deliberate empty states                                   |
| P0.4     | Complete everyday marks                                 | Area and interval bands, step/monotone curves, categorical coordinates, symbol/size encoding, segment styling, stacked/normalized compositions; finish current bars and pie/donut presentation |
| P0.5     | Everyday exploration and responsive composition         | Crosshair, hover/tap/focus inspection, pinning, brush/overview, pan/zoom, shared selection, and responsive small multiples with shared or independent domains                                  |
| P1       | Statistics, matrix data, and advanced encodings         | Histogram/bin helpers, interval/error bars, box plots and summaries, density/violin/beeswarm, heatmaps, calendar layouts, sequential/diverging/threshold/quantile/quantize encodings           |
| P2       | Connected diagrams and scheduling                       | Nodes, ports, connectors, labels, routing, manual/layered layout, groups, process swim lanes, interval lanes, milestones, and timeline dependencies                                            |
| P3       | Hierarchies and quantitative flows                      | Tree/cluster/pack/treemap/partition, Sankey, chord/ribbons, arc diagrams, network layouts and drill-down                                                                                       |
| P4       | Geography and specialist/dense views                    | Projections, geographic marks/routes, contours, hexbin/raster fields, specialized financial and multivariate recipes                                                                           |

Responsiveness, accessibility, correctness, ownership, and workload-appropriate
performance are acceptance dimensions in every tier, not work postponed to P4.
Indexing, aggregation, and decimation move forward when a selected slice needs
them. Do not require speculative large-data infrastructure for a small chart.

The full scale roadmap retains local-calendar time with explicit DST/time-zone
semantics, power/sqrt, ordinal, and color/size encodings. UTC and the most useful
numeric scales come first. A color or size encoder need not pretend to be a
positional scale. Decide the extension boundary through actual mark consumers.

## P0 slices and observable acceptance

### 1. Time-series chart

Start from the [approved UTC proposal](viz-utc-contract-proposal.md). Provide one
editable public example with UTC observations, gaps, resize, and inspection.
Prove calendar-aligned geometry with a focused failing public test before
production code, then deliver the exact running Studio URL for feedback.

The first visible chart must have concise labels, clearly identified UTC time,
units, deliberate gutters and restrained grid lines. An example-level compact
formatter is an acceptable first slice under the existing contract; it is not
completion of the reusable presentation feature.

After feedback, resolve the reusable presentation contract: contextual calendar
labels, repeated-date context, year/month transitions, density and collision
policy, label priorities, locale, and precision. Preserve the approved stateless
full-ISO `formatTick` behavior unless a specific amendment is approved. Always
including original endpoints can crowd aligned interior ticks: decide label
visibility separately from tick geometry, or explicitly amend the tick policy.
Never silently move a date to make a label fit.

### 2. Scale and axis quality

Prove a compact numeric chart, a long-label categorical chart, and a log/symlog
example. Define readable numeric steps, precision, SI/currency/percent/unit
formatting, domain niceness, optional clamping, zero/baseline treatment,
ascending/descending domains, and unknown/missing/invalid behavior. Preserve
existing linear behavior until an explicit change contract and migration exist.
Log must reject or explicitly handle nonpositive input; symlog needs an explicit
constant and inversion contract. Area-based size encoding must not accidentally
encode values as radii.

Axis presentation must cover all four edges, major/minor grid hierarchy where
useful, axis titles, measured gutters, overlap handling, and crisp strokes at
supported pixel ratios. Narrow charts reduce density or change presentation
without hiding units or critical context. Full ISO strings and arbitrary label
rotation are not acceptable universal defaults.

### 3. Furniture and everyday composition

Develop one coherent style vocabulary for typography, spacing, rules, palettes,
legend swatches, labels, annotations, and interaction states. Initial components
may be `GridLines`, `Legend`, `ColorLegend`, `SizeLegend`, `ReferenceLine`, and
`ReferenceBand`; title/source blocks can remain ordinary composed content when
that is sufficient. A mandatory chart container is not required.

Demonstrate line/area, grouped/stacked bars, scatter/bubbles, and pie/donut using
the same visual system. Legends must wrap or rearrange, show selected/disabled
states, and preserve category order. Continuous keys need meaningful ticks and
units. Palette defaults should support categorical, sequential, and diverging
roles with non-color alternatives. Preserve customization without forcing users
to reproduce layout math or internal rendering code.

Build area/band geometry, curves, and pure stack transforms as needed by those
examples. Define curve overshoot, gaps, order, uncertainty bounds, signed stacks,
and inspection semantics before expanding variants. The existing custom pie
label approval remains valid, but it does not outrank missing time axes and
shared furniture. Label fit must not distort wedge area or data geometry.

### 4. Shared exploration and small multiples

Extract reusable behavior from demonstrated brush/inspection patterns. Keep
hover, pinned datum, selection, focus, and viewport distinct. Share record IDs
or domain ranges across views through caller-owned signals. Support keyboard
inspection, tap-to-pin, cancellation, touch targets, and alternatives to drag.
Fit compact and wide layouts; synchronize an application-owned HTML summary or
table rather than claiming Canvas focus supplies an accessibility tree.

State should be serializable for application-owned URLs/bookmarks; do not add
router ownership to visualization primitives. Expensive preprocessing belongs
outside pointer-move handlers. Nearest-data lookup and topmost painted hit tests
remain distinct. Test both stable-data interactions and changed-data updates.

## What “S-tier” means for acceptance

“S-tier” is the target, not a claim established by this document. Visual quality
is a completion gate alongside semantic correctness. Attractive screenshots of
one hand-tuned dataset do not establish a high-quality component.

| Dimension                 | Required evidence before feature completion                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default composition       | An ordinary documented configuration produces a polished chart without per-datum pixel fixes; typography, spacing, colors, and furniture form a consistent family                    |
| Typography and layout     | No unintended overlap, clipping, truncated units, or illegible labels in supported sizes; declared wrapping/omission policies retain essential context and accessible values         |
| Truthful encoding         | Missing differs from zero; units/domains/baselines are clear; stacks, sizes, curves, and uncertainty preserve their declared meaning                                                 |
| Responsive behavior       | Inspect at 360px and 390px phone widths, 768px, and a wide desktop allocation; test different aspect ratios, DPR 1/2, long labels, and zoomed text where supported                   |
| Color and states          | Inspect light/dark surfaces, grayscale/color-vision resilience, categorical crowding, hover, focus, selected, muted, empty, and invalid-data states                                  |
| Interaction               | Pointer, keyboard and touch paths communicate the same essential values; overlays stay bounded and do not obscure the datum being explained; motion has a reduced/static alternative |
| Customization             | Typical brand typography, palette, density, formatting, and custom marks do not require private imports or replacing the entire component                                            |
| Performance and stability | Record representative workloads and environment, interaction/update cost, layout stability, caching/invalidation, and exact teardown; avoid universal frame-rate claims              |
| Competitive review        | Dated side-by-side comparison on matched datasets and dimensions; document specific wins, deficits, and user acceptance rather than declaring blanket superiority                    |

For competitive review, choose relevant current examples from D3/Observable
Plot, Vega-Lite, Apache ECharts, and Highcharts; add specialist diagram or map
references only when their tier is selected. These are comparison candidates,
not claims about their current capabilities. Record exact source URLs, library
versions/date, configuration, font, dataset, viewport, and screenshots when the
review is performed. Compare both ordinary defaults and reasonably configured
results; do not handicap the reference or copy its visual identity.

Compare readability, density, layout, interaction clarity, responsive behavior,
and customization. A visually weaker result keeps that slice open with concrete
fixes or an explicitly accepted limitation. No competitive benchmark or visual
superiority has been verified in this planning update.

## Delivery and verification

1. Resolve only decisions blocking the selected public slice. Add the minimum
   meaningful failing public-API test before production changes.
2. Build the runnable slice and perform focused semantic/geometry checks and
   visual inspection. Give the exact Studio URL and what to inspect promptly.
3. Mark **slice ready for feedback**, not feature complete. A local comparison
   or visual inspection needed to make this slice credible belongs here; a
   catalog-wide benchmark does not.
4. Incorporate feedback, then harden supported sizes, edge cases, accessibility,
   ownership, docs, visual regression evidence, and matched competitor review.
5. Mark **feature complete** only after accepted behavior and proportional final
   checks pass. New APIs must agree across exports/declarations, packed Bundler
   and NodeNext consumers, Studio, and source/built browser modes. Run aggregate
   trust at the integration milestone, not repeatedly during early exploration.

Use the same public scenario manually and headlessly. Assert data/geometry first;
add screenshots where they establish appearance. Inspect expected/actual/diff
before intentional baseline changes. Record environment and fresh results; old
roadmap test totals do not certify current work. Required visual review is not
permission for overlapping agent reviews or delaying hands-on feedback.

## Advanced coverage retained

The D3 catalog review informs breadth; its 174 entries are not 174 required
components. Prefer marks, pure transforms, layout outputs, and polished recipes.

- Statistical recipes: waterfall, lollipop, dumbbell, bullet, cumulative and Q–Q
  plots, ridgelines, horizon charts, scatterplot matrices, parallel coordinates,
  candlesticks/OHLC, and financial bands. Promote a recipe only when repeated
  semantic work warrants a public component.
- Diagrams: separate layout geometry, edge routing, and ordinary Pibbl rendering.
  Support custom content, named ports, endpoint markers, hit tolerance, self-loops,
  parallel edges, groups, pinned nodes and stable updates. Evaluate an optional
  ELK adapter for ports/nesting. Process lanes, timed interval lanes, and sequence
  diagrams need different semantics even if they share rendering pieces.
- Hierarchies/flow: reuse topology across radial/Cartesian layouts and partition
  geometry across sunburst/icicle. Sankey flow conservation/acyclic limitations
  need an explicit contract; generic connectors are not a Sankey implementation.
- Geography/dense views: define projection, clipping, geographic hit testing,
  contours, aggregation and provenance. Tiles and vector export need deliberate
  ownership/readiness contracts, not blanket promises.
- All families retain one Pibbl scheduler, public composition and explicit
  resource ownership. Reuse pure D3 geometry where appropriate; do not import
  a competing DOM renderer, event system, or automatic animation loop.

## Research and decision log

Research inputs: [D3 gallery](https://observablehq.com/@d3/gallery),
[D3 shapes](https://d3js.org/d3-shape),
[D3 hierarchy](https://d3js.org/d3-hierarchy),
[D3 Sankey](https://github.com/d3/d3-sankey), and
[ELK](https://eclipse.dev/elk/). The preceding catalog review covered all 174
listed entries at the family level, not a source audit of every notebook.

2026-10-05: User prioritizes chart basics and exceptional visual quality ahead of
connected diagrams. Added P0-first delivery, concrete visual acceptance,
competitive evidence requirements, and retained advanced breadth. No production
code, shipped public contract, visual baseline, or implementation status changed.
This historical next-step note is superseded by the accepted UTC/NOAA slice.
Current order: excellent numeric/time/category labels, dedicated log/symlog/point
scales, then composable chart furniture. Track runnable versus hardened status
in Plan 007.


2026-10-05 delivery update: numeric and contextual UTC/category label slices are
committed. The accepted logarithmic slice, including preservation of compact
category labels, is committed as `7eb70568`. Dedicated symlog and point providers
and hooks now have a runnable Census composition, focused source/built tests,
documentation, and packed/tree-shaking evidence. This is a feedback-ready slice,
not a declaration of complete hardening. Chart furniture remains next; Plan 007
records exact evidence and outstanding verification.

Furniture progress: accepted symlog/point slice committed as `ac035d33`.
Grid/reference lines now have a runnable Census composition with focused geometry,
responsive interaction, and package checks. Feedback-ready, not fully hardened;
reference bands and text/legend furniture remain next.
