# CRC first-class style and layout design

Status: implemented by Project Plan 003 on 2026-08-18

Date: 2026-08-17

## Summary

CRC will replace drawing geometry scattered across component props with one
first-class, typed `style` dictionary. Style describes every value that directly
affects visual output or spatial behavior, including primitive geometry such as
a rectangle's width and a path's data. Programmatic inputs and event handlers
remain component props.

Layout will be explicit in the component tree. Dedicated layout components own
layout algorithms; drawing components only paint. CRC will use CSS property
names and keywords only where the supported behavior is compatible with CSS.
When CRC deliberately provides a different algorithm, it will use CRC-specific
nomenclature rather than a misleading CSS name.

This design does not adopt the CSS cascade or inheritance. Every element's style
is local, explicit data. Developers reuse styles through ordinary TypeScript
objects, functions, and object spread.

## Goals

- Make CRC approachable to web developers through familiar, predictable style
  and layout terminology.
- Make one property the authoritative source for one visual concept. For
  example, `style.width` is the only width of a rectangle.
- Let parents inspect a child's declared style before the child renders, so
  layout does not require recording Canvas drawing commands.
- Support absolute positioning, sequential flow, flex, grid, overlays,
  percentages, constraints, and reusable layout-aware components incrementally.
- Preserve CRC's parent-first rendering, source paint order, interaction
  geometry, scheduled updates, identity rules, and deterministic cleanup.
- Keep formatting contexts visible through named layout components rather than
  hidden `display` behavior on arbitrary drawing components.
- Allow rapid development with focused checks per slice and holistic trust
  verification at integration milestones and final completion.

## Non-goals

- CSS selectors, stylesheets, specificity, `!important`, cascade layers, or
  implicit inheritance.
- Parsing arbitrary CSS text or implementing the complete browser style system.
- Automatically inferring the size of arbitrary components from Canvas drawing
  commands.
- A retained display list, retained scene graph, second rendering backend, or
  DOM emulation as a prerequisite for layout.
- Silent approximation of unsupported CSS behavior.
- Making every drawing primitive a layout container.

## Foundational rules

### Style is the visual contract

All directly rendered values belong in `style`:

```ts
rect({
  style: {
    x: 24,
    y: 24,
    width: 180,
    height: 96,
    fill: "#2563eb",
    stroke: "#0f172a",
    strokeWidth: 2,
    opacity: 0.9,
  },
  onClick: handleClick,
});
```

The rectangle has no competing top-level `width`, `height`, `x`, or paint
properties. Path data, text content and typography, and image source/fitting are
also style because they directly determine visual output.

Props contain programmatic component inputs and event handlers:

```ts
MetricCard({
  value: revenue,
  comparison: previousRevenue,
  onSelect: selectRevenue,
  style: {
    width: "100%",
    minHeight: 120,
  },
});
```

Internally, the element descriptor stores style separately from component props
so layout can inspect style without invoking the component.

### Style is explicit and local

- No style value is inherited implicitly.
- No selector or global rule can change an element.
- Component defaults, variants, and caller overrides are combined explicitly.
- Ordinary object-spread order is the precedence model.
- CRC may expose specified and resolved styles for diagnostics, but it does not
  introduce hidden style origins.

```ts
const headingStyle = {
  fontFamily: "Inter",
  fontSize: 24,
  fill: "#111827",
} satisfies TextStyle;

text({
  style: {
    ...headingStyle,
    x: 24,
    y: 32,
    text: "Revenue",
  },
});
```

### Names are behavioral contracts

CRC uses a CSS name only when accepted values have CSS-compatible semantics.
Unsupported properties and values are rejected or documented as unsupported;
they are not accepted with approximate behavior.

CRC-native algorithms use distinct names. For example, a deliberately simpler
one-axis wrapping algorithm may be named `flow`, but it must not masquerade as
CSS block/inline formatting. A same-box composition algorithm may be named
`overlay` rather than claiming CSS positioned-layout equivalence.

The style language may also use SVG/Canvas-familiar geometry and paint terms
where CSS has no equivalent element model, such as path `d`, `fill`, and
`stroke`.

### Layout ownership is explicit

Drawing components paint; layout components arrange:

```ts
flex({
  style: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  children: [
    rect({ style: { width: 80, height: 80, fill: "#f97316" } }),
    grid({
      style: {
        flexGrow: 1,
        gridTemplateColumns: ["1fr", "2fr"],
        gap: 8,
      },
      children: [/* ... */],
    }),
  ],
});
```

The `grid` is visibly both a flex item and a grid container. No anonymous
`layoutItem` wrapper is required, and no drawing component secretly becomes a
formatting context through `style.display`.

## Style vocabulary

