# Yoga research for the Pibbl layout rework

Status: research, 2026-10-21. This is not a shipped Pibbl contract or an approval
to implement. Start with the [integration proposal](../../../project-plans/layout-engine-rework-proposal.md).

## Baselines and method

The comparison deliberately separates released Yoga from its development branch.
GitHub's latest-release endpoint identified **3.2.1**, published 2024-12-13, at
[`042f5013152eb81c1552dec945b88f7b95ca350f`](https://github.com/react/yoga/tree/042f5013152eb81c1552dec945b88f7b95ca350f).
The inspected development snapshot is
[`843dba8619420992e492bbb4b3d2f63d9ad6c683`](https://github.com/react/yoga/tree/843dba8619420992e492bbb4b3d2f63d9ad6c683).
These identifiers, rather than a moving `main` URL, define the observations below.
Recheck releases when implementation starts; a development feature is not a
published-package promise.

Pibbl's inspected baseline is `dd39ce2036d0e4f9323e032ed48793453244d7ef`, including
current public types, layout implementations, tests, signal graph, scheduler,
render traversal, measurement, and lifecycle contracts. Existing unrelated local
edits were left untouched. Research used a separate read-only-purpose Yoga checkout
under `/private/tmp`; no Yoga dependency was added to Pibbl.

The primary evidence is source inspection. This is **not** a comparative benchmark
or a certification of either engine. The small native probe described below is a
characterization of the development snapshot only.

## What Yoga actually contains

Yoga is a layout library, not a Canvas framework. Its core is C++, exposed through
a C ABI and language bindings. A framework supplies a tree, style, constraints,
and optional leaf measurement. Yoga computes geometry; the framework applies it
to rendering and input. Text shaping, line breaking, scrolling interaction,
accessibility, animation scheduling, and application component evaluation remain
outside this core.

| Area            | Inspected implementation                                                                                                | Consequence for Pibbl                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Node            | Style, layout results, parent/children, callbacks, dirty state, context                                                 | Persistent layout records are useful even with immediate Canvas painting.                                           |
| Style           | Typed enums and lengths; compact value handles and a small value pool                                                   | Data representation, allocation, and transfer matter alongside solver speed.                                        |
| Solver          | Flex basis, line collection, flexible-length resolution, cross sizing/alignment, final dimensions, absolute descendants | This is a staged recursive algorithm with repeated constrained measurement, not a single distribute-space function. |
| Cache           | Layout result plus a bounded measurement cache, generation/config/direction checks                                      | A dirty bit alone cannot establish cache validity.                                                                  |
| Geometry output | Positions, dimensions, edges, overflow, new-layout indication                                                           | Separate the need to solve from the need to apply or paint a changed result.                                        |
| Configuration   | Defaults, point scale, experiments, errata, logging, clone callback                                                     | Pin policy in migration fixtures; “Yoga behavior” is not one configuration.                                         |
| Bindings        | Native ownership plus binding-specific wrappers and callback bridges                                                    | Binding overhead and ownership must be benchmarked independently of C++ arithmetic.                                 |

Primary source map: [Node](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/node/Node.h),
[Style](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/style/Style.h),
[style pool](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/style/StyleValuePool.h),
[layout results](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/node/LayoutResults.h),
[configuration](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/config/Config.h).

## Lifecycle and ownership

### Native lifecycle

1. Create configuration and nodes. A node refers to its configuration; callers
   must honor that lifetime.
2. Attach children. A normal child has one owner; measured leaves cannot also
   contain children. Style and tree mutations propagate dirtiness.
3. Attach measurement/baseline/context callbacks as required.
4. Calculate using root constraints and direction. Cache checks decide whether
   a node needs measurement, layout, or neither.
5. Read geometry. Consumers can acknowledge `hasNewLayout` after applying it.
6. Dirty a measured leaf when external content changes. Reusing identical numeric
   constraints does not make changed text or a newly loaded font equivalent.
7. Detach/free nodes and finally their configuration. Recursive free observes
   ownership; shared descendants in cloning workflows are not simply all deleted.

Yoga also supports shallow cloning and clone-on-write children for persistent
tree integrations. This is more than Pibbl needs for its first implementation.
Pibbl should initially have one deterministic owner per layout node and a staged
mutation transaction, without adding public shared mutable layout trees.

Sources: [native node API](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/YGNode.cpp),
[node implementation](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/node/Node.cpp).

### JavaScript lifecycle differs across baselines

Released 3.2.1 exposes manual `free`, `freeRecursive`, and destroy methods in its
[binding](https://github.com/react/yoga/blob/042f5013152eb81c1552dec945b88f7b95ca350f/javascript/src/wrapAssembly.ts).
The inspected development binding instead maintains JavaScript topology and uses
`FinalizationRegistry` for native cleanup. It calls the C ABI directly; it no
longer exposes the same manual-free interface. This is an unreleased change,
not grounds to tell existing Yoga users they already have automatic cleanup.

Pibbl should preserve deterministic release at component removal/root disposal.
A finalizer may detect leaks in development; it must not be required for releasing
node slots, subscriptions, measurement callbacks, or scheduled work. Disposal of
live allocations and shrinking a WASM memory buffer are different claims.

Source: [development binding](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/javascript/src/wrapAssembly.ts).

## Measurement and algorithm details

Yoga's external measurement receives constraints with exact, at-most, or undefined
modes. Padding and border have already been removed for content measurement.
Definite dimensions can avoid the callback. The callback result is not the final
allocated box; framework code must read the layout result. Content changes require
invalidation. [External measurement documentation](https://www.yogalayout.dev/docs/advanced/external-layout-systems).

The development source additionally has min-content measurement/cache machinery,
intrinsic size values, and an automatic minimum-size path. Its default config
enables `MinSizeUndefinedInsteadOfAuto`, so the existence of that path does **not**
mean every default node uses CSS automatic minimum sizing. Capture errata and
experiments alongside every differential test.

Flexible length resolution still explicitly describes a **two-pass approximation**
to the CSS iterative freeze algorithm in the inspected development source.
Pibbl can target the specified repeated-freezing behavior, with progress checks
and numerical bounds. Matching Yoga on all inputs and correcting its intentional
deviations are distinct goals; discrepancies need classification, not blanket
suppression. [Flexible-length solver](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/algorithm/CalculateLayout.cpp#L1414).

Baseline alignment has its own traversal and fallback rules. Absolute layout
has its own containing-block, edge, padding, direction, and aspect-ratio behavior.
Neither can be implemented reliably as a final translation of already laid-out
children. [Baseline](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/algorithm/Baseline.cpp),
[absolute layout](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/algorithm/AbsoluteLayout.cpp).

The cache distinguishes layout from measurement and stores up to eight measurement
entries per node in this snapshot. Reuse checks include constraint compatibility;
layout validation also considers configuration, owner direction, and relevant
owner dimensions. Pibbl needs content/font revisions and responsive-query inputs
in addition to equivalent checks. [Cache](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/algorithm/Cache.cpp),
[incremental layout documentation](https://www.yogalayout.dev/docs/advanced/incremental-layout).

Pixel rounding is a separate traversal. It accounts for absolute edges and treats
text specially to avoid clipping from rounding down. The development code uses
double intermediates in rounding but still returns float dimensions. Pibbl should
retain unrounded logical geometry and make snapping an explicit policy; it should
not accumulate rounding independently at every nested local origin.
[Pixel grid implementation](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/yoga/algorithm/PixelGrid.cpp).

### A binding risk worth learning from

The development WASM bridge stores a measurement result on the JavaScript callback
function and keys it by constraints. The inspected `markDirty()` wrapper calls the
native invalidator without clearing that JavaScript cache. This presents a
source-level stale-content risk when the same callback and constraints survive
a content change; it is **not presented as a reproduced published Yoga bug**.
Validate with the actual built binding before reporting it upstream. Pibbl's
design explicitly keys measurement caches by content revision and scopes any
width/height pair reuse to one measurement request.
[Bridge](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/javascript/src/wasm_bridge.c#L85).

## Feature baseline and important distinctions

Yoga 3.2 added content-box sizing as an option and `display: contents`; border-box
remains the default even with web defaults enabled. Yoga also supports reverse
axes, wrap-reverse, margins including auto, baseline alignment, direction-aware
edges, aspect ratio, and percentage gaps. Pibbl currently lacks several of those
behaviors. [3.2 release explanation](https://www.yogalayout.dev/blog/announcing-yoga-3.2),
[released style API](https://github.com/react/yoga/blob/042f5013152eb81c1552dec945b88f7b95ca350f/yoga/YGNodeStyle.h).

The inspected development tree contains Grid style types and public setters.
However, its main layout entry still dispatches through the Flex algorithm and
there is no Grid solver in the inspected algorithm directory. Do not count API
scaffolding as working Grid layout. The native probe below checks this distinction.

Yoga's vocabulary is CSS-like, not complete CSS: default direction is column,
shrink is zero, align-content is flex-start, and position is relative. Web defaults
change some of these but not every default. Logical edge precedence and the
numeric `flex` shorthand also need explicit translation. Pibbl should preserve
familiar property names while publishing its own exact semantics.
[Styling documentation](https://www.yogalayout.dev/docs/styling/).

### Native characterization executed for this report

On 2026-10-21, a standalone C++20 probe compiled all `yoga/**/*.cpp` files from
the pinned development checkout with Apple clang 21.0.0, `-O2`, and no test
framework. Compilation and execution succeeded. It created a default config,
disabled pixel rounding, created a 200×100 root with `display: grid`, assigned two
100-point template columns, and inserted two 20×20 children. It then calculated
LTR layout and freed the tree/configuration.

Observed output:

```text
default_errata=24 default_direction=0 shrink=0
grid_a=(0,0) grid_b=(0,20)
```

The children stacked in the default column direction, rather than occupying the
declared two-column grid. This corroborates the missing Grid dispatch for this
case. It does not establish behavior for every Grid property or any future
release. The errata value corresponds to the two default flags in this snapshot.
This was a native correctness probe, **not WASM performance evidence**.

## Tests and benchmarks: lessons and limits

Yoga generates expected geometry from HTML fixtures rendered in Chrome, emitting
tests for multiple bindings. The inspected generator captures LTR/RTL geometry
and rounds coordinates/edges to integers. This is valuable differential coverage,
but it is not sufficient evidence for fractional geometry, all browsers, callback
ownership, or a Canvas frame pipeline.
[Fixture capture](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/gentest/src/buildLayoutTree.ts),
[browser pool](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/gentest/src/ChromePool.ts).

The development tests include focused cases for auto minimums, frozen shrink
items, measurement caching, relayout, cloning, tree mutation, contents nodes,
and rounding at large offsets. That interaction coverage is more significant
than counting style fields. [Test directory](https://github.com/react/yoga/tree/843dba8619420992e492bbb4b3d2f63d9ad6c683/tests).

The inspected JavaScript benchmark builds trees in its measured workload and
reports averages over repeated scenarios. It does not establish Canvas input
latency, tail latency, initial WASM cost, or a direct comparison with Pibbl's
reactive updates. Benchmark those separately and keep construction inside or
outside the measured interval consistently for both contenders.
[JavaScript benchmark](https://github.com/react/yoga/blob/843dba8619420992e492bbb4b3d2f63d9ad6c683/javascript/tests/Benchmarks/YGBenchmark.test.ts).

## Pibbl findings that shape the replacement

Current [Flex](../../../../packages/core/src/lib/layout/flex.ts) already has
iterative min/max redistribution, grow/shrink, wrapping, alignment, and finite-box
validation. It is a deliberately bounded implementation, not an empty starting
point. Its principal architectural limitation is restricted intrinsic measurement
of nested structures, together with local immediate placement.

Two focused reproductions earlier in this review exposed correctness risks:

- Cross-axis measurement can use the pre-flex width. Two wrapped text children
  with basis 100 in a 100-wide row each end at width 50, while retaining a height
  measured at width 100. Under deterministic test metrics the allocated height
  was 20 instead of the width-50 measurement's 40. The new solver must remeasure
  width-dependent height after main-axis allocation.
- Two width-80 children with `flexShrink: 1e308` in a width-100 row overflow the
  scaled-factor arithmetic. NaN prevents progress in the redistribution loop;
  the isolated process was terminated after three seconds. Finite input validation
  alone does not ensure finite intermediate arithmetic or termination.

Those are review reproductions, not newly committed regression tests. The earlier
focused browser run passed 75 tests across Flex, JSX layout, CSS compatibility,
and positioning diagnostics; it did not cover these reproductions. Environment:
Node 26.9.0, pnpm 11.21.0, Vitest 4.1.10/Chromium. That Node version differs from
the documented Node 24 LTS verification environment; this is not an aggregate
trust-gate result.

Other integration evidence:

- [Render traversal](../../../../packages/core/src/lib/render.ts) executes ordinary
  functions inside their actual Canvas context. Pre-executing arbitrary components
  would break direct drawing, hooks, and `useLayoutBox()`.
- [Receiver provisions](../../../../packages/core/src/lib/signals/input-provision.ts)
  already preserve signal ownership when parents inspect child inputs.
- [Signal consumers](../../../../packages/core/src/lib/signals/render-consumer.ts)
  lazily allocate subscriptions. The replacement must retain the plain-value fast
  path instead of allocating reactive wrappers for every property.
- [Text geometry](../../../design/text-geometry-contract.md) already demonstrates
  optional WASM, explicit ownership, and copied public results. HarfBuzz shaping
  is not a paragraph layout, bidi, font-fallback, or line-breaking implementation.

## Build versus reuse

Recommended architecture: a Pibbl-owned layout protocol, arena, reactive integration,
and public style contract, implemented primarily in Rust/WASM. **Owning those
boundaries does not require inventing every mature algorithm again.**

| Option                                        | Strength                                                              | Cost/risk                                                                                        | Recommendation                                                             |
| --------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Wrap Yoga                                     | Fastest route to much released behavior                               | Yoga semantics, callback bridge, and release policies become dependencies; Grid remains separate | Keep as an oracle and migration baseline.                                  |
| Fork Yoga                                     | Familiar code and corpus; control fixes                               | C++ fork maintenance plus custom reactive integration; not inherently faster                     | Reject as default; reconsider only on measured delivery advantage.         |
| Fresh Rust kernel                             | Full control over memory, diagnostics, numerical policy, and batching | Largest algorithm/conformance maintenance burden                                                 | Preferred ownership model, but validate algorithm reuse first.             |
| Rust kernel using Taffy algorithms internally | Existing Flex/Grid/Block algorithms and a low-level tree interface    | Need exact semantic, numeric, measurement, version, and footprint audit                          | Mandatory bounded feasibility comparison before locking solver provenance. |
| AssemblyScript kernel                         | Existing Pibbl toolchain and familiar language                        | Still needs the algorithms, memory discipline, conformance, and host bridge                      | Credible fallback if Rust has no measured advantage.                       |

Taffy 0.15.0 documents a low-level interface for embedding algorithms in a
framework-owned tree, separate from its higher-level `TaffyTree`. This is relevant
to avoiding a redundant tree. This research did not perform a Taffy source audit
or certify its behavior. The feasibility slice must pin and inspect it before
selecting it. [Taffy architecture](https://docs.rs/taffy/0.15.0/taffy/),
[repository and license](https://github.com/DioxusLabs/taffy).

No option earns a speed claim merely by compiling to WASM. The expected advantage
comes from less work, fewer boundary crossings, compact persistent data, and
correct cache invalidation, followed by efficient arithmetic.
