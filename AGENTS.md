# Pibbl working context for coding agents

This file is the compact operating model for work in this repository. It
summarizes the current code and approved contracts; follow the linked sources
when a task needs exact behavior or historical evidence.

## Product and current state

Pibbl is a small functional component runtime over the HTML Canvas 2D API. It
provides automatic JSX and equivalent `createElement` authoring, scheduled
rendering, first-class synchronous signals, hook state, DOM-aligned user events,
focus/keyboard management, transforms, clipping, offscreen layers, typed
filters, animation, layout, Canvas particles, 2D physics, and visualization
without React. Canvas drawing does not generate DOM; opt-in `HtmlBox` regions
host application-owned HTML.

Pibbl's public external-renderer boundary is `defineRenderLayer()`. The official
`@pibbl/three` adapter mounts ordinary Three.js scenes, cameras, objects,
controls, loaders, and effects as one Pibbl composition/event/focus/scheduling
boundary. Pibbl no longer ships its former custom WebGL scene graph,
renderer-coupled 3D particles, or any Pibbl-owned 3D physics API.

The local `_bmad-output/` directory remains discovery input, not normative
behavior. Current code, tests, and contracts under `docs/design/` define shipped
behavior.

## Source-of-truth order

When sources disagree, use this order and call out material drift:

1. Current public code, package manifests, and executable tests for shipped behavior.
2. Implemented design contracts under `docs/design/` and the trust-gate rules.
3. The implemented JSX-authoring and Three full-pivot designs and current
   style/layout architecture for exact authoring, composition, and integration
   intent.
4. The implemented first-class filter design for exact filter intent not
   superseded by current contracts.
5. Plan 003's implemented design for style/layout intent not superseded by the
   current contracts.
6. Completed numbered plans and their dated field notes as historical evidence.
7. The [product strategy and future opportunities](docs/strategy/README.md) for
   non-normative prioritization hypotheses only; it never defines shipped
   behavior or authorizes implementation.
8. Draft PRDs, extraction files, `_bmad-output/`, and memlogs as discovery evidence,
   not normative behavior.

Test totals in documentation are dated snapshots. In particular, the 265-test
and 294-test totals describe separate historical verification runs; never report
either as the current result unless a fresh run reproduces it.

## Repository map

- `packages/core`: public `@pibbl/core` runtime, components, hooks,
  `defineRenderLayer`, contracts, unit tests, browser tests, and visual
  baselines.
- `packages/three`: official thin `@pibbl/three` adapter over ordinary Three.js
  resources, implemented through the public render-layer lifecycle.
- `packages/text`: optional public `@pibbl/text` text-to-path shaping package with
  precompiled HarfBuzz WASM and explicit font ownership.
- `packages/core/src/features`: first-party particles, visualization, textures,
  and physics, published as core subpaths. Physics includes private bundled
  Rapier; pure geometry entries do not initialize it.
- `packages/scenarios`: private learning examples and deterministic test-lab
  scenarios. Keep catalogs and presentation metadata separate.
- `playground`: interactive examples Studio and automated-test laboratory.
  Public documentation is Learn, API, and Examples; only `docs/site/` is
  rendered or searched publicly.
- `tooling`: catalog, documentation, package-consumer, and visual verification.
- `docs/design`: current implemented behavior contracts.
- `docs/strategy`: non-normative product hypotheses and future opportunities.
- `docs/project-plans`: executable-plan workflow and completed records.

## Current runtime model

- `pibbl(canvas, root, config?)` owns at most one live mount per Canvas and
  returns a stable controller with idempotent `dispose()`.
- One realm scheduler coalesces roots, managed Layers, animation, 2D physics,
  and external render layers into Begin, Advance, Commit, Plan, Render, and
  Complete phases.
- Components are ordinary synchronous functions. JSX and `createElement`
  create branded recursive `PibblElement` values. Supported applications import
  only public package entries.
- Signals are explicit and synchronous. Declared receiver-owned inputs resolve
  signals; writes are forbidden during component, primitive-render, and
  computed evaluation.
