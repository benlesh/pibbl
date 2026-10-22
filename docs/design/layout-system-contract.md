# Pibbl layout-system contract

Status: current implemented contract, updated for external render-layer layout
participation on 2026-09-28.

Pibbl provides dedicated `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid`
components. They arrange direct branded `PibblElement` children into declared
boxes, then traverse those children through the normal immediate-mode renderer.
Layout does not build a retained display list and never speculatively renders a
child to discover its size.

Each layout component accepts recursive `PibblNode` children. Arrays, finite
synchronous iterables, and unkeyed fragments flatten at the receiving layout
boundary; keyed fragments remain direct identity items. Iterables are required
to be finite; infinite iterables are unsupported and Pibbl does not promise to
detect them. Unsupported child values and duplicate sibling keys fail with
contextual errors.

Every layout component is itself a normal component: it can be nested inside
another layout, transformed by `Group`, clipped by `Clip`, or rendered through
a `Layer`. A component returned by `defineRenderLayer` is a
layout-participating Canvas composition primitive; renderer-internal objects do
not become layout items in the parent Canvas algorithm. Source order remains
Canvas composition order and reverse Canvas order remains coordinate-event
target order.

## Shared box, placement, and overflow rules

Layout container `width` and `height` are content-box lengths. When omitted,
they consume the current finite allocation. Padding defaults to zero and
`overflow` defaults to `"visible"`. `overflow: "clip"` clips paint and target
geometry to the content box; it does not create scrolling.

A child's parent-relative placement lives in its own specified style:

- `left` and `top` are parent placement offsets and default to zero where used;
- `alignSelf` and `justifySelf` override a container alignment where supported;
- `flexBasis`, `flexGrow`, and `flexShrink` are consumed only by Flex;
- Grid consumes one-based starts and positive spans.

`PibblRenderLayerStyle` accepts the shared box and layout-item fields. Each
omitted layer dimension uses its current finite logical allocation; an explicit
or allocated width and height must resolve to positive finite values. A render
layer has no intrinsic measurement capability, so an automatic sizing path
must supply a definite size rather than rendering external resources to
discover one.

The runtime places one private wrapper per direct child. The wrapper preserves
the original brand, component type, props, key, compiler source metadata,
policy metadata, and identity hint while translating the child's allocation.
Keyed children survive reflow; unkeyed same-type children retain
occurrence-order identity, and keyed siblings do not consume unkeyed occurrence
slots. A placed child's `useLayoutBox()` is the stable, readonly local box
`{ x: 0, y: 0, width, height }`; reading it never schedules an update. Plain
component props retain the exact specified public style fields and signal
identity; the finite used allocation is exposed separately through
`useLayoutBox()`. For a positioned object style, Pibbl may pass a readonly shallow
copy to carry private placement provenance. It never mutates the authored object
or changes its public keys/values, but object identity is not a contract on that
placed path.

Layout container and item style fields accept signal-valued replacements.
Mounted parent inspection may resolve a child's style before the receiving
child evaluates. Pibbl records those source nodes in a transaction-local
provision keyed by the child's stable primitive receiver token. The successful
child generation adopts and deduplicates that provision; failure, abort,
removal, disposal, or an unclaimed provision releases it without changing the
last successful dependency generation.

Pure `measureElement()` performs the same declared shallow resolution inside
`untracked()`. It creates no renderer consumer, receiver provision, persistent
edge, wrapper signal, or runtime resource. Plain layout props and style fields
create no provision or shallow copy.

Percentages resolve once against the containing content allocation, not again
against the child's final local allocation. The mounted logical viewport from
the [Canvas surface contract](./canvas-surface-contract.md) is the root
containing allocation. Fixed viewports are independent of backing density;
responsive viewports use the current CSS content-box dimensions. All resolved
coordinates and dimensions delivered to Canvas are finite.

Declared boxes control allocation and interaction geometry; drawing may still
paint outside its declared box when overflow is visible. A container does not
silently clip paint merely because a child overflows or uses negative local
geometry.

## Absolute

