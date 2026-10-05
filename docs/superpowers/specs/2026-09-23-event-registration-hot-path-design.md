# Event registration hot-path optimization design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> bounded optimization approved in conversation on 2026-09-23. Current shipped
> behavior remains governed by `docs/design/` and executable tests.

Date: 2026-09-23

## Goal

Reduce unchanged immediate-mode rerender time and allocation traffic by
removing repeated full event-definition scans, transient event-type sets, and
unchanged native-listener ownership reconciliation from every painted target.
Preserve every public event, focus, hit-test, ordering, pointer-capture, Layer,
and teardown contract.

## Profile evidence

Chrome DevTools Protocol CPU and allocation profiles were captured in separate
runs over 200 warmed sparse-1,000 rerenders. The same dominant stack appeared
in the existing performance laboratory and an equivalent uninstrumented Pibbl
mount.

For the uninstrumented mount:

- `usePaintTarget` accounted for 55.6% inclusive CPU time;
- `updateTargetRegistration` accounted for 35.5% inclusive CPU time;
- repeated `handledTypes` scans alone accounted for 12.3% self time;
- world-transform capture accounted for 21.5% inclusive time;
- Canvas `fill()` accounted for 1.3% self time; and
- the allocation sampler attributed the largest runtime allocation stacks to
  `renderPath`, `updateTargetRegistration`, their iterators, and transient
  `Set` instances.

The allocation profile estimates allocation traffic; it does not imply that
the sampled bytes remain live or constitute a retained-memory leak.

## Former cost

Before this change, `updateTarget()` performed the following work for every
target on every render:

1. scans every `PIBBL_EVENT_DEFINITIONS` entry to create normalized handlers;
2. scans every definition again to build a handled-type `Set`;
3. allocates and mutates another `Set` for required native types;
4. calls `updateTargetRegistration()`, which scans every definition a third
   time; and
5. iterates native ownership even when the required native type signature is
   unchanged.

The sparse-1,000 workload supplies one `onMouseMove` handler per target, so the
work is dominated by absent event properties and temporary collections.

## Selected design

### Terminology and representation

Pibbl has four related but distinct pieces of registration state:

| State                       | Meaning                                                                                | Used for                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Normalized handler object   | Current callback values under keys such as `mousemove` and `mousemoveCapture`          | Event propagation and latest-closure semantics                           |
| Logical handler mask pair   | Logical Pibbl event types for which at least one bubble or capture callback is present | Constant-time “does this registration have handlers?” checks             |
| Required native mask pair   | Native Canvas event types needed for those logical callbacks and optional cursor state | Desired root listener ownership                                          |
| Reconciled native mask pair | The last required signature processed for this registration                            | Constant-time unchanged-ownership detection and exact added/removed diff |

The masks are private transient runtime state. They are neither public values
nor serialized compatibility data.

`PIBBL_EVENT_DEFINITIONS` assigns each logical/native event type its in-memory
bit position. JavaScript bitwise operations coerce numbers to signed 32-bit
integers, so one number cannot represent all 52 current definitions. Every
signature is consequently stored as two words:

```ts
index < 32 ? { low: 1 << index, high: 0 } : { low: 0, high: 1 << (index - 32) };
```

Bit 31 can make a word numerically negative, but its sign has no semantic
meaning. Pibbl treats both numbers as opaque bit sets and only compares or
combines them using 32-bit operations. A module-load assertion rejects more
than 64 definitions instead of silently aliasing bit positions.

Bubble and capture props for one event have distinct normalized callback keys
but the same logical and native bits:

```text
onMouseMove         -> normalized key "mousemove"        -> logical bit 18
onMouseMoveCapture  -> normalized key "mousemoveCapture" -> logical bit 18
```

That distinction is intentional: propagation needs two callbacks, while
liveness and native ownership need only know that logical `mousemove` exists.

### Cold metadata construction

Module initialization builds a null-prototype `eventPropMetadata` table with
one entry for every supported bubble and capture prop. Each entry contains:

```ts
interface PibblEventPropMetadata {
  normalizedKey: PibblEventType | `${PibblEventType}Capture`;
  handlerTypesLow: number;
  handlerTypesHigh: number;
  requiredNativeTypesLow: number;
  requiredNativeTypesHigh: number;
}
```

The cold `expandNativeTypesForMetadata()` helper calculates the complete native
dependency closure once per logical type. This is where temporary `Set`s remain
appropriate because the work runs once when the module loads, not once per
target per frame.

The dependency closure preserves existing event semantics, including:

- pointer and mouse boundary events requiring movement and root-exit input;
- click, double-click, and auxiliary-click requiring down/up history;
- double-click additionally requiring click input;
- touch events requiring start/end/cancel ownership for retained contacts; and
- drag boundary/movement events requiring the corresponding terminal inputs.

