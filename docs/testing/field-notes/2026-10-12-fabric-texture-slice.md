# Woven fabric texture feedback slice

Date: 2026-10-12. Status: accepted by the user; proportional checks recorded below, aggregate trust not claimed.

The accepted first collection was committed as `2a865105`. The user authorized
continuing with the next set. This slice starts the recorded fabric family:
plain weave, two-over/two-under diagonal twill, and reversing herringbone.
Factories are separate fixed-return public operations with shared `FabricOptions`.
Colors and resolution belong to `useTexture`; repeat size/rotation belong to paint.
Thread count is a multiple of eight; thread width, relief, fine fiber variation,
seed, phase, and speed are configurable. No second animation scheduler.

## Verification

Environment: Node v26.9.0, pnpm 11.21.0, Playwright Chromium. The flow under test is
Fabric Explorer → palette/tile/thread/width/relief/fuzz/seed/motion controls →
changed seamless woven output, with zero pending frames after stopping motion.
Browser plugin unavailable; used regular Playwright under frontend testing skill.

- Test first: public fabric contract failed for missing factories before production
  implementation. Added evidence verifies distinct output, both repeat seams,
  width/seed changes, and static idle. Existing wood/pattern checks still pass.
- `corepack pnpm@11.21.0 exec vitest run` selecting pattern-recipes and
  fabric-explorer with headless Chromium: **9 passed across 2 files**.
- Exact fabric-explorer test with `--mode built`: **1 passed**.
- `corepack pnpm@11.21.0 --filter @pibbl/core build`: passed.
- `node tooling/verify-packed-textures.mjs`: Bundler, NodeNext, runtime exports,
  shared core identity, private boundaries passed.
- Scoped ESLint for fabric implementation/tests/example: passed.
- Catalog index regenerated: 121 lessons, 12 tutorials, 33 test labs at this run.
- Full typecheck encountered unrelated financial-comparison test callback errors
  and a then-missing financial-relative-performance example. Public JSDoc check
  encountered unrelated missing documentation tags/links in financial-comparison.
  No clean aggregate typecheck, documentation gate, or trust result is claimed.

## Rendered evidence

URL: <http://127.0.0.1:5218/#/examples/composition/fabric-explorer>.
At desktop 1440×1050 the title and route match, canvas paints, editor reports no
TypeScript issues, no overlay, and no console/page errors. Every listed control
changed texture pixels; motion continued changing output until stopped. Inspected
`/tmp/pibbl-fabric-default.png` and `/tmp/pibbl-fabric-adjusted.png`: alternating
plain crossings, diagonal twill, reversing chevrons are distinct; rounded relief
and dense colored threads remain visible. At 390×844 there are no runtime errors
or horizontal page overflow (scroll width 390); controls scale small as in the
existing fixed-canvas examples. Only Chromium checked. Fine fibers may alias at
small display sizes. Fuzz is tonal microvariation, not physically simulated fuzz.

Temporary evidence only; no visual baseline changes. Recipe edge/validation,
ownership/performance hardening and further fabrics follow hands-on feedback.

## Reference and softness revision

User feedback requested checking real weave drafts and making enlarged cloth less
crisp/pixelated. Read [CottonWorks Basic Woven Fabric Designs](https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/)
and visually inspected pages 22–23 of [Weaving 101](https://cottonworks.com/wp-content/uploads/2023/03/Weaving-101.pdf).
Also inspected photographed weave families at [CottonWork](https://www.cottonwork.com/our-fabric)
and enlarged [Abraham Moon wool herringbone](https://www.moons.co.uk/herringbone-tan)
in a temporary hidden browser tab, which was closed afterward.

Plain weave's alternating 1/1 crossings and the selected balanced 2/2 twill were
correct. Herringbone needed an offset break: replace duplicated turning ends
with the illustrated harness sequence 1,2,3,4,2,1,4,3. Public-rendered tests now
read each crossing center and compare the full 8×4 herringbone draft. Plain and
twill are independently checked. This verifies yarn occlusion rather than only
checking that three images differ. The old herringbone failed that evidence.

Binary yarn silhouettes caused abrupt steps. Replace them with smooth fractional
coverage, fuzzy irregular radii, directional fiber noise, lighter gap shading,
and lower relief contrast. Remove the per-cell shadow that chopped continuous
floats into blocks. The Explorer uses 512² textures and starts at Fuzz 50%; public
recipe default remains 20%. It remains a stylized woven material, without cloth
physics, exact spectral material matching, or strand-level simulation.

Test first: crossing/draft and soft-edge tests both failed on the earlier renderer.
After the final revision, **11 source tests passed across 2 files** and the **built
Fabric Explorer test passed**. Core build, full typecheck, public JSDoc, scoped
ESLint, and diff whitespace checks pass; the earlier financial type/doc errors
were resolved by concurrent work. No aggregate trust result is claimed.

Final Studio verification: correct title/URL, painted output and no overlay,
no console/page errors, no editor TypeScript issues at 1440×1050. All eight
controls changed real output. Inspected the 256px enlarged repeat size, normal
128px size, and 64px size; fibers and soft silhouettes remain visible. At 390×844
no errors or horizontal overflow (scroll width 390), with the existing small
controls. Evidence: `/tmp/pibbl-fabric-soft-large.png`,
`/tmp/pibbl-fabric-soft-adjusted.png`, `/tmp/pibbl-fabric-soft-mobile.png`.
Only Chromium checked. Fine texture can still alias at extreme combinations of
small raster/display size and many threads. No visual baseline changes.

The user's painted-canvas image idea is noted as a future composition example:
subtle darkening for valleys, restrained highlights for thread tops. This aside
does not add a new filter API to the current fabric slice.
