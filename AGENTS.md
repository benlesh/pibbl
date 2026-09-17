# CRC working context for coding agents

This file is the compact operating model for work in this repository. It
summarizes the current code and approved contracts; follow the linked sources
when a task needs exact behavior or historical evidence.

## Product and current state

CRC is a small functional component runtime over the HTML Canvas 2D API, with
an optional official WebGL2-island package. It provides automatic JSX and
equivalent `createElement` authoring, scheduled rendering, first-class
synchronous signals, hook state, DOM-aligned user events, transforms, clipping,
offscreen layers, typed first-class filters, animation, and composable 2D/3D
drawing primitives without React or generated DOM.

- Project Plans 001, 002, and 003 are complete. Plan 003 shipped first-class
  local style, declared-box layout, pure measurement, and the Absolute,
  Overlay, Flow, Flex, and explicit Grid components.
- The approved JSX component-authoring design is implemented. Ordinary
  components are synchronous functions, elements use a branded recursive
  protocol, built-ins have descriptive uppercase names, and the removed
  factory-first surface has no compatibility aliases.
- DOM-aligned user events and optional logical focus/keyboard navigation are
  implemented. The Canvas remains the only native focus host and gains no
  generated semantic DOM or accessibility tree.
- First-class `style.filter` is implemented for every primitive with ten typed
  Canvas filter descriptors, ordered single/list semantics, combined-subtree
  capture, inside-out nesting, upright local surfaces, and instance-owned
  transient pooling.
- `@crc/webgl` is implemented as transparent WebGL2 islands in Canvas paint
  order. It shares core's element protocol, scheduler, events, focus, and JSX
  runtime. Each layer composes one frame-local scene, settles meshes, analytic
  lights, materials, background, pick/focus records, and genuine shadow plans,
  renders shadow-depth passes followed by opaque and transparent color queues,
  and transactionally commits one Canvas bitmap. Its renderer owns WebGL
  contexts, resident GPU and shadow resources, bitmap generations, and
  animation requests. `useOrbitCamera` supplies an attach-anywhere public event
  handler bundle while cameras remain plain perspective descriptors.
- `@crc/particles` is implemented as immutable 2D/3D effect definitions,
  direct deterministic descriptor factories, component-owned systems, one
  fixed-capacity Canvas primitive, and stateless instanced WebGL submissions.
- First-class `signal`, `computed`, `untracked`, `isSignal`, and `useSignal`
  are implemented with explicit reads, dynamic synchronous dependency graphs,
  render/Advance write guards, observation-aware computed source-edge leases,
  and exact consumer ownership. Observed pending computed validation is live
  Plan work. One realm scheduler runs six ordered phases across roots and
  managed Layers.
- First-class animation is implemented through immutable tween, keyframe,
  analytic-spring, custom, and fixed-step definitions; composable programs;
  whole-run writer leases; component-owned playback; update-driven
  transitions; and ordered post-render milestones. All animation advances in
  the existing realm scheduler and writes ordinary signals atomically.
- The local `_bmad-output/` directory remains discovery input, not normative
  behavior. Plan 003's implemented design, architecture, contracts, and
  implementation record supersede its earlier layout proposals where they
  differ.

## Source-of-truth order

When sources disagree, use this order and call out material drift:

1. Current public code, package manifests, and executable tests for shipped behavior.
2. Implemented design contracts under `docs/design/` and the trust-gate rules.
3. The implemented JSX-authoring and WebGL-island designs and current
   style/layout architecture for exact authoring, style, layout, and WebGL
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

- `packages/core`: the public `@crc/core` runtime, components, hooks, contracts,
  unit tests, browser tests, and visual baselines.
- `packages/webgl`: the optional public `@crc/webgl` WebGL2-island components,
  immutable geometry, hooks, render/pick backend, and deterministic ownership
  evidence.
- `packages/particles`: the optional public `@crc/particles` Canvas component,
  system hook, descriptors, and the `@crc/particles/webgl` instanced scene
  entry.
- `packages/scenarios`: private learning examples and deterministic test-lab
  scenarios. Keep their catalogs and presentation metadata separate.
