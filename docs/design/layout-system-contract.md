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

Layout container `width` and `height` are content-box lengths by default; the
explicit `boxSizing` policy below can select border-box lengths. When omitted,
they consume the current finite allocation. Padding defaults to zero and
`overflow` defaults to `"visible"`. `overflow: "clip"` clips paint and target
geometry to the content box; it does not create scrolling.

A child's parent-relative placement lives in its own specified style:

- `left` and `top` are parent placement offsets and default to zero where used;
- `alignSelf` and `justifySelf` override a container alignment where supported;
- `flexBasis`, `flexGrow`, and `flexShrink` are consumed only by Flex;
- Grid consumes one-based starts and positive spans.

### Experimental direct-Flex static and relative insets

Experimental finite `Flex` additionally accepts an explicit direct-child
`position: "static" | "relative"` in a row, nowrap allocation under either
LTR or RTL. This is a placement adjustment, not a new containing-block or
out-of-flow system:

- Omitting `position` preserves the existing parent-owned placement behavior
  and its diagnostics for authored `left`/`top` under Flex.
- `position: "static"` reserves the ordinary Flex slot and ignores all four
  physical inset values.
- `position: "relative"` first reserves that same slot, then translates its
  final paint, hit, and focus geometry once. Its local `useLayoutBox()`
  allocation and sibling allocation do not change.
- `left`, `right`, `top`, and `bottom` are finite numeric insets on this path.
  In LTR, `left` takes precedence over `right`; in RTL, `right` takes
  precedence over `left`; `top` takes precedence over `bottom`. The losing
  opposite inset is ignored. A sole right or bottom inset shifts negatively.
- Parent padding and layout borders first establish the ordinary content-box
  slot. Relative offsets apply after that allocation; they do not add those
  decorations again. Four pinned decorated-parent cases cover static/relative
  placement in LTR/RTL.

`Absolute` keeps its existing independent `left`/`top` contract. This slice
does not add absolute positioning, right/bottom anchoring, containing blocks,
percent relative insets, wrapping, Flow/Grid/Overlay participation, or normal
JavaScript Flex support.

### Experimental direct-Flex absolute participation

A finite experimental row-nowrap Flex also accepts a direct child with
`position: "absolute"`, explicit finite numeric width and height, and at least
one finite numeric physical inset on each axis. The child leaves line allocation:
its width, height and flex factors do not consume a sibling slot or an extra gap.
It remains at its authored position in paint order, pointer targeting and focus
navigation. Its ordinary keyed identity and receiver-owned inputs remain active.

Explicit insets follow Yoga's inner-border/padding-box reference: the left/top
origin includes the parent border but not its padding. Right/bottom measure from
the opposite inner border edge. With both horizontal insets, left wins in LTR
and right wins in RTL; top wins vertically. Width and height stay explicit rather
than stretching between opposite insets. Placement is resolved before world
transforms, and forwarded placement is consumed once.

This admission does not add intrinsic or automatic absolute sizing, no-inset
alignment, percentage insets, nested containing-block selection, Flow/Grid/Layer
participation, or a migration of the existing `Absolute` convenience component.
The first admission excludes direct layout-component children, child box
decoration, margins, nonzero bounds, nonzero flex factors, and responsive style
queries. Unsupported contexts and omitted required sizing/insets reject explicitly.

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
coordinates and dimensions delivered to Canvas are finite. Logical layout geometry remains unrounded,
including fractional allocations and composed negative or large local origins.
Layout does not snap child edges independently to a pixel grid. The pinned Yoga
comparison uses point scale zero; positive Yoga pixel-grid snapping is outside
this policy. Backing-density changes affect the root raster transform, not the
logical allocation or interaction geometry.

Declared boxes control allocation and interaction geometry; drawing may still
paint outside its declared box when overflow is visible. A container does not
silently clip paint merely because a child overflows or uses negative local
geometry.

### Box sizing and layout borders

`BoxStyle.boxSizing` is `"content-box"` by default and accepts explicit
`"border-box"`. Dimensions, min/max and Flex basis use the selected box model;
percentages resolve first using their existing axis basis. Numeric padding plus
explicit layout border insets are subtracted once for border-box inputs. Used content dimensions travel through
prepared, measured, stretched and cached descriptors without another subtraction.
Both normal and experimental Flex paths use the same content-valued records.

For width100/height30/padding10, content-box produces content100×30 and outer120×50;
border-box produces content80×10 and outer100×30. Border-box width8 or maxWidth8
with padding10 produces content0 and outer20 on that axis. This padding floor can
overflow a smaller bound or parent allocation, matching pinned Yoga3.2.1; opposing
min/max and negative/nonfinite inputs are still rejected before conversion.
Default content-box constraint behavior is preserved. The option does not turn
painted stroke into a layout border or expand intrinsic provider support.
Percentage padding has the separate allocated-Flex admission below. Existing Layer raster sizing rules remain separate.

`BoxStyle.borderWidth` accepts the same finite nonnegative physical numeric edge
shorthand as padding, defaulting to zero. It reserves layout space without
painting. Content-box40×30 with padding left3/right5/top7/bottom11 and borders
left2/right4/top6/bottom8 has outer54×62 and content origin5,13. Border-box54×62
has identical geometry. Flex basis/intrinsic sizing, Grid stretch and Flow
measurement use combined insets once; border-box floors include both. Percentage
and logical border aliases are outside this slice. `strokeWidth` remains paint.
Layer raster sizing continues to ignore these layout fields by its existing rule.

### Percentage padding in allocated Flex

`BoxStyle.padding` accepts `EdgeValues<number | Percentage>`; the generic edge
shorthand defaults to numbers, so `borderWidth` and `normalizeEdges` stay numeric.
Only experimental direct Flex allocation resolves percentage padding. All physical
edges use the containing Flex content width, including top/bottom; width200 yields
L20/R30/T10/B20 from L10%/R15%/T5%/B10%. A content-box80×60 child is outer130×90;
border-box150×100 keeps its outer box and has content100×70. At owner width300,
the same border box has content75×55. Basis and combined border/padding insets
convert once, before solving, and canonical numeric padding travels into prepared
child painting/hit geometry with the original receiver and query ownership.

