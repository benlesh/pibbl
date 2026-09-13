---
id: tutorial-diagram-editor-canvas-scene
title: Create the Canvas scene
summary: Mount a fixed logical Canvas and paint the three regions that frame the editor.
kind: tutorial
slug: canvas-scene
tutorial: diagram-editor
order: 1
keywords: [diagram editor, tutorial, crc, canvas, disposal]
exampleSlug: diagram-editor-canvas-scene
---

# Create the Canvas scene

## See the editor frame

Start with a clear frame for the editor: a light toolbar, a roomy workspace,
and a dark status strip. The workbench paints `WORKFLOW MAP`, a workspace
message, and `READY · 100%`. As an exercise, change `WORKFLOW MAP` to a title
of your own and watch that one fixed Canvas region update.

## Render one synchronous scene

`DiagramEditor` is an ordinary synchronous component function. On a render,
CRC evaluates the tree and traverses all of its returned primitives in paint
order: the toolbar, its label, the workspace, its copy, then the status strip
and status copy. There is no generated DOM or retained scene graph behind this
first frame.

## Mount the Canvas and keep its controller

The snapshot ends by mounting the component with
`crc(canvas, <DiagramEditor />)`. [`crc`](#/api/functions/crc) returns one
stable controller for that Canvas, which is the object that owns the mounted
scene and later disposes it. The toolbar and workspace are plain
[`Rectangle`](#/api/components/rectangle) primitives; their labels are
[`Text`](#/api/components/text) primitives.

## Use fixed logical coordinates

This chapter declares a 960 by 600 logical Canvas. The toolbar occupies y=0
through y=56, the workspace runs to y=568, and the 32-pixel status strip fills
the remainder. CRC can scale that logical viewport when CSS presents the
Canvas at a different size, but the positions in this source still use the
same 960 by 600 coordinate system.

## Let the scheduler paint and dispose deliberately

`crc` schedules the initial paint; mounting does not require a manual render
loop. When the scene is no longer needed, call the controller's `dispose()`.
It is idempotent, so cleanup code may call it more than once without creating a
second teardown. For using this snapshot in an application, see
[Configure JSX](#/learn/guides/configure-jsx).

## Check your work

Successful output shows all three regions and the `READY · 100%` status copy.
If the Canvas looks scaled in the Studio, that is expected: changing its CSS
size does not change this chapter's fixed logical coordinate system.
