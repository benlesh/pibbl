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

Experimental finite LTR row-nowrap items may use
[`FlexMargin`](#/api/types/layout#flexmargin) on `marginLeft`/`marginRight`.
Auto edges divide positive free space after sizing and before justification;
with no positive space they remain zero. Other auto-margin shapes are deferred.