`Absolute` anchors every direct child independently. Container size defaults to
the current allocation; padding is zero and overflow is visible.

| Item input        | Behavior                                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| `left`, `top`     | finite number or percentage; default zero                                   |
| `width`, `height` | required definite number or percentage in the current public implementation |
| source order      | paint order; later overlap is topmost for coordinate targeting              |

Local primitive `x` and `y` remain independent of `left` and `top`. Absolute
does not implement normal flow, margins, right/bottom anchoring, or automatic
placement.

## Overlay

`Overlay` puts direct children into the same content allocation. Container
`alignItems` and `justifyItems` accept `start`, `center`, `end`, or `stretch` and
default to `stretch`. Child `alignSelf`/`justifySelf` may use `auto` to defer to
the container or choose a supported alignment.

| Alignment | Used position/size                                           |
| --------- | ------------------------------------------------------------ |
| `start`   | leading edge; declared size                                  |
| `center`  | centered; oversized items may receive a negative offset      |
| `end`     | trailing edge; oversized items may receive a negative offset |
| `stretch` | fills the available axis; result clamps at zero              |

Overlay children currently require definite width and height before alignment.
It does not implement z-index: source order is the single paint and target
order.

## Flow

`Flow` is Pibbl-native sequential layout rather than CSS inline formatting.

| Container field  | Supported values and default                  |
| ---------------- | --------------------------------------------- |
| `direction`      | `horizontal` (default), `vertical`            |
| `wrap`           | boolean, default `false`                      |
| `gap`, `lineGap` | finite nonnegative numbers, default `0`       |
| `alignItems`     | `start` (default), `center`, `end`, `stretch` |
| item `alignSelf` | `auto`, `start`, `center`, `end`, `stretch`   |

Items are processed in source order. A finite main-axis bound wraps before an
item only when the current line is nonempty and adding the item plus gap would
exceed that bound. Each line's cross size is its maximum item cross size.
Children need definite dimensions or supported pure measurement. Stretch
clamps at zero. Flow has no CSS inline text shaping, justification, reverse
direction, margin collapsing, or baseline alignment.

## Flex

`Flex` implements a deliberately bounded CSS-compatible subset.

| Container field              | Supported values and default                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `flexDirection`              | `row` (default), `column`                                                                                |
| `flexWrap`                   | `nowrap` (default), `wrap`                                                                               |
| `justifyContent`             | `flex-start` (default), `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`            |
| `alignItems`                 | `stretch` (default), `flex-start`, `flex-end`, `center`                                                  |
| `alignContent`               | `stretch` (default), `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly` |
| `gap`, `rowGap`, `columnGap` | finite nonnegative numbers; axis values override `gap`; default `0`                                      |
| item fields                  | `flexBasis: auto`, `flexGrow: 0`, `flexShrink: 1`, `alignSelf: auto` by default                          |

Basis may be a definite number/percentage or pure measured `auto`. Whenever an
item can shrink or uses measured/automatic basis, it must declare `minWidth` in
a row or `minHeight` in a column. Pibbl does not invent the browser's automatic
minimum size. Lines collect in source order, hypothetical sizes choose grow or
shrink mode, and iterative freeze/redistribution enforces min/max constraints.
Negative remaining space keeps CSS-compatible alignment fallbacks for the
accepted subset.

Reverse directions, `wrap-reverse`, `order`, baseline alignment, auto margins,
percentage gaps, and advanced intrinsic sizing are rejected. Pure intrinsic
measurement of a Flex container is supported only for exact, simple nowrap
cases with allocation-independent tracks/items; wrap, percentage-dependent,
growth-dependent, and otherwise ambiguous cases report unsupported measurement
instead of approximating.

Wrapped Text whose row main-axis size changes is remeasured at its final content
width before its automatic cross-axis height is placed. In a nowrap column,
Text used as an automatic main-axis basis is measured at its final constrained
cross-axis width before that basis and following-sibling positions are resolved. Large finite grow/shrink
factors are normalized before distribution; nonfinite intermediate allocations
fail instead of publishing invalid geometry.

