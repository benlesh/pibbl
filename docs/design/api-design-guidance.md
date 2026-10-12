# Pibbl API design guidance for agents

This working agreement consolidates the maintainer's API feedback from available
local Pibbl/CRC work chats, including archived chats, reviewed on October 12, 2026. The root `AGENTS.md` requires agents to read it when adding or changing a
public API. It applies to functions, hooks, components, factories, public types,
and methods on returned objects.

These are design and delivery rules, not a description of every shipped API or
permission to implement a roadmap. Current code, tests, and implemented contracts
remain authoritative. Later explicit instructions override earlier feedback.
Historical examples below explain decisions; they do not restore removed APIs.

## 1. Show the application code before building the machinery

Start from a concrete user task. Show the smallest realistic calling code, the
public signatures and result types, and how the feature composes with existing
Pibbl APIs. Make the public delta explicit: additions, changes, removals, and
whether the implementation requires a core runtime change.

For a substantial surface, use a short table of names, purposes, and return
contracts, followed by concise annotated examples. Explain meaningful tradeoffs
and defaults. A large implementation or attractive demo is not a substitute for
showing what an application developer will import and write.

Present unresolved material API choices before production implementation. Follow
the user's requested design review and approval sequence when one exists. Do not
reopen accepted decisions or request repeat approval for already authorized work.
Only resolve decisions needed for the first slice; full design work is appropriate
for difficult-to-reverse contracts.

## 2. Make names describe what actually happens

Code should reveal the operation, target, result, and lifecycle to both a human
and an agent. Prefer familiar platform or mathematical vocabulary where it fits
the actual behavior. Use the `use` prefix for lifecycle hooks.

- `drive` replaced `track` because the operation writes an animated value into a
  target signal; `track(x, ...)` suggested observing `x` instead.
- `rangeDelta` describes scale mathematics more accurately than `deltaPixels`
  when a range is not necessarily measured in pixels.
- Semantic bar inputs such as `category` and `value` preserve meaning across
  orientation changes. Geometric line and point inputs can still be `x`/`y`.
- An appearance setting belongs in the established style language when that is
  its role. Avoid a second spelling or separate vocabulary for the same concept.

Document coordinate spaces and units, including local versus root coordinates,
domain versus range, degrees versus radians, and logical versus wall-clock time
where relevant. Do not make callers infer them from the current example.

Use explicit signal reads and make writes distinguishable from observations.
Explain what consumes a dependency, what changes when the input changes, and
whether a returned object is data, a reusable definition, or a live resource.
Avoid names and booleans that imply an action when they configure eligibility or
policy instead.

## 3. Shape arguments around their roles

The exact argument rules live in `AGENTS.md`:

| Situation                                        | Default shape                                 |
| ------------------------------------------------ | --------------------------------------------- |
| One value                                        | `fn(value)`                                   |
| One target with configuration                    | `fn(target, { option })`                      |
| Zero or more same-kind targets, no configuration | `fn(...targets)`                              |
| Multiple targets with configuration              | `fn(targets, { option })`, with an `Iterable` |
| Distinct meanings, no single target              | `fn({ source, destination, amount })`         |

Apply this to public methods as well as exported functions. Positional exceptions
must improve readability and terseness, not merely copy an existing signature.
An options object does not make an operation selector acceptable.

## 4. Separate operations; compose implementations

Each public operation needs a stable return contract. Do not select a different
type, shape, cardinality, or capability set through a string, flag, enum,
overload, or conditional type. Splitting an operation into named exports also
makes the dependency graph easier to reason about.

```ts
// Distinct scale capabilities have distinct operations.
const numeric = useLinearScale("price");
const categorical = useBarScale("category");
```

Conversely, avoid multiplying APIs solely because implementations differ when
the operation and return contract are the same:

```ts
// One animated-value contract; a supplied definition chooses the algorithm.
useAnimatedValue(target, { animation: spring() });
```

Prefer imported strategy functions or typed definition objects for algorithms,
format parsers, curves, and other extensibility points. The sprite feedback
preferred a supplied parser such as `aseprite()` to dispatch on a string such as
`"aseprite"`. A strategy must describe a coherent operation, not conceal several
unrelated contracts behind one wrapper.

This is not a ban on strings or unions. IDs, event names, orientation, alignment,
ordinary data, and discriminated event/result unions can describe one coherent
contract. Check every argument, options discriminator, and returned method: does
changing only the selector change what the caller receives or can do? If so,
split the operation.

## 5. Prefer semantic keys and useful inference

When callers choose named roles, use typed keys rather than array positions. The
texture-palette feedback preferred a dictionary with named colors to opaque
palette indices. Preserve inferred key and datum types through factories,
accessors, results, and events so mistakes are caught at the public call site.

