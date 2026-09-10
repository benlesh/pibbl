---
id: guide-author-without-jsx
title: Author without JSX
summary: Use createElement for the complete CRC authoring API without JSX syntax.
kind: guide
slug: author-without-jsx
order: 20
keywords: [createElement, non-jsx, authoring, fragments]
exampleSlug: create-element-authoring
---

# Author without JSX

`createElement(type, props, ...children)` is the complete non-JSX API. It uses
the same branded element protocol, component identity, child traversal, style,
hooks, events, focus policies, scheduling, and disposal as JSX. You do not need
any JSX compiler configuration to use this guide.

## Install and mount

```sh
pnpm add @crc/core
```

```ts docs:complete-snippet=without-jsx
import {
  FocusManagement,
  Fragment,
  Group,
  KeyboardNavigation,
  Rectangle,
  Text,
  crc,
  createElement,
  crcState,
  type CRCController,
  type CRCNode,
} from "@crc/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): CRCNode {
  const [message, setMessage] = crcState(initialMessage);

  const cards = ["A", "B"].map((label, index) =>
    createElement(
      Group,
      { key: label, children: null },
      createElement(Rectangle, {
        style: {
          x: 32 + index * 100,
          y: 100,
          width: 84,
          height: 56,
          fill: "#f7c948",
          cursor: "pointer",
        },
        onClick: () => setMessage(label),
      }),
      createElement(Text, { style: { x: 64 + index * 100, y: 116 } }, label),
    ),
  );

  return createElement(
    FocusManagement,
    null,
    createElement(
      KeyboardNavigation,
      { mode: "directional", children: null },
      createElement(
        Group,
        null,
        createElement(Rectangle, {
          style: { width: 240, height: 180, fill: "#1f4bd8" },
        }),
        createElement(
          Text,
          { style: { x: 24, y: 28, fill: "white" } },
          "Selected: ",
          message,
        ),
        createElement(Fragment, { key: "choices", children: null }, cards),
      ),
    ),
  );
}

export function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, createElement(Poster, { initialMessage: "None" }));
}

export function attach(canvas: HTMLCanvasElement): () => void {
  const controller = mount(canvas);
  return () => controller.dispose();
}
```

Call `controller.dispose()` when the owner removes the Canvas or no longer
needs the scene. Disposal is safe to repeat.

## Constructor rules

```ts
createElement(type, props, ...children);
```

- `type` is a CRC component value or ordinary synchronous component function.
- `props` is the component's props object or `null`.
- With no variadic children, an explicitly supplied `props.children` is
  preserved.
- One variadic child becomes `children`; several become an array. Variadic
  children override `props.children`.
- For a dynamic list, pass the array as one third argument:
  `createElement(Group, null, items.map(makeItem))`.
- `key` may be a string or number, is normalized to a string, and is removed
  from delivered props.
- The constructor copies the top-level props object. Development builds
  shallow-freeze synthetic props and the element, but nested author objects are
  not deep-frozen.

Directly calling `Rectangle(props)` or another platform component does not
create an element and throws a targeted diagnostic. Always use
`createElement(Rectangle, props)`.

## Children, text, and containers

`Group`, `Clip`, `Layer`, `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid`
accept recursive synchronous node input. Arrays and finite iterables flatten;
booleans, `null`, `undefined`, the empty string, and zero are empty. Non-empty
raw strings and nonzero numbers outside `Text` are errors.

Pass textual values to `Text` as constructor children:

```ts
createElement(Text, { style: { x: 20, y: 20 } }, "Count: ", 0);
```

Zero renders inside `Text`. Text children may be nested arrays or finite
iterables of strings, numbers, and empty values. Elements are invalid inside
textual content.

`Fragment` is available for an explicit keyed identity boundary:

```ts
import { Fragment, createElement, type CRCNode } from "@crc/core";

function keyedSection(section: { id: string; elements: CRCNode }) {
  return createElement(
    Fragment,
    { key: section.id, children: null },
    section.elements,
  );
}
```

## Focus and lifecycle

`FocusManagement` and `KeyboardNavigation` are component values here too.
Each policy requires exactly one CRC element after empty values are removed;
nest them as shown in the full example. They do not create paint, layout, or an
extra identity boundary.

Hooks run only when CRC later invokes the component during its synchronous
scheduled traversal. Calling the component directly is not a substitute for
constructing an element. All hook-order, identity, failure, and ownership rules
in the [lifecycle guide](#/learn/guides/state-and-lifecycle) apply
unchanged.

The executable Studio lesson is
[`create-element-authoring.example.tsx`](../../../../packages/scenarios/src/learning/start/create-element-authoring.example.tsx).
