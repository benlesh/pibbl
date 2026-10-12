# Geometric textures: feedback slice, 2026-10-12

> **Historical status: Dated verification evidence; current code and fresh checks define shipped behavior.**

Environment: Node v26.9.0, pnpm 11.21.0, Playwright Chromium. The documented
reference environment remains Node 24.15+.

Public factories: `polkaDots`, `halftone`, `plaid`, `truchet`; immutable
`plaidPresets` supplies gingham, tartan, and windowpane. Return contracts are
`TextureRecipe<never>`. Plaid keys infer from `colors` with `NoInfer` on band
references; type fixtures reject unknown strings and numeric selectors. Ordered
color ramps and band sequences deliberately remain arrays. Existing textures,
visualization color ranges, and GIF encoding palettes were audited; no shipped
texture selector by numeric color/resource index needed migration.

All samples are periodic, including animation, with matching raster borders.
Edge coverage uses a raster-sized smooth transition for dots/arcs and exact box
integration for plaid bands. Pattern animation uses the existing shared scheduler,
with zero speed idle and no separate timer. Disposal clears owned raster buffers.

Truchet geometry was checked against David Dunham's primary conference diagrams:
<https://www.d.umn.edu/~ddunham/amsdun.pdf>. The two orientations use opposed-corner
quarter circles with endpoints at all four edge midpoints. Unequal cell dimensions
produce elliptical arcs while preserving those connections. Plaid presets are
geometric color patterns, not claims of physically simulated yarn interlacing.

Focused browser evidence was added first: four tests initially failed because the
public factories did not exist. An unrelated documentation-plugin failure required
a temporary config excluding that plugin for the initial red/green loop. The normal
runner worked again after concurrent chart files were restored.

Fresh checks:

- `VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack pnpm@11.21.0 exec vitest run packages/core/test/features/textures/geometric-recipes.test.tsx packages/core/test/features/textures/geometric-explorer.test.tsx packages/core/test/features/textures/pattern-recipes.test.tsx --browser.headless --browser.ui=false`: **16 passed**, 3 files.
- New geometric suites with `--mode built`: **5 passed**, 2 files.
- `corepack pnpm@11.21.0 --filter @pibbl/core build`: passed.
- `node tooling/verify-packed-textures.mjs`: passed Bundler/NodeNext inference,
  runtime exports, shared core identity, and private boundaries.
- Scenario source discovery and catalog/index regeneration: passed.
- Scoped ESLint: passed.
- Whole-checkout typecheck and public JSDoc checks encountered concurrent editable
  chart work errors; no geometric type errors or JSDoc findings remained after
  repairing this slice. No aggregate trust gate is claimed.

Rendered QA used regular Playwright because the Browser plugin was unavailable.
Flow: Studio geometric explorer → every model and preset → named color editing,
rename with reference updates, band editing, motion/stop → mobile model selection.
All twelve presets produced distinct previews within their family. Page identity,
meaningful rendering, absence of error overlays, console health, screenshots, and
interactions passed. Desktop 1440×1200 and mobile 390×844; mobile document width
remained 390. All inputs are application-owned HTML hosted through public HtmlBox.
Native input listeners are aborted on form rebuild or mount disposal. Switching
texture algorithms creates a keyed resource owner.

Studio URL: <http://127.0.0.1:5218/#/examples/composition/geometric-explorer>.
QA scripts and screenshots are under `/tmp`, outside committed source. This is a
slice ready for experiential feedback, not an aggregate feature-completion claim.

## Main integration after user approval

The user approved the geometric slice and requested merging all of this thread's
texture work into main. A clean integration branch replayed the five texture
commits onto `origin/main` without the interleaved chart commits or dirty work.
Generated lesson counts were reconciled to 113. The plan listing retains only
this texture work and existing completed plans.

Fresh integration checks: 24 browser tests across all nine texture/emboss files
passed; whole-checkout TypeScript, public JSDoc, core build, packed texture
Bundler/NodeNext consumers, and scenario discovery/catalog checks passed. The
documentation gate identified missing imports in the plaid example and a required
historical plan banner; both were repaired. No aggregate trust pass is claimed.
