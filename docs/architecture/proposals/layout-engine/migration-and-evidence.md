# Yoga migration, capability targets, and evidence

Status: proposed, 2026-10-21. Nothing in this document is a claim that the new
engine exists or already outperforms Yoga. See the [research](./yoga-research.md),
[architecture](./design.md), [reactivity design](./reactivity.md), and
[integration plan](../../../project-plans/layout-engine-rework-proposal.md).

## Define the competitive claim precisely

The defensible target is: **a more complete, readable, and efficient layout and
reactivity integration for Canvas applications, with a standalone migration path
for framework authors.** It is not a claim to beat every Yoga workload, reproduce
all CSS, or automatically supply accessibility and editing.

There are three separate comparisons:

1. Kernel correctness and performance under equivalent normalized inputs.
2. JavaScript integration cost, including mutations, measurement, reads, and cleanup.
3. Complete Canvas application updates, including signal propagation, layout,
   rasterization, input geometry, and frame scheduling.

Report all three. A fast kernel can lose after serialization and host callbacks;
a well-integrated framework can win despite a slightly slower arithmetic loop.

## Capability acceptance matrix

`Parity` means the release must support the corresponding observable geometry
capability, with differences from pinned Yoga classified and explained. It does
not mean adopting every historical bug or exposing every native lifecycle method.
`Beyond` means an explicit Pibbl target beyond released Yoga 3.2.1. Development
Yoga is a second comparison lane, never silently substituted for that baseline.

| Capability                               | Current Pibbl                                   | Replacement target                                                       | Essential interaction evidence                                      |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Row/column, nowrap/wrap                  | Present                                         | Preserve                                                                 | Nested percentages, limits, text.                                   |
| Row/column reverse, wrap-reverse         | Missing                                         | Parity                                                                   | RTL × reverse × margin/align; source paint order unchanged.         |
| Grow/shrink/basis                        | Bounded subset                                  | Parity with specified iterative freezing                                 | Mixed freezes, fractional factors, zero bases, huge finite factors. |
| Main/cross distribution                  | Subset                                          | Parity plus precise start/end semantics                                  | Negative space, one item/line, auto cross sizes.                    |
| Min/max sizes                            | Present with restrictions                       | Full numeric/percentage and supported intrinsic rules                    | Definite/indefinite owner, opposing limits.                         |
| Automatic minimum size                   | Explicit min currently required in common cases | Native content-based auto minimum; compatibility policy                  | Unbreakable text, images, aspect ratio, overflow.                   |
| Nested intrinsic containers              | Strong restrictions                             | Full prepared Flex/Grid/Flow tree                                        | Shrink-to-content, nested wrapping, constraint feedback.            |
| Margin and auto margin                   | Missing                                         | Parity                                                                   | Negative margins, main/cross auto absorption, limits.               |
| Numeric gaps                             | Present                                         | Preserve                                                                 | Wrap and edge count, no outer gap.                                  |
| Percentage gaps                          | Missing                                         | Parity with classified intrinsic-cycle behavior                          | Definite and indefinite sizes; nested Grid/Flex.                    |
| Padding and layout borders               | Numeric padding; paint stroke separate          | Percentage/logical padding and explicit layout border                    | Box sizing, min/max, content measurements.                          |
| Box sizing                               | Content-box semantics                           | Content-box and border-box                                               | Declared dimensions, flex basis, limits, aspect ratio.              |
| Aspect ratio                             | Missing layout feature                          | Parity, documented native rules                                          | One/two definite axes, min/max, images.                             |
| Baselines                                | Missing                                         | Baseline providers, reference child, first/last baseline where supported | Mixed fonts, multiline text, nested containers.                     |
| RTL and logical edges                    | Missing layout feature                          | Parity for horizontal writing                                            | Logical/physical precedence, reverse, percentages.                  |
| Relative/static/absolute positioning     | Local offsets and dedicated Absolute            | Full containing-block model with migration                               | Padding, borders, no insets, opposite insets, nested static nodes.  |
| Explicit containing block                | No Yoga-style override                          | Equivalent capability for adapted trees                                  | Transformed and boxless ancestors.                                  |
| Hidden/contents participation            | No general Yoga equivalent                      | Parity geometry plus Pibbl lifecycle rules                               | Identity, events, clips, visibility changes.                        |
| Overflow sizing behavior                 | Visible/clip                                    | Preserve native clipping; model Yoga scroll-sizing policy in adapter     | Intrinsic sizes and auto minimums; no implied scrolling widget.     |
| Custom leaf measure                      | Present                                         | Constraints, invalidation, baselines, optional intrinsic queries         | Exact/at-most/unbounded; exception and callback count.              |
| Dirty/recalculate/output-change protocol | Repaint-oriented runtime                        | Incremental arena and changed geometry                                   | Same constraints + changed content, unchanged computed value.       |
| Point scale and text rounding            | Pibbl pixel policies differ                     | Explicit tested snapping policy and unrounded output                     | DPR, negative/fractional/large positions, nested edges.             |
| Grid explicit placement                  | Subset                                          | Beyond: complete declared target in design                               | Spans, intrinsic/fr/minmax tracks, percentages.                     |
| Grid implicit tracks/auto placement      | Missing                                         | Beyond                                                                   | Dense/sparse, auto-fill/fit, overflow, mixed explicit items.        |
| Intrinsic size vocabulary                | Restricted auto                                 | Beyond 3.2.1; compare current Yoga paths separately                      | min/max/fit-content and stretch under indefinite constraints.       |
| Source-order Canvas integration          | Present                                         | Preserve and strengthen                                                  | Hit order, focus, filters, Group, Layer.                            |
| Signal-aware input/measurement caching   | Existing ownership foundations                  | Beyond standalone Yoga integration                                       | All efficiency scenarios in reactivity design.                      |
| Deterministic application cleanup        | Present                                         | Preserve                                                                 | No GC-based pass criteria.                                          |
| Clone/persistent native tree APIs        | No public equivalent                            | Safe owned-tree snapshots initially                                      | Document API migration; no shared-node aliasing promise.            |
| Full CSS / vertical writing / subgrid    | Not supported                                   | Explicitly outside first release                                         | Published unsupported entries, no silent fallback.                  |

