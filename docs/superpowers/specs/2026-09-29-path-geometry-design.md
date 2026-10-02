# Mutable path geometry design

Status: approved by the user, 2026-09-29. This records the conversation's
agreed direction and proposes the remaining detailed contracts. It does not
describe shipped behavior or authorize unrelated runtime changes.

## Purpose

Provide editable, inspectable geometry for font outlines, shape manipulation,
freehand drawing, and path editors. Applications should construct paths using
familiar Path2D methods, transform them with DOMMatrix, export SVG path data,
and pass them anywhere CRC accepts a native path.

Keep the existing `Path` drawing component. Export the geometry class as
`PathGeometry` from `@crc/core`; no new package or matrix abstraction is needed.

## Decisions established in discussion

- Geometry is mutable, with private packed segment types and numeric operands.
- All changes pass through controlled methods and advance a revision.
- Equality of contents is not part of the API. Consumers detect changes using
  identity plus a separately saved revision, not two reads of a mutable object.
- `toPath2D(geometry)` is a standalone helper returning a fresh caller-owned
  native path. It is not a method and never returns a shared public cache.
- SVG conversion is also a standalone helper.
- CRC continues to paint, clip, and hit-test with native paths internally.
- Flattening, simplification, and subdivision are explicit utilities. Preserve
  the original geometry by returning new geometry from utilities by default.
- Optimize storage, iteration, and conversion frequency structurally; defer
  more elaborate optimizations until representative measurements justify them.

The exact segment editing signatures, arc encoding, utility limits, and SVG
import policy below are design proposals that make these decisions concrete.

## Public authoring

```tsx
import { Path, PathGeometry, toPath2D, toSvgPathData } from "@crc/core";

const outline = new PathGeometry();
outline.moveTo(0, 0);
outline.bezierCurveTo(20, 0, 20, 40, 40, 40);
outline.closePath();
outline.transform(new DOMMatrix().translate(10, 20).scale(2));

const native = toPath2D(outline);
const svgData = toSvgPathData(outline);

// Use inside an ordinary CRC component:
const drawing = <Path style={{ d: outline, fill: "purple" }} />;
```

The class exposes `revision`, `segmentCount`, `clone()`, `clear()`, and the
Canvas path-building methods: `moveTo`, `lineTo`, `quadraticCurveTo`,
`bezierCurveTo`, `arc`, `arcTo`, `ellipse`, `rect`, `roundRect`, and `closePath`.
Builder methods return void, matching Path2D. `transform(matrix)` mutates the
whole geometry and returns void. `addPath(other, matrix?)` copies another
PathGeometry, optionally applying a 2D affine transform to the copy. Subsequent
changes to the source do not affect the destination. Self-addition copies only
the source contents present at method entry.

Construction supports an empty geometry or copying another PathGeometry.
`clone()` creates independent storage; revisions belong to instances and are
not meaningful for comparing different objects.

### Compatibility limits

Path2D exposes no standard segment readback. Native Path2D therefore cannot be
an input to the editable constructor or `PathGeometry.addPath`. Both native and
editable paths remain accepted by CRC's rendering APIs. Do not retain opaque
native subpaths inside editable geometry: that would break export and editing.

SVG string construction is deferred from the initial capability. It requires
an actual SVG parser to populate editable data; delegating to Path2D cannot
recover that data. Existing `SvgPath`, `createSvgPath`, and `useSvgPath` retain
their browser-parsing behavior. Export is included without implying import.

Raw browser methods such as `context.fill` still require a native Path2D.
Interchangeability applies to CRC-owned path inputs, not browser overloads.

## Representation and editing

Use a geometrically growing Uint8Array of segment codes and Float64Array of
operands, with separate used lengths and capacities. Double precision matches
JavaScript numbers and avoids premature precision loss for font transforms.
Capacity is an implementation detail, not observable geometry. `clear()` keeps
capacity, resets contour/current-point state, and removes all segments.

Store canonical geometry rather than a log of every original method call:

