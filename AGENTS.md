# CRC working context for coding agents

This file is the compact operating model for work in this repository. It
summarizes the current code and approved contracts; follow the linked sources
when a task needs exact behavior or historical evidence.

## Product and current state

CRC is a small functional component runtime over the HTML Canvas 2D API. It
provides automatic JSX and equivalent `createElement` authoring, scheduled
rendering, hook state, DOM-aligned user events, transforms, clipping, offscreen
layers, typed first-class filters, and composable drawing primitives without
React or generated DOM.

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
- The local `_bmad-output/` directory remains discovery input, not normative
  behavior. Plan 003's implemented design, architecture, contracts, and
  implementation record supersede its earlier layout proposals where they
  differ.

## Source-of-truth order

When sources disagree, use this order and call out material drift:

1. Current public code, package manifests, and executable tests for shipped behavior.
2. Implemented design contracts under `docs/design/` and the trust-gate rules.
3. The implemented JSX-authoring design and current style/layout architecture
   for exact authoring, style, and layout intent.
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
- `packages/scenarios`: private learning examples and deterministic test-lab
  scenarios. Keep their catalogs and presentation metadata separate.
- `packages/types`: deliberately minimal compatibility package; shared public
  types do not belong here until a concrete need justifies them.
- `playground`: the interactive examples studio and the separate automated-test
  laboratory UI.
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
- Updates are coalesced and rendered on `requestAnimationFrame`. A normal render
  clears the Canvas and synchronously traverses the full component tree.
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
- Canvas state is isolated with save/restore around component traversal. Render
  failure tears down runtime-owned resources and clears component refs; pixels
  already painted earlier in the failing frame are not rolled back.
- Source traversal is paint order. Coordinate-event targeting walks the shared
  paint ledger in reverse and selects one topmost logical target.
- `Group` composes Canvas transforms. Interaction regions, `Clip`, and `Layer` capture
  the same transform/clip geometry, so paint and hit testing must stay aligned.
- Offscreen `Layer` instances share the root interaction state and participate in
  global paint/target order. They require browser `OffscreenCanvas` support.
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

## Public surface and deliberate boundaries

Public runtime/authoring: `crc`, `createElement`, `Fragment`,
`definePrimitive`, and `crcCanvasContext`; drawing and composition components
`Rectangle`, `Path`, `Line`, `HorizontalLine`, `VerticalLine`, `SvgPath`,
`Text`, `Image`, `Group`, `Clip`, and `Layer`; layout components `Absolute`,
`Overlay`, `Flow`, `Flex`, and `Grid`; focus policies `FocusManagement` and
`KeyboardNavigation`; and pure `measureElement` plus the public element, node,
primitive, style, length, box, constraint, and measurement types. Surface
configuration is public through `CRCConfig`,
`CRCFit`, `CRCPixelRatio`, and the fixed/responsive configuration types.
Directional configuration is public through `CRCKeyboardNavigationOptions`.
Filter configuration is public through `CRCFilter` and the ten named
`CRCBlurFilter`, `CRCBrightnessFilter`, `CRCContrastFilter`,
`CRCDropShadowFilter`, `CRCGrayscaleFilter`, `CRCHueRotateFilter`,
`CRCInvertFilter`, `CRCOpacityFilter`, `CRCSaturateFilter`, and
`CRCSepiaFilter` descriptor types.

Public hooks: `crcState`, `crcMemo`, `crcRef`, `crcWhenChanged`, `crcRectPath`,
`crcLinePath`, `crcSvgPath`, `crcEvent`, `crcEventTarget`,
`crcEventListener`, `crcCursor`, and `crcLayoutBox`.

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
graphs, `backdrop-filter`, `boxShadow`, scrolling, workers/WebGL, or a retained
scene graph. Nonempty filters require browser `OffscreenCanvas` and Canvas
`filter`; `[]` is a no-op with no filter capability requirement. Browser
behavior remains authoritative for Canvas/`Path2D`, font
rasterization and measurement, decoded-image behavior, and `OffscreenCanvas`
availability.

Read the exact contracts before changing these areas:

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
overlays/accessibility, workers/WebGL, and a retained scene graph remain
deferred. Exact implemented contracts and records live in:

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
`crcCanvasContext`, and `definePrimitive`. It also added compiler subpaths,
mixed-runtime boundaries, actionable foreign-runtime diagnostics, TSX Studio
execution, and a complete JSX/non-JSX learning catalog.

There is no React dependency, global JSX namespace, classic-transform contract,
async component support, lowercase intrinsic vocabulary, or compatibility
alias for removed authoring values. Current guides and the API reference live
under `docs/guides/` and `docs/api-reference.md`; the approved design and
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
