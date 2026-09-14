---
id: tutorial-diagram-editor-selection
title: Select nodes with state
summary: Select a node through its painted body and render model state on the next scheduled frame.
kind: tutorial
slug: selection
tutorial: diagram-editor
order: 6
keywords: [diagram editor, tutorial, state, selection, click, cursor]
exampleSlug: diagram-editor-selection
---

# Select nodes with state

## What you will make

Make the gold Sketch card selected at startup, then click any card to select
it. The selected card gets a 5-pixel dark outline, and the status bar reports
`SELECTED · <TITLE>` alongside `ZOOM · 100%`. As an exercise, make clicking
the already selected card clear the selection.

## How it works

The diagram owns ordinary application IDs such as `"idea"` and `"sketch"`;
they are stable model data rather than Canvas target objects. `DiagramEditor`
stores the selected ID with [`crcState`](#/api/hooks/crc-state), finds the
matching node record, and passes a boolean plus one selection callback down to
each `NodeCard`.

## Build the change

Only the rounded card body has `onClick` and `cursor: "pointer"`. Its title,
subtitle, ports, edges, and other decorative paint use `pointerEvents="none"`,
so they cannot occlude that intended target. The workspace background owns its
own click handler to clear selection. The available [event types](#/api/types/events)
describe the DOM-aligned handler surface.

## Predict and try

Click Idea and predict when the status changes. The handler changes state, but
it does not synchronously repaint pixels: CRC coalesces the request into a
future scheduled frame. Then change `onSelect` so a matching selected ID
becomes `null`; clicking the same body again should show `NO SELECTION`.

## Check your result

The initial status reads `SELECTED · SKETCH`. Clicking the center of Idea's
painted body changes the next painted status to `SELECTED · IDEA`, while
clicking empty workspace clears it. If a label steals a click, it is decorative
paint that has not opted out of targeting; review [Style and draw](#/learn/guides/style-and-draw)
and make that child non-targeting.

## What you learned

Selection is explicit application state: model IDs describe what is selected,
and the rendered outline and status are consequences of that state. Constraining
interaction to the painted body keeps target ownership legible, while scheduled
rendering keeps rapid state writes coalesced into the next frame.