CRC owns the system style namespace. Unknown system keys are type errors and,
where runtime validation is possible, actionable diagnostics. Custom component
style data lives under a typed `custom` member so application keys cannot collide
with future CRC properties.

Style types are composed from focused capabilities rather than one permissive
dictionary:

- `BoxStyle`: width, height, minimum/maximum constraints, position, and overflow
  participation. Margin is deferred from the first release.
- `TransformStyle`: translation, scale, rotation, origin, and skew.
- `PaintStyle`: fill, stroke, stroke width, opacity, and component-applicable
  Canvas paint values.
- Primitive styles: rectangle geometry, path data, line coordinates, text and
  typography, image source and fit.
- Container styles: padding, gap, axes, alignment, track definitions, and the
  properties owned by a particular layout algorithm.
- Item styles: parent-consumed flex and grid participation properties such as
  `flexGrow`, `flexBasis`, and grid placement.

A component accepts only the capabilities it can honor. Consistency means that
the same supported property has the same meaning wherever it appears, not that
every property is valid on every component.

## Units and values

- A finite number is a Canvas logical pixel.
- Percentages such as `"100%"` resolve against the relevant axis of the
  containing layout component's content box.
- `"auto"` requests the algorithm's supported automatic or intrinsic behavior.
  It is accepted only when the component and formatting context can resolve it.
- Grid fractional tracks use CSS-compatible `fr` values when the implemented
  grid behavior matches CSS for the accepted case.
- Non-finite numbers are invalid.
- Unsupported cyclic dependencies, such as an intrinsically sized parent whose
  child percentage requires the unresolved parent size, produce a targeted
  diagnostic rather than guessed geometry.
- A root percentage resolves against the intrinsic Canvas width or height. An
  independently supplied root containing box is deferred until its mount/update
  contract is designed.

`calc()`, viewport units, font-relative units, logical writing-mode units, and
custom unit parsing are deferred until separately designed.

## Layout components

The intended family is:

- `absolute`: an explicit containing box for Canvas/SVG-like positioned children;
  outside a layout component, CRC's existing root positioning remains absolute.
- `flex`: a CSS-compatible subset of Flexbox. Accepted properties and values
  follow CSS behavior; unsupported intrinsic or edge cases are rejected.
- `grid`: a CSS-compatible subset of Grid for explicit tracks and explicit item
  placements, expanded incrementally without claiming unsupported auto-placement
  behavior.
- `flow`: a CRC-native sequential and optional wrapping algorithm. It uses its
  own documented behavior unless CRC later implements faithful CSS block/inline
  formatting under CSS terminology.
- `overlay`: a CRC-native same-box composition algorithm with explicit alignment
  and source-order painting.

`row` and `column` are not separate core semantics. Applications may define thin
helpers over `flex` or `flow` when that improves local readability.

## Measurement model

Layout operates on declared and resolved boxes, not inferred paint bounds.
Components may paint outside an allocated box according to the applicable
overflow policy; overflow does not silently resize the layout box.

CRC resolves size in this order:

1. Definite style sizes and parent constraints.
2. Algorithm-owned flexible or track allocation.
3. Supported intrinsic measurement for built-ins and opt-in custom components.
4. An actionable error when a required size remains unknowable.

An opt-in measurement capability is pure with respect to CRC rendering: it may
read props, specified style, constraints, and Canvas measurement services, but it
may not paint, use render hooks, register interaction, or own resources.

Text can measure using the same typography/wrapping utility used to paint. In
the first release, an image participating in layout requires explicit dimensions;
natural image sizing is deferred because loading currently starts during render
and pure measurement may not own that resource. Arbitrary custom components must
declare a size or provide their own measurement capability; CRC does not invoke
them speculatively to discover what they draw.

## Rendering and interaction semantics

- Layout calculation occurs before direct layout children render.
- A layout component returns children through stable internal placement nodes
  that apply the resolved translation, clipping, and layout box. Placement nodes
  carry an opaque identity hint derived from the original child so their common
  wrapper type does not change existing keyed or per-type occurrence identity.
- Drawing components still paint when their component function is invoked.
- Source child order remains paint order unless a later CSS-compatible feature
  explicitly specifies otherwise and updates interaction semantics with it.
- Reverse paint order remains the one-topmost-target rule.
- Placement uses the same Canvas transform and CRC clipping seams already used
  by drawing and interaction, keeping pixels, hit testing, and cursors aligned.
- Stable reflow does not remount keyed children. Moving a child between layout
  parents remains reparenting and may remount under CRC's existing identity rule.
- A layout failure follows the existing fail-closed render and teardown model.

## CSS compatibility policy

Each CSS-compatible layout component publishes an explicit support matrix:

- supported properties;
- supported values and shorthands;
- default values;
- intrinsic sizing requirements;
- insufficient-space and overflow behavior;
- unsupported combinations;
- paint-order and interaction consequences.