Root/unallocated and other-parent raw percentage padding remains rejected. Pure
`measureElement` returns unsupported before measuring a raw percentage-padded
node; constraints/maxima do not supply an allocated owner. A child already
canonicalized by actual Flex allocation can follow existing numeric measurement.
Ordinary JavaScript Flex and percentage borders remain unsupported; experimental logical padding is specified below.
Negative/malformed/nonfinite percentage values are diagnosed. Frozen direct
percentage-padding inputs conservatively bypass the allocation snapshot cache,
whose fallback rebinds raw inputs; numeric inputs remain eligible. Percentage
signals still own normal receiver subscriptions, node identities remain stable,
and disposal releases all layout ownership.

### Finite Flex item aspect ratios

`LayoutItemStyle.aspectRatio?: number` is included in `FlexItemStyle` and is
consumed only by finite Flex, including wrapped lines. It must be positive and finite. A numeric
or percentage definite main dimension or basis is required; both-auto/intrinsic
main sizing is diagnosed as unsupported. Other parent
layout families do not apply this Flex participation field. Root sizing and
Layer raster sizing retain their separate rules.

The ratio is outer width divided by outer height. After main-axis Flex solving,
including grow/shrink and main bounds, derive preferred outer cross size from
that final per-line main allocation. Wrapped line cross sizes and reversed cross placement use these derived sizes. This overrides declared cross dimensions and default
stretch, matching pinned Yoga3.2.1. Subtract combined border/padding cross insets,
floor content at zero, clamp cross content bounds, then add insets once. Cross
bounds can break the ratio; main size is not recomputed. Width90/height50/ratio3
in a row yields90×30; maxHeight20 yields90×20; two width90 shrinkable items in a
100px row yield50×16⅔ each. A column derives width from final height instead.
Margins remain outside the ratio. General intrinsic and coupled-axis ratio
measurement are deferred and pure intrinsic Flex measurement reports unsupported.
The reproducible native semantic probe is `tooling/layout-yoga-rehearsal/aspect-probe.cpp`.

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

Experimental mounted Flow retains style validation and pure measurement in JS,
then resolves source-order line formation, wrapping, gaps/line gaps, and cross
alignment natively in its root-owned region. Horizontal and vertical mappings
preserve the same boxes. Numeric-only cache snapshots include resolved item sizes,
alignment and all placement options, so measured-size changes invalidate placement
while paint-only updates reuse it. There is no experimental native failure fallback.
Ordinary builds and pure measurement/layout helpers retain their existing JS path.

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

| Container field              | Supported values and default                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `flexDirection`              | `row` (default), `column`                                                                                                |
| `flexWrap`                   | `nowrap` (default), `wrap`                                                                                               |
| `justifyContent`             | `flex-start` (default), `flex-end`, `start`, `end`, `center`, `space-between`, `space-around`, `space-evenly`            |
| `alignItems`                 | `stretch` (default), `flex-start`, `flex-end`, `start`, `end`, `center`                                                  |
| `alignContent`               | `stretch` (default), `flex-start`, `flex-end`, `start`, `end`, `center`, `space-between`, `space-around`, `space-evenly` |
| `gap`, `rowGap`, `columnGap` | finite nonnegative numbers; axis values override `gap`; default `0`                                                      |
| item fields                  | `flexBasis: auto`, `flexGrow: 0`, `flexShrink: 1`, `alignSelf: auto` by default                                          |

Experimental allocated Flex also accepts `Percentage` values for `gap`, `rowGap`
and `columnGap`. Resolve column gap against actual content width and row gap
against actual content height, after owner padding/borders; this stays physical
in column Flex. Shorthand percentages resolve independently on both axes, then
explicit row/column values override them. Nonnegative finite results are required.
Numeric behavior remains unchanged and ordinary JavaScript Flex rejects percentage
gaps. Pure intrinsic/max-only owner measurement reports unsupported rather than
using a maximum as definite, dropping percentages to zero, or iterating a cycle.
For outer300×200 with padding L10/R30/T20/B40, content260×140 produces26column-gap
units from10% and28row-gap units from20%. Native pinned fixtures and the public
comparison prove nowrap/wrap, resize, target movement and exact ownership.

Basis may be a definite number/percentage or pure measured `auto`. Whenever an
item can shrink or uses measured/automatic basis, it must declare `minWidth` in
a row or `minHeight` in a column. Pibbl does not invent the browser's automatic
minimum size. Lines collect in source order, hypothetical sizes choose grow or
shrink mode, and iterative freeze/redistribution enforces min/max constraints.
Initial free space is computed after the initial freezing pass, using frozen
target sizes and unfrozen bases. If unfrozen factor totals are below one, partial
free-space consumption follows the current CSS contract for grow and shrink.
Three numerical-allocation divergences from pinned Yoga are recorded in the migration corpus,
including the initial-freeze correction from35→37.5 and65→62.5. See
`tooling/layout-yoga-rehearsal/README.md` for inputs, primary algorithm reference
and independent Chromium evidence. Unconstrained partial-shrink65/65 is preserved.
Negative free space makes `space-around` and `space-evenly` fall back to safe
physical LTR start, including reversed main axes and `wrap-reverse`. Explicit
`center` remains centered even when content overflows; `space-between` retains
its direction-relative flex-start fallback. This corrects the former centered
around/evenly overflow in both JavaScript and WASM. Eight reversed overflow
records explicitly distinguish this independently tested Chromium behavior from
Yoga3.2.1's direction-relative fallback; they are not native parity claims.

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
declared height/flexBasis and a declared or stretched automatic width; wrapped line formation,
per-line allocation and line/item offsets run in WASM. Stretched automatic
cross sizes in wrapped columns use the established line cross size and finite
owner-relative cross bounds. Cross minimum60% at owner cross100→160 expands the
line60→96 and moves the next line72→108 with gap12; maximum25% caps the item25→40
while a40-unit sibling keeps the next line at52. Source-order paint/hit targets
move with those boxes; cross-only updates reuse main solving/line formation.
A bounded nested case applies the same finite-owner cross minimum to a direct
row Flex with two fixed40×20 children. In a200-wide wrapped row, owner height
100→160 resolves its minHeight60% to60→96 and moves the following line y72→108.
The inner leaves retain their logical geometry and identity. This inner automatic
row height performs one pure measurement per preparation; it has no new snapshot
cache admission. Paint-only updates reuse native solves, lines and numeric nodes.
The same nested minimum is evidenced in a row-reverse wrapped border-box owner
244×144→204 with padding10/30/20/20 and border2. Its final content size is
200×100→160: A remains at132,22, fixed inner leaves at132/172,22, and C moves
y94→130. Decorations are removed before the percentage cross bound resolves;
world reversal does not alter the containing content size.
With the same decorated owner, a definite nested height60 capped at maxHeight25%
receives25→40. Its100%-height leaves receive that final allocation once; the
40-high sibling keeps C at y74. This definite path performs no pure measurement.
The rotated decorated column-reverse case uses border-box width144→204/height244,
paddingL20/R20/T10/B30 and border2. A definite width60 capped at maxWidth25%
receives25→40 from content cross100→160; its100%-width leaves consume that width
once, while C stays at74,132. Width-only updates reuse main solves/lines and
this definite path also performs no pure measurement.
With declared width20/minWidth60% in that same column owner, the nested width
and100%-width leaves become60→96; C moves from94,132 to130,132. A point formerly
on C can become part of A1, following source-order targeting of the new geometry.
This definite minimum path likewise performs no pure measurement.
Finite nested Flex allocations resolve percentages from the final inner content
box, after outer line allocation. Pinned row/column × nowrap/wrap resize cases
include inner40% dimensions/bases and10% gaps: allocated main81→51 gives child
main32.4→20.4 and main gap8.1→5.1. The following keyed outer item moves with line
reformation; inner/outer geometry, source hit order, identities, paint-only reuse
and exact cleanup have public source/built/installed evidence. This completes the
finite LTR preserve capability's stated evidence matrix, not the flex-core release
gate or a general intrinsic-percentage policy. Max-only constraints do not create
a definite owner. Intrinsic percentage feedback remains unsupported.

