---
name: moose-riot-glass-crc
description: The Moose Riot Glass design language expressed in CRC's Canvas runtime — surfaces that reveal, colour that means something, and particles/physics that encode real events. Use this whenever you design, build, review or polish any visual CRC composition: a scenario, Studio example, dashboard, hero, chart, panel, particle effect, physics scene or texture built on @crc/core, @crc/particles, @crc/physics, @crc/textures or @crc/viz. Trigger it even when the request sounds purely technical ("add a panel", "make this look nicer", "build a particle effect", "pick a colour for this", "animate this in") — colour, light, elevation and motion in this repo are governed by a brand contract, not by free choice, and CRC's Canvas model changes how glass has to be composed.
---

# Moose Riot Glass on Canvas

Moose Riot's visual territory is **Observable Complexity**. Hidden structure is always
there; the instrument reveals it. The arc is never _chaos → magically simple_ — it is
**opaque → observable → intelligible → controllable**.

Two rules carry most of the weight, and CRC makes both of them unusually literal:

- **Glass must reveal.** A glass surface exists because something becomes observable
  through it. A blurred panel over nothing is decoration, not glass.
- **Colour means something.** The warm neutral foundation carries the identity and the
  principal action is ink. Hues belong to data roles. A role hue spent decoratively is a
  brand failure even when the value came from the source palette.

Read `references/tokens.md` for every literal colour, shadow, type and timing value —
CRC paints Canvas strings and cannot read CSS variables, so the resolved tables there are
the authoritative values to type into `style`. Read `references/glass-materials.md` for
the surface recipes, `references/matter-and-motion.md` before any particle, physics or
animation work, and `references/evidence.md` before claiming a composition is done.

## The one CRC fact that reshapes the design language

CRC has no `backdrop-filter`. It paints in source order, and a filter captures _the
receiving primitive and its descendants_ — never what was painted earlier. A frosted
`Rectangle` blurs its own fill and reveals nothing.

So in CRC **a glass surface takes its backdrop as a child.** The content being revealed
is composed inside the pane: flattened by `Layer`, blurred or refracted by the pane's
filter, clipped to the pane's shape.

```tsx
<Clip style={{ d: panePath }}>
  <Group style={{ filter: blur({ radius: 18 }) }}>
    <Layer style={{ width, height }}>{backdrop}</Layer>
  </Group>
  <Rectangle pointerEvents="none" style={{ ...frame, fill: tint }} />
</Clip>
```

This is a gift, not a workaround. CSS lets you blur a panel over nothing and still look
plausible; CRC does not. If you cannot name what goes inside a pane, you do not have a
glass surface — write an opaque `content` surface instead and spend the craft on
typography, space and the data. Shipped proof of the full idiom lives in
`packages/scenarios/src/learning/composition/rainy-window.example.tsx`.

The same inversion applies to depth. CRC has no `boxShadow` style property: elevation is
the `dropShadow()` filter, which means elevation is a _compositing pass over a silhouette_
and you must know what the silhouette is. And there is no declarative gradient: the
specular wash, rim and instrument gradient are painted through `defineTexture`
(`references/glass-materials.md`). Each of these costs a decision, which is the point —
you cannot sprinkle Glass on by accident.

## Begin with the scene's job

Write a short design decision record next to the output. It is a reasoning aid; never put
its policy language on screen.

- **Purpose:** what the person needs to accomplish or understand.
- **Visual idea:** the memorable relationship the scene makes visible, and its argument —
  starting evidence → consequential relationship → next step.
- **Revelation:** for every glass surface, what is painted inside it and why seeing
  through it helps. A pane with nothing behind it is a finding, not a style.
- **Primary target:** what the eye should land on first, named concretely.
- **Reading order:** the next two places it goes.
- **Surface roles:** which regions are focal, supporting, ambient, and why.
- **Light and colour:** why the strongest treatment helps this job, and where it stays
  quiet. Which data roles are present and what each one means here.
- **Matter and motion:** what each particle or body _encodes_, which of the seven
  behaviours it uses, what triggers it, and what it looks like when motion stops.
- **Tradeoff:** what this direction accepts, and an observation in the Studio that would
  disprove the choice.