| Segment        | Numeric operands                                             |
| -------------- | ------------------------------------------------------------ |
| Move           | endpoint x, y                                                |
| Line           | endpoint x, y                                                |
| Quadratic      | control x, y; endpoint x, y                                  |
| Cubic          | two control points; endpoint x, y                            |
| Elliptical arc | center; two ellipse basis vectors; start angle; signed sweep |
| Close          | none                                                         |

An elliptical arc is parameterized as `center + u*cos(t) + v*sin(t)`.
The basis need not remain perpendicular. This allows affine transformation of
the center and basis vectors directly, including skew and singular transforms,
without flattening or accumulating a transform tree. Exact means analytic
geometry preserved up to floating-point arithmetic, not bitwise identity.

Rectangle and rounded-rectangle methods expand into these segments. `arcTo`
resolves its tangent geometry at construction. Preserve current-point,
implicit-connection, contour-start, and closure semantics of CanvasPath.
Canonicalization may introduce connecting line or move segments; one builder
call does not necessarily correspond to one stored segment.

Public editing uses a discriminated `PathSegment` union with named fields for
the above segment types. `getSegment(index)` returns an independent value;
`setSegment(index, segment)` replaces one segment, including its type if needed.
`spliceSegments(start, deleteCount, segments)` handles insertion and deletion.
Editing validates the resulting contour structure atomically; every drawable
contour starts with a Move. It may scan or shift the affected tail and rebuild
the small current-point state used by subsequent builder calls.

Segment indices are positions, not stable IDs; insertion can shift them. Editors
that need persistent selection IDs own that mapping. Changes to earlier points
do not rerun old `arcTo` or `roundRect` calls: their resolved geometry is stored.

Offer convenient value iteration for application code. Internal conversion and
math use a private allocation-free cursor over the two buffers. Do not expose
mutable buffer views or freeze typed arrays as a substitute for ownership.
Do not add an offsets array or promise constant-time random segment lookup
initially; sequential access is linear overall, while indexed lookup may scan.
Reserve-capacity APIs and a public allocation-free visitor can follow measured
editor needs without changing the representation contract.

## Mutation, revisions, and validation

Expose a read-only numeric revision. Each successful modifying public call
advances it once, including bulk edits and transforms. Invalid calls leave
geometry and revision unchanged. Ignored Canvas inputs do not advance it.
Implementations may conservatively advance for accepted writes that reproduce
existing values; revisions report possible changes, not geometric inequality.

Never allow revision wraparound or loss of integer precision: fail before
mutation if another increment would exceed Number.MAX_SAFE_INTEGER.

For Canvas-compatible builder methods, follow platform validation semantics,
including ignored nonfinite inputs, negative-radius errors, radius-list rules,
degenerate curves, empty contours, and clockwise/counterclockwise sweeps.
Match geometry and exception categories rather than incidental error wording.
New editing methods require finite valid operands and valid indices, and throw
descriptive errors before changing state. Utilities require finite positive
tolerances, spacing, and valid subdivision counts.

Changing geometry does not schedule a frame, notify a signal, or automatically
invalidate a retained Layer. Applications request an update using the existing
CRC scheduling mechanisms. Writing the same geometry back to an equality-aware
signal is not a guaranteed notification. Do not turn this object into another
reactive primitive or scheduler.

Example cache check:

```ts
const unchanged =
  saved.geometry === geometry && saved.revision === geometry.revision;
```

`saved.revision` is captured when conversion succeeds. Reading
`previousGeometry.revision` would not capture historical state. No public
content-equality, hash, or checkpoint helper is introduced.

## Transforms and conversions

Accept DOMMatrix/DOMMatrixReadOnly through a 2D matrix input contract, plus
DOMMatrix2DInit-compatible values. Normalize aliases/defaults consistently with
the platform. Reject genuinely 3D/perspective matrices rather than silently
dropping their terms. No DOMPoint allocation is needed per operand.