Auto main height/basis has one bounded wrapped-column exception: direct Text
with explicit finite numeric width, wrap true, a generic px font, visible fit and
overflow, explicit minHeight0, zero grow/shrink, no responsive query and no
positive cross minimum or cross/main maximum. It is measured at that fixed content
width before line formation. Other measured main bases and non-stretch automatic
cross measurement remain unsupported in wrapped columns. Direct Text in rows is remeasured
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
Experimental Flex additionally supports inherited `layoutDirection`, as specified below.

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
Finite allocated nowrap, wrap and wrap-reverse Flex rows and columns also accept percentage physical
margins. All four edges resolve against the actual parent content width, including
top/bottom; e.g. outer300 with L10/R30 padding gives content260, so L10%=26 and
T5%=13. Owner resize reruns placement without remounting; paint-only changes reuse
layout. Intrinsic measurement, auto and logical margins remain unsupported. Percentage syntax and finite arithmetic use the shared
length resolver. Numeric wrapped-margin behavior remains unchanged. Percentage wrapping preserves the same
physical leading cross offset: at outer300×200 with L10/R30/T20/B40 padding,
A60×30 with marginsL10%/R15%/T5%/B20% starts36,33. Pinned Yoga3.2.1 instead starts
36,20 in row wrap or10,33 in column wrap. These are labeled preserved physical-margin
placement differences, not percentage-resolution parity or numeric behavior changes. Wrap-reverse also preserves numeric geometry: initial row A36,78/B10,-16
and column A171,33/B9,20; after outer360×250 resize row A42,116/B150,129 and
column A222,36/B54,20. Native Yoga reversed-cross differences are explicitly
recorded rather than changing Pibbl offsets. Signed percentage margins and explicit
zero specific edges follow the same precedence independently of declaration order.

The shared private WASM records are ten f64 slots: nonnegative sizing/padding
inputs and bounds retain their validation; signed leading/trailing margins occupy
separate slots. Allocation and main/cross placement run in the same kernel; output
border boxes and both source/built loading forms use the matching artifact.

Mounted experimental Flex regions share one lazy mutable WASM instance owned by
the top-level Canvas root, including regions inside managed Layers. Each region
owns a separate generational native handle and its own records, line data and JS
caches; releasing a region does not release its peers. Removing all layout content
releases the handles while retaining the instance until root disposal. Different
Canvas roots and standalone pure helper calls have isolated mutable instances.
Root teardown is idempotent. Native traps poison the shared instance without
re-entering it; stale region caches cannot be reused on the next solve. Retired
handle generations never wrap. This ownership foundation is not a root-wide
prepared graph or a transactional geometry-publication guarantee.

In the experimental lane, an Absolute boundary preflights its direct known Flex
siblings' normalized container options, direct-child position/participation syntax
and grow/shrink factors before visiting any sibling's ordinary components. It
shares receiver-owned child sequences and normalized styles within that root
transaction; failed transactions discard these provisional inputs. Opaque
components still execute once with their final allocation. This bounded input
preflight does not pre-solve all geometry, measure arbitrary descendants, validate
all fallible layout operations or provide pixel rollback. Other layout-family
boundaries retain their current traversal behavior.

Those direct known Flex siblings also prepare their own allocations and demanded
pure measurements before sibling component traversal. Stable slots use the parent
occurrence's type/key/occurrence identity and own the same root-native region later
adopted by the mounted Flex. A transaction-local plan carries settled child
placements; rendering consumes it without another allocation pass. Successful
surviving slots retain their numeric records; actual removal releases them and
restoration creates fresh ownership. Failed transactions release unclaimed plans,
and normal component teardown releases claimed regions. The slot annotation follows
internal element clones. Opaque components still run only in source traversal.
This remains known Flex preparation rather than a general all-family graph or
atomic event/focus/HTML publication.

Within that prepared entry, direct built-in Flex descendants recursively prepare
from their settled content allocations. Each parent slot owns child slots by the
same type/key/occurrence identity, including before actual component refs exist.
Nested rendering adopts those plans without re-solving. Active-path descriptor
cycles fail before recursive region growth; the guard does not retain a global
visited set. Parent removal releases descendant slots, while surviving keyed
subtrees retain their regions. Pure layout-description wrappers whose one known
root is Flex participate through the same preparation. Logical wrapper identity
owns the slot while the described root keeps its distinct receiver token. A changed
returned-root type/key replaces region ownership, and delayed old teardown cannot
release the replacement. Descriptions run once per receiver/transaction. Ordinary
components and other layout families are not recursively discovered by this path.

