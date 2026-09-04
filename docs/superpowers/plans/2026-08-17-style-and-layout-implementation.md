# CRC First-Class Style and Layout Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** Agent instructions and unchecked-looking task syntax below are preserved as dated evidence, not active work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CRC's visual props with one explicit typed style language, then deliver dedicated absolute, overlay, flow, CSS-compatible flex, and CSS-compatible grid layout components without introducing a retained display list.

**Architecture:** Element descriptors store `style` and `key` separately from programmatic props. Layout algorithms inspect direct child descriptors, resolve declared boxes or pure opt-in measurements, and return stable internal placement nodes that compose through CRC's existing transform/clip/interaction seams. Drawing components remain leaves; dedicated layout components establish formatting contexts.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest Browser Mode with Playwright Chromium, esbuild, pnpm 11.21.0.

## Global Constraints

- CSS property names and accepted CSS values MUST have CSS-compatible behavior for the supported case; divergent CRC algorithms MUST use CRC-specific names.
- Style is the sole visual-property namespace. Final public built-in APIs MUST NOT accept legacy top-level geometry or paint props.
- No selectors, stylesheets, cascade, specificity, `!important`, or implicit inheritance.
- Developers compose and reuse styles through ordinary TypeScript values and object spread.
- Drawing components paint only. Only `absolute`, `overlay`, `flow`, `flex`, and `grid` establish formatting contexts.
- Nested layout components participate directly in parent layout; there is no public `layoutItem` or `slot` wrapper.
- Layout uses declared boxes and opt-in pure measurement; it MUST NOT record a scene-wide display list or speculatively invoke component render functions.
- Parent-first rendering, source paint order, reverse-paint-order targeting, requestAnimationFrame coalescing, component identity, layer ordering, and deterministic teardown remain authoritative.
- A number is a finite Canvas logical pixel. Percentages resolve against the containing content box. `auto` is accepted only where the component and algorithm can resolve it.
- Unknown, non-finite, cyclic, or required-but-unmeasurable values produce component/property/constraint-specific diagnostics and never reach Canvas calls.
- New behavior follows TDD: observe the focused test fail for the expected missing behavior before adding production code.
- Per-task verification is focused. Run the broader static/browser milestone commands only where named; run aggregate `pnpm trust` only during final closure, including the authoritative run on the evidence-amended final commit.
- Preserve unrelated worktree changes. Each task produces one concise final commit; adversarial review fixes and completion-ledger changes amend that same commit rather than adding task-fix commits.
- `docs/project-plans/003-first-class-style-and-layout.md` is the active execution ledger. A task remains `[IN PROGRESS]` through implementation and adversarial review. Only a clean review permits its final same-commit amendment to `[DONE]`, advances the next marker, synchronizes the board, and records the completion session entry.

## Common evidence files for every task

Every Task 1–15 file scope and commit includes both:

- `docs/project-plans/003-first-class-style-and-layout.md`;
- `docs/testing/field-notes/p003-style-layout.md` (created by Task 1, then appended).

At task start, change that step from `[NEXT]` to `[IN PROGRESS]` and synchronize the board. Before the initial implementation commit, record the focused red/green commands and review-relevant observations in the field note, but keep the step and board in progress and do not advance another `[NEXT]` marker. The implementation plus in-progress status/evidence form the adversarial review unit. Fix every review finding by amending the same commit and keep the task in progress through re-review. After a clean review, mark the task `[DONE]`, advance the sole `[NEXT]` marker, synchronize the board, append the completion session log, amend the same commit one final time, and re-review that final task commit before starting the next task. The `git add` snippets below are minimum code scopes and implicitly include both common evidence files.

## Planned file structure

Create focused modules rather than a single style/layout file:

```text
packages/core/src/lib/style/
  types.ts                 public style capability and value types
  normalize.ts             component defaults and shorthand normalization
  resolve-length.ts        finite number/percentage/auto parsing and resolution
  diagnostics.ts           typed style/layout diagnostic creation

packages/core/src/lib/layout/
  types.ts                 Size, Constraints, LayoutBox, placements, algorithms
  context.ts               current containing/allocation box stack
  measure.ts               pure measurement dispatch and services
  place-child.ts           private stable transform/clip placement component
  absolute.ts              absolute containing-box algorithm and component
  overlay.ts               same-box CRC-native algorithm and component
  flow.ts                  CRC-native sequential/wrapping algorithm and component
  flex.ts                  supported CSS Flexbox algorithm and component
  grid.ts                  supported CSS Grid algorithm and component
```

Component-specific style interfaces remain beside their components. Shared pure text wrapping/measurement moves to `components/text-layout.ts`; shared image sizing remains beside `img.ts` because it owns the asynchronous image resource.

---

### Task 1: First-class style-bearing element protocol

**Files:**

- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/create-element.ts`
- Modify: `packages/core/src/lib/define-comp.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: `packages/core/src/lib/hooks/crc-state.test.ts`
- Modify: `packages/core/src/lib/hooks/crc-when-changed.test.ts`
- Modify: `packages/scenarios/src/runtime-hooks.example.ts`
- Modify: `packages/scenarios/src/cleanup-stress.example.ts`
- Modify: every existing two-argument component render callback that reads the Canvas context
- Test: `packages/core/src/lib/runtime-contract.test.ts`
- Test: `playground/package-consumer/index.ts`

**Interfaces:**

- Produces: `SystemStyle`, `ComponentInput<P, S>`, `CompFn<P, S>`, `CompEl<P, S>`.
- Produces: `defineComp<P, S>(render)` factory that accepts programmatic props plus reserved `style` and `key`, stores them separately, and invokes render as `(props, style, ctx)`.
- Preserves: component function identity and keyed/unkeyed identity semantics.

- [ ] **Step 1: Write failing element-protocol tests**

Add a runtime contract proving style/key are descriptor metadata and are not present in render props:

