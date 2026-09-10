---
id: api-overview
title: API overview
summary: The supported @crc/core API, arranged by authoring role.
kind: api
slug: overview
apiCategory: overview
symbols: [Fragment]
keywords: [canvas, JSX, createElement, API]
---

# API overview

Import application-facing values and types from `@crc/core`. Subpaths below
`@crc/core/lib/*` and `@crc/core/src/*` are not supported.

```ts
import { Fragment, Rectangle, Text, crc } from "@crc/core";
```

## Authoring

Use automatic JSX with `@crc/core/jsx-runtime`, or use
[`createElement`](#/api/functions/create-element) for the equivalent explicit
form. `Fragment` is the explicit fragment value; JSX shorthand is usually more
readable, while `Fragment` is useful when a fragment needs a key. Unkeyed
fragments are transparent; a keyed fragment creates an identity scope.

## Browse the runtime

- [Components](#/api/components/absolute) draw, compose, lay out, and add
  focus policy. They are alphabetized in the sidebar.
- [Functions](#/api/functions/crc) mount scenes, build paths, measure, and
  resolve the public style/layout helpers.
- [Hooks](#/api/hooks/crc-canvas-context) are render-only APIs for state,
  lifecycle, paths, interaction, and allocated layout.

Type contracts are grouped by domain in the API sidebar. They describe the
props, local styles, event facades, filters, layout, and element protocol used
by these runtime values.

## A small scene

```tsx
function Poster() {
  return (
    <>
      <Rectangle
        style={{ x: 24, y: 24, width: 240, height: 100, fill: "#164e9b" }}
      />
      <Text
        style={{ x: 48, y: 78, fill: "white", font: "600 28px sans-serif" }}
      >
        Hello, CRC
      </Text>
    </>
  );
}

crc(document.querySelector("canvas")!, <Poster />);
```

Start with the [Getting started guide](#/learn/guides/configure-jsx).
