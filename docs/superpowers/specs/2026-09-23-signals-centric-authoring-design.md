# Signals-centric hook and reactive authoring design

> **Historical status: REOPENED REVISION FOR REVIEW.** This dated design record
> was approved in conversation on 2026-09-23, then reopened the same day to add
> CRC-wide signal-valued component inputs. That revision supersedes the earlier
> explicit-`.get()`-only input contract. The implementation-plan draft based on
> the superseded contract was discarded. Production work remains blocked until
> this revised written specification and a later implementation plan are each
> reviewed and approved.

Date: 2026-09-23

## Summary

CRC will adopt one public reactive-state model centered on synchronous signals.
`useSignal` becomes the only writable component-state hook. Public `useState`,
`StateUpdater`, `useMemo`, and `useWhenChanged` are removed without compatibility
aliases. CRC adds `batch`, `useComputed`, `useConst`, and `useReaction`:

- `batch` groups synchronous signal writes into one deduplicated notification
  wave;
- `useComputed` owns one stable lazy computed signal for a component hook slot;
- `useConst` constructs one non-reactive value for a component lifetime; and
- `useReaction` owns signal-driven imperative setup and exact cleanup without
  making its signal reads component-render dependencies.

`useRef` remains the mutable non-reactive cell. Specialized hooks remain because
they own resources, event registrations, scheduler participants, render
transactions, or backend state rather than merely storing values.

Signals also become first-class component inputs across CRC. The public
`SignalValue<T> = T | Signal<T>` type and `resolveSignalValue` helper let an
input accept either a plain value or a signal. CRC built-ins resolve declared
signal-valued props, style fields, layout values, text, structural children,
event handlers, animation hook inputs, and applicable official-package inputs
while evaluating the receiving component. The dependency therefore belongs to
the receiver:

```tsx
const x = useSignal(10);
const color = useSignal('red');
const label = useSignal('Current');
const data = useSignal(initialData);

<Rectangle style={{ x, fill: color, width: 50, height: 50 }} />
<Text>{label}</Text>
<LineSeries data={data} xScale="x" yScale="y" />
```

Passing `x.get()` remains supported and deliberately attributes the read to the
enclosing component instead. JSX and `createElement` store raw inputs; they do
not recursively inspect or unwrap application objects. Each receiving component
or CRC-owned input schema declares the exact positions that resolve signals.

The implementation will optimize the graph before migrating the public surface.
Stable reactive edges will use reusable intrusive ownership records rather than
allocating `Set` and `Map` collections during every component evaluation. A
component that reads no signals will acquire no reactive consumer or dependency
storage. The common component-owned signal with one consumer will not pay for a
general-purpose observer collection. Readonly signal views will remain lazy.

Signals make scheduling, derivation, and non-rendering reactions fine grained;
they do not make arbitrary immediate-mode Canvas pixels independently
repaintable. Ordinary invalidated Canvas instances still clear and traverse
their complete immediate-mode tree. Persistent pixel isolation remains explicit
through `Layer`, WebGL, and official renderer boundaries.

CRC will not automatically cache components as images, create an
`OffscreenCanvas` per component, infer implicit Layers, retain arbitrary Canvas
drawing commands, or introduce a DOM-like scene graph. The author has already
tested per-component OffscreenCanvas caching and found its construction and
surface churn prohibitively expensive. That evidence agrees with the runtime
model: a reusable transient pool cannot preserve cached component pixels, while
persistent per-component surfaces add memory, clearing, copying, and compositing
cost even when replaying simple primitives would be cheaper.

This is a breaking authoring change. Current active code, tests, examples,
Studio declarations, API pages, guides, catalog metadata, package consumers, and
official sibling packages will migrate together. Historical design and field
records remain historical evidence and are not rewritten into false current
state.

## Intent and success criteria

The primary purpose is performance, with API coherence as a supporting benefit.
The change succeeds only if measured runtime work improves in the cases signals
can optimize and does not materially regress the unavoidable full-repaint case.

The design succeeds when:

- authors have one writable state primitive inside and outside components;
- equal writes schedule no work;
- several synchronous writes can notify each affected consumer once;
- computed equality prevents downstream component invalidation before Render;
- signal-driven imperative synchronization can run without Canvas traversal;
- stable reactive dependencies produce no per-render collection churn;
- components without signal reads pay no live-consumer or dependency-edge cost;
- one component-owned signal and one reader use the graph's cheapest ownership
  representation and promote safely when sharing appears;
- signal-valued component inputs attach to the receiving component, while an
  explicit `.get()` at the call site attaches to the enclosing component;
- whole-style signals and direct signal-valued style fields work in drawing,
  layout, measurement, Canvas, WebGL, and official renderer paths without
  recursively observing arbitrary nested application data;
- plain component inputs create no signal consumer, graph edge, wrapper signal,
  resolved-props copy, or other persistent reactive allocation;
- ordinary non-equal state changes are no materially slower than current
  `useState` on equivalent workloads;
- existing Layer isolation and official-renderer invalidation become neither
  broader nor more expensive;
- the current immediate-mode, identity, hook-order, failure, and teardown
  contracts remain intact except where this specification explicitly changes
  public hook behavior; and
- the migration leaves no current supported surface teaching or exporting the
  removed APIs.

## Non-goals

- Automatic per-component bitmap caching or Layer promotion.
- A retained Canvas display list, virtual DOM, scene graph, or reconciled host
  node tree.
- Arbitrary component-level pixel repaint inside one immediate-mode surface.
- Blind or unlimited recursive signal unwrapping by JSX, `createElement`, or a
  generic object walker.
- Treating signals found inside arbitrary application data, dataset rows,
  `custom` style payloads, tags, handles, or other opaque values as dependencies.
- Making ordinary props into signals.
- Asynchronous signals, Promise tracking, Suspense, server components, or a
  worker-owned graph.
- Deep structural equality by default.
- A general public subscription API in this change.
- Replacing specialized resource-owning hooks with generic signals.
- Renaming every hook merely to make the vocabulary uniform.
- Preserving source compatibility with `useState`, `StateUpdater`, `useMemo`, or
  `useWhenChanged`.

## Current-state audit

### Public hook and signal surface

The current root package exports:

- graph primitives `signal`, `computed`, `untracked`, and `isSignal`;
- state hooks `useState` and `useSignal`;
- cache and cell hooks `useMemo` and `useRef`;
- synchronous lifecycle hook `useWhenChanged`;
- animation ownership hooks `usePlayback` and `useTransition`;
- path hooks `useRectPath`, `useLinePath`, and `useSvgPath`;
- event/focus hooks `useEvent`, `useEventTarget`, `useEventListener`, and
  `useCursor`; and
- render-context accessors `useLayoutBox` and `useCanvasContext`.

Official sibling packages add `useAnimationFrame`, `useOrbitCamera`,
`useGLTF`, and `useParticleSystem`. Physics exposes component-owned world and
body endpoints under its deliberate `crcPhysicsWorld*` and
`crcPhysicsBody*` vocabulary. Those endpoints already expose field state as
readonly signals.

### Current `useState`

`useState` owns a value and stable setter in one hook slot. Each accepted call
mutates the stored value and requests the complete owning CRC instance through
the scheduler. It has no equality suppression. Setting the current value still
requests a frame. Function values are ambiguous because a function passed to the
setter is always treated as an updater. A stale setter becomes inert after its
exact component or mount starts teardown.

### Current `useSignal`

`useSignal` creates one ordinary writable signal in a hook slot. `set()` treats
functions as values, `update()` is the explicit updater operation, and
`Object.is` is the default equality. A retained hook signal remains writable
after owner removal, but detached render edges mean those writes schedule no
work for the removed owner.

Every non-fragment component currently creates a render consumer eagerly.
Every component evaluation creates a new dependency `Set`; successful
evaluation reconciles that set against a dependency `Map`. Each signal node owns
an observer `Set`, and computed nodes additionally own dependency and observation
maps. This is general and correct but allocation-heavy for the overwhelmingly
common zero-, one-, and few-edge cases.

### Current component-input boundary

Current JSX and `createElement` preserve props without resolving signals. A
signal works only when application or component code calls `.get()`. Built-in
style resolution expects ordinary style values, `Text` accepts recursive scalar
content but not signals, and layout parents inspect child styles before the
child primitive evaluates. Official package components make their own local
choices; there is no shared `T | Signal<T>` input vocabulary.

That current boundary means:

```tsx
<Rectangle style={{ x: x.get(), fill: color.get(), width: 50, height: 50 }} />
<Text>{label.get()}</Text>
```

subscribes the enclosing component, not `Rectangle` or `Text`. It also means a
future visualization package would need either explicit call-site reads or a
package-specific signal convention for `data` and `domain`. The revised design
replaces that inconsistency with one core-owned input contract.

The current renderer already evaluates ordinary component callbacks and
primitive programs inside the exact component's signal collector. That is the
correct attribution point for most input resolution. Layout and pure
measurement are the exception: they can inspect a child's style or textual
content before that child's component scope evaluates. The revised design adds
a receiver-token provision for those pre-evaluation reads rather than charging
them to the layout parent.

### Current computed scheduling

`computed` is already lazy, cached, dynamically dependent, equality-aware, and
observation-aware. An observed invalidation requests Plan work without dirtying
a renderer. Plan validates dependency-first; an equal result ends with no
component traversal. Component reads of a computed attach to the computed node,
while its source reads belong to the computed's nested collector.

This propagation barrier is the material semantic advantage over `useMemo`.
`useMemo` caches a plain value only while the component is already evaluating;
it cannot prevent that component from becoming dirty when a directly-read
source changes.

### Current renderer granularity