The proposed [capability manifest](./capability-manifest.json) records 33 target
capabilities, dependency gates, current evidence and unresolved policy choices.
It credits only the three pinned Yoga fixtures as current Yoga evidence. It is
a scope ledger, not a conformance score or acceptance of unresolved public APIs.
Expand each capability into property, legal value, algorithm, binding, default,
and interaction cases as its implementation slice becomes concrete. Every
supported entry needs positive and negative fixtures; every omission must remain
visible. A “100%” score is meaningless without its denominator.

## Two migration audiences

### Canvas framework developers who already have a renderer

They may want a better layout engine without adopting Pibbl's component runtime.
Offer an optional standalone `@pibbl/layout` once the internal core integration
has stabilized. It uses the same kernel and semantics. It does not import Canvas
rendering, require Pibbl signals, or create a scheduler.

Proposed API sketch, with one return contract per operation:

```ts
const tree = createLayoutTree();
const label = tree.createNode({
  style: { width: 120, height: 24 },
});
const root = tree.createNode({
  style: { flexDirection: "row", gap: 8 },
  children: [label],
});

tree.setStyle(label, { width: 160 });
const snapshot = tree.calculateLayout({
  root,
  width: 640,
  height: 480,
  direction: "ltr",
});
const box = snapshot.getBox(label);
for (const change of snapshot.changes) applyGeometry(change);
tree.dispose();
```

The sketch needs exact declarations before implementation, including owned
handles, style-patch removal, immutable snapshots, and error contracts. The
intended appeal is batched changes, bulk result access, Grid, diagnostics, and
deterministic ownership. The caller can keep its renderer, events, and scheduler.
Synchronous calculation may invoke registered synchronous measurement callbacks;
loading/prewarming is a separate operation with a fixed Promise result.

Do not claim this is a drop-in Yoga Node implementation. Native clone callbacks,
shared trees, configs, logger behavior, legacy errata, and JavaScript GC/manual-free
differences require explicit migration. A full setter-shaped compatibility shim
is justified only by real migration evidence; maintaining it indefinitely could
erase the API simplicity advantage.

### Application developers moving onto Pibbl

Their attraction is less framework plumbing: JSX or createElement, signal-valued
styles, automatic layout ownership, text measurement integration, events/focus,
and one frame scheduler. They should not recreate Yoga node trees alongside the
Pibbl element tree.

Illustrative equivalent intent, not a measured code-size result:

```ts
// Typical Yoga host integration responsibilities, abbreviated.
const root = Yoga.Node.create();
root.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
const sidebar = Yoga.Node.create();
sidebar.setWidth(240);
root.insertChild(sidebar, 0);
// Host owns subscriptions, measurement callbacks, applying geometry,
// painting, hit geometry, and the correct binding-specific cleanup.
```

