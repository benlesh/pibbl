# Optional-feature audit — 2026-10-01

This audit records the optionality of existing feature families at base commit
`c838c434`. It is evidence for a follow-up audit, not a claim about the
tree-shakeable filter implementation, which was not present when these bundles
were built.

## Environment and method

- Checkout: managed `filter-plan-review`, detached at `c838c434`.
- Node: `v24.15.0` from the provisioned Node 24 executable.
- pnpm: `11.21.0`; dependencies were installed offline from the lockfile.
- Bundler: esbuild `0.28.2`, browser platform, ESM format, ES2022 target,
  `treeShaking: true`, and `minifySyntax: true`.

Each probe imports one public value and assigns it to `globalThis.keep`, so the
selected public value cannot be eliminated. Results use esbuild `metafile`
`bytesInOutput` attribution. The source probes resolve public specifiers to
`packages/*/src`; the packed probes resolve them to the just-built
`packages/*/dist` artifacts. `three`, Rapier, and `@crc/types` were external
where appropriate, so these figures do not include their peer dependency bytes.

The source and packed JSON evidence is retained in the review run's temporary
directory as `crc-optional-feature-audit*.json`; this field note records the
relevant observations without treating temporary files as repository artifacts.

## Observations

| Public probe | Source bundle | Packed consumer bundle | Evidence and implication |
| --- | ---: | ---: | --- |
| `tween` | 11,029 B | 432,389 B | Source retains animation definition/easing only; packed core retains `index.mjs` (151,899 B) plus shared chunk (274,833 B). |
| `spring` | 9,172 B | 433,298 B | Source isolates spring implementation; packed core does not preserve that boundary. |
| `stepper` | 1,865 B | 425,584 B | Source isolates stepper; packed core does not preserve that boundary. |
| `Flow` | 133,115 B | 423,797 B | Source retains `flow.ts` and no `grid.ts`; current base-core filter pipeline accounts for 30,479 attributed source bytes across validator, region, capture, pool state, and backend. |
| `Grid` | 137,754 B | 423,797 B | Source retains `grid.ts` and no `flow.ts`; packed output is byte-identical to the Flow probe. |
| `defineRenderLayer` | 215,469 B | 444,699 B | Render-layer code is selected, and source has no `packages/three` input. Core does not pull the Three adapter, but it currently pulls filters. |
| `defineThreeLayer` | 233,413 B | 462,428 B | Adds 17,605 B of packed `@crc/three` adapter code over render-layer; `three` remains an external peer. |
| 3D geometry `sphereShape3D` | 1,839 B | 4,395 B | Geometry stays separate from the 2D runtime and Rapier. |
| 2D geometry `circleShape2D` | 5,391 B | 5,565 B | Geometry stays separate from the 2D runtime and Rapier. |
| 2D runtime `PhysicsWorld2D` | 444,928 B | 4,251,044 B | The runtime is intentionally large and includes the Rapier payload in its packed artifact; it is absent from geometry probes. |
| `Axis` | 121,699 B | 434,794 B | Source selects Axis without LineSeries; packed viz/core artifacts erase that granularity. |
| `LineSeries` | 105,718 B | 435,072 B | Source selects LineSeries without Axis; packed viz/core artifacts erase that granularity. |
| `particleRange` | 5,898 B | 434,151 B | Source selects the parameter helper only; packed particles pulls the prebundled core root. |
| `Particles2D` | 362,486 B | 584,559 B | Runtime is selected only for the component probe. |

## Findings

1. **Core's current packed output defeats downstream feature-level
   tree-shaking.** `packages/core` bundles `src/index.ts` into `dist/index.mjs`
   and a 328.6 kB shared chunk. A downstream esbuild consumer retains roughly
   425–445 kB for every sampled core export, including `stepper`, `Flow`, and
   `Grid`. Source bundling proves the source modules are generally separable;
   the packed build topology is the blocker.

2. **Current filters are a base-core cost.** A source `Flow` import retains
   `filter.ts` (5,237 B), `filter-region.ts` (9,986 B),
   `render-filter-boundary.ts` (4,204 B), `canvas-state.ts` (1,052 B), and the
   filter-reachable Canvas backend. This directly supports the approved filter
   refactor. It is a baseline only; it does not measure the new subpath.

3. **Several package boundaries already work at source level.** Physics geometry
   does not include the runtime; core's generic render layer does not include
   `@crc/three`; and selected animation/layout/viz/particle source exports do
   not retain unrelated sibling implementation modules. These are useful
   positive controls for the filter harness.

4. **The public package builds for core, particles, textures, and viz need
   separate follow-up decisions if 'tree-shakeable by default' is a product-wide
   promise.** Their prebundled root artifacts flatten source-level boundaries
   before the application bundler sees them. This is outside the accepted filter
   slice, except that `@crc/core/filters` must avoid repeating it.

## Actionable follow-ups

- For this filter work, make `@crc/core/filters` a real built/exported entry and
  prove packed esbuild and Vite consumers exclude it from an observable plain
  core mount. If prebundling retains the filter modules, preserve affected ESM
  modules or otherwise change the package output before claiming success.
- Add a product-level package-output decision for core's unrelated optional
  families (animation, layout, render layers), viz, particles, and texture
  recipes. Do not claim they are tree-shakeable from `sideEffects: false` alone.
- Retain the physics geometry/runtime and core/Three probes as positive controls
  in that future audit. Investigate the packed 2D-geometry warning about a bare
  chunk import marked side-effect-free before changing its build.
- Re-run this matrix on the integrated head, with the same Node/pnpm/bundler
  versions and emitted chunks/assets included, after filter work and any package
  output changes.