Cursor tracking receives its own precomputed native mask because it requires
`mousemove` and `mouseout` even when no user callback is present. Legacy
already-normalized mouse handlers use a second null-prototype lookup that
points to the same metadata records.

### Hot-path normalization

Each render creates a fresh normalized callback object but visits only supplied
enumerable props:

```ts
for (const prop in handlers) {
  const metadata = eventPropMetadata[prop];
  if (!metadata) continue;

  const handler = handlers[prop];
  if (handler) {
    normalized[metadata.normalizedKey] = handler;
    handlerTypesLow |= metadata.handlerTypesLow;
    handlerTypesHigh |= metadata.handlerTypesHigh;
    requiredNativeTypesLow |= metadata.requiredNativeTypesLow;
    requiredNativeTypesHigh |= metadata.requiredNativeTypesHigh;
  }
}
```

The metadata lookup discards ordinary props such as `style` and `children`.
Direct assignment preserves distinct bubble/capture callback slots, while OR
operations naturally deduplicate logical types and shared native dependencies.
The required-native accumulators begin with the cursor mask when a cursor is
present.

The callback object must remain fresh even when both mask pairs are unchanged.
Masks represent type membership, not callback identity; reusing the old object
would retain stale render closures and violate event semantics.

For `P` supplied properties and `H` supported handlers, normalization is
`O(P)` lookups plus `O(H)` assignments. It does not scale with the total event
vocabulary and allocates no per-target `Set` or iterator.

### Stable native ownership

Every target/listener stores the desired native pair and the last reconciled
pair. The overwhelmingly common rerender case is two numeric comparisons:

```ts
if (previousLow === nextLow && previousHigh === nextHigh) return;
```

Callback closures can therefore refresh without touching root native-listener
reference counts.

When requirements change, Pibbl calculates exact set differences with Boolean
algebra:

```ts
removedLow = previousLow & ~nextLow;
removedHigh = previousHigh & ~nextHigh;

addedLow = nextLow & ~previousLow;
addedHigh = nextHigh & ~previousHigh;
```

For each difference word, Pibbl walks only its set bits:

```ts
const bit = word & -word; // isolate the lowest set bit
const index = 31 - Math.clz32(bit); // map it to definition index 0-31
word &= word - 1; // clear that bit
```

High-word indices add 32. This makes reconciliation
`O(removed types + added types)` rather than `O(all event definitions)`.
Removals run before additions. Each removed type executes and deletes its exact
release closure; each added type acquires one request from the shared native
listener hub. The hub continues to collapse all registration requests into one
actual Canvas listener per native type.

An `OffscreenCanvas` root has no native hub. Its registration still records the
reconciled signature, while naturally owning no release closures. Explicit
release or teardown resets the reconciled pair to zero, runs every retained
release closure once, and removes the registration's weak-map entry. Reviving
the same hook slot therefore observes a zero reconciled signature and reacquires
everything required by its current handlers.

### Worked examples

`onMouseMove` is logical definition 18. It needs native `mousemove` plus
`mouseout`, definition 20, so normalization produces:

```ts
handlerTypesLow = 1 << 18;
requiredNativeTypesLow = (1 << 18) | (1 << 20);
```

Replacing its callback next render changes the normalized function but leaves
both masks equal. Native reconciliation returns immediately.

`onClick` has one logical bit but requires native `click`, `mousedown`, and
`mouseup` bits. Adding `onDblClick` ORs in the `dblclick` bit and reuses the
already-set click/down/up prerequisites. Only the newly added native bit is
acquired.

### Why dispatch does not use the masks

Propagation still performs direct normalized property reads such as
`node.handlers.click` and `node.handlers.clickCapture`. Those reads are already
constant time and return the current callback. Consulting a mask first would
add work without avoiding the property lookup needed to invoke the function.

The masks therefore stop at registration liveness and native ownership. They
do not select targets, encode callback identity, determine capture/bubble
order, or replace normalized handler storage.

### Allocation and complexity summary

| Operation                         | Before                                         | After                                                  |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Discover supplied callbacks       | Probe every bubble/capture definition          | Iterate supplied props and perform one metadata lookup |
| Represent logical types           | Allocate/populate a `Set`                      | OR two integer words                                   |
| Expand native prerequisites       | Allocate/mutate another `Set` per registration | OR precomputed integer words                           |
| Detect unchanged native ownership | Iterate collections and compare membership     | Compare two number pairs                               |
| Reconcile changed ownership       | Iterate previous and next collections          | Walk only added/removed set bits                       |
| Dispatch callbacks                | Normalized object property lookup              | Unchanged                                              |