```ts
it("stores style and key separately and passes style before the Canvas context", async () => {
  const calls: unknown[] = [];
  const Probe = defineComp<{ value: number }, { width: number }>(
    (props, style, ctx) => {
      calls.push({ props, style, canvas: ctx.canvas });
    },
  );
  const element = Probe({ value: 7, key: "probe", style: { width: 40 } });

  expect(element).toMatchObject({
    props: { value: 7 },
    style: { width: 40 },
    key: "probe",
  });
  expect("style" in element.props).toBe(false);
  expect("key" in element.props).toBe(false);

  const canvas = document.createElement("canvas");
  crc(canvas, element);
  await nextFrame();
  expect(calls).toEqual([
    { props: { value: 7 }, style: { width: 40 }, canvas },
  ]);
});
```

Also add keyed reorder assertions using the new descriptor-owned key and a layer assertion that changing only `render.style` rerenders the offscreen layer.

- [ ] **Step 2: Run the focused protocol tests and observe RED**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

Expected: failures because `CompEl` has no style/key metadata, render receives `(props, ctx)`, and layer comparison ignores style.

- [ ] **Step 3: Implement the element protocol**

Use these public shapes:

```ts
export interface SystemStyle {
  custom?: unknown;
}

type ReservedElementKey = "key" | "style";
type UnionKeys<T> = T extends unknown ? keyof T : never;
type ProgramProps<P> = 0 extends 1 & P
  ? P
  : Extract<UnionKeys<P>, ReservedElementKey> extends never
    ? P
    : never;

type RequiredKeys<T> = T extends unknown
  ? {
      [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? K : never;
    }[keyof T]
  : never;

type StyleField<S> = [RequiredKeys<S>] extends [never]
  ? { style?: S }
  : { style: S };

export type ComponentInput<
  P,
  S extends SystemStyle = SystemStyle,
> = ProgramProps<P> & { key?: string } & StyleField<S>;

export type CompFn<P, S extends SystemStyle = SystemStyle> = (
  props: ProgramProps<P>,
  style: Readonly<S>,
  ctx: RenderingContext2D,
) => CRCNode[] | CRCNode | void;

export interface CompEl<P = any, S extends SystemStyle = SystemStyle> {
  type: CompFn<P, S>;
  props: ProgramProps<P>;
  style: Readonly<S>;
  key?: string;
}
```

Every accepted style schema must explicitly extend `SystemStyle` or intersect with it. Keep `SystemStyle.custom` optional and do not add an index signature. This positive contract rejects unrelated class/resource types structurally while declared styles accept ordinary object inputs and preserve excess-property checking. `defineComp` rejects any program-prop union containing the reserved `key` or `style` names, extracts those fields from public input, and preserves the exact input reference when neither field is an own property. Add negative union type tests for both collisions, required style, and unrelated resource types. The public type permits style omission only when every style union member has only optional fields; the runtime uses one frozen empty object for omitted untyped JavaScript. During the numeric-only migration Tasks 1–6, specified and render style are the same readonly value. `render` reads `element.key` for identity and calls `element.type(element.props, element.style, ctx)`. Layer root comparison includes type, key, props, and style. Rename existing custom-component data fields called `key`.

Update only callbacks that currently consume the second `ctx` parameter so they consume the third parameter. One-argument render functions require no mechanical edit.

- [ ] **Step 4: Run focused tests and static verification**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: focused tests pass and typecheck reports no two-argument context consumers.

- [ ] **Step 5: Commit**

```sh
git add packages/core/src packages/scenarios/src/runtime-hooks.example.ts packages/scenarios/src/cleanup-stress.example.ts playground/package-consumer/index.ts
git commit -m "refactor(core): add first-class element styles"
```

---

### Task 2: Style capability types and path/rectangle/SVG migration

**Files:**

- Create: `packages/core/src/lib/style/types.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/components/path.ts`
- Modify: `packages/core/src/lib/components/rect.ts`
- Modify: `packages/core/src/lib/components/svg-path.ts`
- Modify: all path/rect/svgPath call sites under `packages/`, `playground/`, and `tooling/`
- Test: `packages/core/src/lib/components/path.test.ts`
- Test: `packages/core/src/lib/components/rect.test.ts`
- Test: `packages/core/src/lib/components/svg-path.test.ts`
- Test: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: Task 1 element protocol.
- Produces: `PaintStyle`, `CursorStyle`, `PathStyle`, `RectStyle`, and `SvgPathStyle`.
- Produces: style-only public calls using `fill`, `stroke`, `strokeWidth`, `opacity`, `cursor`, and `d`.

- [ ] **Step 1: Convert focused tests to the desired style-only API**

Representative expectations:

```ts
const element = rect({
  style: {
    x: 10,
    y: 12,
    width: 40,
    height: 20,
    fill: "#2563eb",
    stroke: "#0f172a",
    strokeWidth: 2,
    opacity: 0.5,
    alignToPixelGrid: "round",
  },
  onClick,
});

// @ts-expect-error visual width is style-only
rect({ x: 10, y: 12, width: 40, height: 20 });
```

Path uses `style.d: Path2D`; SVG path uses `style.d: string`. Move cursor and `lineInteractionWidth` into style while handlers remain props.

- [ ] **Step 2: Run focused tests and observe RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/path.test.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/svg-path.test.ts --browser.headless --browser.ui=false
```

Expected: type/runtime failures because visual values are still top-level legacy props.

- [ ] **Step 3: Implement style types and migrate the three components**

Use exact style names:

```ts
export interface PaintStyle {
  fill?: FillStyle;
  stroke?: StrokeStyle;
  strokeWidth?: number;
  opacity?: number;
}

export interface CursorStyle {
  cursor?: string;
}

export interface PathStyle extends SystemStyle, PaintStyle, CursorStyle {
  d: Path2D;
  lineInteractionWidth?: number;
}

export interface RectStyle extends Omit<PathStyle, "d"> {
  x?: number;
  y?: number;
  width: number;
  height: number;
  alignToPixelGrid?: PixelGridAlignment;
}

