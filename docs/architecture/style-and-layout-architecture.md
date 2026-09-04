# CRC style, layout, and element architecture

Status: current architecture. Project Plan 003 established style/layout on
2026-08-18; the JSX authoring pivot updated the element boundary on 2026-09-03.

## Purpose

This document describes how branded elements, local style, pure measurement,
and declared-box layout preserve CRC's scheduled immediate-mode Canvas model.
The completed Plan 003 design and implementation documents remain dated
historical evidence for the original style/layout delivery; this document is
the current authoring and runtime architecture.

## Existing constraints

CRC preserves:

- one live mount per Canvas and identity-guarded, idempotent disposal;
- animation-frame update coalescing and one full synchronous traversal;
- parent scope, component function, key, and occurrence identity;
- Canvas save/restore and fail-closed runtime-state restoration;
- source paint order and reverse source coordinate targeting;
- shared transform/clip/layout geometry for paint and interaction;
- globally ordered offscreen layers; and
- one explicit owner and exact teardown for every resource.

There is no DOM renderer, virtual DOM reconciliation, retained display list,
style cascade, or speculative child render.

## Architectural units

### Element protocol

JSX and `createElement(type, props, ...children)` create the same lightweight
descriptor:

```ts
interface CRCElement<P = unknown> {
  readonly type: CRCElementType<P>;
  readonly props: Readonly<P>;
  readonly key?: string;
}

type CRCComponent<P> = (props: P) => CRCNode | void;
```

The public interface is nominally branded; the runtime uses the non-enumerable
stable global symbol `Symbol.for("@crc/core.element")`. Author props are copied,
`key` is removed and normalized from string/number to string, and compiler or
variadic children are installed in props. Development construction
shallow-freezes the synthetic props and descriptor and `jsxDEV` stores source
metadata privately. Nested author objects are not deep-frozen.

The descriptor is an ephemeral description, not a retained render node.
Calling a component directly does not construct one. Platform component values
report a targeted error when invoked outside the renderer.

### Recursive nodes and preparation

```ts
type CRCNode =
  | CRCElement<any>
  | false
  | true
  | null
  | undefined
  | ""
  | 0
  | readonly CRCNode[]
  | Iterable<CRCNode>;
```

Arrays and finite synchronous iterables flatten recursively. Empty values do
not create identity slots. Unkeyed fragments are transparent; keyed fragments
remain one parent identity boundary. The receiving renderer, container, or
layout component materializes a finite iterable once for its operation.

Raw non-empty text/numbers, Promises, async iterables, functions, symbols,
foreign elements, and unsupported objects reject contextually. `Text` uses a
separate scalar algebra that concatenates strings/numbers (including zero) and
empty values while rejecting elements and async/unsupported input.

### Component type capabilities

The runtime stores private metadata keyed by component function:

- no primitive metadata → invoke the plain function with its props;
- primitive metadata → normalize/resolve style and invoke the primitive render
  callback with program props, finite style, and isolated Canvas context;
- policy metadata → prepare exactly one child before identity dispatch without
  invoking the policy as an ordinary component.

Ordinary application components are plain functions. Simple custom painters
use `crcCanvasContext()` during live rendering. `definePrimitive` is reserved
for platform extension requiring style stages or pure measurement:

```ts
const PlatformValue = definePrimitive<
  ProgramProps,
  Specified,
  Normalized,
  Resolved
>(render, { normalizeStyle, resolveStyle, measure });
```

The returned value is an element type, not an element. Program props cannot
declare reserved `key` or `style`. A specified style with allocation syntax
requires a resolver and its resolved type cannot retain percentages or
`"auto"`.

Transparent `FocusManagement` and `KeyboardNavigation` values attach private
lifecycle descriptors to their one prepared child. They do not paint, lay out,
own hooks, or add identity.

### Style schemas

Visual and layout inputs are always inside `props.style` on the descriptor.
Component-specific schemas positively opt into `SystemStyle` and remain closed.
There is no inheritance stage.

1. **Specified style** is the exact author input.
2. **Normalized style** adds pure defaults and canonical syntax without parent
   geometry.
3. **Resolved style** applies allocation, percentage basis, and constraints and
   contains finite render values.

Opaque string/resource fields such as paint, font, image source, and enum
values are registered so allocation-syntax diagnostics do not reinterpret
them. Unknown keys are type errors and can be development diagnostics for
untyped JavaScript.

Plain components continue to receive their exact specified style. A parent may
inspect it for allocation, but the finite child-local allocation is exposed
separately through `crcLayoutBox()`.

#### Type-level schema enforcement

