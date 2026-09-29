# Allocation-relative responsive styles

> **Historical status: Approved for execution on 2026-09-28; implementation in progress.**
> The user explicitly authorized
> implementation and immediate execution, superseding the separate plan gate.
> Implementation is in progress; completion remains unverified. Opt-in performance
> acceptance follows the [approved amendment](#approved-performance-amendment--2026-09-28) below.

## Purpose and recommended slice

Add ordered, typed conditional patches to CRC's local `style` input. One reusable
component must adapt in a wide root, a narrow allocated container inside that
root, and a phone-sized responsive root. This is general layout and paint
functionality, with no chart-specific vocabulary.

The first slice supports **containing-allocation width and height**, through
`minWidth`, `maxWidth`, `minHeight`, and `maxHeight` in `style.when`. It includes ordinary and signal-valued style
inputs, layout preinspection, pure measurement with explicit unsupported cases,
Canvas Layers, and one public example. There is no new hook, query signal,
container registry, observer, breakpoint store, or scheduler. Height conditions
serve short landscape views and vertically constrained panels; they are not
inferred from width. Performance preservation is a delivery requirement, as
defined below, not an unverified claim of zero-cost query evaluation.

The motivating [CO₂ explorer](http://localhost:5173/#/examples/composition/viz-responsive-line)
has accepted desktop behavior and deferred mobile usability. Its controls are
currently positioned with numeric coordinates, buttons are 112 × 28, inspection
is described as hover/click, and brush endpoints use small drag targets. The
first proving example will reuse the idea of a two-action toolbar without
redesigning the chart. Styling can arrange controls and enlarge geometry;
selection density, instructions, gesture behavior, and touch evaluation remain
application decisions. This specification does not declare the chart mobile-ready.

## Current implementation and missing prerequisites

The table records the implementation baseline inspected on 2026-09-28, before
the responsive-style experiments now present in the working tree. Those uncommitted
experiments are not prerequisites assumed shipped. These are source/test
observations, not a claim that a fresh runtime test suite was run for this revision.

| Current authority                                                                                                                                     | Consequence for this proposal                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Style contract](../../design/style-system-contract.md), `packages/core/src/lib/types.ts`, `element/resolve-primitive-inputs.ts`                      | Primitive styles are closed; whole-style and shallow field signals already resolve. Nested query descriptors do not yet exist.                                                                                                          |
| [Layout contract](../../design/layout-system-contract.md), `layout/absolute.ts`, `flow.ts`, `flex.ts`, `grid.ts`, `context.ts`                        | Parents normalize direct-child styles before allocating them; private clones carry normalized style and used dimensions. Allocation and percentage basis are already distinct.                                                          |
| `layout/layout-jsx.test.tsx`, `signals/input-provision.test.ts`                                                                                       | Preinspection signal reads belong to the receiving child, including measured Text, with rollback for unclaimed provisions.                                                                                                              |
| `layout/measure.ts`, `layout/measure.test.ts`                                                                                                         | Pure measurement isolates runtime context, reads signals untracked, detects cycles, and returns unsupported where no measurement capability exists. Finite constraints alone do not prove a parent's intrinsic queried axis is settled. |
| [Surface contract](../../design/canvas-surface-contract.md), `surface/root-surface.ts`, `surface/root-surface.test.ts`, `test/canvas-surface.test.ts` | Responsive CSS-content-box sizing, fixed logical sizing, stable identity, resize coalescing, zero-display suppression, and exact observer cleanup already exist.                                                                        |
| [Signals contract](../../design/signals-and-scheduling-contract.md), `signals/render-consumer.ts`, `signals/input-provision.ts`, `render.ts`          | Existing receiver consumers and transaction-local provisions can own query patch reads. No new reactive graph is needed.                                                                                                                |
| [Hook contract](../../design/runtime-hooks-contract.md), `hooks/use-layout-box.ts`, `layout/place-child.ts`                                           | `useLayoutBox()` is a readonly allocation snapshot, not a subscribable signal or intrinsic-measurement hook. Plain components keep specified props.                                                                                     |
| `components/layer.ts`, `layout/layout-jsx.test.tsx`                                                                                                   | Layer dimension changes already render the managed child; clean retained trees can reuse bitmaps and iterables.                                                                                                                         |
| `style/resolve-dispatch.ts`, `style/resolve-dispatch.test.ts`                                                                                         | Framework filter handling precedes custom style callbacks; pre-normalized style is authoritative. Queries must preserve that boundary.                                                                                                  |
| `packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx`                                                                         | The chart already mounts with `viewport: 'responsive'`; its remaining phone problems are not caused by a missing responsive root.                                                                                                       |

Required additions are precise: a typed query input schema; selection before
normalization; an occurrence-local selected-input snapshot shared by inspection,
rendering, and measurement entry checks; and an explicit measurement-mode guard
that rejects responsive intrinsic measurement in this slice. The existing pre-normalized clone mechanism is a starting point,
but does not by itself guarantee branch reads are not repeated at render.

No shipped media-query hook or environmental capability service is assumed.
No auto-placement Grid, `display: none`, semantic DOM controls, or new input
adapter is assumed. The current runtime has additional surfaces beyond older
contract snapshots; this proposal changes the shared core primitive input path,
not backend-specific drawing vocabularies.

## Query context and alternatives

**Choose the available containing size at style inspection time.** Units are CRC
logical units. A layout parent inspects all direct children against its already
established content dimensions, before placing any of them. A primitive reached
without parent layout inspection uses the current incoming allocation. Root
children therefore use root logical width and height. Plain functions, fragments, and
Group transforms do not independently establish a size context.

A direct child of a 1000-unit Grid queries 1000, even if its cell will be 320.
Inside a plain component placed in that cell, an emitted Flow queries 320.
Likewise, an explicit 320-wide container's descendants query its content width;
its own rules query the incoming containing allocation. Padding on the container
reduces the dimensions its descendants query. Width, height, or padding in the
receiving style does not change that receiver's own query basis. The same rule
applies to a short Grid row inside a tall root: internal rules query the placed
component's available height, not the root height.

This distinction is intentional and must appear in public guidance. A component
adapts its internals to its assigned box; it does not reinterpret its outer
layout-item styles after the parent has placed it.

### Two authoring boundaries (normative)

1. **Outer layout-item style** tells the parent how to place the component. Its
   queries see the parent layout's content size before item allocation.
2. **Internal content style** arranges the component's rendered subtree. Put
   queries here to adapt to the component's assigned Grid/Flex cell.

A plain function does not itself change the query context. The parent's placement
creates the allocation boundary; the function's returned inner primitive uses
that allocation. Extracting a directly placed primitive into a function can
therefore change the query basis. This is intentional, must be documented as an
observable refactor, and must have executable examples. Avoid the unqualified
phrase “container query”: use “available containing size.”

For example, in a 1000-wide Grid with a 320-wide first track:

```tsx
// Incorrect for the intent “stack inside a narrow cell”:
// Flow is inspected by Grid, so the query sees 1000, not 320.
<Flow style={{
  width: "100%", height: 112, gridColumnStart: 1, gridRowStart: 1,
  direction: "horizontal",
  when: [{ query: { maxWidth: 500 }, style: { direction: "vertical" } }],
}}>{controls}</Flow>

// Correct: Grid places this item; its inner Flow sees the assigned 320.
<ResponsiveActions style={{
  width: "100%", height: 160, gridColumnStart: 1, gridRowStart: 1,
}} />
```

These are alternative direct children of the Grid shown below. `controls` denotes
that example's two controls. `ResponsiveActions` is defined in the authoring
example. The outer prop must remain named `style`: that is the existing layout
inspection contract. Inside a reusable component call it `placementStyle` when
naming the parameter; name the separate inner value `contentStyle`. Do not invent
`outerStyle` as a replacement prop that layout parents cannot inspect.

Alternatives considered:

- Final receiving size: intuitive for a Grid child, but self-dependent width/height,
  padding, Flex basis, and intrinsic measurement require restrictions or a
  layout solver. Defer it rather than introduce a second pass.
- Root logical or CSS viewport: simple globally, but fails reusable components
  in narrow regions. Root logical size is already the natural top-level basis;
  CSS viewport queries would change meaning under fixed fitting.
- Named containers: useful for distant ancestry, but adds explicit boundaries,
  lookup, lifetime, and measurement propagation. Not needed for this slice.

There is no `context` selector in the first API. Adding a wrapper is an authoring
choice with existing identity consequences; CRC does not silently insert a new
public component or remount on threshold changes.

## Exact authoring and public types

Proposed public contract, shown as declaration shapes (implementation is not
certified by this specification):

```ts
export type CRCSizeQuery = Readonly<
  {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  } & (
    | { minWidth: number }
    | { maxWidth: number }
    | { minHeight: number }
    | { maxHeight: number }
  )
>;

export type CRCStyleRule<S extends SystemStyle> = Readonly<{
  query: CRCSizeQuery;
  style: Partial<SignalStyle<S>> & { readonly when?: never };
}>;

export type CRCResponsiveStyle<S extends SystemStyle> = SignalStyle<S> &
  Readonly<{ when?: readonly CRCStyleRule<S>[] }>;
```

The actual primitive input mapping becomes (using existing `StyleField` and
`SignalProgramProps`; the aliases are not a separate opt-in type system):

```ts
export type PrimitiveInput<
  P,
  S extends SystemStyle = SystemStyle,
> = SignalProgramProps<P> & StyleField<CRCResponsiveStyle<SpecifiedStyle<S>>>;
```

`StyleField` continues deriving required keys from the base style plus the
optional framework field. Custom primitive definitions reject `when` in any
specified, normalized, or resolved style declaration. Use a named type guard
with the diagnostic member
`"CRC: style.when is framework-owned; remove when from the primitive style type"`
on the definition's render/capabilities parameters, rather than silently
reducing the whole input to `never`. Check union members as well as simple object
types. The public authoring alias describes exactly the style accepted by props.

`SignalStyle` above names the existing shallow style mapping, including opaque
`custom`. Export the new types from `@crc/core`. Keep plain specified style
types such as `FlowStyle`, `TextStyle`, and `RectStyle` as the primitive's own
vocabulary. Extend the style member produced by `PrimitiveInput<P, S>` to accept
`CRCResponsiveStyle<S>` or a signal of that value; preserve today's rule that
styles with required base keys are required. Optional-style primitives also
continue to accept a whole-style signal resolving to `undefined`.

`when` is a framework-reserved style input key. Primitive style declarations
cannot declare their own `when` field; reject this in `definePrimitive` typing,
and diagnose malformed query input at runtime. No current declaration found in
the inspected core, viz, webgl, or particles source uses that key. This reserves
a name for external custom primitive authors and must be documented as such.
`style.custom.when` remains opaque application data.

A rule patch accepts only properties of the receiving specified style, makes
those properties optional, and cannot itself contain `when`. There is no index
signature, CSS string parser, selector, deep merge, callback predicate, or
recursive rule grammar. Existing forbidden fields, including inner-WebGL
`filter?: never`, remain forbidden. Required base fields stay required even if
every intended branch supplies them; TypeScript need not prove query coverage.

Example ordinary JSX (proposed syntax):

```tsx
import {
  Flow,
  Grid,
  Rectangle,
  signal,
  type BoxStyle,
  type LayoutItemStyle,
  type CRCResponsiveStyle,
  type FlowStyle,
  type SignalValue,
} from "@crc/core";

const spacing = signal(12);
const contentStyle = {
  width: "100%",
  height: 112,
  direction: "vertical",
  gap: spacing,
  when: [
    {
      query: { minWidth: 600 },
      style: { direction: "horizontal", height: 44 },
    },
  ],
} satisfies CRCResponsiveStyle<FlowStyle>;

type ActionsProps = {
  style?: SignalValue<
    CRCResponsiveStyle<BoxStyle & LayoutItemStyle> | undefined
  >;
};

function ResponsiveActions({ style: placementStyle }: ActionsProps) {
  // The parent reads placementStyle to allocate this item. Preserve it in props;
  // do not forward it onto the internal Flow or apply its placement twice.
  void placementStyle;
  return (
    <Flow style={contentStyle}>
      <Rectangle
        key="recent"
        style={{ width: 112, height: 44, fill: "#17324d" }}
      />
      <Rectangle
        key="all"
        style={{ width: 112, height: 44, fill: "#8dd8ff" }}
      />
    </Flow>
  );
}
```

Equivalent non-JSX component using the same style and signals:

```ts
import { createElement, Flow, Rectangle } from "@crc/core";

function ResponsiveActions({ style: placementStyle }: ActionsProps) {
  // The parent reads placementStyle to allocate this item. Preserve it in props;
  // do not forward it onto the internal Flow or apply its placement twice.
  void placementStyle;
  return createElement(
    Flow,
    { style: contentStyle },
    createElement(Rectangle, {
      key: "recent",
      style: { width: 112, height: 44, fill: "#17324d" },
    }),
    createElement(Rectangle, {
      key: "all",
      style: { width: 112, height: 44, fill: "#8dd8ff" },
    }),
  );
}
```

The visual example adds labels and ordinary handlers to these targets. In a
wide root, render `ResponsiveActions` directly. For the narrow case, place the
same plain component in an explicit Grid cell:

```tsx
<Grid
  style={{
    width: 1000,
    height: 160,
    gridTemplateColumns: [320, "1fr"],
    gridTemplateRows: [160],
  }}
>
  <ResponsiveActions
    style={{
      width: "100%",
      height: 160,
      gridColumnStart: 1,
      gridRowStart: 1,
    }}
  />
</Grid>
```

The declared `ActionsProps.style` is the outer layout-item style. The parent
consumes it for placement; the inner Flow uses `contentStyle` to arrange controls.
The function does not forward the outer placement fields to Flow. The examples are
alternative declarations of the same component, not multiple same-name functions
in a single file. For the phone case mount the same component at the root with
`{ viewport: 'responsive' }` and a 360 CSS-pixel content box.

Plain component props remain exact author input; CRC does not universally
resolve arbitrary application props. Layout parents may select responsive outer
style for placement just as they inspect ordinary style today. Passing a style
to a plain component alone does not apply it to the component's descendants.

A height-only rule and a combined rule use the same syntax:

```tsx
<Flow
  style={{
    direction: "vertical",
    gap: 16,
    when: [
      { query: { maxHeight: 400 }, style: { gap: 8 } },
      { query: { minWidth: 600, minHeight: 500 }, style: { gap: 24 } },
    ],
  }}
>
  <Rectangle style={{ width: 112, height: 44 }} />
  <Rectangle style={{ width: 112, height: 44 }} />
</Flow>
```

At width 700, heights 400, 450, and 500 produce gaps 8, 16, and 24,
respectively. Reducing width below 600 at height 500 restores gap 16.

## Agent-facing authoring and diagnostics

Make the correct pattern discoverable through component `style` autocomplete,
JSDoc on `when` and `CRCSizeQuery`, and one short public guide linked from both
style and layout references. That guide must lead with the two-boundary rule,
show JSX and createElement versions of the same component, and state the
measurement restriction next to `auto`. Adjacent to the canonical component
recipe, state that a plain function receives its original raw `style` prop: the
layout parent consumes it for placement, and it is neither automatically
query-resolved for the function nor forwarded to descendants.
Use `satisfies CRCResponsiveStyle<S>` for
shared values; no `any`, casts, or internal imports in supported recipes.

The guide must include this compact decision table so an agent can choose the
correct path without reading runtime internals:

| Intent                                       | Public recipe                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Adapt controls inside an assigned cell       | Put `when` on the returned inner Flow; keep the outer `style` for placement.                      |
| Change an item's share of its parent's space | Put `when` in that item's outer style; bounds refer to the parent content size.                   |
| Fit a short panel independently of width     | Use `maxHeight` on the internal content style.                                                    |
| Change labels, data density, or handlers     | Use ordinary component code and `useLayoutBox`; these are not style patches.                      |
| Repair responsive intrinsic measurement      | Give the queried item a definite allocation and adapt inside it; do not cast away the diagnostic. |

Keep one canonical authoring pattern, no alternate helper DSL. Before exposing the slice, update the style and layout contracts alongside the
public style type reference and canonical guide. Remove the old blanket claim
that size queries do not exist; document this restricted allocation-relative
mechanism and its deferred cases instead. Broader documentation can follow
feedback, but authoritative references must not contradict the runnable slice.
The public guide and compiler fixtures must distinguish proposed queries from existing size
constraints: `style.minHeight` constrains the receiver, whereas
`style.when[i].query.minHeight` tests its containing size. A size constraint does
not create a query, and query bounds never become primitive style properties.

Required public type fixtures include these proposed errors:

```ts
const nested: CRCStyleRule<FlowStyle> = {
  query: { minWidth: 600 },
  style: {
    // @ts-expect-error Rules cannot contain another when list.
    when: [],
  },
};

interface InvalidStyle extends SystemStyle {
  when?: string;
}
// @ts-expect-error Remove when: the framework supplies it on primitive inputs.
const Invalid = definePrimitive<{}, InvalidStyle>(() => null);

const unsupported: CRCResponsiveStyle<FlowStyle> = {
  // @ts-expect-error Replace the whole style signal, not the when field.
  when: signal([]),
};

// Supported: replace a whole style, or use signals in base/patch fields.
const liveStyle = signal<CRCResponsiveStyle<FlowStyle>>({
  gap: 12,
  when: [{ query: { maxHeight: 400 }, style: { gap: 8 } }],
});
```

These fixtures must import their types/functions from `@crc/core` and be tested
in the Studio declarations and packed consumer modes, not merely quoted in docs.
Also test a missing required Rectangle width, unknown query key, conflicting
bounds at runtime, and union-style patches that produce an invalid final style.
Runtime validation must identify signal objects in forbidden rule/list/query/
patch-object positions, not accept them merely because `typeof` is `object`.

Every query diagnostic includes component and JSX source when available, exact
style path, received value, algorithm (render/layout/measurement), and repair.
Stable diagnostic codes distinguish malformed input from unsupported measurement:

| Code and example                                                                        | Required repair text                                                                                                    |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `CRC_STYLE_QUERY_BOUND`: `Flow style.when[2].query.maxWidth = -1`                       | Use a finite nonnegative bound.                                                                                         |
| `CRC_STYLE_QUERY_RANGE`: `minHeight = 500, maxHeight = 400`                             | Set minHeight less than or equal to maxHeight.                                                                          |
| `CRC_STYLE_QUERY_SIGNAL`: `Flow style.when = Signal`                                    | Put the signal on the whole style or on a base/patch field.                                                             |
| `CRC_STYLE_QUERY_NESTED`: `Flow style.when[0].style.when`                               | Flatten rules into the receiving style's when list.                                                                     |
| `CRC_STYLE_QUERY_MEASUREMENT`: `Flow style.when in intrinsic measurement`               | Give this item definite dimensions or a definite allocation, and put responsive styles inside that allocated component. |
| `CRC_STYLE_QUERY_BASIS`: `Text style.when[0].query.minHeight with maxHeight = Infinity` | Supply a finite maxHeight to standalone measureElement.                                                                 |

Add `CRC_STYLE_QUERY_SHAPE` for malformed lists/records and
`CRC_STYLE_QUERY_KEY` for unknown rule/query keys or an empty defined-bound set.
Their repairs name the expected shape or list the four supported bounds.

Malformed inputs throw before callbacks. Unsupported measurement uses the existing
`MeasureResult` unsupported reason containing code/path/repair; layout promotes
it through its existing contextual error. Do not add public error classes or a
new query inspection API. Incorrect expectations about a valid Grid query basis
are not runtime errors; the canonical example and geometry assertions address
that case.

Acceptance for agentic authoring: executable public recipes must cover extracting
a Grid item into a reusable component, embedding it in a narrow region without
changing its internal rules, adding a height rule, updating a signal, and fixing
an unsupported auto-measurement case using the diagnostic. An implementation
reviewer must verify these tasks can be completed from public types, guide, and
errors alone. This is a concrete usability check, not a claim that all models
will infer the same intent.

## Conditions, composition, and validation

- `minWidth`, `maxWidth`, `minHeight`, and `maxHeight` ship. All are inclusive,
  finite, nonnegative numbers. At least one is required. On each axis with both
  bounds, minimum must not exceed maximum. Zero and fractional thresholds are
  valid. Omitted bounds impose no condition; explicit `undefined` is absent.
  A query with no defined bounds rejects. No rounding or epsilon.
- All supplied conditions in a rule must match (AND). `minWidth: 600` matches
  exactly 600; `maxHeight: 400` matches exactly 400. Two rules ending and starting
  at the same threshold both match there; source order decides.
- Resolve the whole-style signal once. Resolve ordinary base fields with the
  existing shallow signal rules. Evaluate all conditions using one allocation snapshot, and
  merge every matching patch in list order. Last assignment wins per property.
- An omitted property leaves the earlier value. An explicitly present
  `undefined` replaces it and receives ordinary primitive default/validation
  behavior afterward. It does not reveal an earlier declaration. Required
  properties must still satisfy the final style contract.
- Arrays and objects (`padding`, tracks, filters, `custom`) replace as whole
  values; they are never concatenated or recursively merged. An empty filter
  list still explicitly disables that receiver's filter with today's semantics.
- Primitive defaults and custom normalization run after merging. Queries do not
  inherit; a child's list starts from that child's base style only.
- The list, rule records, conditions, and patch objects are plain readonly
  inputs, not signals. Patch fields accept signals under the existing shallow
  mapping. A whole-style signal may replace the entire list. Threshold signals,
  signal-valued rule lists, and signal-valued patch objects are deferred.
- Read all base fields and fields of all matching patches, even if later
  overwritten. This deliberately preserves base-read behavior and avoids a
  second dependency-selection policy. Never read unmatched patch signals.
  Repeated sources deduplicate into the exact receiver's dependency set.
- Validate every rule's envelope and conditions, including unmatched ones.
  Malformed/non-array lists, unknown query keys, empty queries, invalid bounds,
  non-object patches, and nested `when` reject with component, rule index, and
  property diagnostics. Property vocabulary is closed by TypeScript, as today;
  do not claim a new runtime reflection schema for arbitrary custom styles.
  Ordinary patch value validation occurs only on the merged effective style.

Do not mutate or freeze caller-owned input objects. During synchronous preparation,
validate envelopes/conditions and select against one allocation snapshot. Capture
only the effective selected style for downstream reuse; do not clone every rule
or unmatched patch. Preserve signal identities and opaque descriptor references.
Rule, query, and patch records are ordinary data objects with Object.prototype
or null prototypes. Arrays, functions, class instances, and signals in record
positions reject. Envelope/query validation reads own enumerable string keys;
patch selection follows the existing shallow style field vocabulary. Accessors
and proxies are outside the supported data-input contract; do not enumerate
unmatched patch fields to detect them or imply sandboxing of JavaScript objects.
The reserved nested `when` check is constant-time for every patch.
In-place mutation does not
schedule rendering, consistent with ordinary styles. Use signal replacement or
normal root updates for changes. No global object-identity match cache is valid:
the same style object can match differently at two allocations simultaneously.

## Evaluation, measurement, and cycles

The proposed pipeline is **specified input → query selection/shallow resolution
→ normalized style → allocated/resolved style → primitive render**. Query
selection is framework work. Custom normalizers and resolvers never receive
`when`, including explicitly present `when: undefined` or `when: []`, and remain
pure. Remove an undefined framework key in the existing callback-boundary copy
that already removes `filter`; do not add a query-specific copy or enumeration
to the no-query input-resolution path. Use one shared framework-key boundary
helper for both parent inspection and dispatch; it removes `filter` and own
`when` before custom callbacks. Test absent `when`, explicit undefined, empty
lists, and nonempty lists with a custom normalizer/resolver, including prepared
layout dispatch. Preserve the input resolver's ordinary plain-input identity;
that does not promise identity through the existing callback-boundary copy.
Framework filter extraction runs on the effective
selected style, preserving its existing ownership outside custom callbacks.

During mounted parent inspection:

1. Establish the parent's definite content dimensions as the query basis.
2. Prepare each direct-child occurrence under its receiver token. Select and
   shallowly resolve its style, normalize it once, and record its provisional
   signal reads.
3. Measure if required, then allocate and place using that same selected style.
4. Carry the prepared style and used dimensions through the existing private
   clone path. Receiver rendering adopts the provision and consumes the prepared
   style; it must not reread the original query branches or rematch against its
   final local box. Program props and children retain their existing paths.
5. Any descendants prepared by the receiver use its established content dimensions.

Outside a parent prepass, perform steps 1–2 at primitive dispatch using the
incoming layout allocation. That preparation lasts only for the occurrence's
current evaluation, never globally across roots or subsequent frames.

Width, min/max sizes, padding, gaps, direction, tracks, and item placement may
all appear in patches where allowed by the receiving style. They change the
result of layout, but cannot change the upstream dimensions that selected them.
A child queried at 700 that sets its width to 300 stays on the 700 branch for
that evaluation. Descendants can independently query the resulting 300-wide
content context. There is no iterative matching, last-frame size fallback,
hysteresis, or automatic transition. Height-changing rules follow the same rule:
a height patch cannot change the containing height used to select itself.

### Prepared-style handoff (required architecture)

The baseline `render.ts` resolves raw inputs before `resolveElementStyle` consumes
pre-normalized metadata; `measure.ts` likewise resolves raw inputs even when it
has a pre-normalized style. Both paths must change. The following private record
extends the existing placement metadata; it is not public API or a new cache:

```ts
interface PreparedStyleInput {
  source: CRCElement<any>;
  normalizedStyle: Readonly<SystemStyle>; // query-selected, filter preserved
  receiverToken: object;
  queryBasis?: Readonly<{ width: number; height: number }>;
  queriedAxes: 0 | 1 | 2 | 3; // none, width, height, both
  hasQueries: boolean; // retains eligibility even after when is removed
}
```

For queried inputs, parent `normalizeDirectChildStyle` creates this record under
`withReceiverInputProvision` after one selection/normalization. `childWithUsedSize`
attaches an occurrence-specific record with used dimensions to the render clone.
Existing no-query placement metadata remains lightweight; do not add records to
unplaced plain primitives. A shared source element at two placements gets two
records/tokens. Whole-style signals are read once in this preparation, even if
`when` resolves absent; preserve that selected snapshot on the existing clone.

1. `renderComponentElement` takes prepared metadata **before** raw style resolution.
   Split program-prop resolution from style resolution internally. If prepared,
   resolve only program props, adopt the receiver provision, and pass the record
   explicitly to `resolveElementStyle`. Do not call the raw style resolver or
   read the original whole-style signal again. Without preparation, use the
   normal style path plus query selection. Do not change public component props.
2. `resolveElementStyle` uses the supplied normalized style directly, applies
   existing filter/resolution rules, and never retakes metadata or renormalizes.
   Normalization and allocation resolution remain separate phases.
3. `measureElementInternal` takes preparation before input resolution too. If
   measurement eligibility rejects it, return unsupported before reading base/
   patch fields or invoking `measure`. If eligible and prepared, resolve only
   program props untracked and use the prepared style. No original-style reread.
4. A clone's metadata is consumed once. A layout creates distinct measurement and
   render clones as today; do not consume the render clone while checking a
   measurement clone. Failed/unclaimed preparations release provisions through
   the existing transaction cleanup; records retain no persistent subscriptions.

Query metadata must travel directly with the occurrence's preparation and its
clones; never recover it from a receiver-token WeakMap or another history-based
lookup. Every new preparation has an explicit current query state (including
`hasQueries: false` and no basis when query-free); a previous evaluation's rules
cannot influence measurement eligibility. Existing no-query placement records
may encode false as absent optional metadata, without allocating another record.
Receiver tokens identify signal ownership only, not stored query state.

Require the transition queried whole-style signal → query-free style → an
intrinsic measurement path to succeed under ordinary query-free rules. Repeat
with an abandoned preparation and failed render before the next successful
evaluation; old query state must never reappear.

No-query normalization/filter behavior must stay unchanged. Program-prop reads
are outside the style-read-once guarantee and retain their current contract.
One source appearing in several distinct active style fields may be read at each
field; “once” means once per declared field position, with graph-edge deduplication,
not a new global cache of signal values.

### Deliberately restricted measurement slice

Responsive rules ship for ordinary mounted rendering and definite layout
placement. Responsive intrinsic measurement is deferred. This eliminates axis
provenance propagation and Flex post-measurement checks from the first slice.

| Entry path                                                                 | Nonempty when list                                                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Mounted root or definitely allocated item; no intrinsic measurement needed | Select from the available containing size; supported.                                                                      |
| Mounted parent requires measureElement for the query-bearing item          | Return unsupported, even if finite constraints or a prepared selection exist.                                              |
| Standalone public measureElement, top-level element                        | Supported when every queried axis has a finite maximum constraint, subject to the primitive's existing measure capability. |
| A descendant inspected/measured during any measure callback                | Return unsupported when it has queries, regardless of explicit child dimensions.                                           |

The restriction applies to every primitive whose own nonempty `style.when` is
inspected through mounted-intrinsic or recursive measurement, whether that
primitive is the measured ancestor or an inspected descendant. An unprepared
rejection reads no base/patch signals. Query-free ancestors may measure ordinary
query-free descendants. Required fixtures distinguish a query-bearing Flow
measured as an item, a query-free Flow inspecting a query-bearing direct child,
and a definitely allocated plain component returning responsive content during
render. Only the last bypasses responsive intrinsic measurement.

A responsive parent with a settled allocated box can still intrinsically measure
ordinary, query-free Text children. A definitely allocated plain component may
return responsive content, because its content renders after placement instead
of participating in intrinsic measurement. This is the recommended repair.

Internally use an isolated measurement mode with `standalone-root`,
`mounted-intrinsic`, and `recursive` cases. Layout algorithms pass
`mounted-intrinsic` to their private measurement entry rather than pretending to
make a standalone public call. The supplied recursive measurement function
always uses `recursive`. While a measure callback executes, direct-child style
inspection also sees `recursive`, so built-in container algorithms cannot bypass
the restriction by normalizing children before calling their measure function.
Nested calls to the public measureElement during a measure callback likewise
remain recursive. Public measurement invoked during component evaluation is
mounted-intrinsic; only a call outside render and measurement is standalone-root.
Restore the previous mode in finally. Do not extend public Constraints or
MeasureInput or retain ancestor dimension provenance. Direct-child normalization
cannot itself return MeasureResult: inside measurement, an eligibility rejection
throws a private unsupported-measurement sentinel carrying code/path/repair.
The surrounding measureElementInternal boundary catches only that sentinel and
returns the ordinary unsupported result. Do not catch malformed-query errors or
arbitrary callback exceptions as unsupported. Outside measurement, normal style
inspection never uses this sentinel.

Eligibility reads the whole-style signal once, if needed, to determine whether
there is a nonempty list. Validate query envelopes/conditions even on a rejected
path; malformed input throws. For unsupported measurement, finish envelope
validation before returning the eligibility error, so an earlier unavailable
basis does not hide a later malformed rule. Validation may fail fast on the first
malformed rule; it need not aggregate errors. No base or patch-field signals are read on an
unprepared rejected path. A prepared occurrence uses `hasQueries`, since its
normalized style no longer contains `when`; prepass reads already made are
rolled back by existing failure/unclaimed-provision cleanup. No generic walk
through arbitrary children: check styles only when a declared measurement path
inspects that child. Nodes not inspected or measured need no speculative scan.

For standalone-root measurement, finite `maxWidth` / `maxHeight` are explicit
available-size inputs on queried axes, not measured results. Every mentioned axis
needs a finite basis, even if another condition would fail. Width-only queries
allow infinite maxHeight, and vice versa, subject to existing primitive support.
Absent/empty lists retain ordinary measurement behavior. Reads are untracked;
no persistent edges, provisions, hooks, layout-context lookup, or resources.
Standalone measurement with an indefinite constraint on either axis first
validates envelopes and establishes queried-axis eligibility without field reads.
If eligible, one additional rule scan selects patches; no rules are revalidated,
no match list is allocated, and signals are still read once. This is the sole
exception to the single-scan bound, remains O(B + R + M), and never applies to
mounted rendering or finite-axis standalone measurement. Measured callbacks
still cannot render, and existing cycle checks remain active.

These restrictions break size feedback by construction. Existing cyclic
measurement detection remains in force. Do not implement a convergence solver.
External application code can still create feedback by writing its own measured
results into size signals; that is outside this style contract, and render-time
signal writes remain forbidden.

## Reactivity, scheduling, and ownership

No query state is itself a signal. Size comes from the existing layout/surface
snapshot during ordinary traversal. Root ResizeObserver notifications and parent
size-signal updates already request the realm scheduler. Threshold selection
runs during Render/layout preparation, not in a new Advance participant or a
new matchMedia listener. Existing Begin/Advance/Commit/Plan admission is unchanged.

Whole-style, base-field, and matched-patch signal reads belong to the receiving
primitive (or the placed plain component for its inspected outer style).
Prepasses use receiver provisions, successful evaluations adopt/deduplicate
those reads, and branch exits replace the dependency set. Unmatched-only sources
cannot schedule work for that receiver. Passing `source.get()` in the parent
still explicitly gives that parent ownership instead.

A source shared across several receivers gets one edge per receiver, not one
edge for the rule list. Ordinary signal equality, computed validation, batching,
and fail-closed rendering remain authoritative. Query switching preserves type,
key, and parent identity; no remount or completion callback is implied.

Removal, failure, abort, and disposal release receiver edges and unclaimed
preparations through existing cleanup. Retained signals remain usable without
waking removed consumers. Plain numeric queries must not allocate a signal
consumer. Repeated reflow must not accumulate prepared records or observer
leases. The surface owner retains sole ownership of browser resize/density
listeners; queries acquire none.

## Performance contract

The feature must preserve existing workloads' performance and keep opt-in work
proportional to the rules authored. Evaluating rules cannot literally be free.
The requirement is no measurable regression for existing styles, no additional
render/layout passes or reactive machinery, and no reproducible slowdown versus equivalent explicit application conditionals
for the representative responsive workloads. These are
acceptance requirements; design review alone cannot establish they are met.

### Existing evidence and main risks

`element/resolve-primitive-inputs.ts` currently returns a plain style by identity
and copies only when a shallow signal field requires resolution.
`test/signal-scheduler-performance.test.ts` asserts no signal consumers, edges,
shallow input copies, or provisions for plain inputs; 1,000 writes coalesce into
one host request; and one dirty Layer preserves 99 clean sibling bitmaps.
The [trust gate](../../testing/trust-gate.md) separates deterministic structural
checks from controlled wall-clock reference measurements. Preserve that policy.

The likely regressions are unnecessary copying on every primitive, evaluating a
list in both parent inspection and child rendering, repeated object spreads for
each match, observing inactive signals, invalidating cached Layers by incidental
object identity changes, and repeated validation of large rule lists. Height adds
at most two comparisons per rule; it does not justify another traversal.

### Required execution and allocation bounds

- **No queries:** after resolving a whole-style signal as today, an absent or
  undefined `when` takes a constant-time detection branch into the existing
  shallow resolver. No query records, rule scans, match arrays, consumer nodes,
  provisions, persistent maps, or extra style copies. Preserve the existing
  plain-input identity result at this stage and existing ordinary signal work.
  Do not run a second enumeration merely to discover whether queries exist.
- **Empty list:** no condition evaluation, preparation record, subscription, or
  layout work. If removing the framework key before callbacks requires a copy,
  allow at most one shallow effective-style copy. Do not promise absent-key
  identity for a style explicitly containing `when: []`.
- **Nonempty list:** for a given occurrence's preparation, scan rules once (except the isolated indefinite-constraint measurement
  eligibility pass above), validate their small envelopes/conditions, check the reserved nested key,
  and match at most four numeric bounds per rule. Never enumerate unmatched
  patch fields or read their signals. Read base fields and matching patch fields
  once each, writing into at most one effective-style accumulator; avoid one
  object spread/copy per match, deep cloning, and intermediate match arrays.
  Existing normalization and resolved-style allocations are separate and must
  not multiply because of queries.
