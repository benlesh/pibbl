# JSX component authoring design

Status: approved on 2026-09-01 and implemented on 2026-09-03. This file
preserves the approved design wording; current usage lives in `docs/guides/`,
`docs/api-reference.md`, and `docs/design/`.

Date: 2026-09-01

## Purpose

CRC will replace its factory-first component authoring model with one native
element protocol that supports modern automatic JSX and an equivalent
non-JSX API. The goal is to make component definitions and composed scenes as
readable as possible without importing React's renderer, lifecycle, DOM model,
or accessibility implications.

This is an intentionally breaking pivot. CRC is unreleased and unused enough
that preserving obsolete authoring syntax would make the resulting API worse.
Shipped features remain in scope; compatibility aliases do not.

The design preserves CRC's scheduled immediate-mode Canvas renderer, hook and
component identity, local style language, declared-box layout, events, focus,
layers, measurement, and exact resource ownership. JSX changes how a CRC tree
is described, not how CRC renders it.

## Goals

- Make ordinary components plain TypeScript or JavaScript functions.
- Make JSX the preferred authoring form without requiring React.
- Use descriptive imported component names rather than lowercase intrinsic
  tags or DOM-adjacent abbreviations.
- Keep visual and layout values under an explicit `style` object.
- Make children, text content, fragments, lists, conditionals, and keys feel
  familiar to React users while defining CRC's synchronous behavior exactly.
- Give JSX and non-JSX authors one element protocol and the same runtime
  semantics.
- Make a React, Preact, or other foreign JSX runtime mistake fail early with a
  useful diagnostic.
- Allow React and CRC to coexist cleanly in one codebase.
- Keep platform-level style resolution, measurement, and layout extension
  available without making ordinary components use a definition wrapper.
- Document JSX, non-JSX, lifecycle differences, mixed projects, advanced
  extension, and troubleshooting comprehensively.

## Non-goals

- React compatibility, React reconciliation, React class components, or React
  hooks.
- Lowercase JSX intrinsic elements.
- DOM generation, semantic DOM mirroring, or an accessibility tree.
- Async components, Promise children, Suspense, or server components.
- A Babel or TypeScript compiler plugin.
- A retained Canvas scene graph.
- Style cascade, inheritance, selectors, or class names.
- Backward-compatible lowercase factories or a `defineComp` alias.
- Supporting the classic JSX transform as a documented integration.

## Recommended authoring model

### JSX

JSX is the preferred syntax. Built-ins use descriptive imported values, and
user components are ordinary functions:

```tsx
import { crc, crcState, Group, Rectangle, Text, type CRCNode } from "@crc/core";

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
        onClick={() => setMessage("CRC!")}
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

const controller = crc(canvas, <Poster initialMessage="Hello" />);
```

No wrapper, base class, registration call, or JSX-specific component type is
required. The component function is its runtime identity. Components declare a
`children` prop when they accept children.

CRC retains the `crcState`, `crcMemo`, `crcRef`, and other `crc*` lifecycle
names. They distinguish CRC's lifecycle from React's and reduce accidental
cross-runtime imports.

### Canonical built-ins

The public built-in vocabulary becomes:

- `Rectangle`, `Path`, `SvgPath`, `Line`, `HorizontalLine`, `VerticalLine`
- `Text`, `Image`
- `Group`, `Clip`, `Layer`
- `Absolute`, `Overlay`, `Flow`, `Flex`, `Grid`
- `FocusManagement`, `KeyboardNavigation`
- `Fragment`, normally authored with `<>...</>`

The current `rect`, `img`, `g`, and other lowercase or abbreviated factories
are removed rather than retained as aliases. `defineComp`,
`withFocusManagement`, and `withKeyboardNavigation` are also removed.

### Non-JSX authoring

`createElement` is the complete non-JSX alternative:

```ts
function Poster({ initialMessage }: PosterProps): CRCNode {
  const [message, setMessage] = crcState(initialMessage);

  return createElement(Group, null, [
    createElement(Rectangle, {
      style: {
        width: 400,
        height: 240,
        fill: "#1f4bd8",
      },
    }),
    createElement(
      Text,
      {
        style: {
          x: 200,
          y: 100,
          textAlign: "center",
        },
      },
      message,
    ),
  ]);
}
```

