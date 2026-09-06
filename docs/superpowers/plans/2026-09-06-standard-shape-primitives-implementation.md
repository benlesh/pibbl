# Standard Shape Primitives Implementation Plan

> **Historical status: IMPLEMENTED PLAN.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public `Circle`, `Ellipse`, `Arc`, `Wedge`, and `Polygon` drawing primitives with percentage-aware geometry, deterministic validation, shared paint/interaction behavior, examples, documentation, and complete trust evidence.

**Architecture:** Each shape is a focused `definePrimitive` component that creates immediate `Path2D` geometry and delegates paint and coordinate targeting to `renderPath`. Small private helpers resolve nonnegative lengths and finite scalar values; circle/ellipse, arc/wedge, and polygon keep their distinct path and keyboard-bound calculations isolated. No retained geometry, path cache, intrinsic measurement, or visualization abstraction is introduced.

**Tech Stack:** TypeScript 7, Canvas 2D `Path2D`, CRC JSX/createElement runtime, Vitest Browser with Playwright Chromium, pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-09-06-standard-shape-primitives-design.md`

## Global Constraints

- Preserve unrelated working-tree changes and untracked files.
- Public authors import only from `@crc/core`; no public source or `lib/*` imports.
- Geometry and paint live under local `style`; events remain props.
- `Circle`, `Ellipse`, `Arc`, `Wedge`, and `Polygon` are drawing leaves with no intrinsic measurement.
- `Arc` is stroke-only; the other four shapes support fill and stroke.
- Percent bases are width for `cx`/`radiusX`, height for `cy`/`radiusY`, and the smaller basis dimension for circular `radius`.
- Angles and ellipse rotation are finite radians; arc direction and full-turn rules match the HTML Canvas specification.
- Negative radii fail with `LayoutDiagnostic`; zero radii and zero spans are safe empty geometry.
- `Wedge` has no `innerRadius`; a full-circle wedge has no radial stroke seam.
- `Polygon` reuses `coords: [number, number][]`, closes paths, validates finite coordinates, and treats fewer than three points as empty.
- No new dependency, retained scene graph, public path builder, pixel-grid behavior, rounded rectangle, smoothing, or chart API.
- Add failing tests before production code and use semantic/geometry evidence before visual evidence.

---

### Task 1: Shared scalar and radius resolution

**Files:**

- Create: `packages/core/src/lib/components/shape-style.ts`
- Create: `packages/core/src/lib/components/shape-style.test.ts`

**Interfaces:**

- Consumes: `resolveRequiredLength`, `layoutDiagnostic`, `Length`, and `StyleResolutionContext`.
- Produces:
  - `resolveNonnegativeShapeLength(value, reference, property, context): number`
  - `resolveFiniteShapeNumber(value, property, context): number`
  - `circularPercentageBasis(context): number`

- [ ] **Step 1: Write failing helper tests**

```ts
const context: StyleResolutionContext = {
  allocation: { x: 0, y: 0, width: 300, height: 180 },
  percentageBasis: { x: 0, y: 0, width: 300, height: 180 },
  constraints: { minWidth: 0, maxWidth: 300, minHeight: 0, maxHeight: 180 },
  component: "Circle",
  algorithm: "render-dispatch",
};

expect(circularPercentageBasis(context)).toBe(180);
expect(resolveNonnegativeShapeLength("50%", 180, "radius", context)).toBe(90);
expect(resolveNonnegativeShapeLength(0, 180, "radius", context)).toBe(0);
expect(() => resolveNonnegativeShapeLength(-1, 180, "radius", context)).toThrow(
  /Circle.*radius.*-1.*nonnegative/,
);
expect(() => resolveFiniteShapeNumber(Number.NaN, "rotation", context)).toThrow(
  /Circle.*rotation.*NaN.*finite/,
);
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/shape-style.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `shape-style.ts` or its exports do not exist.

- [ ] **Step 3: Implement the minimal resolvers**

```ts
export function resolveNonnegativeShapeLength(
  value: Exclude<Length, "auto">,
  reference: number,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  const resolved = resolveRequiredLength(value, reference, property, context);
  if (resolved < 0) {
    throw layoutDiagnostic({
      component: context.component,
      property,
      value,
      algorithm: context.algorithm,
      constraints: context.constraints,
      reason: "must resolve to a nonnegative number",
    });
  }
  return resolved;
}

export function resolveFiniteShapeNumber(
  value: number,
  property: string,
  context: Readonly<StyleResolutionContext>,
): number {
  if (!Number.isFinite(value)) {
    throw layoutDiagnostic({
      component: context.component,
      property,
      value,
      algorithm: context.algorithm,
      constraints: context.constraints,
      reason: "must be a finite number",
    });
  }
  return value;
}

export function circularPercentageBasis(
  context: Readonly<StyleResolutionContext>,
): number {
  return Math.min(
    context.percentageBasis.width,
    context.percentageBasis.height,
  );
}
```

- [ ] **Step 4: Run the focused test and typecheck**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/shape-style.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: helper tests PASS and typecheck PASS.

- [ ] **Step 5: Commit the foundation**

```bash
git add packages/core/src/lib/components/shape-style.ts packages/core/src/lib/components/shape-style.test.ts
git commit -m "feat(core): add shape geometry resolvers"
```

### Task 2: Circle and ellipse primitives

**Files:**

- Create: `packages/core/src/lib/components/circle.ts`
- Create: `packages/core/src/lib/components/circle.test.ts`
- Create: `packages/core/src/lib/components/ellipse.ts`
- Create: `packages/core/src/lib/components/ellipse.test.ts`

**Interfaces:**

- Consumes: Task 1 shape resolvers, `definePrimitive`, `renderPath`, existing path paint/style interfaces, and `wireCommonEvents` through `renderPath`.
- Produces: `Circle`, `CircleProps`, `CircleStyle`, `Ellipse`, `EllipseProps`, and `EllipseStyle`.

- [ ] **Step 1: Write failing Circle rendering, resolution, interaction, and validation tests**

Use `componentTest` and `createElement` to prove a filled circle paints at its center, misses outside its radius, defaults `cx`/`cy` to zero, resolves `{ cx: '50%', cy: '50%', radius: '25%' }` against a 400-by-200 declared box to `(200, 100, 50)`, updates geometry, and rejects negative radius with `LayoutDiagnostic`. Add an opacity-zero interaction assertion and an explicit `keyboardNavigationBounds` override assertion. Also call `measureElement` with finite constraints and assert `status: 'unsupported'`, proving radius does not become intrinsic layout size.

```ts
const canvas = await componentTest(
  createElement(Circle, {
    style: {
      width: 400,
      height: 200,
      cx: "50%",
      cy: "50%",
      radius: "25%",
      fill: "red",
    },
    onClick,
  }),
);
expect(pixelAt(canvas.element, 200, 100)).toEqual([255, 0, 0, 255]);
await canvas.click({ position: { x: 200, y: 100 } });
expect(onClick).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run Circle tests and confirm failure because the primitive is absent**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/circle.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on the missing `Circle` module/export.

- [ ] **Step 3: Implement Circle as a dedicated path-backed primitive**

Define local specified/resolved style interfaces, resolve axes and radius with Task 1 helpers, return an empty `Path2D` for radius zero, otherwise call `path.arc(cx, cy, radius, 0, Math.PI * 2)`, and pass `{ x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }` as the default keyboard bounds. Register `fill`, `stroke`, and `cursor` as opaque style properties.

- [ ] **Step 4: Run Circle tests until green**

Run the Circle command from Step 2.

Expected: PASS.

- [ ] **Step 5: Write failing Ellipse tests**

Prove fill/stroke rendering, zero defaults for `cx`/`cy`/`rotation`, axis-specific percentages, negative and non-finite validation, zero-radius empty geometry, updates, interactions, and rotation-aware bounds. For rotation `theta`, require half-extents:

```ts
const halfWidth = Math.sqrt(
  (radiusX * Math.cos(theta)) ** 2 + (radiusY * Math.sin(theta)) ** 2,
);
const halfHeight = Math.sqrt(
  (radiusX * Math.sin(theta)) ** 2 + (radiusY * Math.cos(theta)) ** 2,
);
```

- [ ] **Step 6: Run Ellipse tests and confirm failure**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/ellipse.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on the missing `Ellipse` module/export.

- [ ] **Step 7: Implement Ellipse and run both suites**

Use `Path2D.ellipse(cx, cy, radiusX, radiusY, rotation, 0, Math.PI * 2)`, an empty path when either radius is zero, and the tested rotation-aware bounds. Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/circle.test.ts packages/core/src/lib/components/ellipse.test.ts --browser.headless --browser.ui=false
```

Expected: both suites PASS.

- [ ] **Step 8: Commit Circle and Ellipse**

```bash
git add packages/core/src/lib/components/circle.ts packages/core/src/lib/components/circle.test.ts packages/core/src/lib/components/ellipse.ts packages/core/src/lib/components/ellipse.test.ts
git commit -m "feat(core): add circle and ellipse primitives"
```

### Task 3: Arc and wedge primitives

**Files:**

- Create: `packages/core/src/lib/components/arc-geometry.ts`
- Create: `packages/core/src/lib/components/arc-geometry.test.ts`
- Create: `packages/core/src/lib/components/arc.ts`
- Create: `packages/core/src/lib/components/arc.test.ts`
- Create: `packages/core/src/lib/components/wedge.ts`
- Create: `packages/core/src/lib/components/wedge.test.ts`

**Interfaces:**

- Consumes: Task 1 shape resolvers, `definePrimitive`, and `renderPath`.
- Produces:
  - `Arc`, `ArcProps`, and `ArcStyle`
  - `Wedge`, `WedgeProps`, and `WedgeStyle`
  - private `resolveCircularSweep`, `createArcPath`, `createWedgePath`, `arcBounds`, and `wedgeBounds` helpers.

- [ ] **Step 1: Write failing sweep and bound tests from the Canvas algorithm**

Test zero span, clockwise and counterclockwise short/long sweeps, direction-matching full turns, opposite-direction normalization, cardinal-extremum inclusion, and center inclusion for wedge bounds. Encode the full-turn rule exactly:

```ts
const fullCircle = counterclockwise
  ? startAngle - endAngle >= Math.PI * 2
  : endAngle - startAngle >= Math.PI * 2;
```

- [ ] **Step 2: Run arc-geometry tests and confirm failure**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/arc-geometry.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement normalized sweeps, path builders, and tight bounds**

Normalize non-full clockwise sweeps into `[0, 2π)` and non-full counterclockwise sweeps into `(-2π, 0]`. Build Arc with `Path2D.arc`. Build partial Wedge with `moveTo(cx, cy)`, `lineTo` the arc start, `arc`, and `closePath`; build a full Wedge as only a full circular arc followed by `closePath`, with no center/radial segments. Bounds must test the two endpoints plus cardinal angles contained by the normalized sweep; Wedge also tests the center.

- [ ] **Step 4: Run helper tests until green**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Write failing Arc component tests**

Cover numeric and percentage resolution, radians/direction, zero/negative/non-finite values, stroke-only typing, expanded line interaction, tight default keyboard bounds, caller override, updates, and representative transform/clip behavior.
Assert `measureElement` returns `status: 'unsupported'`.

- [ ] **Step 6: Implement Arc and run its suite**

Resolve `cx`, `cy`, `radius`, `startAngle`, and `endAngle`; default `counterclockwise` to false; use an empty path for zero radius/span; delegate the path and line-only style to `renderPath`. Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/arc-geometry.test.ts packages/core/src/lib/components/arc.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 7: Write failing Wedge component tests**

Cover fill and stroke targeting, partial radial edges, clockwise/counterclockwise sweeps, center-inclusive bounds, empty spans, full circles, and a Canvas-call assertion proving a full-circle stroke has no center `moveTo`/`lineTo` seam.
Assert `measureElement` returns `status: 'unsupported'`.

- [ ] **Step 8: Implement Wedge and run all arc suites**

Use the shared resolver and path helpers, delegating common paint/interaction to `renderPath`. Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/arc-geometry.test.ts packages/core/src/lib/components/arc.test.ts packages/core/src/lib/components/wedge.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 9: Commit Arc and Wedge**

```bash
git add packages/core/src/lib/components/arc-geometry.ts packages/core/src/lib/components/arc-geometry.test.ts packages/core/src/lib/components/arc.ts packages/core/src/lib/components/arc.test.ts packages/core/src/lib/components/wedge.ts packages/core/src/lib/components/wedge.test.ts
git commit -m "feat(core): add arc and wedge primitives"
```

### Task 4: Polygon primitive

**Files:**

- Create: `packages/core/src/lib/components/polygon.ts`
- Create: `packages/core/src/lib/components/polygon.test.ts`

**Interfaces:**

- Consumes: `definePrimitive`, `renderPath`, `createLinePath`, and `layoutDiagnostic`.
- Produces: `Polygon`, `PolygonProps`, and `PolygonStyle`.

- [ ] **Step 1: Write failing Polygon tests**

Cover filled and stroked triangles, automatic closure, updates, fill and edge hit testing, `lineInteractionWidth`, point-derived keyboard bounds, caller override, empty arrays and one/two-point arrays, and a non-finite coordinate diagnostic naming a property such as `coords[1][0]`.
Assert `measureElement` returns `status: 'unsupported'`.

- [ ] **Step 2: Run Polygon tests and confirm failure**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/polygon.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the primitive does not exist.

- [ ] **Step 3: Implement validation, closed geometry, and bounds**

The style resolver iterates every tuple and throws a contextual
`layoutDiagnostic` for non-finite x or y values. The renderer returns an empty
`Path2D` for fewer than three points; otherwise it uses
`createLinePath(coords, { closePath: true })`, computes min/max point bounds,
and delegates fill/stroke/interaction to `renderPath`.

- [ ] **Step 4: Run Polygon and existing Line tests**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/polygon.test.ts packages/core/src/lib/components/line.test.ts --browser.headless --browser.ui=false
```

Expected: both suites PASS, proving no change to `Line`.

- [ ] **Step 5: Commit Polygon**

```bash
git add packages/core/src/lib/components/polygon.ts packages/core/src/lib/components/polygon.test.ts
git commit -m "feat(core): add polygon primitive"
```

### Task 5: Public exports, typing, and package boundary

**Files:**

- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/test/jsx-authoring.test.tsx`
- Modify: `packages/core/src/lib/element/create-element.test.ts`
- Modify: `packages/core/src/lib/focus/public-api.test.ts`
- Modify: `packages/core/src/lib/runtime-contract.test.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `docs/api-reference.md`

**Interfaces:**

- Consumes: public values and types from Tasks 2-4.
- Produces: supported `@crc/core` exports and compiler/package-consumer evidence.

- [ ] **Step 1: Add failing public type and export assertions**

Import every new value and style/props type from `@crc/core`; create valid JSX and `createElement` instances; add `@ts-expect-error` cases for children, Arc fill, `auto` radii, and missing required geometry. Extend the exact runtime export list in `public-api.test.ts`.
Add a runtime recovery case that first renders a new primitive with a negative
radius, confirms the contextual `LayoutDiagnostic` and resource cleanup, then
mounts valid geometry on the same Canvas and confirms a successful frame.

- [ ] **Step 2: Run focused typecheck/tests and confirm missing exports**

Run:

```bash
corepack pnpm@11.21.0 run typecheck
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/public-api.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing root exports and new type assertions.

- [ ] **Step 3: Export all five primitives and ten public types**

Add named exports from the five focused component modules to
`packages/core/src/index.ts`. Update the package consumer with concrete style
objects and both JSX-equivalent/createElement construction without importing
private paths.

- [ ] **Step 4: Update the checked API-reference export blocks**

Update the root runtime-value count from 41 to 46, the root type count from 112
to 122, and the marked `root-values` and `root-types` lists in
`docs/api-reference.md`. Run:

```bash
corepack pnpm@11.21.0 docs:check
```

Expected: the API-reference export checks PASS; any remaining documentation
failure must name content intentionally owned by Task 7.

- [ ] **Step 5: Run typecheck, package build, and strict consumers**

Run:

```bash
corepack pnpm@11.21.0 run typecheck
corepack pnpm@11.21.0 --filter @crc/core build
corepack pnpm@11.21.0 run test:package-consumer
```

Expected: all commands PASS and the packed declarations expose the five values and ten types.

- [ ] **Step 6: Commit the public boundary**

```bash
git add packages/core/src/index.ts packages/core/test/jsx-authoring.test.tsx packages/core/src/lib/element/create-element.test.ts packages/core/src/lib/focus/public-api.test.ts packages/core/src/lib/runtime-contract.test.ts playground/package-consumer/index.ts docs/api-reference.md
git commit -m "feat(core): export standard shape primitives"
```

### Task 6: Learning examples and deterministic public scenario

**Files:**

- Create: `packages/scenarios/src/learning/drawing/circle.example.tsx`
- Create: `packages/scenarios/src/learning/drawing/ellipse.example.tsx`
- Create: `packages/scenarios/src/learning/drawing/arc.example.tsx`
- Create: `packages/scenarios/src/learning/drawing/wedge.example.tsx`
- Create: `packages/scenarios/src/learning/drawing/polygon.example.tsx`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/drawing-shapes.example.tsx`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `packages/core/test/drawing-gallery.test.ts`
- Modify catalog/index artifacts generated by repository scripts.

**Interfaces:**

- Consumes: the root public API from Task 5.
- Produces: five learner routes and shared deterministic browser evidence.

- [ ] **Step 1: Add failing catalog and browser expectations**

Require routes `#/examples/drawing/circle`, `ellipse`, `arc`, `wedge`, and
`polygon`; require their API tags; mount each lesson; click an intentional
target in each interactive lesson; and assert representative interior,
exterior, stroke, and updated pixels. Extend `drawing-shapes` expectations to
cover all five values through only `@crc/core` imports.

- [ ] **Step 2: Run focused scenario tests and confirm failures**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts packages/core/test/drawing-gallery.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because catalog entries/examples and scenario behavior are missing.

- [ ] **Step 3: Create five focused learner examples**

Each example must use automatic CRC JSX, one concise interactive state change,
the primitive's distinctive geometry, and no private import. Keep the Canvas at
the catalog-declared deterministic size and avoid platform-sensitive text in
pixel assertion regions.

- [ ] **Step 4: Extend the deterministic drawing-shapes laboratory**

Add all five primitives to the existing public-API scenario with stable colors,
non-overlapping assertion points, one update action, and semantic state that
headless tests can inspect. Do not replace its existing Rectangle/Path/SvgPath
coverage.

- [ ] **Step 5: Regenerate catalogs and run the focused browser suites**

Run:

```bash
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts packages/core/test/drawing-gallery.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: all focused suites PASS.

- [ ] **Step 6: Inspect visual evidence**

Run the drawing visual suite normally. If expected images change, inspect its
expected, actual, and diff files before accepting an update; record why every
changed region is intentional. Never rewrite a baseline solely to turn the
suite green.

- [ ] **Step 7: Commit scenarios and evidence**

```bash
git add packages/scenarios packages/core/test/learning-examples.test.ts packages/core/test/drawing-gallery.test.ts docs/scenario-index.md
git commit -m "test: prove standard shape primitives publicly"
```

### Task 7: Contracts, final verification, and completion audit

**Files:**

- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/api-reference.md`
- Modify: `docs/library-status.md`
- Modify: `docs/scenario-index.md` when generated by its owning script.
- Create: `docs/testing/field-notes/standard-shape-primitives.md`

**Interfaces:**

- Consumes: all implementation and evidence from Tasks 1-6.
- Produces: durable public documentation and fresh trust evidence.

- [ ] **Step 1: Update normative documentation**

Add all five values to the drawing-component matrix and API reference, including
percentage bases, radians/direction, Arc stroke-only behavior, seam-free full
Wedge behavior, Polygon closure, zero/error behavior, lack of intrinsic
measurement, and the explicit visualization non-goals.

- [ ] **Step 2: Run documentation, export, and catalog consistency checks**

Run:

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 playground:build
```

Fix stale counts, links, generated markers, API coverage, formatting, and
Studio declarations without reporting historical test totals as current
results. Expected: all five commands PASS.

- [ ] **Step 3: Run the focused implementation matrix**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/shape-style.test.ts packages/core/src/lib/components/circle.test.ts packages/core/src/lib/components/ellipse.test.ts packages/core/src/lib/components/arc-geometry.test.ts packages/core/src/lib/components/arc.test.ts packages/core/src/lib/components/wedge.test.ts packages/core/src/lib/components/polygon.test.ts packages/core/test/jsx-authoring.test.tsx packages/core/test/learning-examples.test.ts packages/core/test/drawing-gallery.test.ts --browser.headless --browser.ui=false
```

Expected: every named suite PASS with no unexpected skips.

- [ ] **Step 4: Run the aggregate trust gate**

Run:

```bash
corepack pnpm@11.21.0 trust
```

Expected: the aggregate documentation/export/catalog, typecheck, lint/format,
build, packed-consumer, browser, visual, built-smoke, cleanup, and structural
performance gates PASS.

- [ ] **Step 5: Record fresh evidence**

Write `docs/testing/field-notes/standard-shape-primitives.md` with the date,
Node/pnpm/Chromium environment, exact focused and aggregate commands, fresh
pass totals, any inspected visual diff paths, and the commit under test. Do not
copy dated totals from older documentation.

- [ ] **Step 6: Audit the spec requirement by requirement**

Check every goal, non-goal, public export, geometry rule, validation case,
interaction rule, lifecycle statement, example, consumer, and trust gate in
the design spec against code or fresh output. Treat missing or indirect
evidence as incomplete and continue until resolved.

- [ ] **Step 7: Commit documentation and final evidence**

```bash
git add docs/design/drawing-components-contract.md docs/api-reference.md docs/library-status.md docs/scenario-index.md docs/testing/field-notes/standard-shape-primitives.md
git commit -m "docs: record standard shape primitive contracts"
```