- **Cost model:** with B base fields, R rules, and M fields across matching
  patches, selection is O(B + R + M) time and O(U) merged-field storage, where
  U is the number of distinct effective fields. The occurrence metadata is
  constant-size (selected style, basis, queried-axis mask, and receiver token).
  Signal dependency storage uses the existing graph. No allocation proportional
  to the total fields in unmatched patches; no ancestor searches or rule×tree
  passes. Bounds assume the closed data-record grammar, not arbitrary getters.
- **Reuse:** parent inspection and eventual render of the same prepared
  occurrence share selection and field reads. Measurement eligibility consumes
  preparation without rereading original style; supported standalone measurement
  prepares its top-level style once. Prepare once per
  occurrence/evaluation; a separate explicit measurement call is a new
  evaluation. Plain styles must not acquire preparation metadata just because
  another style in the tree uses queries. Existing pre-normalized metadata may
  be extended rather than wrapped in a second general-purpose cache.
- **Scheduling:** no new observer, timer, animation participant, signal per
  breakpoint, or frame. Resize bursts and signal writes use existing coalescing.
  A static tree stays idle. Queries do not imply threshold-only rendering: an
  actual size change may require ordinary layout even within the same match.
  Do not add a global resize listener or invalidate all roots for a local size.
- **Raster and interaction:** no query-owned Canvas surface, GPU resource,
  readback, bitmap transfer, hit-test pass, or event handler. A patch explicitly
  enabling a filter or changing geometry incurs that existing feature's cost;
  compare equivalent output when benchmarking. No hidden transition animation.