`transform` changes coordinates in place where possible. Transform endpoints
and controls as points, ellipse basis vectors as vectors, and preserve segment
and contour order. Reflections naturally reverse ellipse orientation through
the basis. Singular transforms remain supported geometry; do not silently
approximate them away.

`toPath2D(geometry): Path2D` always creates an independent native snapshot.
Walk numeric segments directly without an SVG serialization/parsing round trip.
Normalize general ellipse bases for native ellipse calls. For rank-deficient
ellipses, emit the line traversal split at turning points so backtracking is
preserved, rather than emitting only a chord. Test zero-rank cases and contour
continuity explicitly. This math is a correctness obligation before claiming
full affine-transform support.

`toSvgPathData(geometry): string` serializes absolute SVG path commands,
preserving contour boundaries and Close segments. Convert ellipse bases to SVG
arc parameters, splitting complete revolutions into representable arcs. Handle
singular ellipses with the same traversal-preserving line decomposition.
Default number formatting preserves round-trippable JavaScript precision;
lossy decimal rounding is not implicit. Empty geometry produces an empty string.
No persistent SVG-string cache is retained by the geometry.

## CRC integration and ownership

Introduce a public path-input union `PathGeometry | Path2D`. Extend the Path and
Clip styles, useEventTarget options, useEvent overloads, useRegion, useCursor,
and any other application-facing path input found in the implementation audit.
Internal paint entries, clipping stacks, and native canvas calls remain Path2D.
Existing shape creators and memoized native-path hooks keep their return types.

Resolve a Path input once before fill, stroke, and common event registration.
Resolve a Clip input once for both native clipping and the interaction clipping
stack. Explicit hook inputs resolve at registration/update, never per pointer
event. No new automatic focus bounds are inferred from arbitrary paths.

CRC may privately reuse conversions by geometry identity and captured revision.
The proposed implementation uses a WeakMap keyed by PathGeometry, whose value
contains only the last successfully converted revision and native snapshot.
Do not expose those cached paths through public APIs. Audit custom callbacks
and exported option types to keep native cache references from escaping.

On a changed revision, construct a new snapshot before replacing the cache.
Previously rendered interaction entries and clean retained Layers continue to
reference their old native paths until their own update. This allows one shared
geometry to be consumed by independently scheduled roots without changing old
hit geometry. Conversion failure leaves the previous cache entry intact and
uses existing runtime error handling; it must not serve stale data as success.

There is no append-in-place update of a cached native path. Public conversion
does not use or expose this private cache. Native Path2D inputs pass through
with existing ownership semantics; CRC cannot detect external native mutation.

Internal caching can follow the first runnable slice. The initial slice must
still share one conversion between its paint and event operations. The public
contract does not depend on whether CRC caches across renders.

## Geometry utilities

All utilities return new PathGeometry instances and preserve separate contours.
They do not mutate their input, attach reactive dependencies, or run implicitly
while rendering. Each has a maximum-output-segments option; exceeding the limit
throws rather than silently violating accuracy or returning a partial result.
The proposed default limit is 1,000,000 output segments.

### Flatten

`flattenPath(path, { tolerance, maxSegments? })` adaptively approximates curves
and arcs with lines. Tolerance is required and measured in input coordinate
units. Preserve endpoints, contour order, and closure. Use conservative error
bounds against finite line segments, not only distance to an infinite chord;
loops, cusps, and collinear backtracking must not disappear incorrectly.
Terminate on numerical nonprogress with an explicit error if the requested
tolerance cannot be satisfied within limits.

For screen-space tolerance in the initial API, explicitly clone and transform
before flattening; the result then uses transformed coordinates. A separate
error-measurement matrix that preserves original output coordinates is deferred.

### Simplify

`simplifyPath(path, { tolerance, maxSegments? })` accepts line-only geometry
with Move/Close markers. Curved input throws and requires explicit flattening.
Use a finite-segment-distance polyline reduction algorithm. Preserve open
endpoints, contour order, and closure; never merge contours. Closed contours
need deterministic treatment independent of a duplicated final endpoint and
must not collapse a nondegenerate ring below three distinct vertices.

