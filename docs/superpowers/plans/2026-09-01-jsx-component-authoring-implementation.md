# Pibbl JSX Component Authoring Implementation Plan

> **Historical status: IMPLEMENTATION RECORD THROUGH TASK 14.** Final aggregate trust closure is tracked by Task 15; usage guidance lives in `docs/guides/`.

Status: implementation record current through Task 14 on 2026-09-03. Task 15
owns final aggregate trust closure. Checkboxes and task instructions below are
preserved as the implementation record; they are not current API guidance.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Pibbl's factory-first authoring API with a branded element protocol shared by automatic JSX and `createElement`, make plain functions valid components, expose descriptive uppercase built-ins, preserve every shipped rendering/lifecycle/layout/event/focus feature, and document both JSX and non-JSX use comprehensively.

**Architecture:** Element creation becomes a side-effect-free compiler/API boundary that produces immutable branded `PibblElement` descriptions. The scheduled immediate-mode renderer validates and flattens recursive synchronous nodes, dispatches ordinary functions directly, and dispatches capability-bearing platform components through private `definePrimitive` metadata. Layout, measurement, layers, and focus policies consume the same element protocol; JSX changes authoring only, not Pibbl's Canvas traversal, identity, ownership, or event model.

**Tech Stack:** TypeScript 5 automatic JSX runtime, ESM package export maps, Canvas 2D, Pibbl's existing style/layout/event/focus runtime, Vitest Browser Mode with Playwright Chromium, Monaco TypeScript worker, Vite, esbuild, Node.js 24.15+, and pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-09-01-jsx-component-authoring-design.md`

## Global Constraints

- Use Node.js 24.15 or newer and pnpm 11.21.0 from the repository's `packageManager` contract.
- Write each observable contract as a failing test or failing type fixture before changing production code.
- Preserve the scheduled full synchronous traversal, Canvas save/restore isolation, hook identity, source paint order, reverse hit order, layout allocation, event ownership, layer sharing, focus behavior, and fail-closed cleanup.
- Do not add React, Preact, Babel, or another JSX runtime as a runtime dependency of `@pibbl/core`.
- JSX uses the automatic transform with `jsxImportSource: "@pibbl/core"`; the classic transform is not a supported integration.
- Keep `style={{ ... }}` explicit. Do not promote style properties to top-level props, add `className`, or add a style cascade.
- Plain application components are ordinary synchronous functions. They must not require `definePrimitive` or another wrapper.
- `definePrimitive` is the only capability-bearing definition mechanism and is reserved for built-ins and advanced platform extensions.
- Keep lowercase factories and `defineComp` only as private migration scaffolding while tasks are in flight. They must be absent from final root exports, declarations, examples, tests, and documentation.
- Do not add compatibility aliases in the final state. Descriptive uppercase component values are the only public component vocabulary.
- Preserve unrelated working-tree changes and all local `_bmad-output/` discovery material.
- Public behavior requires public-package evidence in source, built, packed, Bundler, NodeNext, Studio, browser, and headless scenario modes.
- Visual baselines may change only after inspecting expected, actual, and diff output and recording why an intentional rendering change is correct.

## File Structure

New element/runtime units:

- `packages/core/src/lib/element/types.ts` — public element, component, key, child, and primitive input types.
- `packages/core/src/lib/element/create-element.ts` — public `createElement` and the shared internal descriptor constructor.
- `packages/core/src/lib/element/metadata.ts` — private WeakMap metadata for source, primitive capabilities, placement identity, and transparent policies.
- `packages/core/src/lib/element/children.ts` — recursive synchronous node and text-content materialization with contextual diagnostics.
- `packages/core/src/lib/element/fragment.ts` — the compiler-visible `Fragment` value and keyed-fragment boundary behavior.
- `packages/core/src/lib/define-primitive.ts` — advanced platform component definition and private dispatch metadata.
- `packages/core/src/lib/hooks/use-canvas-context.ts` — render-only access to the isolated Canvas context.
- `packages/core/src/jsx-runtime.ts` — production automatic-runtime entry point.
- `packages/core/src/jsx-dev-runtime.ts` — development automatic-runtime entry point with source metadata.

New type/package evidence:

- `packages/core/type-tests/jsx-components.tsx` — positive and negative Pibbl JSX contracts.
- `packages/core/type-tests/mixed-runtime/` — local React-runtime stub and Pibbl/React boundary fixtures without adding React.
- `packages/core/test/jsx-authoring.test.tsx` — public end-to-end authoring evidence.
- `playground/package-consumer/jsx.tsx` — installed-package automatic-runtime consumer.

New guides:

- `docs/guides/jsx-quick-start.md`
- `docs/guides/configuring-jsx.md`
- `docs/guides/components-props-and-style.md`
- `docs/guides/children-text-lists-and-keys.md`
- `docs/guides/layout-groups-clips-and-layers.md`
- `docs/guides/state-lifecycle-and-react-differences.md`
- `docs/guides/custom-components-and-primitives.md`
- `docs/guides/without-jsx.md`
- `docs/guides/react-interop.md`
- `docs/guides/jsx-troubleshooting.md`
- `docs/guides/focus-keyboard-and-accessibility.md`
- `docs/api-reference.md`
- `docs/migrations/jsx-authoring-pivot.md`

Migration surfaces:

- `packages/core/src/lib/components/` — descriptive drawing/composition values and textual children.
- `packages/core/src/lib/layout/` — descriptive layout values over recursive children.
- `packages/core/src/lib/focus/` — identity-transparent JSX policy values.
- `packages/scenarios/src/**/*.example.tsx` — JSX learning and deterministic scenario sources.
- `playground/src/` and `tooling/` — TSX discovery, Monaco compilation, sandbox runtime imports, generated index, and package verification.

---

### Task 1: Establish the Branded Element Descriptor

**Files:**

- Create: `packages/core/src/lib/element/types.ts`
- Create: `packages/core/src/lib/element/metadata.ts`
- Create: `packages/core/src/lib/element/create-element.ts`
- Create: `packages/core/src/lib/element/create-element.test.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `PibblKey`, `PibblElement`, `PibblComponent`, `PibblElementType`, `PibblEmptyNode`, `PibblContainerChild`, `PibblTextChild`, and `PibblNode` types.
- Produces public `createElement(type, props, ...children)`.
- Produces private `createPibblElement`, `isPibblElement`, `getElementSource`, `getSpecifiedStyle`, and internal metadata accessors.
- Temporarily adapts `CompEl` and current factories to the new descriptor so later tasks can migrate without a repository-wide flag day.

- [ ] **Step 1: Write failing descriptor tests**

Cover the stable `Symbol.for("@pibbl/core.element")` runtime brand, nominal public
type, key normalization, key removal from delivered props, `null` props, zero,
one, and multiple variadic children, `props.children` precedence, defensive
`props.key` handling, shallow props copying, development shallow freezing, and
non-freezing of nested author objects.

```ts
function Card(props: { title: string; children?: PibblNode }): PibblNode {
  return props.children;
}

const element = createElement(Card, { key: 42, title: "Pibbl" }, "child");
expect(element.key).toBe("42");
expect(element.props).toEqual({ title: "Pibbl", children: "child" });
expect("key" in element.props).toBe(false);
expect(Object.isFrozen(element)).toBe(import.meta.env.DEV);
```

- [ ] **Step 2: Run the focused test and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element/create-element.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because Pibbl still exposes mutable `CompEl` objects with separate
`style` and has no public React-shaped `createElement`.

- [ ] **Step 3: Define the public node and element types**

Use this public shape while keeping the nominal brand declaration private to
the module:

```ts
declare const pibblElementTypeBrand: unique symbol;

export type PibblKey = string | number;
export type PibblEmptyNode = false | true | null | undefined | "" | 0;
export type PibblContainerChild = PibblNode;
export type PibblTextChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly PibblTextChild[]
  | Iterable<PibblTextChild>;

export interface PibblElement<P = unknown> {
  readonly [pibblElementTypeBrand]: true;
  readonly type: PibblElementType<P>;
  readonly props: Readonly<P>;
  readonly key?: string;
}