Signal reads are owned by exact component consumers, but an invalidated
component requests its complete owning CRC instance. An ordinary Canvas root
then clears and traverses the full tree. A managed `Layer` is a distinct private
instance backed by one persistent OffscreenCanvas, so a child-only signal can
dirty that Layer while clean sibling Layer surfaces retain their pixels.

This separation is intentional. Exact component edges support equality
suppression, diagnostics, ownership, and renderer-specific work; they do not
authorize skipping Canvas paint whose overlap and source-order dependencies
have not been retained.

### Current migration surface

The removed vocabulary appears in:

- root exports and public types;
- hook and runtime contract tests;
- drawing, layout, focus, event, Layer, WebGL, GLTF, Three, particles, and
  physics tests;
- the core `Image` implementation;
- particles and physics production code that currently uses `useMemo`;
- learning examples, the complete diagram-editor tutorial, deterministic
  laboratories, and catalog/search metadata;
- current Learn and API documentation;
- Studio editor declarations and package-consumer programs; and
- runtime export enumerations and public-vocabulary type tests.

The migration is therefore one repository-wide public pivot, not a local hook
file deletion. The input revision additionally reaches primitive input type
mapping, every core specified-style family, style normalization and measurement,
text/container child materialization, event prop types, animation hooks,
official backend definitions, physics/particle configuration, future or active
`@crc/viz` component seams, JSX declarations, and performance diagnostics.

### Audit verification

The focused current-state audit ran the hook contract, state ownership, signal
hook, and signal scheduler performance suites in Chromium through the checked-in
Vitest binary. All 41 focused tests passed. This verifies the present behavior
being replaced; it is not evidence for the future implementation.

## Design principles

1. **Signals are the state model.** Writable values use signals; derived values
   use computed signals.
2. **Signal-valued inputs are explicit in the receiving API.** A component may
   declare `SignalValue<T>` and resolve it while evaluating. No undeclared prop,
   nested object, or JSX runtime walk acquires a dependency.
3. **Equality avoids work before scheduling paint.** It is better not to dirty a
   renderer than to discover unchanged output during Render.
4. **Imperative synchronization is not rendering.** A reaction owns its own
   graph consumer and must not make the component a renderer consumer.
5. **Ownership remains explicit.** Hooks that own resources or scheduler
   participation remain specialized.
6. **The cheap case shapes the graph.** Zero- and one-edge consumers must not pay
   for collection objects designed for large shared graphs.
7. **Pixels are retained only at explicit surfaces.** A `Layer` or renderer
   boundary is an application-visible performance decision.
8. **Failure cannot publish half a hook candidate.** New computed formulas,
   dependency arrays, reaction callbacks, and reaction setups follow render or
   Complete transaction rules.
9. **Performance claims require workload evidence.** API uniformity alone does
   not justify removing a cheaper primitive.
10. **Plain inputs stay plain.** Signal input support must add no wrapper signal,
    recursive walk, or persistent allocation to a component that receives only
    ordinary values.

## Final public model

### Removed exports

The root package removes:

```ts
useState;
StateUpdater;
useMemo;
useWhenChanged;
```

No compatibility exports, aliases, deprecated wrappers, or alternate subpaths
retain them.

### Added exports

```ts
export interface CRCReactionOptions {
  readonly debugName?: string;
}

export type SignalValue<T> = T | Signal<T>;

export function resolveSignalValue<T>(value: SignalValue<T>): T;

export type CRCNodeInput =
  SignalValue<CRCNode> | readonly CRCNodeInput[] | Iterable<CRCNodeInput>;

export type CRCTextInput =
  SignalValue<CRCTextChild> | readonly CRCTextInput[] | Iterable<CRCTextInput>;

export type CRCContainerChild = CRCNodeInput;
export type CRCRenderResult = CRCNodeInput | void;

export function batch<T>(callback: () => T): T;

export function useConst<T>(create: () => T): T;

export function useComputed<T>(
  compute: () => T,
  dependencies?: readonly unknown[],
  options?: SignalOptions<T>,
): Signal<T>;

export function useReaction(
  setup: () => void | (() => void),
  dependencies?: readonly unknown[],
  options?: CRCReactionOptions,
): void;
```

`SignalValue` is a type-level opt-in, not a wrapper object. The helper performs
one nominal `isSignal` check and at most one `.get()` call. It does not recurse,
invoke functions, traverse arrays, inspect object properties, or memoize. Called
during a component evaluation, the read belongs to that component's active
collector. Called outside a tracked context, it is an ordinary untracked
snapshot read, exactly like calling `.get()` there.

`CRCNode` and `CRCTextChild` remain the resolved, signal-free structural
grammars. `CRCNodeInput` and `CRCTextInput` are the authoring grammars accepted
by component results and declared children props. A signal at one input position
may yield one complete resolved node/text structure, but that contained
structure cannot itself contain signals. Arrays and iterables of input positions
may contain additional signals explicitly. `crc()` continues to require a
resolved root `CRCNode`; a bare signal is not a root owner.

### Retained core exports

The following remain public with their existing purpose:

```ts
signal;
computed;
untracked;
isSignal;
useSignal;
useRef;
usePlayback;
useTransition;
useRectPath;
useLinePath;
useSvgPath;
useEvent;
useEventTarget;
useEventListener;
useCursor;
useLayoutBox;
useCanvasContext;
```

Specialized package hooks and component-owned endpoints also remain.

## Signal-valued component input contract

### Two intentional ownership forms

Both of these are supported, and they mean different things:

```tsx
// Rectangle owns the read and dependency.
<Rectangle style={{ x }} />

// The enclosing component owns the read and dependency.
<Rectangle style={{ x: x.get() }} />
```

In the first form the element descriptor retains the signal object unchanged.
`Rectangle` resolves the declared `style.x` input while its receiver collector
is active. In the second form JavaScript evaluates `.get()` before constructing
the element, so the child receives a number and has nothing to resolve.

This distinction is preserved through `computed`: passing a computed signal
lets the receiving component subscribe to the computed barrier, while passing
`computedValue.get()` makes the enclosing component the downstream consumer.
The same source equality, computed validation, batching, scheduler coalescing,
and teardown rules apply to either ownership location.

### Type vocabulary and custom components

Custom component authors opt in one input at a time:

```tsx
interface GaugeProps {
  readonly value: SignalValue<number>;
  readonly valueSignal: WritableSignal<number>;
}

function Gauge(props: GaugeProps) {
  const value = resolveSignalValue(props.value);

  // Exact signal-object props stay objects because the component does not
  // pass them to resolveSignalValue.
  const writable = props.valueSignal;
  return <Text>{value}</Text>;
}
```

`resolveSignalValue` resolves exactly one level. If `T` is itself a signal type,
the helper cannot infer that the caller intended to preserve the outer object;
an API that wants a signal object must declare `Signal<T>` or
`WritableSignal<T>` directly and must not call the helper for that position.

Ordinary function components receive raw props. CRC does not transform every
prop type through a global mapped type and does not pre-resolve their props.
This keeps custom APIs explicit and prevents an object-valued prop from gaining
dependencies merely because one nested property happens to be a signal.

### CRC primitives and declared input schemas

CRC primitives are not invoked as ordinary functions; the renderer dispatches
their registered programs. Their definition metadata therefore declares a
bounded input-resolution schema. The schema covers:

- the optional or required whole `style` input;
- direct fields of that style except explicitly opaque fields;
- direct program props that accept reactive replacement;
- direct program props that intentionally retain a signal object;
- textual or structural child grammar where the component supports it; and
- CRC-owned nested descriptor fields that explicitly opt in.

The corresponding public input type exposes `SignalValue<T>` only at those
positions. The primitive program, normalizer, style resolver, measure callback,
event registration, and official backend receive the resolved ordinary value.
The input descriptor itself remains immutable and unchanged.

The JSX runtime and `createElement` remain construction-only. They strip `key`,
record source metadata, and store raw props exactly as supplied. They perform no
signal read, array walk, object walk, or dependency attribution.

`definePrimitive` keeps resolved program types separate from authoring input
types. Conceptually, a resolved style `S` produces an authoring style whose
direct non-`custom` fields are `SignalValue<S[K]>`, and the `style` prop itself
is `SignalValue` of that authoring style. By default, the public primitive-input
mapping also adds `SignalValue` to each direct program prop whose declared type
is not already `Signal` or `WritableSignal`. It does not apply that generic
mapping to `key`, source metadata, or `children`; structural children use their
separate declared grammar. The renderer shallowly resolves the mapped positions
before invoking normalization, measurement, or the primitive program.

A primitive with an exact signal-object prop declares that prop in a
compile-time-checked `preserveSignalProps` capability. The returned
`PrimitiveInputOf` type leaves that position exact, and the runtime schema skips
it. Textual and structural child grammar are also declared in primitive metadata
so layout/measurement can use the same receiver contract. Official
`defineBackendPrimitive` definitions carry the identical metadata through the
version-coupled friend seam. Ordinary function components do not receive this
automatic primitive mapping and use `SignalValue` plus the public helper
directly.

### Whole-object styles

Every CRC primitive with a style input accepts a signal for the entire specified
style object:

```tsx
const style = useSignal<RectStyle>({
  x: 10,
  fill: "red",
  width: 50,
  height: 50,
});

<Rectangle style={style} />;
```

The receiver reads the style signal once, then runs its ordinary normalization,
layout, validation, and resolution pipeline on the current object. Required
style fields remain required in the signal's value type. Optional style inputs
may use a signal whose value type includes `undefined`; required style inputs
may not.

A whole-style signal may yield an object whose direct declared fields are also
signals. CRC resolves the whole object and then those direct declared fields.
This is two explicit schema levels, not recursive unwrapping. The source style
object is never mutated.

### Signal-valued style fields