A mounted Flex that was not prepared by its parent first settles its own allocation,
then runs that same known-descendant preparation before visiting its children.
This includes direct Flex roots and Flex returned by an ordinary component. The
ordinary boundary executes once in source order with its final allocation; its
internals are discovered only from that execution. Already-prepared Flex regions
consume their plans without preparing descendants again. This does not preflight
unknown siblings outside the boundary or roll back earlier Canvas pixels.

A known managed Layer occurrence can prepare direct registered Flex, Grid, Flow,
Overlay, Absolute and nested Layer roots at
the settled Layer allocation before earlier sibling traversal. Preparation creates
no child instance or bitmap surface. The exact descriptor and receiver token pass
through the Layer's private fragment; child rendering adopts the same transaction
plan and shared-root native region. Authored child offsets remain unapplied until
normal child rendering. A clean Layer retains its existing descendant ownership
without invoking opaque children again. Removal releases its prepared descendants;
restoration creates fresh regions. Unkeyed occurrences are tracked by root type.
Nested Layers use their actual raster dimensions, including the existing Layer
policy for box constraints/padding; retained cleanup marks both numeric and nested
boundary plans. Pure descriptions are admitted using their cached primitive root and its actual
sizing policy, including nested Layer defaults. Wrapper identity/receiver owns the
slot and the returned primitive receiver claims it; descriptions run once per
transaction. Ordinary components remain opaque.

Direct and opaque-entry experimental Layers prepare the same known children before
creating or updating their child raster surface. Private transaction clones avoid
mutating reusable application descriptors. Managed child invalidation routes through
the owning parent even without an outer layout allocation, so preparation precedes
child traversal. Normal builds preserve their existing scheduling path.

A Grid entry settles its existing explicit tracks and cell placements before
preparing direct known Flex roots from those exact placed clones, receiver tokens
and content allocations. All placements prepare before opaque cell traversal.
Rendering consumes the same Flex plan/region. Grid tracks and explicit cell areas
use the native kernel described above; auto-placement/intrinsic behavior remains
outside this bounded subset.

A known Grid root also participates in outer preparation. Under its receiver,
Grid resolves the existing native track/cell plan, settles its child descriptors,
and prepares known descendants before earlier outer opaque siblings. Rendering
claims the same native region and placed plan once, without another Grid pass.
Shared prepared plans carry common geometry; only Flex plans carry Flex cache
revision metadata. Layer carries registered known-root plans across its raster
boundary as described above.

Flow likewise completes its existing measurement/sequential/wrap placement pass
before preparing direct known Flex roots. It shares Grid's placed-clone handoff,
without extra per-item wrapper allocations or a second placement pass. Ordinary
children remain opaque, and normal traversal claims the same native Flex region.
Experimental mounted Flow places resolved numeric items in the shared native arena; its JavaScript measurement and ordinary-build/pure-helper paths remain.
Known Flow roots also prepare their existing measurement/native placement before
earlier outer opaque siblings, recursively prepare known placed descendants, and
render by adopting the same region/plan. Grid and Flow share this known-descendant
handoff. A definite-root leaf proof measures once per transaction; other intrinsic
constraint demands retain the existing measurement contract.

Known Overlay roots stage their existing aligned placements and prepare known
nested layout descendants before outer opaque siblings. Rendering adopts the same
plan. Overlay owns a structural identity slot, without a numeric native arena;
Grid/Flex descendants retain their existing arena ownership. Ordinary components
remain opaque and this does not establish complete root-wide publication.

Known Absolute roots also stage existing placements and recursively prepare known
children before outer opaque siblings. Rendering claims those exact descriptors;
structural slots add no native arena. Settling a child placement itself does not
create a second unparented known-root plan. Ordinary components remain opaque.

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
Wrapped columns admit only the bounded fixed-width direct Text automatic main
measurement described above; other automatic measured main bases and non-stretch
automatic cross widths reject before measurement. Intrinsic wrapped containers remain unsupported;
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
columns, known Flow roots using existing wrap measurement, and Grid roots using
existing fixed-row sums/gaps (indefinite fraction/percentage rows remain unsupported), in an
auto-height built-in nowrap column whose width is declared or
stretched from a definite parent column allocation. Each known measured child receives
its settled content width before dependent height measurement; parent measurement
adds its padding once. Recursion uses the shared cycle-detecting measurement
context, without speculative ordinary component execution or a fixed-point loop. Padding and width bounds settle before intrinsic height measurement.
A standalone maximum-width constraint alone does not become a definite width. Text width is definite or stretches, children
have explicit main minimums and no intrinsic growth. For a column with an explicit
numeric content width, known Text, Flow, Grid and nowrap-column children may use
percentage `width`, `minWidth` and `maxWidth`: resolve once against that owner
content width, then convert a child's border-box inputs before dependent height
measurement. Width200 with a50% cap means100 outer units for a border-box child;
an owner border-box200 with20padding and6horizontal border supplies174content
units, so its50% cap is87. Main-axis percentages, a percentage-dependent or
indefinite owner and generic component discovery remain unsupported in this path.
No maximum-only constraint becomes definite and no fixed-point iteration is added. Final constrained container width settles before dependent
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

In the experimental build, mounted Grid track resolution uses its own generational
region in the root's shared WASM instance. Numeric/percentage/fraction inputs,
bounds and gaps are cached independently per axis, so paint-only updates reuse
resolved tracks and a width change resolves only the changed axis. Native errors
fail closed; the experimental runtime does not fall back to the JavaScript track
resolver. Explicit cell areas resolve in one native batch after JS validates the
source-order start/span inputs. Cached prefix starts preserve left-to-right offset
sums; span extents sum their own tracks, preserving narrow spans after huge tracks.
The native cache owns only numeric input/result snapshots and reuses unchanged
geometry for paint updates. Unresolved axes and invalid/stale records reject
without publication. JavaScript retains child measurement, sizing and alignment.
The ordinary build and pure
layout helpers retain the current JavaScript path; this is not all-family native
adoption or additional CSS/Yoga parity.

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

Flex accepts `start` and `end` for `justifyContent`, `alignItems`,
`alignContent`, and child `alignSelf`. In the current LTR layout these anchor
to the physical left/top and right/bottom edges, respectively. Unlike
`flex-start`/`flex-end`, they keep those edges under experimental reversed main
axes and `wrap-reverse`. Normal forward axes accept the same values. Experimental `layoutDirection: "rtl"` reflects horizontal placement, so logical
start/end follow inline direction. Alignment changes preserve source paint and
hit order and do not recreate native nodes or rerun numeric allocation.

