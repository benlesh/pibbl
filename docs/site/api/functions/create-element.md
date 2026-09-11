---
id: api-function-create-element
title: createElement
summary: Creates the branded CRC element descriptor without JSX.
kind: api
slug: create-element
apiCategory: function
symbols: [createElement]
relatedTypes: [CRCElement, CRCElementType, CRCKey, CRCNode]
---

# createElement

```ts
import { createElement, Rectangle } from "@crc/core";
```

`createElement(type, props, ...children)` constructs the branded [`CRCElement`](#/api/types/elements-components#crcelement) explicit equivalent of CRC
JSX. Its `type` is a [`CRCElementType`](#/api/types/elements-components#crcelementtype); `props` can be `null`; variadic [`CRCNode`](#/api/types/elements-components#crcnode) children override `props.children`, while
zero variadic children preserve it. `key` accepts a [`CRCKey`](#/api/types/elements-components#crckey), is normalized, and is not delivered to props.

```ts
const scene = createElement(Rectangle, {
  style: { width: 160, height: 80, fill: "#2563eb" },
});
```

Try [Authoring without JSX](#/learn/guides/author-without-jsx).