- Source traversal is Canvas paint order. Coordinate targeting walks the shared
  ledger in reverse and resolves at most one topmost logical target.
  `pointerEvents="none"` opts decorative paint out.
- `Group`, `Clip`, `Layer`, layout, filters, and interaction all preserve
  the same logical/world geometry and exact resource ownership.
- A nonempty `style.filter` captures one receiving primitive plus descendants
  and composites the filtered result without changing layout or hit geometry.
- Layout is immediate-mode: parents inspect declared child style, compute finite
  allocations, and place one child descriptor without retaining draw commands.
- `defineRenderLayer` creates one flattened external-renderer bitmap and
  matching interaction generation in Canvas paint order. Pibbl owns scheduling,
  layout, outer composition, events, focus, and commit/teardown; the application
  owns resources returned from `create()`.
- `defineThreeLayer` uses that lifecycle. One mounted identity creates one
  transparent `THREE.WebGLRenderer`; ordinary Three scene resources persist
  across Pibbl renders. Default raycasting returns target/block/miss, controls
  receive Pibbl-routed input, and application cleanup disposes Three resources.
- External renderer animation advances from the supplied Pibbl frame and calls
  `invalidate()` only when another frame is needed. Ordinary applications do
  not start another `requestAnimationFrame` loop or call
  `renderer.setAnimationLoop()`; WebXR is outside the current contract.
- Runtime resources have one explicit owner and exact teardown semantics.
  Prefer deterministic ownership counters to heap or GC timing.
- `@pibbl/core/internal` is reserved for matching official integrations and
  is not an application compatibility promise.

## Public surface and deliberate boundaries

Public core includes `pibbl`, JSX/`createElement` authoring, signals,
animation definitions/programs, hooks, Canvas drawing components, `Group`,
`Clip`, `Layer`, layout components, focus policies, measurement,
`definePrimitive`, and `defineRenderLayer` with its lifecycle, frame,
interaction, target, size, and style types.

Public `@pibbl/three` includes `defineThreeLayer` plus
`PibblThreeInputBridge`, `PibblThreeLayerContext`,
`PibblThreeLayerDefinition`, `PibblThreeLayerResources`, `PibblThreePicker`,
`PibblThreePickResult`, `PibblThreeRendererOptions`, and `PibblThreeTarget`.
Three scenes, objects, materials, lights, cameras, controls, loaders, shadows,
particles, and post-processing come directly from `three` and
`three/addons/*`.

Public `@pibbl/core/particles` is Canvas 2D only. Public physics is the
`@pibbl/core/physics/2d` runtime plus `/2d/geometry`. There is no root physics
barrel, Pibbl-owned 3D physics API, renderer-coupled 3D world, or Three physics
binding.

Pibbl does not promise a Three JSX reconciler, retained Three scene graph,
Canvas/Three subprimitive interleaving, WebXR, automatic semantic DOM,
accessibility tree, rich text editing, scrolling, complete CSS compatibility, worker
rendering, cross-context GPU sharing, or a second scheduler. External layers
require browser `OffscreenCanvas`, `transferToImageBitmap()`, and the
capabilities of the selected renderer.

Read exact contracts before changing these areas:

- `docs/design/render-layer-and-three-contract.md`
- `docs/design/animation-contract.md`
- `docs/design/physics-2d-contract.md`
- `docs/design/signals-and-scheduling-contract.md`
- `docs/design/canvas-surface-contract.md`
- `docs/design/runtime-hooks-contract.md`
- `docs/design/drawing-components-contract.md`
- `docs/design/style-system-contract.md`
- `docs/design/layout-system-contract.md`
- `docs/design/user-events-contract.md`
- `docs/design/focus-and-keyboard-navigation-contract.md`
- `docs/design/canvas-accessibility-guidance.md`
- `docs/design/mouse-interaction-contract.md`
- `docs/design/event-resource-ownership.md`
- `docs/design/runtime-resource-ownership.md`

## API design: explicit operations, not magic selectors

