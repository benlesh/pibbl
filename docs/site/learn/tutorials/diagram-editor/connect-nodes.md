---
id: tutorial-diagram-editor-connect-nodes
title: Connect two nodes
summary: Draw a curved connection behind two cards and make paint order part of the design.
kind: tutorial
slug: connect-nodes
tutorial: diagram-editor
order: 3
keywords: [diagram editor, tutorial, path, bezier, paint order, pointer events]
exampleSlug: diagram-editor-connect-nodes
---

# Connect two nodes

## What you will make

Add a gold Sketch card and a curved arrow from Idea to Sketch. The connection
is deliberately painted first, so it travels behind the two cards instead of
crossing their labels. Move Sketch as an exercise, then update its explicit
connection endpoint to keep the arrow attached.

## How it works

A [`Path`](#/api/components/path) receives a browser `Path2D` value. Here,
`connectionPath` starts at Idea's output port and uses cubic Bézier control
points to bend naturally toward Sketch's input port. The bend is calculated
from the horizontal distance, with a minimum so close nodes still have a clear
curve.

## Build the change

The returned array places the connection path and its small arrowhead before
either card Group. CRC traverses source in paint order, so later card pixels
cover the line where they overlap. Both connection primitives use
`pointerEvents="none"`: the arrow is visual information, not a target that
should steal future node gestures. [`Group`](#/api/components/group) still
keeps each card's local drawing coordinates together.

## Predict and try

Predict what happens when you move Sketch right by 80 logical pixels without
changing the endpoint. The card moves but the connection misses its port.
Then update both the Sketch Group position and the `sketchPort` coordinate.
Try swapping the returned connection and card Groups afterward to see source
paint order put the stroke over the cards.

## Check your result

You should see `IDEA` and `SKETCH`, one dark 4-pixel curve, and an arrowhead
that stops at Sketch's left port. If the arrow paints over the coral card, its
`Path` appears too late in the returned array. If it steals a future click,
check that both the curve and arrowhead opt out of targeting. For the drawing
vocabulary, see [Style and draw](#/learn/guides/style-and-draw).

## What you learned

`Path2D` holds explicit canvas geometry, while cubic control points make a
connection legible without a straight line. Source order is part of the visual
design, and decorative geometry should not become interaction geometry.