- **Lifetime:** effective snapshots are occurrence/transaction-local and released
  or replaced, not accumulated across resizes. Live storage scales with live
  work, not past frames or the number of threshold crossings. Deterministic
  counters verify cleanup; GC timing is not a correctness oracle.

Do not add global compiled-rule caches, sorting, breakpoint indexes, or generated
predicates in this slice. They complicate mutation, occurrence context, and
ownership. Consider such optimizations only if reference measurements identify
a real bottleneck, preserving declaration order and current semantics.

### Signal and Layer tradeoffs

The specified base/all-matching-field read policy can schedule an update for a
field later overwritten by another match. This is intentional and bounded; it
preserves existing base input behavior. It does not permit observing unmatched
branches. Record this workload separately so its invalidation cost is visible.
Winner-only reads would change observable dependency semantics and need an
explicit design revision, not an undocumented optimization.

`components/layer-node-equality.ts` compares nested style values by identity.
A stable shared `when` list therefore preserves the current cache behavior;
allocating a fresh list in a parent on each render can invalidate a retained
Layer tree even when its contents look equal, just like other nested descriptor
values today. Public examples should hoist static lists or use existing
`useConst` where mount-local construction is needed. Do not silently deep-compare
rule lists. Never replace authored input identity with a newly merged snapshot
in the Layer's retained-tree comparison. A rule-source or observed signal change
must still invalidate correctly; optimization must not hide it.

