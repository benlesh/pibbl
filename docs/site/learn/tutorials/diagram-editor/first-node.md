---
id: tutorial-diagram-editor-first-node
title: Draw the first node
summary: Compose Rectangle and Text primitives to place the first workflow node in local coordinates.
kind: tutorial
slug: first-node
tutorial: diagram-editor
order: 2
keywords: [diagram editor, tutorial, rectangle, text, group, style]
exampleSlug: diagram-editor-first-node
---

# Draw the first node

Replace the empty workspace message with one coral Idea card. The card is one
recognizable workflow node, made from a rounded body, a title, a subtitle, and
two small ports. As an exercise, change the Idea color and the `Find the
spark` subtitle, then compare the result with the original card.

## Keep style local and closed

Each [`Rectangle`](#/api/components/rectangle) and
[`Text`](#/api/components/text) has an explicit local `style` object. CRC
styles do not cascade or inherit through the component tree, so the coral card
body, dark type, border, and font choices live on the primitives that paint
them. This makes the source a useful place to see the exact geometry and paint
choices that form one node.

## Give the card its own coordinates

The card lives in a translated [`Group`](#/api/components/group). Its workspace
position is `(92, 180)`; after the workspace starts at y=56, the Group is at
root position `(92, 236)`. Inside that Group, the card body starts at local
`(0, 0)`, while the title and subtitle use card-local positions. The Group
applies its translation once to every child.

## Keep decoration out of targeting

The card body remains the painted primitive that can participate in pointer
targeting later. Its text and the two 10-pixel ports are decoration, so each
uses `pointerEvents="none"`. That opt-out prevents a label or port from
winning a future click intended for the card body.

## Check your work

The `IDEA` title should paint near root `(176, 270)`, with `Find the spark`
below it. Keep the three spaces distinct: workspace `(92, 180)`, root
`(92, 236)`, and card-local `(0, 0)`. Do not add the Group translation to each
child again, or the card will move twice as far. For more style detail, see
[Style and draw](#/learn/guides/style-and-draw).
