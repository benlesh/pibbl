---
id: guide-responsive-styles
title: Responsive local styles
summary: Adapt a reusable component to its allocated width and height with typed local style rules.
kind: guide
slug: responsive-styles
order: 55
keywords: [responsive, style, allocation, width, height, query, container]
---

# Responsive local styles

Use `style.when` for ordered patches based on available containing size, in Pibbl
logical units. Bounds are inclusive: `minWidth`, `maxWidth`, `minHeight`, and
`maxHeight`. Conditions within one rule all need to match.

There are two authoring boundaries:

- **Outer placement style:** a layout parent inspects its child's style against
  the parent's content size before assigning that child a box.
- **Inner content style:** a primitive returned by a placed plain component sees
  the box assigned to that component. Put rules here to adapt inside a narrow cell.

A Flow placed directly in a 1000-wide Grid queries 1000, even if its eventual cell
is 320 wide. A plain component placed in that cell can return a Flow whose rules
query 320. Extracting a primitive into such a component changes the query basis;
keep this distinction explicit during refactoring.

## One component, different available space

```tsx
import {
  Flow,
  Grid,
  Rectangle,
  signal,
  type BoxStyle,
  type LayoutItemStyle,
  type PibblResponsiveStyle,
  type FlowStyle,
  type SignalValue,
} from "@pibbl/core";

const gap = signal(12);
const contentStyle = {
  width: "100%",
  height: 112,
  direction: "vertical",
  gap,
  when: [
    {
      query: { minWidth: 600 },
      style: { direction: "horizontal", height: 44 },
    },
    { query: { maxHeight: 120 }, style: { gap: 8 } },
  ],
} satisfies PibblResponsiveStyle<FlowStyle>;

type ActionsProps = {
  style?: SignalValue<
    PibblResponsiveStyle<BoxStyle & LayoutItemStyle> | undefined
  >;
};
function Actions({ style: placementStyle }: ActionsProps) {
  // The parent consumes this style for placement. Do not apply it a second time.
  void placementStyle;
  return (
    <Flow style={contentStyle}>
      <Rectangle style={{ width: 112, height: 44, fill: "#17324d" }} />
      <Rectangle style={{ width: 112, height: 44, fill: "#8dd8ff" }} />
    </Flow>
  );
}

const narrowPanel = (
  <Grid
    style={{
      width: 1000,
      height: 160,
      gridTemplateColumns: [320, "1fr"],
      gridTemplateRows: [160],
    }}
  >
    <Actions
      style={{
        width: "100%",
        height: 160,
        gridColumnStart: 1,
        gridRowStart: 1,
      }}
    />
  </Grid>
);
```

The plain `Actions` function receives its original raw `style` prop; Pibbl neither
resolves it for the function nor forwards it to descendants. Its parent inspects
that prop for placement. Keep it named `style` so the parent can find it.

Render `<Actions />` directly in a wide root to get a row, or in a 360-wide
responsive root to get a column. The same `contentStyle` works in all three
contexts. No root-size hook, observer, or additional signal is required.

The equivalent component without JSX uses the same values:

```ts
import { createElement, Flow, Rectangle } from "@pibbl/core";

function Actions({ style: placementStyle }: ActionsProps) {
  void placementStyle;
  return createElement(
    Flow,
    { style: contentStyle },
    createElement(Rectangle, {
      style: { width: 112, height: 44, fill: "#17324d" },
    }),
    createElement(Rectangle, {
      style: { width: 112, height: 44, fill: "#8dd8ff" },
    }),
  );
}
```

These are alternative declarations, not two functions to paste into one file.
Try the [store analytics example](#/examples/layout/responsive-styles): select
30 days, then switch between Dashboard, Sidebar, and Phone. Its revenue card
retains the selected period while its metrics and chart reflow. A short preview
uses ordinary host scrolling; responsive styles do not add scrolling to Pibbl.

## Selection and signals

The base style applies first, then every matching patch in source order. Later
assignments win. Objects and arrays replace whole values, including filters;
there is no deep merge or cascade. Explicit `undefined` replaces an earlier
value and then uses the primitive's normal default or validation.

Fields in the base and every matching patch can be signals. All those fields are
read even if overwritten later. Unmatched patch signals are not read or observed.
A whole-style signal may replace the rules. The rule list, conditions, and patch
objects themselves cannot be signals. Required base fields remain required even
if a patch would supply them. `custom` stays opaque, and nested `when` is invalid.

`style.minHeight` constrains the receiver; `query.minHeight` tests its containing
height. A patch that changes the receiver's size never changes its own query
basis. Its descendants can adapt to the resulting smaller or larger content box.

## Measurement and performance

Give responsive layout items definite sizes or a definite allocated box. If a
parent needs intrinsic (`auto`) measurement of a query-bearing item, Pibbl reports
`PIBBL_STYLE_QUERY_MEASUREMENT`. Repair it by assigning a definite box and putting
responsive content inside the allocated component, as above. Query-free Text
children can still be measured inside an allocated responsive Flow.

Standalone `measureElement` supports a top-level query-bearing primitive only
with finite maximum constraints on every queried axis. A queried descendant
inspected during measurement remains unsupported. No previous-frame size or
iterative layout solver is used.

Rules use the existing scheduler and receiver-owned signals. Static scenes stay
idle; updates do not introduce another animation loop, observer, or layout pass.
Selection cost grows with rule count and matching patch fields. Keep static lists
outside render, as in this example, or use `useConst` for mount-local lists:
recreating nested lists can invalidate retained Layer children. Framework timing
nonregression remains a verification requirement, not a promise that unlimited
rules cost nothing.

## Choosing the right tool

| Intent                                             | Use                                           |
| -------------------------------------------------- | --------------------------------------------- |
| Adapt controls inside an assigned cell             | Inner responsive content style                |
| Change an item's placement within its parent       | Outer responsive placement style              |
| Fit a short panel independently of width           | `maxHeight` or `minHeight`                    |
| Change children, labels, data density, or handlers | Ordinary component code with `useLayoutBox()` |
| Detect pointer precision, hover, or reduced motion | Not part of these size queries                |

Transforms, backing density, and CSS resizing of a fixed logical root do not
change the query basis. Responsive roots follow their CSS content box. Layer
children query their Layer's logical allocation. Capability information is not
needed for deterministic tests; narrow width does not imply touch input.

Responsive styles alone do not solve mobile usability. Touch targets, gestures,
readability, data density, keyboard behavior, and accessible alternatives still
need application design and testing. Opacity zero does not remove hit geometry.