### Performance acceptance

Before the runnable slice, extend the existing structural evidence with focused
counters/spies for query preparations, tested rules, matched-field reads, and
merge copies. Instrument only actual query work; do not add hot-path query
counter writes for every plain primitive. Require:

1. For 1,000 plain rectangles, query-work counters are zero. Existing input-copy, traversal, and frame
   counts must not increase; live edge/consumer ownership must remain equivalent.
   Include plain field-signal and whole-style-signal controls. Eliminating a
   redundant prepared-style read/copy is allowed and must be identified in the
   comparison; an unchanged-count assertion must not forbid that improvement.
2. For 1,000 queried occurrences each with four rules, one ordinary evaluation
   visits exactly 4,000 rules and prepares each occurrence once, including when
   layout preinspects it. Assert no second raw-style scan, whole-style read, or
   active-field read during receiver dispatch. Merging uses at most 1,000 effective-style objects,
   irrespective of overlap. No-match patches cause zero patch-field reads.
   Include a layout-inspected plain component with an outer whole-style signal
   that returns an inner responsive Flow. Its function sees original props;
   placement uses its selected outer snapshot; the Flow gets its own query
   selection and receiver ownership. Reuse one source element at two placements
   with different containing sizes and assert independent geometry, branch
   edges, and one read per active field position per occurrence.
