# Parameterized textures — first feedback slice

Date: 2026-10-09. [Plan 009](../../project-plans/009-parameterized-textures.md).
Status: slice ready for feedback; not feature-complete.

## Manual procedure

Open <http://127.0.0.1:5218/#/examples/composition/texture-explorer> while the
source Studio server is running. Compare one tile and repeated fills. Change
palette and tile size; enable motion; change stripe bands/waves, checker counts,
hair curl/clumps/seed. Try spots, stripes, coral, worms, labyrinths, and mitosis.
Pause ink, switch its preset, reseed, and paint its single tile. Geometric motion
and living ink have independent controls. Warmup starts ink at 1,800 steps.

Expected: controls change the corresponding field or placement; recoloring and
retile preserve ink; preset/reseed establishes a new field; all paused/static
resources stop scheduling. Recipe-specific parameter ranges are in the public
pattern API. All application imports use supported public entries.

## Fresh verification

Environment: Node v26.9.0, pnpm 11.21.0, Playwright Chromium. This host is newer
than the documented Node 24 LTS reference environment; no Node 24 run is claimed.
Browser plugin not available; regular Playwright used under frontend testing skill.

- Initial public-contract browser test: four expected failures for missing
  stripes/checkers/hair/grayScottPresets exports, before production changes.
- `corepack pnpm@11.21.0 exec vitest run` selecting pattern-recipes,
  texture-explorer, simulation, wasm-recipes, and public-smoke with headless
  Chromium: **29 passed across five files**.
- `corepack pnpm@11.21.0 exec vitest run
packages/core/test/features/textures/public-smoke.test.tsx --mode built
--browser.headless --browser.ui=false`: **2 passed**.
- `corepack pnpm@11.21.0 --filter @pibbl/core build`: passed.
- `node tooling/verify-packed-textures.mjs`: passed Bundler, NodeNext, runtime
  exports, shared core identity, and private boundaries.
- `corepack pnpm@11.21.0 typecheck`: passed. An earlier run encountered two
  unrelated financial-inspection test errors; concurrent financial work fixed
  them before the final successful run.
- Scoped ESLint for texture source, new tests, smoke, and example: passed.
- `node tooling/verify-public-jsdoc.mjs`: passed all 50 entries.
- `node --import tsx --test tooling/texture-wasm-spike/production.check.mjs`:
  **2 passed**, including original spots/stripes numerical parity.
- `node --import tsx tooling/scenario-source-discovery.check.ts` and
  `node --import tsx tooling/scenario-catalog.ts`: passed. Catalog index regenerated
  from the current catalog, preserving concurrent examples.
- `corepack pnpm@11.21.0 docs:check`: blocked by the unrelated unclassified
  `docs/strategy/agent-verification-evidence/public-inspection-pilot-2026-10-09/README.md`.
  The new texture API page was added to current-document classification.
- No aggregate trust result is claimed; broad hardening follows visual feedback.

## Rendered QA

Flow: Studio route → palette/tile/geometry/motion/preset controls → changed
texture output. Headless integration imports and drives the exact learning source,
checking rendered control labels, changed pixels, and zero pending host frames
when all motion is stopped. Separate recipe tests check stripe/checker geometry,
periodic raster edges, seeded hair variation, distinct Gray–Scott fields, and
explicit coefficients reproducing a curated preset.

Real Studio QA at 1440×1200: correct URL/title, meaningful content, no overlay,
no console/page errors, editor reports no TypeScript issues. Palette click changed
a stripe pixel from [32,25,35,255] to [9,43,50,255]. Motion changed stripe pixels.
390×844 viewport: no errors or horizontal page overflow (scroll width 390).
The fixed-size canvas scales down on mobile; controls are small. Desktop is the
recommended first-feedback surface. Captures are temporary files under `/tmp`,
not visual baselines; no baseline was rewritten.

## Quirks and limitations

- Restricted sandbox blocked local test-server ports and tsx IPC. Browser runs
  used approved escalation; catalog checks used `node --import tsx` to avoid IPC.
  Packed consumer installation used approved access to the existing offline store.
- Port 5197 was an unrelated existing financial preview. It was left running.
  Studio uses verified port 5218 instead.
- Studio runs examples in a preview iframe. Wait for editor typechecking AND iframe
  attachment/painting; parent-page editor canvases are not scene evidence.
- Synthetic click-only dispatch did not exercise this focus-managed scene properly;
  the integration driver uses real browser clicks. Manual scheduler flushing stops
  when no host frame is pending, making idle state explicit.
- Hair initially looked fragmented at low raster resolution; the explorer uses
  256×256 patterns. Very small repeated tiles still produce fiber aliasing/moiré.
- Warmup is synchronous and bounded to 4,096 steps but large grids can delay mount.
- Gray–Scott names describe characteristic regimes, not guaranteed morphology.
  Simulation neighbor evolution wraps; existing painting clips and stirring clamps.
  Interactive wrapping, loop export, model expansion, composition/search, and
  exhaustive ownership/performance checks remain later work.

