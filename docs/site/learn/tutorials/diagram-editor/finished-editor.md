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

The final source puts pure model and coordinate helpers before the components that consume them. `updateNodePosition`, `rootToWorkspace`, and `zoomAroundPoint` make the mutable-looking gestures ordinary immutable model updates. [useMemo](#/api/hooks/use-memo) owns the expensive static grid path for the mounted `GridLayer`; each `NodeCard` owns its drag ref and cursor state, while `Workspace` separately owns its pan ref and cursor state.

## Build the change

Each local terminator clears a gesture only when that exact pointer owns it. Pointer up, cancellation, and capture loss all pass through the corresponding terminator. Removing a card unmounts the component that owns its drag session and cursor, so application ownership disappears naturally before any later pointer-up; it does not need a synthetic loss callback. There is deliberately no [useWhenChanged](#/api/hooks/use-when-changed): this editor owns no external resource requiring dependency-driven synchronization. The refs are appropriate because they represent in-flight pointer sessions, not visual state.

Stable card and edge keys preserve identity among their same parent siblings. Reparenting or changing a key remounts a component, which is why the source keeps the component tree deliberate. [useRef](#/api/hooks/use-ref) and [state and lifecycle](#/learn/guides/state-and-lifecycle) explain those ownership boundaries.

## Predict and try

Change `INITIAL_NODES`—for example, move Build or revise a subtitle. Predict that edges, selection, dragging, focus bounds, and filter placement derive from the model rather than from inspected pixels.

## Check your result

Select and drag Idea outside its initial card, pan empty workspace, zoom around a pointer, then reset only the view. Tab to Sketch and activate it. Dispose the controller twice: later browser events do not repaint. If a render fails, CRC releases runtime-owned resources and refs; pixels painted earlier in that frame are not rolled back.

## What you learned

This tutorial is complete, not a production diagramming product. Browser Canvas and `Path2D` behavior remain authoritative; nonempty filters and retained layers require their browser capabilities. Production work still needs an application-owned representation of the same nodes and relationships, synchronized with the Canvas model and offering equivalent selection, traversal, activation, editing, and relationship operations to assistive technology. Do not bolt on a separate keyboard implementation that can diverge from the Canvas actions; route both surfaces through the same model commands. Persistence, undo, recovery UX, and product-specific testing also remain application work. Review [focus and keyboard navigation](#/learn/guides/focus-and-keyboard) and [style and draw](#/learn/guides/style-and-draw) before extending it.