export type PibblNode =
  PibblElement | PibblEmptyNode | readonly PibblNode[] | Iterable<PibblNode>;

export type PibblRenderResult = PibblNode | void;
export type PibblComponent<P = Record<string, never>> = (
  props: P,
) => PibblRenderResult;
export type PibblElementType<P = any> = PibblComponent<P>;
```

`PibblRenderResult` deliberately admits `void` so an ordinary direct-drawing
function with no `return` statement remains a valid component; Promises remain
invalid. The runtime object additionally owns a non-enumerable `$$typeof` whose value is
`Symbol.for("@pibbl/core.element")`. Do not export a mutable constructor or make
the private nominal brand forgeable through the public root.

- [ ] **Step 4: Implement one descriptor constructor**

`createPibblElement(type, incomingProps, compilerKey, source)` performs all prop,
key, child, and development-freeze work. `createElement` calculates variadic
child precedence and delegates to it. Put source, placement, and future policy
annotations in a private `WeakMap<PibblElement, InternalElementMetadata>` so the
public object can remain frozen.

- [ ] **Step 5: Add a temporary legacy adapter**

Change the existing private factory constructor to delegate to
`createPibblElement` and read style from `element.props.style`. Keep its current
signature only until Task 12. Do not add it to new examples or new type
fixtures.

- [ ] **Step 6: Run descriptor and current runtime tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element/create-element.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/style --browser.headless --browser.ui=false
```

Expected: PASS, including the unchanged legacy tests through the temporary
adapter.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/element packages/core/src/lib/types.ts packages/core/src/lib/create-element.ts packages/core/src/index.ts
git commit -m "feat(core): add branded Pibbl elements"
```

---

### Task 2: Publish the Automatic JSX Runtime and Type Contract

**Files:**

- Create: `packages/core/src/jsx-runtime.ts`
- Create: `packages/core/src/jsx-dev-runtime.ts`
- Create: `packages/core/src/lib/element/jsx-runtime.ts`
- Create: `packages/core/src/lib/element/jsx-runtime.test.ts`
- Create: `packages/core/type-tests/jsx-components.tsx`
- Create: `packages/core/type-tests/mixed-runtime/react-stub/jsx-runtime.d.ts`
- Create: `packages/core/type-tests/mixed-runtime/react-scene.tsx`
- Create: `packages/core/type-tests/mixed-runtime/pibbl-scene.pibbl.tsx`
- Create: `packages/core/type-tests/mixed-runtime/boundaries.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/tsconfig.build.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `eslint.config.mjs`
- Modify: `playground/package-consumer/tsconfig.bundler.json`
- Modify: `playground/package-consumer/tsconfig.nodenext.json`

**Interfaces:**

- Produces `@pibbl/core/jsx-runtime` with `jsx`, `jsxs`, `Fragment`, and module-scoped `JSX`.
- Produces `@pibbl/core/jsx-dev-runtime` with `jsxDEV`, `Fragment`, and the same `JSX` contract.
- Adds no global `JSX` declaration and no React dependency.
- Makes plain synchronous functions returning `PibblNode` valid JSX component types while rejecting lowercase tags, async components, invalid children, foreign elements, and reserved-key collisions.

- [ ] **Step 1: Add failing runtime equivalence tests**

Assert that `jsx`, `jsxs`, `jsxDEV`, and `createElement` delegate to the same
descriptor constructor. Verify compiler keys beat defensive `props.key`,
`jsxDEV` stores filename/line/column in private metadata, and production JSX
does not store source data.

```ts
const source = { fileName: "scene.pibbl.tsx", lineNumber: 7, columnNumber: 5 };
const dev = jsxDEV(Card, { title: "Pibbl" }, "card", false, source, undefined);
expect(getElementSource(dev)).toEqual(source);
expect(jsx(Card, { title: "Pibbl" }, "card")).toEqual(
  createElement(Card, { key: "card", title: "Pibbl" }),
);
```

- [ ] **Step 2: Add failing TypeScript fixtures**

Set the repository compiler to `jsx: "react-jsx"` and
`jsxImportSource: "@pibbl/core"`, then cover:

```tsx
function Label(props: { value: string; children?: PibblTextChild }): PibblNode {
  return <Text style={{ x: 0, y: 0 }}>{props.children ?? props.value}</Text>;
}

const valid = (
  <Label key={1} value="ready">
    Pibbl
  </Label>
);

// @ts-expect-error required value is missing
const missing = <Label />;
// @ts-expect-error Pibbl defines no lowercase intrinsic tags
const intrinsic = <rect />;
// @ts-expect-error async components are not Pibbl element types
const asyncValue = <AsyncScene />;
```

The mixed-runtime fixture gives the React stub a separate nominal element type,
uses `/** @jsxImportSource ./react-stub */` for the host file, uses
`/** @jsxImportSource @pibbl/core */` for the Pibbl scene, proves both compile in one
project, and places `@ts-expect-error` on both crossed mount boundaries.

- [ ] **Step 3: Run typecheck and verify failure**

```bash
corepack pnpm@11.21.0 typecheck
```

Expected: FAIL because the package has no JSX runtime entries or module-scoped
namespace.

- [ ] **Step 4: Implement compiler entry points and the JSX namespace**

Export this namespace from both runtime modules:

```ts
export namespace JSX {
  export type Element = PibblElement;
  export type ElementType = PibblElementType;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    key?: PibblKey;
  }
  export interface IntrinsicElements {}
  export type LibraryManagedAttributes<C, P> =
    C extends PibblPrimitiveComponent<any, any>
      ? PrimitiveInputOf<C>
      : "key" extends keyof P
        ? never
        : P;
}
```

Keep `jsx`, `jsxs`, and `jsxDEV` out of `packages/core/src/index.ts`. Export
`Fragment` and `createElement` from the root because authors use those
explicitly.

- [ ] **Step 5: Publish and build both subpaths**

Add `./jsx-runtime` and `./jsx-dev-runtime` to the package export map with
separate `types` and `default` targets. Add all four source entries to
`tsconfig.build.json` and the esbuild entry list. Add exact source aliases for
both subpaths before the root alias in Vitest, and make the root alias match
only `@pibbl/core` so it cannot swallow subpaths.

- [ ] **Step 6: Teach repository tools to parse TSX**

Add `**/*.tsx` to the root TypeScript include. Extend the TypeScript ESLint file
matcher to `**/*.{ts,tsx,mts,cts}` and enable Babel parser plugins
`["typescript", "jsx"]`. Do not convert examples yet.

- [ ] **Step 7: Run runtime, type, build, and resolution checks**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element/jsx-runtime.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 --filter @pibbl/core build
```

Expected: PASS and `packages/core/dist/` contains runtime and declaration files
for the root, `jsx-runtime`, and `jsx-dev-runtime`.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/jsx-runtime.ts packages/core/src/jsx-dev-runtime.ts packages/core/src/lib/element packages/core/type-tests packages/core/package.json packages/core/tsconfig.build.json tsconfig.json vitest.config.ts eslint.config.mjs playground/package-consumer/tsconfig.bundler.json playground/package-consumer/tsconfig.nodenext.json
git commit -m "feat(core): publish automatic JSX runtime"
```

---

### Task 3: Render Recursive Nodes and Fragments Deterministically

**Files:**