Direct style fields accept signals wherever replacing the entire field value is
meaningful:

```tsx
<Rectangle
  style={{
    x,
    fill: color,
    width: 50,
    height: 50,
    padding: paddingSignal,
    filter: filterSignal,
  }}
/>
```

This includes drawing geometry, paint, transforms, layout participation,
filters as a complete descriptor or list, and renderer-specific WebGL style
fields such as a complete material or transform value. `style.custom` remains
opaque. A signal stored in `custom`, a tag, or another application payload is
not read automatically.

Composite field values are atomic unless their CRC-owned public type explicitly
marks deeper positions as signal-valued. For example:

- `padding: paddingSignal` is reactive;
- `padding: { left: leftSignal }` is not a supported signal position;
- `filter: blurDescriptorSignal` is reactive;
- a signal hidden inside an arbitrary filter-adjacent application object is not;
- `cornerRadii: radiiSignal` is reactive; and
- individual entries inside an ordinary radii array are not inspected.

The initial contract intentionally prefers replacing a small immutable
descriptor over recursively walking it. A later CRC-owned descriptor may opt in
specific nested fields only by changing its public type, resolver, tests, and
performance evidence together.

### Ordinary props, data, and official packages

CRC-provided components accept direct signal-valued props when the prop is a
render-time value. Representative examples include a WebGL mesh's geometry, a
background color, a camera descriptor, a particle effect input, and direct
physics-world configuration such as gravity or enabled state.

Official sibling packages import `SignalValue` and `resolveSignalValue` from
`@crc/core`; they do not publish package-local `MaybeSignal` conventions or deep
resolvers. This contract includes `@crc/viz`:

```tsx
const data = useSignal(initialData);
const domain = useComputed(() => extent(data.get()));

<LineSeries data={data} xScale="x" yScale="y" />
<Axis domain={domain} />
```

`LineSeries` owns one edge to `data`; it does not inspect the rows for signals.
`Axis` owns one edge to the computed `domain`, so equal computed output prevents
its downstream invalidation. A plain data array follows the ordinary cheap
path.

Official package APIs audit their public component inputs individually. Immutable
geometry factories, animation definitions/programs, particle effect definitions,
and pure physics geometry functions remain data constructors rather than
reactive graph entry points. Their results may be placed in a signal and passed
to a component input, but signals embedded inside those immutable values are
not discovered automatically.

### Text and structural children

`Text` accepts `CRCTextInput`, which allows signals at explicitly recursive text
input positions:

```tsx
const label = useSignal("Current");
const value = useSignal(12);

<Text>{["Value: ", value, " — ", label]}</Text>;
```

The input grammar traverses arrays and synchronous iterables because those are
already declared structural text containers. At any input position, one
`Signal<CRCTextChild>` may provide a complete resolved, signal-free text
structure. It does not inspect arbitrary objects. A signal that resolves to
another signal, a structure containing signals, or a cyclic structure is
rejected with a receiver-specific diagnostic rather than repeatedly unwrapped.

Container components such as `Group`, `Clip`, `Layer`, layout components,
WebGL groups/layers, and physics worlds accept `CRCNodeInput` for their declared
structural child grammar. Arrays, synchronous iterables, Fragments, empty values,
and elements remain structural. A signal at a declared child position may
resolve to one complete resolved `CRCNode` structure. That resolved structure
may not contain another signal. Traversal continues only through the CRC child
grammar, never through element props or application objects.

An unkeyed Fragment is transparent, so its child-signal reads belong to the
nearest receiving component whose result is being materialized. A keyed
Fragment owns its structural child reads as its identity boundary. A bare signal
cannot be the root passed directly to `crc()` because there is no receiving
component to own that dependency; place it under a component or read it
explicitly at root construction.

Component-result materialization moves before that component's signal-read
generation commits. CRC resolves declared signal child positions while the
component collector is still active, commits the complete generation, then
traverses child components untracked as today. Child component reads therefore
still do not leak into the parent.

### Event handlers, callbacks, and accessors

A direct event-handler or callback prop may be signal-valued when its receiving
API declares reactive replacement:

```tsx
const clickHandler = useSignal<CRCEventHandler<"click">>(handlePrimaryClick);
<Rectangle onClick={clickHandler} style={style} />;
```

The receiver resolves the callback identity during render and registers the
result. CRC does not invoke it during resolution and does not inspect its return
value. Changing the handler signal invalidates the receiver so the registration
updates transactionally. Event dispatch still batches writes made by the
eventual callback.

An accessor is likewise an opaque function value unless its API explicitly
declares that CRC invokes it. Resolving `SignalValue<() => T>` chooses the
accessor function; it does not call the accessor. If an API declares an accessor
whose return type is `SignalValue<T>`, that API must document the evaluation
phase and call `resolveSignalValue` on the return at that phase. A render-time
accessor read belongs to the receiver. An accessor invoked later in Advance,
Complete, an event, or an asynchronous callback does not silently create a
component render dependency; such APIs must own a dedicated signal/reaction
contract or require an explicit signal object.

### Arrays and nested descriptors

The general rule is shallow, declared resolution:

- a direct `SignalValue<readonly Datum[]>` reads the signal and treats the array
  and every datum as opaque data;
- a direct signal-valued style field may replace the entire array or descriptor;
- an array containing signals is not traversed unless the array belongs to a
  declared CRC structural grammar such as children or a specifically typed
  CRC-owned descriptor;
- nested application objects are never inspected; and
- one signal never causes “unwrap until not a signal” behavior.

CRC-owned option descriptors may opt in one shallow level when individual
replacement is useful. The Signals-centric animation surface does so for
component-owned playback and transition inputs: `usePlayback` may receive a
signal-valued program and playback-options object, while `useTransition` may
receive a signal-valued target and transition-options object whose documented
direct option fields may themselves be signal-valued. The hook resolves those
positions during its owner component's evaluation and transactionally adopts
the ordinary candidate. Writer targets passed to `track`, physics kinematic
target signals, body/world handles, and props explicitly named or typed as
signals remain signal objects.

### Exact signal-object inputs

An API preserves a signal object by declaring the exact signal type:

```ts
interface ControlledValueProps<T> {
  readonly valueSignal: WritableSignal<T>;
}

interface KinematicTarget {
  readonly position: Signal<readonly [number, number, number]>;
}
```

Neither position uses `SignalValue`. No automatic resolver runs there, including
inside official primitive prop resolution. This rule protects writer targets,
physics bindings, handles exposing readonly fields, and custom controlled-value
components from accidental unwrapping.

### Plain-value fast path

Input resolution never creates wrapper signals. For a plain direct value,
`resolveSignalValue` performs one primitive/object-kind branch and returns the
same value. Primitive input resolution uses static schema metadata, not a
recursive walker. It scans only declared direct positions and uses copy-on-first
signal semantics: a plain props/style object is forwarded unchanged, while a
shallow resolved copy is created only after an actual signal field is found.

No signal means no component consumer, receiver provision, edge, resolved-input
copy, dependency array, or persistent cache entry. Structural child arrays are
already traversed by CRC and add only a nominal signal check at each declared
child position. Performance acceptance criteria below protect this path.

## Consequences for existing runtime assumptions

The input contract changes five assumptions from the original version of this
design:

1. **A component consumer is not limited to body `.get()` calls.** Declared
   input resolution, style/measurement provisions, and structural child signals
   can materialize the same lazy receiver consumer. Components with only plain
   inputs still materialize none.
2. **Specified style is no longer always an ordinary object.** The whole style
   and declared direct fields may be signal-valued. Normalizers, layout
   algorithms, measure callbacks, primitive programs, presentation resolvers,
   and backends still receive ordinary resolved values.
3. **Primitive dispatch gains an input-resolution stage.** It runs inside the
   receiver collection and before normalize/resolve/program callbacks. It is a
   bounded shallow schema operation, not JSX reconciliation.
4. **Text and component-result materialization may read signals.** Those reads
   occur before the receiver generation commits. Evaluation of child component
   bodies remains untracked by the parent.
5. **Layout inspection needs receiver attribution.** A parent that reads a
   child's signal-valued layout style does so through the child receiver token;
   it does not acquire the child's dependency itself.

The contract does **not** change component identity, hook ordering, the
full-traversal behavior of an invalidated ordinary Canvas root, explicit Layer
pixel ownership, paint order, event targeting, or the absence of a retained
scene graph.

## Authoring before and after

### Writable component state

Before:

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  return <Text onClick={() => setCount((value) => value + 1)}>{count}</Text>;
}
```

After:

```tsx
function Counter() {
  const count = useSignal(0);

  return (
    <Text onClick={() => count.update((value) => value + 1)}>{count}</Text>
  );
}
```

`Text` owns the signal read. Writing `{count.get()}` instead remains valid and
makes `Counter` the consumer.

`set(value)` always treats a function as data. `update(updater)` is the only
updater spelling:

```ts
const callback = useSignal<() => void>(() => {});