- `packages/types`: deliberately minimal compatibility package; shared public
  types do not belong here until a concrete need justifies them.
- `playground`: the interactive examples studio and the separate automated-test
  laboratory UI. Its public documentation surface is Learn, API, and Examples;
  `docs/site/` is the only Markdown tree rendered or searched publicly.
- `tooling`: catalog, package-consumer, and visual verification programs.
- `docs/design`: implemented behavior contracts.
- `docs/strategy`: non-normative product hypotheses, candidate experiments,
  and future opportunities. Consult it when scoping new work, not as an active
  execution queue.
- `docs/testing`: trust-gate policy, evidence, and historical field notes.
- `docs/project-plans`: executable-plan workflow and completed plans.

## Current runtime model

- `crc(canvas, root, config?)` owns at most one live mount per Canvas and
  returns a stable controller with idempotent `dispose()`.
- Root surfaces separate logical, CSS content-box, and physical backing spaces.
  The default captures the initial Canvas attributes as a fixed logical
  viewport, uses centered `contain`, and follows device density;
  `viewport: 'responsive'` makes CSS content-box pixels the logical root.
- Updates across every root and managed Layer in one loaded runtime coalesce
  onto one realm-wide `requestAnimationFrame`. A frame runs Begin, Advance,
  Commit, Plan, Render, and Complete; normal root rendering clears the Canvas
  and synchronously traverses the full component tree.
- Components are ordinary synchronous TypeScript/JavaScript functions. JSX and
  `createElement` create opaque branded `CRCElement` descriptors over the same
  recursive `CRCNode` protocol. The public surface is exported from `@crc/core`;
  supported code must not import `@crc/core/lib/*` or source paths.
- Automatic compiler entries are `@crc/core/jsx-runtime` and
  `@crc/core/jsx-dev-runtime`. One file has one JSX runtime; mixed React/CRC
  projects separate files or use explicit construction for the minority tree.
- Component identity is derived from parent path, component-function identity,
  and optional sibling key. Unkeyed same-type siblings use occurrence order.
  Reparenting or adding a wrapper can remount a subtree; keys do not preserve
  identity across parents.
- Signal reads are explicit through `get()`. A component subscribes only to
  reads performed during its own evaluation; child reads do not become parent
  dependencies. `set()` treats functions as data, while `update()` is the
  explicit updater operation. Writes are forbidden during component,
  primitive-render, and computed evaluation, including equality no-ops. Advance
  participants may mutate signals only through their scheduler staging batch.
- Animation definitions and programs are nominal immutable values without a
  clock. `track` binds definitions to writable signals; `usePlayback` and
  `useTransition` create component-owned running state. Commands enter Begin,
  playback samples in Advance, outputs/status/time publish together in Commit,
  milestones deliver in Complete, and teardown releases all writer leases and
  state. There is no free `play(program)` API or independent animation loop.
- Canvas state is isolated with save/restore around component traversal. Render
  failure tears down runtime-owned resources and clears component refs; pixels
  already painted earlier in the failing frame are not rolled back.
- Source traversal is Canvas paint order. Inside one WebGL scene it establishes
  component identity, event/focus order, and stable tie indices rather than an
  irrevocable GPU draw sequence. Coordinate-event targeting walks the shared
  Canvas paint ledger in reverse and resolves at most one topmost logical
  target. Canvas and WebGL drawing primitives participate by default;
  `pointerEvents="none"` is the explicit opt-out. Structural handler props add
  propagation listeners but no independent hit geometry.
- `Group` composes Canvas transforms. Interaction regions, `Clip`, and `Layer` capture
  the same transform/clip geometry, so paint and hit testing must stay aligned.
- Offscreen `Layer` instances share the root interaction state and participate in
  global paint/target order. Revisioned nested work renders deepest-first;
  clean sibling bitmaps remain cached and ancestor composition follows the
  dirty path. Layers require browser `OffscreenCanvas` support.
