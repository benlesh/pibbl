---
id: tutorial-diagram-editor-canvas-scene
title: Create the Canvas scene
summary: Mount a fixed logical Canvas and paint the three regions that frame the editor.
kind: tutorial
slug: canvas-scene
tutorial: diagram-editor
order: 1
keywords: [diagram editor, tutorial, pibbl, canvas, disposal]
exampleSlug: diagram-editor-canvas-scene
---

# Create the Canvas scene

## What you will make

Start with a clear frame for the editor: a light toolbar, a roomy workspace,
and a dark status strip. The workbench paints `WORKFLOW MAP`, a workspace
message, and `READY · 100%`. As an exercise, change `WORKFLOW MAP` to a title
of your own and watch that one fixed Canvas region update.

## How it works

`DiagramEditor` is an ordinary synchronous component function. On a render,
Pibbl evaluates the tree and traverses all of its returned primitives in paint
order: the toolbar, its label, the workspace, its copy, then the status strip
and status copy. There is no generated DOM or retained scene graph behind this
first frame.

## Build the change

The snapshot ends by mounting the component with
`pibbl(canvas, <DiagramEditor />)`. [`pibbl`](#/api/functions/pibbl) returns one
stable controller for that Canvas, which is the object that owns the mounted
scene and later disposes it. The toolbar and workspace are plain
[`Rectangle`](#/api/components/rectangle) primitives; their labels are
[`Text`](#/api/components/text) primitives.

## Predict and try

This chapter declares a 960 by 600 logical Canvas. The toolbar occupies y=0
through y=56, the workspace runs to y=568, and the 32-pixel status strip fills
the remainder. Change `WORKFLOW MAP` to your own title, then try changing the
Canvas CSS presentation size. Pibbl can scale the logical viewport, but the
positions in this source still use the same 960 by 600 coordinate system.

## Check your result

Successful output shows all three regions and the `READY · 100%` status copy.
If the Canvas looks scaled in the Studio, that is expected: changing its CSS
size does not change this chapter's fixed logical coordinate system.

## What you learned

`pibbl` schedules the initial paint; mounting does not require a manual render
loop. When the scene is no longer needed, call the controller's `dispose()`.
It is idempotent, so cleanup code may call it more than once without creating a
second teardown. For using this snapshot in an application, see
[Configure JSX](#/learn/guides/configure-jsx).