### Rejected alternatives

- **Keep `Set`s and cache them:** retains hashing, iterator, and object overhead
  and introduces cache ownership/invalidation into the hottest path.
- **One JavaScript number:** bitwise operators expose only 32 bits, so current
  events would alias.
- **`BigInt`:** one value could hold the vocabulary, but its operators are not
  the cheapest representation for this tight browser loop and would mix number
  domains.
- **Scan all definitions only when handlers change:** callback closures can
  change every render, so callback identity cannot safely identify type-set
  changes.
- **Encode callbacks in indexed arrays:** would make propagation and debugging
  less descriptive without removing the need to refresh callback references.

### Maintenance rules

When extending the event vocabulary:

1. add the definition to `PIBBL_EVENT_DEFINITIONS`; its position becomes its
   transient bit index for that loaded module;
2. keep the count at or below 64, or deliberately replace the two-word
   representation and its guard;
3. update `expandNativeTypesForMetadata()` when the new logical event requires
   native prerequisites beyond itself;
4. keep bubble and capture metadata on the same logical/native bits while
   retaining separate normalized keys;
5. never call the cold Set-based expansion helper from render/registration
   code; and
6. preserve release-before-acquire ordering, zeroing on teardown, and fresh
   normalized callback objects.

Bit positions may move between releases because masks never cross a module or
serialization boundary. Within one loaded runtime, every metadata lookup,
registration signature, and definition-index conversion must use the same
`PIBBL_EVENT_DEFINITIONS` ordering.

### Unchanged contracts

- Handler callbacks refresh every render even when their type mask is stable.
- Capture and bubble propagation keys remain the existing normalized strings.
- Source paint order continues to refresh through the existing Set ordering.
- Paths, transforms, clips, focus geometry, cursor state, and target liveness
  continue to update every render.
- Handler type additions/removals and cursor changes update native ownership in
  the same render.
- Legacy normalized handler adapters remain supported.
- No public exports or public types change.

## Evidence and measurement

Before production changes, a structural test must fail by showing that
normalizing one supplied handler reads absent event properties. After the
change it must read only enumerable supplied props while producing the same
normalized callback.

Correctness verification covers registration, propagation, event families,
focus defaults, pointer capture, Layers, lifecycle ownership, typecheck, lint,
and the full browser suite.

Performance is measured in separate processes:

1. ordinary Chromium timing runs for renderer median/p95/p99;
2. DevTools CPU profiles without allocation sampling; and
3. DevTools allocation-sampling profiles over the same 200 warmed renders.

Results compare three states where evidence is available:

- original pre-optimization Pibbl;
- current generation-reconciliation Pibbl; and
- event-mask/native-ownership Pibbl.

No performance budget will be weakened. The profiling hooks remain
environment-gated and do not run in normal tests.

## Implementation evidence

The implementation replaced the three per-target definition scans and two
transient event-type sets with supplied-prop iteration, precomputed metadata,
two-word logical/native masks, and an unchanged-ownership fast path. Callback
objects remain fresh on every render.

Three isolated Chromium timing runs reported sparse-1,000 render medians of
5.1, 5.4, and 4.9 ms, with p95 values of 6.6, 6.8, and 6.1 ms. The middle
result across runs is therefore 5.1 ms median and 6.6 ms p95. Compared with the
9.8/11.2 ms original and 8.7/9.6 ms generation-reconciliation measurements,
this is a 48.0% median reduction from original and a 41.4% reduction from the
generation-only state. The existing performance budget was not changed.
A final run with the unchanged guard enabled measured 4.9 ms median and 6.2 ms
p95, inside the renderer's 5/8 ms limits. The command still exited nonzero on
the independent sparse-100 dispatch guard (0.144 ms measured versus 0.100 ms),
which this renderer-registration change does not relax or claim to solve.

Allocation sampling ran separately over 200 warmed renders. Estimated traffic
was 1,824.2 MiB for original Pibbl, 1,759.1 MiB after generation reconciliation,
and 775.0, 785.7, and 781.2 MiB across three event-mask runs. The middle
event-mask result is 3.91 MiB per render, 57.2% below original and 55.6% below
the generation-only state. These figures describe extrapolated allocation
traffic, not retained heap.

The post-change CPU profile removed `handledTypes`, `requiredNativeTypes`, and
unchanged `updateNativeOwnership` from sampled hot work. Excluding scheduler
idle samples, the 200-render profile decreased from approximately 2,000 ms to
1,328 ms of active CPU time. The next largest target-registration cost is
transform and clipping capture; it remains a separate candidate rather than an
unprofiled addition to this slice.