Style schemas are capability intersections, not a global property bag.
`BoxStyle`, `LayoutItemStyle`, paint/cursor types, and component-specific
geometry combine only where a component supports them. Every system style
positively extends `SystemStyle`; that base contains optional `custom` and no
index signature. Excess keys therefore remain errors instead of silently
becoming Canvas state.

This is a positive schema contract, not a blacklist: unrelated arrays,
functions, dates, URLs, errors, blobs, buffers, matrices, and arbitrary
resource/class types fail structurally unless their declared type deliberately
opts in. Every shared item-participation field is optional; its owning parent
validates required coordinates and the accepted value subset, avoiding an
incompatible `alignSelf` or Grid coordinate on an element outside that layout.

`PrimitiveProgramProps<P>` rejects a program-prop declaration containing the
reserved `key` or `style` names. `PrimitiveInput<P, S>` adds `style` back as
element input: the property is optional only when all members of `S` are
optional. This logic distributes over unions so one invalid program-prop member
or one required style member cannot hide behind another union arm.

The descriptor keeps one `props` object, including specified `style` and
`children`. Separation happens only at primitive dispatch: the render callback
receives reserved metadata apart from its ordinary program props. Plain
functions receive their author props normally.

### Length and constraint values

The common allocation vocabulary remains deliberately finite:

```ts
type Percentage = `${number}%`;
type Length = number | Percentage | "auto";

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

Infinity may represent an internal unbounded measurement constraint but never
reaches Canvas drawing. Layout sizes, min/max constraints, padding, and gaps
are nonnegative; `min > max` is invalid. `width` and `height` describe the
content box. Numeric padding may shrink a content allocation to zero, not below
zero. Percentages resolve against the containing component's content box.
`Grid` tracks add their separately parsed fractional form. Shorthands normalize
to canonical per-edge or per-axis values before an algorithm runs. Percentages
are accepted for documented sizes, offsets, and tracks, not padding or gaps.
Signed Canvas geometry can remain valid outside layout, but a negative
dimension cannot participate as a layout allocation.

The root allocation follows the [Canvas surface
contract](../design/canvas-surface-contract.md): a fixed logical viewport is
captured at mount by default, while responsive mode follows the CSS content
box. Surface projection and backing density do not leak into local layout
units.

Margin, scrolling, implicit Grid placement, reverse/reordered Flexbox, and
advanced intrinsic CSS sizing stay outside this architecture.

### Layout algorithms

Each dedicated layout component delegates placement to an isolated algorithm
with no Canvas-paint responsibility. Conceptually it consumes normalized
container/item style, constraints, and a measurement callback, then produces a
finite container box and ordered child placements. The five algorithms are
separate by semantics:

```ts
interface LayoutResult {
  container: LayoutBox;
  children: readonly ChildPlacement[];
}

interface ChildPlacement {
  element: CRCElement;
  box: LayoutBox;
  clipInChildSpace?: LayoutBox;
  identityHint: InternalIdentityHint;
}
```

- `Absolute`: independent offsets within a containing box;
- `Overlay`: one shared allocation plus alignment;
- `Flow`: CRC-native sequential placement and optional wrapping;
- `Flex`: the documented CSS-compatible subset; and
- `Grid`: explicit fixed/percentage/fractional tracks and explicit placement.

Algorithms do not depend on global render state, DOM nodes, user events, or
Canvas drawing calls. CSS-named values are accepted only where CRC implements
their documented behavior; divergent algorithms retain CRC-specific names.

## Render pipeline

### Normal drawing element

For a platform drawing/composition element the runtime:

1. reads specified style from `element.props.style`;
2. applies the component's pure normalizer;
3. resolves allocation-dependent values from the current layout context;
4. validates that render geometry is finite;
5. invokes the primitive callback with program props, resolved style, and the
   isolated Canvas context; and
6. traverses any declared container children in source order.

Drawing leaves do not establish formatting contexts. `Group`, `Clip`, and
`Layer` compose recursive children but are not layout algorithms.

### Layout element

For a dedicated layout element the runtime:

1. receives its allocated box from its parent or root;
2. prepares direct branded child descriptors without invoking their component
   functions;
3. normalizes only the container/item style required by the algorithm;
4. resolves definite inputs and requests pure measurement only for unresolved
   used sizes;
5. calculates finite ordered placements; and
6. traverses stable private placement descriptors in paint order.

A placement descriptor saves Canvas/runtime layout state, translates to the
child allocation, applies CRC-owned overflow clipping, publishes a child-local
`LayoutBox`, traverses the author element, and restores state. This remains one
normal render traversal, never a speculative paint pass.

### Nested layout

A nested layout component is one item to its parent and a formatting context
for its own direct children:

```text
Flex
├── Rectangle
└── Grid
    ├── Text
    └── Image