Tolerance is relative to the input polyline, not an earlier unflattened curve.
Flattening and simplification errors accumulate. This initial utility does not
promise preservation of topology, holes, winding regions, or absence of new
intersections. Font processing requiring those properties needs a future
topology-preserving operation; no silent claim that simplification is safe for
all filled outlines.

### Subdivide

`subdividePath(path, { divisions, maxSegments? })` divides each drawable segment
into a positive integer number of pieces. Use exact Bézier subdivision and
angular subdivision for arcs, up to floating-point error. Divide lines evenly.
Subdivide a closing edge while retaining a final Close marker; do not replace
contour closure with an open line. This increases editable segments without
changing the locus. Equal parameter intervals do not imply equal arc lengths.

### Resampling is a separate follow-up

Resampling by physical spacing is useful for particles, deformation, and
morphing, but was discussed as an extension rather than a required initial
utility. Defer its API until length approximation, corner retention, closed
seams, and endpoint/count rules are designed together. Equal point counts alone
do not establish contour correspondence for morphing.

## Delivery and evidence

The first slice is public creation of a cubic contour, control-point editing,
affine transformation, independent native/SVG export, and rendering through
Path with matching hit testing. Provide a Studio example that allows dragging a
control point and inspecting exported SVG data. Add one focused failing
public-API test before production changes, then publish the exact runnable URL
for hands-on feedback. Do not label this partial slice feature complete.

After feedback, complete Canvas builder coverage, arcs, Clip and hook inputs,
private revision caching, and utility behavior in vertical increments. Keep
learning examples separate from deterministic laboratories.

Focused and final evidence must cover:

- Native parity for every builder, contour/current-point semantics, malformed
  inputs, degeneracies, and self-addition.
- Independent clones, atomic failed edits, revision changes, retained capacity,
  and absence of externally writable storage.
- Affine transforms of curves/arcs, reflections and singular matrices; native
  versus exported-SVG geometry, with browser paint/hit comparisons where useful.
- Fresh public conversions, private reuse for unchanged revisions, one rebuild
  after many edits, and no conversion during pointer dispatch.
- Old interaction/clip snapshots remaining unchanged until consumption, shared
  geometry across roots and retained Layers, and conversion-failure recovery.
- Flattening error and termination, simplification contours/error accumulation,
  and subdivision shape preservation; use semantic geometry before screenshots.
- Public exports/declarations, Bundler and NodeNext consumers, packed output,
  source/built browser modes, and Studio editor declarations.

Measure build-once/render-many, repeated control-point dragging, and continuous
freehand appending. Record conversion counts, allocations where measurable,
and frame timings without making unstable wall-clock thresholds correctness
gates. Defer pooling, incremental native mutation, spatial indexes, hashes,
alternate storage, and automatic derived-geometry caches until evidence warrants
them. Run the repository trust gate for feature completion, not for this design
document or before the first experiential slice.

## References and current integration points

- [Drawing contract](../../design/drawing-components-contract.md)
- [Hooks contract](../../design/runtime-hooks-contract.md)
- [Events contract](../../design/user-events-contract.md)
- [Resource ownership](../../design/runtime-resource-ownership.md)
- [Signals and scheduling](../../design/signals-and-scheduling-contract.md)
- `packages/core/src/lib/components/path.ts` and `components/clip.ts`
- `packages/core/src/lib/events/registrations.ts` and `events/types.ts`
- `packages/core/src/lib/hooks/use-event-target.ts`, `use-event.ts`,
  `use-region.ts`, and `use-cursor.ts`
- [Canvas and Path2D standard](https://html.spec.whatwg.org/multipage/canvas.html#path2d-objects)
- [Geometry interfaces](https://www.w3.org/TR/geometry-1/#dommatrix)
- [.NET GraphicsPath.Flatten](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.drawing2d.graphicspath.flatten?view=windowsdesktop-10.0)