## Experimental inherited inline direction

`FlexStyle.layoutDirection?: 'ltr' | 'rtl'` is additive and does not overload
`Flow.direction`. Omission inherits the current layout context; roots default
to LTR. Explicit LTR overrides an inherited RTL value. Ordinary components,
Group and Clip are transparent. Layer forwards direction to its child root,
invalidates a retained bitmap on a change, and restores the prior child-root
direction after failure. Normal JavaScript Flex rejects RTL.

Effective main reversal is authored main reversal XOR RTL for rows. Effective
cross reversal is authored wrap reversal XOR RTL for columns. Logical alignment
normalizes authored reversal before that reflection. Physical margins keep their
physical edges. Source traversal, paint/hit priority, focus order and glyph
rendering remain unchanged. Existing allocation contexts, receiver signal inputs,
prepared plans and placement caches carry direction; no separate cascade or
scheduler is introduced. Plans reject mismatched direction before adoption. The
WASM cross-placement ABI is identified by the `layout_abi_v5` export marker (including optional main auto-margin placement and cross-auto flag protocols);
older modules are rejected before publishing compiled code. Logical margin edges are specified below; logical padding is specified below; numeric logical border edges are specified below.

The combined slice95 direction matrix deliberately preserves two existing rules.
Wrapped cross-axis `center` aligns the margin box: margins top2/bottom4 shift the
border-box center by−1 vertically; inline start6/end3 shift it by+1.5 in LTR or−1.5
in RTL columns. Yoga3.2.1's multiline center pass ignores that margin difference.
Pibbl also reflects wrapped columns within the parent's resolved content box;
Yoga's final wrap-reverse pass reflects the already inset position against the
outer box. Asymmetric parent insets therefore add a separate difference. The
native comparison labels both policies and records native `boxes` separately
from preserved `pibblBoxes`; these fixtures are not parity claims. Main direction,
source paint/hit priority, keyed focus and Tab order retain their existing rules.
Slice96 isolates these policies in eight additional pinned fixtures. Zero-margin
columns match native geometry under wrap in LTR/RTL. Under wrap-reverse the
existing asymmetric insets give Pibbl an x offset−14 in LTR or+6 in RTL relative
to Yoga. With root insets zero, logical margins alone produce the±1.5 difference
under either wrapping direction. Both native and preserved coordinates are
recorded; no renderer or border-box sizing rule changes.

## Experimental logical Flex margins

`LayoutItemStyle` and `FlexItemStyle` add `marginStart?: number | Percentage`
and `marginEnd?: number | Percentage`, consumed by experimental Flex only. LTR
maps start to left and end to right; RTL maps start to right and end to left.
A direct child Flex’s explicit `layoutDirection` determines its own logical
margins; otherwise the enclosing Flex direction is inherited. This does not
make direction an arbitrary Rectangle style property. Percentage reference is
always the containing Flex content width, including column layouts. Values may
be signed; auto and nonfinite values remain unsupported.

A specified logical edge wins over the corresponding physical edge; either
specific edge wins over `margin`. Explicit zero wins. Property declaration order
does not affect precedence. Logical mapping precedes physical axis reversal,
line formation and existing margin-box placement. Physical-only behavior is
unchanged. Intrinsic measurement supports winning numeric logical edges; a
shadowed physical percentage does not require an owner basis. Winning percentage
edges still require an actual finite allocation.

Pinned Yoga cases validate both setter orders, explicit zero and signed end
percentages. Four RTL cases combining logical and physical edges report widths
28 or52 in Yoga for a declared40-wide item. Pibbl preserves the declared40-wide
box and its existing physical margin algorithm. The public reference classifies
those cases as `preserved-physical-logical-conflict` with both expected geometries
and an explicit label. This is a recorded difference, not full Yoga parity.

## Experimental logical padding

`BoxStyle.paddingStart?: number | Percentage` and `paddingEnd?: number | Percentage`
map inline start/end through the receiver’s direction. A direct child Flex’s
explicit direction overrides inheritance. A specified logical edge overrides the
corresponding physical edge in `padding`, including explicit zero, independently
of declaration order. Padding is finite and nonnegative. Physical-only box
behavior is unchanged. Numeric logical padding uses ordinary box layout rules
in the experimental build; normal box layout rejects it.

Percentages require an actual finite allocated Flex owner and use its content
width, including column allocation. Allocation resolves only winning edges, then
clears consumed start/end fields and carries numeric physical padding through
box conversion and nested preparation. Receivers do not resolve it again against
their own width. Intrinsic measurement admits winning numeric edges and rejects
active percentages; a shadowed physical percentage does not require a basis.
This admission receives the resolved inherited direction even while measurement
is isolated from the mounted render context. Explicit child direction remains
stronger than that inherited value.

Raw logical padding keeps frozen-input allocation caching ineligible until the
receiver’s canonical input is available. Paint-only rendering still reuses native
allocation and placements. No additional scheduler, retained layout graph or
style cascade is introduced. Numeric checks and edge selection use direct
scalar operations without temporary shorthand edge objects.

Padding on a standalone drawing primitive is parent-layout participation, as
with its physical padding. Layer retains its separate raster sizing rule: its
own physical or logical padding does not inset its child raster or change its
explicit bitmap dimensions. Parent allocation remains distinct from that rule.
Logical borders, unallocated percentage padding and broader intrinsic feedback
remain subsequent work.

Eight pinned Yoga records compare a 100×60 border-box child and its complete
content region under LTR/RTL, both setter orders, start0 and end15%. They preserve
the outer size and match the content geometry exactly. `contentBoxes` is a narrow
reference fixture for that one content rectangle, separate from the existing
two-leaf nested wrapping fixture.

Experimental `BoxStyle.borderStartWidth?: number` and `borderEndWidth?: number`
map through the receiving box’s direction and override the corresponding physical
`borderWidth` edge, including zero, independently of declaration order. Values
must be finite nonnegative numbers; percentages are unsupported. A child Flex’s
explicit direction overrides inheritance. Allocation canonicalizes logical widths
before content-box/border-box conversion and inset floors. These widths reserve
layout space; painted strokes remain independent. Layer’s own raster dimensions
and child origin retain their existing physical-border behavior. Raw logical
border inputs remain ineligible for frozen allocation caching.

### Experimental custom intrinsic providers