export interface SvgPathStyle extends Omit<PathStyle, "d"> {
  d: string;
}
```

`PathProps`, `RectProps`, and `SvgPathProps` retain handlers only. Rectangle `x`/`y` are optional and normalize to zero, while width/height remain required. There is no runtime legacy adapter. Mechanically migrate every call site in the same commit so the repository never has ambiguous dual width/paint sources.

- [ ] **Step 4: Run the focused tests and repository typecheck**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/path.test.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/components/svg-path.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: component behavior remains pixel/interaction compatible and no legacy call site remains.

- [ ] **Step 5: Commit**

```sh
git add packages playground tooling
git commit -m "refactor(components): move paths and rectangles to style"
```

---

### Task 3: Line-family style migration

**Files:**

- Modify: `packages/core/src/lib/components/line.ts`
- Modify: `packages/core/src/lib/components/horizontal-line.ts`
- Modify: `packages/core/src/lib/components/vertical-line.ts`
- Modify: all line-family call sites under `packages/`, `playground/`, and `tooling/`
- Test: `packages/core/src/lib/components/line.test.ts`
- Test: `packages/core/src/lib/components/line-helpers.test.ts`
- Test: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: `PaintStyle` and `CursorStyle` from Task 2.
- Produces: `LineStyle`, `HorizontalLineStyle`, and `VerticalLineStyle`.

- [ ] **Step 1: Convert line tests to style-only calls**

```ts
line({
  style: {
    coords: [
      [0, 0],
      [20, 10],
    ],
    stroke: "#2563eb",
    strokeWidth: 2,
    lineInteractionWidth: 8,
    cursor: "pointer",
  },
  onMouseMove,
});

horizontalLine({ style: { y: 12, x1: 4, x2: 40, stroke: "black" } });
verticalLine({ style: { x: 12, y1: 4, y2: 40, stroke: "black" } });
```

- [ ] **Step 2: Observe focused RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/line.test.ts packages/core/src/lib/components/line-helpers.test.ts --browser.headless --browser.ui=false
```

Expected: line-family styles and renamed paint properties do not exist.

- [ ] **Step 3: Implement and mechanically migrate all line calls**

`LineStyle.coords`, horizontal `y/x1/x2`, vertical `x/y1/y2`, pixel alignment, paint, cursor, and interaction width are visual style. `x1` and `y1` default to zero; `x2` and `y2` default to the current allocation width and height. Event handlers remain props. Reuse the Task 2 internal `Path` renderer with separate props/style arguments rather than reconstructing legacy prop objects.

- [ ] **Step 4: Run focused tests and typecheck**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/line.test.ts packages/core/src/lib/components/line-helpers.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

- [ ] **Step 5: Commit**

```sh
git add packages playground tooling
git commit -m "refactor(components): move lines to style"
```

---

### Task 4: Text style migration and shared text-layout utility

**Files:**

- Create: `packages/core/src/lib/components/text-layout.ts`
- Test: `packages/core/src/lib/components/text-layout.test.ts`
- Modify: `packages/core/src/lib/components/text.ts`
- Modify: all text call sites under `packages/`, `playground/`, and `tooling/`
- Test: `packages/core/src/lib/components/text.test.ts`

**Interfaces:**

- Produces: `TextStyle`.
- Produces: pure `resolveTextLayout(measureText, style)` returning literal line text, baselines, and measured bounds shared by paint and later measurement.

- [ ] **Step 1: Write failing pure text-layout and component tests**

Use this public style shape:

```ts
text({
  style: {
    text: "Hello Canvas",
    x: 20,
    y: 24,
    width: 180,
    height: 60,
    lineHeight: 18,
    wrap: true,
    fit: "ellipsis",
    font: "16px sans-serif",
    textAlign: "left",
    textBaseline: "top",
    fill: "#111827",
  },
  onClick,
});
```

`fit` is CRC-native (`'visible' | 'squish' | 'ellipsis' | 'clip'`) because the complete existing behavior is not CSS `overflow`/`text-overflow`. The pure utility test uses a literal `measureText` table and asserts exact lines and y positions for wrap and ellipsis.

- [ ] **Step 2: Observe focused RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/text-layout.test.ts packages/core/src/lib/components/text.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Extract shared layout logic and migrate text**

Move wrapping, ellipsis, aligned-left, baseline-top, and measured interaction bounds into the pure utility. Replace `maxWidth/maxHeight/wordWrap/overflow` with `width/height/wrap/fit`. Move text, typography, paint, opacity, cursor, and geometry into `TextStyle`; handlers remain props. Text `x`/`y` become optional and normalize to zero.

- [ ] **Step 4: Run focused tests and typecheck**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/text-layout.test.ts packages/core/src/lib/components/text.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

- [ ] **Step 5: Commit**

```sh
git add packages playground tooling
git commit -m "refactor(text): make text rendering style-driven"
```

---

### Task 5: Image style migration

**Files:**

- Modify: `packages/core/src/lib/components/img.ts`
- Modify: all image call sites under `packages/`, `playground/`, and `tooling/`
- Test: `packages/core/src/lib/components/img.test.ts`
- Test: `packages/core/src/lib/components/img-async.test.ts`

**Interfaces:**

- Produces: `ImgStyle` with `src`, geometry, paint-border, opacity, cursor, and pixel alignment.
- Preserves: image load/error/source-race/removal ownership and explicit-dimension behavior.

- [ ] **Step 1: Convert image tests to style-only calls**

```ts
img({
  style: {
    src: fixtureUrl,
    x: 10,
    y: 12,
    width: 80,
    height: 60,
    opacity: 0.8,
    stroke: "#0f172a",
    strokeWidth: 1,
    alignToPixelGrid: "round",
    cursor: "pointer",
  },
  onClick,
});
```

- [ ] **Step 2: Observe focused RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/img.test.ts packages/core/src/lib/components/img-async.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement `ImgStyle` and migrate calls**

Keep the async resource lifecycle in props-independent component state, keyed by `style.src`. Image `x`/`y` become optional and normalize to zero. Explicit style dimensions produce geometry before load and after failure; natural dimensions remain zero until successful load.

- [ ] **Step 4: Run focused tests and typecheck**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/img.test.ts packages/core/src/lib/components/img-async.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

- [ ] **Step 5: Commit**

```sh
git add packages playground tooling
git commit -m "refactor(image): move image rendering to style"
```

---

### Task 6: Transform, clip, layer migration and style-protocol closure

**Files:**