Its public shape follows current React `createElement` conventions:

```ts
createElement(type, props, ...children);
```

`props` may be `null`. Zero children preserve a `children` value explicitly
provided in props. One variadic child becomes the `children` value; multiple
variadic children become an array and override `props.children`. Dynamic lists
should be passed as one array in the third argument. JSX and `createElement`
delegate to the same internal element constructor and produce
indistinguishable CRC elements.

Direct component calls do not create elements. Authors use JSX or
`createElement(Component, props)`. A platform component such as `Rectangle`
called directly reports that it was invoked outside CRC and suggests both
supported construction forms.

## Element protocol

### Opaque branded elements

`CRCElement` replaces `CompEl`. It is an immutable, opaque description with:

- a CRC runtime brand;
- a component type;
- shallow-immutable props, including `style` and `children`;
- an optional key normalized to a string;
- development-only source metadata supplied by `jsxDEV`.

The runtime brand uses a stable global symbol such as
`Symbol.for("@crc/core.element")`. Public types also carry a nominal brand so a
foreign library's structurally similar element does not satisfy
`CRCElement`.

`createElement` copies author props, removes `key`, installs compiler or
variadic children according to the rules above, and shallow-freezes the
synthetic props and element in development. It does not freeze nested author
objects. Elements remain cheap ephemeral descriptions rather than retained
render nodes.

The shared internal constructor also accepts the separate key argument used by
`jsx`, `jsxs`, and `jsxDEV`; a compiler key takes precedence over any defensive
key found in the incoming props object.

`key` accepts strings and numbers and is not delivered in component props. CRC
does not add React-style element `ref`; `crcRef` keeps its current hook
semantics.

`crc(canvas, root, config?)` accepts a complete `CRCNode`, so a fragment,
collection, or empty root is valid in addition to one `CRCElement`.

### Function components

The conceptual public type is:

```ts
type CRCComponent<P> = (props: P) => CRCNode;
```

Plain components receive their author props unchanged apart from special key
removal and compiler-supplied children. A declared `style` remains specified
style. A layout parent may inspect that style to allocate the component, but
does not replace the value seen in plain component props. The component reads
its finite local allocation through `crcLayoutBox()`.

Composition components should not blindly forward their layout-participation
style to an inner drawing element; that would apply placement twice. They use
the local layout box for internal geometry and forward only deliberately owned
visual fields.

### Node and child algebra

Container traversal accepts a recursive synchronous node structure:

```ts
type CRCEmptyNode = false | true | null | undefined | "" | 0;

type CRCNode =
  CRCElement | CRCEmptyNode | readonly CRCNode[] | Iterable<CRCNode>;
```

This supports normal interpolation:

```tsx
<Grid>
  {getGridElements(...args)}
  {items.map((item) => (
    <Card key={item.id} item={item} />
  ))}
  {showFooter && <Footer />}
</Grid>
```

Arrays and finite synchronous iterables flatten recursively. Boolean values,
`null`, `undefined`, the empty string, and zero are ignored in container
position. Non-empty strings and nonzero numbers outside `Text` are rejected
rather than painted at an implicit location. Promises, async iterables,
functions, symbols, and unsupported objects produce contextual errors.

Synchronous iterables are materialized once when a receiving built-in or the
renderer prepares that component render. Layout inspection, measurement, and
paint use that materialization so generators are not executed twice in one
render. Iterables must be finite; arrays remain the recommended reusable list
form.

`Text` has a separate recursive content type that accepts strings, numbers,
empty values, arrays, and finite synchronous iterables of those values. It
concatenates content exactly as JSX supplies it. Numeric zero renders as
`"0"` inside `Text`; booleans, `null`, and `undefined` contribute no content.
A CRC element inside `Text` is a type error and a runtime error.
`TextStyle.text` is removed.

Leaf drawing components reject children. Containers declare the node child
type explicitly. TypeScript uses the component's first parameter and CRC's
`JSX.ElementChildrenAttribute` to check these contracts.

### Fragments and identity

Unkeyed fragments are transparent. Their contents join the surrounding
flattened sibling sequence and do not create a parent identity boundary.
Nested arrays likewise do not create identity boundaries.