An explicitly experimental `layout-wasm` Studio/test build, and the unpublished
`layout-wasm-built` local Studio lane, use the same public
Flex surface with a private f64 WASM allocator and main/cross-axis placement.
It supports nowrap rows/columns, finite row wrap, and finite column wrap with
declared height/flexBasis and width; wrapped line formation,
per-line allocation and line/item offsets run in WASM. Direct Text in rows is remeasured
at its final per-line content width before line cross sizes settle. Main-axis
minimums remain explicit except for two bounded native policies. A direct empty
Rectangle with no authored children property, no responsive query and finite
nonnegative numeric width and height uses zero as its automatic main-axis minimum.
Direct allocation also accepts percentage dimensions resolved against its definite
parent box; intrinsic Flex measurement retains its percentage rejection.
This applies to direct allocation in rows and columns and the supported nowrap
intrinsic Flex measurement path. Explicit minima, padding floors, shrink factors,
and existing visible/clip behavior still apply. It does not inspect arbitrary
children or custom providers. Separately, this automatic Text minimum applies in a
nowrap row: a direct Text with `wrap: true`, default/visible fit, a generic px font,
positive shrink, and numeric or automatic basis may omit
`minWidth`. Its content minimum is the width of its longest ASCII-space-delimited
run, capped by numeric declared width and maxWidth, never by flexBasis alone.
Padding remains outside that content minimum. Explicit `minWidth`, including 0,
takes precedence. If the minimum exceeds available room, the row overflows;
existing visible/clip container behavior applies. This follows Text's existing
literal-space wrapping, not CSS/Unicode line breaking. Custom fonts, responsive
queries, percentage width/maxWidth, other fitting modes, columns and wrapped Flex
lines keep the explicit-minimum diagnostic. Intrinsic Flex measurement is unchanged.
Experimental `row-reverse` and `column-reverse` retain their row/column sizing
axis and reverse main-axis placement within each source-formed nowrap/wrapped line.
Physical leading/trailing margins follow that direction. `flex-start`/`flex-end`
are relative to its main direction; cross line stacking stays forward. Source
traversal, identity, paint/event priority and tab order do not reverse. Text is not
mirrored. Main placement runs in WASM; flipping only main direction reuses unchanged
allocation and same-axis measurement data, with direction included in placement
cache keys. Normal JavaScript Flex retains its unsupported-direction diagnostic.
Experimental `wrap-reverse` reverses cross-line placement and within-line cross
start/end alignment, including combination with reverse main direction. Physical
cross margins follow that selected cross direction; line membership, identities,
source paint/event priority and tab order stay unchanged. Same-membership line flips
reuse allocation/measurement and main placement, rerunning cross placement only.
RTL remains unsupported.

The experimental allocator also supports direct-item numeric physical
`margin`, `marginTop`, `marginRight`, `marginBottom` and `marginLeft`. Values are
finite logical Canvas units, default zero; a specific edge overrides the uniform
`margin`. Negative margins may overlap siblings or protrude beyond the parent;
source paint/hit order remains unchanged, and existing visible/clip behavior applies.
Margins participate in main free-space distribution and cross alignment outside
padding and the border box. `useLayoutBox`, paint and hit bounds cover only the
shifted border box. Margin-only space is not interactive. Auto intrinsic dimensions
clamp the final signed accumulation at zero, without clamping individual margins.
Margin receiver inputs are layout roles. Finite row/column wrapping includes
margins in line formation and line cross extents, including negative overlap.
Other layout families reject these fields; normal JavaScript Flex retains its diagnostic.
Percentage, auto and logical margins are not yet supported.

The shared private WASM records are ten f64 slots: nonnegative sizing/padding
inputs and bounds retain their validation; signed leading/trailing margins occupy
separate slots. Allocation and main/cross placement run in the same kernel; output
border boxes and both source/built loading forms use the matching artifact.

