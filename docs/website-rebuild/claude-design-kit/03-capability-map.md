# Verified capability map

Verified against public source in this checkout, October 4, 2026. The website reference is a first collection, not an exhaustive API inventory. Paths below are website routes; Studio example paths follow the configured Playground address.

| Need                            | Public API/import                                             | Working evidence                                                     | Important boundary                                                                            |
| ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Mount a surface                 | `pibbl`, `createElement` from `@pibbl/core`                   | `/start/`, native-button source                                      | Browser lifecycle; one live mount per canvas; retain/dispose controller                       |
| Draw geometry                   | `Circle`, `Rectangle`, `Group` from `@pibbl/core`             | `/catalogs/shapes/circle/`                                           | Logical geometry and native HTML semantics are separate                                       |
| Apply pixel effects             | `blur` from `@pibbl/core/filters`, `style.filter`             | `/catalogs/filters/blur/`                                            | Receiving primitive plus descendants; never arbitrary HTML; geometry unchanged                |
| Static procedural material      | `useTexture`, `marble` from `@pibbl/core/textures`            | `/catalogs/textures/marble/`                                         | Hook owns the resource; resolution differs from display size                                  |
| Living material                 | `reactionDiffusion`, `useTexture` from `@pibbl/core/textures` | `/guides/native-button/`; Studio `#/examples/composition/living-ink` | Supported spots/stripes presets; message-driven; no arbitrary equation API                    |
| Host state bridge               | `signal`, `useReaction` from `@pibbl/core`                    | native-button source                                                 | Write from native events, not component evaluation; reaction runs after successful render     |
| Responsive allocation           | `pibbl(..., { viewport: 'responsive' })`, `useLayoutBox`      | native-button source                                                 | CSS owns host size; no manual backing-size loop needed                                        |
| Native controls in Pibbl layout | `HtmlBox` from `@pibbl/core`                                  | Studio `#/examples/composition/html-box`                             | Requires overlay; HTML stays above Canvas; no intrinsic DOM sizing or DOM capture             |
| Texture stirred by a body       | physics from `@pibbl/core/physics/2d`; texture messages       | `/examples/stirred-ink/`                                             | Explicit one-way mapping, not physical fluid feedback                                         |
| 3D region                       | `defineThreeLayer` from `@pibbl/three`; ordinary `three`      | Studio `#/examples/composition/three-layer`                          | One flattened bitmap; no Canvas/Three subprimitive interleaving; app disposes Three resources |

## Two application directions

**HTML owns the application:** keep DOM layout, links, controls, validation, and accessibility. Insert a bounded canvas beside or behind it. The native-button source is this pattern. No HtmlBox or HTML overlay configuration is needed.

**Pibbl owns the application:** Pibbl allocates the Canvas composition and may allocate native regions with HtmlBox. Configure `htmlOverlay` as an empty immediate sibling after Canvas, sharing the same positioned rectangle. Native content stays native and sits above all Canvas pixels, regardless of Canvas source order. Use the working HTML Box source for setup and abort-driven teardown.

## Asset and renderer facts

The button needs no external assets. Image recipes need explicitly loaded image assets, an aspect-ratio policy, meaningful native alt text, and failure handling. Pixel-readback/export workflows must account for cross-origin restrictions. Canvas cannot photograph arbitrary live DOM into an image source.

Canvas filters act on Canvas pixels. They cannot blur or distort a native form's actual fields through Pibbl. A decorative canvas around a form can be visually coordinated with validation state while the fields remain ordinary HTML.

External layers require `OffscreenCanvas`, `transferToImageBitmap()`, and the selected renderer's capabilities. Pibbl owns frame scheduling, outer composition, and the external layer lifecycle; application-created Three materials, geometries, textures, controls, and loader resources need explicit cleanup. Do not add a second animation loop or call `renderer.setAnimationLoop()` for an ordinary Pibbl integration.

## Source checks when a design goes further

Look up exact exports in `packages/core/src/index.ts`, `packages/core/src/features/textures/index.ts`, `packages/core/src/filters.ts`, or `packages/three/src/index.ts`. Read the matching public guide and implemented contract. These are verification locations for repository users, never runtime dependencies for the shared recipe. If those files are unavailable, request version-matched public documentation rather than guessing a function signature.