- Do not introduce public functions, hooks, factories, or methods whose caller
  selects a different return type, shape, cardinality, or capability set with a
  magic string. This includes selectors nested in options such as `type`,
  `kind`, `mode`, or `format`, not just positional arguments.
- Give distinct operations descriptive names and stable return contracts. Use
  `useLinearScale(id)` and `useBarScale(id)`, not `useScale(id, "linear")` and
  `useScale(id, "bar")`. Likewise, separate a query returning a boolean, one
  result, or many results into explicitly named operations. Share implementation
  privately where useful.
- Literal unions, overloads, conditional return types, enums, constants, and
  boolean flags do not fix a selector-driven public design. Do not disguise
  multiple return contracts with a broad union or a common wrapper either.
- Prefer named functions or typed strategy/definition objects for distinct
  algorithms. Do not add a required single-value selector in anticipation of
  future variants; name the supported operation directly.
- Ordinary data and policy values (IDs, event names, alignment, direction,
  placement) and discriminated data/event/result unions are allowed when they
  describe one coherent contract. Generic inference from caller-supplied data
  or typed definitions is allowed. These are not permission to hide operation
  selection in a configuration object.
- Before adding or changing a public API, review every selector argument and
  options discriminator, including methods on returned objects. If changing
  only that selector changes what callers receive or which operations they can
  perform on it, split the public operation. Show public type and runtime
  evidence for each resulting contract. Existing violations are migration
  work, not precedent for new APIs.

## Change and evidence rules

- Preserve unrelated working-tree changes and untracked files.
- For bug fixes and features, define the observable contract first and add a
  failing test before production code.
- Public behavior needs public-API evidence. A representative scenario should be
  usable manually and driven headlessly; internal tests may supplement it but do
  not replace it.
- Assert semantic state and geometry before adding visual evidence. Use exact
  pixels/screenshots only where they add information, with narrow documented
  masks for platform-sensitive content.
- Never rewrite a visual baseline merely to make a check pass. Inspect expected,
  actual, and diff output and record why an intentional change is correct.
- Keep learning examples separate from exhaustive deterministic test fixtures,
  while ensuring both exercise the same supported public behavior.
- Keep public Studio search build-time and local: MiniSearch indexes validated
  Learn/API content and public example metadata only. Test labs, scenario-only
  metadata, and repository documentation outside `docs/site/` are excluded.
- New public capabilities must agree across runtime exports, declarations,
  Bundler and NodeNext consumers, packed output, source/built browser modes, and
  the Studio's editor declarations.
- Preserve `Group` semantics, source paint order, root-logical mouse coordinates,
  scheduled updates, identity rules, and teardown ownership unless an approved
  plan explicitly changes a contract and supplies migration evidence.

## Delivery sequencing: vertical slices before hardening

User instructions and repository instructions override workflow recommendations
from skills, including Superpowers. Skills supply techniques; they do not choose
the delivery sequence.

For feature work, default to this progression:

1. Identify the smallest runnable end-to-end behavior through the supported
   public API.
2. Define its observable contract and add one focused failing test before
   production code.
3. Implement the complete vertical slice, including a public scenario or
   browser-visible example where applicable.
4. As soon as it works, provide the exact Studio URL and what the user should
   inspect.
5. Incorporate experiential feedback.
6. Only then add the broader edge-case matrix, exhaustive ownership evidence,
   documentation hardening, adversarial review, and aggregate trust gate.

Before the first slice is ready, do not build exhaustive horizontal
infrastructure for anticipated future cases, repeatedly run broad verification
that cannot affect the slice, or launch overlapping reviewers. Perform only the
focused verification needed to demonstrate the slice and protect existing
behavior. Brainstorm only enough to resolve decisions that block the slice;
require a full design phase only for difficult-to-reverse public contracts.

Report these as distinct milestones:

- **Slice ready for feedback:** runnable and focused checks pass.
- **Feature complete:** accepted behavior is hardened, documented, reviewed,
  and has passed proportional final verification.

