---
id: guide-configure-jsx
title: Configure JSX
summary: Configure CRC's automatic JSX runtime in TypeScript, Vite, esbuild, Babel, and JavaScript.
kind: guide
slug: configure-jsx
order: 10
keywords: [jsx, typescript, vite, babel, compiler]
exampleSlug: getting-started
---

# Configure JSX

CRC publishes automatic-runtime entries at `@crc/core/jsx-runtime` and
`@crc/core/jsx-dev-runtime`. Compilers generate those imports; application code
normally imports Canvas/runtime values from `@crc/core`.

## Start with a Canvas scene

Install `@crc/core`, configure the automatic runtime, then describe a scene in
an ordinary `.tsx` component and mount it with `crc(canvas, root)`. CRC JSX
creates branded Canvas elements; React and the DOM are not involved. The
interactive workbench below this guide contains a complete first scene with
stateful click feedback and disposal.

CRC does not install a global `JSX` namespace and has no React dependency. Its
module-scoped JSX types accept synchronous CRC component functions, require
uppercase imported values, validate component props and children, and reject
lowercase intrinsic tags.

## TypeScript

For a CRC-only package, configure the runtime once:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core",
    "moduleResolution": "Bundler",
    "strict": true
  }
}
```

`react-jsxdev` is also supported for an explicit development build. It uses
`@crc/core/jsx-dev-runtime`, whose `jsxDEV` records filename, line, and column
for runtime diagnostics.

To opt in one file instead, put the pragma before imports:

```tsx
/** @jsxImportSource @crc/core */
import { Rectangle } from "@crc/core";

export const swatch = <Rectangle style={{ width: 20, height: 20 }} />;
```

The pragma chooses the runtime; it does not import React or a `Fragment` name.
The fragment shorthand `<>...</>` is compiled against CRC automatically.

## Vite and esbuild

Vite honors the TypeScript configuration above for `.tsx` and `.jsx` input.
If configuring esbuild directly, use the automatic transform and CRC import
source:

```ts
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  jsxImportSource: "@crc/core",
  outfile: "dist/main.js",
});
```

Equivalent CLI flags are `--jsx=automatic --jsx-import-source=@crc/core`.
Do not configure the classic transform; CRC documents the automatic runtime.

## Babel automatic runtime

Use Babel's JSX transform with `runtime: "automatic"` and
`importSource: "@crc/core"`:

```json
{
  "plugins": [
    [
      "@babel/plugin-transform-react-jsx",
      { "runtime": "automatic", "importSource": "@crc/core" }
    ]
  ]
}
```

For development-source metadata, select the corresponding Babel development
transform in development builds with the same `runtime` and `importSource`.
Despite the plugin's historical name, the emitted constructor imports come
from CRC, and `react` is not required.

## JavaScript

JavaScript authors use `.jsx`, the same automatic-runtime configuration, and
normal ESM imports:

```jsx docs:complete-snippet=javascript-runtime
/** @jsxImportSource @crc/core */
import { Rectangle, Text, crc } from "@crc/core";

function Scene() {
  return (
    <>
      <Rectangle style={{ width: 240, height: 120, fill: "navy" }} />
      <Text style={{ x: 16, y: 16, fill: "white" }}>JavaScript</Text>
    </>
  );
}

const controller = crc(document.querySelector("canvas"), <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
```

JavaScript receives the same runtime validation as TypeScript but not static
prop checking. Keep styles explicit and use the diagnostics in [JSX
troubleshooting](#/learn/guides/jsx-troubleshooting).

## A complete interactive scene

```tsx docs:complete-snippet=jsx-quick-start
import {
  Group,
  Rectangle,
  Text,
  crc,
  useSignal,
  type CRCController,
  type CRCNode,
} from "@crc/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): CRCNode {
  const message = useSignal(initialMessage);

  return (
    <Group>
      <Rectangle
        style={{ width: 400, height: 240, fill: "#1f4bd8", cursor: "pointer" }}
        onClick={() =>
          message.update((old) => (old === "Hello" ? "CRC!" : "Hello"))
        }
      />
      <Text
        pointerEvents="none"
        style={{
          x: 200,
          y: 100,
          fill: "#fff",
          font: "800 48px sans-serif",
          textAlign: "center",
        }}
      >
        {message}
      </Text>
    </Group>
  );
}

export function mountPoster(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Poster initialMessage="Hello" />);
}
```

```ts docs:complete-snippet=jsx-quick-start
const controller = mountPoster(document.querySelector("canvas")!);
controller.dispose();
controller.dispose(); // Idempotent.
```

## One runtime per file

A compiler chooses one JSX runtime for the whole file. It cannot switch based
on an individual expression. In a React/Preact/CRC codebase:

- keep CRC JSX in `.crc.tsx` files using the CRC pragma or a CRC-specific
  included `tsconfig`;
- keep host JSX in its own files using the host runtime;
- pass CRC component functions across the boundary, not already-created
  foreign elements;
- when both trees truly belong in one file, keep JSX for the dominant runtime
  and build the minority CRC tree with
  `createElement as createCRCElement`.

The strict Bundler and NodeNext fixture
[`playground/package-consumer/jsx.tsx`](../../../../playground/package-consumer/jsx.tsx)
exercises both compiler subpaths without React installed. See [React
coexistence](#/learn/guides/react-integration) for the full host pattern.

`defineThreeLayer()` from `@crc/three` returns a normal CRC component, so it can
share a CRC JSX file without changing the runtime:

```tsx
import { Rectangle } from "@crc/core";
import { defineThreeLayer } from "@crc/three";

const ProductScene = defineThreeLayer({
  create() {
    // Return an ordinary Three scene and camera.
    return createProductScene();
  },
});

const scene = (
  <>
    <Rectangle pointerEvents="none" style={{ width: 320, height: 180 }} />
    <ProductScene style={{ width: 320, height: 180 }} />
  </>
);
```

Continue with [Use Three.js inside CRC](#/learn/guides/three-js).
