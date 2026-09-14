---
id: tutorial-diagram-editor-dragging
title: Drag nodes safely
summary: Keep a node drag owned after the pointer leaves its painted card.
kind: tutorial
slug: dragging
tutorial: diagram-editor
order: 7
keywords: [diagram editor, tutorial, pointer capture, dragging, refs, state]
exampleSlug: diagram-editor-dragging
---

# Drag nodes safely

## What you will make

Drag a card beyond its painted body and keep its connection attached until the pointer ends.

## How it works

The card captures one pointer ID on pointer down. [`crcRef`](#/api/hooks/crc-ref) stores that gesture synchronously between native events, while rendered state remains frame-coalesced.

## Build the change

Record root-logical pointer and workspace node origins. Each move uses an immutable functional update. [Event types](#/api/types/events) expose capture, cancel, and loss notifications.

```tsx
const dragSession = crcRef<NodeDragSession | null>(null);

const onPointerDown = (node: DiagramNode, event: CRCPointerEvent) => {
  const pointerStart = rootToWorkspace(event);
  event.currentTarget.setPointerCapture(event.pointerId);
  dragSession.current = {
    kind: "node",
    pointerId: event.pointerId,
    nodeId: node.id,
    pointerStart,
    nodeStart: { x: node.x, y: node.y },
  };
};

const onPointerMove = (event: CRCPointerEvent) => {
  const session = dragSession.current;
  if (!session || session.pointerId !== event.pointerId) return;
  const point = rootToWorkspace(event);
  setNodes((current) =>
    current.map((node) =>
      node.id === session.nodeId
        ? {
            ...node,
            x: session.nodeStart.x + point.x - session.pointerStart.x,
            y: session.nodeStart.y + point.y - session.pointerStart.y,
          }
        : node,
    ),
  );
};
```

Matching the pointer ID prevents a second pointer from stealing the drag. Capturing before the pointer leaves the card prevents outside moves from disappearing; pointer up, cancellation, and capture loss all clear the same session so a stale owner cannot move a node later.

## Predict and try

Predict why a move before the next paint still has a current owner. Then clamp positions to x `-40..1232` and y `-40..816` for generous panning overscan.

## Check your result

Idea moves outside its original card and its edge follows. Release, `pointercancel`, and `lostpointercapture` clear the session so later moves cannot change it.

## What you learned

Capture is per pointer ID, and refs retain synchronous gesture ownership. See [Manage state and lifecycle](#/learn/guides/state-and-lifecycle).