```

The outer algorithm resolves the inner layout's allocation. When an intrinsic
size is required, it asks the inner platform value's pure measurement
capability about its already-declared children. Normal traversal later performs
the actual inner layout and paint. A plain component that hides a layout
subtree is opaque to its parent and therefore needs a definite outer size.

## Identity and ordering

Each layout component prepares one immutable direct-element array before
algorithm work. It normalizes direct child style without invoking child
functions. Flow/Flex/Grid call pure measurement only when a used size is not
definite.

For each result, CRC creates a branded private placement clone that preserves
the author descriptor and records per-occurrence used style/identity metadata
in weak storage. Placement then:

1. saves Canvas and runtime layout state;
2. translates to the child's border/content allocation;
3. applies overflow clipping when requested;
4. publishes the child-local `LayoutBox`;
5. traverses the original child component; and
6. restores state after its subtree.

Nested layout is ordinary composition. The outer algorithm sizes the inner
layout value; the inner value establishes a formatting context for its own
prepared direct children during normal traversal. A plain component exposes no
intrinsic measurement capability and therefore
needs a definite allocation when it hides that subtree from its parent. Custom
platform normalization, resolution, or pure measurement requires a value made
with `definePrimitive`; those capabilities never attach to an ordinary plain
component.

Private placement metadata includes the original child type, canonical key,
and same-type occurrence. One stable module-level placement component is reused
instead of allocating a new function per child or render. A keyed child
survives supported same-parent reflow; unkeyed `A/B/A` identity still follows
the two occurrences of `A`; moving a child between parents remounts it. The
placement descriptor never becomes a public wrapper or author-visible node.
CSS ordering features remain disabled until allocation, paint/interaction
order, and identity are implemented and documented together.

## Measurement architecture

Measurement receives program props, normalized style, constraints, an explicit
Canvas text service, and a recursive `measureElement`. It returns measured
content size or an unsupported reason. It cannot paint, invoke hooks,
`crcCanvasContext`, `crcLayoutBox`, create targets or layers, schedule work, or
acquire runtime resources. Pure measurement cannot create image generations.
Temporary globals are cleared/restored in `finally`, and cycles are diagnosed.
Pure measurement isolates itself from active render hooks and layout context.

`Text` shares tokenization, line breaking, typography, and one content/layout
calculation between measurement and paint in a render transaction, so measured
and painted line boxes cannot drift. Explicitly sized `Image` can measure;
natural image size cannot because it would acquire asynchronous state. Plain
components do not claim measurement. A supported result is a finite preferred
size before min/max clamping by the owning algorithm; an unsupported result
becomes an actionable diagnostic when that size is required.

`crcLayoutBox()` exposes `{ x: 0, y: 0, width, height }` in the allocated
child-local coordinate system. It is observational and does not claim root or
DOM coordinates. Measurement caching is not required; if introduced after
structural evidence, a cache key must include component type, relevant props,
normalized style, constraints, and environment inputs such as font metrics.

## Geometry semantics

### Allocation and local paint coordinates

Layout owns the child's allocation origin and available size. Placement
translates into child-local coordinates. Primitive `x`/`y` remain local paint
offsets; parent `left`/`top` remain allocation offsets.

### Transforms

The complete composition equation is:

```text
root surface × ancestor Group × layout placement × child Group × local geometry
```

- At the root, local origin is the Canvas logical origin.
- `Absolute` uses declared positions within its containing box.
- `Flow`, `Flex`, `Grid`, and `Overlay` choose placement; local primitive
  geometry starts at zero unless the primitive style explicitly offsets it.
- A resolved percentage width controls both allocation and, for box-shaped
  built-ins, painted local width.
- Paint may overflow a visible allocation and never retroactively changes it.

The same composition is captured for interaction paths, explicit clips,
layout-overflow clips, and `Layer` bounds. Paint may overflow a visible
allocation without changing allocation. Layers mount a stable private fragment
root in their offscreen instance and join the root paint ledger at their
composite position.

Layout placement applies before a child's own transform. Pixel-grid adjustment
runs in the component's local paint space after resolved dimensions are known.

### Clipping and overflow

Visible overflow creates no layout clip. Clipped overflow adds a CRC-managed
content-box clip whose intersection is shared by paint and hit testing; it does
not imply scrolling.

## Style composition and custom components

Reusable styles remain ordinary immutable values and object composition:

```tsx
const cardBase = { minWidth: 240, minHeight: 120 } satisfies BoxStyle;

