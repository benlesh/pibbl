# First-class particle effects delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for
> the named implementation and environment, not current API guidance or
> reusable test totals.

Delivery verification date: 2026-09-16

Branch: `codex/particle-effects-foundation`

Verified implementation revision: `7261f97ffb62984e04ffc624ea177e49a4e0a4cc`

The later evidence commit changes only this note.

## Environment

- macOS `26.6.2`, arm64
- Node.js `v24.15.0`, selected with `fnm exec --using=v24.15.0 --`
- Corepack `0.34.6`; pnpm `11.21.0`
- Vitest `4.1.10`; Playwright `1.62.1`

## Delivered surface

The implementation adds the optional `@crc/particles` package with separate
root and `@crc/particles/webgl` entry points. The public definition helpers are
direct, tree-shakeable exports: `particleRange`, `particleInteger`,
`particleChoice`, `particleParameter`, `particleCurve`, and
`particleGradient`. They produce immutable particle-domain values rather than
exposing a broad `particle.*` namespace.

Canvas scenes use `Particles2D`; WebGL islands use `Particles3D`. Both consume
the same deterministic definition, emission, seed, lifecycle, and ownership
model while retaining renderer-specific shapes and execution. WebGL particles
enter the settled scene as an official instanced recipe, use camera-facing
billboards, and participate in the layer's final material, opacity, lighting,
ordering, and transactional commit. Canvas execution remains CPU-painted and
does not claim portable GPU acceleration.

The Studio includes a focused Canvas celebration example and deterministic lab,
plus distinct WebGL embers and fireflies examples. Studio declarations,
source-mode execution, built-mode execution, public documentation, search,
scenario metadata, and package-consumer fixtures all include the new package.

## Manual browser evidence

The following source-mode routes were exercised in Chromium:

- `#/testing/particle-celebration`: pointer positions are visibly marked before
  a burst; bursts render particles; controls and state use user-facing language;
  and the duplicate reset control is removed.
- `#/examples/composition/particle-effects`: the editor resolves
  `@crc/particles` and runs the Canvas example.
- `#/examples/webgl/embers`: the three-dimensional ember field renders and
  animates.
- `#/examples/webgl/fireflies`: the three-dimensional firefly field renders and
  animates.

The browser console was clean for the reviewed examples. No particle-specific
golden image was added: deterministic semantic, structural, ownership, and
package evidence covers the contract, while the three effect examples were
reviewed directly in the browser.

## Aggregate trust evidence

The final aggregate command was run once after all corrections:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust
```

It exited zero. Fresh results included:

- scenario validation for 68 lessons, 12 tutorial snapshots, and 22 test labs;
- documentation validation for 14 guides, 166 current or migration files, 84
  historical or work records, 220 parsed snippets, 77 compiler-checked API
  programs, and all 987 documentation mutation probes;
- Studio declaration and API parity for 77 core values, 176 core types, 14
  WebGL values, 33 WebGL types, 11 particle values, and 57 particle types;
- typecheck, lint, formatting, package builds, source and built Studio builds,
  Studio documentation acceptance, and production-boundary verification;
- packed Bundler and NodeNext consumers for `@crc/core`, `@crc/webgl`, and
  `@crc/particles`, including declarations, runtime exports, blocked deep
  imports, no-source checks, one shared core identity, and focus elimination;
- complete Chromium suite: 216 files, 2,795 passing tests, and 2 intentionally
  skipped tests out of 2,797 in 70.57 seconds;
- built-package smoke: 1 file and 1 test passed;
- lifecycle: 12 files and 49 tests passed in 11.25 seconds;
- structural performance: 8 files, 50 tests passed, and 2 opt-in wall-clock
  tests intentionally skipped in 3.03 seconds; and
- visual safeguard recovery, a zero-pixel diagram-editor teaser match, and all
  9 full-page Studio baselines matched.

The visual pass accepted only inspected Studio changes: the Learn and search
views include the new WebGL lighting guide, and the baseline-smoke view now
captures the CRC logo after it paints. The capture harness resets scroll before
each route and isolates the WebGL lighting document from the preceding search
dialog. Two repeated captures established pixel-identical search and lighting
images before their baselines were accepted.

## Public-boundary audit

The final raw-name scan covered particle source, built output, and packed
consumer fixtures for raw WebGL contexts, independent animation timers,
per-particle callbacks, retained active-count APIs, internal source imports, and
preset namespaces. Particle source and built output had no matches. The only
deep-import matches were existing intentional negative package-boundary probes
for core and WebGL in the consumer fixture.

The particle implementation therefore owns no independent `requestAnimationFrame`
or timer loop, exposes no raw `WebGL2RenderingContext`, and does not add a
per-particle callback or mutable retained-particle inspection surface.

Known non-fatal output is limited to Vite's future native-loader extension
warnings, ignored side-effect-free bare imports, ineffective dynamic-import
notices, and large-chunk notices.
