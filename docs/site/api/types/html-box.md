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
