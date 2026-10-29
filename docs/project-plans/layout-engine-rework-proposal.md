# Pibbl layout engine rework: design and integration proposal

Status: **proposal for review**, 2026-10-21. The user requested deep research,
designs, and an integration plan, including tight integration with Pibbl reactivity.
This document does not authorize implementation, replace the active numbered
plans, or describe shipped behavior. No production code was changed for this work.

## Recommendation

Build a Pibbl-owned layout system whose numeric graph and algorithms run primarily
in Rust/WASM, integrated directly with existing signals, computed values, receiver
ownership, and the realm scheduler. Preserve Pibbl's JSX/createElement authoring,
source-order immediate Canvas painting, and deterministic resource ownership.

Use Yoga as a versioned compatibility oracle and migration baseline. Do not make
Yoga a required runtime. Before committing to a completely fresh solver, compare
internal reuse of Taffy's low-level Rust algorithms against a small native Pibbl
kernel. Pibbl's value is its semantics, integration, reliability, and authoring;
reimplementing every algorithm is not itself a product advantage.

The intended advantage is **less work per application update**: direct signal
bindings, unchanged-value suppression, persistent layout nodes, precise measurement
invalidation, batched WASM transfers, and geometry that stays consistent with
Canvas, Layers, events, and focus in the same frame. WASM alone proves none of this.

## Design package

| Document                                                                                    | Contents                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Yoga research](../architecture/proposals/layout-engine/yoga-research.md)                   | Pinned release/development baselines, architecture, lifecycle, caching, binding changes, tests, risks, source citations, and native characterization. |
| [Architecture and public surface](../architecture/proposals/layout-engine/design.md)        | Kernel boundaries, semantics, intrinsic layout, component preparation, ABI, measurement, loading, ownership, and adjacent-system integration.         |
| [Reactive integration](../architecture/proposals/layout-engine/reactivity.md)               | Receiver input roles, dependency propagation, cache validity, scheduler ordering, Layers, transactions, failure, and efficiency gates.                |
| [Migration and evidence](../architecture/proposals/layout-engine/migration-and-evidence.md) | Capability matrix, standalone adoption, Yoga translation, reference applications, conformance, benchmarks, and publishable receipts.                  |

## Findings that materially affect the decision

- Released Yoga 3.2.1 and current Yoga source are different targets. Development
  Yoga has more intrinsic sizing machinery and a different JS cleanup model.
  Its new Grid style surface does not yet imply an implemented Grid solver in
  the inspected snapshot. The research includes a native reproduction.
- Pibbl already has valuable ownership and reactive foundations. Replacing the
  graph/scheduler would discard those advantages and introduce duplicate systems.
- Nested intrinsic layout requires preparing declarative layout structure before
  painting. Arbitrary ordinary components can draw directly and read their final
  allocation; they cannot safely be executed speculatively to discover children.
- Parent allocation must settle before a dependent Layer or external renderer
  rasterizes. The current eager deepest-first render scheduling needs a carefully
  tested dependency-order amendment.
- Pibbl's current Flex review exposed width-dependent cross-size and numerical
  termination risks. These should become regression contracts before replacement
  work can hide or reproduce them.
- A standalone layout package is important for migration: a team with an existing
  Canvas framework may adopt the engine without wanting an entire new framework.

## Scope and decision register

These are recommended decisions for review, not silently accepted API changes.
The first implementation slice should resolve only decisions needed to make that
slice runnable; later signatures can be refined at their delivery boundary.

