# Glass materials in CRC

Every recipe here is built from public API: `@crc/core`, `@crc/core/filters`, and
`@crc/textures`. Values come from `tokens.md`. The shipped proof of the full refraction
idiom is `packages/scenarios/src/learning/composition/rainy-window.example.tsx` — read it
before building your first pane.

## Contents

- [The pane: a backdrop is a prop](#the-pane-a-backdrop-is-a-prop) ·
  [Gradients](#gradients-via-definetexture) · [Rim and specular](#rim-and-specular) ·
  [Elevation](#elevation) · [Grain](#grain) · [Refraction](#refraction-the-real-thing) ·
  [The moving lens](#the-moving-lens) · [Scenes and scrims](#scenes-and-scrims) ·
  [Optics off](#optics-off) · [Cost](#cost)

## The pane: a backdrop is a prop

A glass surface in CRC composes the thing it reveals. That makes `backdrop` a required
input — and a design forcing function, because you have to name what becomes observable.

```tsx
import {
  Clip,
  Group,
  Layer,
  Rectangle,
  useRectPath,
  type CRCNode,
} from "@crc/core";
import { blur, dropShadow, saturate } from "@crc/core/filters";

interface PaneProps {
  frame: { left: number; top: number; width: number; height: number };
  radius: number;
  tint: string; // material tint from tokens.md
  blurRadius: number; // material blur from tokens.md
  canvas: string; // the theme's canvas colour, for the reset plate
  backdrop: CRCNode; // what this surface reveals - never empty
  children?: CRCNode; // the pane's own content, painted over the tint
}

function GlassPane({
  frame,
  radius,
  tint,
  blurRadius,
  canvas,
  backdrop,
  children,
}: PaneProps) {
  const path = useRectPath(frame.left, frame.top, frame.width, frame.height, {
    cornerRadius: radius,
  });
  const pad = Math.ceil(blurRadius * 2.5);
  return (
    <Group
      style={{
        filter: dropShadow({
          offsetX: 0,
          offsetY: 8,
          blurRadius: 16,
          color: "#13161B24",
        }),
      }}
    >
      <Clip style={{ d: path }}>
        {/* 1. opaque reset plate - without it the already-painted original ghosts through */}
        <Rectangle pointerEvents="none" style={{ ...frame, fill: canvas }} />
        {/* 2. the revealed backdrop, flattened then blurred */}
        <Group
          style={{
            filter: [blur({ radius: blurRadius }), saturate({ amount: 1.35 })],
          }}
        >
          <Layer
            style={{
              width: frame.width + pad * 2,
              height: frame.height + pad * 2,
            }}
          >
            {backdrop}
          </Layer>
        </Group>
        {/* 3. tint, then specular, then content */}
        <Rectangle pointerEvents="none" style={{ ...frame, fill: tint }} />
        {children}
      </Clip>
      <Rectangle
        pointerEvents="none"
        style={{
          ...frame,
          cornerRadius: radius,
          fill: "rgba(0,0,0,0)",
          stroke: "#FFFFFF59",
          strokeWidth: 1,
        }}
      />
    </Group>
  );
}
```

Four things to notice, because each one is a decision the CSS version hides:

1. `useRectPath(x, y, width, height, { cornerRadius })` for the clip geometry. It is
   exported from `@crc/core` and memoizes on the dimensions, so it stays correct when the
   frame changes - which a hand-rolled `useConst(() => new Path2D())` does not.
2. The `Layer` flattens the backdrop into one bitmap so the blur runs once over a
   composited image rather than per primitive, and it is the cache: a clean sibling keeps
   its bitmap across renders. Pad it by roughly `2.5x` the blur radius, or the blur samples
   transparency past the pane edge and the frost vignettes inward.
3. The opaque reset plate comes first. CRC paints in source order, so the real backdrop is
   already on the canvas beneath the pane; compositing a blurred _copy_ over it leaves the
   sharp original ghosting through as a double image. The plate also stops `dropShadow`
   from showing through the translucent pane and darkening it. (The alternative, if you
   need the pane itself to stay translucent, is to clip the shadow caster to an even-odd
   cutout so spill lands only outside the silhouette.) The tint sits inside the clip over
   the blurred backdrop; the rim sits _outside_ it, because a 1px stroke centred on the
   clip boundary would be half-eaten by the clip.
4. `pointerEvents="none"` on every decorative layer. Optics must never absorb a click
   meant for the content beneath.

**Revelation and legibility are different surfaces.** The material tints in `tokens.md`
assume CSS `backdrop-filter` over a full-strength backdrop; composited in CRC a 78%
`floating` tint over a 20px blur erases the backdrop completely and you get a milky slab.
For a pane whose job is revelation, use a lighter tint - `decorative` or `lens` - and a
blur small relative to the backdrop's feature size (10px over 20px-wide marks reads; 20px
is mush). Get text contrast from an opaque reading plate inside the pane, not from the tint.

**Behind prose, the backdrop stops.** Set the tint to the opaque `nested` or solid value
under a paragraph, a field or an action, and keep Glass alive through the edge, the light
and the elevation. Ghost text showing through a reading plane is a defect, not an effect.

If `backdrop` has nothing meaningful in it, delete the pane and draw an opaque `content`
surface: `fill` from `surface-content`, a `border` hairline, and `raised` elevation. That
is a legitimate, frequently correct Moose Riot surface — most of a working interface is
this, not glass.

## Gradients via defineTexture

There is no declarative gradient. `defineTexture` gives you an `OffscreenCanvas`, which is
the sanctioned route. One recipe covers specular, rim, field washes and the instrument
gradient.

```tsx
import { defineTexture, useTexture } from "@crc/core";

interface GradientConfig {
  readonly from: readonly [number, number]; // normalized within the texture
  readonly to: readonly [number, number];
  readonly stops: readonly (readonly [number, string])[];
}

const linearGradient = defineTexture<
  GradientConfig,
  { config: GradientConfig }
>({
  defaultPlacement: { mode: "stretch" },
  create: (_context, config) => ({ config }),
  update: (state, config, context) => {
    state.config = config;
    context.invalidate();
  },
  rasterize: ({ config }, { canvas }) => {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const g = ctx.createLinearGradient(
      config.from[0] * width,
      config.from[1] * height,
      config.to[0] * width,
      config.to[1] * height,
    );
    for (const [offset, color] of config.stops) g.addColorStop(offset, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  },
});
```

A `defineTexture` config is `structuredClone`d, so it must be plain data — numbers, strings
and arrays. No `Path2D`, no functions, no signals. Gradients are smooth, so a 64×64
resolution with `mode: "stretch"` is plenty and costs almost nothing. Swap
`createRadialGradient` for the field washes.

## Rim and specular

Both are the 135° light, which means top-left to bottom-right: `from: [0, 0]`, `to: [1, 1]`.

```tsx
const specular = useTexture(
  linearGradient({
    from: [0, 0],
    to: [1, 1],
    stops: [
      [0, "#FFFFFF52"],
      [0.28, "#FFFFFF14"],
      [0.55, "#FFFFFF00"],
    ],
  }),
  { resolution: { width: 64, height: 64 } },
);
const rim = useTexture(
  linearGradient({
    from: [0, 0],
    to: [1, 1],
    stops: [
      [0, "#FFFFFFD9"],
      [0.45, "#FFFFFF59"],
      [1, "#16161624"],
    ],
  }),
  { resolution: { width: 64, height: 64 } },
);
```

Use `specular` as the fill of a `pointerEvents="none"` rectangle inside the clip, and `rim`
as the `stroke` of the outer rectangle. In dark, the specular stops become `#FFFFFF24` /
`#FFFFFF0A` / transparent and the rim `#FFFFFF6B` / `#FFFFFF1F` / `#00000059` — dimmer and
with a genuinely dark far edge, which is why the mode is tuned rather than inverted.

Strong specular, for one focal proof object only: `#FFFFFF8C` / `#FFFFFF1F` / transparent at
0.60 in light, `#FFFFFF47` / `#FFFFFF0F` in dark.

Keep the broad specular wash out of the reading path, or choose the foreground for its
brightest composited background. **One optical signature per region**: if a surface has a
rich rim, quiet its wash; if the wash carries the character, restrain the rim.

`reflectedLight({ map, region, source, opacity, threshold, softness, direction })` is the
richer alternative when you already have a height field — it computes a specular response
from the map's normals instead of faking one with a gradient, and `direction` is where the
135° convention should be stated literally. Use it on the focal pane of a scene that
already carries a water, rain or displacement map; reaching for it without a map is how you
end up with an invented highlight that disagrees with the light.

## Elevation

`dropShadow()` from `tokens.md`, applied to the `Group` that wraps the whole surface so the
shadow traces the composed silhouette rather than one child. Elevation belongs to the
**group**, not to each row inside it. Repeating a lift on comparable rows destroys the
comparison those rows exist to make.

A filter list runs forward and nests inside out, so order matters: put `dropShadow` on the
outer group and the optical filters inside it, or the shadow will be blurred too.

## Grain

```tsx
import { paper } from "@crc/textures";

const grain = useTexture(paper({ seed: 24, scale: 6, detail: 0.65 }), {
  resolution: { width: 180, height: 180 },
});
// <Rectangle pointerEvents="none" style={{ ...frame, fill: grain.paint({ mode: "repeat" }), opacity: 0.05 }} />
```

Grain amounts are in `tokens.md`, roughly 0.04–0.07 — they sit at the edge of perception by
design. `paper`, `marble` and `cellular` tile seamlessly in both axes, so `mode: "repeat"`
is safe. Keep decorative textures before content in paint order and out of pointer
participation. A static material requests no further frames, so it costs nothing at rest.

## Refraction: the real thing

This is the part CSS cannot do, and the clearest expression of "glass must reveal": a
displacement map bends the composed backdrop instead of merely blurring it.

```tsx
import { displacement } from "@crc/core/filters";
import { waterSurface } from "@crc/textures";

const field = useTexture(
  waterSurface({ seed: 7, speed: 0.6, viscosity: 0.25 }),
  {
    resolution: { width: 256, height: 160 },
  },
);
const map = field.paint({ mode: "stretch" });
// <Group style={{ filter: displacement({ map, strength: 14, region: frame, blurRadius: 8 }) }}>
//   <Layer>{backdrop}</Layer>
// </Group>
```

`waterSurface` gives reflecting boundaries and obstacles, `waterWaves` a cheaper periodic
field, and `rainDrops` a seeded rain-on-glass field with condensation, trails, merging
beads and a wipeable finger contact. All three are numeric RG displacement maps and reject
palettes — red and green encode the normals, and in `rainDrops` blue encodes local
condensation blur, which is why a positive `blurRadius` softens only the misted regions.
Send `ripple`, `nudge`, `finger` and `release` messages to make the field answer the person.

`region` must match the pane; a mismatched region shifts the whole refraction. Strength
reads as glass thickness — 10–20 for a window, higher for a lens. Keep the map's resolution
well below the display size; these fields are bounded on purpose.

Because displacement bends only _filtered CRC content_, a pane over nothing refracts
nothing. The capability itself enforces the rule.

## The moving lens

Selection in this system is one lens that slides, not a second lifted skin beneath the
selected item. One group, one lens, 320ms on the `lens` easing.

```tsx
import { useTransition } from "@crc/core";

const x = useTransition(tabs[selected.get()].x, {
  type: "tween",
  duration: 320,
  easing: easing.cubicBezier(0.3, 0.8, 0.3, 1),
});
// <Rectangle pointerEvents="none" style={{ left: x, top, width, height, cornerRadius: 6, fill: "#FFFFFFD1" }} />
```

The signal goes straight into `style.left` — no adapter, no effect. Use `spring` instead
when selection can be interrupted mid-slide, since it resolves from current velocity rather
than restarting. Distinguish semantics: a lens for tabs (navigation) and for a segmented
control (one exclusive value) look alike and mean different things, so keep keyboard
behaviour and the selected state correct independent of the animation.

## Scenes and scrims

One scene owns the strong scrim and the deepest shadow. A scrim is a full-bleed rectangle
in `scrim`, painted after the parent content and before the panel, with the panel at
`overlay` or `modal` elevation. A confirmation _inside_ that scene uses `scrim-stacked` and
the lighter shadow, plus the near-opaque `nested` tint — the existing depth already
established the separation, so a second strong scrim just muddies both.

Behind an overlay's prose, go opaque. Limit modal depth to two levels; a third suggests the
flow needs steps instead. In CRC, "topmost" is paint order and `Layer` ownership, and
`Escape`, focus entry and focus return are your responsibility through one scene adapter —
not something the composition gets for free.

## Optics off

Thread one `glass` flag through the scene and check it, exactly as the rainy-window example
toggles its displacement with an empty filter list:

```tsx
style={{ filter: glass.get() ? [blur({ radius: 20 }), saturate({ amount: 1.35 })] : [] }}
```

`[]` is a true no-op. With optics off, swap pane tints for the solid fallbacks in
`tokens.md`. Purpose, grouping, focus and selection must still be clear — a hierarchy that
depends entirely on reflection has a composition problem that the reflection was hiding.

## Cost

Filters are not free: each filtered boundary costs a surface lease and two bitmap draws,
and each `Layer` holds a cached bitmap. That is cheap when panes are few and deliberate,
and expensive when every row is a glass card — which the design language already told you
not to do, for independent reasons. Sibling panes reuse pooled surfaces and clean `Layer`s
keep their caches, so a settled scene costs little. Nest filters shallowly, keep
displacement maps small, and let the scene go quiet at rest: no animation means no frames.
