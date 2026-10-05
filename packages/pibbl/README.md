# Pibbl

> **ALPHA — NOT FOR PRODUCTION USE.** Pibbl 0.0.1 is experimental. APIs may change or be removed without notice. Use it only for evaluation and experimentation.

`pibbl` mirrors every entry point of `@pibbl/core` and forwards to the same runtime instance.

```sh
npm install pibbl
```

```ts
import { pibbl, createElement, Rectangle } from "pibbl";

const app = pibbl(
  canvas,
  createElement(Rectangle, {
    style: { width: 100, height: 100, fill: "tomato" },
  }),
);
// When finished:
app.dispose();
```

For JSX, set `jsx` to `react-jsx` and `jsxImportSource` to `pibbl`.
Subpaths such as `pibbl/filters`, `pibbl/particles`, and `pibbl/sprites` mirror `@pibbl/core`.
