# Noise and image composition feedback slice

Date: 2026-10-12. Environment: Node v26.9.0, pnpm 11.21.0, Playwright Chromium.
This is a runnable slice for feedback, not the aggregate trust gate.

The public contract covers distinct soft/ridged periodic fields, deterministic
seeds, periodic motion, and zero-speed idling. The public recipe test failed for
missing factories before implementation. A public learning example adds image
composition through an app-owned multiply primitive. Its surface switch uses a
keyed texture owner; no new blend/filter runtime API is introduced.

Fresh evidence:

- Focused Chromium run of `pattern-recipes.test.tsx` and
  `material-overlay.test.tsx`: 12 passed. Includes seams during motion,
  seeds, control changes, exact restoration at the same image position,
  blend isolation, and idling. The two separately translated uncoated SVG
  copies differ by up to two channel levels from Canvas rasterization.
- Core build passed; packed texture consumer verifier passed for Bundler,
  NodeNext, runtime exports, core identity, and private boundaries.
- Scoped ESLint passed. Studio editor reports no TypeScript issues.
- Browser plugin not available; regular Playwright exercised
  `http://127.0.0.1:5218/#/examples/composition/material-overlay` at desktop
  and 390px mobile width. Strength, tile, surface, pigment, seed, and motion
  changed pixels; no console or page errors; mobile document width 390px.
  Screenshots: `/tmp/pibbl-material-default.png`,
  `/tmp/pibbl-material-adjusted.png`, `/tmp/pibbl-material-mobile.png`.

Concurrent work prevents clean repository-wide evidence: catalog generation
rejects the unrelated financial-calendar-ranges source contract; full typecheck
finds an unrelated missing financial-trend-volatility scenario import; the public
JSDoc check reports an unrelated numeric-range-interpolation link. Those files
were preserved. No full trust result is claimed.

## Highlight feedback

2026-10-12: the user requested highlights to complement the darkened canvas.
The example now has a default-on highlight toggle and a separate app-owned screen
scope. Matching recipe geometry, seed, and tile size align warm crown highlights
with the multiply layer. A black lower palette suppresses light in texture gaps;
muted warm upper tones and half-strength opacity avoid a full-image wash.
Both passes scale with overall strength, including zero.

The focused public example test first failed because highlights changed no pixels,
then passed with the implementation. It checks that the highlight pass raises
pixels relative to shadows alone, brightens some pixels beyond the clean image,
restores the same-position image exactly at zero, and isolates Canvas blend state.
Full typecheck and scoped ESLint passed on this revision. Regular Playwright
checked the highlight toggle and existing controls with desktop/mobile screenshots
and no browser errors; `/tmp/pibbl-material-highlights.png` records the default.

## Height-derived emboss feedback

The user correctly identified that brightness-selected highlights do not depict
raised thread surfaces. This revision replaces those passes with the public
`emboss(map, options)` filter. The grayscale weave is now a height map; neighboring
samples derive a normal, which receives directional diffuse lighting. Flat height
is neutral, opposing slopes brighten/darken, and alpha is preserved. GPU processing
reuses the existing optional lighting surface/cache machinery and reads no scene
pixels back. Its mount-owned processor has independent teardown and recovery.

The example offers Relief on/off and four light directions. This supersedes the
previous screen palette highlight mechanism. Pigment variation remains independent.
A focused public test failed for the missing emboss factory before implementation,
then passed. Six source tests cover emboss semantics, the composed example, and
existing reflected-light behavior. Typecheck, scoped lint, public JSDoc, core build,
and the example source contract pass. Playwright (Browser plugin unavailable)
verified desktop/mobile controls and no browser errors; the default preview is
`/tmp/pibbl-material-emboss.png`. This remains a feedback slice; broader validation
and lifecycle/edge-case hardening follow acceptance.

## Commit checkpoint

The user approved and authorized committing this slice on 2026-10-12. Catalog
regeneration and public JSDoc validation pass. A final browser rerun cannot start
because concurrent financial aggregation exports lack API documentation; current
full typecheck finds an unused `Path` import in financial-live-monitor. Earlier
source and built lighting/example checks and packed consumers passed as recorded
above. Those unrelated changes are excluded from this commit. No aggregate trust
result is claimed.
