# WebGL lighting, orbit camera, and shadows delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for
> the named candidate and environment, not current API guidance or reusable test
> totals.

Delivery verification date: 2026-09-16

Branch: `codex/webgl-lighting-materials`

Implementation base: `a356be21ce82ed1b52aa8a2217f7cd4ea3c5d938`

Verified clean implementation revision:
`4c64f4dadf2a941850056114c3a47e44fffb7f56`

The later evidence commit changes only this note and the two implementation
plans' historical-status banners.

## Delivered scope

The completed work preserves the composition-first WebGL lifecycle: components
declare a complete CPU-side scene, settlement derives immutable render,
interaction, lighting, and shadow records, the renderer creates or reuses the
required light-space depth maps, and one color result is transferred and
transactionally committed.

The public surface now includes:

- ambient, hemisphere, directional, point, and spot lights;
- local nested Lambert materials, explicit `style.lit`, emission, custom
  geometry normals, and solid or alpha WebGL backgrounds;
- genuine directional and spot shadows with one 2D depth view, and genuine
  point shadows with six cube-map depth views;
- `false | "low" | "medium" | "high"` layer shadow quality, with the documented
  medium default and independent mesh/light participation controls; and
- `useOrbitCamera()`, which returns plain `position`, `lookAt`, and stable event
  handlers that can be attached to ordinary Pibbl event participants while the
  layer continues to receive a plain perspective-camera object.

All twelve public lighting lessons use the same base cube, sphere, plane,
camera framing, materials, and orbit target. Their concept-specific declarations
are enforced by the source contract. The deterministic lighting laboratory
covers all light/background/material modes, transformed lights, every quality
tier, alpha participation, orbit drag and wheel input, direct-shadow contrast,
six point-light faces, cache reuse, picking/focus, and disposal through public
imports.

Textures, PBR, HDR or image environments, bloom/glow post-processing, area
lights, cascades, panning, damping, autorotation, pinch gestures, raw GL access,
and public shadow camera/bias/map-size controls remain outside this delivery.

## Review and correction record

The whole-branch review compared `a356be2...HEAD` with both approved designs,
the two implementation plans, repository guidance, and settled-scene contracts.
Focused corrections covered orbit initialization and live range behavior,
unnecessary shadow work, final public-consumer inventories, package friend
exports, source-catalog expectations, normal-matrix boundary values, laboratory
types, interaction fixtures, and final integration evidence. The scoped
follow-up reviews reported no remaining Critical or Important findings.

The aggregate suite exposed contention-only timeouts in six assertion-heavy
browser tests. Commits `ce0c7bb` and `dbe9bf8` changed only their per-test
timeout allowances: three lifecycle/lighting tests received
30- or 60-second limits, and three focus/tutorial/cleanup tests received 30- or
60-second limits. Their workloads and assertions were not reduced.

The Studio shell's lazy-loaded search test had relied on a fixed delay. Commit
`92b1228` made positive cases wait for the dialog's actual open state; negative
cases retain their deliberate settling window. This was a test synchronization
repair, not a product behavior change.

Commit `4c64f4d` isolated Studio visual-capture state by scrolling the search
route to the top before opening the dialog and moving the synthetic pointer
outside actionable content before each capture. It does not alter Studio
runtime behavior. The resulting `search-open` and `test-lab` candidates were
inspected before their exact expected images were updated.

## Reviewed visual evidence

Two feature baselines were added only after inspecting their candidates:

- `webgl-lighting.expected.png` is the 720×420 deterministic laboratory canvas
  in its initial all-lights, alpha-background, medium-shadow, opaque-caster,
  lit-and-emissive state; and
- `studio-webgl-lighting.expected.png` is the 1280×2378 Studio laboratory route,
  proving the public scenario is discoverable and rendered in its real shell.

The Learn landing candidate was also inspected against its previous expected
image. Its only intentional layout expansion was the new **Light WebGL scenes**
guide link, which increased the full-page height from 1071 to 1099 pixels;
commit `2c1a39c` updated only that route's expected image.

The final aggregate visual safeguard rejected its deliberate mutation,
preserved every baseline byte, and recovered green. The diagram-editor teaser
matched at 960×600 with zero differing pixels, and all 9 Studio baselines
matched after the reviewed updates.

## Aggregate trust evidence

The authoritative final command was run from the clean verified revision with
Node.js `v24.15.0`, pnpm `11.21.0`, Playwright `1.62.1`, and Chrome for Testing
`151.0.7922.34`:

```sh
fnm exec --using=v24.15.0 -- corepack pnpm@11.21.0 trust
```

It exited zero. Fresh output recorded:

- scenario checks for 65 lessons, including the 12 same-scene WebGL lighting
  lessons, 12 tutorial snapshots, and 21 deterministic test laboratories;
- documentation checks for 13 guides, 157 current/migration files, 84
  historical/work records, and all 987 documentation mutation probes;
- typecheck, lint/format, package builds, source and built Studio builds,
  Studio documentation acceptance, and production-boundary checks;
- the packed `@pibbl/core` and `@pibbl/webgl` consumer across Bundler and NodeNext,
  declarations, runtime exports, blocked deep imports, no-source checks, shared
  core identity, and optimized focus elimination;
- the complete browser suite: 190 files, 2,590 passed and 2 intentionally
  skipped tests of 2,592;
- the visual safeguard and all 9 Studio visual baselines;
- built-package smoke: 1 file and 1 test passed;
- lifecycle: 7 files and 33 tests passed; and
- structural performance: 6 files, 36 passed and 2 opt-in wall-clock tests
  intentionally skipped.

The final output's non-fatal notices were the existing future Vite native-loader
extension warnings, the ignored bare import from a side-effect-free package,
ineffective dynamic-import notices, and large-chunk notices. None changed the
zero exit status.

## Browser-visible checkpoint

The isolated worktree Studio exposed the combined scene at
`http://127.0.0.1:5175/#/examples/webgl/multiple-lights`. The user inspected the
live scene, including its orbitable camera and genuine object silhouettes on
the receiving plane, said that it looked great, requested the commit and merge,
and then explicitly approved proceeding before final verification began.

This acceptance superseded the implementation plan's more expansive final
manual-traversal procedure: a separate hands-on pass through every individual
lesson and the laboratory was not performed. The twelve-lesson source contract,
complete browser suite, deterministic laboratory, and reviewed Studio visual
route instead provide repeatable route and behavior coverage beyond the
user-accepted combined-scene checkpoint. This deviation is recorded explicitly
rather than presenting automated evidence as manual inspection.
