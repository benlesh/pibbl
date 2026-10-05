---
id: api-component-reaction-diffusion
title: ReactionDiffusion
summary: A persistent, paintable Gray–Scott texture driven by Pibbl frames.
kind: api
slug: reaction-diffusion
apiCategory: component
symbols: [ReactionDiffusion]
relatedTypes: [ReactionDiffusionProps, TextureBrush, TextureRenderer]
---

# ReactionDiffusion

Import from `@pibbl/core/textures`. Defaults: `seed=42`, `preset="spots"`,
`resolution={width:256,height:160}`, lagoon palette, running, and a radius-6,
strength-0.8 brush. `preset` also accepts `stripes`.

The brush plants viable patches rather than a uniform chemical flood. Larger
brushes plant clusters; established ink is left intact. Very small or weak marks
may still dissipate as the field evolves.

`paused` stops evolution but permits painting. `brush={false}` disables painting.
A changed `resetRevision`, seed, preset, or simulation resolution resets the field.
Palette and display-size changes preserve it. Configurations are compared by value.
Use explicit signal reads in custom props.

`style` and event/focus props follow `defineRenderLayer`. Use `pointerEvents="none"`
for a decorative background. `render` optionally customizes how the generated
source/mask is drawn. Pointer painting continues to use the default stretched
rectangle mapping. The simulation persists across component evaluations and is
released on removal.

See [the texture guide](#/learn/guides/procedural-textures) and
[Living Ink](#/examples/composition/living-ink).

Options: [ReactionDiffusionProps](#/api/types/textures#reactiondiffusionprops), [TextureBrush](#/api/types/textures#texturebrush), [TextureRenderer](#/api/types/textures#texturerenderer).