An explicit keyed fragment creates one identity boundary:

```tsx
<Fragment key={section.id}>{section.elements}</Fragment>
```

After transparent flattening:

- source order is paint order;
- reverse source order is coordinate-target selection order;
- unkeyed same-type siblings use occurrence order;
- keys are unique in the resulting sibling scope;
- a keyed fragment or ordinary component creates a parent scope for its
  descendants.

These rules preserve current identity behavior while making nested list and
fragment syntax predictable.

## Style, layout, and direct drawing

### Explicit local style

All author-facing visual and layout values remain under `style`:

```tsx
<Rectangle
  style={{
    width: "100%",
    height: 80,
    fill: "#1f4bd8",
  }}
  onClick={handleClick}
/>
```

Behavioral props, `children`, `style`, and `key` remain distinct. Style schemas
stay local, typed, closed, and non-inheriting. The current specified,
normalized, and resolved stages remain authoritative for platform primitives.

Plain components that accept style declare it in their props:

```tsx
interface CardProps {
  title: string;
  style?: BoxStyle & LayoutItemStyle;
}

function Card({ title, style: _specifiedStyle }: CardProps) {
  const box = crcLayoutBox();

  return (
    <Group>
      <Rectangle
        style={{
          width: box.width,
          height: box.height,
          fill: "#fff",
        }}
      />
      <Text style={{ x: 20, y: 20 }}>{title}</Text>
    </Group>
  );
}
```

The parent consumes `Card`'s layout style; `Card` uses its allocation for local
geometry.

### Direct drawing from a plain function

`crcCanvasContext()` is a render-only accessor for the current isolated Canvas
2D context. It does not allocate a hook slot and does not schedule work. It
throws a targeted error outside live CRC rendering and remains unavailable
during pure measurement.

```tsx
interface SparklineProps {
  points: readonly number[];
  style: { stroke: StrokeStyle };
}

function Sparkline({ points, style }: SparklineProps) {
  const context = crcCanvasContext();
  const box = crcLayoutBox();
  // Paint immediately using points, style, and the finite local box.
}
```

Canvas save/restore around the component subtree, source paint order, and
fail-closed error handling apply exactly as they do to current component render
callbacks.

### Platform primitives and capabilities

`definePrimitive` replaces the capability-bearing use of `defineComp`. It is a
higher-order definition function reserved for platform-level extension:

```ts
const Paragraph = definePrimitive<
  ParagraphProps,
  ParagraphStyle,
  NormalizedParagraphStyle,
  ResolvedParagraphStyle
>(
  function renderParagraph(props, style, context) {
    // Direct Canvas work and/or returned CRC children.
  },
  {
    normalizeStyle,
    resolveStyle,
    measure,
  },
);
```

It returns the `Paragraph` component value used in JSX or `createElement`; it
does not create an element. Its program-prop type excludes reserved `key` and
`style`. Its JSX input combines those program props with the required or
optional specified style field. Its internal render callback receives program
props, resolved style, and the current isolated Canvas context.

`definePrimitive` supports custom normalization, allocation-dependent style
resolution, pure measurement, and custom layout algorithms. Resolver
requirements, closed style typing, and measurement isolation follow the
current implemented contracts.

Ordinary application code should contain no `definePrimitive` calls. Simple
custom painters use `crcCanvasContext`; ordinary composites use plain
functions. CRC's built-in drawing and layout components use
`definePrimitive` because they form the platform layer.

## JSX runtime and TypeScript contract

### Package entry points

`@crc/core` adds explicit export-map entries for:

```text
@crc/core/jsx-runtime
@crc/core/jsx-dev-runtime
```

The production entry exports `jsx`, `jsxs`, `Fragment`, and the local `JSX`
namespace. The development entry exports `jsxDEV`, `Fragment`, and the same
namespace. These are compiler-facing APIs; normal authors do not call them.
`Fragment` is also exported from the root for explicit keyed fragments.