- `WebGLLayer` owns a private WebGL backend instance and composites one
  transparent committed `ImageBitmap` at one Canvas paint position. A dirty
  child composes, settles, renders any invalid shadow-depth generations, then
  renders the color queues before the parent Canvas composites and commits the
  bitmap/pick/focus generation. Its picker bridges fixed
  miss/block/target results into the global event stack, and its geometry-backed
  focus targets expose projected bounds.
- WebGL meshes are Lambert-lit by default. Ambient, hemisphere, directional,
  point, and spot declarations affect the complete settled scene independently
  of JSX order. Direct lights cast genuine shadows by default at the layer's
  default `"medium"` quality; directional and spot lights use one 2D depth
  view, while point lights use six cube faces. Camera-only changes reuse valid
  light-space depth generations.
- `useOrbitCamera` owns spherical pose state in one component hook slot and
  returns stable ordinary pointer/wheel handlers. Authors attach those handlers
  to a mesh, structural ancestor, or explicit viewport-sized target; structural
  listeners never invent hit geometry.
- A nonempty `style.filter` creates one transient composition boundary around
  the receiving primitive and its recursive output. One list uses one native
  filter operation in declaration order; nested boundaries resolve inside out.
  Receiving Group transforms and Clip geometry apply after filtering.
- Filter and Layer surfaces are upright local targets. Paint transforms map into
  the active surface; separate world transforms preserve root-logical event,
  focus, and clip geometry. Filter raster density includes root/Layer backing
  density exactly once and applies parent presentation at composite time.
- Layout parents inspect normalized direct-child style before render, resolve
  finite allocations, and place one child descriptor without retaining drawing
  commands. Pure opt-in measurement cannot render or acquire runtime resources.
- Styles are local and closed: no cascade or inheritance. Allocation syntax is
  resolved before Canvas callbacks; parent placement uses `left`/`top`, while
  drawing primitives keep local `x`/`y` geometry.
- Runtime resources have one explicit owner and exact teardown semantics. Prefer
  deterministic ownership counters to heap or garbage-collection timing.
- Core and WebGL components use one `@crc/core` automatic JSX runtime. The
  version-coupled `@crc/core/internal` export is reserved for matching official
  sibling packages and is not an application compatibility promise.

## Public surface and deliberate boundaries

Public runtime/authoring: `crc`, `createElement`, `Fragment`,
`definePrimitive`, `useCanvasContext`, `signal`, `computed`, `untracked`, and
`isSignal`; animation definitions/programs `easing`, `tween`, `keyframes`,
`spring`, `defineAnimation`, `stepper`, `track`, `sequence`, `parallel`,
`wait`, `marker`, and `repeat`; drawing and composition components
`Rectangle`, `Path`, `Line`, `HorizontalLine`, `VerticalLine`, `SvgPath`,
`Text`, `Image`, `Group`, `Clip`, and `Layer`; layout components `Absolute`,
`Overlay`, `Flow`, `Flex`, and `Grid`; focus policies `FocusManagement` and
`KeyboardNavigation`; and pure `measureElement` plus the public element, node,
primitive, style, length, box, constraint, and measurement types. Surface
configuration is public through `CRCConfig`,
`CRCFit`, `CRCPixelRatio`, and the fixed/responsive configuration types.
Directional configuration is public through `CRCKeyboardNavigationOptions`.
Signal configuration and values are public through `Signal`,
`WritableSignal`, `SignalOptions`, and `SignalEquals`.
Animation configuration and values are public through the named
`CRCAnimationDefinition`, `CRCAnimationProgram`, easing/interpolator,
definition-option, repeat, playback, event/status, and transition-option types.
Filter configuration is public through `CRCFilter` and the ten named
`CRCBlurFilter`, `CRCBrightnessFilter`, `CRCContrastFilter`,
`CRCDropShadowFilter`, `CRCGrayscaleFilter`, `CRCHueRotateFilter`,
`CRCInvertFilter`, `CRCOpacityFilter`, `CRCSaturateFilter`, and
`CRCSepiaFilter` descriptor types.