3. An inactive-only signal update requests zero work for these receivers;
   1,000 writes to an active shared input coalesce as before. After threshold
   exit or disposal, exclusive branch edges disappear. Height follows the same
   ownership and work bounds as width, including combined queries.

After hands-on feedback, broaden to 100 retained Layers with one changed child,
repeated bidirectional resizes, fixed-root CSS/density changes, and measured
layouts. Require unchanged clean sibling bitmap identities, no added traversal
or raster operations versus equivalent geometry, and live metadata/edge counts
returning to baseline after failure and disposal.

Because this changes the input-resolution hot path, feature completion also
requires controlled before/after timing evidence, even though timing stays out
of default CI. Compare the same environment and build mode, warm up, alternate
baseline/candidate runs, and record median and p95 over repeated batches in
three independent runs. Record Node, pnpm, Chromium, hardware, viewport, DPR,
workload, samples, and baseline variation; a noisy run is inconclusive, not a
pass. Preserve the baseline before implementation without creating a worktree.

Use the existing 1,000-rectangle plain/field-signal/whole-style workloads plus
1- and 4-rule no-match, one-match, overlap, width-only, height-only, and combined
cases. Compare responsive cases to equivalent explicit local conditionals with
the same output, signal-read policy, and layout—not to an empty scene. Measure
preparation separately and full-frame cost to expose both allocation/CPU costs
and user-visible impact. Include the toolbar and 100-Layer workloads.