- Modify: `packages/core/src/lib/components/g.ts`
- Modify: `packages/core/src/lib/components/clip.ts`
- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types.ts`
- Modify: all g/clip/layer call sites under `packages/`, `playground/`, and `tooling/`
- Test: `packages/core/src/lib/components/g.test.ts`
- Test: `packages/core/src/lib/components/clip.test.ts`
- Test: `packages/core/src/lib/components/layer.test.ts`
- Test: `playground/package-consumer/index.ts`

**Interfaces:**

- Produces: `GStyle`, `ClipStyle`, `LayerStyle` and final public style exports.
- Removes: visual `IntrinsicProps`, `AlphaProps`, `FillStyleProps`, `StrokeStyleProps`, and `CursorStyleProps` legacy mixins.

- [ ] **Step 1: Convert focused composition tests to styles**

```ts
g({
  style: {
    translateX: 20,
    translateY: 10,
    scaleX: 2,
    scaleY: 2,
    rotationDegrees: 15,
    rotationOrigin: [10, 10],
    skewX: 5,
    skewY: 0,
  },
  children: [rect({ style: { x: 0, y: 0, width: 10, height: 10 } })],
});

clip({ style: { d: path, fillRule: "evenodd" }, children: [child] });
layer({ style: { width: 200, height: 100 }, render: child });
```

- [ ] **Step 2: Observe focused RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement composition styles and remove legacy visual mixins**

Transform order remains scale, rotation about origin, translate, skew to preserve current behavior. Degree-valued rotation uses CRC-native `rotationDegrees`/`rotationOrigin`, not CSS `rotate`. `children` and layer `render` remain structural props. Layer shallow comparison includes both child props and child style. Export every public component style type from `@crc/core`.

- [ ] **Step 4: Run the style-migration milestone**

```sh
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint:code
corepack pnpm@11.21.0 test:ci
corepack pnpm@11.21.0 test:package-consumer:packed
```

Expected: all legacy behavior tests and strict consumers pass against style-only built-ins. This is the first broad milestone; do not run aggregate trust yet.

- [ ] **Step 5: Commit**

```sh
git add packages playground tooling
git commit -m "refactor(core): complete style-only component API"
```

---

### Task 7: Lengths, constraints, edges, and box resolution

**Files:**

- Create: `packages/core/src/lib/style/resolve-length.ts`
- Create: `packages/core/src/lib/style/resolve-length.test.ts`
- Create: `packages/core/src/lib/style/normalize.ts`
- Create: `packages/core/src/lib/style/diagnostics.ts`
- Create: `packages/core/src/lib/layout/types.ts`
- Create: `packages/core/src/lib/layout/box.ts`
- Create: `packages/core/src/lib/layout/box.test.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces: `Length = number | Percentage | 'auto'`, `Size`, `Constraints`, `LayoutBox`, `Edges`, `BoxStyle`, `ResolvedBoxStyle`, and optional `LayoutItemStyle`.
- Produces: `resolveLength`, `normalizeEdges`, `resolveBox`.

- [ ] **Step 1: Write failing pure resolution fixtures**

Use hand-derived literal cases:

```ts
expect(resolveLength(24, 300, "width")).toBe(24);
expect(resolveLength("25%", 300, "width")).toBe(75);
expect(resolveLength("auto", 300, "width")).toBeUndefined();
expect(() => resolveLength(Number.NaN, 300, "width")).toThrow(/width.*finite/);
expect(() => resolveLength("12px", 300, "width")).toThrow(/unsupported.*12px/);

expect(
  resolveBox(
    { width: "50%", height: 40, minWidth: 180, padding: 10 },
    { minWidth: 0, maxWidth: 320, minHeight: 0, maxHeight: 200 },
  ),
).toEqual({
  borderBox: { x: 0, y: 0, width: 200, height: 60 },
  contentBox: { x: 10, y: 10, width: 180, height: 40 },
});
```

- [ ] **Step 2: Observe pure RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/style/resolve-length.test.ts packages/core/src/lib/layout/box.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement exact value and box semantics**

Use these exact public participation shapes:

```ts
type Percentage = `${number}%`;
type Length = number | Percentage | "auto";
type EdgeValues =
  | number
  | Readonly<{
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    }>;

interface BoxStyle extends SystemStyle {
  width?: Length;
  height?: Length;
  minWidth?: Exclude<Length, "auto">;
  maxWidth?: Exclude<Length, "auto">;
  minHeight?: Exclude<Length, "auto">;
  maxHeight?: Exclude<Length, "auto">;
  padding?: EdgeValues;
  overflow?: "visible" | "clip";
}

interface LayoutItemStyle {
  left?: Exclude<Length, "auto">;
  top?: Exclude<Length, "auto">;
  alignSelf?:
    "auto" | "start" | "end" | "center" | "stretch" | "flex-start" | "flex-end";
  justifySelf?: "auto" | "start" | "end" | "center" | "stretch";
  flexBasis?: Length;
  flexGrow?: number;
  flexShrink?: number;
  gridColumnStart?: number;
  gridColumnSpan?: number;
  gridRowStart?: number;
  gridRowSpan?: number;
}
```

Task 8 intersects every public element style with this optional participation capability. Requiredness is imposed by the owning parent algorithm at runtime, so ordinary elements do not require Grid coordinates. Parent-specific exported aliases narrow the accepted values while runtime parent validation handles concrete element styles. No concrete interface redeclares `alignSelf` incompatibly.

Support finite numbers, decimal percentages, and `auto`. Width/height describe the content box; min/max clamp it before numeric padding is added. Percentages are accepted for sizes and offsets, not padding or gap. Layout dimensions, constraints, padding, and gaps are nonnegative; `min > max` throws; overlarge padding reduces allocated content to zero. Margin is deferred. Preserve signed primitive Canvas geometry outside layout, but reject it when consumed as an allocation. Produce diagnostics containing component, property, supplied value, algorithm, and constraints.

This commit exposes the pure value/box vocabulary and resolvers without widening any built-in component input. Consequently, no reviewed intermediate commit can type-accept a percentage and pass it to numeric Canvas code.

- [ ] **Step 4: Run pure tests and typecheck**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/style/resolve-length.test.ts packages/core/src/lib/layout/box.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

- [ ] **Step 5: Commit**

```sh
git add packages/core/src
git commit -m "feat(layout): resolve lengths and boxes"
```

---

### Task 8: Layout context, resolved styles, placement, and geometry observation

**Files:**

