# CRC style and layout architecture

Status: proposed architecture for written-spec review

Date: 2026-08-17

## Purpose

This document translates the first-class style and layout design into a runtime
architecture that preserves CRC's immediate-mode Canvas model. It defines the
responsibilities and execution seams needed for a rapid, incremental
implementation. Exact source filenames may change during planning, but the
boundaries and data flow are architectural commitments unless the design is
amended.

## Existing constraints

CRC currently renders synchronously and depth first on a scheduled animation
frame:

1. Invoke a component function.
2. Let that component paint immediately.
3. Traverse the elements it returned in source order.
4. Restore Canvas and runtime state after the subtree.

Component elements already exist before invocation as lightweight descriptors
containing a function and props. This is sufficient for declared layout. CRC does
not need to record paths, pixels, or drawing commands into a retained display
list.

The architecture must preserve:

- one live CRC mount per Canvas;
- requestAnimationFrame update coalescing;
- parent-path, function, key, and occurrence identity rules;
- Canvas save/restore isolation;
- source paint order and reverse-paint-order logical targeting;
- accumulated transforms and clips shared by drawing and interaction;
- layer ownership and global target ordering;
- fail-closed resource cleanup.

## Architectural units

### Element protocol

The element descriptor gains first-class style metadata:

```ts
interface CompEl<P, S extends SystemStyle> {
  type: CompType<P, S>;
  props: P;
  style: S;
  key?: string;
}
```

The public component call remains a single ergonomic object with reserved
`style` and `key` fields. `defineComp` separates those fields from programmatic
props when it creates the descriptor:

```ts
const Card = defineComp<CardProps, CardStyle>((props, style, ctx) => {
  // props: data, callbacks, and other programmatic inputs
  // style: normalized/resolved visual values for this render
});

Card({
  value: 42,
  onSelect,
  style: { width: "100%", minHeight: 120 },
});
```

`style` defaults to an empty object where a component supports complete defaults.
Required visual inputs remain required by that component's style type.

The repository may keep `key` readable from legacy props during the mechanical
migration, but the canonical descriptor owns key separately. No permanent public
API supports visual values in both props and style.

### Style schemas

Style types are capability intersections, not a global index signature:

```ts
interface BoxStyle { /* size and constraint participation */ }
interface TransformStyle { /* transform values */ }
interface PaintStyle { /* fill, stroke, opacity */ }
interface FlexContainerStyle { /* flex container values */ }
interface FlexItemStyle { /* parent-consumed item values */ }

interface RectStyle
  extends BoxStyle, TransformStyle, PaintStyle {
  x?: Length;
  y?: Length;
  width: Length;
  height: Length;
  custom?: Record<string, unknown>;
}
```

The implementation distinguishes:

- **Specified style:** immutable author input stored on the element.
- **Normalized style:** parsed values, expanded shorthands, and component
  defaults with no parent-derived geometry.
- **Resolved style:** finite values for the current containing box and layout
  allocation, passed to the render function.

There is no cascade or inherited-style stage.

Normalization is owned by focused style modules. Layout-independent paint
normalization does not depend on layout algorithms. Unknown keys are prevented
by TypeScript and may be detected in development diagnostics when plain
JavaScript bypasses types.

### Length and constraint values

The first value model is deliberately small:

```ts
type Length = number | `${number}%` | "auto";

interface Constraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Grid track values add a separately parsed `fr` form. Shorthands normalize to
canonical per-edge or per-axis values before an algorithm runs.

All resolved Canvas geometry is finite. Infinity may represent an internal
unbounded measurement constraint but never reaches a Canvas drawing call.

Percentage resolution uses the containing layout component's content box. The
root containing box is the intrinsic Canvas size unless the mount supplies an
explicit root box.

### Component type capabilities

The component type remains a callable function, matching CRC's current identity
and render model. Optional normalization and measurement capabilities are static
metadata on that same function object:

```ts
type CompType<P, S extends SystemStyle> = ((
  props: P,
  style: Resolved<S>,
  ctx: RenderingContext2D,
) => CRCNode) & {
  normalizeStyle?(style: S): Normalized<S>;
  measure?(input: MeasureInput<P, S>): Size;
};
```

Drawing components render. Measurable components additionally provide a pure
measurement function. Dedicated layout components provide a layout algorithm
and a compatible measurement function so they can be nested inside other
layouts.

Measurement cannot use CRC hooks, paint, mutate runtime ownership, or register
interaction. It can use an explicitly supplied Canvas measurement service. This
keeps measurement deterministic and safe to repeat or cache.

### Layout algorithms

Every dedicated layout component delegates to a small algorithm module with no
Canvas painting responsibility:

```ts
interface LayoutAlgorithm<S> {
  layout(input: LayoutInput<S>): LayoutResult;
  measure?(input: LayoutMeasureInput<S>): Size;
}

