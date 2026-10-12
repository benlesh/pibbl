---
id: api-function-create-element
title: createElement
summary: Creates the branded Pibbl element descriptor without JSX.
kind: api
slug: create-element
apiCategory: function
symbols: [createElement]
relatedTypes: [PibblElement, PibblElementType, PibblKey, PibblNode]
---

# createElement

```ts
import { createElement, Rectangle } from "@pibbl/core";
```

`createElement(type, props, ...children)` constructs the branded [`PibblElement`](#/api/types/elements-components#pibblelement) explicit equivalent of Pibbl
JSX. Its `type` is a [`PibblElementType`](#/api/types/elements-components#pibblelementtype); `props` can be `null`; variadic [`PibblNode`](#/api/types/elements-components#pibblnode) children override `props.children`, while
zero variadic children preserve it. `key` accepts a [`PibblKey`](#/api/types/elements-components#pibblkey), is normalized, and is not delivered to props.

```ts
const scene = createElement(Rectangle, {
  style: { width: 160, height: 80, fill: "#2563eb" },
});
```

Try [Authoring without JSX](#/learn/guides/author-without-jsx).
