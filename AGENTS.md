# CRC working context for coding agents

This file is the compact operating model for work in this repository. It
summarizes the current code and approved contracts; follow the linked sources
when a task needs exact behavior or historical evidence.

## Product and current state

CRC is a small functional component runtime over the HTML Canvas 2D API. It
provides scheduled rendering, hook state, mouse-region interaction, transforms,
clipping, offscreen layers, and composable drawing primitives without JSX.

- Project Plans 001 and 002 are complete.
- Project Plan 003, First-Class Style and Layout, is active. Its sole `[NEXT]`
  marker and status board control implementation order.
- The local `_bmad-output/` directory remains discovery input, not normative
  behavior. Plan 003's approved design, architecture, and implementation plan
  supersede its earlier layout proposals where they differ.

## Source-of-truth order

When sources disagree, use this order and call out material drift:

1. Current public code, package manifests, and executable tests for shipped behavior.
2. Active Plan 003 plus its approved design and architecture for new work.
3. Implemented design contracts under `docs/design/` and the trust-gate rules.
4. Completed numbered plans and their dated field notes as historical evidence.
5. The draft Plan 003 PRD, extraction files, and memlogs as discovery evidence,
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
- `docs/testing`: trust-gate policy, evidence, and historical field notes.
- `docs/project-plans`: executable-plan workflow and completed plans.

## Current runtime model

- `crc(canvas, root, options?)` owns at most one live mount per Canvas and
  returns a stable controller with idempotent `dispose()`.
- Updates are coalesced and rendered on `requestAnimationFrame`. A normal render
  clears the Canvas and synchronously traverses the full component tree.
- Components are ordinary TypeScript functions created through `defineComp`.
  The public surface is exported from `@crc/core`; supported code must not import
  `@crc/core/lib/*` or source paths.
- Component identity is derived from parent path, component-function identity,
  and optional sibling key. Unkeyed same-type siblings use occurrence order.
  Reparenting or adding a wrapper can remount a subtree; keys do not preserve
  identity across parents.
- Canvas state is isolated with save/restore around component traversal. Render
  failure tears down runtime-owned resources and clears component refs; pixels
  already painted earlier in the failing frame are not rolled back.
- Source traversal is paint order. Mouse targeting walks the shared paint ledger
  in reverse and selects one topmost logical region.
- `g` composes Canvas transforms. Interaction regions, clips, and layers capture
  the same transform/clip geometry, so paint and hit testing must stay aligned.
- Offscreen `layer` instances share the root interaction state and participate in
  global paint/target order. They require browser `OffscreenCanvas` support.
- Runtime resources have one explicit owner and exact teardown semantics. Prefer
  deterministic ownership counters to heap or garbage-collection timing.

## Public surface and deliberate boundaries

Public runtime/components: `crc`, `defineComp`, `rect`, `path`, `line`,
`horizontalLine`, `verticalLine`, `svgPath`, `text`, `img`, `g`, `clip`, and
`layer`.

Public hooks: `crcState`, `crcMemo`, `crcRef`, `crcWhenChanged`, `crcRectPath`,
`crcLinePath`, `crcSvgPath`, `crcEvent`, and `crcCursor`.

Current interaction is mouse-only. CRC does not currently promise pointer/touch,
keyboard/focus, DOM accessibility, JSX, layout, rich text, image CORS policy,
CSS compatibility, scrolling, WebGL, or a retained scene graph. Browser behavior
remains authoritative for Canvas/`Path2D`, font rasterization and measurement,
decoded-image behavior, and `OffscreenCanvas` availability.

Read the exact contracts before changing these areas:

- `docs/design/runtime-hooks-contract.md`
- `docs/design/drawing-components-contract.md`
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
- Preserve `g` semantics, source paint order, root-intrinsic mouse coordinates,
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
change. The aggregate gate covers catalog consistency, typecheck, lint/format,
package and playground builds, packed consumers, browser and visual suites,
built smoke, lifecycle cleanup, and structural performance evidence. Controlled
wall-clock performance guards are opt-in and are not a default correctness gate.

Do not claim a verification result from documentation alone. Report the command,
environment, and fresh output, or label older evidence with its date.

## Active Plan 003: approved direction, not shipped behavior

Plan 003 replaces visual props with one typed local style language and adds
dedicated absolute, overlay, flow, Flexbox-subset, and Grid-subset layout
components. It preserves immediate-mode rendering and uses declared boxes plus
pure opt-in measurement rather than a retained display list.

The proposal preserves the immediate-mode Canvas2D renderer, existing `g`, source
paint order, identity/lifecycle rules, and public package boundary. A parent-local
anchored native color input and a 100,000-record windowed list are proving
scenarios only; they do not authorize public popover or virtualization APIs.

Auto-placement Grid, advanced intrinsic CSS sizing, reverse/reordered Flexbox,
margin, scrolling, DOM overlays/accessibility, broader input, workers/WebGL, and
a retained scene graph remain deferred. Exact approved contracts live in:

- `docs/superpowers/specs/2026-08-17-style-and-layout-design.md`
- `docs/architecture/style-and-layout-architecture.md`
- `docs/superpowers/plans/2026-08-17-style-and-layout-implementation.md`
- `docs/project-plans/003-first-class-style-and-layout.md`