interface LayoutResult {
  container: LayoutBox;
  children: readonly ChildPlacement[];
}

interface ChildPlacement {
  element: CompEl<any, any>;
  box: LayoutBox;
  clip?: LayoutBox;
}
```

Initial modules are isolated by semantics:

- absolute containing-box resolution;
- CRC-native flow;
- CSS-compatible flex subset;
- CSS-compatible grid subset;
- CRC-native overlay.

Algorithms depend on normalized style, constraints, and a measurement callback.
They do not depend on global render state, DOM nodes, mouse events, or the Canvas
drawing API.

## Render pipeline

### Normal drawing element

For a drawing element, the runtime:

1. Reads its specified style.
2. Normalizes component defaults and syntax.
3. Resolves percentages and allocation-dependent values from the current layout
   context.
4. Invokes the component with programmatic props, resolved style, and Canvas
   context.
5. Traverses any non-layout children using existing parent-first semantics.

Built-in drawing primitives remain leaves. Custom components may paint and
return ordinary children under CRC's existing traversal model, but only dedicated
layout elements establish a formatting context.

### Layout element

For a dedicated layout element, its component function:

1. Receives its allocated box from the parent layout context or root Canvas.
2. Reads direct child descriptors without invoking child component functions.
3. Normalizes the container and child item styles needed by its algorithm.
4. Resolves definite sizes and calls measurement only for unresolved intrinsic
   inputs.
5. Produces finite child placements.
6. Returns stable internal placement elements in required paint order.

The layout component itself does not paint. Each internal placement element:

1. Saves Canvas/runtime layout state.
2. Applies the placement translation using the existing transform seam.
3. Applies CRC-managed overflow clipping when required.
4. Publishes the child's allocated local `LayoutBox` to style resolution.
5. Renders the original child element.
6. Restores state after the subtree.

This preserves one ordinary component traversal. Layout adds arrangement work but
not a speculative paint pass.

### Nested layout

A nested layout element is an ordinary item to its parent and a formatting
context for its own direct children. The component name makes that role explicit:

```text
flex
├── rect
└── grid
    ├── text
    └── image
```

The flex algorithm resolves the grid's outer allocation. When intrinsic size is
required, it calls the grid component's pure measure capability over the grid's
already-declared direct child elements. Once placed, the grid algorithm resolves
its own children during normal traversal.

If an arbitrary custom component hides a future layout subtree behind its render
function, its parent cannot inspect that hidden subtree. The custom component
must accept a definite allocation or provide its own measurement capability.

## Geometry semantics

### Allocation and local paint coordinates

A layout parent owns the child's allocation origin and available size. Placement
translates the child's local coordinate system to that origin. Primitive `x` and
`y` styles remain local geometry inside that allocation.

- At the root, the local origin is the Canvas origin.
- In `absolute`, declared positions determine placement inside the containing
  box.
- In flow/flex/grid/overlay, the algorithm determines placement; local primitive
  geometry starts at zero unless the primitive style explicitly offsets it.
- A resolved percentage width controls both the primitive's allocated width and,
  for box-shaped built-ins, its painted local width.
- Paint may overflow the allocation when overflow is visible. Paint bounds do
  not retroactively alter allocation.

### Transforms

Layout placement is applied before the child's own transform style. This creates
the composition:

```text
ancestor transform × layout placement × child transform × local geometry
```

Interaction regions and layers capture that same composed transform. Pixel-grid
adjustment runs in the component's local paint space after its resolved dimensions
are known.

### Clipping and overflow

Visible overflow creates no layout clip. Clipped overflow adds a CRC-managed
content-box clip so painting and hit testing use the same intersection. Scrolling
is not implied and remains outside this architecture.

## Identity and ordering

Internal placement uses one stable, module-level component type. It does not
allocate a new component function per child or render.

- A keyed child retains identity across reflow and supported in-parent reorder.
- Unkeyed same-type identity remains occurrence based.
- Moving an element between layout parents changes its parent path and may
  remount it.
- Source order remains paint and reverse target-selection order by default.
- CSS ordering features are not enabled until their paint/interaction order is
  implemented and documented together.

The placement wrapper is an implementation detail and does not become a public
component or an extra author-visible node.

## Measurement architecture

`measure` receives:

- component programmatic props;
- normalized specified style;
- finite or internally unbounded constraints;
- a Canvas text/image measurement service;
- a recursive child-measure callback for dedicated layout components.

It returns a finite preferred size before min/max clamping by the owning
algorithm, or a typed unsupported-measurement result that becomes an actionable
diagnostic when the size is required.

Text measurement and rendering share tokenization, line-breaking, and typography
utilities so measured and painted line boxes cannot drift. Image measurement
uses explicit size before load and may schedule a normal CRC update when natural
dimensions become available. Stale image completions retain existing teardown
rules.

Caching is not required initially. If structural counters demonstrate repeated
identical measurement, cache keys include component type, relevant props,
normalized style, constraints, and measurement-environment inputs such as font.

## Style composition and custom components

Reusable styles are ordinary immutable TypeScript values:

```ts
const cardBase = { minWidth: 240, minHeight: 120 } satisfies BoxStyle;