`definePrimitive` accepts optional `measureIntrinsic(input): IntrinsicSizesResult`,
separate from unchanged `measure`. It receives resolved props, normalized style,
pure Canvas measurements and width/height availability tagged bounded or unbounded.
The first consumer is a direct custom primitive in a finite nowrap Flex row.
The paired min/max content widths supply the automatic minimum and auto basis;
padding, borders and margins are applied by the parent exactly once. Declared
cross dimensions retain their usual precedence. Explicit `minWidth: 0` and a
definite basis avoid the intrinsic query. Unsupported queries diagnose the missing
contribution; no synthetic width-zero legacy callback approximation is used.

All returned dimensions must be finite and nonnegative, with min-content width
no greater than max-content width. Each height describes content at that intrinsic
width, so height ordering is not required. Hooks, paint and signal writes are
forbidden during measurement. Exceptions propagate without publishing a result.

Successful snapshots publish only after transaction success and are owned by the
existing layout region. Cache hits replay the same receiver dependency provision;
signal invalidation and teardown use existing runtime ownership. Persistent reuse
is conservative: scalar/signal inputs and scalar normalized styles can reuse a
snapshot when their values, availability and allocation revision agree. Mutable
nested props/styles remeasure. Own paint-style changes also remeasure because a
provider can read its entire style; the example demonstrates unrelated sibling
paint reuse. This is not a general nested intrinsic graph, unbounded consumer,
baseline provider, column/wrap, Flow or Grid implementation.

### Experimental finite wrapped-row intrinsic height

A Flex with a finite numeric content width, `flexDirection: "row"`, LTR
`flexWrap: "wrap"` and automatic height can measure direct empty Rectangles with
numeric dimensions and bounds, zero grow/shrink and automatic basis. Numeric
gaps, margins and layout insets use the existing normalization and content/outer
box rules. Parent allocation supplies the final width before line measurement.
Line formation uses clamped outer main extents and the same strict greater-than
break rule as placement; height is the sum of line cross maxima and row gaps.
Own insets are added once by the parent. Available maximum height never becomes
a definite height; natural content can overflow availability, while the parent
retains responsibility for declared bounds and final allocation.

Every outer extent and line accumulation must remain finite. Oversized finite
items terminate as one item per line; empty content has zero content height.
The known owner places following siblings from this measured height before paint.
The public learning example proves footer paint and targets move together when
width160 forms two lines and width90 forms three. Two pinned Yoga fixtures also
compare full leaf geometry and the following footer.

This does not add intrinsic-width solving, column/reverse/RTL wrapping, flexible
child redistribution, percentage-dependent sizing, Text/custom providers inside
wrapped owners, or an arbitrary nested intrinsic graph. Unsupported shapes retain
explicit diagnostics. The ordinary JavaScript build retains its existing scope.

### Experimental custom finite measurement at settled row width

A direct primitive that provides both `measureIntrinsic` and existing `measure`
can determine its automatic cross height after a finite nowrap Flex row settles
the main allocation. The paired intrinsic result remains the contribution for
basis/minimum; finite `measure` receives exact chosen content width through
`constraints.minWidth === constraints.maxWidth`. Real zero-width allocations may
therefore query exact zero; zero is never a synthetic min-content approximation.
Existing cross availability is retained, and parent bounds/insets are applied
through normal allocation exactly once. Declared cross dimensions, aspect sizing,
responsive-query restrictions and intrinsic-only providers retain their existing
paths. Wrapped/reverse/RTL custom-provider graphs are not added by this row behavior. The bounded forward-column case below is separate.

An unsupported finite result is a final-width diagnostic, not permission to keep
a stale preferred height. Failures roll back preparation before earlier sibling
paint and release owned resources; remount is supported. Finite-only signal reads
are staged for the receiving primitive, including adoption on cache hits. Public
`measure` and `MeasureInput` signatures remain unchanged.

Intrinsic and finite snapshots share the existing region owner but use distinct
query keys, with at most three successful passive snapshots per occurrence.
Publication occurs only on transaction success. Scalar/signal admission, complete
style snapshots, mutable nested-input remeasurement and explicit teardown remain
as above. Providers must expose changing inputs through props/style, tracked
signals, or an explicit layout invalidation; hidden mutable closure state is not
a reactive input. Unrelated sibling paint reuses finite measurements. The public
example proves width100→60 changes height20→40 together with paint and hit bounds.

### Experimental finite column custom-provider main measurement

A direct `definePrimitive` with both pure `measureIntrinsic` and `measure` may
supply an automatic height as the main contribution of a finite experimental
`flexDirection: "column"`, LTR, `nowrap` Flex. The item has an automatic basis,
zero grow/shrink, explicit `minHeight: 0`, a declared finite nonnegative numeric content
width, no aspect ratio or prepared style query, and no active cross-axis bound
beyond an omitted or zero `minWidth` and an omitted `maxWidth`. It is not a
wrapped-column admission.

The parent calls finite `measure` with `constraints.minWidth ===
constraints.maxWidth` at that declared content width and `maxHeight` unbounded.
The paired intrinsic provider is required to enter the existing constrained
provider cache; it does not introduce a second measurement system or an
intrinsic width query. The resulting finite height is the column's automatic
main size, so following children move before paint. The eight-job example uses
20px columns and 10px rows: width40→60 resolves height40→30 and moves its
20px follower y40→30. Allocation-width changes replace the constrained snapshot;
paint-only changes reuse it and native nodes. A signal read only in `measure`
remains a measurement dependency: at fixed40px width, jobs8→12 changes height
40→60 and moves the following target without recreating keyed native nodes.

Columns with automatic/indefinite width, nonzero growth/shrink, missing `minHeight: 0`,
active cross bounds, responsive queries, aspect ratio, reverse/RTL direction,
wrapping, providers missing either callback, and opaque components retain their
existing conservative behavior. Normal JavaScript Flex remains unchanged.

## Experimental main-axis auto margins