For the same direct Text subset, automatic width and basis use the natural width
before wrapping, not the containing row's constrained width. The natural query
follows wrapped Text's existing removal of leading ASCII spaces; empty/space-only
content contributes zero. Explicit numeric minWidth (including zero) is supported;
other minimum values retain the existing constrained-basis path. Final allocated
width still determines wrapped height. One current content/font/natural-width
entry per numeric item is retained separately from its two final-size measurement
entries; current receiver content is read before any hit. Content/font changes
replace it, removal releases it, and region disposal clears it. This is a bounded
known-Text query, not speculative measurement of arbitrary providers.
Automatic-minimum queries currently remeasure their word runs on allocation misses;
the measuredLeaves counter includes each such leaf request, not each Canvas word
measurement call. No automatic-minimum cache or performance improvement is claimed.
Wrapped columns reject automatic measured main bases and automatic cross widths
before measurement; intrinsic wrapped containers remain unsupported;
normal builds retain the existing solver. This is not a released replacement,
Yoga parity, or a standalone layout API. See [Plan 010](../project-plans/010-layout-engine-rework.md)
for limitations and evidence. The lineFormations inspector is a cumulative private
solve counter, not a complete work or performance metric. The private built artifact preserves ordinary public
entry names and declarations; normal `dist` remains separate. Public consumer
evidence covers Bundler/NodeNext types, inert unused imports, finite Text/Layer
geometry and exact repeated teardown. This is a local symlink consumer, not a
production loading/distribution policy or packed-consumer release gate.

Within that experimental lane, numeric item identity follows component type and
key (or unkeyed occurrence); actual removal ends that identity. Generic-font Text
measurement caches retain at most two recent content/style/constraint entries per
item, including on signal-valued content. Measurement cache hits retain the exact
Text receiver's input provision. Keyed reorder reuses surviving records; removal
releases the record, its measurement cache, and normal mounted input ownership.
The wrapped collection scenario exercises data-order changes across row and column
lines in both source and unpublished built lanes: surviving mounted stamps/numeric
records persist, restored keys start new lifetimes, targets follow placement, and
disposal returns owned nodes/arenas/measurement entries to baseline. Data reorder
changes source paint order; it does not add CSS order, reversed axes or RTL.
The experimental lane also measures Text leaves and nested known built-in nowrap
columns in an auto-height built-in nowrap column whose width is declared or
stretched from a definite parent column allocation. Each nested column receives
its settled content width before dependent height measurement; parent measurement
adds its padding once. Recursion uses the shared cycle-detecting measurement
context, without speculative ordinary component execution or a fixed-point loop. Padding and width bounds settle before intrinsic height measurement.
A standalone maximum-width constraint alone does not become a definite width. Text width is definite or stretches, children
have explicit main minimums and no intrinsic growth, and percentage child sizes
remain unsupported. Final constrained container width settles before dependent
Text height in either parent axis. Arbitrary components remain opaque; this is not
a general prepared-component protocol. Direct-Text intrinsic snapshots reuse the region-owned two-entry measurement cache
for explicitly generic fonts. Keys include resolved content, metric styles,
structure/order and constraints; each hit still prepares the current receiver
inputs. Snapshot traversal shares isolated measurement state and forbids signal
writes. Removal/disposal release entries. Unsupported shapes, responsive intrinsic
queries and custom font families remain conservative; font-loading/revision
invalidation is not implemented. Known nested nowrap column snapshots also reuse this bounded cache at settled
widths, including opaque children with declared finite sizes. Snapshot traversal
resolves current nested receiver inputs on every hit; changing active signal
dependencies replaces subscriptions normally. Arbitrary opaque measurement and
custom fonts remain conservative. Keyed nested membership/order changes refresh
aggregate snapshots; removed receivers detach, surviving numeric nodes persist and
restored keys begin fresh lifetimes. Retained cache keys contain scalar values,
not descriptor references or subscriptions.
The legacy measuredLeaves inspector counts host measurement entries, including
these aggregate requests; it is not a complete count of Canvas text metric calls.