- Create: `packages/core/src/lib/layout/context.ts`
- Create: `packages/core/src/lib/layout/place-child.ts`
- Create: `packages/core/src/lib/layout/place-child.test.ts`
- Create: `packages/core/src/lib/hooks/crc-layout-box.ts`
- Modify: `packages/core/src/lib/global-state.ts`
- Modify: `packages/core/src/lib/execute-render.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/define-comp.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Modify: every public built-in component style interface under `packages/core/src/lib/components/`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/lib/runtime-contract.test.ts`

**Interfaces:**

- Produces: private `PlacedChild` component with `{ element, box, clipInChildSpace, identityHint }` props.
- Produces: `crcLayoutBox(): Readonly<LayoutBox>` returning the current allocation in child-local coordinates.
- Produces: root layout context from intrinsic Canvas dimensions.

- [ ] **Step 1: Write failing placement, identity, and observation tests**

Create a placed interactive rectangle at `{ x: 40, y: 30, width: 80, height: 20 }`. Also mount a root rectangle at `width: '50%'` on a 300-pixel Canvas. Assert:

```ts
expect(observedBox).toEqual({ x: 0, y: 0, width: 80, height: 20 });
expect(ctx.getTransform().e).toBe(40);
expect(ctx.getTransform().f).toBe(30);
expect(rootPaintWidth).toBe(150);
```

Drive a click at root coordinates `(50, 35)` and assert the child handler fires. Reflow the same keyed child to x `60` and assert its `crcState` value remains. Add an unkeyed `A/B/A` fixture and prove inserting/removing `B` does not shift the two `A` identities. Remove a child and assert observation cleanup and interaction-region release exactly once.

- [ ] **Step 2: Observe focused RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/place-child.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement layout context and stable placement**

Atomically introduce distinct `SpecifiedStyle<S>`, `NormalizedStyle<N>`, and component-specific finite `ResolvedStyle<R>` types plus optional non-enumerable `normalizeStyle(specified)` and `resolveStyle(normalized, context)` capabilities. In this same commit, intersect every public element style with optional `LayoutItemStyle`, widen box-shaped specified sizes and local offsets to `Length`, add component resolvers, and switch dispatch before any percentage-capable API is reviewable. Local `x`/`y` stay optional with zero defaults and accept number/percentage but not `auto`.

Add a stack to global temporary render state and restore it across nested/layer renders. Root context is `{ x: 0, y: 0, width: canvas.width, height: canvas.height }`. Before invoking a component, render dispatch calls its `normalizeStyle` and `resolveStyle` capabilities with the immutable specified style and current allocation; the callback receives only its finite component-specific resolved style. Missing capabilities are identity and therefore valid only for styles containing no defaults or allocation-dependent values. An unresolved percentage/`auto` is rejected before the Canvas callback.

`PlacedChild` is one module-level component type, applies `ctx.translate(box.x, box.y)`, pushes a local `{ x: 0, y: 0, width, height }` allocation, applies a CRC-managed rectangular clip in child space when supplied, renders the original child, and restores in `finally`. Its private identity hint is derived from the original child type, canonical key, and same-type occurrence so the wrapper does not alter existing identity rules.

`crcLayoutBox` reads the current local allocation and returns a stable readonly value for unchanged geometry. It does not schedule rendering by itself.

- [ ] **Step 4: Run focused tests and lifecycle checks**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/place-child.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:lifecycle
```

- [ ] **Step 5: Commit**

```sh
git add packages/core/src packages/core/test
git commit -m "feat(layout): add layout context and placement"
```

---

### Task 9: Absolute and overlay formatting contexts

**Files:**

- Create: `packages/core/src/lib/layout/absolute.ts`
- Create: `packages/core/src/lib/layout/absolute.test.ts`
- Create: `packages/core/src/lib/layout/overlay.ts`
- Create: `packages/core/src/lib/layout/overlay.test.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/scenarios/src/layout-foundation.example.ts`
- Modify: `packages/scenarios/src/index.ts`
- Test: `packages/core/test/layout-foundation.test.ts`

**Interfaces:**

- Produces: public `absolute`, `AbsoluteStyle`, `overlay`, `OverlayStyle`.
- Produces: shared public scenario `mountLayoutFoundation(canvas)` for subsequent layout tasks.

- [ ] **Step 1: Write failing pure and public-API tests**

Use these exact container contracts:

```ts
type AbsoluteStyle = BoxStyle;