`FlexMargin = number | Percentage | "auto"` is exported for physical and logical
edge fields: `marginLeft`, `marginRight`, `marginTop`, `marginBottom`,
`marginStart` and `marginEnd`. Finite nowrap, wrap and wrap-reverse experimental Flex supports main-axis
auto margins in row/column, forward/reverse and LTR/RTL. Left/right are row main
edges; top/bottom are column main edges. Inline start/end map through the receiving
direction (including a child Flex's explicit override) before main/cross
admission. Logical edges override physical edges/shorthand; numeric zero can
suppress a physical auto edge. Cross-axis support is bounded below; intrinsic auto
margins remain unsupported. The ordinary build retains its experimental-margin
diagnostic. Numeric/percentage margin behavior is unchanged.

Auto edges contribute zero while flexible lengths resolve. After sizing, each
auto slot receives an equal share of remaining positive main space and consumes
it before justification. Nonpositive free space gives auto edges zero and keeps
existing alignment/overflow behavior. In200px, two40px items with the first item's
left auto margin start120/160; right auto starts0/160; both auto start60/160.
At260px these become180/220,0/220 and90/220. Flex growth consumes space first.
Reversed/RTL main placement maps the same physical flags to before/after; columns
apply the same rule vertically. The shifted border box remains the layout,
focus and hit box; auto-only space is inert. Source paint/Tab order is unchanged.

Rust owns a lazy arena scratch vector of auto flags. Allocation records and
numeric margins are not rewritten, and placement never runs a second sizing
solve. A separate flag revision invalidates the main-placement cache; toggling
the fixed-size numeric0→auto→0 fixture preserves solves, cross placement and
native identities. Unused
auto scratch stays unallocated. Root/region disposal releases flags with their
owner. Module validation rejects older kernels and incomplete v3 exports before
publication without instantiating a version probe; public entries remain
import-time inert. Slice99 adds the v3 wrapped placement entry. Each source-formed
line uses only its own auto slots after sizing; lines without slots retain
justification. Resizing can merge lines without replacing keyed children.

The pinned Yoga3.2.1 implementation counts an overflowing candidate auto slot
before breaking a line. Sixteen wrapped direction cases explicitly classify
Pibbl's CSS line-local result as `css-line-local-auto-margin`, rather than parity.
Native boxes remain recorded alongside independent Pibbl expectations. This
follows [Flexbox main-axis alignment](https://www.w3.org/TR/css-flexbox-1/#main-alignment);
an independent Chromium CSS fixture confirms the first row at10/60 and second
row at60 for three40px items in100px with10px gaps.


### Bounded experimental cross-axis auto margins

Finite nowrap/wrapped/wrap-reverse rows and columns accept physical and logical
cross-edge auto margins when that child has a finite numeric cross size and no
aspect-ratio sizing. Forward/reverse main directions and LTR/RTL are supported.
Logical inline edges map through receiver direction before cross placement.
Other automatic child cross sizes and pure intrinsic measurement remain unsupported;
the direct Text exception is specified below.
No new public operation or return contract is introduced.

Each item distributes its own positive line cross free space equally among its
auto cross edges, before alignment. Top-only auto pushes down, bottom-only up,
and both center. Auto cross edges suppress item alignment even for zero/negative
space: before-auto is zero and the opposite used margin absorbs overflow; an
explicit numeric before margin remains. Source paint/Tab order, border-box
geometry, hit/focus bounds and numeric margin records are preserved. The v5
numeric alignment record includes two flags in its cache key; a cross-only
0→auto→both transition needs no sizing or main placement. Paint-only updates
reuse the resulting placement; owner disposal releases all existing resources.

Pinned Yoga3.2.1 centers the wrapped asymmetric-height fixture for each edge.
Eight top/bottom cases therefore retain native boxes alongside independent
`css-cross-auto-precedence` expectations; four both-auto cases match native.
Chromium CSS independently gives A y20/0/10 for top/bottom/both in a40px line,
with a following line at50. This follows the
[Flexbox cross-axis rule](https://www.w3.org/TR/css-flexbox-1/#cross-alignment).


The slice101 direction extension maps cross-auto flags through effective cross
reversal before calling the same native allocator. No new record bit or placement
path is needed. Wrapped lines are at least as large as their items’ outer cross
sizes; excess container content is handled by existing line placement. Oversized
nowrap column items anchor to inline start: LTR x0 and RTL x−40 for width120 in80.
Cross-only reversal preserves sizing and native identities. Receiver logical-edge
mapping does not redefine the parent’s physical overflow anchor.

All36 additional direction expectations match independent Chromium CSS geometry.
Twenty-four single-edge cases classify the same pinned-Yoga cross-auto precedence
difference; twelve opposing-auto cases match native. Full cross family48 therefore
contains16native matches and32classified differences. Source paint/Tab order,
keyed focus, moved hit targets and exact disposal remain unchanged.


The uniform `margin` field also accepts `FlexMargin`. Auto shorthand supplies all
four physical auto edges; explicit physical edges override only their edge and
logical inline edges override their resolved physical edge. Numeric zero therefore
removes one slot without affecting the others. It uses the same sizing and native
main/cross placement paths; no kernel or ABI changes are needed for shorthand.
Cross-auto requirements apply after overrides: an auto cross edge still requires
finite numeric child cross size without aspect sizing, except the supported direct
Text measurement path below. Normal builds and pure
intrinsic auto-margin measurement retain their existing diagnostics. Source,
built and installed shorthand fixtures cover all/left-zero/top-zero/start-zero in
LTR/RTL. Mounted overrides preserve keyed focus, geometry/hits and paint reuse.


Bounded opposing auto-margin evidence also covers flexible growth consuming free
space, max-width freezing before remainder absorption, min-width shrink freezing,
a numeric opposite edge, and cross-axis min/max before auto distribution. A capped
100px item with two main auto edges starts at30 in200px and60 in260px beside a
fixed40px sibling. Numeric bounds resolve before slot distribution; this evidence
does not change runtime behavior. With two40px items in60px, auto slots become0
and existing center alignment places them at−10/30. Pinned Yoga instead starts
at0/40; `css-nonpositive-auto-alignment` explicitly labels the preserved CSS rule.
Independent Chromium CSS verifies all eight expected boxes. Other automatic/intrinsic
cross sizing remains unsupported; the auto-margin capability is still partial.


### Measured direct Text cross-auto sizing

Direct `Text` in a finite experimental nowrap row may omit height or use automatic
height with a cross-auto margin. Width must be a declared finite nonnegative
number; wrapping must be enabled, font generic, fit/overflow visible/default, and
there must be no aspect ratio or prepared style query. Unsupported Text shapes,
opaque components and columns retain the existing explicit diagnostic. Direct custom
primitives have the separate bounded contract below.
This is allocated Text sizing, not pure intrinsic Flex-owner measurement.

The existing initial and final-main-width measurement passes determine Text’s
preferred cross size. Cross auto then suppresses stretch and absorbs the remaining
row space. No second layout path, native protocol, scheduler, resource owner or
public operation is added. Content/style/constraint cache keys and paint-only reuse
remain unchanged. At width80→40, `aaaa aaaa aaaa` in10px monospace/lineHeight10
changes20→30 high and y80→70 in a100px row; its40px sibling moves x80→40.
Public Canvas draw positions, focused identity, old/new hit points, native node
reuse and exact cleanup prove the transition.

The two pinned Yoga records use an explicit deterministic6px-glyph word-wrap
callback. Its callback provenance is recorded and it makes no font-rendering
parity claim. The browser uses ordinary Canvas Text. Source/built instrumentation
normalizes draws through the actual root transform before comparing logical
geometry, so Studio scaling is not mistaken for a layout difference.


### Measured direct custom primitive cross-auto sizing

A direct `definePrimitive` child with both pure `measureIntrinsic` and `measure`
providers may use automatic height with a cross-auto margin in a finite
experimental nowrap row. It requires a declared finite nonnegative numeric width
and no aspect ratio or prepared query. Existing initial and final allocated-width
measurement determines height before auto absorption and suppresses stretch.
The primitive must resolve participation styles through `resolveStyle`, returning
allocated dimensions in its resolved drawing style; automatic margins are not
drawing inputs. No public API or native protocol is added.

The eight-job public example uses20px columns and10px rows: width80→40 changes
height20→40 and top80→60 in a100px row. Both native records use that explicit
application measurement callback. Stable props/style inputs permit paint-only
measurement reuse; changed props or inputs retain conservative invalidation.
Missing either provider, automatic width, wrapped rows, aspect sizing, column
automatic cross size and pure intrinsic owners remain unsupported. A required
final-width measurement failure prevents earlier paint, releases layout ownership
and permits clean remount.


### Measured wrapped Flex owner cross-auto sizing

A direct built-in `Flex` child may use measured automatic height and a cross-auto
margin inside a finite experimental nowrap row. The inner owner must have a
declared finite nonnegative numeric width, LTR row/wrap layout and no query or
aspect sizing. Its existing bounded intrinsic measurement admits direct empty
numeric Rectangles with zero grow/shrink. Measurement is required even under
outer stretch; unsupported descendants raise the existing diagnostic rather than
using a zero or stretched height. Other layout owners and intrinsic shapes remain
unsupported. This does not add pure intrinsic auto-margin measurement.

In the public comparison, three70px jobs of heights20/30/20 with10px gap produce
height60 at width160 and height90 at width90. A120px outer row places the owner
at y60→30; the following40px target moves x160→90. Pinned Yoga records include
the actual owner and absolute nested boxes. Public pixels, empty-margin misses,
nested job/sibling hits, native identity, paint reuse and exact cleanup exercise
the existing measurement and placement paths without a new protocol or cache.
Paint-only sibling updates reuse native solves and identities, but this wrapped
owner performs one existing pure measurement per preparation. It is not admitted
to the existing column/Text snapshot cache; broader owner caching remains open.


### Natural-width Text cross-auto sizing

Direct generic wrapped `Text` in a finite experimental nowrap row may omit width
or use `'auto'` together with automatic height and cross-auto margins. This
bounded path requires automatic basis, zero grow, positive/default shrink, no
main min/max, no prepared query/aspect sizing and visible/default fit/overflow.
Other main sizing combinations retain the explicit cross-auto diagnostic.

Existing natural Text width supplies the main basis and automatic word minimum;
existing final allocated-width measurement determines line count and height
before cross-auto placement. A140→100px row with a40px sibling changes
`aaaa aaaa aaaa` in10px monospace from one10px line at y90 to two10px lines at
y80/90. Host Canvas metrics determine natural width; no native callback/font
parity is claimed. This adds no measurement API, protocol or cache. Natural/final
width entries retain existing reuse; the automatic-minimum query still records
one pure request per preparation. Sibling paint reuses native solves and nodes.
Public draws, empty-margin and old/new target points, focus preservation and
exact cleanup cover the mounted transition.


### Measured Text cross-auto sizing in wrapped rows

Direct generic wrapped Text with a declared finite numeric width may use
automatic height and cross-auto margins in an experimental LTR row/wrap
container. This bounded subset requires automatic basis, zero grow/shrink,
visible/default fit/overflow and no prepared query/aspect sizing. Explicit
main minimum participation remains required by existing Flex rules. Automatic
width, reverse/RTL/wrap-reverse, provider/layout-owner and column variants retain
their existing diagnostics; nowrap support remains separate.

Native main solving forms lines before the existing final-width Text measurement
updates preferred cross size. Native cross placement then absorbs free space
within each item's actual line. No new native ABI, solver, API or measurement
cache is added. In a150×120 row with10px gap, Text width80→40 changes height20→30
and top20→10 beside a60×40 sibling; a60×30 second-line sibling stays at y50.
The first sibling moves x90→50. Browser Canvas draw/hit/identity evidence defines
the Text contract; no native font-parity fixture is asserted.

### Source-order Canvas integration preservation

Layout changes positions, never source traversal order. Finite reversed/RTL Flex
allocations preserve later-source painting, topmost coordinate targeting and
source keyboard traversal through ordinary components, translated Group, retained
Layer and filter capture boundaries. Filters change pixels without changing the
logical target geometry; `pointerEvents="none"` removes a decorative target while
retaining its paint. Key identity survives direction changes. Paint-only changes
repaint the owning bitmap/composition without another native numeric solve.

The public composition proof uses two60×30 cards in a100×30 row. B has−20px
logical start/end margins and paints after A; Group translates both by2px. Their
world x positions are2/42, then42/2 under row reversal, then2/42 after RTL.
At x52 the later B stays above A through its half-opacity filter and Layer.
Opting B out of pointer events preserves that pixel while selecting A. The
source and installed proofs also retain source Tab order and keyed identity,
repaint changed content, and detach targets/resources on disposal. The browser's
direct-alpha reference can differ from a filtered intermediate bitmap by one
RGB byte due to premultiplication; only that documented tolerance is allowed,
with exact alpha, geometry and target assertions. No visual baseline changes.
