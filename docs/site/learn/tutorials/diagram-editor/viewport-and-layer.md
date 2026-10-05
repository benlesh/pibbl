---
id: tutorial-diagram-editor-viewport-and-layer
title: Constrain the viewport
summary: Crop transformed content and retain only the stable dot-grid subtree.
kind: tutorial
slug: viewport-and-layer
tutorial: diagram-editor
order: 9
keywords: [diagram editor, tutorial, clip, layer, path, offscreen canvas]
exampleSlug: diagram-editor-viewport-and-layer
---

# Constrain the viewport

## What you will make

Crop panned and zoomed diagram content to the workspace while giving its static dot grid one explicit retained home.

## How it works

[`Clip`](#/api/components/clip) receives a `Path2D` that describes the workspace rectangle. The same path constrains paint and coordinate targeting, so a card that visually leaves the workspace cannot win a click above the toolbar. The workspace background stays inside that clip but outside the transformed group, giving empty space stable pan geometry.

[`Layer`](#/api/components/layer) owns only the dot [`Path`](#/api/components/path). Its children render into an upright local `OffscreenCanvas` surface, then Pibbl applies the outer group presentation when it composites the bitmap. Because the grid subtree and layer dimensions stay unchanged while you pan, Pibbl can reuse that retained bitmap; cards and connections remain on the ordinary immediate rendering path.

## Build the change

Create the clip path and grid dots once at module scope, then put the transformed content inside the clip. The wheel listener belongs on the Clip as a propagation listener, while the background remains the actual empty-space target.

```tsx
<Clip style={{ d: WORKSPACE_CLIP, width: 960, height: 512 }} onWheel={onWheel}>
  <Rectangle
    style={{ width: 960, height: 512, fill: "#eef2e8" }}
    {...panHandlers}
  />
  <Group style={viewPresentation}>
    <Layer style={{ width: 1400, height: 900 }}>
      <Path pointerEvents="none" style={{ d: GRID_DOTS, fill: "#c8d2c6" }} />
    </Layer>
    {connections}
    {nodes}
  </Group>
</Clip>
```

`Layer` is explicit ownership, not an automatic optimization. It requires browser `OffscreenCanvas`; only retain a subtree after identifying a stable boundary worth reusing. See [Style and draw](#/learn/guides/style-and-draw) for the local drawing style model.

## Predict and try

Change the workspace clip path’s right edge from x=960 to x=760. Predict both results before you run it: the rightmost pixels disappear, and the clipped-away card content is no longer targetable even though its transformed geometry still exists in the diagram model.

## Check your result

Pan the workspace: the cards and connections move, but the grid layer can reuse its clean bitmap. Pan Idea upward until it would cross the toolbar; clicking where the card would have been above y=56 does not select it. Reset the view and the same card is immediately targetable inside the viewport.

## What you learned

Clip geometry is shared by paint and hit testing, while a Layer is a persistent retained boundary with an upright local surface. Keep the retained boundary narrow: here it owns only the stable grid, leaving dynamic diagram content immediate. Review the [Clip](#/api/components/clip), [Layer](#/api/components/layer), and [Path](#/api/components/path) APIs when composing your own scene.
