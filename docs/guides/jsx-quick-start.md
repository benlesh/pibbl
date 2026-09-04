# JSX quick start

CRC uses the automatic JSX transform to describe Canvas work. The syntax looks
familiar, but the values are branded CRC elements and the renderer paints into
one Canvas; React and the DOM are not involved.

## Install and configure

```sh
pnpm add @crc/core
```

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core"
  }
}
```

See [configuring JSX](./configuring-jsx.md) for Vite, esbuild, Babel,
JavaScript, per-file setup, and mixed-runtime projects.

## A complete interactive scene

<!-- docs:complete-snippet:start jsx-quick-start -->

```tsx
import {
  Group,
  Rectangle,
  Text,
  crc,
  crcState,
  type CRCController,
  type CRCNode,
} from "@crc/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): CRCNode {
  const [message, setMessage] = crcState(initialMessage);

  return (
    <Group>
      <Rectangle
        style={{
          width: 400,
          height: 240,
          fill: "#1f4bd8",
          cursor: "pointer",
        }}
        onClick={() =>
          setMessage((old) => (old === "Hello" ? "CRC!" : "Hello"))
        }
      />
      <Text
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

```ts
const controller = mountPoster(document.querySelector("canvas")!);

// On route teardown, component removal, or application shutdown:
controller.dispose();
controller.dispose(); // Idempotent.
```

<!-- docs:complete-snippet:end -->

`Rectangle`, `Text`, and `Group` are imported Canvas components. Lowercase JSX
tags are intentionally rejected because CRC does not create HTML. Visual and
layout values belong under `style`; handlers and application data are ordinary
props. Textual content belongs between `Text` tags.

The initial mount and every update are scheduled on
`requestAnimationFrame`. Several state or root updates before the frame
coalesce. When the frame runs, CRC clears the Canvas and synchronously traverses
the complete current tree in source order. `dispose()` cancels pending work and
releases the mount's owned listeners, targets, hooks, images, layers, and
surface observers.

## Per-file configuration

If CRC is not the project-wide JSX runtime, place this before imports in a CRC
file:

```tsx
/** @jsxImportSource @crc/core */
```

One source file has one JSX runtime. The recommended mixed-project convention
is `Poster.crc.tsx` for CRC scenes and ordinary `.tsx` files for the host UI.
See [React coexistence](./react-interop.md).

For the equivalent API with no JSX syntax, use the standalone [non-JSX
guide](./without-jsx.md).

## Next

- [Components, props, and style](./components-props-and-style.md)
- [Children, text, lists, and keys](./children-text-lists-and-keys.md)
- [State, lifecycle, and React differences](./state-lifecycle-and-react-differences.md)

The Studio's executable counterpart is
[`getting-started.example.tsx`](../../packages/scenarios/src/learning/start/getting-started.example.tsx).