callback.set(nextCallback);
callback.update((previous) => wrap(previous));
```

### Derived reactive values

Before, a component either calculates directly and subscribes to every source,
or awkwardly constructs a computed through `useMemo`:

```tsx
const doubled = useMemo(() => computed(() => count.get() * 2), []);
```

After:

```tsx
const doubled = useComputed(() => count.get() * 2);
return <Text>{doubled}</Text>;
```

The receiving `Text` subscribes to `doubled`, not directly to `count`. Equal
computed output blocks downstream invalidation during Plan. If the owner needs
the value for its own branching, it may still call `doubled.get()` explicitly.

### Plain render inputs

`useComputed` accepts explicit dependencies for values that are not signals:

```tsx
function Shape({ pathData }: { pathData: string }) {
  const path = useComputed(() => new Path2D(pathData), [pathData]);

  return <Path style={{ d: path }} />;
}
```

Signal reads inside the formula remain automatic; the array lists only captured
non-signal inputs whose changes must invalidate the formula. `Path` owns the
downstream computed dependency because its `style.d` slot is signal-valued.

### Mount-lifetime constants

Before:

```ts
const scratch = useMemo(() => new Float32Array(1_024), []);
```

After:

```ts
const scratch = useConst(() => new Float32Array(1_024));
```

`useConst` returns the direct value and creates no signal node or graph edge.

### Mutable non-rendering state

`useRef` remains the correct tool for mutable state that must not schedule work:

```ts
const dragSession = useRef<DragSession | null>(null);
```

This state represents an in-progress imperative session, not visual state.

### Setup and cleanup

Before:

```tsx
useWhenChanged(() => {
  const subscription = subscribe(channelId);
  return () => subscription.unsubscribe();
}, [channelId]);
```

After for a plain prop:

```tsx
useReaction(() => {
  const subscription = subscribe(channelId);
  return () => subscription.unsubscribe();
}, [channelId]);
```

After for a signal-driven resource:

```tsx
useReaction(() => {
  const subscription = subscribe(channelId.get());
  return () => subscription.unsubscribe();
});
```

The signal read belongs to the reaction consumer. Changing `channelId` can
clean and recreate the subscription without traversing Canvas.

### Batched writes

CRC logical event dispatch batches automatically:

```tsx
<Rectangle
  onClick={() => {
    x.set(20);
    y.set(40);
    selected.set(true);
  }}