The supported TypeScript setup is:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@crc/core"
  }
}
```

Per-file setup is:

```tsx
/** @jsxImportSource @crc/core */
```

The root package does not install a global `JSX` namespace. Both runtime entry
points export a module-scoped namespace with:

- `JSX.Element` as branded `CRCElement`;
- `JSX.ElementType` restricted to synchronous CRC function components and CRC
  platform component values;
- `JSX.ElementChildrenAttribute` naming `children`;
- `JSX.IntrinsicAttributes` declaring optional string or numeric `key`;
- an empty `JSX.IntrinsicElements`, so lowercase tags are invalid;
- the library-managed attribute mapping required for `definePrimitive`
  specified-style input.

TypeScript, Bundler, and NodeNext declarations must agree. The root build emits
and packages both runtime implementations and declarations. CRC does not depend
on React.

### Mixed React and CRC projects

One `.tsx` file has one JSX runtime. React and CRC mix at file boundaries:

```text
src/
  App.tsx
  PosterCanvas.tsx
  scenes/
    Poster.crc.tsx
    Chart.crc.tsx
```

`.crc.tsx` is the recommended convention, not a new language extension. A
CRC-only package sets `jsxImportSource` once. A mixed package uses per-file CRC
pragmas or separate included tsconfigs.

A React host owns the native Canvas and mounts a CRC element explicitly:

```tsx
import { useEffect, useRef } from "react";
import { crc, createElement as createCRCElement } from "@crc/core";
import { Poster } from "./scenes/Poster.crc";

export function PosterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = crc(canvas, createCRCElement(Poster, null));
    return () => controller.dispose();
  }, []);

  return <canvas ref={canvasRef} width={400} height={240} />;
}
```

If both tree syntaxes are needed in one file, JSX belongs to the dominant
runtime and the other tree uses its explicit element constructor. CRC will not
add a custom transform for expression-level runtime switching.

### Wrong-runtime diagnostics

Misconfiguration fails in layers:

1. CRC platform components do not satisfy React's function-component return
   type, and React components do not satisfy CRC's element type.
2. A foreign JSX element is not assignable to `CRCNode` at `crc()`.
3. `crc()` recognizes known React element brands and reports that the file used
   the React JSX runtime, including the required `jsxImportSource` fix.
4. A platform component invoked outside CRC reports direct invocation or a
   likely foreign JSX runtime.
5. Child traversal rejects other unbranded element-like objects with the
   receiving component and source location.

`jsxDEV` records filename, line, and column. Child, component, and style
diagnostics use it when available. Production elements omit source metadata.

Representative diagnostics include:

```text
CRC received a React element. This file is using the React JSX runtime.
Set jsxImportSource to "@crc/core" or add /** @jsxImportSource @crc/core */.
```

```text
Rectangle is a CRC component and was invoked outside the CRC renderer.
Use <Rectangle ... /> in a CRC JSX file or createElement(Rectangle, props).
```

## Runtime execution

Element creation is side-effect free. On a scheduled frame CRC:

1. validates and prepares the current root node structure;
2. resolves identity from parent, component function, key, and occurrence;
3. saves Canvas and temporary runtime state;
4. establishes hooks, local allocation, event ownership, clips, enhancers, and
   render context;
5. invokes a plain function or a `definePrimitive` renderer;
6. traverses the returned synchronous child structure in source order;
7. finalizes hook slots and policy state, then restores Canvas state;
8. removes unseen component identities and their exact resources after a
   successful traversal.

Normal updates remain coalesced on `requestAnimationFrame`. A render remains a
full synchronous traversal. JSX does not add DOM reconciliation, background
rendering, retained drawing commands, or async continuation.

Component and hook identity, Canvas isolation, style resolution, declared-box
layout, pure measurement, transform and clip capture, interaction paint order,
pointer capture, focus state, layer invalidation, and teardown ownership retain
their current implemented contracts unless this design explicitly changes the
authoring shape.

A component throw still fails closed, releases runtime-owned state, clears
component refs, and requires a later explicit render. Pixels painted before the
throw are not rolled back.

## JSX-friendly composition changes

### Text

`Text` consumes textual children:

```tsx
<Text style={{ x: 40, y: 80 }}>
  Hello {name} — {unreadCount} unread
</Text>
```

Text measurement, wrapping, fit, clipping, paint, and interaction use the
concatenated value. The same child materialization is used for measurement and
rendering.

### Layer

`LayerProps.render` is replaced by children:

```tsx
<Layer style={{ width: 300, height: 200 }}>
  <Background />
  <Chart />