- Create: `packages/core/src/lib/element/children.ts`
- Create: `packages/core/src/lib/element/children.test.ts`
- Create: `packages/core/src/lib/element/fragment.ts`
- Create: `packages/core/src/lib/element/fragment.test.tsx`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/execute-render.ts`
- Modify: `packages/core/src/lib/pibbl.ts`
- Modify: `packages/core/src/lib/mount-pibbl.ts`
- Modify: `packages/core/src/lib/update.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/global-state.ts`

**Interfaces:**

- Produces `materializeContainerChildren(node, receiver)` and `materializeTextChildren(node, receiver)`.
- Accepts any `PibblNode` at the root and from a component.
- Treats arrays and unkeyed fragments as transparent sibling structure and keyed fragments as explicit identity boundaries.
- Produces contextual diagnostics for React elements, invalid objects, functions, symbols, Promises, async iterables, raw container text, and duplicate keys.

- [ ] **Step 1: Write failing child-algebra tests**

Cover empty values, root arrays, nested arrays, one-shot generators, recursive
iterables, transparent unkeyed fragments, keyed fragments, source order,
duplicate keys after flattening, raw non-empty strings, nonzero numbers,
Promises, async iterables, functions, symbols, plain objects, known React
brands, and `jsxDEV` source locations.

```tsx
function* rows() {
  yield <Probe key="a" value="A" />;
  yield [false, <Probe key="b" value="B" />];
}

pibbl(
  canvas,
  <>
    {rows()}
    {showFooter && <Footer />}
  </>,
);
expect(renderedValues).toEqual(["A", "B", "footer"]);
expect(generatorExecutions).toBe(1);
```

- [ ] **Step 2: Write failing identity tests**

Use stateful plain test components to prove that nested arrays and unkeyed
fragments do not change parentage, keyed fragments create one parent scope,
keyed sibling reorder preserves state, unkeyed same-type siblings use flattened
occurrence order, and moving a keyed child between parents remounts it.

- [ ] **Step 3: Run focused traversal tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element/children.test.ts packages/core/src/lib/element/fragment.test.tsx packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the renderer accepts only one `CompEl` or a shallow
array of truthy elements.

- [ ] **Step 4: Implement contextual materialization**

Materialize each synchronous iterable exactly once per receiving traversal.
Return a frozen array of prepared element entries. Container empties are
`false`, `true`, `null`, `undefined`, `""`, and `0`; textual content is handled
only by the text collector. Detect `Symbol.for("react.element")` and
`Symbol.for("react.transitional.element")` before the generic object error and
emit the approved `jsxImportSource` correction.

- [ ] **Step 5: Implement transparent and keyed fragment dispatch**

An unkeyed `Fragment` recursively contributes its children to the current
sibling sequence. A keyed `Fragment` receives normal key uniqueness and an
identity/ref scope, but invokes no author component, allocates no hook slots,
and paints no pixels. Its descendants render below that boundary.

- [ ] **Step 6: Make root updates distinguish an empty node from no update**

Change `PibblInstance.root` to `PibblNode`. Replace the ambiguous optional pending
root with a private sentinel:

```ts
export const NO_PENDING_ROOT = Symbol("PIBBL_NO_PENDING_ROOT");
type PendingRoot = PibblNode | typeof NO_PENDING_ROOT;
```

This allows `pibbl(canvas, undefined)` and later empty-root updates while still
coalescing frames. Layer-internal updates use the same contract.

- [ ] **Step 7: Run traversal, lifecycle, event-order, and cleanup tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element packages/core/test/lifecycle-characterization.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: PASS with unchanged lifecycle and targeting order.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/lib/element packages/core/src/lib/render.ts packages/core/src/lib/execute-render.ts packages/core/src/lib/pibbl.ts packages/core/src/lib/mount-pibbl.ts packages/core/src/lib/update.ts packages/core/src/lib/types.ts packages/core/src/lib/global-state.ts
git commit -m "feat(core): render recursive Pibbl nodes"
```

---

### Task 4: Dispatch Plain Components and Define Platform Primitives

**Files:**

- Create: `packages/core/src/lib/define-primitive.ts`
- Create: `packages/core/src/lib/define-primitive.test.tsx`
- Create: `packages/core/src/lib/hooks/use-canvas-context.ts`
- Create: `packages/core/src/lib/hooks/use-canvas-context.test.tsx`
- Create: `packages/core/src/lib/component-dispatch.test.tsx`
- Modify: `packages/core/src/lib/element/types.ts`
- Modify: `packages/core/src/lib/element/metadata.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/style/resolve-dispatch.ts`
- Modify: `packages/core/src/lib/layout/measure.ts`
- Modify: `packages/core/src/lib/layout/place-child.ts`
- Modify: `packages/core/src/lib/layout/absolute.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `definePrimitive(render, capabilities?)`, `PibblPrimitiveComponent`, primitive capability/input types, and `useCanvasContext()`.
- Plain functions receive the frozen author-prop copy, including specified `style` and compiler-supplied `children`, with only `key` removed.
- Primitive render callbacks receive program props without `style`, resolved style, and the isolated Canvas context.
- Layout and measurement obtain primitive metadata through private accessors rather than properties attached to ordinary functions.

- [ ] **Step 1: Write failing plain-component lifecycle tests**

Prove a normal named function can use every existing hook, return nested nodes,
receive specified percentage style unchanged, read finite allocation through
`useLayoutBox`, preserve function identity through keyed reorder, and fail with
the existing teardown behavior.

```tsx
function Card(props: { style: BoxStyle; title: string }): PibblNode {
  const box = useLayoutBox();
  const [count] = useState(0);
  observed.push({ style: props.style, box, count });
  return <Group />;
}
```

- [ ] **Step 2: Write failing primitive and context tests**

Cover optional and required style typing, normalization, percentage resolution,
pure measurement, nested measurement, cyclic measurement diagnostics, direct
primitive invocation, no hook-slot allocation for `useCanvasContext`, Canvas
save/restore isolation, and targeted errors outside render and during
measurement.

- [ ] **Step 3: Run the focused tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/component-dispatch.test.tsx packages/core/src/lib/define-primitive.test.tsx packages/core/src/lib/hooks/use-canvas-context.test.tsx packages/core/src/lib/layout/measure.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because every current renderable is a capability-bearing
three-argument `CompFn`.

- [ ] **Step 4: Implement private primitive metadata**

`definePrimitive` creates a named component value whose direct function body
always throws the approved construction diagnostic. Store this record in a
private `WeakMap<Function, PrimitiveDefinition>`:

```ts
interface PrimitiveDefinition<P, S, N, R> {
  readonly render: (
    props: Readonly<P>,
    style: ResolvedStyle<R>,
    context: RenderingContext2D,
  ) => PibblNode;
  readonly normalizeStyle?: (style: SpecifiedStyle<S>) => NormalizedStyle<N>;
  readonly resolveStyle?: (
    style: NormalizedStyle<N>,
    context: Readonly<StyleResolutionContext>,
  ) => ResolvedStyle<R>;
  readonly measure?: (input: MeasureInput<P, N>) => MeasureResult;
}
```

Keep the existing conditional resolver requirement: allocation-dependent
declared style requires `resolveStyle`, and resolved style may not retain
`auto` or percentage allocation syntax.

- [ ] **Step 5: Split ordinary and primitive dispatch**

The renderer always establishes identity, refs, hooks, enhancer scopes, and
Canvas isolation first. It then invokes `definition.render(programProps,
resolvedStyle, context)` when primitive metadata exists; otherwise it invokes
`element.type(element.props)` exactly once. Both returned values flow through
the same recursive child traversal and hook finalization.

- [ ] **Step 6: Move style, measurement, and placement metadata off functions**

Update style resolution and pure measurement to read the primitive definition
and `element.props.style ?? EMPTY_STYLE`. Plain components without primitive
metadata report unsupported intrinsic measurement. Replace the mutable
`identityHint` assignment in `placeChild` with private WeakMap metadata so
frozen elements remain immutable.

- [ ] **Step 7: Implement `useCanvasContext`**

Return `GLOBAL_STATE.renderContext` only when a live component is executing.
Do not increment `componentHookIndex`. When measurement isolates global state,
the accessor must throw: `useCanvasContext() is available only during Pibbl
rendering and cannot be used during pure measurement.`

- [ ] **Step 8: Run plain-component, primitive, layout, hook, and failure tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/component-dispatch.test.tsx packages/core/src/lib/define-primitive.test.tsx packages/core/src/lib/hooks packages/core/src/lib/layout packages/core/test/lifecycle-characterization.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: PASS. New application fixtures contain zero definition wrappers.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/lib/define-primitive.ts packages/core/src/lib/define-primitive.test.tsx packages/core/src/lib/hooks packages/core/src/lib/component-dispatch.test.tsx packages/core/src/lib/element packages/core/src/lib/render.ts packages/core/src/lib/style packages/core/src/lib/layout packages/core/src/lib/types.ts packages/core/src/index.ts
git commit -m "feat(core): render plain function components"
```