Public hooks: `useState`, `useSignal`, `usePlayback`, `useTransition`, `useMemo`,
`useRef`, `useWhenChanged`, `useRectPath`,
`useLinePath`, `useSvgPath`, `useEvent`, `useEventTarget`,
`useEventListener`, `useCursor`, and `useLayoutBox`.

Public `@crc/webgl` surface: `WebGLLayer`, `Group3D`, `Mesh`, `Cube`, `Sphere`,
`AmbientLight`, `HemisphereLight`, `DirectionalLight`, `PointLight`,
`SpotLight`, `WebGLBackground`, `createWebGLGeometry`, `useAnimationFrame`, and
`useOrbitCamera`, plus their public camera, orbit, geometry, material, shadow,
transform, and component prop/style types. `Mesh` plus immutable
`createWebGLGeometry` descriptors is the application custom-shape path. The
package has no second JSX runtime, element constructor, fragment, core
hook/event vocabulary, public GL context, shader/draw callback, or analytic hit
callback.

Public `@crc/particles` surface: `Particles2D`, `useParticleSystem`,
`defineParticleEffect2D`, `particleRange`, `particleInteger`,
`particleChoice`, `particleParameter`, `particleCurve`, and
`particleGradient`; `@crc/particles/webgl` adds `Particles3D` and
`defineParticleEffect3D`. Public guidance lives in
`docs/site/learn/guides/particle-effects.md` and the implementation plan remains
the dated execution record.

Current interaction supports DOM-aligned pointer, mouse, touch, wheel,
keyboard/focus, editing/composition, clipboard, and drag/drop event facades,
explicit geometric targets, propagation listeners, cancellation, logical
related targets, and pointer capture. Opt-in focus management adds one Canvas
DOM focus host, logical focus events and render snapshots, source-order Tab,
press focus, Enter/Space activation, and focus-visible modality; opt-in nested
keyboard navigation adds deterministic arrow movement. Without the focus policy,
native non-coordinate input on a plain Canvas has no logical target. No public
input-injection adapter, hidden editable DOM, semantic control mirror, or
accessibility layer exists. CRC also does not promise rich text, image CORS
policy, complete CSS compatibility, raw CSS filter strings, `url()`/SVG filter
graphs, `backdrop-filter`, `boxShadow`, scrolling, worker/WASM animation,
cross-thread signals, public manual clocks/history, automatic caching, or a
retained scene graph.
WebGL islands do not promise WebGL1/WebGPU fallback, Canvas children inside an
island, Canvas/WebGL subprimitive interleaving, multiple cameras or viewports in
one island, textures, image environments/IBL, PBR, glow/bloom, area lights,
cascaded/soft/contact/transparent shadows, workers, or cross-context GPU
sharing.
Nonempty filters require browser `OffscreenCanvas` and Canvas
`filter`; `[]` is a no-op with no filter capability requirement. Browser
behavior remains authoritative for Canvas/`Path2D`, font
rasterization and measurement, decoded-image behavior, and `OffscreenCanvas`
availability.

Read the exact contracts before changing these areas:

- `docs/design/animation-contract.md`
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
branded `CRCElement`/recursive `CRCNode` protocol, transparent and keyed
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

Each CRC instance owns a constant-time depth-indexed pool with two transient
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

## Shipped WebGL islands, lighting, orbit controls, and genuine shadows

The implemented 2026-09-09 design added the optional `@crc/webgl` package.
`WebGLLayer` owns one persistent transparent WebGL2 `OffscreenCanvas`, private
backend instance, transactional committed bitmap/pick pair, and context-owned
GPU generations. `Group3D`, `Mesh`, `Cube`, and `Sphere` compose one depth-aware
3D island; `createWebGLGeometry` and `Mesh` provide custom triangle geometry,
and `useAnimationFrame` uses the shared scheduler.

The implemented 2026-09-13 settled-scene design supersedes the 2026-09-09
record's immediate child drawing, public context/custom-extension,
component-resource, and source-order-only raster clauses. For a dirty island,
components compose declarations once without GL work; CRC settles immutable
render/pick/focus records, renders opaque source order with depth writes and
transparent bounds-center order back-to-front without depth writes, then Canvas
composites and transactionally commits the bitmap/pick/focus generation. Final
alpha is color alpha multiplied by opacity; zero-alpha geometry does not raster
but remains pick/focus eligible.

