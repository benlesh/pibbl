---
id: api-component-image
title: Image
summary: Draws an asynchronously decoded browser image.
kind: api
slug: image
apiCategory: component
symbols: [Image]
---

# Image

```ts
import { Image } from "@crc/core";
```

`Image` uses `ImageProps` and `ImgStyle` to paint a browser image source with
local geometry, border, and interaction. It rejects children. Browser decoded-
image behavior and CORS policy remain authoritative; CRC does not define an
image CORS policy.

```tsx
<Image style={{ src: "/logo.png", x: 20, y: 20, width: 120, height: 80 }} />
```

Try the [Image live example](#/examples/drawing/image).
