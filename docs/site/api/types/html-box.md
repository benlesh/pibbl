---
id: api-types-html-box
title: HTML box types
summary: Native HTML mounting, updates, presentation, and focus snapshots.
kind: api
slug: html-box
apiCategory: types
symbols:
  [
    HtmlBoxFocusState,
    HtmlBoxEventHandlers,
    HtmlBoxProps,
    HtmlBoxStyle,
    HtmlMountCallback,
    HtmlUpdateFunction,
  ]
---

# HTML box types

## HtmlBoxFocusState

Readonly `isFocusWithin` and `isFocusVisible` booleans describe the whole native
region. Native descendants keep their browser focus and focus rings.

See [HtmlBox](#/api/components/html-box).

## HtmlBoxProps

`data` is the opaque application payload, `mount` is its mount callback,
`pointerEvents` is `"auto" | "none"`, and optional `onFocusChange` observes the
region snapshot. Read a Pibbl signal with `.get()` to subscribe the enclosing
component when replacing data. `data` is not recursively resolved.

## HtmlBoxEventHandlers

Optional native handler props use `PibblEventHandlers` names and payloads, including
capture variants. Coordinate events add readonly `localX` and `localY` measured
from the HtmlBox border origin before padding; `x` and `y` remain root-logical.
Keyboard, input, focus, composition and clipboard events do not gain coordinates.
The native DOM target remains available through `originalEvent.target`.

`HtmlBoxProps` extends this handler map. `target` identifies the logical HtmlBox
and its pointer-capture methods use the native content DIV. `currentTarget` follows
the Pibbl ancestor path. Native descendant handlers stay between logical capture
and bubble; cancellation and the original DOM bubbling flag are preserved.

See [HtmlBox](#/api/components/html-box) for a complete example.

## HtmlBoxStyle

Pibbl box/layout fields and Group affine transform fields, plus opacity. Width and
height default to the parent's allocation; DOM content does not define intrinsic
size. Overflow defaults to clip. Canvas filters enclosing HtmlBox are unsupported.

## HtmlMountCallback

```ts
type HtmlMountCallback<Props> = (
  element: HTMLDivElement,
  initialProps: Props,
  signal: AbortSignal,
) => HtmlUpdateFunction<Props>;
```

Creates content once in a connected DIV and returns its updater. Use the native
AbortSignal for listener and resource cleanup before the DIV is removed.

## HtmlUpdateFunction

```ts
type HtmlUpdateFunction<Props> = (props: Props) => void;
```

Updates persistent content after subsequent successful component renders. A clean
Layer reprojection does not call the updater. Return a no-op if updates are unused.