```tsx
// Proposed Pibbl application composition.
const sidebarWidth = signal(240);
const app = (
  <Flex style={{ width: "100%", height: "100%" }}>
    <Flex style={{ width: sidebarWidth, flexShrink: 0 }}>
      <Text>Projects</Text>
    </Flex>
    <Flex style={{ flexGrow: 1, minWidth: 0 }}>
      <Text style={{ wrap: true }}>Workspace content</Text>
    </Flex>
  </Flex>
);
const controller = await pibbl(canvas, app);
// Ordinary signal updates schedule through Pibbl; controller.dispose() owns cleanup.
```

A real comparison must include the complete working implementations, including
initialization, measurement, resizing, events, and cleanup. Counting an abbreviated
Yoga example against a complete Pibbl example would be misleading.

## Mount loading migration

Accepted design, queued after the current receiver-input-role slice; these examples
are the target API, not a claim that the current experimental package exports it.
This intentionally changes the root mount result from controller to Promise.

```tsx
import { pibbl, prepareLayoutEngine } from "@pibbl/core";

// Optional: fetch and compile before the user opens the Canvas view.
await prepareLayoutEngine();
const lifetime = new AbortController();
const controller = await pibbl(canvas, app, { signal: lifetime.signal });
// Layout and subsequent signal-driven frames are synchronous as before.
controller.dispose();
```

```tsx
import { pibblSync } from "@pibbl/core/sync";

// Explicit synchronous host; embedded bytes are reachable only from this entry.
const controller = pibblSync(canvas, app);
controller.dispose();
```

The same calls accept `createElement` roots. Existing `return pibbl(...)` hosts
must become async and have their owners await the controller/cleanup, or explicitly
choose `pibblSync`. In particular, migrate Studio example launch/disposal together
so a navigation during loading aborts its pending mount rather than losing cleanup.
No new options object is required for the existing mount signature.

HTML preload may independently warm the emitted external asset's network cache
using `as="fetch"`, `type="application/wasm"` and matching CORS credentials. Use
the production build's emitted URL/base-path recipe; do not assume a dev URL or
that preload compiles the module. Programmatic prewarm uses the same loader and
compiled-module cache as `pibbl`. The sync entry reuses a ready compatible module
and otherwise compiles the same artifact synchronously.

