---
id: guide-configure-jsx
title: Configure JSX
summary: Configure Pibbl's automatic JSX runtime in TypeScript, Vite, esbuild, Babel, and JavaScript.
kind: guide
slug: configure-jsx
order: 10
keywords: [jsx, typescript, vite, babel, compiler]
exampleSlug: getting-started
---

# Configure JSX

Pibbl publishes automatic-runtime entries at `@pibbl/core/jsx-runtime` and
`@pibbl/core/jsx-dev-runtime`. Compilers generate those imports; application code
normally imports Canvas/runtime values from `@pibbl/core`.

## Start with a Canvas scene

Install `@pibbl/core`, configure the automatic runtime, then describe a scene in
an ordinary `.tsx` component and mount it with `pibbl(canvas, root)`. Pibbl JSX
creates branded Canvas elements; React and the DOM are not involved. The
interactive workbench linked after this guide contains a complete first scene with
stateful click feedback and disposal.

Pibbl does not install a global `JSX` namespace and has no React dependency. Its
module-scoped JSX types accept synchronous Pibbl component functions, require
uppercase imported values, validate component props and children, and reject
lowercase intrinsic tags.

## TypeScript

For a Pibbl-only package, configure the runtime once:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@pibbl/core",
    "moduleResolution": "Bundler",
    "strict": true
  }
}
```

`react-jsxdev` is also supported for an explicit development build. It uses
`@pibbl/core/jsx-dev-runtime`, whose `jsxDEV` records filename, line, and column
for runtime diagnostics.

To opt in one file instead, put the pragma before imports:

```tsx
/** @jsxImportSource @pibbl/core */
import { Rectangle } from "@pibbl/core";

export const swatch = <Rectangle style={{ width: 20, height: 20 }} />;
```

The pragma chooses the runtime; it does not import React or a `Fragment` name.
The fragment shorthand `<>...</>` is compiled against Pibbl automatically.

## Vite and esbuild

Vite honors the TypeScript configuration above for `.tsx` and `.jsx` input.
If configuring esbuild directly, use the automatic transform and Pibbl import
source:

```ts
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  jsxImportSource: "@pibbl/core",
  outfile: "dist/main.js",
});
```

Equivalent CLI flags are `--jsx=automatic --jsx-import-source=@pibbl/core`.
Do not configure the classic transform; Pibbl documents the automatic runtime.

## Babel automatic runtime

Use Babel's JSX transform with `runtime: "automatic"` and
`importSource: "@pibbl/core"`:

```json
{
  "plugins": [
    [
      "@babel/plugin-transform-react-jsx",
      { "runtime": "automatic", "importSource": "@pibbl/core" }
    ]
  ]
}
```

For development-source metadata, select the corresponding Babel development
transform in development builds with the same `runtime` and `importSource`.
Despite the plugin's historical name, the emitted constructor imports come
from Pibbl, and `react` is not required.

## JavaScript

JavaScript authors use `.jsx`, the same automatic-runtime configuration, and
normal ESM imports:

```jsx docs:complete-snippet=javascript-runtime
/** @jsxImportSource @pibbl/core */
import { Rectangle, Text, pibbl } from "@pibbl/core";

function Scene() {
  return (
    <>
      <Rectangle style={{ width: 240, height: 120, fill: "navy" }} />
      <Text style={{ left: 16, top: 16, fill: "white" }}>JavaScript</Text>
    </>
  );
}

const controller = pibbl(document.querySelector("canvas"), <Scene />);
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
  pibbl,
  useSignal,
  type PibblController,
  type PibblNode,
} from "@pibbl/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): PibblNode {
  const message = useSignal(initialMessage);

  return (
    <Group>
      <Rectangle
        style={{ width: 400, height: 240, fill: "#1f4bd8", cursor: "pointer" }}
        onClick={() =>
          message.update((old) => (old === "Hello" ? "Pibbl!" : "Hello"))
        }
      />
      <Text
        pointerEvents="none"
        style={{
          left: 200,
          top: 100,
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

export function mountPoster(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Poster initialMessage="Hello" />);
}
```

```ts docs:complete-snippet=jsx-quick-start
const controller = mountPoster(document.querySelector("canvas")!);
controller.dispose();
controller.dispose(); // Idempotent.
```

## One runtime per file

A compiler chooses one JSX runtime for the whole file. It cannot switch based
on an individual expression. In a React/Preact/Pibbl codebase:

- keep Pibbl JSX in `.pibbl.tsx` files using the Pibbl pragma or a Pibbl-specific
  included `tsconfig`;
- keep host JSX in its own files using the host runtime;
- pass Pibbl component functions across the boundary, not already-created
  foreign elements;
- when both trees truly belong in one file, keep JSX for the dominant runtime
  and build the minority Pibbl tree with
  `createElement as createPibblElement`.

The strict Bundler and NodeNext fixture
[`playground/package-consumer/jsx.tsx`](../../../../playground/package-consumer/jsx.tsx)
exercises both compiler subpaths without React installed. See [React
coexistence](#/learn/guides/react-integration) for the full host pattern.

`defineThreeLayer()` from `@pibbl/three` returns a normal Pibbl component, so it can
share a Pibbl JSX file without changing the runtime:

```tsx
import { Rectangle } from "@pibbl/core";
import { defineThreeLayer } from "@pibbl/three";

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

Continue with [Use Three.js inside Pibbl](#/learn/guides/three-js).
