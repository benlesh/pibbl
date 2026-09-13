---
id: tutorial-diagram-editor-finished
title: Finish and harden the editor
summary: Review the complete editor, harden ownership and identity, and separate tutorial completeness from production readiness.
kind: tutorial
slug: finished-editor
tutorial: diagram-editor
order: 12
keywords: [diagram editor, tutorial, cleanup, identity, memo, focus]
exampleSlug: diagram-editor-finished
---

# Finish and harden the editor

## What you will make

Review the completed 960 by 600 workflow editor: selected cards glow, dragging and panning preserve their separate state, wheel zoom stays anchored, and keyboard controls remain available.

## How it works

The final source puts pure model and coordinate helpers before the components that consume them. `updateNodePosition`, `rootToWorkspace`, and `zoomAroundPoint` make the mutable-looking gestures ordinary immutable model updates. [crcMemo](#/api/hooks/crc-memo) owns the expensive static grid path for the mounted `GridLayer`; the gesture ref owns only synchronous browser-event ownership.

## Build the change

One `finishGesture(pointerId)` clears a gesture only when that exact pointer owns it. Pointer up, cancellation, and capture loss all pass through that terminator. There is deliberately no [crcWhenChanged](#/api/hooks/crc-when-changed): this editor owns no external resource requiring dependency-driven synchronization. The ref is still appropriate because it represents an in-flight pointer session, not visual state.

Stable card and edge keys preserve identity among their same parent siblings. Reparenting or changing a key remounts a component, which is why the source keeps the component tree deliberate. [crcRef](#/api/hooks/crc-ref) and [state and lifecycle](#/learn/guides/state-and-lifecycle) explain those ownership boundaries.

## Predict and try

Change `INITIAL_NODES`—for example, move Build or revise a subtitle. Predict that edges, selection, dragging, focus bounds, and filter placement derive from the model rather than from inspected pixels.

## Check your result

Select and drag Idea outside its initial card, pan empty workspace, zoom around a pointer, then reset only the view. Tab to Sketch and activate it. Dispose the controller twice: later browser events do not repaint. If a render fails, CRC releases runtime-owned resources and refs; pixels painted earlier in that frame are not rolled back.

## What you learned

This tutorial is complete, not a production diagramming product. Browser Canvas and `Path2D` behavior remain authoritative; nonempty filters and retained layers require their browser capabilities. Production work still needs semantic accessibility, persistence, editing, undo, recovery UX, and product-specific testing. Review [focus and keyboard navigation](#/learn/guides/focus-and-keyboard) and [style and draw](#/learn/guides/style-and-draw) before extending it.