Both no-query workloads and the representative 1-/4-rule responsive workloads
must show no reproducible slowdown beyond their comparator's measured noise
in median and p95. There is no pre-approved 5%/10% slowdown allowance. Record a
baseline-versus-baseline repeatability envelope before evaluating the candidate;
freeze that envelope and workload/sample settings in the implementation plan's
performance evidence before interpreting results. Do not widen the envelope to
make a candidate pass. If baseline variability prevents a meaningful comparison,
report inconclusive and improve measurement conditions; do not claim no regression.

The implementation plan must pin a runnable harness artifact and its baseline
revision before interpreting candidate timings. Use one headless Chromium
worker, a production build, fixed viewport/DPR and deterministic inputs. For each
workload use 100 unmeasured warm-up updates and 200 timed batches of 20 updates;
report per-update batch durations from `performance.now()`. Exclude mount/setup
from steady-state timings and report them separately. Do not force GC or trim
outliers; record browser/clock resolution and background activity. Assert an
output checksum and equal observable geometry/signal ownership outside timed
regions so less work cannot masquerade as an optimization.

Pin three artifacts by source revision and build hash: A is the baseline, B is
an independent build of the identical baseline source/configuration, and C is
the candidate. Run two separate phases per workload:

1. **Calibration:** three independent browser sessions, each in A/B/B/A order.
   For each metric (median and p95), compute the mean of the two B metrics minus
   the mean of the two A metrics within that session. Freeze the largest
   absolute difference across the three sessions as the noise envelope, with a
   floor of one observed clock tick divided by batch size.