| Decision               | Recommendation                                                                  | Why / remaining validation                                                  |
| ---------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Engine ownership       | Pibbl-owned protocol and arena; no Yoga runtime                                 | Independent semantics and reactive lifecycle.                               |
| Kernel language        | Rust/WASM                                                                       | Existing toolchain and explicit storage; validate artifact/bridge costs.    |
| Algorithm provenance   | Evaluate Taffy low-level reuse before choosing fresh implementation             | Reduces maintenance risk if semantics, precision, and footprint fit.        |
| Numeric representation | f64 initially                                                                   | Match JS logical coordinates; measure cost and audit any f32 dependency.    |
| State model            | Retain numeric layout data, not draw commands                                   | Enables incremental solving without a retained renderer.                    |
| Reactivity             | Extend existing receiver consumers with input roles                             | No duplicate subscriptions or scheduler.                                    |
| Component preparation  | Built-in descriptions plus explicit pure structural capability                  | Avoid double-running arbitrary components.                                  |
| Defaults               | Preserve Pibbl row/shrink-one/content-box; add specified auto minimum           | Familiar authoring, explicit migration for geometry changes.                |
| Compatibility          | Versioned Yoga conversion/profile with explicit divergences                     | Easy migration without permanently confusing native semantics.              |
| First kernel packaging | Private core integration                                                        | Avoid freezing a standalone API prematurely.                                |
| Eventual package       | Optional `@pibbl/layout` using the same kernel                                  | Adoptable by existing Canvas frameworks.                                    |
| Loading                | Accepted: async `pibbl`, separate embedded `@pibbl/core/sync`, optional prewarm | Breaking return type; shared compiled module, isolated mount state.         |
| Measurement bridge     | Synchronous cache-miss callbacks first; benchmark resumable batching            | First slice stays small; optimization must reduce real work.                |
| Workers                | Deferred                                                                        | Browser measurement and scheduler semantics need a separate latency design. |
| Grid                   | Meaningful auto-placement/intrinsic-track target after Flex/reactive foundation | Concrete capability beyond released Yoga.                                   |
| Compatibility release  | Coordinated breaking change where geometry contracts differ                     | Current 0.x version does not excuse undocumented behavioral changes.        |

## Accepted loading amendment — 2026-10-21

The accepted decision supersedes the original loading recommendation:
`pibbl(...): Promise<PibblController>` fetches/compiles the external WASM before
mounting; `pibblSync(...): PibblController` from `@pibbl/core/sync` uses the same
binary embedded separately. `prepareLayoutEngine(): Promise<void>` remains a
programmatic prewarm; HTML preload can warm the network cache independently.
Async-only bundles must exclude embedded bytes. Deduplicate initialization and
share compatible compiled modules, while keeping mount mutable state isolated.
Layout, measurement, signals and frame execution remain synchronous.