</Layer>
```

`Layer` accepts a general CRC container-child structure. It installs a stable
internal fragment root for its offscreen CRC instance. The layer retains the
current global interaction order, focus invalidation, caching comparison, and
teardown semantics.

### Focus and keyboard navigation

Function enhancers become descriptive JSX policy values:

```tsx
<FocusManagement>
  <KeyboardNavigation mode="directional">
    <Scene />
  </KeyboardNavigation>
</FocusManagement>
```

Both require exactly one CRC element child. They are transparent policy
boundaries, not ordinary component boundaries: they do not paint, lay out, own
hooks, or alter the enhanced child's component identity. Their internal
descriptors attach to that child and retain current lifecycle and ownership
semantics. `KeyboardNavigation` still requires an active focus manager.

Their non-JSX representation uses `createElement` with the same component
values. `withFocusManagement` and `withKeyboardNavigation` are removed.

### Other containers

`Group`, `Clip`, `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid` consume
normal children. `Clip` retains its path and fill rule in explicit style.
Drawing leaves reject children. `Image` remains a Canvas image primitive even
though its imported name shadows the browser's global `Image` constructor in
that module.

## Public API transition

The principal migration is:

| Current                                  | Replacement                                                     |
| ---------------------------------------- | --------------------------------------------------------------- |
| `defineComp(function Card() {})`         | `function Card() {}`                                            |
| `rect({ style })`                        | `<Rectangle style={style} />`                                   |
| `text({ style: { text, ...style } })`    | `<Text style={style}>{text}</Text>`                             |
| `g({ children })`                        | `<Group>{children}</Group>`                                     |
| `layer({ render })`                      | `<Layer>{children}</Layer>`                                     |
| `withFocusManagement(scene)`             | `<FocusManagement>{scene}</FocusManagement>`                    |
| `withKeyboardNavigation(scene, options)` | `<KeyboardNavigation {...options}>{scene}</KeyboardNavigation>` |
| `CompEl`                                 | `CRCElement`                                                    |
| `CompFn`                                 | `CRCComponent` or a primitive render type                       |
| Callable component factories             | JSX or `createElement`                                          |

New or renamed public types include `CRCElement`, `CRCComponent`, `CRCNode`,
container and text child types, `CRCKey`, and primitive capability types.
Obsolete factory and element types are removed from declarations and runtime
exports.

## Documentation plan

The refactor is incomplete until the preferred and alternative authoring
models are documented end to end. Documentation will include:

1. A JSX quick start with one complete interactive scene.
2. TypeScript configuration and package exports.
3. Vite/esbuild, Babel automatic-runtime, and JavaScript setup.
4. Components, props, explicit style, events, and content.
5. Children, fragments, conditionals, lists, iterables, and keys.
6. Text content, whitespace, wrapping, fit, and interpolation.
7. Layout composition and the distinction between specified style and local
   allocation.
8. Groups, transforms, clips, and layers.
9. CRC state and lifecycle, with a precise React comparison.
10. Ordinary custom components and `crcCanvasContext` drawing.
11. Advanced `definePrimitive` style resolution and pure measurement.
12. A complete non-JSX guide using `createElement`.
13. React and CRC in one codebase, including the same-file limitation.
14. Wrong-runtime and JSX troubleshooting by diagnostic.
15. Focus, keyboard navigation, and accessibility limitations.
16. A complete API reference and one-time migration guide.

All learning examples move to `.tsx` and preferred JSX. One dedicated learning
path implements a representative scene without JSX. The scenario catalog and
generated index reflect renamed APIs.

The Studio editor and sandbox compile TSX with CRC's automatic runtime, expose
the shipped JSX declarations, and work in source and built-package modes. The
editor shows the exact configuration used by examples.

Existing design contracts are updated together so runtime identity, drawing,
style, layout, user events, focus, accessibility guidance, and resource
ownership describe the JSX-era model consistently. Earlier completed plans
remain historical evidence.

## Verification strategy

Observable contracts are written as failing tests before production changes.
Focused checks run during implementation; the fresh aggregate trust gate runs
before completion.

### Type and package evidence

- Plain synchronous function components are valid JSX values.
- Required and optional props and style fields are checked.
- Component-specific children are checked, including `Text` and drawing
  leaves.
- Lowercase tags, async components, Promise children, invalid program-prop
  collisions, and foreign elements fail compilation.
- CRC and React JSX fixtures coexist in one project and fail when their
  elements cross mount boundaries.
- `jsx-runtime` and `jsx-dev-runtime` resolve from source, built, and packed
  packages under strict Bundler and NodeNext resolution.
- The root export map keeps compiler-only functions out of normal runtime
  imports while exporting `createElement` and explicit `Fragment`.
- Studio declarations match built declarations.

### Element and traversal evidence

- JSX, `jsxDEV`, and `createElement` produce equivalent branded descriptors.
- Props, keys, children, immutability, and development metadata follow the
  specified rules.
- Root collections, nested arrays, finite iterables, empty values, and
  fragments traverse deterministically.
- Keyed fragments, keyed children, and unkeyed occurrences preserve or remount
  identity exactly as specified.
- Duplicate keys and invalid child categories produce contextual diagnostics.
- Iterables are not executed twice during one layout-and-paint pass.
- Text interpolation and nested text content produce one exact value for
  measurement and drawing.

### Runtime and feature evidence

- Plain function hooks mount, update, reorder, remove, fail, and recover under
  the current hook contract.
- `crcCanvasContext` is isolated, render-only, and unavailable during pure
  measurement.
- `definePrimitive` preserves custom normalization, resolution, measurement,
  and allocation diagnostics.
- JSX versions of every drawing and layout component preserve semantic state
  and geometry.
- `Layer` handles multiple children while retaining cache, interaction, focus,
  and disposal behavior.
- `FocusManagement` and `KeyboardNavigation` are transparent to identity and
  retain exact policy ownership.
- Foreign React-like elements and direct platform-component calls produce the
  documented errors.
- Browser, lifecycle, event, focus, cleanup, structural performance, package
  consumer, built smoke, and Studio scenarios continue to pass.

### Visual evidence

Existing semantic and geometry assertions remain primary. Converted public
scenarios are driven headlessly and usable manually. Existing visual baselines
should remain unchanged unless an inspected, intentional rendering change is
documented. A baseline is never rewritten merely to make verification pass.

## Implementation scope and sequencing constraints

The implementation will affect the public element types, renderer dispatch,
style lookup, layout child normalization, built-in exports, package entry
points, TypeScript configuration, scenarios, tests, Studio compilation,
editor declarations, package consumers, and documentation. This is one
architectural program but should be planned as incremental vertical slices
that keep executable evidence at each boundary.

The implementation plan must preserve these sequencing constraints:

1. Establish element and child contracts with type/runtime tests before
   converting built-ins.
2. Add automatic runtime entry points and packed-consumer evidence before
   converting examples.
3. Teach the renderer plain functions and primitive metadata before removing
   `defineComp`.
4. Convert one representative drawing, layout, layer, and focus scenario before
   bulk migration.
5. Update Studio TSX compilation and package modes before migrating the full
   learning catalog.
6. Remove obsolete exports only after every supported feature has new public
   evidence.
7. Update normative design contracts and documentation before the aggregate
   gate.

## Acceptance criteria

The refactor is complete only when:

- the preferred JSX example compiles and runs without React installed;
- the documented non-JSX equivalent behaves identically;
- ordinary user components are plain functions;
- descriptive uppercase built-ins are the only component vocabulary;
- `Text` content, arbitrary synchronous list interpolation, fragments, and
  keys follow this design;
- wrong React targeting fails with actionable diagnostics;
- React and CRC coexist through documented file boundaries;
- all shipped drawing, layout, event, focus, layer, surface, lifecycle,
  measurement, and ownership features have public JSX evidence;
- source, built, packed, Bundler, NodeNext, browser, Studio, lifecycle,
  performance, and visual gates pass freshly;
- JSX, non-JSX, lifecycle differences, mixed projects, advanced extension, and
  troubleshooting documentation are complete;
- obsolete factories, wrappers, and public types are absent rather than
  deprecated aliases.