Numeric indices remain appropriate for actual ordered data, frame positions, and
source indices. Do not turn every collection into a dictionary. Choose the
representation from the meaning of the selection.

Type machinery should earn its ceremony. If a helper appears to do nothing but
freeze or wrap an object, demonstrate the useful runtime or inference benefit
with a small copyable TypeScript example. Do not hide confusing behavior behind
complicated generic signatures or require casts to use the ordinary path.

## 6. Add reusable capabilities through existing composition

Prefer useful primitives and independently usable calculations over a monolithic
feature container. Separate geometry/calculation from rendering when consumers
can use it independently. Let applications compose ordinary elements, styles,
signals, and handlers for labels, readouts, custom marks, and interactions.

Choose hooks for mount-owned lifetimes, pure functions for independent
calculations, reusable definitions for persistent setup, and components for
rendering/composition. Avoid rebuilding setup callbacks and expensive resources
on every component evaluation when a stable definition or owned resource fits.

Reuse Pibbl's signal graph, scheduler, animation definitions, event conventions,
layout allocation, and resource ownership. For example, animated chart navigation
should build on existing animation utilities rather than establish another
animation engine. Texture values should compose with ordinary fills where the
supported contract allows it.

Give custom implementations the same supported extension boundary that first
party implementations use where practical. General utilities should not acquire
particle- or chart-specific names merely because that feature first needed them.
Provide useful defaults and allow meaningful customization through ordinary
values, callbacks, definitions, or elements. Prove another use case when it helps
establish reusability, without implementing speculative infrastructure.

## 7. Make optional costs genuinely optional

Applications should pay only for the capabilities they use, in both bundle size
and runtime work.

- Prefer standalone named exports to utility namespace objects such as
  `physics.whatever` or `particle.whatever`.
- Keep unused algorithms, parsers, physics/WASM engines, filters, inspection,
  and recording out of unrelated consumer bundles. Do not assume ESM syntax or
  `sideEffects: false` alone proves this.
- Keep optional imports inert. Initialize expensive engines and resources only
  at the documented point of use.
- Compute nearest-data inspection on demand rather than on every pointer event;
  define any repeated-query cache's lifetime and invalidation.
- Preserve the direct inexpensive path when auxiliary outputs, inspection,
  capture, or other optional features are absent. Avoid unnecessary wrappers,
  subscriptions, readback, allocations, or global registries.
- Batch series and numeric work where appropriate; avoid a component, surface,
  or rigid body per datum merely to fit an abstraction.

Use proportional consumer-bundle, import-inertness, ownership, and structural
performance evidence for affected boundaries. Keep public APIs independent of
whether the implementation later uses JavaScript, WASM, workers, or the GPU.
Optimization does not justify silently changing observable behavior; put a
material contract tradeoff on the table.

## 8. Specify lifetime and observable behavior

For the first slice, define the relevant input/output contract: defaults, empty
or invalid inputs, no-result behavior, update timing, identity, coordinate units,
and the owner of each resource. State which inputs are reactive or mutable and
how derived work becomes stale.

Define setup, updates, cancellation, failure, and teardown. A hook that attaches
an auxiliary output must remove it on unmount. Changing callbacks should not
needlessly remount persistent resources. Disposal must release owned resources
exactly once without assuming garbage-collection timing.

Caching must account for data, scales, accessors, and their dependencies. Stable
array or callback identity alone does not prove unchanged results. Explain
snapshot lifetimes and distinguish requested/application state from committed
rendered state where that distinction affects correctness.

Keep rendering, hit geometry, events, focus, clipping, and layout consistent with
current contracts. Do not introduce a second scheduler or an implicit retained
scene graph to support a convenience API.

## 9. Migrate the affected surface coherently

Existing poor signatures are migration candidates, not precedent. Within the
authorized change, update runtime exports, public types, internal consumers,
tests, learning examples, JSDoc, public documentation, editor declarations, and
packed consumers together as applicable.

The maintainer has repeatedly accepted breaking redesigns and removal of obsolete
aliases. Do not retain confusing compatibility names by habit, but do not treat
historical pre-release permission as blanket authorization to break unrelated
current APIs. Identify affected callers and honor any explicit compatibility
requirement. Preserve useful behavior while changing its authoring surface.

## 10. Prove usability and ship the documentation

Follow the root vertical-slice sequence: one focused failing public-API test,
then a runnable end-to-end slice with its exact Studio URL and inspection steps.
Get experiential feedback before the broader edge-case matrix and aggregate
verification. Internal tests can supplement public evidence.

Before feature completion, every new or changed public API needs:

- Linked JSDoc covering purpose, arguments/options, defaults, return values,
  errors, signal behavior, and lifecycle as applicable, including related types.
- Public reference documentation and a minimal runnable example showing the
  simplest complete use through supported imports; JSX and equivalent
  `createElement` authoring where applicable.
- A meaningful composition when relevant. Charts should have interpretable
  axes, labels, values, units, and realistic or attributed checked-in data.
  Visual effects should show ordinary reuse and interaction. Keep the focused
  teaching example separate from the showcase and exhaustive test fixture.
- Public type and runtime evidence, with export/declaration, Bundler/NodeNext,
  packed-consumer, editor, source/built browser, and tree-shaking checks
  proportional to the change.

State what reusable capability the demo adds. An impressive application composed
from existing APIs may be valuable without adding a new API; say so explicitly.

## Feedback provenance

These dated anchors make the synthesis auditable without copying entire private
conversations into the repository. Dates use America/Chicago. Thread IDs identify
the local source chats; topics below describe the feedback, not chat titles.

| Date          | Feedback topic and resulting guidance                                                                                                   | Source thread ID                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 2026-08-12    | Unfamiliar concepts, poor docs, verbosity, and ceremony impede adoption.                                                                | `019ff823-248d-7441-97f5-b93c63369725`                                         |
| 2026-08-17    | Familiar CSS-like terminology; reusable local styles rather than inheritance.                                                           | `01a010ac-3c0a-73b2-a946-07d3d094446a`                                         |
| 2026-09-13–14 | Shared scheduling, independently usable physics primitives, tree-shakable exports. Historical 3D scope has since been removed.          | `01a09ca3-ef64-7e51-8a20-9572f9fa49fa`                                         |
| 2026-09-14    | General utilities should not live on a particle namespace or take misleading particle names.                                            | `01a09bc0-4e3c-72f3-8a1c-7c55dd0a87c9`                                         |
| 2026-09-18    | External-renderer setup must be efficient, readable, explicit, reusable, and broadly applicable.                                        | `01a0b538-5fc0-7d51-b99f-c88e973fa793`                                         |
| 2026-09-23–24 | Composable visualization, shared signals, lazy nearest-data calculations, extension APIs. Older generic scale sketches were superseded. | `01a0cfe2-3d33-7622-b7b5-0ed7a4a3c0e6`                                         |
| 2026-09-30    | Semantic bar props; explicit cache invalidation beyond stable identities; breaking replacement acceptable for that work.                | `01a0f33c-937a-7243-9f1a-c724e0fd1249`                                         |
| 2026-10-05    | Sprite parser functions rather than string dispatch; lightweight, tree-shakable authoring.                                              | `01a10d2b-d0c0-7bc3-8237-695e94c310c4`                                         |
| 2026-10-05    | Separate selector-driven return contracts, but retain one animated-value API with supplied implementations.                             | `01a10e54-4b3a-76b3-806f-4f15be56fc9d`                                         |
| 2026-10-04–05 | Document every API with minimal examples; rename `track` to `drive` to express writing.                                                 | `01a108f5-640b-76d3-a07d-70a482129977`                                         |
| 2026-10-05    | Public JSDoc must link related types and explain arguments and returns.                                                                 | `01a10cc7-7204-7752-96fa-b91ccefcc8fd`                                         |
| 2026-10-06    | Target/options argument rules; `rangeDelta` rather than rendering-specific units.                                                       | `01a1121f-2633-74e1-8f43-689ae7cd2b96`                                         |
| 2026-10-06    | Auxiliary-output cleanup; direct context path when unused; pay only for used features.                                                  | `01a11245-cfe8-7dd2-aa26-10a1dfec0872`                                         |
| 2026-10-08    | Copyable TypeScript evidence for helper value; readable inspection strategies and defaults.                                             | `01a11cbc-39fe-75b1-8e37-35bef2afbc94`                                         |
| 2026-10-12    | Public API proposals first; flexibility and agent understandability; compelling realistic chart examples; reuse animation helpers.      | `01a12249-6a8c-70b0-9988-94a0c2d45184`                                         |
| 2026-10-12    | Typed named texture-palette keys instead of color indices.                                                                              | `01a1227a-168d-7150-818c-4518a8da3973`                                         |
| 2026-10-12    | Explain what public capability a showcase adds; prioritize reusable research-visualization APIs.                                        | `01a130ad-213f-7173-ba44-9da8f434c8e9`, `01a13160-b695-7ad3-be89-1315784eeafe` |

The rules above synthesize repeated feedback into reusable guidance. Domain
examples are applications of those rules, not mandates to resurrect removed
features or implement every suggested extension.
