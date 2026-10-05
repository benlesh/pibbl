# Default drawing pointer participation

Status: migration guidance for default Canvas and committed external-renderer
interaction, updated for the Three.js pivot on 2026-09-28.

Pibbl drawing primitives now participate in coordinate hit testing by default,
even when they have no event handler, cursor, or focus option. This aligns
Canvas 2D drawing and external-renderer targets: visible front content owns its
declared geometry unless the author explicitly makes it transparent to hit
testing.

## What changed

Previously, a Canvas drawing primitive created a logical target only when
interactive metadata required one. Passive front paint therefore allowed a
registered target behind it to win.

Now every Canvas drawing primitive uses `pointerEvents="auto"` by default. A hit
returns that leaf as the logical target and stops search behind it. This is true
even when the matching handler exists only on a propagation ancestor. Paint
opacity and filtered pixels do not change the declared hit geometry.

External render layers publish their matching interaction generation at the
same Canvas paint position. The Three.js adapter's default raycaster reports a
registered object as a Pibbl target, visible unregistered geometry as a blocker,
and empty pixels as a miss. A declared Three target may opt out with
`pointerEvents="none"`.

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

An external render layer is one flattened Canvas composition entry rather than
a Pibbl container for its renderer-native objects. Its committed targets provide
logical leaves, while `missBehavior` explicitly chooses whether empty pixels
pass through, block lower paint, or target the layer itself.

## Audit an existing scene

Review paint from front to back, especially:

1. text or icons drawn over clickable cards;
2. decorative strokes, guides, masks, highlights, and selection outlines;
3. opacity-zero primitives that retain declared geometry;
4. filtered primitives whose blur or shadow does not enlarge hit geometry;
5. Canvas content painted after an external render layer;
6. Three objects meant to reveal another object or Canvas target behind them.

Add `pointerEvents="none"` only where click-through is intended. On a render
layer component it disables the complete committed resolver, while opt-out on a
declared Three target skips only that object subtree in default picking.

Custom Canvas targets created by `useEventTarget` remain explicit. Generic
render layers publish targets and a hit test through their interaction snapshot;
`defineThreeLayer()` derives the default behavior from ordinary Three objects
and optional target declarations.

## Event dispatch after selection

Once a leaf wins, Pibbl preserves the existing capture, target, and bubble
phases, logical related targets, activation, pointer capture, cursor, focus,
touch, wheel, and drag/drop behavior. This migration changes which painted
leaf participates in selection; it does not turn overlapping siblings into one
event path or make structural allocations into implicit rectangles.

See the [user-event contract](../design/user-events-contract.md), [mouse
geometry contract](../design/mouse-interaction-contract.md), and [Three.js
integration guide](../site/learn/guides/three-js.md).