---

### Task 5: Ship a Representative JSX Drawing Slice

**Files:**

- Modify: `packages/core/src/lib/components/rect.ts`
- Modify: `packages/core/src/lib/components/rect.test.ts`
- Modify: `packages/core/src/lib/components/text.ts`
- Modify: `packages/core/src/lib/components/text-layout.ts`
- Modify: `packages/core/src/lib/components/text.test.ts`
- Modify: `packages/core/src/lib/components/text-layout.test.ts`
- Modify: `packages/core/src/lib/components/g.ts`
- Modify: `packages/core/src/lib/components/g.test.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Create: `packages/core/test/jsx-authoring.test.tsx`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `Rectangle`, `Text`, and `Group` primitive component values.
- Changes `Text` to consume recursive `PibblTextChild` content and removes `text` from the new `TextStyle` contract.
- Proves `createElement` and JSX produce identical mounted behavior through the public package boundary.
- Retains private temporary adapters for old tests until Task 12; they are not used by new public evidence.

- [ ] **Step 1: Write the failing end-to-end JSX test**

Mount this shape through `@pibbl/core`, advance scheduled frames, and assert
state, Canvas calls, source order, event wiring, and disposal:

```tsx
function Poster(): PibblNode {
  const [message, setMessage] = useState("HELLO");
  return (
    <Group>
      <Rectangle
        style={{ width: 240, height: 120, fill: "#1f4bd8" }}
        onClick={() => setMessage("Pibbl")}
      />
      <Text style={{ x: 120, y: 48, fill: "#fff", textAlign: "center" }}>
        {message} {0}
      </Text>
    </Group>
  );
}
```

- [ ] **Step 2: Add failing text-content tests**

Cover strings, numbers including zero, booleans, `null`, `undefined`, nested
arrays, one-shot finite iterables, exact whitespace concatenation, measurement
and paint using the same materialized string, and a Pibbl element inside `Text`
as both a type and runtime error.

- [ ] **Step 3: Run the representative tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/jsx-authoring.test.tsx packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/g.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the public package still exposes lowercase factories and
text comes from `TextStyle.text`.

- [ ] **Step 4: Convert the three primitives**

Rename their raw callbacks to `renderRectangle`, `renderText`, and
`renderGroup`; define the public component values with `definePrimitive`.
`GroupProps.children` accepts `PibblNode`. Leaf `RectangleProps` omits children,
so JSX rejects them. Register style metadata against the exported primitive
value, not the raw callback.

- [ ] **Step 5: Make text content one explicit input**

Add `children?: PibblTextChild` to `TextProps`, call
`materializeTextChildren(props.children, "Text")` once, and pass the resulting
string to both render layout and measurement. Delete `TextStyle.text` from the
new public style type and remove `"text"` from opaque style registration.

- [ ] **Step 6: Prove the non-JSX equivalent**

In the same public test, construct the equivalent scene with:

```ts
createElement(Group, null, [
  createElement(Rectangle, {
    style: { width: 240, height: 120, fill: "#1f4bd8" },
  }),
  createElement(Text, { style: { x: 120, y: 48 } }, "HELLO ", 0),
]);
```

Assert the same semantic Canvas trace rather than comparing object identity.

- [ ] **Step 7: Run focused and public browser evidence**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/jsx-authoring.test.tsx packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/text-layout.test.ts packages/core/src/lib/components/g.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/lib/components/rect.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/text.ts packages/core/src/lib/components/text-layout.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/text-layout.test.ts packages/core/src/lib/components/g.ts packages/core/src/lib/components/g.test.ts packages/core/src/lib/style/types.ts packages/core/test/jsx-authoring.test.tsx packages/core/src/index.ts
git commit -m "feat(core): add JSX drawing components"
```

---

### Task 6: Convert Every Drawing and Composition Primitive

**Files:**

- Modify: `packages/core/src/lib/components/path.ts`
- Modify: `packages/core/src/lib/components/svg-path.ts`
- Modify: `packages/core/src/lib/components/line.ts`
- Modify: `packages/core/src/lib/components/horizontal-line.ts`
- Modify: `packages/core/src/lib/components/vertical-line.ts`
- Modify: `packages/core/src/lib/components/img.ts`
- Modify: `packages/core/src/lib/components/clip.ts`
- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/components/path.test.ts`
- Modify: `packages/core/src/lib/components/svg-path.test.ts`
- Modify: `packages/core/src/lib/components/line.test.ts`
- Modify: `packages/core/src/lib/components/line-helpers.test.ts`
- Modify: `packages/core/src/lib/components/img.test.ts`
- Modify: `packages/core/src/lib/components/img-async.test.ts`
- Modify: `packages/core/src/lib/components/clip.test.ts`
- Modify: `packages/core/src/lib/components/layer.test.ts`
- Modify: `packages/core/src/lib/components/event-integration.test.ts`
- Create: `packages/core/src/lib/components/layer-node-equality.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces `Path`, `SvgPath`, `Line`, `HorizontalLine`, `VerticalLine`, `Image`, `Clip`, and `Layer`.
- Makes drawing leaves childless and `Clip`/`Layer` general containers.
- Replaces `LayerProps.render` with `children` while preserving offscreen caching, shared interaction order, focus replay, surface density, and exact teardown.

- [ ] **Step 1: Add failing public JSX cases for every primitive**

Extend `packages/core/test/jsx-authoring.test.tsx` with one semantic case per
new component. Assert style, geometry, event path, transforms, clips, async
image invalidation, source paint order, and rejection of children on leaves.

- [ ] **Step 2: Add failing multi-child Layer tests**

Cover multiple children, arrays and iterables, empty content, child reorder,
keyed state, retained-cache hit, cache invalidation for prop/style/child/policy
changes, focus subtree replay, transformed hit testing, resize, render failure,
and idempotent disposal.

- [ ] **Step 3: Run drawing and layer tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components packages/core/test/jsx-authoring.test.tsx packages/core/test/geometry-composition.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing uppercase components and `LayerProps.render`.

- [ ] **Step 4: Convert leaf primitives with `definePrimitive`**

Give every raw drawing callback a `render*` name and every exported component
the approved descriptive name. Preserve existing normalize/resolve/measure
functions and event geometry exactly. `Image` remains an imported Pibbl value;
guides explicitly show aliasing the browser constructor when both are needed.

- [ ] **Step 5: Convert `Clip` and `Layer` to children**

`ClipProps.children` and `LayerProps.children` accept `PibblNode`. `Layer`
materializes children once and mounts a private keyed fragment root into the
offscreen instance. Compare prior and next materialized trees recursively by
element type, key, shallow non-child props, child sequence, and transparent
policy metadata; never execute an iterable during comparison.

- [ ] **Step 6: Preserve layer ownership and interaction evidence**

Keep one child Pibbl controller per mounted `Layer`, the current parent event
root, global paint ledger entry, focus render revision, device-density surface,
and teardown order. Assert a cache hit replays retained focus metadata without
executing child components.

- [ ] **Step 7: Run drawing, composition, image, layer, event, and visual-safeguard tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components packages/core/test/drawing-gallery.test.ts packages/core/test/geometry-composition.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:visual-safeguard
```

Expected: PASS without changing expected pixels.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/lib/components packages/core/test/jsx-authoring.test.tsx packages/core/src/index.ts
git commit -m "feat(core): convert drawing primitives to JSX components"
```

---

### Task 7: Convert Layout to Recursive JSX Children

**Files:**