/>
```

For application callbacks outside CRC dispatch:

```ts
batch(() => {
  x.set(20);
  y.set(40);
  selected.set(true);
});
```

### Specialized ownership

These APIs do not collapse into `useSignal`:

```tsx
const playback = usePlayback(program);
const position = useTransition(target, options);
const camera = useOrbitCamera(options);
const particles = useParticleSystem(effect);
```

They expose or consume signals where appropriate, but their hook slots also own
commands, writer leases, scheduler registration, render candidates, backend
state, or deterministic teardown.

## `useSignal` contract

`useSignal(initialValue, options?)` returns one stable `WritableSignal<T>` for
the exact mounted hook slot.

- The initial value and options are mount-only.
- Default equality is `Object.is`.
- `set(value)` treats values, including functions, as data.
- `update(updater)` invokes the updater once with the currently visible value.
- Equal candidates advance no version, notify no consumer, and request no frame.
- Signal writes remain forbidden during component, primitive-render, computed,
  reaction setup, and reaction cleanup evaluation, including equality no-ops.
- Direct writes remain forbidden during scheduler Advance; participants use
  their staging batch.
- A retained hook signal remains an ordinary usable signal after owner removal.
  It no longer has an edge to the removed component and cannot resurrect it.

Removing `useState` deliberately removes stale-setter semantics. There is no
setter detached from its value cell; retaining the signal retains the value.

## `useComputed` contract

### Identity and ownership

`useComputed` returns one stable readonly `Signal<T>` for the mounted hook slot.
Its computed node remains lazy and is evaluated only when read or when observed
Plan validation requires it.

The hook slot owns formula updates and render-transaction candidates. The
computed node owns its cached value and, while observed, its source-edge leases.
Downstream consumers own their edges to the computed.

If application code retains the returned signal after owner removal, it remains
readable and continues to react to the last successfully committed formula's
signal dependencies. No later component render can revise that formula.

### Signal and non-signal dependencies

Signal reads inside `compute` are tracked dynamically and need not appear in the
dependency array. The dependency array exists only for captured values that are
not signals, including ordinary component props.

Dependency positions compare with `Object.is`. Length changes invalidate the
formula. Consequently repeated `NaN` is equal, while `+0` and `-0` differ. This
aligns hook dependencies with signal equality and replaces the current
strict-inequality behavior of `useMemo` and `useWhenChanged`.

Omitting `dependencies` means the formula may safely close only over signals,
module constants, `useConst` values, stable hook handles, and other mount-stable
identities. A changing ordinary prop omitted from the array is an authoring
error; CRC cannot inspect a JavaScript closure to discover it.

### Formula refresh

Every owner render supplies a candidate callback. If explicit dependencies are
unchanged, a successful render refreshes the callback used by the next genuine
signal invalidation but does not invalidate the cached value merely because an
inline function object is new.

If dependencies change, the current render receives a provisional formula
generation owned by the active root render transaction. A `.get()` anywhere
inside that transaction evaluates against the candidate formula and candidate
dependencies, so descendants receiving the signal can render the current prop
generation. The provisional result is visible to reads in that transaction but
does not notify ordinary observers.

If the candidate is evaluated, successful transaction completion commits the
formula, dependency snapshot, cached result, version, and dynamic source edges.
If the candidate is not evaluated, success commits the formula and dependency
snapshot as invalid: an unobserved computed stays lazy until its next read, and
an observed computed requests Plan validation in the next eligible frame.
Failed transaction completion restores the last committed formula, cached
result, version, and source edges in either case.

This is required because publishing a failed render's captured prop closure to
a retained computed would violate CRC's fail-closed ownership model.

### Equality and publication

`SignalOptions.equals` and `debugName` are mount-only, matching `useSignal` and
standalone `computed`. The equality function compares the last committed result
with a candidate.

When a dependency-array change occurs during an owner render:

- the owner already renders with the candidate value;
- an equal result advances no computed version and notifies no other consumer;
- a changed result commits one version and notifies other live consumers only
  after the owner transaction succeeds;
- the owner is not redundantly scheduled merely because its own successful
  render committed the changed computed.

An unread observed candidate validates in the next frame's Plan and follows the
same equality rule before any downstream renderer is dirtied. This one-frame
deferral is required because the dependency change is discovered during Render,
after the current frame's Plan phase, and because failed render transactions
must not publish their closures.

When a source signal changes outside owner render, ordinary observed-computed
Plan validation remains authoritative.

### Purity and errors

Computed callbacks are pure synchronous derivations. Signal writes and CRC
hooks are forbidden. Promise continuations do not inherit tracking.

Standalone computed error caching, dependency replacement, cycle diagnostics,
and recovery rules remain. A candidate formula failure during render enters
normal render failure recovery and cannot replace the committed formula.

## `useConst` contract

`useConst(create)` runs `create` exactly once for the mounted hook slot and
returns the same direct value on later renders.

- It has no dependency array.
- It creates no signal, observer, or computed node.
- Its factory runs untracked, so signal reads cannot accidentally make the
  component a consumer of a mount-only snapshot.
- Its factory cannot call CRC hooks.
- It does not schedule work.
- It performs no automatic cleanup.
- A factory failure enters normal render failure recovery.
- Key, type, parent, root replacement, or removal creates a fresh slot.

Resources requiring cleanup must use `useReaction` or a specialized owner hook;
`useConst` alone is not a resource-lifecycle primitive.

## `useRef` contract

`useRef` remains unchanged. It returns one stable mutable `{ current }` object
for a hook slot, uses its initializer only on mount, and schedules nothing when
mutated.

`useConst` does not replace `useRef`:

- use `useConst` for a stable value that should not be reassigned;
- use `useRef` for a mutable imperative cell whose current value changes without
  reactive notification; and
- use `useSignal` for a mutable value whose reads should participate in the
  reactive graph.

## `useReaction` contract

### Purpose and naming

`useWhenChanged` mixes dependency-array diffing, synchronous render-time side
effects, cleanup, and an every-render mode. Its name does not identify what is
owned, and signal reads inside its callback currently become component render
dependencies because the callback executes during component evaluation.

`useReaction` names the new behavior: a component-owned imperative reaction to
tracked signal changes and explicit non-signal dependencies. CRC deliberately
does not call it `useEffect`, because React effect timing and lifecycle are not
its contract.

### Setup timing

The first setup runs in Complete after the component's mounting render
transaction succeeds. A failed render never performs setup.

Later setup runs in Complete when either:

- one of its dynamically tracked signals genuinely invalidates it; or
- its explicit dependency array changes during a successful owner render.

The latest callback from the latest successful owner render is used. Callback
identity alone never reruns a reaction.

Omitting the dependency array no longer means every render. It means mount once
and thereafter rerun only for synchronously tracked signals. A callback that
reads no signals and has no explicit dependencies is a component-lifetime
setup.

### Graph ownership and renderer isolation

Signals read synchronously during setup belong to the reaction consumer, not
the component render consumer. A reaction invalidation requests realm Plan and
Complete work but does not dirty Canvas, a Layer, or a renderer.

Several invalidations before the eligible Complete phase coalesce into one
setup generation. Dynamic signal dependencies are replaced after each setup
attempt.

### Cleanup

Setup may return one cleanup callback. The exact current cleanup runs once:

- before the next setup attempt;
- when explicit dependencies change;
- when the hook is abandoned by a hook-order failure;
- when the component is removed or its identity changes; or
- when the root is aborted, fails closed, or is disposed.

Ownership is cleared before invoking cleanup, so a throwing cleanup cannot run
again. Cleanup failures are reported but cannot prevent remaining ownership
from releasing or the replacement setup from being attempted.

Cleanup runs untracked. Signal reads in cleanup do not change the next setup's
dependency set; only synchronous setup reads are reactive dependencies.

### Write and error rules

Signal writes are forbidden during setup and cleanup, including equality
no-ops. Reactions synchronize signals outward to imperative systems; they are
not a state-propagation mechanism. A resource's later asynchronous callback is
outside reaction evaluation and may write signals normally.

If setup throws:

- the previous cleanup has already been released;
- no new cleanup is installed;
- signal reads completed before the throw become the reaction's next dependency
  set so a future change can retry;
- the error is collected with Complete-phase failures and reported after
  unrelated work finishes; and
- the reaction does not spin automatically. It retries on a later tracked
  invalidation or explicit dependency change.

## `batch` contract

### Public behavior

`batch(callback)` is synchronous, nestable, and returns the callback result.
Only the outermost batch flushes notifications.

Inside a batch:

- writable signal reads observe the latest write;
- computed reads observe the latest transitive source values;
- signal equality is applied to each candidate;
- source and computed versions remain internally coherent for explicit reads;
- component, renderer, and reaction observers are not invoked until the
  outermost batch exits; and
- each affected observer is invalidated at most once by that flush.

The batch records each source's entry value. If its final value compares equal
to that entry value, direct consumers are not invalidated by intermediate
writes. Computeds that were explicitly read inside the batch may have validated
intermediate values, but their downstream notifications remain batched and only
the final committed result determines downstream invalidation.

If the callback throws, writes already performed remain committed. CRC flushes
the resulting notification wave in `finally`, then rethrows the callback error.
If notification also fails, CRC reports an `AggregateError` containing the
callback error first followed by notification failures. `batch` is notification
atomic, not a rollback transaction.

### Automatic CRC batching

One complete logical CRC event dispatch—capture, target, and bubble—is wrapped
in one batch. Writes from an earlier propagation listener are visible to later
listeners through explicit reads, but no renderer or reaction invalidation runs
until propagation finishes.

Nested dispatches and explicit user batches compose through the same outermost
depth. Async continuations are outside the synchronous batch and require their
own `batch()` if they need grouped notification.

Scheduler Advance retains its stronger staged-write transaction. Public batch
does not replace participant staging, rollback-on-participant-failure, writer
leases, or Commit publication.

## Reactive graph representation

### Current allocation problem

The current graph allocates or retains general collections at every level:

- an observer `Set` per signal node;
- a dependency `Map` per component consumer;
- a fresh next-dependency `Set` per component evaluation;
- dependency and observation maps per computed; and
- an eager readonly wrapper for every writable signal because recognition
  registration currently calls `asReadonly()` during construction.

This representation is correct but works against the project's current
hot-path optimization direction.

### Intrusive dependency edges

The new graph uses one explicit edge record per live source-consumer
relationship. Each edge links into:

- the source's observer list; and
- the consumer's dependency list.

Conceptually:

```ts
interface ReactiveEdge {
  source: SignalNode<unknown>;
  consumer: ReactiveConsumer;
  sourcePrevious: ReactiveEdge | undefined;
  sourceNext: ReactiveEdge | undefined;
  consumerPrevious: ReactiveEdge | undefined;
  consumerNext: ReactiveEdge | undefined;
  collectionGeneration: number;
  observedVersion: number;
  releaseObservation: (() => void) | undefined;
}
```

Exact private fields may be split by node kind during implementation, but the
ownership and complexity contract is fixed:

- zero edges allocate no collection object;
- one edge needs one edge record, not a set plus map entries;
- notification walks the source-linked edges directly;
- successful recollection marks and reuses existing consumer-linked edges;
- dynamic edges not seen in the successful generation unlink in O(removed);
- newly read dependencies link in O(added);
- teardown unlinks the consumer list in O(owned edges); and
- computed first-observer/final-observer leases remain exact.

Consumers may retain a small free list of their removed edges for later dynamic
dependency reuse. Pooling is consumer-local and bounded by that consumer's
historical live edge high-water mark; there is no realm-global unbounded edge
pool.

### Lazy component consumers

Mounting a component does not create a reactive consumer eagerly. Render
tracking begins with a lightweight current collector. The first signal read
materializes the component consumer and its first edge. A component whose
successful render reads no signals owns no live consumer and no dependency
list.

A component that previously read signals and later reads none releases its old
edges after successful evaluation. Failed render cleanup still releases the
complete instance generation as it does today.

### Receiver-attributed input provisions

Most signal-valued inputs resolve after `prepareComponentScope`, inside the
receiver's ordinary collector. Child layout style and intrinsic measurement are
different: `Absolute`, `Overlay`, `Flow`, `Flex`, or `Grid` may inspect a child
descriptor before the child callback or primitive program runs. Charging those
reads to the layout parent would violate the receiving-component contract and
would produce incorrect Layer/renderer diagnostics.

CRC extends the existing primitive receiver token used to connect measurement,
placement clones, and paint. When layout or mounted measurement encounters the
first signal for a child receiver, it creates a transaction-local input-read
provision keyed by that token. The provision records source nodes using the same
reusable edge-collection machinery, but publishes no observer edge yet. When the
child scope evaluates, its collector adopts the provision and deduplicates those
sources with reads from style resolution, measurement reuse, primitive props,
text materialization, and the component body.

On successful receiver evaluation, the provision merges into the receiver's
ordinary read collection and that unified generation replaces the receiver's
old edges. If the receiver fails before commit, the provision is discarded and
cannot replace the previous successful generation; normal fail-closed root
cleanup may then release that prior generation with the rest of the failed
instance. If a later descendant causes root failure, the same cleanup releases
the already committed receiver and all of its edges. Unclaimed provisions,
removal, abort, and disposal also release exactly. A first-ever provisional read
cannot schedule work during the same synchronous render because render-time
writes are already forbidden.

The provision is allocated only after an actual signal is found. Plain child
styles and plain measured text create no provision or map entry. A public pure
`measureElement()` call outside a mounted render has no receiver owner; it reads
declared signal inputs as a one-shot untracked snapshot and establishes no
renderer/reaction edge. A computed read may still evaluate its own ordinary
cache according to the computed contract. This preserves measurement purity and
avoids a hidden runtime subscription.

Structural child-signal reads normally occur before the receiver generation is
committed and join its ordinary collector. Keyed Fragments use the same lazy
consumer rule for their structural children. Unkeyed Fragments remain
transparent.

### Safe sharing promotion

No signal is permanently classified as local. A hook signal may be passed to
children, another root, a reaction, animation, physics, or application code.
The observer-list representation handles one edge without an allocated
collection and adds further linked edges when sharing appears. No deoptimization
changes public identity or behavior.

### Lazy readonly views

`signal()` registers the writable object as a recognized signal without calling
`asReadonly()`. The readonly wrapper is created and registered only on the first
actual `asReadonly()` call, then cached exactly as today.

### Diagnostics

Existing deterministic consumer, renderer-edge, computed-source-edge, commit,
and Plan-validation counters remain. New counters distinguish:

- lazily created component consumers;
- live and reused edge records;
- live, adopted, and rolled-back receiver input provisions;
- plain and signal-valued input resolutions and shallow copy-on-signal events;
- batched writes and deduplicated observer invalidations;
- reaction consumers, runs, cleanups, and failures; and
- provisional `useComputed` formula generations and rollbacks.

Tests assert ownership counts, not garbage-collection timing.

## End-to-end scheduling lifecycle

### 1. Logical input dispatch

CRC resolves the topmost committed target and performs capture, target, and
bubble propagation. One automatic batch surrounds the complete logical
dispatch.

### 2. Signal writes

Each `set` or `update` first checks the active write guard and writer lease.
Equality compares against the latest visible batch value. Changed values become
visible synchronously to later reads; equal values do nothing.

### 3. Batch flush and graph invalidation

At outer batch exit CRC publishes one deduplicated notification wave:

- direct component consumers become dirty once;
- computeds become pending without dirtying downstream renderers;
- reactions become pending without dirtying renderers;
- official renderer consumers receive their narrow invalidation; and
- all requested work coalesces onto the realm's one pending host frame.

Unbatched writes perform the same publication immediately. Scheduler request
coalescing still limits the realm to one host callback.

### 4. Begin

Begin captures eligible dirty jobs, Advance registrations, and ordinary
completions. Work registered after capture waits for a later frame.

### 5. Advance

Animation, physics, particles, and other participants run in stable order. They
may write only through their staging batch. A throwing participant loses its
own staged candidates without preventing unrelated participants.

### 6. Commit

Commit publishes all accepted staged source values before notification. Every
consumer therefore sees one coherent frame state. Commit-produced dirtiness may
join the current Plan.

### 7. Plan

Plan validates observed computeds dependency-first. An equal result clears the
pending state without renderer invalidation. A changed result advances one
version and invalidates its exact downstream consumers.

Plan then determines dirty roots, managed Layers, official-renderer stages, and
eligible reaction work. A frame containing only reaction work proceeds to
Complete without a Canvas Render stage.

### 8. Render

Managed nested instances render deepest-first. Ordinary roots render in mount
order. A dirty immediate-mode Canvas instance clears and traverses its complete
tree.

Each component evaluation collects its own explicit `.get()` calls, declared
signal-valued input resolutions, adopted pre-evaluation input provisions, and
structural child-signal reads. A nested computed replaces the active collector
while evaluating, so its source reads do not become direct component
dependencies. Component-result signal positions are materialized before the
receiver generation commits; traversal and evaluation of the resulting child
components remain untracked by the parent and establish each child's collector
separately.

Successful component evaluation commits its next edge generation and marks the
consumer clean. Removal and disposal release exact edges. Root failure retains
the current fail-closed all-ref cleanup behavior.

### 9. Complete

By the end of Render, each successful root render transaction has accepted its
hook and renderer candidates; a failed transaction has rolled them back or
released them. Successful transactions make their eligible reaction generations
available to Complete. Complete runs reaction cleanup/setup, delivers playback
and renderer milestones, restores idle scheduler state, reports collected
failures, and requests a follow-up frame only when work remains.

Signal writes requested during Complete are deferred to a later frame. Reaction
setup and cleanup specifically forbid them.

## Equality and invalidation rules

| Value or boundary              | Default equality               | Consequence of equality                               |
| ------------------------------ | ------------------------------ | ----------------------------------------------------- |
| Writable signal                | `Object.is`                    | No version, notification, or scheduler request        |
| Signal-valued component input  | Its source signal's equality   | Receiver is not invalidated for an equal source write |
| Standalone computed            | `Object.is`                    | No downstream invalidation                            |
| `useComputed` result           | `Object.is`                    | No downstream invalidation                            |
| `useComputed` dependency slot  | `Object.is`                    | Formula cache remains valid for that non-signal input |
| `useReaction` dependency slot  | `Object.is`                    | Explicit dependency change does not queue setup       |
| Layer retained-tree properties | Existing strict identity rules | Existing child bitmap reuse remains unchanged         |
| Specialized hook candidates    | Their existing contract        | No forced conversion to generic signal equality       |

Custom equality remains available only where `SignalOptions<T>` is accepted.
Dependency arrays do not accept custom equality; authors needing semantic
comparison should expose a computed signal with the desired equality and read
it from the formula or reaction.

## Layers, renderers, and pixel isolation

### Ordinary Canvas

An invalidated ordinary Canvas instance still performs a full synchronous
traversal. Signal precision avoids entering that traversal when values are
equal, derived output is equal, or work belongs only to a reaction. It does not
make the paint inside one surface independently replayable.

### Managed `Layer`

Each Layer continues to own one persistent OffscreenCanvas for its mounted
lifetime. A signal read in the child tree belongs to that private instance.
When it changes:

1. the child instance becomes dirty;
2. scheduler revision propagation marks ancestor composition paths;
3. dirty descendants render deepest-first;
4. the parent traverses and composites the updated bitmap; and
5. clean sibling Layer bitmaps remain untouched and are reused.

A signal-valued input on the `Layer` element itself—including its placement or
outer presentation style—belongs to that Layer receiver occurrence in the
parent instance and dirties the parent composition path, not the child bitmap.
A signal-valued input resolved by a descendant inside the managed child instance
belongs to that descendant and dirties the child instance. Layout's
pre-evaluation receiver provision preserves this distinction without charging a
child style signal to the layout container component.

### Filters

Filter surfaces remain transient depth-indexed scratch resources. Their pool is
unrelated to persistent Layer caches and cannot preserve arbitrary component
images between frames.

### Official renderers

WebGL, Three, particles, physics presentation, and future official renderers
continue to create renderer-specific signal consumers where they can perform
narrower work such as resource update, draw, or composition. The public signal
model does not broaden Canvas semantics or expose those friend internals.

### Why automatic component images are rejected

A component has no guaranteed isolated rectangle. It may paint outside declared
geometry, return multiple descendants, overlap later siblings, participate in
transforms and clips, establish filters, add interaction geometry, or paint
nothing itself.

Persistent component image caching would require retained bounds, damage and
overlap reasoning, persistent pixel memory, resizing, clearing, copying, and
additional `drawImage` operations. A transient surface pool cannot help because
cached pixels must survive until the next invalidation. Creating and discarding
surfaces instead produces the exact churn already observed experimentally.

CRC therefore keeps explicit barriers. Authors add a Layer only when the cost
and memory tradeoff make sense for that subtree.

## Fine-grained rendering without a retained scene graph

CRC can become more fine grained in four genuine ways without retaining a
DOM-like graph:

1. **Write granularity:** equality and batching avoid redundant graph work.
2. **Derivation granularity:** computed validation blocks unchanged derived
   output before renderer invalidation.
3. **Side-effect granularity:** reactions run without Canvas traversal.
4. **Surface granularity:** explicit Layers and renderer islands retain and
   update independently.

CRC cannot safely skip arbitrary primitive painting within one cleared Canvas
surface without retaining enough paint commands, pixel surfaces, or overlap
metadata to replay the omitted output. Caching only component-returned element
descriptors could skip some user function calls, but primitives, event geometry,
focus records, and drawing would still need replay. It adds a retained component
tree without solving pixel work and is excluded from this design.

Future profiling may justify a separate explicit render boundary lighter than
Layer, but it would require its own bounds, composition, memory, interaction,
and ownership design. This specification neither adds nor reserves one.

## Specialized hooks and ownership

### Hooks that remain

| Hook or endpoint                                 | Why a generic signal does not replace it                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `useRef`                                         | Stable mutable cell with deliberately no observation or scheduling                                        |
| `usePlayback`                                    | Owns playback controller, commands, writer leases, milestones, and teardown                               |
| `useTransition`                                  | Owns output signal, retargeting, provisional render value, playback, and conflict replacement             |
| `useRectPath`, `useLinePath`, `useSvgPath`       | Typed geometry caches with distinct hook kinds and direct `Path2D` results                                |
| `useEvent`, `useEventTarget`, `useEventListener` | Own event registration, geometry, native-listener demand, and exact teardown                              |
| `useCursor`                                      | Own cursor target/default registration and teardown                                                       |
| `useLayoutBox`, `useCanvasContext`               | Access active render context; they are not reactive storage                                               |
| `useAnimationFrame`                              | Own continuing-frame demand on the shared scheduler                                                       |
| `useOrbitCamera`                                 | Own spherical state, pointer session, handlers, revision signal, and transactionally adopted options      |
| `useGLTF`                                        | Own async fetch/decode generation, abort, loaded asset, revision state, and exact resource release        |
| `useParticleSystem`                              | Own controller, simulation registration, binding candidates, commands, and teardown                       |
| physics world/body endpoints                     | Own simulation participants, handles, commands, generation binding, and lazily materialized field signals |

Specialized implementations may use private constant, memo, signal, computed,
and reaction primitives. Public API coherence does not require routing a
non-reactive path cache through a public computed signal.

Specialized hooks may accept `SignalValue` at render-time candidate positions
without giving up their ownership. In particular, a signal-valued transition
target still feeds `useTransition`'s transactionally adopted playback; it does
not replace the playback controller with a generic computed.

### Hook-order behavior

`useSignal`, `useComputed`, `useConst`, `useRef`, and `useReaction` each have a
distinct hook kind. Reordering them remains a deterministic hook-order error.
Removing an old hook slot during migration intentionally changes affected test
fixtures and current examples; it does not weaken the invariant.

## Error and failure behavior

- Signal updater or equality failure leaves the previous value current.
- Component and primitive writes remain forbidden before updater/equality work.
- A signal-valued input read follows the receiver's normal successful-generation
  rule. A failed component/root render cannot publish a new input edge set,
  event handler, style generation, measured value, renderer declaration, or
  official-package configuration.
- Input resolution never catches a source signal error separately from the
  receiving component. A thrown signal/computed read enters normal render
  failure recovery with source metadata from the receiver.
- A nested signal at a position that permits only one signal level, a signal
  cycle in structural children, or a signal resolving to an invalid child/value
  produces an actionable receiver-and-property diagnostic.
- `useComputed` dependency and formula candidates commit only with successful
  render transactions.
- Render failure releases partial consumers, hook resources, event/focus state,
  and component refs exactly as today.
- Standalone computed errors remain cached until a retained dependency changes.
- Reaction errors are Complete-phase failures and do not retroactively fail an
  already successful Canvas transaction.
- Reaction cleanup ownership is cleared before callback invocation.
- Batch callback failure does not roll back already visible signal writes; it
  flushes notification and then reports the callback failure.
- Observer failure cannot strand other observers, pending computed validation,
  reaction cleanup, unrelated roots, or scheduler phase restoration.

## Ownership ledger

| Resource                         | Created by                       | Sole owner                                | Release or replacement rule                                                                     |
| -------------------------------- | -------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Writable hook signal             | `useSignal` mount                | Exact hook slot                           | Slot teardown detaches owner edges; retained signal remains usable                              |
| Component render consumer        | First successful component read  | Exact component refs                      | Last edge removal may collapse storage; component teardown releases all                         |
| Receiver input provision         | First pre-evaluation signal read | Exact render transaction + receiver token | Adopt into receiver generation on success; discard on failure or if unclaimed                   |
| Reactive dependency edge         | Successful tracked read          | Exact consumer-source relationship        | Successful dynamic replacement or consumer teardown                                             |
| Shallow resolved input copy      | First actual signal field        | Current synchronous receiver evaluation   | Released after normalize/render/measure callback; never retained as graph state                 |
| Standalone computed source lease | First observed computed edge     | Computed while observed                   | Dynamic replacement or final observer release                                                   |
| `useComputed` formula candidate  | Owner render                     | Exact render transaction and hook slot    | Commit on success, rollback on failure                                                          |
| `useComputed` cached node        | Hook mount                       | Exact hook slot / retained signal value   | Hook stops revising after teardown; retained downstream ownership may keep ordinary graph edges |
| Constant hook value              | `useConst` mount                 | Exact hook slot                           | Slot teardown drops runtime reference; no automatic application cleanup                         |
| Reaction consumer                | `useReaction` successful mount   | Exact hook slot                           | Slot teardown releases graph edges and pending work                                             |
| Reaction cleanup                 | Successful setup                 | Exact reaction generation                 | Cleared then run before replacement, removal, failure cleanup, abort, or disposal               |
| Batch notification queue         | Outermost `batch` entry          | Synchronous batch scope                   | Flushed and released on outermost return or throw                                               |
| Layer pixel cache                | `Layer` mount                    | Exact Layer hook/component slot           | Resize replaces bitmap; removal/disposal releases instance and surface                          |
| Filter scratch surface           | First active depth lease         | CRC instance transient pool               | Returned after boundary; pool released with instance                                            |

## Migration design

### `useState` migration

Mechanical cases:

```ts
const [value, setValue] = useState(initial);
```

becomes:

```ts
const value = useSignal(initial);
```

Branching, arithmetic, and ordinary JavaScript reads become `value.get()`.
Declared CRC component inputs may receive `value` directly so the receiver owns
the dependency. Direct writes become `value.set(next)`. Functional updates
become `value.update(update)`. Captured `StateUpdater<T>` types become
`WritableSignal<T>` when the value cell itself is passed, or an explicit
callback type when only one operation is exposed.

Code relying on a stale setter becoming inert must be redesigned around owner
cleanup or retain the signal knowingly. Code storing function values becomes
less ambiguous because `set(functionValue)` is data.

The optional empty `useState<T>()` form has no direct spelling because
`useSignal` requires an initial value. It becomes
`useSignal<T | undefined>(undefined)`.

### `useMemo` migration

Current uses split into three categories:

1. `useMemo(create, [])` for a direct mount constant becomes `useConst(create)`.
2. Reactive derived state becomes `useComputed(compute)` and consumers call
   `.get()`.
3. Expensive values derived from ordinary props become
   `useComputed(compute, dependencies)`.

Specialized direct-return hooks such as path hooks keep their public return
types and use private cache machinery. Official package internals may also use a
private value-memo slot when exposing a signal would add no scheduling value.

### `useWhenChanged` migration

`useWhenChanged(setup, deps)` becomes `useReaction(setup, deps)`. The timing
changes from synchronous render evaluation to Complete after a successful
transaction. Tests must assert that failed renders perform no setup.

An omitted dependency array changes meaning. Former every-render behavior must
be removed, expressed through an actual changing signal/dependency, or justified
by a specialized renderer hook. New omission means mount plus tracked-signal
reruns.

Signal reads formerly used to cause a component rerender solely so
`useWhenChanged` could run now belong to the reaction and must produce zero
Canvas traversal when no visual consumer exists.

### Runtime and official packages

- Core `Image` migrates its loaded state to `useSignal` and its source/listener
  ownership to `useReaction`.
- Particles Canvas target-path caching is classified as private direct value
  memoization or public `useComputed` consumption based on whether the component
  benefits from a graph barrier.
- Physics WebGL shape components make the same measured choice internally while
  preserving their public component output.
- WebGL, GLTF loading, Three, particles, and physics friend seams retain
  existing owner and scheduler contracts unless graph-edge representation
  requires version-coupled private changes.

### Signal-valued input migration

Core specified-style types, primitive input mappings, textual/structural child
types, event props, component-owned animation inputs, and applicable official
package component props adopt the shared `SignalValue` vocabulary. Program and
resolver types remain ordinary resolved values so backend code does not spread
`T | Signal<T>` unions through paint/math implementations.

Every built-in and official package classifies each public input as one of:

1. shallow signal-valued replacement;
2. CRC structural child grammar;
3. an explicitly signal-enabled CRC-owned descriptor field; or
4. opaque/exact data, including deliberate `Signal`/`WritableSignal` objects.

The classification is covered by public type tests and runtime tests. New
official packages, including `@crc/viz`, import the core type/helper and follow
the same classification. They may not introduce a second resolver whose deep
behavior differs from core.

Migration examples prefer the ownership that performs the work:

```tsx
// Before: the chart's enclosing component owns the data read.
<LineSeries data={data.get()} xScale="x" yScale="y" />

