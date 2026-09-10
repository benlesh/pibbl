---
id: api-function-create-element
title: createElement
summary: Creates the branded CRC element descriptor without JSX.
kind: api
slug: create-element
apiCategory: function
symbols: [createElement]
---

# createElement

```ts
import { createElement, Rectangle } from "@crc/core";
```

`createElement(type, props, ...children)` is the explicit equivalent of CRC
JSX. `props` can be `null`; variadic children override `props.children`, while
zero variadic children preserve it. `key` accepts a string or number, is
normalized, and is not delivered to props.

```ts
const scene = createElement(Rectangle, {
  style: { width: 160, height: 80, fill: "#2563eb" },
});
```

Try [Authoring without JSX](#/learn/guides/author-without-jsx).