interface OverlayStyle extends BoxStyle {
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyItems?: "start" | "center" | "end" | "stretch";
}
```

An omitted container width/height consumes the current allocation. `padding` defaults to zero and `overflow` to `visible`. Absolute children use optional parent-consumed `left`/`top` defaulting to zero; primitive `x`/`y` remain local paint geometry. Each child needs definite or measurable width/height. Overlay defaults both axes to `stretch`; child `alignSelf`/`justifySelf` override with `'start' | 'center' | 'end' | 'stretch'` (or `'auto'` to use the container).

Literal overlay fixture for a `200 × 100` content box and a `40 × 20` centered child:

```ts
expect(placeOverlayChild(container, child)).toEqual({
  x: 80,
  y: 40,
  width: 40,
  height: 20,
});
```

The browser scenario nests overlay inside absolute, clicks the visually topmost overlapping child, then resizes the root allocation and asserts pixel/hit agreement.

For an oversized centered child, centering remains mathematical and may produce a negative local offset. `overflow: 'visible'` paints it; `overflow: 'clip'` clips paint and interaction to the container content box. Stretch never creates a negative size: the available axis clamps to zero.

- [ ] **Step 2: Observe RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/absolute.test.ts packages/core/src/lib/layout/overlay.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement both CRC-native algorithms and scenario**

Both algorithms inspect direct child descriptors only, resolve box styles, and return `PlacedChild` elements in source order. `absolute` establishes a containing box; `overlay` allocates from the same content box. `overflow: 'visible' | 'clip'` controls placement clipping and has no scrolling behavior.

- [ ] **Step 4: Run focused tests and typecheck**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/absolute.test.ts packages/core/src/lib/layout/overlay.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

- [ ] **Step 5: Commit**

```sh
git add packages/core packages/scenarios
git commit -m "feat(layout): add absolute and overlay contexts"
```

---

### Task 10: Pure measurement protocol and CRC-native flow

**Files:**

- Create: `packages/core/src/lib/layout/measure.ts`
- Create: `packages/core/src/lib/layout/measure.test.ts`
- Create: `packages/core/src/lib/layout/flow.ts`
- Create: `packages/core/src/lib/layout/flow.test.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/define-comp.ts`
- Modify: `packages/core/src/lib/components/text-layout.ts`
- Modify: `packages/core/src/lib/components/text.ts`
- Modify: `packages/core/src/lib/components/img.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/scenarios/src/layout-foundation.example.ts`
- Test: `packages/core/test/layout-foundation.test.ts`

**Interfaces:**

- Produces: `MeasureInput<P, S>`, `MeasureResult`, optional component-type `measure` capability, `measureElement`.
- Produces: public `flow` and `FlowStyle`.

- [ ] **Step 1: Write failing measurement and flow fixtures**

Measurement must not invoke render:

```ts
let renders = 0;
const Measured = defineComp(
  () => {
    renders++;
  },
  {
    measure: () => ({
      status: "measured",
      size: { width: 40, height: 20 },
    }),
  },
);
expect(measureElement(Measured({}), constraints, service)).toEqual({
  status: "measured",
  size: { width: 40, height: 20 },
});
expect(renders).toBe(0);
```

Define CRC-native flow exactly:

```ts
interface FlowStyle extends BoxStyle {
  direction?: "horizontal" | "vertical";
  wrap?: boolean;
  gap?: number;
  lineGap?: number;
  alignItems?: "start" | "center" | "end" | "stretch";
}
```

- `direction` defaults to `horizontal`;
- `wrap` defaults false;
- `gap` and `lineGap` are finite nonnegative numbers defaulting to zero;
- source-order placement;
- a child wraps before placement when its outer main size would exceed the finite content bound and the current line is nonempty;
- each line's cross size is its largest child;
- `alignItems` defaults to `start`.

Add literal horizontal and vertical wrapped placement fixtures.

- [ ] **Step 2: Observe RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/measure.test.ts packages/core/src/lib/layout/flow.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement pure measurement and flow**

Extend the Task 7 component capabilities with optional pure measurement, also stored as non-enumerable metadata on the callable render function:

```ts
defineComp<P, S>(render, {
  normalizeStyle: (style: Readonly<S>) => normalizedStyle,
  resolveStyle: (style, context) => resolvedStyle,
  measure: (input: MeasureInput<P, S>) => measureResult,
});
```

Measurement receives programmatic props, normalized style, constraints, and a Canvas measurement service; it cannot access hooks/global render ownership. `MeasureResult` is `{ status: 'measured'; size: Size } | { status: 'unsupported'; reason: string }`. Text uses `resolveTextLayout`. Image measurement supports explicit dimensions only; natural image measurement is deferred because loading currently begins during render and pure measurement cannot own the resource. Definite boxes bypass measurement.

Implement flow as a pure placement algorithm plus a dedicated layout component. Unsupported required `auto` produces a diagnostic naming the child and axis.

- [ ] **Step 4: Run the layout-foundation milestone**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

- [ ] **Step 5: Commit**

```sh
git add packages/core packages/scenarios
git commit -m "feat(layout): add measurement and flow"
```

---

### Task 11: CSS-compatible flex subset

**Files:**

- Create: `packages/core/src/lib/layout/flex.ts`
- Create: `packages/core/src/lib/layout/flex.test.ts`
- Create: `packages/core/test/flex-css-compatibility.test.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/scenarios/src/layout-foundation.example.ts`
- Test: `packages/core/test/layout-foundation.test.ts`

**Interfaces:**

- Produces: public `flex`, `FlexStyle`, and `FlexItemStyle` capability fields on child styles.

- [ ] **Step 1: Write failing hand-derived Flexbox fixtures**

Support this exact initial matrix:

```ts
interface FlexStyle extends BoxStyle {
  flexDirection?: "row" | "column";
  flexWrap?: "nowrap" | "wrap";
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "stretch" | "flex-start" | "flex-end" | "center";
  alignContent?:
    | "stretch"
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  gap?: number;
  rowGap?: number;
  columnGap?: number;
}

type FlexItemStyle = Pick<
  LayoutItemStyle,
  "flexBasis" | "flexGrow" | "flexShrink"
> & {
  alignSelf?: "auto" | "stretch" | "flex-start" | "flex-end" | "center";
};
```

- `flexDirection`: `row | column`;
- `flexWrap`: `nowrap | wrap`;
- `justifyContent`: `flex-start | flex-end | center | space-between | space-around | space-evenly`;
- `alignItems`: `stretch | flex-start | flex-end | center`;
- item `alignSelf`: `auto | stretch | flex-start | flex-end | center`;
- `alignContent`: `stretch | flex-start | flex-end | center | space-between | space-around | space-evenly`;
- `flexBasis`: definite number/percentage or resolvable `auto`;
- `flexGrow` nonnegative, `flexShrink` nonnegative;
- `gap`, `rowGap`, `columnGap` nonnegative;
- explicit min/max clamping and source order.

Defaults match CSS for the accepted subset: row, nowrap, flex-start main alignment, stretch item/content alignment, zero gaps, item grow `0`, shrink `1`, and basis `auto`. Because automatic content-based minimum sizes are deferred, every row item using shrink or measured/auto basis must explicitly supply `minWidth` (normally `0`), and the column equivalent must supply `minHeight`; reject rather than approximate when it is absent.

Fixtures must include: sufficient grow, proportional shrink, min/max freeze and redistribution, row and column directions, wrapping into two lines, multi-line `alignContent`, stretch, insufficient negative free space, and zero total grow/shrink. Expected boxes are literal arrays, not computed by shared helpers. Add Chromium DOM-oracle cases using `box-sizing: content-box` and the same explicit minimums for every accepted behavior family.

- [ ] **Step 2: Observe flex RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/flex.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement the supported CSS algorithm**

Implement line collection, hypothetical main sizes, flexible-length resolution with freezing, cross-size calculation, main/cross alignment, and wrapped-line `alignContent` as isolated pure functions in `flex.ts`. Reject reverse directions, `wrap-reverse`, `order`, baseline alignment, auto margins, percentage gaps, missing required explicit main-axis minimums, and unresolved intrinsic `auto`; do not approximate them.

The public component resolves direct child outer styles, invokes measurement only for required `auto`, and emits stable placements in the CSS-required visual/source order supported by the matrix. Do not reorder interaction independently from paint.

- [ ] **Step 4: Run focused flex checks**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/flex.test.ts packages/core/test/flex-css-compatibility.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

- [ ] **Step 5: Commit**

```sh
git add packages/core packages/scenarios
git commit -m "feat(layout): add CSS-compatible flex"
```

---

### Task 12: CSS-compatible explicit grid subset

**Files:**

- Create: `packages/core/src/lib/layout/grid.ts`
- Create: `packages/core/src/lib/layout/grid.test.ts`
- Create: `packages/core/test/grid-css-compatibility.test.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/scenarios/src/layout-foundation.example.ts`
- Test: `packages/core/test/layout-foundation.test.ts`

**Interfaces:**

- Produces: public `grid`, `GridStyle`, `GridTrack`, and child grid-placement style fields.

- [ ] **Step 1: Write failing explicit-grid fixtures**

Support this exact initial matrix:

```ts
type GridTrack = number | `${number}%` | `${number}fr`;
interface GridStyle extends BoxStyle {
  gridTemplateColumns: readonly GridTrack[];
  gridTemplateRows: readonly GridTrack[];
  justifyItems?: "stretch" | "start" | "center" | "end";
  alignItems?: "stretch" | "start" | "center" | "end";
  gap?: number;
  rowGap?: number;
  columnGap?: number;
}