The [architecture](../architecture/proposals/layout-engine/design.md#packaging-and-initialization)
defines exact signatures, retries, per-caller cancellation and newest-request
same-canvas arbitration. This is an intentional breaking migration across affected
consumers, not an optional loading selector. Authorization is for this design
amendment; finish the current receiver-input-role slice first. Then implement the
[focused loading slice](010-layout-engine-rework.md#queued-loading-migration-after-slice-26)
with source, built, installed-tarball and async-bundle exclusion evidence. Preserve
historical implementation receipts as evidence of their original behavior.

## Delivery sequence

This is an ordered proposal, not a new active execution queue. On authorization,
create the appropriate numbered plan and select exactly one next step. Each slice
must become runnable through public APIs and receive hands-on feedback before
its broad hardening, documentation polish, and aggregate verification.

### 0. Capture the current contract and the smallest baseline

**Outcome:** the first replacement has an observable target and honest comparison.

- Pin current Pibbl/Yoga sources, package versions, configuration, browser, and
  deterministic text metrics. Preserve existing unrelated changes.
- Add focused failing public-API regressions for final-width text measurement and
  large-factor termination. Keep them isolated from unrelated feature work.
- Decide whether to fix those defects in the current engine immediately or carry
  the tests into the replacement branch; prefer small current fixes when practical.
- Capture one public reference scenario with nested Flex, a signal-controlled width,
  and wrapped text. Record geometry and existing frame/ownership counters.
- Perform a bounded solver-provenance check: inspect a pinned Taffy version, compile
  the minimum native/WASM bridge, and compare that one workload with a small owned
  kernel. Do not build a large benchmark platform first.

**Exit:** reproducible geometry/termination contracts, a basic cost breakdown, and
an explicit algorithm/toolchain decision with reasons. No speed claim yet.

### 1. First WASM vertical slice

**Outcome:** one supported `Flex` scenario lays out through WASM and responds to a
normal Pibbl signal in the existing scheduler.

- Use an experimental build of the same public `Flex` surface, not an application
  `engine: 'wasm'` selector or a second component family.
- Implement only the required bounded row/column allocation, measured Text leaf,
  final-width remeasurement, numeric transfer, and deterministic arena disposal.
- Keep identity mapping minimal but real. One input patch changes width without
  rebuilding every unchanged node. Use synchronous host measurement initially.
- Add one diagnostic counter panel to the public scenario: solves, measured leaves,
  node reuse, frame count. Paint-only control must demonstrate no unnecessary solve.
- Keep unsupported experimental cases explicit. Use separate build/test lanes for
  old and new engines; do not silently switch algorithms midway through a solve.

**Slice ready for feedback:** focused public test passes, scenario runs in Studio,
and the implementation report supplies the exact live URL and what to resize or
change. This plan cannot give a live URL before implementation exists.

**Then harden:** same-scenario headless coverage, abort/dispose counts, numeric
limits, source/built consumer smoke, and first cold/warm timings.

**Stop/reconsider:** if bridge/loading cost overwhelms useful small layouts or
correct measurement requires repeated full-tree restarts, revise that boundary
before building more algorithms.

### 2. Reactive bindings and incremental layout

**Outcome:** changes are classified and normalized before causing layout work.

- Extend existing receiver consumers/edges with input-role metadata and staged
  provision adoption. Preserve lazy allocation for plain values.
- Wire pending input resolution into Plan after computed validation. Distinguish
  structure, layout, measurement, paint, transform, and interaction invalidation.
- Add persistent node/style/topology/content/geometry revisions and compatible
  measurement/layout cache keys. Implement conservative dependency propagation
  first, then precise stopping rules with evidence.
- Demonstrate one interactive scenario that switches dynamic computed dependencies,
  animates width, changes text, and changes fill independently.

**Exit after feedback/hardening:** equal computed values cause zero solves/paints;
paint-only updates cause zero measurements/layout visits; batches coalesce; keyed
updates reuse nodes; removals detach subscriptions; text changes with equal measured
size still repaint. Report both counters and timings.

### 3. Prepared nested structure and lifecycle integration

**Outcome:** reusable intrinsic containers work without speculative rendering or
stale Layer sizes.

- Prepare nested built-in layout descriptors and measured leaves. Prototype the
  pure structural component capability with a real reusable Card.
- Preserve opaque ordinary components, hook ordering, source paint order,
  `useLayoutBox()`, fragments, and current identity rules.
- Add allocation dependencies to Layer/external-renderer scheduling, including
  deferred raster at opaque boundaries once the final allocation is known.
- Integrate staged geometry publication with hit/focus/HTML generation; add
  preflight for fallible preparation and nonthrowing final geometry adoption.
- Exercise Group, Clip, filters, cached Layers, HtmlBox, and a Three panel in a
  resizable public composition.

**Exit:** final-width intrinsic descendants and external layer sizing agree in
the same frame; callbacks run once; paint/hit/focus agree; fail-closed cleanup and
independent-root error isolation pass. This is a release prerequisite, not optional
polish after algorithm parity.

### 4. Complete Flex and Yoga geometry migration

**Outcome:** the declared Yoga parity geometry capability set is usable through
Pibbl's normal styles.

Deliver small, independently observable slices in dependency order:

1. Box sizing, margins/logical edges, percentages, aspect ratio, and minimum rules.
2. Reverse/wrap-reverse/RTL, complete distribution, and iterative freeze behavior.
3. Baselines and intrinsic size contributions with real text.
4. Containing blocks/absolute positioning, hidden/contents participation, rounding.
5. Yoga defaults and necessary versioned compatibility policy translation.

Each gets public fixtures and a focused interaction matrix before moving to the
next. Then run the combined seeded/differential corpus and publish classified
divergences. Do not postpone text/constraints integration until a final “all features”
step; they are part of each relevant slice.

**Exit:** every release-parity manifest entry passes or has an explicitly accepted
documented semantic divergence and migration guidance. Silent omissions block release.

### 5. Grid and remaining layout families

**Outcome:** one coherent engine powers all built-in layout components, with useful
capabilities beyond released Yoga.

- Port Absolute, Overlay, and Flow to the same style/measurement/geometry protocol,
  preserving current contracts or recording approved changes. They must not retain
  a second incompatible percentage/measurement implementation.
- Deliver explicit Grid tracks/spans first, then implicit tracks and auto placement,
  then intrinsic/minmax/fr/repeat sizing and alignment interactions.
- Use a resizable inspector/dashboard composition, not only abstract rectangles.
  Show real labels, units, controls, overflow, and mixed Flex/Grid nesting.
- Add named lines/areas in a separately reviewable slice. Keep subgrid and other
  excluded CSS capabilities explicit in the manifest.

**Exit:** Grid target coverage and cross-family nesting pass; existing layout
examples and consumer declarations are migrated; no production split-brain solver.

### 6. Standalone adoption and migration tooling

**Outcome:** a Canvas framework can switch layout engines without first adopting
Pibbl's entire renderer.

- Extract the proven host protocol into optional `@pibbl/layout` without duplicating
  the kernel or signal integration.
- Define exact node ownership, mutation, calculate/snapshot, measurement, and dispose
  signatures. Keep application-friendly named operations and fixed return contracts.
- Add conversion/analysis for pinned Yoga style/tree data with an explicit defaults,
  config, callback, and unsupported-feature report.
- Complete two migration exercises: layout-only in an existing host, then a screen
  on Pibbl JSX/signals. Retain original and migrated examples and measured results.

**Exit:** migrations preserve intended geometry and cleanup; exceptions are actionable;
package imports stay inert and the standalone consumer does not pull the Canvas runtime.

### 7. Optimize from measurements and release

**Outcome:** performance and reliability claims have reproducible evidence.

- Use profiles to select optimizations: batch measurement frontiers, reduce transfer
  bytes, improve arena locality, or split optional algorithm code only when justified.
- Re-run the same full-stack workloads after each material change. Include costs
  shifted to setup, memory, JS wrappers, or output application.
- Complete native/WASM/browser conformance, lifecycle stress, bundle measurements,
  migration documentation, failure recovery, and target-device timing reports.
- Update current contracts, API JSDoc, Learn/API/Examples, Studio declarations,
  manifests, packed consumers, and third-party notices together.
- Run the proportional focused suites and finally the repository trust gate in
  its documented Node 24 LTS/pnpm 11.21.0/Chromium environment. Run controlled
  timing suites separately as the repository requires.
- Remove the old production layout paths only once public fixtures and migration
  acceptance pass. Retain the old engine as a pinned test artifact if useful, not
  as a permanent hidden runtime fallback.

**Feature complete:** accepted capabilities are hardened, documented, reviewed,
and verified; raw receipts and reproducible commands accompany the release.

## Integration map

Paths below identify current areas to change during implementation, not changes
made by this proposal.

| Area                                              | Integration responsibility                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/core/src/lib/layout/`                   | Replace local solvers/measurement restrictions with prepared graph, host adapter, placement from results. |
| `packages/core/src/lib/style/`                    | Typed values, normalization, box semantics, responsive constraints, placement handoff.                    |
| `packages/core/src/lib/element/`                  | Metadata for structural capabilities and precise input schema roles; identity preservation.               |
| `packages/core/src/lib/signals/`                  | Receiver bindings, role-aware invalidation, provision adoption, dynamic edge cleanup.                     |
| `packages/core/src/lib/scheduler/`                | Plan admission and allocation-before-raster dependency ordering.                                          |
| `packages/core/src/lib/render.ts`                 | Prepared-region integration without speculative ordinary function execution.                              |
| `packages/core/src/lib/render-transaction.ts`     | Staged geometry, publication preflight, matching input/focus generation.                                  |
| Primitive/Text/Layer/render-layer implementations | Measurement revisions, final allocations, cache invalidation, sizing lifecycle.                           |
| `packages/text`                                   | Optional shaping measurements and explicit font revisions, without mandatory core dependency.             |
| `packages/three`                                  | Verify existing public render-layer adapter receives correct same-frame size; avoid new Three scheduler.  |
| `packages/scenarios` and `playground`             | Shared manual/headless fixtures, readable examples, diagnostic counters, editor declarations.             |
| `tooling` and package manifests                   | WASM reproducibility, consumer/bundle checks, oracle fixtures, benchmark receipts.                        |

Contracts requiring explicit amendment include layout, style, runtime/hooks,
signals/scheduling, resource ownership, render-layer/Three, and the relevant
Canvas/event/focus publication rules. Existing accessibility boundaries remain
visible; this project does not silently introduce semantic DOM or editing.

## Risks and release controls

| Risk                                                     | Severity | Control / decision point                                                                |
| -------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| Intrinsic discovery conflicts with imperative components | High     | Explicit pure description/measurement capability; opaque boundaries; prove in slice 3.  |
| Geometry and Layer scheduling become one frame apart     | High     | Allocation dependency ordering and same-frame public tests before feature expansion.    |
| Duplicate reactive ownership or stale measurement cache  | High     | Reuse graph, role masks, content/font revisions, deterministic edge counters.           |
| Algorithm parity expands indefinitely                    | High     | Pinned manifest, classified differences, fixed first-release exclusions.                |
| Fresh solver consumes excessive maintenance effort       | High     | Bounded Taffy/internal-reuse decision before committing to full implementation.         |
| WASM startup/transfer erases gains                       | High     | Cold and end-to-end measurements in first slice; no kernel-only claims.                 |
| Numerical nontermination or silent precision loss        | High     | Progress proof, checked arithmetic, adversarial fixtures, f64/f32 decision evidence.    |
| Publication failure exposes mismatched interactions      | High     | Preflight, nonthrowing geometry adoption, fail-closed cleanup; no pixel-rollback claim. |
| Compatibility profiles fragment semantics                | Medium   | Adapter isolation, version pinning, explicit support/removal policy.                    |
| Larger API hurts readability                             | Medium   | Real migration tasks, minimal signatures, retain ordinary style vocabulary.             |
| Persistent memory grows during churn                     | High     | Per-root ownership, bounded caches, live/capacity counters, mount/dispose stress.       |
| Compiler/bundler/CSP failures                            | Medium   | Pinned artifact and source/built/packed/browser/NodeNext fixtures.                      |

This is a multi-stage engine project, not a small optimization. Calendar estimates
before the first measured slice and algorithm-provenance decision would be weak.
Estimate subsequent work from the observed complexity of intrinsic sizing,
reactive integration, and the migration corpus rather than counting style fields.

## Review and verification record for this proposal

Completed research includes local source/contract inspection, pinned Yoga release
and development comparison, official documentation, a native development-Yoga Grid
characterization, and an integration design tied to current Pibbl code. The native
probe compiled and ran successfully with Apple clang 21.0.0. It is not a benchmark.

No new layout engine, migration adapter, or performance result exists yet. Earlier
focused Pibbl test/reproduction results are labeled in the research document; this
documentation work does not claim a fresh aggregate trust result. Runtime files
and unrelated local changes remain untouched.

Documentation verification for this delivery: targeted Prettier checks passed for
all five proposal documents and the plan index; 39 local document links resolved;
`git diff --check` passed. The checks ran with the host Node 26.9.0 and pnpm
11.21.0. No runtime/browser suite was rerun for these documentation-only additions.

The recommended first authorized work is **capture the two regressions and build
the smallest signal-driven WASM Flex/Text slice**, with the algorithm-reuse choice
settled only as far as that slice requires. The full plan remains available without
making all future infrastructure a prerequisite for hands-on feedback.
