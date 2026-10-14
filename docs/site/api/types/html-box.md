---
id: api-types-html-box
title: HTML box types
summary: Native HTML mounting, updates, presentation, and focus snapshots.
kind: api
slug: html-box
apiCategory: types
symbols:
  [
    HtmlBoxProps,
    HtmlBoxStyle,
    HtmlMountCallback,
    HtmlUpdateFunction,
    HtmlBoxFocusState,
    HtmlBoxEventHandlers,
  ]
---

# HTML box types

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

## HtmlBoxProps

`data` is the opaque application payload, `mount` is its mount callback,
`pointerEvents` is `"auto" | "none"`, and optional `onFocusChange` observes the
region snapshot. Read a CRC signal with `.get()` to subscribe the enclosing
component when replacing data. `data` is not recursively resolved.

## HtmlBoxEventHandlers

The existing CRC event prop names and capture variants, with their existing
payloads. Coordinate events add readonly `localX` and `localY` from the HtmlBox's
untransformed border-box top-left, including its padding area. `x` and `y` remain
root Canvas-logical coordinates. Nested native targets do not change this origin.
`originalEvent` is the actual native event; `target` is a stable CRC event target
whose pointer capture methods delegate to the supplied native DIV.

Capture runs along CRC ancestors before native descendant handlers. Bubbling
runs after descendants, only if the native event reaches the host. Native
cancellation and defaults are preserved. Nonbubbling events run ancestor capture
and host handlers without ancestor bubble. Document-only events are not relayed.
Each CRC capture or bubble phase batches signal writes separately; capture writes
publish before native descendant handlers run.

## HtmlBoxStyle

CRC box/layout fields and Group affine transform fields, plus opacity. Width and
height default to the parent's allocation; DOM content does not define intrinsic
size. Overflow defaults to clip. Canvas filters enclosing HtmlBox are unsupported.

## HtmlBoxFocusState

Readonly `isFocusWithin` and `isFocusVisible` booleans describe the whole native
region. Native descendants keep their browser focus and focus rings.

See [HtmlBox](#/api/components/html-box).