Scale the structure of an answer to its actual complexity. Keep the decision object, its
evidence and its next action in one visual group; a greeting or an aggregate total stays
subordinate when it does not answer the scene's question.

An anchor **organizes** evidence — it never replaces it. Compress repetition, chrome and
padding first; the only view of the data's shape is the last thing to go, not the first.

During exploration, build two structurally different compositions from the same facts —
change grouping, arrangement or reading order. A colour swap or an extra glow is a
material variant, not a different composition.

## Compose a scene, not a pile of effects

Choose the focal region before choosing optical intensity. One region leads at rest.
Supporting surfaces stay recognizably Glass at lower intensity; ambient chrome orients
without competing. Strong type, generous space and a clear action can lead without glow.

Assign material by three separate decisions. **Purpose** chooses what leads. **Relationship**
chooses which boundary owns depth — a shared frame, an inset well, a sibling, or a new
transient scene. **State** chooses where emphasis moves temporarily, locally, and then
gives it back.

Light comes from 135° — top-left — and the whole scene shares it. Coordinate rim,
specular, shadow and tint; do not independently maximize all four on one region. Start
from **one optical signature per region**: a refined rim _or_ a luminous wash _or_ a
tinted proof surface, with the rest kept quiet. One primary region at rest. One ink-aurora
class invitation per view. Exceed a budget only with a stated purpose and a screenshot
showing the reading order held.

Several rows serving one comparison share one frame with hairlines between them; giving
every row its own lift destroys the comparison it exists to support. Nested content
usually wants a quiet inset well, not another card.

Protect the reading plane. Because CRC composes a pane's backdrop _inside_ it, it is easy
to leave live text legible under a panel's own prose. Behind text, drop the backdrop to an
opaque or near-opaque region and keep Glass alive through the edge, the light and the
elevation instead.

## Show the shape, not just the verdict

Observable Complexity means the instrument reveals structure, so **visualizations are brand
material, not garnish**. When the job includes understanding what is happening, the picture
that shows it is primary evidence and often outranks the headline.

The seductive failure is a beautiful card naming a diagnosis in confident prose over three
summary numbers, with no view across time. It reads as decisive and settles nothing: you
cannot tell a spike from a sustained shift, when it started, or whether it is recovering.
A verdict with no shape behind it is asking to be trusted rather than making something
observable, which is the opposite of this brand.

So keep one view with a time axis whenever something changed, annotated where it changed;
keep per-item trend when items are being compared; and keep the causal metrics rather than
only the outcome ones — `cache hit 94% → 61%` explains a verdict that `p99 1 840 ms` merely
restates. `@crc/viz` is the official visualization package and the right default as soon as
you need axes, scales, hover inspection or a shared coordinate space; hand-drawn rectangles
are fine for a sparkline, a budget track or a small meter. Choose from the question, never
from the catalog, and show unknown as a gap or a range rather than a confident number.
`references/visual-evidence.md` has the question-to-chart table, the `@crc/viz` surface and
the unknown-state rules.

## Colour, type and the instrument

Use `references/tokens.md` values verbatim. The short version:

- The warm neutral ramp (hue 85) and `#060504` ink are the identity. The principal action
  is ink in light, near-white in dark — never a filled role hue, never a filled gradient.
- Five data roles own the hues: **observation** `#c9002e`/`#ff9092`, **healthy**
  `#293300`/`#c8e928`, **uncertain** `#754c00`/`#ecae30`, **anomaly** `#c1332c`/`#ff9587`,
  **model** `#c91b86`/`#ff89ca` (light/dark). A role keeps its hue in every chart, badge
  and trace. Anything not a role falls through to neutrals or the instrument hues.
- Focus and selection are observation — the instrument marking what it is looking at. One
  interactive hue per control.