2. **Candidate:** three fresh independent sessions, each in A/C/C/A order.
   Compute the analogous mean-C minus mean-A difference and compare it to that
   workload/metric's already-frozen envelope. Candidate samples never
   participate in calibration.

Warm up and collect the specified batches separately for each letter occurrence.
A positive
difference above the envelope in all three candidate sessions is a reproducible
regression; disagreement is inconclusive and requires more controlled evidence,
not a pass. A pass requires all three sessions within the envelope or faster for
both metrics, with structural checks passing. Record the exact samples, pairing,
checksums, and calculation, not just the verdict. Changes to this protocol or a
noisy baseline require a fresh pre-candidate calibration; never retroactively
expand an envelope around observed candidate results.

The explicit-conditional comparator must read base fields and every matching
patch field, including overwritten values, at the same receiving component; a
winner-only or parent-owned implementation is not an equivalent comparator.

A structural regression fails immediately. A candidate exceeding the frozen
baseline envelope in three controlled paired runs blocks feature-complete status:
optimize, or return for explicit approval of a changed performance requirement.
Do not trade correctness, validation, or ownership for benchmark results. Large
lists retain documented linear cost; an 8/16-rule diagnostic workload checks the
work-count model without pretending that arbitrarily many conditions are free.
The feature cannot be declared performance-neutral before this evidence exists.

## Layers, headless execution, and backend boundaries

Layer's own rules use its outer containing allocation. Children in a managed
Canvas Layer query that Layer's logical allocation. Moving, rotating, filtering,
scaling, or changing backing density does not change query dimensions. Layer logical
size changes must invalidate its child rendering using existing dimension
handling; stable logical dimensions plus an unrelated parent repaint may reuse its
bitmap. A matched child signal dirties its existing nested instance and ancestor
composition path. Test nested Layers and a clean sibling; introduce no root
viewport dependency across the cache boundary.

Core primitive dispatch applies the same rule input semantics to compatible
`definePrimitive` styles, including official sibling primitives. WebGLLayer's
outer styles use Canvas allocation; inner scene primitives retain the island's
incoming logical allocation and their own closed 3D style vocabulary. A 3D
transform or projected mesh bounds does not establish a size-query container.
This adds neither Canvas layouts inside an island nor world-space size queries.

The evaluator uses explicit logical dimensions, so browser capability information is
irrelevant. Headless pure measurement supplies constraints; browser tests can
use numeric `pixelRatio` and deterministic dimensions. A DOM root still requires
its existing Canvas and ResizeObserver infrastructure. This does not promise
new server rendering or a root mount without browser APIs. Fixed logical roots
keep the same query results under CSS resizing, fit changes in separate mounts,
and density changes. Responsive roots follow CSS content-box dimensions. Zero-sized
displays retain the current suppression/resumption behavior; zero-sized nested
allocations are legitimate query inputs.

Responsive intrinsic/recursive measurement, pointer precision, hover, reduced
motion, aspect ratio, orientation,
root/CSS viewport selection, named containers, boolean operators, and user-named
breakpoint tokens are deferred. Unknown conditions reject; absent platform
capabilities are never guessed from width or user agent. A future capability
proposal must define explicit unknown values, overrides for tests, dynamic
listener ownership, and how reduced motion affects animation behavior as well
as style. None of that is a prerequisite for this slice.

## Boundaries for consumers

Rules change style values only. They cannot change children, component types,
keys, data, handlers, focus policies, `pointerEvents`, or Axis `tickCount` program
props. There is no hidden structural branching or `display` property. Opacity
zero does not remove hit geometry or focus eligibility.

Conditional structure remains ordinary component code using `useLayoutBox()`
and explicit signal reads, observing normal identity/hook rules. Data reduction,
tick counts, alternate text, tap-to-inspect, brush hit-target policies, keyboard
operation, and semantic alternatives remain application concerns. Consumers
should not infer touch capability from a narrow width. The toolbar can use
44-unit targets at every width without any capability query; that is an example
choice, not a guarantee of physical target size under fixed viewport scaling.

For the CO₂ consumer, a later mobile pass should consider toolbar/readout layout,
plot height, endpoint-label collisions, data density, tap inspection, pointer
capture/cancellation, touch scrolling policy, and accessible alternatives.
Desktop acceptance remains a constraint on that separate work.

## Observable acceptance and delivery milestones

### Slice ready for feedback

Before production changes, add one focused failing public-API scenario test:
mount the same toolbar component directly in a 1000-wide responsive root, inside
a 320-wide explicit Grid cell in that root, and directly in a 360-wide responsive
root. Use the same reusable component and same inner responsive content style,
with context-specific outer placement styles and no JS breakpoint branches.
Expected layout:
horizontal at 1000; vertical at 320 and 360. At gap 12, the second 112 × 44 target
starts at `(124, 0)` horizontally and `(0, 56)` vertically. Use public
`definePrimitive`/`useLayoutBox` observation and event behavior, with focused
paint evidence where needed; no application imports of core internals.

