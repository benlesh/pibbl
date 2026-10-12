# Plan 005 — Package consolidation

> **Historical status: IMPLEMENTED.**

Status: complete and verified, 2026-10-02. This plan governs the
package migration requested in this chat; preserve concurrent HtmlBox work and
its active plan record. No publishing or push is requested.

## Scope and decisions

Consolidate particles, visualization, textures, and physics into `@pibbl/core`
subpaths. Remove `@pibbl/types`. Keep `@pibbl/three` separate and scenarios private.
Keep root, filters, JSX, types, and internal entries. No forwarding packages.
Rapier is a private bundled build dependency, never a consumer install dependency.
Geometry and core imports must retain no Rapier code or embedded WASM.
This is developer-experience maintenance, not a new strategy initiative.

## Status board

| Step                                       | State |
| ------------------------------------------ | ----- |
| Physics and bundle-check slice             | Done  |
| Remaining modules and repository migration | Done  |
| Documentation and final verification       | Done  |

## [DONE] Physics and bundle-check slice

Add failing public-entry bundle checks, consolidate physics preserving runtime
identity and inert core/geometry graphs, and migrate an existing public example.
Done when focused checks pass and the Studio example is available with its URL.
The user authorized completing all work without another approval checkpoint.

## [DONE] Remaining modules and repository migration

Move first-party sources, tests and assets into core; update exports, declarations,
Studio, aliases, consumers, release configuration and lockfile. Remove obsolete
packages. Preserve existing tests and unrelated working-tree changes.

## [DONE] Documentation and final verification

Update current documentation and migration guidance, preserving historical plans.
Run focused checks, packed Bundler/NodeNext and identity checks, then aggregate
trust under Node 24.15+ and pnpm 11.21.0. Reuse public scenarios and their existing
headless semantic/visual evidence; this migration adds no visual behavior.

## Bundle contract

Three esbuild production fixtures against built entries: core drawing, pure
2D/3D geometry, and working physics. Assert retained engine inputs and embedded
WASM absence/presence, report minified/gzip sizes, and enforce generous ceilings.
Keep the command fast after build; no new bundler matrix or benchmark framework.

## Session log

- 2026-10-02: Inspected current package/build boundaries and dirty checkout.
  Rapier is already bundled but also declared as a runtime dependency. Added
  the three public-entry checks before implementation.

- 2026-10-02: Core and Three builds pass. The three esbuild fixtures pass:
  118,192/35,416 core, 50,900/16,420 geometry, 3,682,203/1,358,268 physics
  (minified/gzip bytes). Core and geometry contain no Rapier/WASM.
  Focused public physics browser suites pass (2 tests). Packed Bundler/NodeNext,
  export boundary, one-core and one-Three identity checks pass. Studio renders
  at http://127.0.0.1:5182/#/examples/composition/physics-2d without runtime or
  editor errors. Browser plugin unavailable; verified with Playwright Chromium.

## Completion evidence — 2026-10-02

The full `corepack pnpm@11.21.0 trust` command exited successfully under
Node 24.15.0, pnpm 11.21.0, and Playwright Chromium. The complete output is retained
in [the trust log](../testing/package-consolidation-evidence/trust.txt).

- Core is the only first-party feature package; Three remains an external-renderer
  adapter. All 216 moved source/test/type/assembly files are present at their new
  locations. Retired package manifests, including `@pibbl/types`, are gone.
- Public subpaths, strict packed Bundler/NodeNext consumers, shared core/Three
  identity, private boundaries, source/built Studio, and editor declarations pass.
  Rapier is only a build dependency, with its bindings, WASM, and license included
  in the shipped core artifact. No upstream Rapier type or runtime import leaks.
- The three built-entry bundle checks pass in 0.21 seconds on this machine after
  build. Core and geometry exclude Rapier and embedded WASM; physics includes both.
  [Retained sizes and timing](../testing/package-consolidation-evidence/bundle-sizes.txt).
  Existing optional-feature source/packed esbuild/Vite and inert-import checks pass.
- Browser suite: 3,425 passed and five existing skips. Eight Studio visual baselines
  match without replacement; documentation navigation/search and built smoke pass.
  Lifecycle suite: 32 passed. Structural performance: 48 passed and four opt-in skips.
- Current documentation, migration guide, snippets, links, exports, and all
  preservation mutation probes pass. Historical reports retain their original bytes.
  Fresh affected-requirement checks and native replays accompany the updated ledger.
  The previously unregistered weighted-electric contract is pinned to exact committed
  bytes, with missing/changed-contract rejection checks, rather than an invented
  design approval. Existing texture/WASM mapping offsets were reconciled with their
  already-recorded design clarification.
- The reported physics-ball teleport was reproduced, fixed, and verified through
  the actual public lesson with both a regression and native browser dragging.
  The broad run also exposed two catalog-action setup omissions, an unfinished
  existing ripple-strength control, and a real-clock-dependent particle replay
  assertion. These are corrected; the replay uses fixed frame durations and keeps
  its spatial-overlap threshold unchanged.

No commit, publish, or push was performed for this migration. Concurrent HtmlBox
implementation and its active plan are preserved.
