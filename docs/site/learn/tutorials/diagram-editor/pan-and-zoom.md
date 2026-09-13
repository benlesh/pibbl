---
id: tutorial-diagram-editor-pan-and-zoom
title: Pan and zoom the workspace
summary: Pan empty workspace and zoom around the pointer without moving domain data.
kind: tutorial
slug: pan-and-zoom
tutorial: diagram-editor
order: 8
keywords: [diagram editor, tutorial, pan, zoom, wheel, transform]
exampleSlug: diagram-editor-pan-and-zoom
---

# Pan and zoom the workspace

## What you will make

Pan empty workspace, wheel-zoom around the pointer, and reset the presentation without undoing moved nodes.

## How it works

Nodes remain in workspace coordinates while one outer [`Group`](#/api/components/group) applies pan and zoom presentation once. Inverse mapping subtracts the workspace top and pan, then divides by zoom.

## Build the change

The background owns a pan session. The workspace owns wheel input, calls `preventDefault()`, clamps zoom to 60%–180%, and computes pan from the pointer anchor. See [style types](#/api/types/styles) and [event types](#/api/types/events).

## Predict and try

Change the wheel exponent coefficient from `0.001` to `0.0015`. The zoom step changes, but the anchor remains stable.

## Check your result

Pan moves every displayed node together, wheel preserves the point below the pointer, and Reset returns to 100% with moved node data intact.

## What you learned

Domain data and viewport presentation are separate state. Owned wheel cancellation prevents browser scrolling only for this workspace gesture.