Fetch/compile failure rejects before mounting; catch it and call again to retry.
Abort rejects only the pending mount with `AbortError`; prewarming and other
callers can finish. The newest valid, non-pre-aborted request for a canvas
supersedes pending predecessors across both entries. A cancelled pending update
leaves an existing mount alive. See the [full loading contract](./design.md#failure-retry-cancellation-and-competing-mounts)
for races, disposal and failure cleanup.

The loading slice must exercise these public examples through source and built
browser lanes and an isolated installed tarball. Check runtime/declaration
agreement with strict Bundler and NodeNext consumers; show async-only bundle input
metadata excludes the embedded module and emitted content excludes its Base64
payload, alongside external asset resolution and actual WASM execution. Compare
external and embedded fingerprints, inert imports, shared compilation and isolated
mutable mount state. Preserve earlier synchronous experimental receipts unchanged.

## Translation strategy

Add an optional migration package/tooling entry, separate from normal core imports.
Start with **data conversion and analysis**, not a second runtime. Proposed operations:

```ts
convertYoga32Style(style, { defaults, direction }); // ConvertedStyleResult
analyzeYoga32Tree(treeDescription, { config }); // MigrationReport
```

Both return a fixed record shape including diagnostics. Unsupported or ambiguous
behavior is an error by default for executable conversion; analysis still reports
every finding. A diagnostic includes node path, property, source policy, proposed
replacement, and whether geometry can change. Translation never quietly drops an
unsupported field.

Capture these inputs before conversion:

- Exact Yoga version and binding; useWebDefaults at node creation.
- Config errata/experiments and point scale; mixed configs within a tree.
- Explicit style values versus unspecified defaults.
- Measure/baseline providers, reference-baseline flags, and external content revisions.
- Containing-block overrides, direction, and assumptions about hidden/contents nodes.
- Whether the host already performs its own pixel rounding, clipping, and transforms.

| Yoga construct                   | Translation decision                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Default node                     | Emit explicit column/shrink-zero/align-content/border-box/relative defaults as applicable.                             |
| `UseWebDefaults`                 | Materialize the actual defaults; do not equate it with full CSS compatibility.                                         |
| Numeric `flex`                   | Expand from the pinned version's actual basis/grow/shrink behavior; never equate it with CSS shorthand by name.        |
| Edge enums                       | Convert to named edge fields preserving logical and axis/all precedence.                                               |
| `markDirty` for measured content | Advance the owned measurement revision; callbacks must not retain stale constraint-only caches.                        |
| `hasNewLayout` / mark seen       | Use changed snapshots/revisions; document acknowledgment semantics.                                                    |
| Point scale                      | Select the tested Yoga rounding policy or explicitly accept unrounded differences.                                     |
| Overflow scroll                  | Preserve its layout measurement policy; report that scrolling interaction remains the application's responsibility.    |
| Errata                           | Implement only explicitly tested necessary compatibility behaviors; reject others with a fixture and migration advice. |
| Node free/freeRecursive          | Replace with owned subtree removal or tree disposal; don't double-free or silently rely on GC.                         |
| Clones/shared descendants        | Import owned copies initially; flag identity/ownership differences.                                                    |

Maintain a narrow, versioned compatibility profile at the adapter boundary. Native
Pibbl semantics remain coherent. Avoid scattering legacy conditionals throughout
every public style definition. Where exact compatibility requires a solver branch,
name and test that branch with its removal/support policy. Do not promise complete
bug-for-bug parity; make intentional differences visible in the report.

### Migration proving application

Use one real Canvas application or a realistic reference application with a sidebar,
wrapped text, toolbar, RTL mode, nested panels, a Grid inspector, clipping, and an
external-renderer panel. Save the original Yoga implementation and fixtures.

First swap only the layout layer, keeping the renderer and measurement provider.
Then migrate a screen to Pibbl's component/signal surface. Compare geometry,
interactions, cleanup, code responsibilities, and full update timings separately.
This isolates engine migration from adopting a whole framework.

A migration is compelling if developers can explain the result, preserve behavior
with few manual exceptions, delete synchronization code, and obtain measurable
benefits. Record unsupported cases and time spent. Do not infer readability from
fewer characters or a favorable hand-picked snippet.

## Conformance harness

Maintain four independent oracle lanes:

1. Pibbl's current public behavior fixtures, separating preserved behavior from
   explicitly approved changes.
2. Pinned released Yoga 3.2.1 with explicit config, deterministic measurement, and
   native plus JavaScript/WASM checks where applicable.
3. Pinned development Yoga, labeled observational and never a moving CI dependency.
4. Native browser CSS fixtures and relevant specification assertions for behavior
   intended to match CSS; test Chromium first and WebKit/Firefox in the broader gate.

Store unrounded boxes and snapped/presentation boxes separately. Browser fixtures
must reset CSS defaults and use a controlled measurement provider/font. Compare
content/border boxes, margins, baseline, overflow, and containing blocks, not only
four integer coordinates. Store the specification rationale for every intentional
Yoga/browser disagreement. Browser consensus is evidence, not a substitute for
the selected semantic contract.

Use generated cases with stable seeds and shrinking/minimization. Cover interactions
such as RTL × reverse × auto margin, percentage × indefinite size, aspect ratio ×
min/max, display contents × absolute positioning, and text wrapping × flex shrink.
Require finite outputs, termination, deterministic replay, no negative extents,
cache-on/cache-off equivalence, and native/WASM equivalence within the declared
numeric representation. Do not assert conservation where deliberate overflow or
negative margins make it invalid.

Add ownership and failure tests for cancellation, invalid handles, invalid callback
results, memory ceilings, stale font completions, transaction abort, and disposal.
Use narrow visual assertions only after semantic geometry and lifecycle assertions.
Generated upstream fixtures retain required copyright/license notices.

## Performance experiments

Publish raw results and reproduction instructions, not a single “× faster” number.
Pin artifacts, compilers, browser versions, hardware, OS, power mode, DPR, fonts,
source revision, and comparison configuration. Separate native and browser/WASM
results. Run both engines in the same harness with the same content and renderer.

| Workload              | Sizes/mutations                                      | Measure                                                                                |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Cold use              | Fresh page/module, small and large first tree        | Download, decompression, compilation, instantiation, first layout, first useful paint. |
| Construction/disposal | 10, 100, 1,000, 10,000 nodes                         | JS allocations, transfer bytes, node memory, setup/teardown time.                      |
| Steady state          | No changes; equal computed results                   | Scheduler, bindings, solver visits, paints; expected avoidable work is zero.           |
| Paint only            | Color/opacity/filter updates                         | Zero solver/measurement work; actual repaint/composite cost.                           |
| Local layout change   | One width/margin/basis update                        | Dependency-cone size, callbacks, layout/apply/paint p50/p95/p99.                       |
| Intrinsic cascade     | Text change, font load, shrink and wrap              | Final correctness, measurement count, full frame latency.                              |
| Wide/deep stress      | Wide lines, deep nesting, mixed Grid/Flex            | Stack safety, iteration counts, memory, worst supported size.                          |
| Animation             | Width animation and translation animation separately | Frame intervals, missed frames, main-thread time, energy proxy where available.        |
| Layers                | Placement vs size vs content changes                 | Bitmap reuse, resize count, raster and composition time.                               |
| Churn                 | Keyed inserts/removes/reorders, repeated roots       | Live counts return to baseline; capacity stabilizes under bounded workloads.           |

Use warmup and repeated independent runs, report uncertainty and tail distributions,
and include slow devices. Randomize contender order. Distinguish latency per UI
update from throughput of many tight-loop layouts. Include transfer and result-read
cost in integration measurements. Do not compare Yoga with caches disabled to
Pibbl with caches enabled unless that is a separately labeled diagnostic lane.

### Proposed release gates, not measured achievements

- Correctness/ownership: zero unresolved failures in the declared release capability
  manifest, zero nontermination cases, and zero active resource leaks in deterministic
  lifecycle tests. Every excluded fixture has a published reason.
- Reactive efficiency: all structural zero-work requirements in the reactivity
  design pass; no second scheduler; no stale geometry frame in the reference app.
- Performance: no statistically established material regression in the agreed
  common small/medium workloads, and a demonstrated benefit in at least the
  targeted reactive/text/Grid integration workloads. Report any tradeoff openly.
- Working initial budget for controlled desktop runs: investigate >10% regression
  in p95 total update latency, >10% memory regression for equal capabilities, or
  more than 5 ms synchronous cold initialization through `pibblSync`. Record async
  fetch/compile latency and warm prepared-mount cost separately. These are
  investigation thresholds, not universal guarantees; calibrate and preregister
  final budgets after baseline data.
- Size: record compressed and uncompressed JS/WASM bytes for drawing-only, Flex,
  and Grid consumers. Set the final budget from the first artifact and target-device
  startup measurement. Do not invent a byte target without an implementation.
- Readability/migration: at least two migration exercises, one framework-level and
  one application-level, with retained code, issue counts, and maintainers' feedback.

A 60 Hz frame has approximately 16.7 ms for **all** work; layout must not spend that
entire budget. Set per-reference-app budgets after measuring its render and input
costs. Controlled timing gates remain opt-in, matching repository policy; stable
structural counters belong in normal CI.

## Publishable receipts

Each release report should include a versioned capability manifest, complete fixture
results, intentional divergence ledger, native/WASM equivalence results, resource
counts, benchmark raw data and scripts, consumer bundle measurements, and runnable
migration examples. Studio should expose a diagnostic view showing why a node was
remeasured or relaid out and how much work an update caused.

Until those artifacts exist, use “designed to,” “target,” and “proposed.” Afterward,
make narrow claims such as “zero layout work for paint-only signal updates in these
scenarios” or “lower p95 update latency on this workload and hardware.” The ambition
can be broad; the evidence must remain specific.

## Implemented baseline profile and reference-child boundary — 2026-10-28

The current implemented baseline contract is in
[the layout contract](../../../design/layout-system-contract.md). Pibbl selects
declared first/last in-flow sources for prepared known roots and supports the
finite first/last provider/Canvas Text profile; this does not import Yoga node
flags. The version-bound reference-child probe and exact output are recorded in
[the rehearsal](../../../../tooling/layout-yoga-rehearsal/README.md#reference-child-migration-classification-consolidation74).
Yoga3.2.1's explicit `isReferenceBaseline` flag overrides default source selection.
It is currently an unsupported migration input: a future versioned converter
must diagnose/reject it or supply an explicitly designed translation. Silently
ignoring it or mapping it to last-baseline would alter geometry. The original
reference-child migration target remains classified here; the migration gate and
conversion API work stay open. The current Pibbl baseline profile must not be
advertised as general Yoga/CSS baseline compatibility.
