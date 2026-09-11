---
id: guide-react-integration
title: Integrate with React
summary: Keep React and CRC runtimes separate while mounting a CRC scene safely inside a React host.
kind: guide
slug: react-integration
order: 90
keywords: [react, integration, jsx, lifecycle, canvas]
---

# Integrate with React

React and CRC can share an application, but they do not share elements,
renderers, hooks, or a JSX runtime. The React host owns the native Canvas; CRC
owns only its mount on that Canvas.

One `.tsx` file has one JSX runtime. Keep the scene and host in separate files.
The `.crc.tsx` suffix is a convention that makes the boundary obvious.
Values from `@crc/webgl` belong in the CRC scene file and use the same
`@crc/core` JSX runtime; they do not introduce a third runtime boundary.

## CRC scene file

```tsx
/** @jsxImportSource @crc/core */
import { Rectangle, Text, type CRCNode } from "@crc/core";

export interface PosterProps {
  title: string;
}

export function Poster({ title }: PosterProps): CRCNode {
  return (
    <>
      <Rectangle style={{ width: 400, height: 240, fill: "#2563eb" }} />
      <Text style={{ x: 24, y: 24, fill: "white" }}>{title}</Text>
    </>
  );
}
```

## React host file

```tsx
import { useEffect, useRef } from "react";
import { crc, createElement as createCRCElement } from "@crc/core";
import { Poster } from "./Poster.crc";

export function PosterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = crc(
      canvas,
      createCRCElement(Poster, { title: "CRC inside React" }),
    );
    return () => controller.dispose();
  }, []);

  return <canvas ref={canvasRef} width={400} height={240} />;
}
```

The React file keeps React's JSX runtime. Its minority CRC tree is constructed
explicitly with an aliased `createElement`; the CRC component itself is not
called directly. React cleanup disposes the stable CRC controller before the
host Canvas is discarded. CRC does not render or replace the `<canvas>` DOM
node.

If CRC is the dominant JSX runtime in a file, reverse the pattern and construct
the foreign tree with that renderer's explicit API. There is no supported
expression-level pragma or custom transform that switches runtimes midway
through a file.

Do not:

- pass a React element to `crc()`;
- return a CRC element from a React component;
- return a React element from a CRC component;
- import one runtime's hooks into the other's component;
- configure both runtimes for the same source file.

TypeScript's branded element types reject these crossings. Runtime preflight
also recognizes React's element brands before CRC acquires Canvas resources
and reports the required `jsxImportSource` correction.

The strict mixed-runtime fixtures are
[`react-host.tsx`](../../../../playground/package-consumer/mixed-runtime/react-host.tsx)
and
[`crc-scene.crc.tsx`](../../../../playground/package-consumer/mixed-runtime/crc-scene.crc.tsx).