Managed Canvas Layers under an active allocation in the experimental lane defer
eligible pending Canvas raster work until the parent has settled allocation. This
includes Layers returned by ordinary reusable components, which remain opaque to
intrinsic measurement and execute only in normal traversal. The public
Layer example verifies one final-size raster, cleared former pixels, moved hit
geometry and clean sibling bitmap reuse. Renderer-participant work and deferred
root payloads retain existing scheduling; they do not inherit this guarantee.
Public `defineRenderLayer` runs its lifecycle inline, so it follows the managed
Canvas Layer allocation handoff. The experimental renderer-in-Layer example checks
final resize/render widths, committed edge targets and persistent resource lifetime.
This does not integrate the separate friend-only renderer-work queue.

These are scoped experimental receipts, not a root prepared-tree, custom-font
revision, or Layer allocation-ordering contract.

## Pure reusable layout descriptions

`defineLayoutComponent(describe)` returns a `PibblComponent` whose readonly-props
callback exposes one known drawing/layout primitive root for preparation. Empty
values and transparent unkeyed fragments may surround that root; multiple roots,
an opaque function root or another layout-component root are rejected. Ordinary
components may remain below a known root when their declared boxes suffice; they
are never invoked by measurement. The callback forwards any exposed style prop
explicitly. Parent layout inspects the described root's declared style and carries
its settled content size into that same root when painting.

The Card remains an ordinary type/key identity boundary, with its returned root's
own type/key identity and teardown preserved beneath it. A transaction/receiver
cache shares one prepared descriptor between style preparation, measurement and
paint. There is no cross-frame prop-identity cache. Pure callbacks can read existing
signals, collected with existing receiver provisions and adopted only with restored
mounted ownership. Hooks, Canvas access, allocation reads and signal writes throw;
resource creation is outside the pure-description contract. No scheduler or second
reactive graph is added.

A direct structural Card in a finite mounted nowrap column may receive its
stretched width through a prepared root nowrap Flex column, including numeric
cross-size bounds and padding. The existing column path settles that content width
before intrinsic height measurement. The Card remains the numeric/identity owner;
measurement clones use the prepared root's receiver token, matching its paint path.
It supports the existing generic wrapped Text measurement,
including following-sibling geometry and hits in the experimental lane. Known
fully definite roots can be measured in normal builds too. Finite nested structural Cards with known nowrap-column Flex roots use the same
settled-width recursive measurement path. Original descriptor sources survive
preparation clones so the existing active-source measurement guard detects cyclic
descriptor dependencies. General structural intrinsic sizing outside that bounded
column path and aggregate Card measurement reuse remain unimplemented; unsupported cases stay diagnostic. See
[the API page](../site/api/functions/define-layout-component.md) and
[Plan 010](../project-plans/010-layout-engine-rework.md).

## Grid

`Grid` implements explicit tracks and explicit placement only. Both
`gridTemplateColumns` and `gridTemplateRows` must be nonempty.

| Feature   | Supported contract                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| tracks    | finite nonnegative numbers, exact unsigned decimal percentages, and nonnegative decimal `fr` values                        |
| gaps      | finite nonnegative numeric `gap`, `rowGap`, `columnGap`; no percentages                                                    |
| placement | positive one-based `gridColumnStart` and `gridRowStart`; optional positive spans default to one                            |
| alignment | container `alignItems`/`justifyItems` and child self overrides: `start`, `center`, `end`, `stretch`; defaults stretch/auto |
| overlap   | allowed; source order controls paint and topmost targeting                                                                 |

Fixed tracks, percentages, and gaps are subtracted first. Fractional unit size
is `max(0, remaining) / max(1, totalFr)`, so a total fraction below one leaves
unused free space. An area that extends beyond the explicit track matrix is an
error. Children use definite sizes, stretch, or a supported pure measurement.

Grid rejects missing starts, implicit tracks, auto placement, dense packing,
automatic/content tracks, `minmax`, `repeat`, subgrid, percentage gaps, named
areas, end-line syntax, and `order`. It never silently approximates these CSS
features.

## Pure measurement

`measureElement(element, constraints, service)` and the optional
`definePrimitive` `measure` capability answer a layout sizing question without
render work. Measurement:

- receives normalized style, program props, finite/indefinite constraints, and
  a Canvas text-measurement service;
