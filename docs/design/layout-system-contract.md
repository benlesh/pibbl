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
Ordinary JavaScript Flex, percentage borders and logical edges remain unsupported.
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
Finite allocated nowrap and wrap Flex rows and columns also accept percentage physical
margins. All four edges resolve against the actual parent content width, including
top/bottom; e.g. outer300 with L10/R30 padding gives content260, so L10%=26 and
T5%=13. Owner resize reruns placement without remounting; paint-only changes reuse
layout. Intrinsic measurement, wrap-reverse percentage margins, auto and logical
margins remain unsupported. Percentage syntax and finite arithmetic use the shared
length resolver. Numeric wrapped-margin behavior remains unchanged. Percentage wrapping preserves the same
physical leading cross offset: at outer300×200 with L10/R30/T20/B40 padding,
A60×30 with marginsL10%/R15%/T5%/B20% starts36,33. Pinned Yoga3.2.1 instead starts
36,20 in row wrap or10,33 in column wrap. These are labeled preserved physical-margin
placement differences, not percentage-resolution parity or numeric behavior changes.

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
axes and `wrap-reverse`. Normal forward axes accept the same values. RTL
inheritance remains unsupported. Alignment changes preserve source paint and
hit order and do not recreate native nodes or rerun numeric allocation.
