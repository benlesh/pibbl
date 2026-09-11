# Default drawing pointer participation

Status: migration guidance for the shipped WebGL-islands interaction model,
effective 2026-09-10.

CRC drawing primitives now participate in coordinate hit testing by default,
even when they have no event handler, cursor, or focus option. This aligns
Canvas 2D and WebGL drawing: a visible front object owns its declared geometry
unless the author explicitly makes it transparent to hit testing.

## What changed

Previously, a Canvas drawing primitive created a logical target only when
interactive metadata required one. Passive front paint therefore allowed a
registered target behind it to win.

Now every Canvas drawing primitive and every `Mesh`, `Cube`, or `Sphere` uses
`pointerEvents="auto"` by default. A hit returns that leaf as the logical
target and stops search behind it. This is true even when the matching handler
exists only on a propagation ancestor. Paint opacity and filtered pixels do not
change the declared hit geometry.

`pointerEvents="none"` is the explicit opt-out. It preserves painting while
removing that primitive from coordinate picking and focus participation:

```tsx
<Rectangle
  pointerEvents="none"
  style={{ width: 200, height: 80, fill: "rgba(255,255,255,0.2)" }}
/>
```

Apply the prop to decorative labels, guides, highlights, and overlays that
must not hide an interactive object painted earlier:

```tsx
<>
  <Rectangle
    style={{ width: 220, height: 72, fill: "#2563eb" }}
    onClick={openDetails}
  />
  <Text pointerEvents="none" style={{ x: 20, y: 22, fill: "white" }}>
    Open details
  </Text>
</>
```

Without the opt-out, clicking a glyph's declared line bounds selects the
passive `Text`, not the rectangle behind it.

## Structural containers remain non-targets

`Group`, `Clip`, `Layer`, `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid`
accept event-handler props as propagation listeners. They contribute ancestry
but no hit geometry. Clicking empty space in a group or layout allocation does
not select that structural component.

The same listener-only rule applies to `WebGLLayer` and `Group3D`. A handler on
either runs only when a selected WebGL descendant's event propagates through
it. Empty transparent `WebGLLayer` background is a miss and can pass through to
lower Canvas content.

## Audit an existing scene

Review paint from front to back, especially:

1. text or icons drawn over clickable cards;
2. decorative strokes, guides, masks, highlights, and selection outlines;
3. opacity-zero primitives that retain declared geometry;
4. filtered primitives whose blur or shadow does not enlarge hit geometry;
5. Canvas content painted after a WebGL island;
6. WebGL objects meant to reveal another object or Canvas target behind them.

Add `pointerEvents="none"` only where click-through is intended. Do not add it
to an ancestor merely to make one leaf transparent: on `WebGLLayer` it disables
the entire island picker, while drawing-leaf opt-out skips only that object.

Custom Canvas targets created by `crcEventTarget` remain explicit. Custom
WebGL primitives must declare geometry/custom hit behavior or the decorative
`none` capability; decorative definitions permit only
`pointerEvents="none"`.

## Event dispatch after selection

Once a leaf wins, CRC preserves the existing capture, target, and bubble
phases, logical related targets, activation, pointer capture, cursor, focus,
touch, wheel, and drag/drop behavior. This migration changes which painted
leaf participates in selection; it does not turn overlapping siblings into one
event path or make structural allocations into implicit rectangles.

See the [user-event contract](../design/user-events-contract.md), [mouse
geometry contract](../design/mouse-interaction-contract.md), and [WebGL islands
guide](../site/learn/guides/webgl-islands.md).