For Flexbox, the initial supported subset centers on row/column directions,
definite sizes and bases, measured `auto`, grow/shrink allocation, wrapping,
numeric gaps, and start/end/center/stretch alignment. Reverse directions,
`wrap-reverse`, reordering, baseline alignment, automatic margins, percentage
gaps, and implicit automatic minimum sizes are deferred until CRC can preserve
their CSS sizing, paint-order, and interaction semantics together. The supported
wrapping subset includes CSS `align-content`; shrink/auto-basis cases require an
explicit zero-or-greater main-axis minimum instead of guessing the deferred
automatic content-based minimum.

For Grid, the initial supported subset centers on definite and fractional tracks,
numeric gaps, one-based explicit item placement, spanning, and alignment. Every
initial Grid child must declare its row and column, and both explicit track lists
must be nonempty. Auto placement, auto/content
tracks, dense placement, `subgrid`, and advanced repeat/minmax forms are separate
increments.

## Migration policy

This is an intentional pre-1.0 breaking redesign. The repository migrates to one
authoritative style API; it does not keep geometry simultaneously in legacy props
and style.

- Built-in components move visual values into typed style objects.
- Programmatic values and event handlers remain props.
- Examples, tests, declarations, package consumers, and Studio editor types move
  in the same program.
- A mechanical codemod or temporary migration script may assist repository
  conversion, but the supported public API has no permanent dual-source
  precedence rule.
- Existing rendered behavior remains the migration oracle where semantics are
  intended to stay unchanged.

## Error and diagnostic policy

- TypeScript catches unknown style keys and component-inapplicable properties.
- Runtime checks reject non-finite geometry and unresolved required sizes.
- Diagnostics identify the component, property, supplied value, containing
  layout algorithm, and relevant constraint.
- Unsupported CSS values say that the value is unsupported rather than silently
  substituting a nearby CRC behavior.
- `custom` style data is ignored by CRC and interpreted only by its owning custom
  component.

## Performance policy

- No scene-wide display list or mandatory double render.
- Only participating layout containers inspect and arrange their direct child
  descriptors.
- Explicit sizes stay on a single arrange path; measurement runs only when the
  algorithm requires it.
- Measurement functions are side-effect free and cacheable by type, props,
  specified style, and constraints when evidence justifies caching.
- Full-tree dirty tracking, spatial indexes, worker layout, and retained layout
  graphs are deferred until structural measurements demonstrate a need.
- Performance evidence records layout evaluations, measurements, placed items,
  renders, regions, and owned resources separately from wall-clock timing.

## Rapid verification policy

Development uses the smallest check that proves the current slice:

- Style-schema changes: focused type tests and unit tests.
- Primitive migration: focused component tests plus one representative browser
  pixel/interaction check.
- Layout algorithms: pure geometry fixtures plus one representative public-API
  browser scenario.
- Render integration: focused identity, clip, transform, interaction, and cleanup
  checks.

The complete browser suite, packed consumers, all visual safeguards, lifecycle
stress, and aggregate `pnpm trust` are not required after every small step. They
run at major integration milestones and once before Plan 003 is declared
complete. Visual baselines remain check-only unless an intentional inspected
change is recorded.

## Acceptance criteria

- Every built-in visual property has one authoritative typed style location.
- No style behavior depends on a selector, cascade, or implicit inheritance.
- Dedicated layout nodes make every formatting context visible in the component
  tree.
- A responsive nested flex/grid/overlay example contains no manual sibling
  coordinate accumulation.
- Percent sizes and definite CSS-compatible flex/grid cases match their documented
  CSS behavior.
- Opaque custom components work with explicit size; opt-in measurable components
  work with supported automatic sizing.
- Layout, painting, clipping, hit testing, cursors, identity, and teardown agree
  under nested transforms and reflow.
- The final public API agrees across source, declarations, package output,
  consumers, examples, and Studio editor types.

## Alternatives rejected

- **Record every Canvas operation into a display list before layout.** This would
  infer paint bounds but adds major runtime complexity and cost that declared
  boxes and opt-in measurement avoid.
- **Put layout-only values in a secondary style system while retaining primitive
  geometry props.** This creates two concepts of width and prevents style from
  becoming a coherent rendering language.
- **Allow arbitrary drawing components to become layout containers through
  `display`.** This hides formatting contexts and recreates difficult-to-read
  anonymous container trees.
- **Require a `layoutItem` wrapper around every child.** It makes parent/item
  roles explicit but adds ceremony without enough value when layout component
  names already expose the formatting context.
- **Adopt CSS cascade and inheritance.** Their behavioral indirection conflicts
  with CRC's local, componentized, debuggable model.
- **Use CSS names for approximate CRC algorithms.** Familiar spelling without
  compatible behavior creates false expectations and migration hazards.