Use at most one implementation agent and one review agent per slice unless more
independent work has a concrete wall-clock benefit. Reuse existing agents rather
than repeatedly creating new reviewers. Do not explicitly override configured
subagent model or reasoning defaults without a concrete task-specific reason.

## Verification contract

The documented environment is Node 24.15 or newer on the Node 24 LTS line,
pnpm 11.21.0 from `packageManager`, and Playwright Chromium. From a provisioned
checkout, the aggregate gate is:

```sh
corepack pnpm@11.21.0 trust
```

Use focused checks while iterating, then run verification proportional to the
change. The aggregate gate covers documentation/export/link consistency,
catalog consistency, typecheck, lint/format, package and playground builds,
packed consumers, browser and visual suites, built smoke, lifecycle cleanup,
and structural performance evidence. Controlled wall-clock performance guards
are opt-in and are not a default correctness gate.

Do not claim a verification result from documentation alone. Report the command,
environment, and fresh output, or label older evidence with its date.

## Shipped Plan 003: first-class style and layout

Plan 003 replaced visual props with one typed local style language and added
dedicated Absolute, Overlay, Flow, Flexbox-subset, and Grid-subset layout
components. It preserves immediate-mode rendering and uses declared boxes plus
pure opt-in measurement rather than a retained display list.

The implementation preserves the immediate-mode Canvas2D renderer, `Group`, source
paint order, identity/lifecycle rules, and public package boundary. A parent-local
anchored native color input and a 100,000-record windowed list are proving
scenarios only; they do not authorize public popover or virtualization APIs.

Auto-placement Grid, advanced intrinsic CSS sizing, reverse/reordered Flexbox,
margin, scrolling, focus pseudo-styles, editable input adapters, semantic DOM
overlays/accessibility, workers, and a retained scene graph remain deferred.
Plan 003's WebGL deferral was superseded by the later shipped island model.
Exact implemented contracts and records live in:

- `docs/superpowers/specs/2026-08-17-style-and-layout-design.md`
- `docs/architecture/style-and-layout-architecture.md`
- `docs/superpowers/plans/2026-08-17-style-and-layout-implementation.md`
- `docs/project-plans/003-first-class-style-and-layout.md`

## Shipped JSX component authoring

The implemented 2026-09-01 design replaced the factory-first surface with
automatic JSX and equivalent `createElement` construction. It added the
branded `PibblElement`/recursive `PibblNode` protocol, transparent and keyed
fragments, arbitrary finite synchronous child structures, textual `Text`
children, descriptive built-ins, transparent focus policy components,
`useCanvasContext`, and `definePrimitive`. It also added compiler subpaths,
mixed-runtime boundaries, actionable foreign-runtime diagnostics, TSX Studio
execution, and a complete JSX/non-JSX learning catalog.

There is no React dependency, global JSX namespace, classic-transform contract,
async component support, lowercase intrinsic vocabulary, or compatibility
alias for removed authoring values. Current public guides and the API reference
live under `docs/site/learn/guides/` and `docs/site/api/`; the approved design and
implementation record remain under `docs/superpowers/` as dated evidence.

## Shipped first-class filters

The implemented 2026-09-08 design added the closed `style.filter` system to
every primitive. Filters affect pixels only: layout, measurement, hit testing,
focus/navigation bounds, pointer coordinates, and cursor regions use original
logical geometry. A receiving primitive and all descendants form one combined
silhouette; list order is forward, nesting is inside out, and Group/Clip/Layer
composition preserves the documented presentation and caching order.

Each Pibbl instance owns a constant-time depth-indexed pool with two transient
surfaces per active nesting level. Validation, allocation, execution, and
compositing restore leases and render globals in `finally`; structural evidence
locks one component traversal, two bitmap draws per boundary, sibling reuse,
Layer cache hits, and the absence of pixel readback. Exact current behavior and
historical intent live in:

- `docs/design/style-system-contract.md`
- `docs/design/drawing-components-contract.md`
- `docs/design/canvas-surface-contract.md`
- `docs/design/runtime-resource-ownership.md`
- `docs/superpowers/specs/2026-09-08-first-class-filters-design.md`