Canvas and WebGL leaves now participate in coordinate targeting by default;
`pointerEvents="none"` makes decorative paint pass through. Structural
containers remain listener-only. Transparent island background misses,
geometry uses committed depth-aware ray picking, and the nested bridge preserves
normal capture/target/bubble propagation, pointer capture, cursor, focus, and
keyboard behavior. Geometry-backed focus bounds are projected from the same
committed model/camera state.

An island is one flattened Canvas paint entry. Core filters, layout, transforms,
clips, and composition apply outside the completed bitmap; inner WebGL
objects cannot use Canvas filter descriptors. Canvas children inside an
island, WebGL values outside one, and Canvas/WebGL subprimitive interleaving are
unsupported. The official version-coupled `@crc/core/internal` friend seam is
reserved for matching CRC packages. Exact current behavior lives in the
updated contracts under `docs/design/`; the current settled-scene design is:

- `docs/superpowers/specs/2026-09-13-webgl-settled-scene-rendering-design.md`

The implemented 2026-09-14 lighting design adds immutable geometry normals,
local closed Lambert material descriptors, five global analytic-light
declarations, and one solid/alpha `WebGLBackground`. Meshes are lit by default;
a non-emissive lit mesh with no illumination is black, while `style.lit = false`
keeps the base color and emission without receiving lights. Light and emissive
color alpha scale RGB contribution but never mesh output alpha.

The implemented 2026-09-15 orbit/shadow design adds the component-owned
`useOrbitCamera` hook and renderer-owned genuine depth maps. Omitted
`WebGLLayer.style.shadows` means `"medium"`; direct lights and opaque meshes
cast by default, and lit nonzero-alpha meshes receive by default. Directional
and spot lights use one 2D shadow view; point lights use six cube faces. Each
shadow attenuates only its matching direct-light contribution, and presentation
camera movement does not invalidate a valid light-space cache. Exact current
behavior lives in the updated contracts under `docs/design/`; approved intent
is recorded in:

- `docs/superpowers/specs/2026-09-14-webgl-lighting-materials-and-background-design.md`
- `docs/superpowers/specs/2026-09-15-webgl-orbit-camera-and-genuine-shadows-design.md`

Historical island intent lives in:

- `docs/superpowers/specs/2026-09-09-webgl-islands-design.md`
- `docs/superpowers/plans/2026-09-09-webgl-islands-implementation.md`

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

`@crc/core/internal` is an explicit version-coupled friend entry for official
renderer packages released in lockstep. It is not re-exported from the root,
is not available to ordinary Studio examples, and is not a stable third-party
API. Exact current behavior lives in
`docs/design/signals-and-scheduling-contract.md`.

## Shipped first-class animation

The implemented 2026-09-11 animation work adds numeric tweening, keyframes,
analytic springs, custom seekable definitions, and fixed-step stateful
steppers. Immutable programs compose `track`, `sequence`, `parallel`, `wait`,
`marker`, and `repeat`; whole-run writer leases reject ambiguous writers unless
replacement is explicit. `usePlayback` owns stable controls/status/current time
for one mounted hook slot, while `useTransition` provides explicit target-driven
spring and tween values. Ordinary styles still receive numbers through visible
`.get()` calls.

Every command enters Begin, every active playback samples in Advance,
user/status/time writes publish atomically in Commit, computed and renderer work
is planned afterward, and milestones/errors deliver in Complete. Time-based
definitions use logical time; only steppers integrate clamped fixed steps.
Ordinary Canvas content still repaints its immediate-mode root. Explicit Layers
and WebGL islands remain the only retained boundaries, and CRC never promotes
content automatically. The matching `@crc/webgl` package participates through
the version-coupled friend scheduler seam; workers/WASM remain future internal
optimizations with no permission to change observable behavior. Exact behavior lives in
`docs/design/animation-contract.md` and the authoring guide is
`docs/site/learn/guides/signals-and-animation.md`.
