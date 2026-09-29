# Pie composition revision proposal

Status: original proposal below is superseded by the approved layout-container
revision. Implementation slice is ready for experiential feedback; broad hardening
and the aggregate trust gate are not complete.

## Approved revision and performance findings

The user approved `PieLayout` as the coordinating radial layout, with `PieSlice`
and `PieLabel` as composable parts, and permitted API adjustments for performance.
The implementation keeps `pieSlices` pure and renames its result record to
`PieSliceGeometry`. `PieLayout` receives a stable `label(slice)` callback before
rendering function children, avoiding inspection or double evaluation of arbitrary
component trees. Each child receives a resolved `PieLayoutSlice` with geometry
and a placed/hidden label result; `PieLabel` renders that record explicitly.

Two core computed slots own angle and label-layout caching. There are no
per-slice observers, registration effects, second traversals, or separate frame
loops. Data and label callback signal reads are tracked by those computations.
Outside labels require O(n log n) sorting and linear packing; the cache avoids
both during paint-only selection. Children still render once per source row and
the ordinary Canvas root repaints. Core Wedge still constructs its normal paths.

An executable public-API counter test proves four row compositions per render,
no extra value or label callback calls on selection, identical layout records,
and zero new Canvas text measurements on that repaint. The initial Text-based
implementation failed this test because core Text measured again at paint time.
PieLabel now uses a small definePrimitive receiver to paint its premeasured line,
while core Line and Rectangle supply leaders and optional label event targets.
No pixel readback, alternate renderer, or hidden retained bitmap is involved.

Placement supports inside/outside/auto. Outside uses left/right lanes and
horizontal exits into an exterior routing strip; this intentionally replaces
the earlier radial-then-diagonal sketch so leaders cannot cut through the disk.
Strict inside hides non-fitting labels, auto moves them outside, and unavailable
outside space exposes a deterministic hidden result. Font, data, bounds, and
placement changes invalidate layout. Immutable data and stable callbacks are
required for cache reuse. Custom fonts should be loaded before mounting.

Fresh evidence on Node 26.9.0, pnpm 11.21.0 and Chromium: six focused tests pass;
typecheck and focused lint pass; viz build, source/built/editor export parity,
and packed Bundler/NodeNext consumers pass. Node 24 and aggregate verification
remain for hardening after feedback. Current public details are in
`docs/site/api/components/pie-layout.md`.

## Superseded initial proposal

## Problem

The first slice proves pure angle calculation and normal CRC composition, but
requires applications to recreate radial label geometry and placement policy.
The small-slice example hard-codes a top lane and an 8% cutoff. It does not prove
usable labels around an arbitrary pie. Generic anchored boxes alone do not know
the pie silhouette, radial leader routes, or whether text fits a sector.

The user wants specialized visualization pieces, explicit inside/outside label
choice, readable small slices, and an eventual batteries-included chart layer.
Inspection content should remain outside the pie whenever space permits.

## Recommended responsibilities

1. `pieSlices`: retain pure, source-ordered angle calculation, validation, keys,
   and original datum references. Rename its current unshipped `PieSlice` record
   type to `PieSliceGeometry` to distinguish geometry from the component.
2. `PieSlice`: one visualization mark consuming one geometry record. Receives
   radius/center and paint style plus normal CRC event/focus props. Reuses core
   Wedge for a solid sector. It creates no labels, legend, signals, or scheduler.
   Zero-area slices remain non-targetable. Explicit keys preserve mounted state.
3. `PieLabels`: a collection-level label layout and renderer. It needs all label
   boxes to prevent collisions; independent `PieLabel` siblings cannot guarantee
   this without hidden registration or a shared parent. Prefer this collective
   primitive first. Custom render callbacks provide ordinary CRC nodes and must
   declare outer sizes; ordinary text labels can use core text measurement.

A standalone `PieLabel` could later be a lightweight renderer of one resolved
placement, but should not claim collision avoidance. Avoid exporting it merely
to hide a single Text element before there is a demonstrated use.

## Label contract to validate in the next slice

- Explicit `placement="inside" | "outside" | "auto"`; a per-datum callback may
  choose placement for mixed charts. Use outside as the conservative default.
- Inside: horizontal centered text, with its measured box checked against the
  actual sector (and inner hole if donut support is later added). Never shrink
  the font silently. Strict inside omits non-fitting labels; auto sends them
  outside. Expose omitted placements so the application can provide a legend.
- Outside: assign anchors to the left/right side by slice midpoint; keep label
  order consistent with anchor order on each side; pack measured label boxes
  vertically with a minimum gap within explicit bounds. Keep entire boxes
  outside the outer circle, not merely outside each point anchor.
- Leader lines start at the outer arc, travel radially outward, then connect to
  the near edge of the label. Routing must be tested after displacement; reject
  or resolve crossings rather than assuming sorted boxes make every route safe.
- Placement uses source geometry and available allocation, not a percentage
  threshold. Long labels, multiple nearby slices, and reordering are first-slice
  examples, not deferred concerns.
- When labels cannot fit, do not overlap them, inflate wedge areas, or silently
  group data. Return a deterministic overflow/omission result. The example keeps
  all categories available in a readable, interactive legend.
- Label interaction remains explicit. Decorative text and leader lines pass
  through pointer input; an application may wrap a label in an ordinary target
  to make tiny categories easier to select without falsifying wedge hit areas.
- Tooltips/readouts are a separate layer. Placement must protect the whole pie
  disk when outside placement is requested. The current reserved side readout
  already satisfies this; arbitrary floating tooltip placement is separate.

## Public shape sketch

The shape below expresses responsibilities, not finalized declarations:

```tsx
const slices = pieSlices(data, { value: "amount", keyBy: "id" });
const geometry = { cx: 240, cy: 220, radius: 140 };

<Group>
  {slices.map((slice) => (
    <PieSlice
      key={slice.key}
      slice={slice}
      style={{ ...geometry, fill: colors[slice.key] }}
      onPointerEnter={() => selected.set(slice.key)}
    />
  ))}
  <PieLabels
    slices={slices}
    placement="auto"
    bounds={{ x: 0, y: 0, width: 480, height: 440 }}
    text={(slice) => `${slice.datum.name} · ${slice.fraction * 100}%`}
    style={{ ...geometry, font: "14px sans-serif", gap: 8 }}
  />
</Group>;
```

The first implementation should validate the text-only path and explicit
inside/outside/auto modes before finalizing a custom-content callback surface.
Internally separate pure placement from drawing so geometry can be tested and
later reused by a full chart component. Whether that placement helper also
needs a public export should follow a concrete application use case.

## Next runnable slice

Replace the demo's raw Wedge mapping and fixed label lane with PieSlice and
PieLabels. Add controls for inside/outside/auto. Use small slices on both sides,
long names, and reordering; show a truthful overflow fallback at narrow widths.
Write a focused public-API test for label containment/separation and selection
before production code. Keep exact wedge hits, stable identity, core scheduling,
and outside inspection intact. Provide the same Studio URL for visual feedback
before broad hardening. Do not add a PieLayout container yet.

Donut compatibility should influence geometry and containment design, but a
public innerRadius option should only be introduced with actual annular paint
and hit-geometry evidence, not a painted-over center.
