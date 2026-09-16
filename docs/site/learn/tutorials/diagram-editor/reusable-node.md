---
id: tutorial-diagram-editor-reusable-node
title: Extract a reusable node component
summary: Turn four workflow records and four edges into keyed reusable components.
kind: tutorial
slug: reusable-node
tutorial: diagram-editor
order: 4
keywords: [diagram editor, tutorial, components, props, fragments, keys, arrays]
exampleSlug: diagram-editor-reusable-node
---

# Extract a reusable node component

## What you will make

Replace the two hand-written cards with four workflow records: Idea, Sketch,
Build, and Ship. Each record paints through the same `NodeCard` component, and
four edge records paint before them. As an exercise, add a temporary fifth node
record without adding an edge.

## How it works

`NodeCard` is an ordinary function that receives one `node` prop and returns a
translated Group. The node data remains in workspace coordinates because the
whole workspace drawing is translated by the 56-pixel toolbar height. This
separates domain data from root Canvas presentation coordinates.

## Build the change

The `EDGES.map(...)` and `INITIAL_NODES.map(...)` calls are children of a
[`Fragment`](#/api/types/elements-components). Arrays are valid children, and
the stable edge and node IDs become sibling keys. Keys distinguish repeated
siblings under this one parent; the component function itself also participates
in identity. `Connection` resolves its IDs before drawing and throws an
actionable error when an edge names a missing node.

## Predict and try

Predict whether a fifth node with a unique `id`, title, color, and coordinates
needs an edge to render. It does not: the node array maps independently of the
edge array. Add that temporary record, confirm its card appears, then remove it
again. Next, intentionally misspell an edge endpoint to see the missing-node
validation identify that edge.

## Check your result

The final frame shows each of `IDEA`, `SKETCH`, `BUILD`, and `SHIP` exactly
once. Each dark connection begins and ends at a card port computed from the
current records and the shared 168 by 84 node geometry. If a card remounts
unexpectedly after reordering, check the key and parent structure rather than
adding an unrelated wrapper. See
[Components, props, and children](#/learn/guides/components-props-and-children)
for the authoring model.

## What you learned

Records describe the diagram, reusable components turn those records into
paint, and keyed array children preserve sibling identity within their parent.
Fragments keep the edge-first paint order without inventing an extra drawing
container, while validation makes incorrect graph data visible early.