MetricCard({
  value,
  style: {
    ...cardBase,
    width: compact ? 280 : "100%",
    custom: { density: compact ? "compact" : "comfortable" },
  },
});
```

CRC does not merge parent styles into children. A component that wants to reuse
or forward style data does so explicitly in its component function. `custom` is
typed by the component and ignored by system normalization.

## Errors and failure containment

Errors are classified close to their owner:

- style syntax/unknown value;
- non-finite resolved geometry;
- unsupported intrinsic measurement;
- cyclic or underdetermined percentage sizing;
- incompatible algorithm value;
- internal algorithm invariant violation.

Diagnostic messages include the component type, key when present, property,
value, algorithm, and constraints. Production behavior never sends invalid
geometry to Canvas.

A thrown layout/style error uses the existing render failure path: owned
resources are released and component refs are cleared. Global Canvas and CRC
state are restored in `finally` blocks. Pixels already painted earlier in the
failing frame retain the existing no-rollback behavior.

## Module boundaries

The implementation should preserve these conceptual modules even if filenames
differ:

```text
style/
  types               public capability interfaces
  normalize           defaults, shorthand expansion, value parsing
  resolve-length      number/percent/auto resolution
  diagnostics         typed style/layout errors

layout/
  types               constraints, sizes, boxes, placements
  context             current allocation and containing box
  measure             measurement dispatch and services
  place-child         internal transform/clip placement component
  absolute            absolute algorithm
  flow                CRC-native flow algorithm
  flex                CSS-compatible flex subset
  grid                CSS-compatible grid subset
  overlay             CRC-native overlay algorithm
```

Built-in drawing components depend on style normalization and current layout
context. Pure layout algorithms do not depend on built-in drawing components.
Render integration depends on both but remains small.

## Incremental delivery seams

The architecture is intentionally separable:

1. Add the element/style protocol and migrate existing primitives without adding
   new layout behavior.
2. Add box/constraint/length resolution and root allocation.
3. Add stable placement/context integration and absolute/overlay algorithms.
4. Add pure measurement capability and migrate text/image measurement utilities.
5. Add flow, flex, and grid as isolated algorithms with focused fixtures.
6. Add package, Studio, documentation, and holistic trust closure.

At each seam, existing public rendering is either unchanged or the new behavior
is exercisable through a focused public scenario. No step needs the entire layout
family to exist before it can be reviewed.

## Verification architecture

Fast feedback is the default:

- Pure style/layout modules use fast non-browser unit fixtures.
- Each render-integration seam has a small focused browser contract.
- Component migrations run their existing focused tests rather than the entire
  repository gate after every file.
- One representative nested scenario carries geometry, pixels, hit targets,
  reflow, and cleanup through successive milestones.

Broader checks run after cohesive milestones:

- after all built-in components use style;
- after layout placement and measurement integrate with the runtime;
- after flex/grid reach their declared support matrices;
- once at final Plan 003 completion through the aggregate trust gate.

This cadence does not weaken correctness criteria. It avoids repeatedly paying
the complete package/browser/visual cost while a local slice is still changing.

## Architectural decisions

1. Declared layout boxes, not inferred paint commands, are spatial truth.
2. No retained display list is introduced for layout.
3. Style is first-class element metadata and the sole visual property namespace.
4. Cascade and inheritance do not exist.
5. CSS names imply compatible accepted behavior; divergent algorithms get new
   names.
6. Formatting contexts are dedicated components, never hidden on drawing
   primitives.
7. Direct nesting is supported without public layout-item wrappers.
8. Measurement is opt-in, pure, and separate from render hooks and ownership.
9. Placement composes through existing transforms/clips so drawing and
   interaction share geometry.
10. Rapid focused checks precede milestone and final holistic verification.