## 2026-10-11 feedback revision: wood grain

The user liked the first collection, recognized the strand study as wood, and
requested optional knots and less regular curves. The unreleased `hair` factory
and `HairOptions` were replaced with `woodGrain` and `WoodGrainOptions`, without
aliases. Actual hair/fur remains in the catalog backlog. Wood uses three scales
of periodic seeded lattice noise to bend growth lines, optional elliptical knots
with local grain deflection and darker rings, and fine fiber variation. Exposed
controls include grain, distortion, roughness, knot count, knot size, seed, phase,
and speed. Zero knots yields clear wood. The Explorer starts with a warm wood
palette and two knots; its Knots button cycles 2 → 0 → 4 → 2.

Test first: renaming the public contract and adding optional-knot evidence failed
for the missing wood export before implementation. Fresh revision checks on Node
v26.9.0 / pnpm 11.21.0 / Playwright Chromium:

- Focused source browser run (pattern-recipes, texture-explorer, public-smoke):
  **9 passed across 3 files**. Includes wrapped edges with and without knots,
  seeded variation, exact clear-grain restoration, and real Explorer knot clicks.
- Built public-smoke browser run: **2 passed**.
- Core build, packed-texture Bundler/NodeNext/runtime boundaries, full typecheck,
  public JSDoc, scoped ESLint, and `git diff --check`: passed.
- Real Studio at the same 5218 URL: correct title, meaningful painted preview,
  no framework overlay or console/page errors, and no editor TypeScript issues.
  Knots, New wood seed, and Bend clicks each changed the wood pixels. Desktop
  1440×1200 and mobile 390×844 loaded; mobile scroll width stayed 390. The fixed
  canvas still scales to small controls on mobile; desktop remains preferable.
  Browser plugin not available; regular Playwright used. Only Chromium checked.
- Studio's source runtime bundle retained the earlier export until our own server
  was restarted. The refreshed server renders the renamed factory successfully.
- Screenshots inspected: `/tmp/pibbl-wood-knots.png`,
  `/tmp/pibbl-wood-clear.png`, and `/tmp/pibbl-wood-mobile.png`. Temporary evidence,
  no visual baseline changes. Appearance is stylized procedural wood; repeated
  small tiles visibly repeat knot placements, so increase tile size for variation.

This revision is ready for hands-on feedback. It does not claim the aggregate
trust gate or the deferred exhaustive ownership/performance hardening.

## 2026-10-12 feedback revision: knots displace the grain

The user identified inward pinching around knots and asked for round-to-elliptical
outlines elongated along the grain. The old positive coordinate displacement
pulled neighboring growth contours toward each knot. It is replaced with an
inverse elliptical flow coordinate: subtract a compactly tapered displacement,
so neighboring contours bow outward and return to undisturbed grain outside the
support. Each seeded knot has aspect 1–1.9 along the vertical grain. Its core has
elliptical concentric rings and a narrow smooth edge, avoiding background grain
crossing through most of the core. Wrapped offsets preserve both repeat seams.

The pattern detail preview previously stretched a square texture into a 256×112
rectangle, shortening the knot's grain-aligned axis. It now repeats square 128px
tiles at true proportions and is labeled Tile detail; the lower preview still
uses the user-selected repeat size. Ink's single-tile preview is unchanged.

Test-first evidence: a public rendered test tracks the dark growth ridge to the
right of the seed-42 knot at (0.160428, 0.980152), outside its core and across the
wrapped seam. Before the fix it moved inward to x=0.2265625 from x=0.25, failing
the outward-shift contract. It passes after the fix.

Fresh checks on Node v26.9.0, pnpm 11.21.0, Playwright Chromium:

- Pattern-recipes and exact Texture Explorer browser integration: **8 tests passed
  across 2 files**, including outward displacement, optional knots, both repeat
  seams, motion, and control interactions.
- Built public-smoke: **2 passed**. Core build, full typecheck, scoped ESLint,
  public JSDoc, and `git diff --check`: passed.
- Real Studio URL/title and painted output verified at 1440×1200. No overlay,
  console/page errors, or editor TypeScript errors. Knots, seed, and bend controls
  changed the wood output. At 390×844 the preview loaded without errors and page
  scroll width remained 390. Browser plugin absent; regular Playwright used.
- Inspected `/tmp/pibbl-wood-flow-knots.png` and
  `/tmp/pibbl-wood-flow-final.png`: rings are elliptical and aligned with the grain;
  growth lines flow around the knot rather than pinching inward. Evidence is
  temporary; no visual baselines rewritten. Small repeats still visibly repeat
  knot positions; mobile controls remain small. Only Chromium checked.

Ready for hands-on feedback at the same 5218 URL. No aggregate trust-gate or
exhaustive hardening result is claimed.