- Modify: `packages/core/src/lib/layout/absolute.ts`
- Modify: `packages/core/src/lib/layout/overlay.ts`
- Modify: `packages/core/src/lib/layout/flow.ts`
- Modify: `packages/core/src/lib/layout/flex.ts`
- Modify: `packages/core/src/lib/layout/grid.ts`
- Modify: `packages/core/src/lib/layout/place-child.ts`
- Modify: `packages/core/src/lib/layout/measure.ts`
- Modify: `packages/core/src/lib/layout/absolute.test.ts`
- Modify: `packages/core/src/lib/layout/overlay.test.ts`
- Modify: `packages/core/src/lib/layout/flow.test.ts`
- Modify: `packages/core/src/lib/layout/flex.test.ts`
- Modify: `packages/core/src/lib/layout/grid.test.ts`
- Modify: `packages/core/src/lib/layout/place-child.test.ts`
- Modify: `packages/core/src/lib/layout/measure.test.ts`
- Modify: `packages/core/test/layout-foundation.test.ts`
- Modify: `packages/core/test/flex-css-compatibility.test.ts`
- Modify: `packages/core/test/grid-css-compatibility.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces `Absolute`, `Overlay`, `Flow`, `Flex`, and `Grid` primitive values.
- Layout containers accept recursive `PibblNode` children but prepare a finite direct-element sequence once per render/measurement.
- Direct-child style comes from specified `element.props.style`; the plain child still receives that same specified object and reads its finite allocation with `useLayoutBox()`.

- [ ] **Step 1: Write failing JSX layout tests**

For every layout algorithm, cover nested arrays, generators, conditionals,
plain components with layout style, primitive components, keyed reorder,
measurement, clipping, and exact boxes. Count generator execution to prove one
materialization feeds inspection, measurement, placement, and paint.

```tsx
function Card(props: { style: BoxStyle; name: string }): PibblNode {
  allocations.set(props.name, useLayoutBox());
  specifiedStyles.set(props.name, props.style);
  return <Rectangle style={{ width: 20, height: 20, fill: "black" }} />;
}

const scene = (
  <Grid style={{ width: 200, height: 100, gridTemplateColumns: [100, 100] }}>
    {getCards()}
    {showFooter && <Card name="footer" style={{ gridColumnStart: 2 }} />}
  </Grid>
);
```

- [ ] **Step 2: Run layout tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/test/grid-css-compatibility.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because layout props require shallow arrays of old element
descriptors.

- [ ] **Step 3: Add one direct-child preparation helper**

Use `materializeContainerChildren` at the layout boundary and reject any
remaining policy/fragment condition that cannot resolve to elements. The
resulting frozen element array is passed through resolve, measurement,
placement, and returned paint children. Do not re-read the author's iterable.

- [ ] **Step 4: Convert layout definitions and style lookup**

Rename raw callbacks to `renderAbsolute`, `renderOverlay`, `renderFlow`,
`renderFlex`, and `renderGrid`; export the uppercase primitive values. Update
`normalizeDirectChildStyle`, `childWithUsedSize`, pre-normalized style WeakMaps,
placement identity hints, and diagnostics to use immutable `PibblElement`.

- [ ] **Step 5: Preserve plain-component style semantics**

Parent layout may normalize and resolve a child's declared style for
allocation, but the child descriptor and its delivered props remain unchanged.
Any used-size override lives in private placement metadata and primitive style
dispatch; it must not replace `props.style` for a plain child.

- [ ] **Step 6: Run all layout and representative browser tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/test/grid-css-compatibility.test.ts packages/core/test/jsx-authoring.test.tsx --browser.headless --browser.ui=false
```

Expected: PASS with existing layout diagnostics and geometry.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/test/grid-css-compatibility.test.ts packages/core/test/jsx-authoring.test.tsx packages/core/src/index.ts
git commit -m "feat(core): compose layout with JSX children"
```

---

### Task 8: Replace Focus Enhancers with Transparent Policy Components

**Files:**

- Create: `packages/core/src/lib/focus/policy-components.ts`
- Create: `packages/core/src/lib/focus/policy-components.test.tsx`
- Modify: `packages/core/src/lib/element/metadata.ts`
- Modify: `packages/core/src/lib/element/children.ts`
- Modify: `packages/core/src/lib/element-enhancers.ts`
- Modify: `packages/core/src/lib/focus/with-focus-management.ts`
- Modify: `packages/core/src/lib/focus/with-keyboard-navigation.ts`
- Modify: `packages/core/src/lib/focus/public-api.test.ts`
- Modify: `packages/core/src/lib/focus/nested-navigation.test.ts`
- Modify: `packages/core/src/lib/focus/layer-focus-render.test.ts`
- Modify: `packages/core/test/focus-navigation.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `FocusManagement` and `KeyboardNavigation` JSX component values.
- Both require exactly one Pibbl element child after empty-value removal and reject raw text, zero elements, and multiple elements.
- They attach existing private enhancer descriptors without adding component identity, layout, paint, hook, or measurement boundaries.
- Removes public `withFocusManagement` and `withKeyboardNavigation` after all call sites migrate in this task.

- [ ] **Step 1: Write failing type and runtime policy tests**

Cover exactly one child, nested policies, arrays that normalize to one element,
zero/multiple/text children, keyboard policy without focus manager, duplicate
focus managers, source metadata in errors, and direct policy invocation under a
foreign JSX runtime.

- [ ] **Step 2: Write failing identity and ownership tests**

Compare the enhanced child's component ID, parent ID, hook state, layout box,
paint order, event path, layer cache key, and teardown counts before and after
wrapping with each JSX policy. They must match the current enhancer behavior.

```tsx
const scene = (
  <FocusManagement>
    <KeyboardNavigation mode="directional">
      <Scene />
    </KeyboardNavigation>
  </FocusManagement>
);
```

- [ ] **Step 3: Run focus tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus packages/core/src/lib/element-enhancers.test.ts packages/core/test/focus-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because focus configuration is still applied by functions after
element creation.

- [ ] **Step 4: Implement transparent policy preparation**

Register each policy value in private element metadata. During child
preparation, recognize a policy descriptor before identity assignment,
materialize its children once, require one `PibblElement`, clone only private
metadata, and append the existing enhancer descriptor to that child. Recursively
prepare nested policies so JSX order matches current declaration-order entry.

- [ ] **Step 5: Remove public enhancer functions**

Migrate all focus tests and public scenarios in scope to policy components,
then remove the two function exports. Keep `element-enhancers.ts` private
because it remains the mounted lifecycle machinery behind the policy values.

- [ ] **Step 6: Run full focus, event, layer, identity, and tree-shaking tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/components/layer.test.ts packages/core/test/focus-navigation.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
```

Expected: PASS with unchanged focus and keyboard semantics.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/focus packages/core/src/lib/element packages/core/src/lib/element-enhancers.ts packages/core/src/lib/element-enhancers.test.ts packages/core/test/focus-navigation.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/src/index.ts
git commit -m "feat(focus): add transparent JSX policy components"
```

---

### Task 9: Make the Studio Compile and Run Pibbl TSX

**Files:**

- Create: `tooling/pibbl-studio-runtime-entry.ts`
- Modify: `tooling/pibbl-runtime-source.ts`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `playground/src/pibbl-editor-types.txt`
- Modify: `playground/src/editor-workbench.ts`
- Modify: `playground/src/sandbox-runner.ts`
- Modify: `playground/src/learning-sources.ts`
- Modify: `playground/src/scenario-sources.ts`
- Modify: `playground/vite.config.ts`
- Modify: `packages/core/test/share-code.test.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `packages/core/test/browser.test.ts`

**Interfaces:**

- Monaco checks and emits `.tsx` using `JsxEmit.ReactJSX` and `jsxImportSource: "@pibbl/core"`.
- The Studio declaration bundle includes `@pibbl/core`, `@pibbl/core/jsx-runtime`, and `@pibbl/core/jsx-dev-runtime` module declarations.
- The sandbox permits only the three Pibbl module entry points and rewrites emitted automatic-runtime aliases to the private `PIBBL_CORE` IIFE global.
- Source and built Studio modes bundle the same root and compiler entry points.

- [ ] **Step 1: Add failing Studio compiler and sandbox tests**

Feed the Monaco-compatible verifier a complete `.tsx` lesson with a plain
component, fragment, list, conditional, text interpolation, style, and event.
Add sandbox unit coverage for emitted imports shaped like:

```js
import { jsx as _jsx, jsxs as _jsxs } from "@pibbl/core/jsx-runtime";
import { pibbl, Rectangle, Text } from "@pibbl/core";
```

Assert aliases become valid object bindings (`jsx: _jsx`) and any fourth-party
import remains rejected.

- [ ] **Step 2: Run Studio checks and verify failure**

```bash
node tooling/verify-studio-types.mjs
corepack pnpm@11.21.0 exec vitest run packages/core/test/share-code.test.ts packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because Monaco uses a `.ts` model and the sandbox accepts only
one root import.

