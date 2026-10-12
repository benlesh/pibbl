# Rounded Shapes and Path Creators Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** Agent instructions and unchecked-looking task syntax below are preserved as dated evidence, not active work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rounded `Rectangle` and `Polygon` geometry, new `RegularPolygon` and `Star` drawing leaves, and public pure `Path2D` creators that are shared by components, hooks, clipping, and caller-authored paths.

**Architecture:** Focused modules under `packages/core/src/lib/geometry` own numeric validation, vertex generation, and fresh `Path2D` construction. Components remain immediate-mode leaves: they resolve Pibbl lengths and diagnostics, call the canonical numeric geometry, compute default keyboard bounds, and delegate paint and interaction to `renderPath`; existing hooks keep their signatures and memoization while delegating allocation to the same creators. Public exports, consumers, Studio declarations, learning examples, one deterministic clipping scenario, contracts, and trust evidence land only after the geometry slices are green.

**Tech Stack:** TypeScript 7, HTML Canvas 2D `Path2D`, Pibbl JSX/createElement runtime, Vitest Browser with Playwright Chromium, Node 24.15 or newer on Node 24 LTS, pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-09-08-rounded-shapes-and-path-creators-design.md`

## Global Constraints

- Preserve unrelated working-tree changes and untracked files; stage only files named by the current task.
- Public authors import only from `@pibbl/core`; no public source or `lib/*` imports.
- Every public creator accepts one readonly numeric options object, allocates a fresh `Path2D`, and has no Pibbl runtime, rendering, registration, or resource-owning side effects.
- Components and existing path hooks delegate to the same canonical creator used by public callers; do not retain duplicate path formulas.
- Component radius-like styles accept `Exclude<Length, "auto">`; standalone creators accept finite numeric logical Canvas units only.
- `cornerRadii?.[i] ?? cornerRadius ?? 0` selects each radius; literal zero overrides the default, while holes, `null`, and `undefined` fall back.
- Reject `cornerRadii` arrays longer than the actual corner count; proportionally scale all otherwise valid polygon radii by one global factor when an edge cannot fit neighboring tangent demands.
- Use native `Path2D.roundRect` for rounded rectangles and `Path2D.arcTo` for true circular polygon fillets, including the last-to-first corner.
- `RegularPolygon` requires integer `sides >= 3` and exactly one of `circumradius`, `inradius`, or `sideLength`; `Star` requires integer `points >= 3`, `innerRadius <= outerRadius`, and represents one concave alternating-radius silhouette.
- Add corner rounding only to `Rectangle`, `Polygon`, `RegularPolygon`, and `Star`; do not add it to lines, arcs, wedges, circles, ellipses, images, text, groups, layers, or clips.
- Preserve local style, declared-box layout, source paint order, transforms, clip/layer alignment, lifecycle teardown, event semantics, and explicit keyboard-bound precedence.
- Neither `RegularPolygon` nor `Star` provides intrinsic measurement.
- Standalone creator validation throws `RangeError` naming the offending option path; component validation throws contextual `LayoutDiagnostic`.
- Add a focused failing test before production code, assert semantic geometry and interaction before visual evidence, and inspect expected/actual/diff images before accepting a visual baseline change.
- Add no dependency, generic `Shape`, registry, retained geometry graph, display list, path cache, or per-shape memoized hook.

---

### Task 1: Canonical validation, line, and SVG path creators

**Files:**

- Create: `packages/core/src/lib/geometry/validation.ts`
- Create: `packages/core/src/lib/geometry/validation.test.ts`
- Create: `packages/core/src/lib/geometry/recording-path2d.test-util.ts`
- Create: `packages/core/src/lib/geometry/line.ts`
- Create: `packages/core/src/lib/geometry/line.test.ts`
- Create: `packages/core/src/lib/geometry/svg-path.ts`
- Create: `packages/core/src/lib/geometry/svg-path.test.ts`
- Modify: `packages/core/src/lib/components/line.ts`
- Modify: `packages/core/src/lib/components/svg-path.ts`
- Modify: `packages/core/src/lib/hooks/use-line-path.ts`
- Modify: `packages/core/src/lib/hooks/use-svg-path.ts`
- Modify: `packages/core/src/lib/hooks/pibbl-path-hooks.test.ts`
- Delete: `packages/core/src/lib/util/create-line-path.ts`

**Interfaces:**

- Consumes: browser `Path2D`; existing `Line`/`SvgPath` style resolution; `useMemoSlot`.
- Produces:
  - `GeometryErrorFactory = (property: string, value: unknown, reason: string) => Error`
  - `pathRangeError(property, value, reason): RangeError`
  - `finiteNumber(value, property, errorFactory?): number`
  - `nonnegativeNumber(value, property, errorFactory?): number`
  - `integerAtLeast(value, minimum, property, errorFactory?): number`
  - `validateCoordinates(coords, property?, errorFactory?): readonly (readonly [number, number])[]`
  - test-only `installRecordingPath2D(): { restore(): void; commands(path): readonly RecordedPathCommand[] }`
  - `LinePathOptions`, `createLinePath(options): Path2D`
  - `SvgPathOptions`, `createSvgPath(options): Path2D`

- [ ] **Step 1: Write failing validation and creator tests**

Create one shared test-only recording `Path2D` with constructor, `moveTo`, `lineTo`, `closePath`, `rect`, `roundRect`, `arc`, `ellipse`, and `arcTo` recording. Its installer saves the original global and returns an idempotent `restore`; every test restores it in `afterEach`. Cover an empty coordinate list, one point, ordered multiple points, `closePath: true`, fresh identity on repeated calls, readonly input, default `closePath: false`, and exact option paths for invalid `coords[1][0]` and `coords[1][1]`. Cover `createSvgPath({ d })` forwarding the exact string to the `Path2D` constructor and returning a fresh object. After restoring the real implementation, verify the line with `isPointInStroke` and the closed SVG path with `isPointInPath`. Later geometry suites import this utility rather than defining their own recorder.

```ts
expect(
  record(
    createLinePath({
      coords: [
        [1, 2],
        [3, 4],
      ],
      closePath: true,
    }),
  ),
).toEqual([["moveTo", 1, 2], ["lineTo", 3, 4], ["closePath"]]);
expect(() =>
  createLinePath({
    coords: [
      [0, 0],
      [NaN, 1],
    ],
  }),
).toThrowError(/coords\[1\]\[0\].*finite/);
expect(createSvgPath({ d: "M0 0L2 2" })).not.toBe(
  createSvgPath({ d: "M0 0L2 2" }),
);
```

- [ ] **Step 2: Run the focused suites and confirm the missing-module failure**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/validation.test.ts packages/core/src/lib/geometry/line.test.ts packages/core/src/lib/geometry/svg-path.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the new geometry modules do not exist.

- [ ] **Step 3: Implement validation and the two creators**

Use the following public option shapes and preserve the exact traversal contract:

```ts
export interface LinePathOptions {
  coords: readonly (readonly [number, number])[];
  closePath?: boolean;
}

export interface SvgPathOptions {
  d: string;
}

export function createLinePath(options: Readonly<LinePathOptions>): Path2D {
  const coords = validateCoordinates(options.coords);
  const path = new Path2D();
  coords.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  if (options.closePath) path.closePath();
  return path;
}

export function createSvgPath(options: Readonly<SvgPathOptions>): Path2D {
  return new Path2D(options.d);
}
```

Implement `pathRangeError` as `new RangeError(`${property} ${reason}; received ${String(value)}`)` and route every numeric guard through the injectable `GeometryErrorFactory`. Do not catch `Path2D` SVG parsing errors.

- [ ] **Step 4: Migrate current consumers without changing their public signatures**

Change `Line`, `HorizontalLine`, `VerticalLine`, and `useLinePath` to call `createLinePath({ coords, closePath })`. Before delegation, make `Line` style resolution call `validateCoordinates` with a `GeometryErrorFactory` that builds `layoutDiagnostic`, and add component tests proving indexed non-finite coordinates report contextual diagnostics and recover on a later valid render. Change `SvgPath` and `useSvgPath` to call `createSvgPath({ d })`. Keep hook dependency arrays unchanged in meaning, then delete `lib/util/create-line-path.ts` after `rg "util/create-line-path|createLinePath\(" packages/core/src` proves all imports use the geometry module.

```ts
return useMemoSlot(
  "linePath",
  () => createLinePath({ coords, closePath: config?.closePath }),
  [...coords.flat(), config?.closePath],
);
```

- [ ] **Step 5: Run focused regression tests and typecheck**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/validation.test.ts packages/core/src/lib/geometry/line.test.ts packages/core/src/lib/geometry/svg-path.test.ts packages/core/src/lib/hooks/pibbl-path-hooks.test.ts packages/core/src/lib/components/line.test.ts packages/core/src/lib/components/svg-path.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: all focused suites and typecheck PASS; existing hook memo identity remains stable within a render and changes when inputs change.

- [ ] **Step 6: Commit the extraction**

```bash
git add packages/core/src/lib/geometry packages/core/src/lib/components/line.ts packages/core/src/lib/components/svg-path.ts packages/core/src/lib/hooks/use-line-path.ts packages/core/src/lib/hooks/use-svg-path.ts packages/core/src/lib/hooks/pibbl-path-hooks.test.ts packages/core/src/lib/util/create-line-path.ts
git commit -m "feat(core): expose canonical line and SVG geometry"
```

### Task 2: Circle and ellipse path creators

**Files:**

- Create: `packages/core/src/lib/geometry/circle.ts`
- Create: `packages/core/src/lib/geometry/circle.test.ts`
- Create: `packages/core/src/lib/geometry/ellipse.ts`
- Create: `packages/core/src/lib/geometry/ellipse.test.ts`
- Modify: `packages/core/src/lib/components/circle.ts`
- Modify: `packages/core/src/lib/components/ellipse.ts`
- Modify: `packages/core/src/lib/components/circle.test.ts`
- Modify: `packages/core/src/lib/components/ellipse.test.ts`

**Interfaces:**

- Consumes: Task 1 numeric validation and browser `Path2D`.
- Produces: `CirclePathOptions`, `createCirclePath(options): Path2D`, `EllipsePathOptions`, and `createEllipsePath(options): Path2D`.

- [ ] **Step 1: Write failing pure-geometry tests**

Assert zero-default centers, default ellipse rotation, exact full-turn commands, zero-radius empty geometry, fresh identity, and errors for every non-finite or negative field. With real browser paths, use `isPointInPath` to prove center/interior hits and outside misses for both creators.

```ts
expect(record(createCirclePath({ radius: 4 }))).toEqual([
  ["arc", 0, 0, 4, 0, Math.PI * 2],
]);
expect(record(createEllipsePath({ radiusX: 6, radiusY: 3 }))).toEqual([
  ["ellipse", 0, 0, 6, 3, 0, 0, Math.PI * 2],
]);
expect(record(createCirclePath({ radius: 0 }))).toEqual([]);
expect(() => createEllipsePath({ radiusX: -1, radiusY: 2 })).toThrowError(
  /radiusX.*nonnegative/,
);
```

- [ ] **Step 2: Run the tests and confirm the creators are missing**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/circle.test.ts packages/core/src/lib/geometry/ellipse.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing modules/exports.

- [ ] **Step 3: Implement the numeric creators**

```ts
export interface CirclePathOptions {
  cx?: number;
  cy?: number;
  radius: number;
}

export function createCirclePath(options: Readonly<CirclePathOptions>): Path2D {
  const cx = finiteNumber(options.cx ?? 0, "cx");
  const cy = finiteNumber(options.cy ?? 0, "cy");
  const radius = nonnegativeNumber(options.radius, "radius");
  const path = new Path2D();
  if (radius > 0) path.arc(cx, cy, radius, 0, Math.PI * 2);
  return path;
}
```

Implement `EllipsePathOptions` with `cx?`, `cy?`, `radiusX`, `radiusY`, and `rotation?`; validate all five resolved values and call `ellipse` only when both radii are positive.

- [ ] **Step 4: Delegate the components to the creators**

Replace only direct `new Path2D()` shape construction in `circle.ts` and `ellipse.ts`. Keep the existing percentage resolution, diagnostics, empty behavior, paint path, and keyboard-bound formulas intact.

```ts
const path = createEllipsePath({ cx, cy, radiusX, radiusY, rotation });
```

- [ ] **Step 5: Run pure and component tests**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/circle.test.ts packages/core/src/lib/geometry/ellipse.test.ts packages/core/src/lib/components/circle.test.ts packages/core/src/lib/components/ellipse.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: all suites and typecheck PASS, including prior percentage, interaction, update, and bounds evidence.

- [ ] **Step 6: Commit the creators and migrations**

```bash
git add packages/core/src/lib/geometry/circle.ts packages/core/src/lib/geometry/circle.test.ts packages/core/src/lib/geometry/ellipse.ts packages/core/src/lib/geometry/ellipse.test.ts packages/core/src/lib/components/circle.ts packages/core/src/lib/components/ellipse.ts packages/core/src/lib/components/circle.test.ts packages/core/src/lib/components/ellipse.test.ts
git commit -m "feat(core): add circle and ellipse path creators"
```

### Task 3: Arc and wedge path creators

**Files:**

- Create: `packages/core/src/lib/geometry/circular-sweep.ts`
- Create: `packages/core/src/lib/geometry/circular-sweep.test.ts`
- Modify: `packages/core/src/lib/components/arc-geometry.ts`
- Modify: `packages/core/src/lib/components/arc-geometry.test.ts`
- Modify: `packages/core/src/lib/components/arc.ts`
- Modify: `packages/core/src/lib/components/wedge.ts`
- Modify: `packages/core/src/lib/components/arc.test.ts`
- Modify: `packages/core/src/lib/components/wedge.test.ts`

**Interfaces:**

- Consumes: Task 1 numeric validation and the current `CircularSweep` normalization behavior.
- Produces: `CircularSweep`, `resolveCircularSweep`, `ArcPathOptions`, `WedgePathOptions`, `createArcPath(options): Path2D`, and `createWedgePath(options): Path2D`; component `arcBounds` and `wedgeBounds` continue to consume `CircularSweep`.

- [ ] **Step 1: Write failing public-signature geometry tests**

Move the current sweep-normalization cases to the geometry suite and add raw-options creator coverage for clockwise/counterclockwise partial spans, zero span, full turns, default centers/direction, zero radius, finite validation, nonnegative radius, and the no-seam full-circle wedge. With real browser paths, use `isPointInStroke` for an arc and `isPointInPath` for partial/full wedges.

```ts
expect(
  record(createArcPath({ radius: 10, startAngle: 0, endAngle: Math.PI })),
).toEqual([["arc", 0, 0, 10, 0, Math.PI, false]]);
expect(
  record(createWedgePath({ radius: 10, startAngle: 0, endAngle: Math.PI })),
).toEqual([
  ["moveTo", 0, 0],
  ["lineTo", 10, 0],
  ["arc", 0, 0, 10, 0, Math.PI, false],
  ["closePath"],
]);
expect(
  record(createWedgePath({ radius: 10, startAngle: 0, endAngle: Math.PI * 2 })),
).not.toContainEqual(["lineTo", 10, 0]);
```

- [ ] **Step 2: Run the focused suite and confirm its expected API failure**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/circular-sweep.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the geometry module and options-object creators are absent.

- [ ] **Step 3: Extract the canonical sweep and implement both creators**

Define `ArcPathOptions` exactly as the spec (`cx?`, `cy?`, `radius`, `startAngle`, `endAngle`, `counterclockwise?`) and `type WedgePathOptions = ArcPathOptions`. Validate raw inputs, call the extracted `resolveCircularSweep`, preserve zero/full-turn behavior, and allocate one fresh path per call. Retain the current formulas rather than creating a second normalization implementation.

```ts
export function createArcPath(options: Readonly<ArcPathOptions>): Path2D {
  const normalized = validateArcOptions(options);
  const sweep = resolveCircularSweep(
    normalized.startAngle,
    normalized.endAngle,
    normalized.counterclockwise,
  );
  return buildArcPath(normalized.cx, normalized.cy, normalized.radius, sweep);
}
```

- [ ] **Step 4: Keep bounds component-local and migrate both leaves**

Import `CircularSweep`, `resolveCircularSweep`, `createArcPath`, and `createWedgePath` from the new module. Leave `arcBounds`, `wedgeBounds`, angle containment, style resolution, and default keyboard bounds in the component area. Have `Arc`/`Wedge` pass their resolved numeric options to the canonical creators.

- [ ] **Step 5: Run all arc/wedge regression evidence**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/circular-sweep.test.ts packages/core/src/lib/components/arc-geometry.test.ts packages/core/src/lib/components/arc.test.ts packages/core/src/lib/components/wedge.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: all suites and typecheck PASS, including bounds, interaction, and recovery cases.

- [ ] **Step 6: Commit the canonical circular geometry**

```bash
git add packages/core/src/lib/geometry/circular-sweep.ts packages/core/src/lib/geometry/circular-sweep.test.ts packages/core/src/lib/components/arc-geometry.ts packages/core/src/lib/components/arc-geometry.test.ts packages/core/src/lib/components/arc.ts packages/core/src/lib/components/wedge.ts packages/core/src/lib/components/arc.test.ts packages/core/src/lib/components/wedge.test.ts
git commit -m "feat(core): add arc and wedge path creators"
```

### Task 4: Rounded closed-polygon geometry and Polygon integration

**Files:**

- Create: `packages/core/src/lib/geometry/rounded-corners.ts`
- Create: `packages/core/src/lib/geometry/rounded-corners.test.ts`
- Create: `packages/core/src/lib/geometry/polygon.ts`
- Create: `packages/core/src/lib/geometry/polygon.test.ts`
- Create: `packages/core/src/lib/components/rounded-corner-style.ts`
- Create: `packages/core/src/lib/components/rounded-corner-style.test.ts`
- Modify: `packages/core/src/lib/components/polygon.ts`
- Modify: `packages/core/src/lib/components/polygon.test.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Modify: `packages/core/src/lib/runtime-contract.test.ts`

**Interfaces:**

- Consumes: Task 1 validation, `resolveRequiredLength`, `circularPercentageBasis`, `layoutDiagnostic`, `renderPath`, and current Polygon bounds/event behavior.
- Produces:
  - `RoundedCornerPathOptions`
  - `ResolvedCornerRadii = readonly number[]`
  - `resolveNumericCornerRadii(cornerCount, options, errorFactory?): ResolvedCornerRadii`
  - `createRoundedClosedPolygonPath(coords, radii): Path2D`
  - `PolygonPathOptions`, `createPolygonPath(options): Path2D`
  - public `RoundedCornerStyle`
  - component `resolveRoundedCornerStyle(cornerCount, style, context): { cornerRadius?: number; cornerRadii?: readonly (number | null | undefined)[] }`

- [ ] **Step 1: Write failing radius-resolution and rounded-traversal tests**

Cover uniform radii, sparse holes, explicit zero, `null`/`undefined` fallback, overlong arrays, negative/non-finite values, sharp all-zero delegation, and fewer-than-three-point emptiness. Record exact `moveTo`, `arcTo`, and `closePath` order to prove vertex zero is rounded. Add convex, concave, duplicate, exactly collinear, near-collinear, and self-intersecting inputs. After restoring the real browser `Path2D`, use a real canvas context to prove `isPointInPath` misses a rounded-off corner and hits retained convex and concave interiors.

```ts
expect(
  resolveNumericCornerRadii(4, {
    cornerRadius: 5,
    cornerRadii: [0, null, 3],
  }),
).toEqual([0, 5, 3, 5]);

expect(() =>
  resolveNumericCornerRadii(3, { cornerRadii: [1, 2, 3, null] }),
).toThrowError(/cornerRadii.*length.*3/);

const commands = record(
  createPolygonPath({
    coords: [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ],
    cornerRadius: 8,
  }),
);
expect(commands.filter(([name]) => name === "arcTo")).toHaveLength(4);
expect(commands.at(-1)).toEqual(["closePath"]);
```

- [ ] **Step 2: Add a failing proportional-scaling assertion**

For every vertex, calculate unit rays toward predecessor/successor, `theta = acos(clamp(dot, -1, 1))`, and `d = r / tan(theta / 2)`. Use a polygon where one short edge constrains two unequal radii and assert that every recorded `arcTo` radius equals its request multiplied by the same minimum edge factor.

```ts
const requested = [12, 6, 9, 3];
const expectedScale = Math.min(
  1,
  ...edgeLengths.map((length, index) =>
    demands[index] + demands[(index + 1) % demands.length] > 0
      ? length / (demands[index] + demands[(index + 1) % demands.length])
      : 1,
  ),
);
requested.forEach((radius, index) => {
  expect(recordedArcRadii[index]).toBeCloseTo(radius * expectedScale, 10);
});
```

- [ ] **Step 3: Run geometry tests and confirm they fail before implementation**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/rounded-corners.test.ts packages/core/src/lib/geometry/polygon.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing modules and creator.

- [ ] **Step 4: Implement nullish fallback, global scaling, and closed traversal**

Represent every corner with predecessor/successor unit rays, angle, requested radius, and tangent demand. Treat a zero radius, zero-length incident edge, or exactly collinear incident pair as demand zero. Compute one factor across all edges, scale every nonzero radius and demand once, move to vertex zero's incoming tangent point, call `arcTo(vertex.x, vertex.y, outgoingTangent.x, outgoingTangent.y, scaledRadius)` for every rounded vertex in source order, use `lineTo` for sharp vertices, and close.

```ts
const scale = edges.reduce((current, edge, index) => {
  const next = (index + 1) % corners.length;
  const totalDemand = corners[index].demand + corners[next].demand;
  return totalDemand > 0
    ? Math.min(current, edge.length / totalDemand)
    : current;
}, 1);
```

For all-zero effective radii call `createLinePath({ coords, closePath: true })`. Do not reject self-intersection or near-collinearity.

- [ ] **Step 5: Write failing component style and interaction tests**

Extend `PolygonStyle` with `RoundedCornerStyle`. In an allocation with percentage basis 200-by-120, assert `cornerRadius: "25%"` resolves to 30. Test sparse mixed number/percentage radii, overlong arrays, negative/non-finite diagnostics with `Polygon` and the indexed property path, update/replacement/removal, pointer misses inside a rounded-off corner but hits the retained interior, coordinate extrema as default keyboard bounds, explicit bounds precedence, transform placement, and failure cleanup/recovery.

```ts
await canvas.click({ position: { x: 1, y: 1 } });
expect(onClick).not.toHaveBeenCalled();
await canvas.click({ position: { x: 20, y: 20 } });
expect(onClick).toHaveBeenCalledOnce();
```

- [ ] **Step 6: Resolve component lengths and delegate Polygon**

Add `RoundedCornerStyle` to `style/types.ts`. `resolveRoundedCornerStyle` must reject overlong arrays before mapping, preserve nullish entries for fallback, resolve every present radius against `circularPercentageBasis(context)`, and emit `LayoutDiagnostic` using `cornerRadius` or `cornerRadii[index]`. `Polygon` validates coordinates contextually, resolves corners, and calls:

```ts
const path = createPolygonPath({ coords, cornerRadius, cornerRadii });
```

Keep coordinate extrema as default keyboard bounds and leave explicit bounds untouched.

- [ ] **Step 7: Run geometry, component, allocation, and lifecycle tests**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/rounded-corners.test.ts packages/core/src/lib/geometry/polygon.test.ts packages/core/src/lib/components/rounded-corner-style.test.ts packages/core/src/lib/components/polygon.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/standard-shape-allocation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: all suites and typecheck PASS; invalid component styles use `LayoutDiagnostic`, while direct creators use `RangeError`.

- [ ] **Step 8: Commit rounded Polygon support**

```bash
git add packages/core/src/lib/geometry/rounded-corners.ts packages/core/src/lib/geometry/rounded-corners.test.ts packages/core/src/lib/geometry/polygon.ts packages/core/src/lib/geometry/polygon.test.ts packages/core/src/lib/components/rounded-corner-style.ts packages/core/src/lib/components/rounded-corner-style.test.ts packages/core/src/lib/components/polygon.ts packages/core/src/lib/components/polygon.test.ts packages/core/src/lib/style/types.ts packages/core/src/lib/runtime-contract.test.ts
git commit -m "feat(core): add rounded polygon geometry"
```

### Task 5: Rounded rectangle creator, component, and hook

**Files:**

- Create: `packages/core/src/lib/geometry/rectangle.ts`
- Create: `packages/core/src/lib/geometry/rectangle.test.ts`
- Modify: `packages/core/src/lib/components/rect.ts`
- Modify: `packages/core/src/lib/components/rect.test.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Modify: `packages/core/src/lib/hooks/use-rect-path.ts`
- Modify: `packages/core/src/lib/hooks/pibbl-path-hooks.test.ts`

**Interfaces:**

- Consumes: Task 4 `RoundedCornerPathOptions`, `resolveNumericCornerRadii`, `RoundedCornerStyle`, and `resolveRoundedCornerStyle`; current rectangle pixel-grid adjustment.
- Produces: `RectanglePathOptions`, `createRectanglePath(options): Path2D`; `RectStyle` and `ResolvedRectStyle` corner fields; numeric `cornerRadius`/`cornerRadii` additions to the existing optional `useRectPath` config.

- [ ] **Step 1: Write failing rectangle creator tests**

Use the shared recording `Path2D` with both `rect` and `roundRect`. Assert default `x`/`y`, signed width/height preservation, all-zero use of `rect`, four expanded radii passed to `roundRect`, sparse fallback, native corner order, overlong arrays, invalid fields, native scaling ownership, and fresh identity. Restore the browser implementation and use `isPointInPath` to verify rounded-cut misses and retained-interior hits for both positive and signed dimensions.

```ts
expect(record(createRectanglePath({ width: 30, height: 20 }))).toEqual([
  ["rect", 0, 0, 30, 20],
]);
expect(
  record(
    createRectanglePath({
      x: 3,
      y: 4,
      width: -30,
      height: 20,
      cornerRadius: 6,
      cornerRadii: [0, null, 2],
    }),
  ),
).toEqual([["roundRect", 3, 4, -30, 20, [0, 6, 2, 6]]]);
```

- [ ] **Step 2: Run the geometry suite and confirm it fails**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/rectangle.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `createRectanglePath` is absent.

- [ ] **Step 3: Implement native rounded-rectangle delegation**

Validate finite `x`, `y`, `width`, and `height`, resolve exactly four radii, then choose the native operation:

```ts
const path = new Path2D();
if (radii.every((radius) => radius === 0)) {
  path.rect(x, y, width, height);
} else {
  path.roundRect(x, y, width, height, [...radii]);
}
return path;
```

Pibbl expands fallback values but does not reproduce Canvas signed-dimension remapping or adjacent-radius scaling.

- [ ] **Step 4: Write failing Rectangle component and hook cases**

Add numeric/percentage/sparse style tests, explicit-zero fallback, overlong-array diagnostics, signed boxes, updates and recovery, pointer miss in a rounded cut, rectangle-box keyboard bounds, explicit override, and pixel-grid evidence proving the adjusted `x`, `y`, `width`, and `height` reach `roundRect` while radii do not change. Extend hook tests to prove sharp/rounded command selection, pixel adjustment before creator delegation, effective-radii memo identity, invalid direct values, and invalidation when any effective corner radius changes.

```ts
// Capture the hook result before and after updating the same mounted hook slot
// from { cornerRadius: 4, cornerRadii: [0, null] }
// to { cornerRadii: [0, 4, 4, 4] }.
expect(pathsAfterEachRender).toHaveLength(2);
expect(pathsAfterEachRender[1]).toBe(pathsAfterEachRender[0]);
```

- [ ] **Step 5: Resolve and delegate component/hook geometry**

Make `RectStyle` extend `RoundedCornerStyle`; add numeric resolved corner fields to `ResolvedRectStyle`. In `Rectangle`, perform existing pixel-grid adjustment first, then call `createRectanglePath` with the effective box and resolved corners. Extend the hook config without changing positional parameters:

```ts
config?: {
  alignToPixelGrid?: PixelGridAlignment;
  lineWidth?: number;
  cornerRadius?: number;
  cornerRadii?: readonly (number | null | undefined)[];
}
```

Resolve the hook's effective four radii before `useMemoSlot`, include all four in its dependencies, and allocate through `createRectanglePath({ x, y, width, height, cornerRadii: radii })`. Equivalent fallback spellings therefore share memo identity.

- [ ] **Step 6: Run rectangle, hook, and allocation evidence**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/rectangle.test.ts packages/core/src/lib/components/rounded-corner-style.test.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/hooks/pibbl-path-hooks.test.ts packages/core/test/standard-shape-allocation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: all suites and typecheck PASS; all existing sharp rectangle assertions remain valid.

- [ ] **Step 7: Commit rounded rectangles**

```bash
git add packages/core/src/lib/geometry/rectangle.ts packages/core/src/lib/geometry/rectangle.test.ts packages/core/src/lib/components/rect.ts packages/core/src/lib/components/rect.test.ts packages/core/src/lib/style/types.ts packages/core/src/lib/hooks/use-rect-path.ts packages/core/src/lib/hooks/pibbl-path-hooks.test.ts
git commit -m "feat(core): add rounded rectangle geometry"
```

### Task 6: RegularPolygon geometry and drawing leaf

**Files:**

- Create: `packages/core/src/lib/geometry/regular-polygon.ts`
- Create: `packages/core/src/lib/geometry/regular-polygon.test.ts`
- Create: `packages/core/src/lib/components/regular-polygon.ts`
- Create: `packages/core/src/lib/components/regular-polygon.test.ts`
- Modify: `packages/core/src/lib/components/shape-style.ts`
- Modify: `packages/core/src/lib/components/shape-style.test.ts`
- Modify: `packages/core/src/lib/runtime-contract.test.ts`
- Modify: `packages/core/test/standard-shape-allocation.test.ts`

**Interfaces:**

- Consumes: Tasks 1 and 4 validation/rounding, `resolveNonnegativeShapeLength`, `resolveFiniteShapeNumber`, `circularPercentageBasis`, `resolveRoundedCornerStyle`, `definePrimitive`, and `renderPath`.
- Produces:
  - `RegularPolygonPathPosition`
  - `RegularPolygonNumericSize`
  - `RegularPolygonPathOptions`
  - internal-only `ResolvedRegularPolygonGeometry = { path: Path2D; vertices: readonly (readonly [number, number])[]; bounds?: LayoutBox }`
  - internal-only `resolveRegularPolygonGeometry(options, errorFactory?): ResolvedRegularPolygonGeometry`
  - `createRegularPolygonPath(options): Path2D`
  - `RegularPolygon`, `RegularPolygonProps`, and `RegularPolygonStyle`

- [ ] **Step 1: Write failing numeric geometry tests**

Cover integer `sides >= 3`, exactly one size key at runtime, finite/nonnegative sizes, zero-size empty path geometry, default center/rotation, clockwise order, explicit rotation, fresh identity, corner-array length against `sides`, and equality of all three sizing modes. Assert the normalized circumradius formulas directly. Define a local `generatedVertices(options)` test helper that installs the shared recording `Path2D`, calls the sharp-corner creator, and reads the `moveTo`/`lineTo` coordinates without duplicating the production formulas. With the real browser path restored, prove a generated hexagon clips/hit-tests its center and excludes a bounding-box corner.

```ts
const sides = 6;
const circumradius = 20;
const inradius = circumradius * Math.cos(Math.PI / sides);
const sideLength = 2 * circumradius * Math.sin(Math.PI / sides);

const byCircumradius = generatedVertices({ sides, circumradius });
for (const equivalent of [
  generatedVertices({ sides, inradius }),
  generatedVertices({ sides, sideLength }),
]) {
  equivalent.forEach(([x, y], index) => {
    expect(x).toBeCloseTo(byCircumradius[index][0], 10);
    expect(y).toBeCloseTo(byCircumradius[index][1], 10);
  });
}
const [[topX, topY]] = generatedVertices({ sides: 3, circumradius: 10 });
expect(topX).toBeCloseTo(0, 10);
expect(topY).toBeCloseTo(-10, 10);
```

Add rounded cases that prove generated vertex order is the `cornerRadii` index order and that the creator delegates to the same four-stage closed-polygon rounding from Task 4.

- [ ] **Step 2: Run the creator suite and confirm the missing module**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/regular-polygon.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the creator is absent.

- [ ] **Step 3: Implement size normalization, vertex generation, and the public wrapper**

Count present size keys by testing `!== undefined`; reject counts other than one before computing geometry. Retain the single validated key as `sizeKind`, normalize its validated value to `R`, generate `sides` vertices using the approved clockwise Canvas formula, compute extrema once, and pass vertices plus corner options to `createPolygonPath`.

```ts
const sizeKeys = (["circumradius", "inradius", "sideLength"] as const).filter(
  (key) => options[key] !== undefined,
);
if (sizeKeys.length !== 1) {
  throw pathRangeError(
    "circumradius|inradius|sideLength",
    options,
    "must provide exactly one size option",
  );
}
const sizeKind = sizeKeys[0];
const size = nonnegativeNumber(options[sizeKind], sizeKind);
const circumradius =
  sizeKind === "circumradius"
    ? size
    : sizeKind === "inradius"
      ? size / Math.cos(Math.PI / sides)
      : size / (2 * Math.sin(Math.PI / sides));

const vertices = Array.from({ length: sides }, (_, index) => {
  const angle = rotation + (index * Math.PI * 2) / sides;
  return [
    cx + circumradius * Math.cos(angle),
    cy + circumradius * Math.sin(angle),
  ] as const;
});
```

Expose only `createRegularPolygonPath` and its option types from the root package. Export the `{ path, vertices, bounds }` builder from the internal geometry module so the component can reuse it, but do not re-export that builder or record from `packages/core/src/index.ts`. Accept an optional `GeometryErrorFactory` in the internal builder so direct calls use `pathRangeError` and component structural failures become `LayoutDiagnostic` without duplicating validation.

- [ ] **Step 4: Write failing component tests**

Cover JSX/createElement leaf construction, all three component size modes, axis percentages for `cx`/`cy`, smaller-basis percentages for every size field and corner radius, default and explicit rotation, fill/stroke/opacity/cursor/line interaction, inside/outside pointer targeting, generated-extrema keyboard bounds, explicit bounds precedence, style updates, replacement/removal, transform and declared-box placement, unsupported intrinsic measurement, child rejection, and contextual diagnostics/recovery for count, exclusivity, size, rotation, and corner arrays.

```ts
const element = createElement(RegularPolygon, {
  style: {
    width: 240,
    height: 120,
    sides: 6,
    cx: "50%",
    cy: "50%",
    inradius: "25%",
    cornerRadius: "5%",
    fill: "#f00",
  },
  onClick,
});
expect(measureElement(element, constraints).status).toBe("unsupported");
```

- [ ] **Step 5: Implement RegularPolygon style resolution and rendering**

Define the discriminated component size union exactly as the spec. Resolve `cx` against width, `cy` against height, all three possible size fields and corners against `circularPercentageBasis(context)`, and `rotation` with the finite scalar resolver. Adapt structural errors to `layoutDiagnostic` with `sides` or the conflicting/missing size property path. Pass the private builder's path and default bounds to `renderPath`, preserving an explicit `keyboardNavigationBounds`.

Register `fill`, `stroke`, and `cursor` as opaque style properties. Use the ordinary drawing-leaf child contract and provide no measure function.

- [ ] **Step 6: Run all RegularPolygon evidence**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/regular-polygon.test.ts packages/core/src/lib/components/shape-style.test.ts packages/core/src/lib/components/rounded-corner-style.test.ts packages/core/src/lib/components/regular-polygon.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/standard-shape-allocation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: all suites and typecheck PASS.

- [ ] **Step 7: Commit RegularPolygon**

```bash
git add packages/core/src/lib/geometry/regular-polygon.ts packages/core/src/lib/geometry/regular-polygon.test.ts packages/core/src/lib/components/regular-polygon.ts packages/core/src/lib/components/regular-polygon.test.ts packages/core/src/lib/components/shape-style.ts packages/core/src/lib/components/shape-style.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/standard-shape-allocation.test.ts
git commit -m "feat(core): add regular polygon primitive"
```

### Task 7: Star geometry and drawing leaf

**Files:**

- Create: `packages/core/src/lib/geometry/star.ts`
- Create: `packages/core/src/lib/geometry/star.test.ts`
- Create: `packages/core/src/lib/components/star.ts`
- Create: `packages/core/src/lib/components/star.test.ts`
- Modify: `packages/core/src/lib/runtime-contract.test.ts`
- Modify: `packages/core/test/standard-shape-allocation.test.ts`

**Interfaces:**

- Consumes: Tasks 1, 4, and 6 validation, rounding, bounds, style-resolution, and drawing-leaf patterns.
- Produces:
  - `StarPathOptions`
  - internal-only `ResolvedStarGeometry = { path: Path2D; vertices: readonly (readonly [number, number])[]; bounds?: LayoutBox }`
  - internal-only `resolveStarGeometry(options, errorFactory?): ResolvedStarGeometry`
  - `createStarPath(options): Path2D`
  - `Star`, `StarProps`, and `StarStyle`

- [ ] **Step 1: Write failing Star creator tests**

Cover integer `points >= 3`, finite/nonnegative centers/radii/rotation, `innerRadius <= outerRadius`, either-zero empty path geometry, default outer tip at the top, explicit rotation, exactly `points * 2` alternating vertices, clockwise order, equal radii as a regular `points * 2`-gon, `cornerRadii` length against the generated corner count, rounded tips and valleys, six-point concave silhouette without triangle-crossing commands, and fresh identity. Define the same kind of local shared-recorder-based `generatedVertices(options)` helper here so the test observes creator output rather than copying the star formula. With real `Path2D`, prove the center and one arm hit while a concave notch and bounding-box corner miss.

```ts
const vertices = generatedVertices({
  points: 5,
  outerRadius: 20,
  innerRadius: 8,
});
expect(vertices).toHaveLength(10);
expect(vertices[0][0]).toBeCloseTo(0, 10);
expect(vertices[0][1]).toBeCloseTo(-20, 10);
expect(Math.hypot(...vertices[1])).toBeCloseTo(8, 10);
expect(Math.hypot(...vertices[2])).toBeCloseTo(20, 10);
expect(() =>
  createStarPath({ points: 5, outerRadius: 8, innerRadius: 9 }),
).toThrowError(/innerRadius.*outerRadius/);
```

- [ ] **Step 2: Run the creator suite and confirm it fails**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/star.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the creator is absent.

- [ ] **Step 3: Implement alternating-radius generation and wrapper**

Validate before allocating or iterating. Always generate `points * 2` vertices
and their extrema for default bounds. If either radius is zero, return an empty
path while retaining those generated default bounds; otherwise delegate the
vertices to `createPolygonPath`.

```ts
const vertices = Array.from({ length: points * 2 }, (_, index) => {
  const angle = rotation + (index * Math.PI) / points;
  const radius = index % 2 === 0 ? outerRadius : innerRadius;
  return [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ] as const;
});
```

Export the path/vertices/bounds builder only from the internal geometry module so `Star` can consume it. Do not export the builder or record from the root package. Give the builder an optional `GeometryErrorFactory`; the public wrapper defaults to `pathRangeError`, while the component passes a `layoutDiagnostic` adapter. Return only the fresh path from `createStarPath`.

- [ ] **Step 4: Write failing Star component tests**

Cover numeric and percentage style resolution, paint/cursor/interaction width, pointer targeting, generated-extrema/default and explicit keyboard bounds, updates/replacement/removal, transform and declared-box placement, unsupported measurement, leaf child rejection, inner/outer ordering, count/radius/rotation/corner diagnostics, and recovery after invalid render.

```ts
const element = createElement(Star, {
  style: {
    width: 200,
    height: 120,
    points: 6,
    cx: "50%",
    cy: "50%",
    outerRadius: "40%",
    innerRadius: "20%",
    cornerRadii: [2, 0],
    fill: "#fc0",
  },
});
expect(measureElement(element, constraints).status).toBe("unsupported");
```

- [ ] **Step 5: Implement the Star drawing leaf**

Define `StarStyle` exactly as the spec. Resolve centers by axis; both radii and corners by the smaller percentage basis; points, rotation, and ordering contextually. Call the private builder once, pass its path to `renderPath`, use its extrema unless explicit bounds were supplied, register `fill`/`stroke`/`cursor`, and add no intrinsic measurement.

- [ ] **Step 6: Run Star and shared lifecycle evidence**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/geometry/star.test.ts packages/core/src/lib/components/star.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/standard-shape-allocation.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
```

Expected: all suites and typecheck PASS.

- [ ] **Step 7: Commit Star**

```bash
git add packages/core/src/lib/geometry/star.ts packages/core/src/lib/geometry/star.test.ts packages/core/src/lib/components/star.ts packages/core/src/lib/components/star.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/standard-shape-allocation.test.ts
git commit -m "feat(core): add star primitive"
```

### Task 8: Root exports, JSX authoring, package consumers, and Studio declarations

**Files:**

- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/lib/focus/public-api.test.ts`
- Modify: `packages/core/test/jsx-authoring.test.tsx`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `playground/src/pibbl-editor-types.txt`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `docs/api-reference.md`

**Interfaces:**

- Consumes: all component, creator, options, and style exports from Tasks 1-7.
- Produces: the supported root `@pibbl/core` API with 58 runtime values and 140 named type exports; Bundler, NodeNext, packed-package, JSX, and Studio evidence for every new symbol.

- [ ] **Step 1: Add failing root-export and runtime parity assertions**

Extend the exact runtime lists in `public-api.test.ts` and `runtime.mjs` with `RegularPolygon`, `Star`, and all ten creator functions in alphabetical order. Require 58 runtime exports and assert each creator is callable from `@pibbl/core` rather than a source path.

```ts
const addedRuntimeValues = [
  "RegularPolygon",
  "Star",
  "createArcPath",
  "createCirclePath",
  "createEllipsePath",
  "createLinePath",
  "createPolygonPath",
  "createRectanglePath",
  "createRegularPolygonPath",
  "createStarPath",
  "createSvgPath",
  "createWedgePath",
] as const;
expect(Object.keys(core)).toHaveLength(58);
for (const name of addedRuntimeValues)
  expect(typeof core[name]).toBe("function");
```

- [ ] **Step 2: Add failing type and authoring coverage**

Import and instantiate `RegularPolygon`, `Star`, every creator, and all 18 new named types in the package consumer. Add JSX and `createElement` examples for each size variant and rounded style. Add `@ts-expect-error` cases for missing/multiple RegularPolygon size fields, missing Star radii, and `cornerRadius: "auto"`; keep numeric lower-bound checks such as `sides: 2` in runtime tests because TypeScript cannot encode that range in `number`.

```tsx
const regular = (
  <RegularPolygon style={{ sides: 6, sideLength: 20, fill: "red" }} />
);
const star = createElement(Star, {
  style: { points: 5, outerRadius: 20, innerRadius: 8, fill: "gold" },
});
const clipPath: Path2D = createRegularPolygonPath({ sides: 6, inradius: 30 });
```

The 18 new type exports are `RoundedCornerStyle`, `RoundedCornerPathOptions`, `RectanglePathOptions`, `CirclePathOptions`, `EllipsePathOptions`, `ArcPathOptions`, `WedgePathOptions`, `LinePathOptions`, `PolygonPathOptions`, `RegularPolygonPathPosition`, `RegularPolygonNumericSize`, `RegularPolygonPathOptions`, `StarPathOptions`, `SvgPathOptions`, `RegularPolygonProps`, `RegularPolygonStyle`, `StarProps`, and `StarStyle`.

- [ ] **Step 3: Run boundary tests and confirm missing exports/declarations**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/public-api.test.ts packages/core/test/jsx-authoring.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run test:package-consumer
node tooling/verify-studio-types.mjs
```

Expected: FAIL on missing root exports and Studio/package declarations.

- [ ] **Step 4: Export the supported surface and update declarations**

Export runtime values and named types explicitly from `packages/core/src/index.ts`; keep `types.ts` consistent with the repository's existing type bridge. Add exact public declarations to `pibbl-editor-types.txt`, including the discriminated RegularPolygon size union, and update `verify-studio-types.mjs` to expect 140 type exports and 58 runtime values. Update the API-reference marker blocks and count sentence from `46/122` to `58/140`.

Do not add compatibility aliases or deep entry points.

- [ ] **Step 5: Run source and packed consumer gates**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/focus/public-api.test.ts packages/core/test/jsx-authoring.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run typecheck
node tooling/verify-studio-types.mjs
corepack pnpm@11.21.0 run test:package-consumer
corepack pnpm@11.21.0 run test:package-consumer:packed
corepack pnpm@11.21.0 run playground:build
```

Expected: root/JSX tests, typecheck, Studio check, Bundler and NodeNext consumers, packed consumers, and playground build PASS.

- [ ] **Step 6: Commit the public surface**

```bash
git add packages/core/src/index.ts packages/core/src/types.ts packages/core/src/lib/focus/public-api.test.ts packages/core/test/jsx-authoring.test.tsx playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs playground/src/pibbl-editor-types.txt tooling/verify-studio-types.mjs docs/api-reference.md
git commit -m "feat(core): export rounded shapes and path creators"
```

### Task 9: Learning examples and deterministic clipping scenario

**Files:**

- Modify: `packages/scenarios/src/learning/drawing/rectangle.example.tsx`
- Modify: `packages/scenarios/src/learning/drawing/polygon.example.tsx`
- Create: `packages/scenarios/src/learning/drawing/regular-polygon.example.tsx`
- Create: `packages/scenarios/src/learning/drawing/star.example.tsx`
- Modify: `packages/scenarios/src/learning/composition/clip.example.tsx`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/drawing-shapes.example.tsx`
- Modify: `packages/scenarios/src/drawing-gallery.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `packages/core/test/drawing-gallery.test.ts`
- Modify after inspection: `packages/core/test/visual-baselines/tfc-09-drawing-shapes.expected.png`
- Modify by generator: `docs/scenario-index.md`

**Interfaces:**

- Consumes: Task 8 public `@pibbl/core` surface only.
- Produces: focused learning routes for rounded Rectangle, rounded Polygon, RegularPolygon, Star, and creator-based clipping; a deterministic public-API gallery scenario with semantic, interaction, clipping, and reviewed visual evidence.

- [ ] **Step 1: Add failing learning-catalog assertions**

Increase the unique learning-route expectation from 47 to 49. Add `drawing/regular-polygon` and `drawing/star` route assertions, exact API tags, runnable source checks, and creator-based `Clip` coverage. Preserve existing category/order invariants.

```ts
expect(routeIds).toContain("drawing/regular-polygon");
expect(routeIds).toContain("drawing/star");
expect(exampleFor("composition/clip").source).toContain(
  "createRegularPolygonPath",
);
```

- [ ] **Step 2: Write the four learning updates through the public package**

Add a rounded variant to the Rectangle and Polygon lessons. Add concise RegularPolygon examples showing the three mutually exclusive size modes and rotation; add Star examples showing `points`, outer/inner radii, and selective tip/valley rounding. Replace the clip lesson's manual shape formula with a memoized public creator call:

```tsx
const hexagon = useMemo(
  () => createRegularPolygonPath({ sides: 6, cx: 100, cy: 100, inradius: 72 }),
  [],
);
return <Clip style={{ d: hexagon }}>{children}</Clip>;
```

Give the new catalog entries stable orders `75` and `85`, unique routes, complete summaries, and exact API tags.

- [ ] **Step 3: Run learning evidence**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 run scenarios:check
```

Expected: learning tests and scenario catalog consistency PASS.

- [ ] **Step 4: Add failing semantic gallery assertions before changing the baseline**

Extend the existing `drawing-shapes` scenario with rounded Rectangle/Polygon, RegularPolygon, Star, and a `Clip` whose `d` is created by `createRegularPolygonPath`. Add state counters for hits inside retained geometry and misses in rounded cuts/outside the hexagonal clip. Update exact API tags. Assert representative interior/exterior pixels, generated shape hit results, and clipped content boundaries without comparing the screenshot yet.

```ts
await page.mouse.click(retainedStarX, retainedStarY);
expect(await readScenarioState(page)).toMatchObject({ starHits: 1 });
await page.mouse.click(roundedCutX, roundedCutY);
expect(await readScenarioState(page)).toMatchObject({ starHits: 1 });
expect(pixelAt(canvas, clippedOutsideHexagonX, clippedOutsideHexagonY)).toEqual(
  [248, 250, 252, 255],
);
```

- [ ] **Step 5: Run semantic gallery tests and confirm they fail against the old scenario**

Run only the semantic test name first:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/drawing-gallery.test.ts --browser.headless --browser.ui=false -t "drives every public shape update"
```

Expected: FAIL because the new state, shapes, and clipped pixels are absent.

- [ ] **Step 6: Implement the scenario through `@pibbl/core` and make semantic evidence green**

Import only supported root values. Construct the hexagon with `createRegularPolygonPath`, pass it to `Clip`, and use the same path or a creator-produced path for explicit targeting only where the scenario needs to prove reuse. Update scenario state and metadata deterministically, then rerun the Step 5 command until PASS.

- [ ] **Step 7: Inspect and accept the intentional visual change**

Run the whole gallery test to create expected/actual/diff artifacts:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/drawing-gallery.test.ts --browser.headless --browser.ui=false
```

Expected initially: semantic assertions PASS and the visual assertion FAIL because the approved scene changed. Open the expected, actual, and diff PNGs under the test output reported by Vitest. Verify that differences are confined to the planned rounded/new shapes and hexagonal clip. Only after that inspection, replace `tfc-09-drawing-shapes.expected.png` with the reviewed actual image and rerun the suite; expected final result: PASS.

- [ ] **Step 8: Regenerate the scenario index and commit evidence**

Run:

```bash
corepack pnpm@11.21.0 run scenarios:write-index
corepack pnpm@11.21.0 run scenarios:check
```

Then commit:

```bash
git add packages/scenarios/src/learning/drawing/rectangle.example.tsx packages/scenarios/src/learning/drawing/polygon.example.tsx packages/scenarios/src/learning/drawing/regular-polygon.example.tsx packages/scenarios/src/learning/drawing/star.example.tsx packages/scenarios/src/learning/composition/clip.example.tsx packages/scenarios/src/learning-catalog.ts packages/scenarios/src/drawing-shapes.example.tsx packages/scenarios/src/drawing-gallery.ts packages/scenarios/src/catalog.ts packages/core/test/learning-examples.test.ts packages/core/test/drawing-gallery.test.ts packages/core/test/visual-baselines/tfc-09-drawing-shapes.expected.png docs/scenario-index.md
git commit -m "test: prove rounded shapes and path clipping"
```

### Task 10: Normative contracts, guides, and preservation fixtures

**Files:**

- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/guides/components-props-and-style.md`
- Modify: `docs/guides/layout-groups-clips-and-layers.md`
- Modify: `docs/library-status.md`
- Modify: `tooling/docs-contract-preservation-baseline.json`
- Modify: `tooling/docs-contract-preservation.mjs`

**Interfaces:**

- Consumes: the shipped behavior and public names from Tasks 1-9.
- Produces: normative documentation for rounding, RegularPolygon, Star, creators, composition, validation, layout, and deliberate non-goals; an updated reviewed documentation-preservation manifest/hash.

- [ ] **Step 1: Add the intended documentation text and examples**

Document the exact radius fallback expression, index order per shape, smaller-dimension percentage basis, overlong-array rejection, global polygon scaling, native rectangle scaling/remapping, zero behavior, signed rectangles, creator freshness/numeric-only inputs, and `RangeError` versus `LayoutDiagnostic`. Document all three RegularPolygon size formulas, Star's concave silhouette/point meaning, default `-Math.PI / 2` rotation, clockwise generation, bounds, no intrinsic measurement, and the explicit non-goals.

Include a supported clipping example:

```tsx
const hexagon = createRegularPolygonPath({
  sides: 6,
  cx: 120,
  cy: 90,
  inradius: 70,
  cornerRadius: 6,
});

<Clip style={{ d: hexagon }}>
  <Image style={{ src, x: 40, y: 10, width: 160, height: 160 }} />
</Clip>;
```

State that callers use `useMemo` when stable creator identity is desired; do not advertise new per-shape hooks.

- [ ] **Step 2: Run documentation preservation and capture the intentional mismatch**

Run:

```bash
corepack pnpm@11.21.0 run docs:check
```

Expected initially: FAIL because protected contract hashes/additions changed intentionally.

- [ ] **Step 3: Review and update the preservation fixture**

Update only affected unit hashes, current-unit additions, and the explicit addition allowlist in `docs-contract-preservation-baseline.json`. Recompute the manifest digest exactly as the verifier does—SHA-256 over `JSON.stringify(manifest)`—and replace `REVIEWED_MANIFEST_SHA256` in `docs-contract-preservation.mjs`. Inspect the diff to ensure no protected section disappeared unintentionally.

- [ ] **Step 4: Run all documentation and link checks**

Run:

```bash
corepack pnpm@11.21.0 run docs:check
corepack pnpm@11.21.0 run scenarios:check
corepack pnpm@11.21.0 run lint:format
```

Expected: documentation preservation, links, scenario index, and formatting PASS.

- [ ] **Step 5: Commit normative documentation**

```bash
git add docs/design/drawing-components-contract.md docs/design/style-system-contract.md docs/guides/components-props-and-style.md docs/guides/layout-groups-clips-and-layers.md docs/library-status.md tooling/docs-contract-preservation-baseline.json tooling/docs-contract-preservation.mjs
git commit -m "docs: document rounded shapes and path creators"
```

### Task 11: Full verification, implementation record, and approved-spec audit

**Files:**

- Create: `docs/testing/field-notes/2026-09-08-rounded-shapes-and-path-creators.md`
- Modify: `docs/superpowers/specs/2026-09-08-rounded-shapes-and-path-creators-design.md`
- Modify: `docs/superpowers/plans/2026-09-08-rounded-shapes-and-path-creators-implementation.md`
- Modify if verification exposes intentional contract additions: `tooling/docs-contract-preservation-baseline.json`
- Modify if the reviewed manifest changes: `tooling/docs-contract-preservation.mjs`

**Interfaces:**

- Consumes: all implementation and evidence from Tasks 1-10 plus the repository trust gate.
- Produces: a fresh aggregate verification result, dated field note, and historical implemented status for the spec/plan.

- [ ] **Step 1: Audit implementation against every approved design section**

Use `rg` and the test names to account for all ten creators, four rounded components, two new leaves, both radius properties, all validation paths, all zero cases, pixel-grid order, size formulas, star silhouette, keyboard bounds, layout/measurement boundaries, public declarations, package consumers, Studio, learning examples, clipping scenario, docs, and visual review. Confirm there is exactly one production path formula per shape and no new generic shape/cache/hook API.

```bash
rg "export (function|const) (createRectanglePath|createCirclePath|createEllipsePath|createArcPath|createWedgePath|createLinePath|createPolygonPath|createRegularPolygonPath|createStarPath|createSvgPath|RegularPolygon|Star)" packages/core/src
rg "new Path2D|\.rect\(|\.roundRect\(|\.arcTo\(|\.ellipse\(|\.arc\(" packages/core/src/lib/components packages/core/src/lib/hooks packages/core/src/lib/geometry
```

Expected: root exports point to the geometry modules; components/hooks delegate rather than repeat construction, except `Path`, which intentionally consumes a caller-owned path.

- [ ] **Step 2: Run the complete aggregate trust gate**

From the repository root on Node 24.15 or newer with Playwright Chromium available, run:

```bash
node --version
corepack pnpm@11.21.0 --version
corepack pnpm@11.21.0 trust
```

Expected: Node reports `v24.15.0` or newer on the v24 line, pnpm reports `11.21.0`, and the aggregate gate PASSes documentation/export/link consistency, catalogs, typecheck, lint/format, builds, source/packed consumers, browser/visual suites, built smoke, cleanup, and structural performance evidence.

- [ ] **Step 3: Diagnose any failure before changing code or evidence**

For a failure, rerun only the named failing command/test, determine whether it is implementation, expectation, environment, or intentional visual drift, and fix the smallest responsible slice. Never refresh a baseline solely because the comparison failed. After a focused fix passes, rerun the full trust gate.

- [ ] **Step 4: Record fresh evidence and implementation status**

Create the field note with date, exact Node/pnpm/Chromium environment, aggregate command, fresh pass/fail totals as printed, visual-inspection rationale, public export counts `58/140`, and any narrowly documented platform qualification. Change the design status to `implemented on 2026-09-08` and add `> **Historical status: IMPLEMENTED PLAN.**` below this plan's title only after the full gate passes.

- [ ] **Step 5: Re-run documentation checks after the record changes**

If documentation preservation reports the new field note/status as an intentional addition, review and update the fixture/hash using Task 10's exact process. Then run:

```bash
corepack pnpm@11.21.0 run docs:check
corepack pnpm@11.21.0 run lint:format
git diff --check
git status --short
```

Expected: checks PASS; status lists only the intended final documentation plus the user's pre-existing unrelated changes.

- [ ] **Step 6: Commit the implementation record**

```bash
git add docs/testing/field-notes/2026-09-08-rounded-shapes-and-path-creators.md docs/superpowers/specs/2026-09-08-rounded-shapes-and-path-creators-design.md docs/superpowers/plans/2026-09-08-rounded-shapes-and-path-creators-implementation.md tooling/docs-contract-preservation-baseline.json tooling/docs-contract-preservation.mjs
git commit -m "docs: record rounded shapes verification"
```

- [ ] **Step 7: Report completion without using historical totals**

Report the shipped API, the aggregate command and fresh outcome, the reviewed visual change, the field-note path, and any remaining unrelated working-tree files. Quote only totals produced by the Step 2 run; do not reuse counts from older documentation.