Provide a learning example at the proposed route
`http://localhost:5173/#/examples/layout/responsive-styles` and a separate
deterministic test-lab fixture. Treat this as the target route, not a verified runnable deliverable. The example must
allow independently resizing the root and the narrow container, display their
logical widths/heights, and label the rule thresholds. Include independent height
controls and the compact-spacing example above. Add labels and working actions;
retain keyed controls and a visible interaction counter through reflow.

The initial runnable slice must also prove:

1. Drive widths `599 → 600 → 601 → 599 → 600` on both the root and allocated
   container. Exactly 600 selects the wide branch; returning below restores
   base direction/height. No stale first frame, remount, or persistent follow-up
   frame caused by matching. Updating the narrow region does not change the
   wide sibling's match.
2. Change the shared gap signal from 12 to 20. The second target moves to
   `(132, 0)` or `(0, 64)` without replacing the element tree. A matched-patch
   signal updates paint; after leaving that branch its exclusive source no
   longer schedules the receiver. Returning reads its latest value.
3. A rule changing the receiver's own width below the threshold does not flip
   its own selection back. The layout settles in one traversal per ordinary
   render, without breakpoint oscillation.
4. For the height example, at width 700 drive heights
   `401 → 400 → 399 → 401 → 499 → 500 → 501 → 499`. Verify gaps
   `16 → 8 → 8 → 16 → 16 → 24 → 24 → 16`, in both root and container contexts.
   At height 500 drive width `600 → 599 → 600` and verify `24 → 16 → 24`.
   Height signal updates, height-changing patches, identity, and cleanup must
   obey the same rules as width. Assert top-level standalone measureElement with width-only rules accepts an
   indefinite unqueried height, while a height query rejects it. Mounted
   intrinsic measurement of either query-bearing item remains unsupported.
5. Check the absent-query fast path and single-preparation work counts from the
   performance contract before exposing the slice. Broader reference workloads
   follow hands-on feedback.
6. Dispose the fixture and write retained signals. No query-owned work remains;
   edge/provision and root observer counts return to baseline. Check focused
   failure cleanup as part of preparing the mechanism, not after exposing leaks.

At this milestone report the exact running URL and invite hands-on feedback.
Do not present it as feature complete or as a completed phone chart redesign.

### Feature complete after feedback

Harden the accepted behavior with a proportional matrix:

- Min/max intersection and inclusive shared endpoints; zero/fractional dimensions on both axes;
  empty rules; invalid numbers, keys, nested rules, and malformed input.
- Multiple matching patches, whole-object replacement, explicit undefined,
  defaults, whole-style signals, duplicate/shared sources, unmatched computed
  sources never read, and preserved base/overridden matching-field dependencies.
- All five layout parents; same style/element reused in distinct occurrences;
  plain-component prop preservation; preinspection/measurement/paint agreement;
  finite-axis standalone measurement and explicit mounted/recursive measurement rejection,
  including independently changing width and height and combined conditions.
- Custom primitive normalizer sees only merged local style; filter selection and
  pure filter measurement preserve existing contracts. Type errors for foreign
  fields, missing required base properties, nested rules, forbidden backend
  fields, and signal-valued conditions/list objects.
- Logical resizing versus CSS-only resizing of fixed roots, density independence,
  zero-display resume, nested Layer signal/size invalidation and clean-sibling
  reuse, keyed identity, targets matching reflowed geometry, abort and failed
  preparation cleanup. Independent roots continue after an error.
- JSX and createElement parity; root exports, declarations, Bundler/NodeNext,
  packed consumers, source/built browser modes, and Studio editor declarations.

Use deterministic ownership counters and semantic geometry first. Do not change
visual baselines without inspecting expected/actual/diff evidence. Broader
verification and documentation follow experiential feedback; the final approved
implementation plan must include the repository trust gate under its documented
Node 24.15+ / pnpm 11.21.0 / Playwright Chromium environment. No existing test
counts or design-time reads substitute for fresh verification.

## Self-review and approval boundary

Self-review resolved the main ambiguities explicitly: parent size versus final
cell size; inclusive overlapping endpoints; undefined versus omission; base and
overridden signal ownership; selection reuse after placement; provisional
standalone finite-axis measurement versus rejected responsive intrinsic paths;
and Layer-local versus root size.
Required style keys and plain-component prop preservation remain unchanged.
No unimplemented capability is treated as a prerequisite already shipped. The
height revision requires finite bases only on queried axes in standalone
measurement. Following independent review, the first slice rejects responsive
intrinsic measurement instead of introducing dimension provenance. Prepared-input
consumption now explicitly precedes raw-style reads. Agent-facing recipes, type
fixtures, and diagnostics make the two authoring boundaries observable. Arbitrary
5%/10% performance allowances were removed; measured nonregression is required.
Layer rule-list identity and overridden signal reads remain documented costs.

Earlier review feedback is incorporated, including scoping the indefinite-
unqueried-axis test to standalone measureElement. This revision additionally
clarifies absent/empty framework-key removal without no-query copies, malformed
input versus unsupported-measurement precedence, data-record validation limits,
and a compact authoring decision table. Implementation planning must name
ownership-equivalent benchmark comparators and verify the reserved-key type
diagnostic is the intended error, not an incidental constraint failure. A fresh independent review requested stronger
occurrence-local metadata, callback-boundary tests, contract synchronization,
plain-component reuse tests, explicit recursive-measurement applicability, and a
reproducible timing protocol. These changes are incorporated. The independent reviewer
confirmed the findings resolved and recommended approval after separating
benchmark calibration (A/B/B/A) from candidate comparison (A/C/C/A); that final
notation correction and the per-session calculation are now explicit. Review is design evidence only, not runtime or
performance verification.

The recommended first slice is width-and-height local styling with the necessary
measurement/ownership rules above. The deferred vocabulary is not an execution
queue. The user has approved this written specification and explicitly authorized
immediate execution; the implementation plan records progress and evidence.

## Approved performance amendment — 2026-09-28

After reviewing the measured costs, the user accepted the current opt-in overhead
for this release and deferred further optimization. This amendment supersedes
the strict explicit-conditional parity requirement for query-bearing styles in
the Performance contract, timing verdict rules, and earlier self-review summary.
The accepted evidence is approximately 0.085 ms per 1,000 style preparations and
0.20–0.25 ms median / 0.29–0.34 ms p95 additional complete-frame time for 1,000
receivers with one matching rule. The latter measurement predates the final small
optimizations; these figures describe observed desktop Chromium fixtures, not
universal budgets or phone performance guarantees.

Keep the current `style.when` authoring and mutable-record validation semantics.
Do not introduce immutable descriptors or cached validation for this release.
The previous opt-in timing failures remain valid historical measurements, but
are no longer release blockers. Additional opt-in timing-matrix exploration and
further optimization are follow-up work. Record a final representative queried
frame comparison; do not claim that responsive queries are free or performance
neutral. Materially greater overhead than the accepted measurements must be
reported rather than silently included in this approval.

Ordinary styles retain the no-measurable-regression requirement and frozen
baseline protocol. All functional, type, ownership, cleanup, layout-stability,
work-count, public-example, and package-verification requirements remain in force.
No additional render/layout passes or reactive machinery are permitted.