- [ ] **Step 3: Configure Monaco for the automatic runtime**

Set `jsx` to `JsxEmit.ReactJSX`, `jsxImportSource` to `"@pibbl/core"`, keep
ESNext modules, and create lesson/testing model URIs ending in `.tsx`. Install
extra libraries at the three exact package paths. Keep syntax and semantic
diagnostics enabled so a wrong runtime is visible before preview.

- [ ] **Step 4: Build one Studio-only runtime bridge**

`tooling/pibbl-studio-runtime-entry.ts` re-exports the public root and explicitly
re-exports compiler functions from both runtime entries solely into the Studio
IIFE. The public root package still does not export `jsx`, `jsxs`, or `jsxDEV`.
Resolve this bridge against source entries in source mode and built entries in
built mode.

- [ ] **Step 5: Rewrite only supported emitted imports**

Allow named imports from `@pibbl/core`, `@pibbl/core/jsx-runtime`, and
`@pibbl/core/jsx-dev-runtime`; combine them into one `PIBBL_CORE` destructuring
statement, translate `name as alias` to `name: alias`, and reject default,
namespace, dynamic, or external imports. Continue to require one default
`mount(canvas)` export.

- [ ] **Step 6: Extend source discovery to TSX**

Change raw-source globs to `**/*.example.tsx`. During the next two migration
tasks, permit both `.example.ts` and `.example.tsx` in catalog validation so
commits remain executable; remove the `.ts` allowance in Task 12.

- [ ] **Step 7: Run Studio source and built builds**

```bash
node tooling/verify-studio-types.mjs
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

Expected: PASS with the temporary mixed extension allowance.

- [ ] **Step 8: Commit**

```bash
git add tooling/pibbl-studio-runtime-entry.ts tooling/pibbl-runtime-source.ts tooling/verify-studio-types.mjs playground/src playground/vite.config.ts packages/core/test/share-code.test.ts packages/core/test/learning-examples.test.ts packages/core/test/browser.test.ts
git commit -m "feat(studio): compile Pibbl automatic JSX"
```

---

### Task 10: Convert the Complete Learning Catalog

**Files:**

- Rename/Modify: `packages/scenarios/src/learning/**/*.example.ts` to `packages/scenarios/src/learning/**/*.example.tsx`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/learning-types.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `playground/src/learning-sources.ts`
- Modify: `tooling/scenario-catalog.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Every learning lesson uses plain components and descriptive JSX, except one explicit non-JSX lesson that uses `createElement` while remaining a `.tsx` catalog source.
- Catalog API tags, objectives, notes, prompts, relationships, and generated source paths describe the new API.
- Every lesson still exports `default function mount(canvas: HTMLCanvasElement): PibblController` and runs identically in the Studio.

- [ ] **Step 1: Add failing catalog assertions**

Require every learning source path to end in `.example.tsx`; require an
`@pibbl/core` import and canonical mount; reject `defineComp`, lowercase factory
imports/calls, old focus enhancers, `TextStyle.text`, and `LayerProps.render`.
Require exactly one lesson tagged `createElement` and `non-jsx` and assert that
lesson contains no JSX element syntax.

- [ ] **Step 2: Run catalog tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 scenarios:check
```

Expected: FAIL on old extensions, imports, metadata, and syntax.

- [ ] **Step 3: Convert start, drawing, and composition lessons**

Convert `start`, `drawing`, and `composition` in catalog order. Use textual
children for `Text`, normal children for `Group`, `Clip`, and `Layer`, explicit
style objects, and ordinary named functions. Add the dedicated non-JSX lesson
immediately after getting started and implement its full scene with
`createElement(type, props, ...children)`.

- [ ] **Step 4: Convert layout and interaction lessons**

Convert `layout`, `mouse-events`, `user-events`, `keyboard-focus`, and
`advanced-interactions`. Preserve all visible feedback, deterministic action
hooks, focus behavior, and Canvas sizes. Use `FocusManagement` and
`KeyboardNavigation` as JSX policies.

- [ ] **Step 5: Rewrite catalog prose and API tags**

Replace old names with the approved uppercase vocabulary. Getting started must
teach plain functions before hooks; drawing lessons teach explicit style;
composition teaches children; layout teaches specified style versus
`useLayoutBox`; focus lessons explicitly state the single-Canvas accessibility
boundary.

- [ ] **Step 6: Regenerate and inspect the scenario index**

```bash
corepack pnpm@11.21.0 scenarios:write-index
git diff -- docs/scenario-index.md packages/scenarios/src/learning-catalog.ts
```

Expected: paths, API names, objectives, and lesson count match the migrated
catalog; no test-lab metadata leaks into learning prose.

- [ ] **Step 7: Run learning, Studio, and browser evidence**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts packages/core/test/browser.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 playground:build
```

Expected: PASS; manually open getting started, the non-JSX lesson, one layout
lesson, one layer lesson, and one focus lesson and confirm live edits compile.

- [ ] **Step 8: Commit**

```bash
git add packages/scenarios/src/learning packages/scenarios/src/learning-catalog.ts packages/scenarios/src/learning-types.ts packages/scenarios/src/index.ts packages/core/test/learning-examples.test.ts playground/src/learning-sources.ts tooling/scenario-catalog.ts docs/scenario-index.md
git commit -m "refactor(examples): teach Pibbl with JSX"
```

---

### Task 11: Convert Deterministic Scenarios and Cross-Feature Tests

**Files:**

- Rename/Modify: `packages/scenarios/src/*.example.ts` to `packages/scenarios/src/*.example.tsx`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/types.ts`
- Modify: `packages/scenarios/src/*.ts`
- Modify: `packages/core/test/*.test.ts`
- Modify: `packages/core/src/lib/**/*.test.ts`
- Modify: `playground/src/scenario-sources.ts`
- Modify: `tooling/scenario-catalog.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- All public deterministic scenarios use descriptive JSX and plain components while retaining their source markers, action IDs, semantic state, geometry, manual procedures, and visual output.
- Internal tests use JSX where component structure is the subject and `createElement` where keeping a pure `.ts` helper is clearer; none use removed factories or `defineComp`.
- Scenario source metadata changes from `language: "ts"` to `language: "tsx"`.

- [ ] **Step 1: Strengthen failing migration checks**

Update scenario-catalog validation to reject old public API imports and require
`.example.tsx`. Add a repository typecheck fixture that imports only the final
public vocabulary. Run a targeted grep gate:

```bash
rg -n "\b(defineComp|rect|path|svgPath|line|horizontalLine|verticalLine|text|img|g|clip|layer|absolute|overlay|flow|flex|grid|withFocusManagement|withKeyboardNavigation)\b" packages/scenarios packages/core/test packages/core/src/lib --glob '!**/text-layout*' --glob '!**/style/**'
```

Review every match; declarations, local prose variables, and Canvas method
names are allowed only when they are not obsolete Pibbl APIs.

- [ ] **Step 2: Run representative suites and verify failure**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/smoke-scenario.test.ts packages/core/test/drawing-gallery.test.ts packages/core/test/layout-foundation.test.ts packages/core/test/runtime-hooks-laboratory.test.ts packages/core/test/focus-navigation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL until scenario modules and their type imports are renamed.

