---
id: tutorial-diagram-editor-editor-chrome
title: Build the editor chrome
summary: Allocate toolbar, workspace, and status regions without mixing layout placement into drawing geometry.
kind: tutorial
slug: editor-chrome
tutorial: diagram-editor
order: 5
keywords: [diagram editor, tutorial, absolute, layout, allocation, crcLayoutBox]
exampleSlug: diagram-editor-editor-chrome
---

# Build the editor chrome

## What you will make

Turn the diagram into an editor frame with a 56-pixel toolbar, a 512-pixel
workspace, and a 32-pixel status bar. The toolbar includes an intentionally
inert Reset view control; its behavior arrives with the view model later.
As an exercise, change the three region heights while keeping their total at
600 pixels.

## How it works

[`Absolute`](#/api/components/absolute) reads the specified style of each
direct child and gives that child a finite allocation. `left` and `top` place
the region; `width` and `height` define its local available box. The region
component calls [`crcLayoutBox()`](#/api/hooks/crc-layout-box) during render to
read that resulting local allocation.

## Build the change

`Toolbar`, `Workspace`, and `StatusBar` all accept the same specified-style
prop because they are direct children of `Absolute`. Each instead draws with a
focused style made from `box.width` and `box.height`. The workspace therefore
keeps node records in local workspace coordinates while Absolute performs the
root placement. See [Compose and lay out scenes](#/learn/guides/compose-and-layout)
for the broader layout model.

## Predict and try

Change the toolbar to 64 pixels and the status bar to 40 pixels, then reduce
the workspace to 496 pixels so the three allocations still total 600. Predict
which values follow automatically: the three background rectangles do, because
they read their allocated boxes; node coordinates do not, because they remain
local workspace geometry.

## Check your result

The three background regions should begin at y=0, y=56, and y=568 with heights
56, 512, and 32. Avoid forwarding a receiver's complete style object directly
to a drawing primitive: that would apply `left` and `top` a second time after
the layout parent has already placed the child. The [layout types](#/api/types/layout)
show the separate allocation and drawing vocabulary.

## What you learned

Specified style communicates with a direct layout parent, while
`crcLayoutBox()` reports the finite local drawing allocation. Keeping those
roles separate makes each region reusable and avoids double-placement mistakes.
The Reset view control is only paint in this chapter, so it cannot imply
behavior before the editor owns a view transform.
