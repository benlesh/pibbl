---
id: guide-focus-keyboard
title: Add focus and keyboard navigation
summary: Add logical focus, keyboard activation, and directional navigation while keeping Canvas as the native focus host.
kind: guide
slug: focus-and-keyboard
order: 70
keywords: [focus, keyboard, navigation, accessibility, events]
---

# Add focus and keyboard navigation

CRC can add logical keyboard interaction to explicit Canvas targets. The HTML
Canvas remains the one native DOM focus host. CRC does not create semantic DOM
descendants, ARIA controls, or a screen-reader accessibility tree.

## Opt in with policy components

```tsx
import {
  FocusManagement,
  KeyboardNavigation,
  Rectangle,
  useEventTarget,
  type CRCNode,
} from "@crc/core";

interface ButtonProps {
  onActivate: () => void;
}

function Button({ onActivate }: ButtonProps): CRCNode {
  const path = new Path2D();
  path.rect(20, 20, 140, 48);
  const focus = useEventTarget(
    {
      onClick: onActivate,
      onKeyDown: (event) => console.log(event.key),
    },
    {
      path,
      fill: true,
      cursor: "pointer",
      keyboardNavigationBounds: { x: 20, y: 20, width: 140, height: 48 },
    },
  );

  return (
    <Rectangle
      pointerEvents="none"
      style={{
        x: 20,
        y: 20,
        width: 140,
        height: 48,
        fill: "#2563eb",
        stroke: focus.isFocusVisible ? "#facc15" : undefined,
        strokeWidth: focus.isFocusVisible ? 4 : 0,
      }}
    />
  );
}

const scene = (
  <FocusManagement>
    <KeyboardNavigation mode="directional">
      <Button onActivate={() => console.log("activated")} />
    </KeyboardNavigation>
  </FocusManagement>
);
```

Each policy accepts exactly one CRC element after empty values are removed.
They are transparent preparation boundaries: they do not paint, lay out, own
hooks, or change the enhanced child's component identity. Directional
navigation requires focus management on the same root.

## Enrollment and interaction

Only logical event targets become candidates. A target enrolls automatically
with `onClick`, `onKeyDown`, or `onKeyUp`; set `keyboardFocusable: true` to add
another target or `false` to exclude it. Built-in Canvas drawing and
geometry-backed WebGL components create a logical target by default, even when
passive; `pointerEvents="none"` removes that drawing from hit and focus
participation. Propagation-only structural listeners never become candidates.

When `useEventTarget()` supplies custom geometry and a later drawing primitive
only visualizes it, mark that drawing `pointerEvents="none"` as in the example.
Otherwise the default-participating drawing would be the topmost logical target.

The manager owns source-order Tab and Shift+Tab traversal, logical
focus/blur/focusin/focusout events, pointer-press focus defaults,
focus-visible modality, and Enter/Space activation. Tab exits naturally at
either end; it does not wrap. `KeyboardNavigation mode="directional"` ranks
finite `keyboardNavigationBounds` for non-wrapping arrow movement. Nested
directional boundaries contain their own edges.

`useEventTarget()` returns `{ isFocused, isFocusVisible }` for rendering. The
snapshot is inert and false without active focus management. Logical focus
state may invalidate a retained `Layer` containing the changed target.

A root `OffscreenCanvas` cannot host DOM focus and rejects focus management.
Offscreen layers under an HTML Canvas share the root manager.

Geometry-backed WebGL targets derive directional-navigation bounds by
projecting their clipped 3D geometry bounds into their logical `WebGLLayer`.
An explicit `keyboardNavigationBounds` on a WebGL target is interpreted as a
layer-local 2D override. Custom-hit WebGL primitives need that override to
participate in arrow ranking. Source-order Tab behavior and the one native
Canvas focus host stay unchanged across the WebGL-to-Canvas bridge. See [Add
WebGL islands](#/learn/guides/webgl-islands#understand-paint-order-and-targeting).

## Accessibility responsibility

Canvas pixels and CRC's logical targets expose no names, roles, values,
relationships, reading order, text selection, or platform accessibility nodes.
Keyboard reachability is not equivalent to screen-reader accessibility.

For every meaningful Canvas interaction, provide an equivalent semantic DOM
experience that the application owns. Depending on the product, that can be a
real button/control beside the Canvas, a synchronized list or table, an
accessible form for editing, a summary plus data download, or an alternate
nonvisual workflow. Keep labels, state, order, validation, and actions derived
from the same application model. Do not hide the only operable controls in an
`aria-hidden` mirror or imply that logical focus alone makes the Canvas
accessible.

CRC intentionally has no hidden editable DOM adapter, semantic overlay, ARIA
mapping, live-region API, or generated accessibility tree. The Canvas owner is
also responsible for its accessible name and fallback/adjacent explanation.

See the normative [focus contract](../../../design/focus-and-keyboard-navigation-contract.md)
and [Canvas accessibility guidance](../../../design/canvas-accessibility-guidance.md).
Executable lessons cover [focus
management](../../../../packages/scenarios/src/learning/keyboard-focus/focus-management.example.tsx)
and [directional
navigation](../../../../packages/scenarios/src/learning/keyboard-focus/directional-navigation.example.tsx).