// After: LineSeries owns the data read.
<LineSeries data={data} xScale="x" yScale="y" />
```

An explicit `.get()` remains in code that branches, computes multiple props once,
needs one parent dependency, or intentionally coordinates several child inputs
through a single owner. The migration must not mechanically replace every
`.get()` with a signal object.

### Tests and scenarios

All current tests using `useState`, `StateUpdater`, `useMemo`, or
`useWhenChanged` migrate to the new vocabulary. Tests whose only use of
`useState` is mount identity use `useConst`; tests forcing a render use an
explicit signal or root replacement according to the behavior under test.

Learning examples, tutorial snapshots, deterministic laboratories, scenario
catalog API tags, and search metadata migrate together. Examples must teach
`set` versus `update`, direct signal-valued inputs versus intentional `.get()`,
computed barriers, reaction-only work, opaque nested data, and when a Layer is
worth its retained surface.

### Documentation and public consumers

Current contracts under `docs/design/` are updated together. Package READMEs
and public API pages for the removed hooks are rewritten or removed; pages for
`SignalValue`, `resolveSignalValue`, `CRCNodeInput`, `CRCTextInput`, `batch`,
`useConst`, `useComputed`, and `useReaction` are added. The state/lifecycle,
component-input, style/layout, author-without-JSX, signals/animation, WebGL,
physics, and visualization guides are rewritten around the single model.

A breaking guide is added at:

```text
docs/migrations/signals-centric-hooks.md
```

Studio declaration snapshots, API export discovery, Bundler and NodeNext
consumers, packed runtime consumers, runtime export lists, and final public
vocabulary type tests must agree with the new surface.

Completed plans, historical specs, and dated field notes retain old names where
they accurately describe history. Their literal historical-status treatment
continues to exclude them from current-vocabulary enforcement.

## Performance design and acceptance gates

### Baselines before production changes

The implementation begins by adding controlled comparison workloads while both
old and new state primitives can still be measured. The pre-change run records
the currently supported state, plain-input, explicit-`.get()`, and explicit-get
fan-out forms. The later signal-input slice adds its matched receiver-owned
forms to the same fixed harness; unsupported signal-valued inputs are not
pretended to have a pre-change timing. Together the runs record structure,
allocation sampling, and wall-clock observations for:

1. one changed local value in one component;
2. one changed local value among 1,000 mounted component state slots;
3. an equal local write;
4. 1,000 changed writes to one value in one synchronous callback;
5. changes to several signals consumed by one component;
6. an observed computed whose final result remains equal;
7. a signal used only by setup/cleanup synchronization;
8. a prop-derived expensive cache read across unrelated root renders;
9. one dirty child across 100 stable Layers; and
10. a representative interaction scenario with state, events, transforms, and
    drawing;
11. plain props and plain style fields on a representative built-in tree;
12. explicit `.get()` at the enclosing component for geometry, color, text, and
    data props;
13. the equivalent signals passed directly as whole props;
14. a whole-style signal and direct signal-valued style/layout fields, including
    the receiver-provision measurement path; and
15. one shared signal fanned out to 1, 10, 100, and 1,000 receiving components
    across one root and across explicit Layer boundaries.

The baseline command, Node version, Chromium version, viewport, DPR, and
worktree state are recorded. Historical timing in existing design records is
context, not a substitute for these fresh baselines.

### Structural requirements

- An equal signal write performs zero notification, zero scheduler request, and
  zero render.
- A batch that ends at its entry value performs zero direct-consumer
  invalidation.
- Several changed signals observed by one component invalidate that component
  once per outer batch.
- One logical CRC event dispatch requests at most one host frame.
- An unchanged observed computed validates in Plan and performs zero renderer
  work.
- A reaction-only signal change performs zero root and Layer traversals.
- A stable `useComputed` dependency array performs zero formula evaluations
  across unrelated renders unless a tracked signal changed.
- A component with no signal reads owns zero live reactive consumer and edges.
- A primitive with only plain props/style owns zero input provision and creates
  zero resolved-input copies.
- An explicit call-site `.get()` creates an edge only on the enclosing component;
  a direct signal-valued input creates an edge only on the receiver.
- Whole-style and layout-prepass signal reads adopt into the receiver's one edge
  generation, including deduplication when paint reads the same source again.
- A plain data array or nested descriptor containing signal objects establishes
  no edge unless its exact public schema declares those positions.
- Shared signal fan-out creates one edge per actual receiving consumer, reuses
  those edges after warmup, and requests at most one host frame per affected
  root/Layer path.
- Stable component dependency sets allocate no new edge or collection records
  after warmup.
- One dirty child across 100 Layers repaints only that child, reuses every clean
  sibling bitmap, and composites through the existing ancestor path.
- No signal, computed, batch, or reaction operation creates an OffscreenCanvas,
  reads pixels, or transfers a bitmap.

### Wall-clock and allocation requirements

Across three controlled runs, the equivalent non-equal unlayered local-update
workload must not regress more than 5% in median or p95 relative to current
`useState`. The existing sparse-render 5 ms median and 8 ms p95 reference budget
is not relaxed.

The plain-prop/plain-style workload must not show a repeatable regression above
5% in median or p95 versus the pre-change runtime and must add zero persistent
allocation. The receiver-owned signal input form must remain within 5% of the
equivalent explicit-`.get()` form for active render time once both are warmed.
Signal fan-out must scale linearly in live edges and must not create per-render
collections or wrapper signals. These are stop/go gates, not informational
benchmarks.

At least two representative equality-, batching-, computed-, or reaction-heavy
workloads must show a repeatable material improvement: at least 20% lower median
active time or allocation traffic, in addition to their required structural
work elimination. A synthetic result caused only by renaming APIs does not
qualify.

If the optimized unified graph cannot meet the non-regression gate, the project
must not remove `useState` under a performance rationale. The implementation
returns to design review rather than weakening a budget.

### Profiling discipline

CPU and allocation profiles run in separate controlled processes. Profiles
identify remaining hot stacks after graph changes; they do not justify unrelated
refactors. Allocation sampling describes traffic, not retained heap. Persistent
ownership remains proven through explicit counters. Input profiles distinguish
JSX construction, plain schema checks, signal recognition, shallow
copy-on-signal, receiver-provision adoption, style normalization, measurement,
and component evaluation so a regression cannot be hidden inside aggregate
render time.

## Verification strategy

### Focused graph tests

Tests cover:

- `Object.is` equality, custom equality, updater failure, and function values;
- lazy readonly view creation;
- zero-, one-, and many-observer edge representation;
- dynamic dependency add/remove and edge reuse;
- nested computed equality and cycle recovery;
- nested batches, reads inside batches, computed reads inside batches, final
  equality collapse, callback failure, and observer failure;
- lazy component-consumer creation and complete teardown; and
- exact counters through repeated mount, removal, failure, abort, disposal, and
  fresh remount.

### Hook tests

Tests cover:

- `useSignal` identity and mount-only options;
- `useComputed` stable identity, signal dependencies, explicit non-signal
  dependencies, candidate publication, rollback, equality, error recovery, and
  retained post-owner behavior;
- `useConst` once-only construction and remount identity;
- `useRef` unchanged mutable-cell behavior;
- `useReaction` mount timing, callback refresh, explicit and signal dependency
  reruns, dynamic dependencies, cleanup order, setup/cleanup failure, write
  guards, no-render behavior, and teardown; and
- changed hook-order diagnostics across every new kind.

### Signal-valued input tests

Public type and runtime tests cover:

- `SignalValue<T>` and `resolveSignalValue` for plain, writable, readonly, and
  computed signals, including one-level-only resolution;
- ordinary custom components attributing helper reads to the receiver;
- explicit call-site `.get()` attributing the edge to the enclosing component;
- whole-style signals and direct style fields across geometry, paint, layout,
  filters, Canvas transforms, WebGL transforms/materials, and applicable
  physics/particle configuration;
- receiver-token adoption through Absolute, Overlay, Flow, Flex, Grid, intrinsic
  Text measurement, placed clones, and paint, with one deduplicated receiver
  edge;
- Text scalar signals, recursive text arrays/iterables, structural child
  signals, keyed/unkeyed Fragments, invalid resolved children, nested-signal
  diagnostics, and cycle detection;
- signal-valued event handlers updating transactionally without calling the
  handler during resolution;
- whole array/data signals remaining atomic and signals hidden in rows, nested
  descriptors, `custom`, tags, and handles remaining unobserved;
- exact `Signal` and `WritableSignal` props remaining signal objects;
- signal-valued `usePlayback` and `useTransition` candidates preserving their
  existing transaction/ownership behavior;
- shared fan-out across siblings, roots, Layers, WebGL, and an `@crc/viz`
  consumer contract fixture;
- pure `measureElement` snapshot reads establishing no subscription; and
- failed render, failure after layout provision, removal, abort, and disposal
  leaving no new edge, provision, registration, or resolved candidate behind.

Public primitive-input type tests prove that supported signal positions compile,
opaque nested positions reject signals, and explicit signal-object positions do
not accept a signal-of-signal wrapper accidentally. Runtime export tests include
the shared type/helper through source, built, Bundler, NodeNext, packed, and
Studio declaration surfaces.

### Scheduler, Layer, and renderer tests

Tests prove the complete event-to-batch-to-Plan lifecycle, Commit admission,
reaction-only frames, nested Layer ordering, root failure isolation, and friend
renderer invalidation. Existing animation, particles, physics, focus, event,
filter, and WebGL ownership suites remain required because their hooks share the
same slots and scheduler.

### Public evidence

One learning example demonstrates local signals passed directly into geometry,
paint, Text, a computed input barrier, batched event writes, and a reaction that
changes an external test resource without repainting. A visualization example
passes signal-valued `data` and `domain` using the same core contract. A
deterministic laboratory exposes counts for source writes, input resolutions,
receiver ownership, provisions/adoptions, shallow copies, batch flushes,
computed validations, reaction runs/cleanups, component traversals, Layer
repaints, and composites. Headless tests drive the same public surface before
any optional visual evidence.

### Packaging and documentation

Source and built Studio modes, package declarations, packed Bundler and NodeNext
consumers, compiler entries, public docs export coverage, scenario catalogs,
search, and current-vocabulary checks must all pass. Removed exports must fail
type and runtime import probes.

### Final trust gate

Focused checks are used while building vertical slices. Feature completion
requires the repository's documented Node 24.15+ / pnpm 11.21.0 / Playwright
Chromium aggregate gate:

```sh
corepack pnpm@11.21.0 trust
```

Controlled wall-clock diagnostics remain separate evidence and are recorded
with their exact environment.

## Delivery sequence

The implementation plan will turn this architecture into reviewable vertical
slices. The intended order is:

1. record current `useState`/`useSignal`, plain-input, and explicit-`.get()` input
   baselines and add structural counters without changing public behavior;
2. replace graph collections with lazy reusable edge ownership while preserving
   the current public surface;
3. add `SignalValue`, `resolveSignalValue`, primitive input schemas,
   receiver-attributed provisions, core style/children behavior, and one public
   direct-input slice for feedback;
4. add `batch` and automatic complete-dispatch batching with public evidence;
5. add `useConst` and transactional `useComputed`, then migrate one public
   state/derivation slice for feedback;
6. add `useReaction` and migrate one resource-owning slice, proving zero-render
   reaction work;
7. migrate core, `@crc/viz`, other official packages, tests, examples, Studio,
   docs, and package consumers, then remove the old exports in the same public
   pivot;
8. run focused input, ownership, and performance hardening, profile remaining
   hot work, and complete the aggregate trust gate; and
9. stop for experiential review at each runnable public slice before broad
   hardening proceeds.

A replacement implementation plan is written only after this revised
specification is reviewed and approved. Production work begins only after that
later plan is also reviewed and approved.

## Alternatives considered

### Selected: component-declared signal inputs on the optimized unified graph

This model resolves signals only at typed component input positions, attributes
the edge to the receiver, eliminates avoidable scheduling and graph work, and
retains Canvas pixels only at explicit surfaces. It gives core and official
packages one authoring vocabulary without turning the JSX runtime into a deep
object observer.

### Rejected: recursive JSX/runtime unwrapping

A generic walk could make many examples appear to work without component code,
but it cannot distinguish data from configuration, exact signal-object props
from signal-valued props, or opaque rows from render inputs. It would add work to
every element construction, create surprising dependencies, complicate failure
attribution, and make future nested object shapes observable by accident.

### Rejected: package-specific input conventions

Allowing core, WebGL, physics, particles, and visualization packages to invent
their own `MaybeSignal` types or deep-resolution behavior would fragment the
authoring model and make dependency ownership depend on package history. The
shared core type/helper plus explicit schemas is the smaller contract.

### Rejected: helper-only support with unchanged built-ins

A public helper alone would help custom components but still force authors to
write `.get()` for every core style, Text child, WebGL value, and chart input.
That preserves enclosing-component ownership and fails the CRC-wide ergonomic
requirement.

### Rejected: public API swap over the current graph

Deleting `useState` and mapping every use to today's `useSignal` would simplify
the API but could add observer and edge overhead to the same full repaint. It
does not satisfy the performance purpose.

### Rejected: automatic component OffscreenCanvas caching

The author has already observed prohibitive surface churn. The design also
requires persistent rather than pooled surfaces, retained bounds, composition,
and overlap semantics. It is slower for simple content and conflicts with the
explicit Layer model.

### Rejected: retained drawing-command or component-output graph

A command graph changes the renderer architecture and ownership model. A cached
component-output tree avoids only some function calls while still replaying
primitive paint and registration. Neither is justified by current profiles.

### Rejected: keep both `useMemo` and `useComputed`

Two public derivation hooks preserve a choice the new model is intended to
remove. `useComputed` plus explicit non-signal dependencies provides caching and
an equality propagation barrier; `useConst` covers mount-only direct values.
Private specialized value caches remain available where graph participation has
no benefit.

### Rejected: wrapping ordinary props in generated signals

Wrapping every ordinary prop in a generated signal would allocate and reconcile
reactive cells for immutable inputs, complicate identity, and imply subtree
skipping CRC cannot provide. The selected design accepts an existing signal at a
declared slot and leaves every plain value plain.

### Rejected: synchronous render-time reactions

Running setup while rendering exposes external systems to work from a render
that may later fail, and signal reads unnecessarily dirty Canvas. Complete-phase
setup after successful render gives the resource an exact committed owner and a
non-rendering consumer.

## Final decision summary

- Remove `useState`, `StateUpdater`, `useMemo`, and `useWhenChanged`.
- Add `batch`, `useComputed`, `useConst`, and `useReaction`.
- Add shared `SignalValue<T>` and `resolveSignalValue` APIs.
- Keep `useSignal`, `computed`, `useRef`, and specialized ownership hooks.
- Let core and official component inputs accept signals at explicitly declared
  whole-prop, whole-style, direct style, text/children, callback, animation, and
  configuration positions.
- Attribute direct signal-valued inputs to the receiving component; preserve
  call-site `.get()` as an intentional enclosing-component dependency.
- Keep exact `Signal`/`WritableSignal` props as objects and keep arbitrary nested
  data opaque.
- Use receiver-token provisions for layout/measurement reads that occur before
  child evaluation, adopting them transactionally into the receiver consumer.
- Use `Object.is` consistently for signal results and hook dependency slots.
- Optimize graph ownership around lazy consumers and reusable intrusive edges.
- Batch complete CRC logical event dispatch automatically.
- Run reactions in Complete after successful ownership commits and never dirty a
  renderer solely because a reaction reads a signal.
- Preserve full immediate-mode traversal for dirty ordinary Canvas instances.
- Preserve explicit Layer and renderer boundaries as the only persistent pixel
  isolation mechanism.
- Reject automatic component image caches and retained scene architecture.
- Reject recursive JSX/object unwrapping and package-specific signal-input
  conventions.
- Make removal conditional on measured non-regression and material improvement.
- Migrate the complete active repository surface in one breaking public pivot.
- Write no replacement implementation plan until this revised specification is
  approved, and write no production implementation until that later plan is
  also reviewed and approved.