const card = (
  <MetricCard
    value={value}
    style={{
      ...cardBase,
      width: compact ? 280 : "100%",
      custom: { density: compact ? "compact" : "comfortable" },
    }}
  />
);
```

CRC never merges parent style into a child. A component forwards or derives
the style fields it intentionally owns. System normalization ignores
application-owned `custom` data.

## Errors and failure containment

Diagnostics are raised by the closest responsible boundary: invalid style
syntax or unknown value, non-finite resolution, unsupported/cyclic or
underdetermined percentage measurement, incompatible algorithm input, or an
internal algorithm invariant. A `LayoutDiagnostic` records component, key when
present, property, supplied value, algorithm, constraints, and reason. Invalid
geometry never reaches Canvas.

A layout/style throw enters the ordinary render-failure path. Runtime-owned
resources and refs close, Canvas and temporary state restore in `finally`, and
the next explicit root can mount cleanly. Pixels already painted earlier in the
failed frame retain the renderer's documented no-rollback behavior.

## Failure and ownership

Render setup records the current element, component refs, hook index, layout
box, primitive receiver, context, clip stack, and seen identities. All are
restored in `finally`. A throw closes runtime-owned refs/resources rather than
retaining a partial tree; earlier frame pixels are not transactional.

Successful traversal removes unseen identities only after the tree completes.
Every hook cleanup, event registration, image generation, layer instance,
surface observer, and pending frame has one owner. Private weak metadata does
not become a lifetime owner.

## Module boundaries

The implementation keeps these conceptual seams even when helper filenames
differ:

```text
element/
  types, creation, child materialization, fragments, private metadata
style/
  types              public capability interfaces
  normalize          defaults, shorthand expansion, value parsing
  resolve-length     number/percentage/auto resolution
  diagnostics        typed style/layout errors
layout/
  types              constraints, sizes, boxes, placements
  context            current allocation and containing box
  measure            measurement dispatch and services
  place-child        private transform/clip placement component
  absolute, overlay, flow, flex, grid
focus/
  transparent policy metadata and the root focus manager
```

Built-in primitives depend on style resolution and current allocation. Pure
layout algorithms do not depend on drawing primitives. Runtime dispatch is the
small integration seam that understands element, primitive, layout, and policy
metadata.

## Verification architecture

Fast feedback is the default: pure style/layout modules use non-browser unit
fixtures; each render-integration seam has a focused browser contract; built-in
migrations run focused component tests; and one nested public scenario carries
geometry, pixels, targets, reflow, and cleanup. Broader checks run after
cohesive milestones and the aggregate trust gate runs at completion. This
cadence does not weaken correctness criteria; it avoids repeatedly paying the
full package/browser/visual cost while a local slice is changing.

## Architectural decisions

1. Branded descriptors, not callable factories, are the authoring boundary.
2. Declared layout boxes, not inferred paint commands, are spatial truth.
3. Layout adds no retained display list or speculative paint pass.
4. Style is explicit, local, component-specific, and non-inherited.
5. Formatting contexts are dedicated components, never hidden drawing props.
6. Direct nesting works without public layout-item wrappers.
7. Measurement is opt-in, pure, and separate from hooks and ownership.
8. Placement reuses transform/clip seams so paint and interaction share
   geometry.
9. Source order remains paint order unless ordering, hit testing, and identity
   are deliberately changed together.
10. Focus policies decorate exactly one element without becoming identity or
    layout boundaries.

## Incremental delivery seams

Plan 003 delivered the architecture in six reviewable seams: element/style
metadata; box/constraint/root allocation; stable placement with
Absolute/Overlay; pure Text/Image measurement; Flow/Flex/Grid; and holistic
package/Studio/documentation verification. The dated Plan 003 design,
implementation plan, numbered plan, and field note preserve the exact original
factory-era terminology and milestone evidence.

The JSX program later replaced only the author-facing descriptor/dispatch
boundary. It retained the Plan 003 box, algorithm, measurement, placement,
geometry, ordering, failure, and ownership decisions. The dated JSX design and
implementation plan preserve that transition; this file states the combined
current architecture.

## Public boundaries and evidence

Root values and declarations are published only through the explicit export
map, including automatic compiler subpaths. Strict source, built, packed,
Bundler, NodeNext, mixed-runtime, Studio, browser, lifecycle, and visual gates
exercise the same architecture. See the current [runtime](../design/runtime-hooks-contract.md),
[style](../design/style-system-contract.md), and [layout](../design/layout-system-contract.md)
contracts for normative behavior.