interface GridItemStyle extends SystemStyle {
  gridColumnStart?: number;
  gridColumnSpan?: number;
  gridRowStart?: number;
  gridRowSpan?: number;
  alignSelf?: "auto" | "stretch" | "start" | "center" | "end";
  justifySelf?: "auto" | "stretch" | "start" | "center" | "end";
}
```

- nonempty explicit `gridTemplateColumns` and `gridTemplateRows` arrays;
- every child has one-based positive `gridColumnStart` and `gridRowStart` plus positive optional spans;
- fixed, percentage, and fractional free-space tracks;
- `gap`, `rowGap`, `columnGap`;
- `justifyItems`/`alignItems` and per-child self overrides using `stretch | start | center | end`;
- finite explicit container bounds.

Placement fields stay optional in the shared child style so non-Grid elements remain ergonomic; Grid rejects a child missing either required start. Spans default to one. Container/item alignment defaults to `stretch`. A span ending beyond the explicit track list is unsupported and throws; no implicit tracks are created.

Literal fixtures cover mixed fixed/percentage/fr tracks, a total fractional factor below one, spans, overlapping explicitly placed children in source paint/target order, insufficient space with fr tracks clamped to zero, and alignment within a grid area. Add Chromium DOM-oracle cases for fixed/percentage/fr allocation, `<1fr`, spans, gaps, overlap, and alignment.

- [ ] **Step 2: Observe grid RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout/grid.test.ts packages/core/test/grid-css-compatibility.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement explicit Grid behavior**

Parse tracks once, subtract fixed/percentage tracks and gaps, and distribute nonnegative remaining space with the CSS flex fraction `remaining / max(1, totalFr)`, leaving unused space when the total factor is below one. Resolve explicit placements and spans, preserve CSS-permitted overlap in source paint/target order, then align child boxes inside grid areas. Defer auto placement, auto/content/minmax/repeat/subgrid/dense placement with explicit unsupported diagnostics.

- [ ] **Step 4: Run the algorithm milestone**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/layout packages/core/test/flex-css-compatibility.test.ts packages/core/test/grid-css-compatibility.test.ts packages/core/test/layout-foundation.test.ts packages/core/test/geometry-composition.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 test:performance
```

- [ ] **Step 5: Commit**

```sh
git add packages/core packages/scenarios
git commit -m "feat(layout): add CSS-compatible grid"
```

---

### Task 13: Public learning examples, nested proving scenarios, and Studio types

**Files:**

- Create: `packages/scenarios/src/learning/layout/absolute-and-overlay.example.ts`
- Create: `packages/scenarios/src/learning/layout/flow.example.ts`
- Create: `packages/scenarios/src/learning/layout/flex.example.ts`
- Create: `packages/scenarios/src/learning/layout/grid.example.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/learning-types.ts`
- Modify: `packages/scenarios/src/layout-foundation.example.ts`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `playground/package-consumer/index.ts`
- Modify: `docs/scenario-index.md`
- Test: `packages/core/test/learning-examples.test.ts`
- Test: `packages/core/test/scenario-catalog.test.ts`
- Test: `packages/core/test/layout-foundation.test.ts`

**Interfaces:**

- Consumes: all public style/layout exports.
- Produces: four canonical learner routes and one exhaustive nested test laboratory.

- [ ] **Step 1: Add failing catalog and strict-consumer expectations**

Require exactly one learner route for each layout family grouping, type-clean source imports from `@crc/core`, mount/dispose behavior, and strict public types for styles, percentage lengths, flex/grid configuration, and `crcLayoutBox`.

The exhaustive nested scenario must include:

- flex containing grid containing overlay;
- percent resize from `720 × 420` to `480 × 360`;
- clipped overflow and topmost target selection;
- keyed state retained across reflow;
- text measurement and an explicit-size image;
- exact observed layout boxes before and after resize.

