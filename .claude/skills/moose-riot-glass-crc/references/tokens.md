# Moose Riot tokens, resolved for Canvas

CRC paints Canvas colour strings and cannot read CSS custom properties. These are the
Glass tokens resolved from `design/glass/tokens/*.css` into values you can type directly
into `style`. Hex is given because it is portable everywhere; the `oklch()` source value is
kept beside it so drift from the authoritative palette is visible. If you need a step not
listed here, resolve it from the source files rather than inventing a neighbour.

Never edit a palette value to make something look better. Control a hue's **placement,
area and intensity** instead — that is the whole budget.

## Contents

- [Foundation](#foundation) · [Semantic pairs](#semantic-pairs-light--dark) ·
  [Data roles](#data-roles) · [Materials](#material-tints) · [Elevation](#elevation-as-dropshadow) ·
  [Type](#type-as-canvas-font-strings) · [Motion](#motion) · [Space and radius](#space-and-radius)

## Foundation

The warm neutral ramp (hue 85) carries the identity. Reach for it first, always.

| Step        | Hex       | Source                  |
| ----------- | --------- | ----------------------- |
| neutral-0   | `#FFFFFF` | `#FFFFFF`               |
| neutral-50  | `#FBFAF8` | `oklch(0.985 0.003 85)` |
| neutral-100 | `#F4F2EF` | `oklch(0.962 0.004 85)` |
| neutral-200 | `#E7E5E1` | `oklch(0.922 0.005 85)` |
| neutral-300 | `#D2D0CC` | `oklch(0.858 0.006 85)` |
| neutral-400 | `#A7A5A1` | `oklch(0.722 0.006 85)` |
| neutral-500 | `#7C7B77` | `oklch(0.582 0.006 85)` |
| neutral-600 | `#5C5A56` | `oklch(0.468 0.006 85)` |
| neutral-700 | `#403F3C` | `oklch(0.368 0.005 85)` |
| neutral-800 | `#272623` | `oklch(0.268 0.005 85)` |
| neutral-900 | `#141311` | `oklch(0.188 0.004 85)` |
| neutral-950 | `#070706` | `oklch(0.128 0.003 85)` |
| **ink**     | `#060504` | `oklch(0.118 0.004 85)` |

The foundation is warm. Accumulated cool greys, blue shadows or a slate canvas replace the
identity with a generic product palette — a tiny source-defined tint is fine, a cast is not.

Role ramp steps you will reach for beyond the resolved role tokens below:

|                             | 300       | 400       | 500       | 600       | 700               |
| --------------------------- | --------- | --------- | --------- | --------- | ----------------- |
| brand-1 / observation (h20) | `#FF9092` | `#F44F5D` | `#DE1D3F` | `#C9002E` | `#A50024`         |
| brand-2 / model (h350)      | `#FF89CA` | `#FF5CB8` | `#F438A6` | `#C91B86` | —                 |
| lime / healthy (h120)       | —         | `#C8E928` | —         | `#8CA600` | — (900 `#293300`) |
| amber / uncertain (h80)     | `#ECAE30` | `#D89700` | —         | —         | `#754C00`         |
| coral / anomaly (h28)       | `#FF9587` | `#FD7466` | —         | `#C1332C` | —                 |

## Semantic pairs, light / dark

Define paired roles before styling. Typing `#FFFFFF` for every reading surface or
`#141311` for every label is a light-only implementation even though both are valid
primitives. Dark is not an inversion: in light the instrument reads as a lens over paper,
in dark as illumination over depth.

| Role                          | Light       | Dark        |
| ----------------------------- | ----------- | ----------- |
| canvas                        | `#F8F7F5`   | `#060504`   |
| canvas-muted                  | `#F2F0ED`   | `#141311`   |
| surface-content               | `#FFFFFF`   | `#272623`   |
| surface-content-2             | `#FBFAF8`   | `#141311`   |
| surface-sunken                | `#F4F2EF`   | `#070706`   |
| fg                            | `#141311`   | `#FBFAF8`   |
| fg-muted                      | `#5C5A56`   | `#A7A5A1`   |
| fg-subtle                     | `#7C7B77`   | `#7C7B77`   |
| fg-faint                      | `#A7A5A1`   | `#5C5A56`   |
| border                        | `#0B0B0B1A` | `#FFFFFF1A` |
| border-strong                 | `#0B0B0B2E` | `#FFFFFF2E` |
| border-subtle                 | `#0B0B0B0F` | `#FFFFFF0F` |
| **accent** (principal action) | `#060504`   | `#FBFAF8`   |
| accent-fg                     | `#FFFFFF`   | `#060504`   |
| link                          | `#A50024`   | `#FF9092`   |
| **focus-ring**                | `#DE1D3F`   | `#F44F5D`   |
| selection                     | `#F44F5D42` | `#F44F5D52` |
| scrim                         | `#090B0F52` | `#0000008C` |
| scrim-stacked (nested)        | `#090B0F1F` | `#00000038` |

The accent is ink: the foundation acts, the data speaks. A principal action is never a
filled role hue and never a filled gradient.

## Data roles

A label that names a role keeps its colour in every chart, badge, trace and tooltip. The
step changes between modes; the hue never does. Adding a sixth role needs a real semantic
need, not a design convenience.

| Role        | Means                      | Light text / fill / bg / edge                   | Dark text / fill / bg / edge                      |
| ----------- | -------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| observation | what the instrument sees   | `#C9002E` · `#F44F5D` · `#FFF0EF` · `#FF5B6A59` | `#FF9092` · `#F44F5D` · `#CA1C392E` · `#FF818766` |
| healthy     | active, passing, nominal   | `#293300` · `#C8E928` · `#DAF774` · `#AFCE008C` | `#C8E928` · `#C8E928` · `#AFCE0029` · `#C8E92866` |
| uncertain   | ambiguous, low confidence  | `#754C00` · `#D89700` · `#FFF3DF` · `#B87C0059` | `#ECAE30` · `#D89700` · `#9564002E` · `#ECAE3066` |
| anomaly     | failure, conflict, outlier | `#C1332C` · `#FD7466` · `#FFEFEC` · `#E54D4259` | `#FF9587` · `#FD7466` · `#C1332C33` · `#FF958766` |
| model       | model internals, inference | `#C91B86` · `#F438A6` · `#FFEFF7` · `#F438A659` | `#FF89CA` · `#FF5CB8` · `#C91B8633` · `#FF89CA66` |
| inert       | no state, not applicable   | `#7C7B77` · `#A7A5A1` · `#F4F2EF` · `#0B0B0B24` | `#7C7B77` · `#7C7B77` · `#FFFFFF0F` · `#FFFFFF24` |

The **text** grade is for labels; the **fill** grade is full chroma for bars, dots, strips
and particles and is not readable as small text. The healthy ramp is deliberately the
opposite hue of the brand, so "ok" never looks like identity colour.

Distinguishable categorical series are the one legitimate exception to role ownership, and
they live in the instrument hues — observation, model, neutral — so lime, amber and coral
stay reserved for health meaning. Semantic hue and readable ink are separate choices: a
status may keep its tint and edge while its label uses stronger theme-resolved ink. Target
4.5:1 for small text and 3:1 for large text **against the final composited pixels**,
including the pane tint, the specular wash and the hover state — not against the base token.

### The instrument gradient

Observation → model: what is seen shading into what is inferred. `#C9002E` → `#F438A6`
horizontally. Reserved for identity and expressive observation surfaces, one per view.
Never a button fill, never a default decoration. The single-hue field augments are a
radial or vertical fade of one role to transparent at ~72% — `#F44F5D38` → transparent for
observation, `#F438A633` → transparent for model.

## Material tints

Each role is a tint plus a backdrop blur radius plus a grain amount. In CRC the tint is a
`Rectangle` fill painted over the pane's composed backdrop, and the blur radius is the
`blur()` filter applied _inside_ the pane. These were tuned per theme and must not be
mechanically inverted.

| Material role             | Light tint / blur / grain | Dark tint / blur / grain |
| ------------------------- | ------------------------- | ------------------------ |
| content (opaque, no pane) | `#FFFFFF` · — · —         | `#272623` · — · —        |
| chrome                    | `#FBFCFDA8` · 16 · .05    | `#0F0F119E` · 16 · .07   |
| control                   | `#FBFCFD8F` · 10 · .04    | `#2D2E3080` · 10 · .06   |
| control hover             | `#FBFCFDB8`               | `#37383A9E`              |
| floating                  | `#FBFCFDC7` · 20 · .05    | `#151617C2` · 20 · .07   |
| overlay                   | `#FBFCFDE6` · 28 · .04    | `#0C0D0FE6` · 28 · .06   |
| decorative                | `#FFFFFF2E` · 14 · —      | `#FFFFFF0F` · 14 · —     |
| lens (moving selection)   | `#FFFFFFD1` · 8 · —       | `#3C3D3FC7` · 8 · —      |
| nested (inside a scene)   | `#FBFCFDF0`               | `#151617F5`              |

Solid fallbacks, for when optics are off or text needs an opaque reading region: chrome
`#FBFAF8`/`#141311`, control `#F4F2EF`/`#403F3C`, floating and overlay `#FFFFFF`/`#272623`.

Rim light, at 135°: bright toward the light, neutral at 45%, faint dark at the far edge.
Light `#FFFFFFD9` → `#FFFFFF59` → `#16161624`. Dark `#FFFFFF6B` → `#FFFFFF1F` → `#00000059`.

A pane's refraction may also carry a slight saturation lift — 1.35 in light, 1.25 in dark,
via `saturate()` inside the pane — plus brightness 1.02 in light. Spend this on the focal
pane; it is part of the optical signature, not a global setting.

## Elevation as dropShadow

CRC has no `boxShadow`. Each level below is the source two-shadow stack collapsed into what
`dropShadow()` can express: the large ambient shadow, with the contact shadow folded in
where it still reads. Source shadow colour is `#13161B` in light and `#000000` in dark.
The source shadows sit straight below (`offsetX` 0) — the 135° light direction is carried
by the rim and specular, not by a diagonal shadow. Negative spread has no CRC equivalent;
the blur radii below are already reduced to compensate.

| Level    | Light                                                                       | Dark                                              |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------- |
| raised   | `dropShadow({ offsetX: 0, offsetY: 2, blurRadius: 5, color: "#13161B0D" })` | `offsetY: 2, blurRadius: 6, color: "#0000004D"`   |
| floating | `offsetY: 8, blurRadius: 16, color: "#13161B24"`                            | `offsetY: 10, blurRadius: 20, color: "#00000099"` |
| overlay  | `offsetY: 18, blurRadius: 32, color: "#13161B38"`                           | `offsetY: 22, blurRadius: 40, color: "#000000B3"` |
| modal    | `offsetY: 28, blurRadius: 52, color: "#13161B4D"`                           | `offsetY: 36, blurRadius: 68, color: "#000000CC"` |

Embedded (inset) depth has no filter equivalent. Build a well from a darker fill plus a
1px top hairline — `#0B0B0B1A` in light, `#FFFFFF1A` in dark — rather than reaching for a
shadow. Stack order is a five-step scale, not a number you invent: sticky < popover <
toast < modal < top. In CRC that is source paint order and `Layer` ownership; one scene
owns the strong scrim and the deepest shadow.

## Type as Canvas font strings

Grotesk — Archivo — for everything readable. IBM Plex Mono for instrumentation only. Load
the faces before measuring, and verify the rendered family rather than trusting the string:
a missing webfont silently falls back and changes every measurement.

| Role                   | `style.font`                                    |
| ---------------------- | ----------------------------------------------- |
| display                | `800 60px Archivo, sans-serif`                  |
| h1                     | `700 48px Archivo, sans-serif`                  |
| h2                     | `700 38px Archivo, sans-serif`                  |
| h3                     | `700 24px Archivo, sans-serif`                  |
| h4                     | `600 20px Archivo, sans-serif`                  |
| body-lg                | `400 18px Archivo, sans-serif` (line height 30) |
| body                   | `400 16px Archivo, sans-serif` (line height 24) |
| body-sm / evidence     | `400 14px Archivo, sans-serif` (line height 21) |
| label                  | `600 14px Archivo, sans-serif`                  |
| caption                | `500 12px Archivo, sans-serif`                  |
| eyebrow                | `600 12px Archivo, sans-serif`, tracked wide    |
| code / instrumentation | `400 14px "IBM Plex Mono", monospace`           |

Start body text at 16px, decision evidence at 14px, captions at 12px; a smaller technical
chart label needs a specific reason and a readable crop. `Text` defaults to
`13px sans-serif` — that default is never a design choice, so set `font` explicitly every
time. Numbers in this system get compared, so keep digit columns in one `font` and align
them by layout.

## Motion

Glass is light and rigid: it slides, it does not bounce.

| Token   | ms   | Use                          |
| ------- | ---- | ---------------------------- |
| instant | 80   | state flips with no travel   |
| fast    | 120  | hover, press                 |
| base    | 200  | enter, focus, exit           |
| slow    | 320  | lens, layout, theme change   |
| slower  | 600  | a deliberate one-shot reveal |
| drift   | 9000 | ambient continuous field     |

Easing, as CRC `easing.cubicBezier(...)`:

| Token       | Curve              |
| ----------- | ------------------ |
| standard    | `0.2, 0.8, 0.2, 1` |
| out         | `0, 0, 0.2, 1`     |
| in          | `0.4, 0, 1, 1`     |
| lens        | `0.3, 0.8, 0.3, 1` |
| spring-soft | `0.3, 1.2, 0.4, 1` |

Prefer CRC's analytic `spring({ stiffness, damping, mass })` over a spring-shaped bezier
when a value is interrupted mid-flight, since it resolves from current velocity. Keep
overshoot small — a bezier with a 1.42 peak is the outer limit of this material, and
reserved for a deliberate confirmation. Press scale is `0.985`; hover lift is half a pixel,
which on Canvas means it must be deliberate or it will not read at all.

## Positioning

Authored styles position with **`left` and `top`**. There is no `x`/`y` on `RectStyle`,
`TextStyle` or any other input style - those exist only on the internal `Resolved*` types
after resolution. The published guide at `docs/site/learn/guides/signals-and-animation.md`
shows `<Rectangle style={{ x, width: 80 }} />`, which does not typecheck against current
types; do not copy it.

`pointerEvents` is a prop on leaf drawing primitives, not on `Group` - `GroupProps` carries
only structural events and children, so putting it on a `Group` silently does nothing.
Opt each decorative primitive out individually.

## Space and radius

4px base, 6px radius step. Glass objects read as cut, not blobby.

Space: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128. Inline gap 8, stack
gap 16, section gap 96. Card padding 24. Control padding 16×8.

Radius: xs 4 · sm 6 · md 12 · lg 18 · xl 24 · 2xl 32 · full 9999. Controls and the
selection lens use 6; cards and chrome 18; floating 12; overlays 24; decorative may go
larger. Borders are 1px, or 1.5px when an edge must carry meaning.

Control heights 32 / 40 / 48, and a 44px minimum hit target — in CRC that is the
component's allocated box, so check it against the drawn shape rather than the glyph.
Containers: 640 / 840 / 1120 / 1280. Use 390×844 as the named narrow regression benchmark.