## Shipped external render layers and Three.js integration

The 2026-09-28 pivot makes Pibbl a Canvas 2D runtime with a framework-neutral
external render-layer boundary. `defineRenderLayer()` owns one persistent
surface/resource lifetime, scheduled frame callback, transactional
bitmap/interaction generation, target/block/miss arbitration, focus metadata,
outer Canvas composition, and exact teardown.

`@pibbl/three` is the official thin adapter. Applications use ordinary
`THREE.Scene`, cameras, objects, materials, lighting, shadows, GLTF loaders,
controls, instancing, particles, and post-processing. `defineThreeLayer()`
creates one transparent adapter-owned renderer, supplies Pibbl-routed controls
input, defaults to normal Three rendering and raycasting, and leaves
application-created resource disposal explicit.

The former custom WebGL package and scene vocabulary, WebGL-specific
particle entry, and all Pibbl-owned 3D physics APIs were removed without
compatibility aliases. Historical
WebGL specs and plans are dated evidence only; current intent lives in:

- `docs/design/render-layer-and-three-contract.md`
- `docs/superpowers/specs/2026-09-28-three-full-pivot-design.md`
- `docs/superpowers/plans/2026-09-28-three-full-pivot-implementation.md`

## Shipped first-class signals and realm scheduler

The implemented 2026-09-10 signal work added writable and readonly signals,
lazy computed values, untracked reads, nominal recognition, and the
mount-owned `useSignal` hook. Reads are explicit; component consumers replace
their dependency edges after successful evaluation and detach them on
removal, failure cleanup, or disposal. Computed graphs are synchronous,
dynamic, cached, dependency-first, equality-aware, and cycle checked. Their
source observer leases exist only while observed, and observed invalidation
requests Plan work without dirtying a renderer until the result changes.

One scheduler singleton per loaded runtime owns at most one host frame across
all roots and managed Layers. Begin, Advance, Commit, Plan, Render, and
Complete have explicit admission, phase-deferral, and failure-isolation rules.
Advance mutations are staged; Commit notifications and Plan-derived dirtiness
may join the current plan. Layer requests
carry monotonically increasing realm revisions, mark their ancestor
composition path, render dirty nested instances deepest-first, and preserve
clean sibling caches. Errors are collected after Complete rather than stopping
unrelated roots or completions.

`@pibbl/core/internal` is an explicit version-coupled friend entry for official
renderer packages released in lockstep. It is not re-exported from the root,
is not available to ordinary Studio examples, and is not a stable third-party
API. Exact current behavior lives in
`docs/design/signals-and-scheduling-contract.md`.

## Shipped first-class animation

The implemented 2026-09-11 animation work adds numeric tweening, keyframes,
analytic springs, custom seekable definitions, and fixed-step stateful
steppers. Immutable programs compose `drive`, `sequence`, `parallel`, `wait`,
`marker`, and `repeat`; whole-run writer leases reject ambiguous writers unless
replacement is explicit. `usePlayback` owns stable controls/status/current time
for one mounted hook slot, while `useAnimatedValue` provides explicit target-driven
spring and tween values. Signals may flow directly into declared Pibbl style and
component inputs; `.get()` remains the way to make the enclosing component the
consumer.

Every command enters Begin, every active playback samples in Advance,
user/status/time writes publish atomically in Commit, computed and renderer work
is planned afterward, and milestones/errors deliver in Complete. Time-based
definitions use logical time; only steppers integrate clamped fixed steps.
Ordinary Canvas content still repaints its immediate-mode root. Explicit Layers
and external render layers are the only retained bitmap boundaries, and Pibbl
never promotes content automatically. Render layers participate through the
public shared-frame lifecycle; workers/WASM remain future internal optimizations
with no permission to change observable behavior. Exact behavior lives in
`docs/design/animation-contract.md` and the authoring guide is
`docs/site/learn/guides/signals-and-animation.md`.