- [ ] **Step 2: Observe public integration RED**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:package-consumer
```

- [ ] **Step 3: Implement examples, catalog entries, declarations, and generated index**

Each learner example uses `export default function mount(canvas): CRCController`, imports only `@crc/core`, exposes exactly two objectives, and uses no test-only diagnostics. Keep the exhaustive scenario in the test catalog. Regenerate `docs/scenario-index.md` with the repository tool.

- [ ] **Step 4: Run public integration milestone**

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 5: Commit**

```sh
git add packages playground docs/scenario-index.md
git commit -m "feat(examples): teach and prove CRC layout"
```

---

### Task 14: Composition, diagnostics, ownership, and structural performance hardening

**Files:**

- Modify: `packages/core/test/geometry-composition.test.ts`
- Modify: `packages/core/test/interaction-dispatch.test.ts`
- Modify: `packages/core/test/lifecycle-ownership.test.ts`
- Modify: `packages/core/test/runtime-cleanup-stress.test.ts`
- Modify: `packages/core/test/event-performance.test.ts`
- Modify: `packages/core/test/layout-foundation.test.ts`
- Modify: relevant `packages/core/src/lib/layout/*.ts` files only when a new failing hardening test exposes a defect

**Interfaces:**

- Produces: deterministic evidence that layout composes with transforms, clips, layers, failures, interaction, and cleanup.
- Produces: structural layout/measurement/placement counters used only by diagnostics and tests, not wall-clock correctness.

- [ ] **Step 1: Add failing hardening tests one behavior at a time**

Cover literal cases for:

- nested layout under translated/scaled `g`;
- layout inside `clip` and `layer` with matching hit geometry;
- fractional and negative local offsets;
- duplicate keys and render failure cleanup;
- 1,000 resize/reflow cycles with stable owned-resource counts;
- a 100,000-record application-owned visible window with mounted/layout/region counts bounded by visible items plus fixed overscan;
- invalid percentage, non-finite value, unresolved auto, and invalid grid line/span diagnostics containing component, property, value, algorithm, and constraints.

Each production fix starts only after its focused test is observed failing for the intended reason.

- [ ] **Step 2: Run the focused failing test before each fix**

Use the owning file rather than the whole suite, for example:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Fix only defects exposed by the hardening matrix**

Keep algorithms pure and diagnostics deterministic. Add counters at algorithm dispatch/measurement/placement boundaries; do not add caching, dirty graphs, spatial indexes, workers, or timing gates.

- [ ] **Step 4: Run hardening milestone**

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/geometry-composition.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/lifecycle-ownership.test.ts packages/core/test/runtime-cleanup-stress.test.ts packages/core/test/event-performance.test.ts packages/core/test/layout-foundation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

- [ ] **Step 5: Commit**

```sh
git add packages/core
git commit -m "test(layout): harden composition and ownership"
```

---

### Task 15: Public contracts, migration documentation, and final trust closure

**Files:**

- Create: `docs/design/style-system-contract.md`
- Create: `docs/design/layout-system-contract.md`
- Modify: `docs/testing/field-notes/p003-style-layout.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/mouse-interaction-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `docs/library-status.md`
- Modify: `docs/project-plans/README.md`
- Modify: `docs/project-plans/003-first-class-style-and-layout.md`
- Modify: `docs/follow-ups.md`
- Modify: `docs/documentation-follow-up.md`

**Interfaces:**

- Produces: normative supported-property matrices, migration guide, honest boundaries, and recorded verification evidence.
- Completes: Plan 003 only after fresh aggregate verification succeeds.

- [ ] **Step 1: Write the public contracts and migration guide**

Document:

- style-only before/after examples for every built-in;
- no cascade/inheritance and explicit object-spread reuse;
- number/percentage/auto rules;
- exact absolute/overlay/flow/flex/grid support matrices and rejected values;
- declared-box versus paint-overflow semantics;
- measurement purity and custom-component requirements;
- identity, paint/target order, clipping, layers, failure, and teardown;
- deliberate exclusions: CSS parsing, selectors, scrolling, pointer/touch,
  keyboard/focus, full intrinsic CSS sizing, advanced Grid, and retained rendering.

- [ ] **Step 2: Verify documentation consistency before the provisional commit**

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 lint:format
git diff --check
```

Search for stale public legacy examples and remove them:

```sh
rg -n -U --pcre2 '(?s)rect\(\{\s*(?:(?!style\s*:).){0,500}\b(?:x|y|width|height|fillStyle|strokeStyle|lineWidth|alpha)\s*:|text\(\{\s*(?:(?!style\s*:).){0,500}\b(?:text|x|y|maxWidth|maxHeight|wordWrap|overflow|fillStyle|alpha)\s*:' README.md docs packages/core/README.md playground/package-consumer
rg -n '\b(fillStyle|strokeStyle|lineWidth|alpha|wordWrap|maxWidth|maxHeight)\s*:' README.md docs/design packages/core/README.md playground/package-consumer
```

Expected: no supported example uses legacy top-level visual props.

- [ ] **Step 3: Create the provisional documentation commit**

```sh
git add README.md packages/core/README.md docs
git commit -m "docs(layout): publish style and layout contracts"
```

- [ ] **Step 4: Run the complete important checks, record evidence, and amend**

Provision Chromium if the environment lacks it, then run:

```sh
corepack pnpm@11.21.0 trust
```

Also run the controlled structural/reference command once without turning timing into a default gate:

```sh
VITE_CRC_REPORT_PERF=1 corepack pnpm@11.21.0 test:performance:reference
```

Expected: aggregate trust exits zero; supported behavior has no skips; only the two documented opt-in timing tests remain conditional; performance output is finite and recorded without enforcing environment-sensitive budgets.

- [ ] **Step 5: Record exact fresh evidence, complete Plan 003, and prove the final commit**

Record Node, pnpm, browser versions, command results, file/test/pass/skip counts, package/build/visual/lifecycle/performance outcomes, known platform warnings, and any accepted limitation in the field note and plan session log. Mark every Plan 003 step done only when its completion bar has fresh evidence; leave no active `[NEXT]` marker when the plan is complete. Amend the provisional documentation commit with that evidence.

Because the evidence amend changes the commit after the first aggregate run, run the authoritative aggregate gate again on the amended final commit, followed by the cheap consistency checks:

```sh
corepack pnpm@11.21.0 trust
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 lint:format
git show --check --oneline HEAD
```

Expected: the final commit itself passes aggregate trust and documentation consistency before adversarial review.

---

## Completion requirements

Implementation is complete only when:

1. All fifteen task commits exist and each has a clean adversarial task review or reviewed fix round.
2. A final whole-branch adversarial review finds no Critical or Important issue, or one final reviewed fix wave resolves every such issue.
3. Fresh aggregate `corepack pnpm@11.21.0 trust` succeeds on the final commit.
4. The completion audit maps every design acceptance criterion to current code/test/document evidence.
5. The final branch contains no unintended changes from the user's original dirty worktree.