- [ ] **Step 3: Convert deterministic scenarios by feature**

Convert surface/smoke, drawing, composition, layout, hooks/lifecycle,
interaction, focus, cleanup, and performance scenarios in that order. Keep
every exported state type, source ID, marker, action, and controller contract
stable. Replace helper factories with ordinary functions returning `PibblNode`.

- [ ] **Step 4: Migrate cross-feature unit and browser tests**

Replace old factories with JSX or `createElement`, replace `CompEl`/`CompFn`
with `PibblElement`/`PibblComponent` or primitive-specific types, and replace focus
enhancer functions with policy elements. Do not weaken semantic assertions to
make the migration pass.

- [ ] **Step 5: Regenerate catalog output and inspect visual diffs**

```bash
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 test:visual-safeguard
```

Expected: the index changes API names and `.tsx` paths; expected Canvas
baselines remain byte-for-byte unchanged.

- [ ] **Step 6: Run the complete browser suite**

```bash
corepack pnpm@11.21.0 test:ci
```

Expected: PASS across drawing, lifecycle, layout, events, focus, cleanup,
performance structure, and Studio integration.

- [ ] **Step 7: Commit**

```bash
git add packages/scenarios/src packages/core/test packages/core/src/lib playground/src/scenario-sources.ts tooling/scenario-catalog.ts docs/scenario-index.md
git commit -m "refactor(core): migrate feature evidence to JSX"
```

---

### Task 12: Remove the Legacy Authoring Surface

**Files:**

- Delete: `packages/core/src/lib/define-comp.ts`
- Delete: `packages/core/src/lib/create-element.ts`
- Delete: `packages/core/src/lib/focus/with-focus-management.ts`
- Delete: `packages/core/src/lib/focus/with-keyboard-navigation.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/element/types.ts`
- Modify: `packages/core/src/lib/components/*.ts`
- Modify: `packages/core/src/lib/layout/*.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `tooling/scenario-catalog.ts`
- Modify: `playground/src/pibbl-editor-types.txt`
- Modify: `tooling/verify-studio-types.mjs`

**Interfaces:**

- Final root exports contain `createElement`, `Fragment`, `definePrimitive`, `useCanvasContext`, descriptive component values, hooks, styles, layout/measurement APIs, event APIs, and surface/focus types.
- Final declarations contain no `CompEl`, `CompFn`, `ComponentInput`, `ComponentCapabilities`, `FalsyNodes`, lowercase factory, `defineComp`, or `with*` authoring symbol.
- Catalog discovery accepts only `.example.tsx` for example source files.

- [ ] **Step 1: Add a failing exact public-surface test**

Update the public API test to compare the runtime export key set and add
type-only checks for the approved names. Assert compiler functions are absent
from the root but present on their compiler subpaths. Assert every obsolete
name is `undefined` at runtime and fails a type import.

- [ ] **Step 2: Run static and public API checks and verify failure**

```bash
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/public-api.test.ts packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL while migration adapters and legacy declarations remain.

- [ ] **Step 3: Delete adapters and obsolete types**

Remove the legacy files and exports. Rename residual internal `CompEl` and
`CompRefs` vocabulary to `PibblElement` and `PibblComponentRefs`; rename primitive
render types explicitly instead of preserving `CompFn`. Delete old style-text
and layer-render compatibility code.

- [ ] **Step 4: Make the Studio declaration file match the final package**

Update the curated editor declarations with the exact public node, element,
component, primitive, built-in, policy, hook, style, layout, event, and surface
types plus both compiler modules. Rewrite `verify-studio-types.mjs` consumer
code to JSX and add negative wrong-runtime/type cases.

- [ ] **Step 5: Enforce extension and vocabulary closure**

Make catalog validation accept only `language: "tsx"` and
`.example.tsx`. Run these zero-match checks:

```bash
rg -n "\b(defineComp|CompEl|CompFn|withFocusManagement|withKeyboardNavigation)\b" packages playground tooling README.md docs --glob '!docs/project-plans/**' --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**' --glob '!docs/testing/field-notes/**'
rg -n "from ['\"]@pibbl/core['\"].*\b(rect|img|g|absolute|overlay|flow|flex|grid)\b" packages playground tooling
```

Historical plans/specs/field notes may retain historical names; current code,
guides, contracts, and generated catalog output may not.

- [ ] **Step 6: Run typecheck, lint, build, and scenario validation**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 build
```

Expected: PASS with no legacy compatibility surface.

- [ ] **Step 7: Commit**

```bash
git add -A packages/core packages/scenarios playground/src/pibbl-editor-types.txt tooling/scenario-catalog.ts tooling/verify-studio-types.mjs
git commit -m "refactor(core): remove factory authoring API"
```

---

### Task 13: Verify Packed Consumers, Mixed Projects, and Diagnostics

**Files:**

- Create: `playground/package-consumer/jsx.tsx`
- Create: `playground/package-consumer/wrong-runtime.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `playground/package-consumer/tsconfig.bundler.json`
- Modify: `playground/package-consumer/tsconfig.nodenext.json`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `tooling/assert-built-core.ts`
- Modify: `packages/core/src/lib/pibbl.ts`
- Modify: `packages/core/src/lib/element/children.ts`
- Modify: `packages/core/src/lib/define-primitive.ts`
- Create: `packages/core/src/lib/element/foreign-runtime-diagnostics.test.tsx`

**Interfaces:**

- Packed Bundler and NodeNext consumers compile Pibbl TSX without React installed.
- A mixed-runtime fixture keeps React JSX and Pibbl JSX in separate files and uses aliased `createElement` for the minority runtime in a host file.
- Runtime diagnostics distinguish React-branded elements, generic foreign element-like objects, direct primitive calls, invalid children, and source-aware failures.
- Tree shaking still removes focus implementation from a consumer that imports no focus policy.

- [ ] **Step 1: Write failing packed JSX consumers**

Add `.tsx` to both consumer tsconfigs and set the automatic Pibbl runtime. Mount a
plain component containing `Grid`, `Rectangle`, `Text`, a list, and a
conditional. Import both compiler subpaths directly in a resolution-only type
fixture and assert deep `@pibbl/core/lib/*` imports remain blocked.

- [ ] **Step 2: Write failing diagnostic tests**

Assert exact actionable fragments for:

```text
Pibbl received a React element. This file is using the React JSX runtime.
Set jsxImportSource to "@pibbl/core" or add /** @jsxImportSource @pibbl/core */.
```

```text
Rectangle is a Pibbl component and was invoked outside the Pibbl renderer.
Use <Rectangle ... /> in a Pibbl JSX file or createElement(Rectangle, props).
```

Also require receiver component name and `file:line:column` when `jsxDEV`
metadata exists.

- [ ] **Step 3: Run package and diagnostic tests and verify failure**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element/foreign-runtime-diagnostics.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:package-consumer
```

Expected: FAIL until consumer copies, exports, and exact diagnostics are wired.

- [ ] **Step 4: Extend built and packed verification**

Copy `jsx.tsx` and both updated tsconfigs into the temporary packed consumer.
Assert the tarball contains all runtime/declaration subpath files and no source.
Bundle a no-focus JSX entry and a `FocusManagement` JSX entry; verify the
existing focus marker is absent/present respectively and the no-focus bundle is
smaller.

- [ ] **Step 5: Exercise mixed React/Pibbl file boundaries**

Keep JSX in the React-stub host file and construct the Pibbl scene there with:

```ts
import { pibbl, createElement as createPibblElement } from "@pibbl/core";
import { Poster } from "./pibbl-scene.pibbl";