- The instrument gradient (observation → model, "what is seen shading into what is
  inferred") is an expressive moment: identity and art treatments, one per view, never a
  button fill, never a default decoration.
- Never become "the brand-1 company". When observation also fills buttons, headings,
  borders and empty states, colour has stopped being functional.
- Grotesk for everything readable; mono _only_ for instrumentation — trace labels,
  evidence ids, coordinates, timestamps, latencies. Never a paragraph. `Text` is a single
  styled run with no rich text, so compose runs deliberately and keep tabular digit
  columns aligned by layout, not by hope.

Represent failure as **loss of legibility, not emergency** — gaps, forks, lost edges,
question marks. No alarms, no pervasive red. Coral marks an anomaly; it does not shout.
Unknown must never render as zero, as healthy, or as a confident number: show it as a
range, a distribution or competing hypotheses, and withhold the claims that depend on the
missing evidence while keeping independently supported facts.

Never flatten complexity to look calm. Change how much colour is present and where it
leads the eye before muting a role primitive or simplifying a visualization until it stops
being true.

## Matter and motion encode something

This is where CRC earns its place: it has real particles, a real 2D solver, flow fields
coupled to physics obstacles, water and rain displacement fields, and a scheduler that
owns every frame. All of it is brand material, and all of it is governed.

**Each particle stands for something** — an event, a token, an execution, an evidence
item, a state, a relationship — and moves under one of the seven behaviours:
**attraction, repulsion, flow, branching, collapse, focus, perturbation**. Decorative
swirling fairy dust fails the brand contract. Before writing an emitter, finish the
sentence "one particle here is one ___". If you cannot, you want a texture or a chart.

Physics is matter, not garnish: a body is something with mass because its weight,
collision or settling _is_ the information. CRC owns the clock in both cases — never start
another `requestAnimationFrame` loop or step the solver yourself.

`references/matter-and-motion.md` maps all seven behaviours onto exact descriptors, covers
the flow-field/physics coupling, and gives the choreography and reduced-motion contract.
Glass is light and rigid: it slides, it does not bounce. 120ms hover/press · 200ms
enter/focus · 320ms lens, layout and theme. Specify trigger → owner → meaning → settle,
and let continuous motion belong only to a continuing state.

## Know the boundary

CRC's capability set is specific. Design to it rather than against it.

| Glass expects                  | CRC gives you                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `backdrop-filter`              | Nothing. Compose the backdrop inside the pane (`Layer` + filter + `Clip`).                                                              |
| `box-shadow`, insets           | `dropShadow()` filter only. No spread, no inset — translate per `references/tokens.md`.                                                 |
| gradients in `background`      | `defineTexture` painting a `CanvasGradient`, used as `fill`/`stroke`.                                                                   |
| CSS `blur` behind glass        | `blur()` filter inside the pane; `displacement()` for real refraction.                                                                  |
| SVG `feTurbulence` grain       | `paper()`/`marble()`/`cellular()` from `@crc/textures`, low opacity, `pointerEvents="none"`.                                            |
| `mix-blend-mode`               | Not available on drawing components. Particles have `blend: "additive"` only.                                                           |
| Rich text, scrolling, DOM a11y | Not provided. Keep evidence inside the composed viewport and reachable by focus.                                                        |
| A charting library             | `@crc/viz` - `Scale`, `Axis`, `LineSeries`, `BarSeries`, `PointSeries`, `HoverCard`, `PieLayout`. Use it rather than rebuilding scales. |

Filters are a closed vocabulary imported from `@crc/core/filters`: `blur`, `brightness`,
`contrast`, `grayscale`, `invert`, `opacity`, `saturate`, `sepia`, `hueRotate`,
`dropShadow`, `displacement`, `reflectedLight`. No CSS strings, no SVG filter graphs.
`displacement` and `reflectedLight` are the two that are _about_ glass — refraction and
specular response — and they are the most under-used tools in the system.

Filters change pixels only. Layout, measurement, hit testing, focus bounds and pointer
coordinates all use the original logical geometry, so a heavy optical treatment never
moves a target.

## Finish the job

A composition is not done when it renders. Run `references/evidence.md`: build and look at
**light and dark together**, at desktop and narrow widths, populated — neither mode is the
priority and a missing mode is not offset by a beautiful one. Check rest, hover/focus,
selected, busy, empty and unknown. Check it with the optics disabled and with motion
reduced; purpose, grouping, focus and selection must survive without reflection or
movement, because an instrument that only works when animated is not an instrument.

Give the person the exact Studio URL and say what to look at. Then keep functional
assertions separate from aesthetic judgment: a passing test does not prove the eye goes to
the right place, and a screenshot cannot certify motion. Ask an independent reader what
they notice first, what visual idea they remember, and what feels generic — and when
something fails, fix the rule that caused the class of failure, not just the pixel.
