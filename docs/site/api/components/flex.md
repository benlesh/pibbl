---
id: api-component-flex
title: Flex
summary: Arranges direct children with Pibbl's explicit Flexbox subset.
kind: api
slug: flex
apiCategory: component
symbols: [Flex]
relatedTypes: [PibblNode, FlexItemStyle, FlexProps, FlexStyle]
---

# Flex

```ts
import { Flex, Rectangle } from "@pibbl/core";
```

`Flex` uses [`FlexProps`](#/api/types/layout#flexprops) and [`FlexStyle`](#/api/types/layout#flexstyle); direct children can supply
[`FlexItemStyle`](#/api/types/layout#flexitemstyle). It accepts recursive [`PibblNode`](#/api/types/elements-components#pibblnode) children and resolves finite
allocations before rendering. Reverse ordering, advanced intrinsic sizing,
scrolling are outside the normal supported subset.

```tsx
const basicFlex = (
  <Flex style={{ width: 300, height: 80, flexDirection: "row", gap: 12 }}>
    <Rectangle style={{ width: 80, height: 60, fill: "#2563eb" }} />
    <Rectangle style={{ width: 80, height: 60, fill: "#f59e0b" }} />
  </Flex>
);
```

Explore the [Flex live example](#/examples/layout/flex).

Experimental layout also provides a bounded direct-child placement adjustment
for a finite nowrap Flex allocation in any main direction. Expanded non-row
placement supports direct or exactly-forwarded primitive leaves. `position: "static"` keeps the normal
slot and ignores insets. `position: "relative"` keeps the normal slot, then
offsets its final geometry without moving siblings. In LTR, `left` wins over
`right`; in RTL, `right` wins over `left`; `top` wins over `bottom`.

```tsx
const relativeFlex = (
  <Flex
    style={{
      width: 160,
      height: 60,
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: 10,
      layoutDirection: "rtl",
    }}
  >
    <Rectangle
      style={{
        width: 50,
        height: 20,
        flexGrow: 0,
        flexShrink: 0,
        position: "relative",
        left: 12,
        right: 18,
        top: 8,
        bottom: 10,
        fill: "#2563eb",
      }}
    />
    <Rectangle
      style={{
        width: 50,
        height: 20,
        flexGrow: 0,
        flexShrink: 0,
        fill: "#f59e0b",
      }}
    />
  </Flex>
);
```

The first rectangle still reserves its RTL slot, then shifts 18 units left and
8 units down; the second remains in its original slot. This is experimental
layout only. It does not add containing blocks,
percent insets, wrapping, other layout parents, or normal JavaScript Flex.

Experimental direct children can also use `position: "absolute"` with numeric
width/height and optional numeric physical insets. Such a child leaves Flex
allocation while keeping its authored paint, target and focus order:

```tsx
<Flex style={{ width: 160, height: 60, gap: 10, alignItems: "flex-start" }}>
  <Rectangle style={{ width: 50, height: 20, flexShrink: 0, fill: "teal" }} />
  <Rectangle
    style={{
      position: "absolute",
      width: 30,
      height: 20,
      left: 12,
      top: 8,
      fill: "tomato",
    }}
  />
  <Rectangle style={{ width: 50, height: 20, flexShrink: 0, fill: "gold" }} />
</Flex>
```

The gold rectangle keeps its ordinary x=60 slot. The tomato rectangle paints
between its two siblings and uses the parent's inner-border edge as its inset
origin; padding does not add to explicit insets. Left wins over right in LTR,
right wins in RTL, and top wins over bottom. On an axis without an inset, the
fixed child uses parent content-box `justifyContent` or `alignItems` alignment.
For example center/flex-end puts a30×20 child at77,62 inside the decorated
204×104 parent from the positioning rehearsal; supplying left12 changes only x
to14. Stretch keeps the fixed height at cross-start. A width or height may be `"auto"` or omitted when both finite numeric
physical insets for that axis are present, or when the opposite axis is explicit
finite numeric with a positive finite `aspectRatio`. A paired inset axis wins:
Pibbl uses the remaining inner-border extent after subtracting those insets and
clamps a negative result to zero. Without that pair, Pibbl derives the automatic
outer axis from the declared numeric opposite axis before bounds. Finite numeric
`minWidth`, `maxWidth`, `minHeight`, and `maxHeight` then clamp used axes
independently before left/right/top/bottom precedence chooses the final origin;
a clamp does not recouple the ratio. A numeric minimum above its maximum rejects; this preserves
Pibbl's existing validation rather than Yoga's minimum-wins conflict behavior.
`aspectRatio` requires exactly one automatic axis and one declared numeric axis;
both-automatic and both-explicit ratio cases remain unsupported. Without a ratio,
both automatic axes may use their own opposing inset pairs. This is finite
placement arithmetic, not intrinsic measurement. An automatic
or omitted axis without both insets or admitted aspect derivation, percentage
insets, nonnumeric or automatic
bounds, direct layout children, child box decoration, margins and general nested
containing-block selection remain unsupported.

The experimental `layout-wasm` Studio build additionally supports finite numeric
physical margins in finite rows and columns, with nowrap or wrap. `margin` sets all four edges;
`marginTop`, `marginRight`, `marginBottom` and `marginLeft` override individual
edges. Values use logical Canvas units and may be negative. Margins stay outside
paint and hit bounds. Normal JavaScript Flex and other layout families currently reject these fields. Percentage, auto and logical
margins remain unsupported.

```tsx
const marginFlex = (
  <Flex style={{ width: 100, height: 30 }}>
    <Rectangle style={{ width: 80, height: 20, margin: 5, fill: "#2563eb" }} />
    <Rectangle style={{ width: 80, height: 20, margin: 5, fill: "#f59e0b" }} />
  </Flex>
);
```

In that experimental build each painted box is 40 units wide, with a 5-unit
outer margin on each side. See the [experimental public example](#/examples/layout/wasm-flex-text)
and choose Compare Text minimum; the lower right boxes toggle a negative margin and wrapping.

The same experimental build accepts `flexDirection: "row-reverse"` and
`"column-reverse"`, including finite wrapping. Main-axis placement reverses within
each line; source keys, paint/hit priority and tab order stay unchanged. Cross-line
stacking stays forward. `flex-start` and `flex-end` follow the selected main direction.
The experimental build also accepts `flexWrap: "wrap-reverse"`, including reversed
main axes. It reverses cross lines and cross start/end alignment while preserving
source order. Normal JavaScript Flex retains the forward LTR subset.
Use [Flip axes in the keyed collection example](#/examples/layout/wasm-flex-keyed-wrap)
to compare placement with its separate Reverse order control. Click either collection heading to flip cross lines.

`justifyContent`, `alignItems`, `alignContent`, and child `alignSelf` also accept
`"start"` and `"end"`. In LTR layout these stay at left/top and
right/bottom respectively, including reversed axes and cross lines. In contrast,
`"flex-start"` and `"flex-end"` follow the selected Flex direction. Forward axes
accept these values in both builds. The keyed collection example's Cross edge
control demonstrates the distinction while cross lines are reversed.

When content overflows, `space-around` and `space-evenly` use physical LTR start,
including reversed axes and lines. Explicit `center` still centers overflow;
`space-between` falls back to direction-relative `flex-start`. This corrects the
former centered overflow for around/evenly in both JavaScript and experimental
WASM layout. The [comparison example](#/examples/layout/wasm-yoga-migration)
labels native Yoga's differing reversed-overflow results.

Finite Flex items also accept a positive finite `aspectRatio` (outer width / height).
Supply a definite main dimension or `flexBasis`. Each wrapped line solves its main
allocations first, then derives cross sizes; cross bounds may break the ratio.
Intrinsic main inference remains unsupported.

```tsx
const wrappedRatioFlex = (
  <Flex
    style={{
      width: 200,
      height: 200,
      flexWrap: "wrap",
      columnGap: 12,
      rowGap: 10,
      alignItems: "flex-start",
      alignContent: "flex-start",
    }}
  >
    {["A", "B", "C"].map((key) => (
      <Rectangle
        key={key}
        style={{
          width: 80,
          height: "auto",
          flexBasis: 80,
          flexGrow: 1,
          flexShrink: 0,
          minWidth: 0,
          aspectRatio: 2,
          fill: "#2563eb",
        }}
      />
    ))}
  </Flex>
);
```

In the experimental build, the first line has two94×47 boxes and the second has
one200×100 box. In the [comparison example](#/examples/layout/wasm-yoga-migration),
click Next section twice, then Next case + resize to inspect owner resizing and
row/column reversed wrapping with the same public style.

Experimental intrinsic measurement also accepts percentage child `width`,
`minWidth` and `maxWidth` in a nowrap column with an explicit numeric content
width. The measured child must be known Text, Flow, Grid, or a known nowrap
column. Percentages use the settled owner content width; border-box conversion
then subtracts the child's insets once. Percentage main sizes and indefinite or
percentage-dependent owners remain unsupported. In the
[nested-column example](#/examples/layout/wasm-flex-nested-intrinsic), toggle
50% paragraph cap and Toggle width; the following box and its click target move
together.

In experimental allocated Flex, `gap`, `rowGap`, and `columnGap` also accept
percentages. `columnGap: "10%"` uses content width; `rowGap: "20%"` uses content
height, regardless of Flex direction. `gap: "10%"` resolves separately on each
axis before specific values override it. Owner padding and borders are excluded
from the percentage reference. Intrinsic/max-only owners remain unsupported.
In the [comparison example](#/examples/layout/wasm-yoga-migration), click Next
section three times to inspect the pinned percentage-gap resize cases.

Experimental direct Flex children also accept percentage padding. All edges use
the containing content width: `{ left: "10%", right: "15%", top: "5%", bottom: "10%" }`
at width200 means20/30/10/20 logical units. Resolve padding before border-box
conversion, so a150×100 border box contains100×70 content; at owner width300 its
content becomes75×55. Painted content and its targets use the same resolved insets.
Raw percentage padding outside an allocated Flex child and pure intrinsic
measurement remain unsupported; borders remain numeric. In the
[comparison example](#/examples/layout/wasm-yoga-migration), click Next section
four times to inspect content-box and border-box cases.

Experimental wrapped columns also accept automatic cross width when the item
stretches and has a declared main height or basis. Percentage `minWidth`/`maxWidth`
use the finite owner content width; rows use `minHeight`/`maxHeight` against content
height. A minimum can enlarge the line and move following lines; a maximum caps
the item without shrinking a larger fixed sibling's line. Main-axis solving is
reused for cross-only resizing. Non-stretch automatic width and intrinsic main
height remain outside wrapped-column support. In the
[comparison example](#/examples/layout/wasm-yoga-migration), click Next section
five times for these percentage cross-bound cases.

The experimental build accepts `layoutDirection: "ltr" | "rtl"`. Omission inherits
the enclosing layout direction; a root defaults to LTR. Ordinary components,
`Group`, and `Clip` preserve it; `Layer` forwards it to its child surface and
redraws when it changes. Explicit `"ltr"` overrides inherited RTL. A signal can
supply the direction. RTL mirrors row main placement and column cross placement,
including reversed axes and lines. Physical margins stay physical; logical
`start`/`end` follow direction, while `flex-start`/`flex-end` follow the flex axis.
It does not reorder source paint, hits, focus traversal, or text glyphs. Logical border edges and RTL outside experimental Flex remain unsupported. Try
**LTR ⇄** in [keyed wrapped collections](#/examples/layout/wasm-flex-keyed-wrap).

Experimental Flex items also accept `marginStart` and `marginEnd` as signed
`number | Percentage` values. Start is left in LTR and right in RTL; end is the
opposite edge. A child Flex’s explicit direction overrides inheritance for its
own logical margins. Logical edges override physical edges and `margin`, including
explicit zero, independently of declaration order. Percentages use the containing
Flex content width. For example, `style={{ margin: 8, marginStart: "10%" }}`
replaces only the start edge. Toggle **Logical start margin** in the keyed
collection example, then toggle LTR/RTL. Auto margins remain unsupported.

Experimental `paddingStart` and `paddingEnd` override their physical `padding`
edge using the same direction rules, including zero. Padding is nonnegative;
percentages use the containing Flex content width, before border-box conversion.
The receiving child carries canonical numeric padding into nested layout.
[Logical padding](#/examples/layout/wasm-logical-padding) shows a fixed160×80
border-box child while owner resize changes its15% inset and moves content targets.
Logical border edges and unallocated percentage padding remain unsupported.

Experimental `BoxStyle.borderStartWidth?: number` and `borderEndWidth?: number`
map through the receiving box’s direction and override the corresponding physical
`borderWidth` edge, including zero, independently of declaration order. Values
must be finite nonnegative numbers; percentages are unsupported. A child Flex’s
explicit direction overrides inheritance. Allocation canonicalizes logical widths
before content-box/border-box conversion and inset floors. These widths reserve
layout space; painted strokes remain independent. Layer’s own raster dimensions
and child origin retain their existing physical-border behavior. Raw logical
border inputs remain ineligible for frozen allocation caching.

The experimental build supports auto-height row wrapping at a finite numeric
width for direct empty numeric Rectangles with zero grow/shrink and automatic
basis. Numeric gaps and insets follow the normal box rules; available maximum
height does not act as a definite height. A known parent can place a following
sibling from the measured line height. Try the
[intrinsic wrapped row](#/examples/layout/wasm-flex-intrinsic-wrap).
Percentage-dependent owners, flexible children, Text/custom providers, intrinsic
width, and column/reverse/RTL intrinsic wrapping remain outside this bounded path.

In an experimental finite nowrap row, a direct custom primitive with both
`measureIntrinsic` and `measure` can supply height at the final content width.
Finite measurement receives that width as both horizontal constraint bounds;
layout and pointer targets use the resulting height in the same publication.
Declared heights and intrinsic-only leaves keep their existing behavior.

Experimental finite nowrap, wrap and wrap-reverse items may use
[`FlexMargin`](#/api/types/layout#flexmargin) on main-axis edges in any supported
row/column direction, including reverse/RTL. Physical left/right apply to rows;
top/bottom apply to columns. Logical start/end support row main edges after
receiver-direction mapping. Auto edges divide positive free space after sizing
and before justification; with no positive space they remain zero. Pure
intrinsic auto margins remain deferred. Uniform `margin: "auto"` supplies all four
edges before specific physical and logical overrides; explicit zero removes one
auto slot. Finite nowrap/wrap/wrap-reverse rows
and columns also accept physical and logical cross-auto edges on children with
explicit numeric cross size, excluding aspect sizing. These share each item’s line
space and override cross alignment; other automatic child cross sizes remain deferred. Wrapped placement divides
space using only the auto slots on each actual line; a line without auto slots
keeps its justification. The comparison explicitly labels differences from the
pinned Yoga implementation.

Direct wrapped `Text` in a finite experimental nowrap row may use automatic height
with a cross-auto margin at declared numeric width. Use a generic font and
visible/default fit and overflow; aspect sizing and prepared queries are excluded.
Text is measured at final width before auto-margin placement, and auto cross edges
suppress stretch. The Studio comparison’s Text cross-auto section demonstrates
width80→40 changing height20→30 and moving the Text top80→70 without replacing focus.
Opaque components, wrapping rows, column automatic cross sizing and pure
intrinsic owners retain their existing diagnostics.

Direct custom primitives with both pure `measureIntrinsic` and `measure` providers
may also use measured automatic height in a finite experimental nowrap row at
declared numeric width, without aspect sizing or prepared queries. Resolve
participation styles with `resolveStyle` and return allocated drawing dimensions.
The Studio custom cross-auto section lays out eight jobs: width80→40 changes
height20→40 and top80→60. Wrapping rows, automatic widths, columns and pure
intrinsic owners remain outside this bounded contract.

A direct built-in `Flex` owner also supports measured automatic height with
cross-auto margins in a finite experimental nowrap row. Its inner layout must be
a finite numeric-width LTR wrapped row of direct numeric Rectangles with zero
grow/shrink, without query/aspect sizing. Unsupported intrinsic content remains
an error even under stretch. The Studio owner cross-auto section shows three
jobs changing height60→90 and top60→30 as width160→90. Other layout-owner and
pure intrinsic auto-margin shapes remain deferred.

The direct generic wrapped Text cross-auto subset also accepts omitted or
`'auto'` width with automatic basis, zero grow, positive/default shrink and no
main min/max. Visible/default fit/overflow and no query/aspect sizing remain
required. Natural Canvas width supplies its basis; final allocated width controls
line count before auto-margin placement. In the Text comparison, a140→100px
row with a40px sibling changes one10px line at y90 to two at y80/90. This is
host Text sizing, without a native font-parity claim.

Direct generic wrapped Text with finite numeric declared width also supports
measured automatic height/cross-auto margins in an experimental LTR row/wrap
container, with automatic basis and zero grow/shrink. Keep visible/default
fit/overflow and omit query/aspect sizing. Its auto margin absorbs space in its
actual line after final-width measurement. Automatic-width wrapped Text, reverse/
RTL/wrap-reverse, provider/layout-owner and column variants remain deferred.

### Experimental nested containing boxes

Within a direct declarative finite row-nowrap Flex chain, explicit
`position: "static"` passes absolute insets to the nearest containing Flex.
`position: "relative"` establishes a local box. An omitted position retains
Pibbl's existing local boundary. For an inner box at20,10 and an absolute child
with left12/top8, static yields world12,8; relative yields32,18. The inner flow
slot is unchanged. This does not infer containing boxes through opaque
components, Group, Clip, Layer, transforms, Flow or Grid, and adds no public
override. See the layout contract for the bounded admission.

Relative offsets keep their physical final-world sign under main reversal.
The private Yoga comparison labels the four reversed-relative differences;
Pibbl preserves its existing physical-offset contract. Nested static containing
chains remain limited to row/nowrap parent and child Flex boxes.

### Experimental absolute main directions

A finite nowrap Flex accepts fixed numeric and opposing-inset automatic absolute boxes in `row`,
`row-reverse`, `column` and `column-reverse`, including RTL. Physical insets keep
the same padding-box reference. Without an inset, `justifyContent` controls the
main axis and `alignItems` the cross axis, including reversal and horizontal RTL.
A fixed box keeps its size under stretch. Authored paint, click and focus order
remain unchanged. Numeric bounds apply to fixed and derived axes before inset
anchoring in every direction. Exactly-one-auto aspect derivation also applies in every direction, with paired
insets taking precedence and numeric bounds applied afterward. Natural measured
dimensions require paired pure providers and preserve their existing exact/unbounded
query in every finite nowrap direction. Other automatic axes need their opposing
physical inset pair or the admitted aspect path.

### Experimental measured absolute size

In any finite nowrap main direction, a direct custom primitive with paired pure
`measureIntrinsic` and `measure` providers can use `position: "absolute", width: "auto", height: 20` with, for
example, `right: 18, top: 8`. Without an opposing horizontal inset pair or aspect
ratio, `measure` receives `[0, Infinity]` width availability and exact20px height.
A natural60px width is clamped by numeric bounds and positioned from the owning
padding box. Resizing the owner moves a right-anchored child while preserving the
measurement envelope; conservative invalidation can requery it. Measurement
signals update width and targets through the existing scheduler.

Yoga caps natural-width callbacks to padding-box width in columns. Pibbl preserves
its unbounded-width contract there; the comparison labels this query difference
separately from matching deterministic geometry. This is not callback parity.

The symmetric `width: 80, height: "auto"` path queries exact80px width and
`[0, Infinity]` height. A wrapping provider can return20px at80px width and40px
at40px width; `bottom: 10` anchors the resulting height to the owning padding box.
Both paths query the declared fixed dimension before its own bounds, then clamp
used dimensions. They require exactly one automatic dimension. This does not add
builtin Text/image intrinsic sizing, both-auto natural sizing, opaque component
measurement, margins, decoration or responsive-query support.