pibbl(canvas, createPibblElement(Poster, { title: "Pibbl" }));
```

The Pibbl scene file uses its own Pibbl pragma. Type fixtures prove a React element
cannot be passed to `pibbl` and a `PibblElement` cannot be returned from the React
component.

- [ ] **Step 6: Run source, built, and packed consumer checks**

```bash
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:smoke:built
```

Expected: PASS under Bundler and NodeNext with compiler subpaths resolved and
tree shaking preserved.

- [ ] **Step 7: Commit**

```bash
git add playground/package-consumer tooling/verify-packed-consumer.mjs tooling/assert-built-core.ts packages/core/src/lib/pibbl.ts packages/core/src/lib/element packages/core/src/lib/define-primitive.ts
git commit -m "test(package): verify JSX consumers and diagnostics"
```

---

### Task 14: Write the JSX-Era Documentation and Contracts

**Files:**

- Modify: `README.md`
- Modify: `packages/core/README.md`
- Create: `docs/guides/jsx-quick-start.md`
- Create: `docs/guides/configuring-jsx.md`
- Create: `docs/guides/components-props-and-style.md`
- Create: `docs/guides/children-text-lists-and-keys.md`
- Create: `docs/guides/layout-groups-clips-and-layers.md`
- Create: `docs/guides/state-lifecycle-and-react-differences.md`
- Create: `docs/guides/custom-components-and-primitives.md`
- Create: `docs/guides/without-jsx.md`
- Create: `docs/guides/react-interop.md`
- Create: `docs/guides/jsx-troubleshooting.md`
- Create: `docs/guides/focus-keyboard-and-accessibility.md`
- Create: `docs/api-reference.md`
- Create: `docs/migrations/jsx-authoring-pivot.md`
- Modify: `docs/design/canvas-surface-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/design/layout-system-contract.md`
- Modify: `docs/design/user-events-contract.md`
- Modify: `docs/design/focus-and-keyboard-navigation-contract.md`
- Modify: `docs/design/canvas-accessibility-guidance.md`
- Modify: `docs/design/mouse-interaction-contract.md`
- Modify: `docs/design/event-resource-ownership.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `docs/library-status.md`
- Modify: `docs/testing/trust-gate.md`

**Interfaces:**

- The README gives a complete preferred JSX setup and links to the non-JSX path before the first advanced topic.
- Guides cover compiler setup, authoring, children, text, layout, lifecycle, custom drawing, advanced primitives, non-JSX, React coexistence, diagnostics, focus, and accessibility.
- Normative contracts describe the final branded element protocol and JSX-era names without contradicting shipped lifecycle or ownership behavior.

- [ ] **Step 1: Create a documentation acceptance checklist**

In `docs/library-status.md`, add a review table mapping every documentation item
from the approved spec to one guide/contract and one executable example. The
table must include Vite/esbuild, Babel automatic runtime, JavaScript setup,
fragments/lists/keys, text interpolation, specified style versus allocation,
layers, React differences, non-JSX, mixed projects, diagnostics, focus, and
accessibility.

- [ ] **Step 2: Write the quick start and configuration guides**

Show installation, `tsconfig.json`, per-file pragma, imports, a complete
interactive `Poster`, `pibbl(canvas, <Poster />)`, scheduled updates, and
idempotent disposal. Explain that uppercase imports are Canvas components, no
DOM is generated, and one file has one JSX runtime.

- [ ] **Step 3: Write component, child, text, layout, and composition guides**

Use runnable code for explicit `style`, behavioral props, arbitrary
interpolation, finite iterables, keys, transparent/keyed fragments, textual
children including zero, layout allocations, `Group`, `Clip`, and multi-child
`Layer`. Document every invalid child category and its error.

- [ ] **Step 4: Write lifecycle, custom component, and primitive guides**

Contrast Pibbl with React precisely: full synchronous Canvas traversal,
requestAnimationFrame coalescing, Pibbl hook names, component identity,
save/restore isolation, no DOM reconciliation, and exact teardown. Show an
ordinary composite, a `useCanvasContext` painter, and a complete
`definePrimitive` with normalize/resolve/measure.

- [ ] **Step 5: Write the complete non-JSX and React interop guides**

The non-JSX guide must be usable without reading JSX docs and cover
`createElement(type, props, ...children)`, dynamic arrays, keys, text,
containers, focus policies, lifecycle, and mounting. The React guide uses
separate files, a host-owned Canvas, controller cleanup, and aliased
`createElement` for a minority Pibbl tree in a React JSX file.

- [ ] **Step 6: Write troubleshooting, focus, accessibility, API, and migration docs**

Index each exact compile/runtime diagnostic and correction. State that Pibbl has
one native Canvas focus host and no generated semantic DOM/accessibility tree.
The API reference lists every final runtime/type export and both compiler
subpaths. The migration guide maps every old authoring form to its final
replacement and explicitly states there are no compatibility aliases.

- [ ] **Step 7: Update all normative design contracts**

Replace `CompEl`, factory calls, separate element style fields, `defineComp`,
and function enhancers with the final protocol. Preserve exact current
surface, hook, drawing, style, layout, event, focus, accessibility, and resource
ownership statements. Label completed numbered plans as historical evidence;
do not rewrite them as current contracts.

- [ ] **Step 8: Validate examples, links, formatting, and stale vocabulary**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 lint
rg -n "\b(defineComp|CompEl|CompFn|withFocusManagement|withKeyboardNavigation)\b" README.md packages/core/README.md docs/design docs/guides docs/api-reference.md docs/library-status.md
```

Expected: scenario and formatting checks pass; the vocabulary search has no
matches except migration-table old-side labels where the replacement is on the
same row.

- [ ] **Step 9: Commit**

```bash
git add README.md packages/core/README.md docs/guides docs/api-reference.md docs/migrations docs/design docs/library-status.md docs/testing/trust-gate.md
git commit -m "docs: document JSX and non-JSX authoring"
```

---

### Task 15: Run the Full Trust Gate and Record Fresh Evidence

**Files:**

- Create: `docs/testing/field-notes/jsx-component-authoring.md`
- Modify: `docs/library-status.md`
- Modify: `docs/testing/trust-gate.md`

**Interfaces:**

- Produces a dated verification record with exact environment, commands, results, inspected visual evidence, and any intentionally deferred non-goals.
- Makes no implementation change unless a fresh gate exposes a defect; any defect returns to a failing focused test before the fix.

- [ ] **Step 1: Confirm the final public and source shape**

```bash
git status --short
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
```

Expected: only intended JSX refactor/documentation changes are present and all
static checks pass.

- [ ] **Step 2: Run package and Studio gates**

```bash
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
corepack pnpm@11.21.0 test:package-consumer:packed
```

Expected: source, built, packed, Bundler, NodeNext, Monaco, and sandbox modes
all resolve the automatic runtime.

- [ ] **Step 3: Run browser, visual, built-smoke, lifecycle, and performance gates**

```bash
corepack pnpm@11.21.0 test:ci
corepack pnpm@11.21.0 test:visual-safeguard
corepack pnpm@11.21.0 test:studio-visual
corepack pnpm@11.21.0 test:smoke:built
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

Expected: PASS. Inspect visual expected/actual/diff artifacts even when the
comparison passes; record that no baseline was rewritten without review.

- [ ] **Step 4: Run the aggregate trust command from a clean provisioned checkout**

```bash
corepack pnpm@11.21.0 trust
```

Expected: PASS. Record actual test totals and wall time from this run only; do
not copy historical totals from existing docs.

- [ ] **Step 5: Perform manual acceptance checks**

In the Studio, run and edit getting started, non-JSX, text, Grid interpolation,
Layer, and focus lessons. In a temporary consumer, deliberately compile one Pibbl
file with the React stub runtime and verify the compile/runtime diagnostic
points to `jsxImportSource`. Confirm a React-host file can mount a Pibbl scene via
aliased `createElement`.

- [ ] **Step 6: Record evidence and final status**

Write `docs/testing/field-notes/jsx-component-authoring.md` with Node/pnpm/
Chromium versions, commit, commands, exact results, visual inspection, manual
checks, and the approved non-goals. Update current status/trust docs to link to
that record without replacing historical field notes.

- [ ] **Step 7: Commit**

```bash
git add docs/testing/field-notes/jsx-component-authoring.md docs/library-status.md docs/testing/trust-gate.md
git commit -m "test: record JSX authoring trust evidence"
```