- returns intrinsic content size, not a border box including the component's
  own padding;
- may recursively measure children through the supplied service;
- cannot call hooks, context accessors, observe a layout box, paint, register
  interaction targets, or acquire runtime resources;
- cannot create image generations;
- cannot traverse an external render layer, invoke its lifecycle, or acquire
  renderer/bitmap resources;
- detects direct and indirect cycles and restores all temporary runtime state
  after success or failure.

Definite dimensions bypass measurement. Built-in `Text` measurement shares the
same wrapping/layout calculation used to paint. `Image` measurement supports
only explicit dimensions; natural image measurement is intentionally
unavailable because it would acquire asynchronous resources. A custom
`definePrimitive` value used in an automatic sizing path must provide a pure
`measure` capability or receive an actionable unsupported diagnostic naming the
axis and child. Plain function components expose no intrinsic measurement
capability and therefore need a definite allocation on that path.

## Composition, failure, and ownership

The geometry equation is ancestor Canvas transform × layout placement × child
transform × local geometry. Paint paths, clipping, layers, and coordinate
regions use that same composition, including fractional and negative local
offsets.

Layout inspection normalizes only direct child style and never invokes render,
hooks, or ownership. Child style is normalized once; measured used sizes are
passed to the eventual render without renormalizing the original specified
style. A thrown render or duplicate-key failure releases targets, handlers,
cursors, image generations, offscreen layers, and component refs exactly once.
Repeated reflow does not accumulate owners.

Offscreen Canvas layers and external render layers share the root interaction
ledger, so nested layout still participates in one global Canvas
composition/target order. `Clip` and layout overflow constraints apply
identically to pixels and coordinate geometry. A complete external render layer
occupies one Canvas paint position; layout cannot interleave a Canvas child
between objects inside that flattened bitmap.

## Deliberate exclusions

Pibbl layout does not promise a complete CSS formatting engine. Deferred features
include margin, scrolling, auto-placement Grid, implicit tracks, advanced CSS
intrinsic sizing, reverse/reordered Flexbox, baseline alignment, percentage
gaps, auto margins, DOM overlays/accessibility, a retained scene graph, workers,
a public virtualization API. Applications can window large datasets and pass
the visible descriptors to Pibbl; the library does not own the records or scroll
model.

Public JSX layout evidence lives in
`packages/core/src/lib/layout/layout-jsx.test.tsx`, the five Studio layout
lessons, DOM-oracle compatibility suites, and deterministic layout laboratory.
See the [style contract](./style-system-contract.md), [user-event
contract](./user-events-contract.md), and [runtime resource ownership
contract](./runtime-resource-ownership.md).

## Responsive style inspection

`style.when` selects local patches against the parent's established content box
before direct-child normalization, measurement eligibility checks, and allocation.
The prepared normalized style and query eligibility travel with that occurrence's
private clones; rendering does not rematch against the final allocated size.
Queries in an inner primitive returned by a placed plain component instead use
that component's incoming allocation. Outer placement props remain raw in plain
functions. Query-free styles retain the existing allocation path.

Nonempty queries on an item that needs mounted intrinsic measurement are
unsupported, including descendants inspected by a measure callback. Give the
item a definite allocation and adapt inside it. Standalone top-level measurement
can use finite maxima on every queried axis; indefinite unqueried axes are
allowed subject to existing measurement support. The eligibility preflight for
indefinite standalone constraints can scan rules before selection, without
repeating signal reads or adding mounted layout passes.

The [responsive styles guide](../site/learn/guides/responsive-styles.md) explains
the placement/content distinction and its observable refactoring consequence.

## Component manipulation

`ManipulationFrame` presents one writable finite box as a freely positioned
allocation. A nested `Flex`, `Flow`, or `Grid` consumes that allocation and
reflows on resize; the frame's handles are chrome rather than layout items.
The outer direct layout parent still owns its child's placement, so a frame with
authored `left` or `top` is invalid directly under `Flex`, `Flow`, or `Grid` in
development/test execution and has no production placement effect. See the
[component-manipulation contract](./component-manipulation-contract.md).
