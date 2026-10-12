---
id: guide-react-integration
title: Integrate with React
summary: Keep React and Pibbl runtimes separate while mounting a Pibbl scene safely inside a React host.
kind: guide
slug: react-integration
order: 90
keywords: [react, integration, jsx, lifecycle, canvas]
---

# Integrate with React

React and Pibbl can share an application, but they do not share elements,
renderers, hooks, or a JSX runtime. The React host owns the native Canvas; Pibbl
owns only its mount on that Canvas.

One `.tsx` file has one JSX runtime. Keep the scene and host in separate files.
The `.pibbl.tsx` suffix is a convention that makes the boundary obvious.
A component returned by `defineThreeLayer()` belongs in the Pibbl scene file and
uses the same `@pibbl/core` JSX runtime; ordinary Three objects are created with
the normal Three API and do not introduce another JSX runtime.

## Pibbl scene file

```tsx
/** @jsxImportSource @pibbl/core */
import { Rectangle, Text, type PibblNode } from "@pibbl/core";

export interface PosterProps {
  title: string;
}

export function Poster({ title }: PosterProps): PibblNode {
  return (
    <>
      <Rectangle style={{ width: 400, height: 240, fill: "#2563eb" }} />
      <Text style={{ left: 24, top: 24, fill: "white" }}>{title}</Text>
    </>
  );
}
```

## React host file

```tsx
import { useEffect, useRef } from "react";
import { pibbl, createElement as createPibblElement } from "@pibbl/core";
import { Poster } from "./Poster.pibbl";

export function PosterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = pibbl(
      canvas,
      createPibblElement(Poster, { title: "Pibbl inside React" }),
    );
    return () => controller.dispose();
  }, []);

  return <canvas ref={canvasRef} width={400} height={240} />;
}
```

The React file keeps React's JSX runtime. Its minority Pibbl tree is constructed
explicitly with an aliased `createElement`; the Pibbl component itself is not
called directly. React cleanup disposes the stable Pibbl controller before the
host Canvas is discarded. Pibbl does not render or replace the `<canvas>` DOM
node.

If Pibbl is the dominant JSX runtime in a file, reverse the pattern and construct
the foreign tree with that renderer's explicit API. There is no supported
expression-level pragma or custom transform that switches runtimes midway
through a file.

Do not:

- pass a React element to `pibbl()`;
- return a Pibbl element from a React component;
- return a React element from a Pibbl component;
- import one runtime's hooks into the other's component;
- configure both runtimes for the same source file.

TypeScript's branded element types reject these crossings. Runtime preflight
also recognizes React's element brands before Pibbl acquires Canvas resources
and reports the required `jsxImportSource` correction.

The strict mixed-runtime fixtures are
[`react-host.tsx`](../../../../playground/package-consumer/mixed-runtime/react-host.tsx)
and
[`pibbl-scene.pibbl.tsx`](../../../../playground/package-consumer/mixed-runtime/pibbl-scene.pibbl.tsx).
