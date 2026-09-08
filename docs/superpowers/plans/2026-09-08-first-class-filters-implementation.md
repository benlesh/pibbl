# First-Class Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed CSS-like `style.filter` effects to every CRC primitive, with combined-subtree silhouettes, ordered lists, inside-out nesting, upright local offscreen rendering, and exact interaction/lifecycle behavior.

**Architecture:** Render dispatch recognizes the framework-owned filter portion of every primitive style and turns a non-empty list into one immediate-mode composition boundary. Each boundary renders once into a pooled upright local `OffscreenCanvas`, applies one native Canvas filter chain into a second pooled surface, then applies the primitive's deferred presentation transform and clip while compositing into its parent; a separate render-target/world-transform model keeps paint and interaction geometry aligned. `Layer` remains the persistent caching boundary, while filter surfaces are transient and owned by one `CRCInstance`.

**Tech Stack:** TypeScript, HTML Canvas 2D and `OffscreenCanvasRenderingContext2D.filter`, DOMMatrix, CRC JSX/createElement runtime, Vitest Browser with Playwright Chromium, pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-09-08-first-class-filters-design.md`

## Global Constraints

- Preserve unrelated working-tree changes and untracked files; stage only files named by the active task.
- Public authors import only from `@crc/core`; no public source or `lib/*` imports.
- The public property is `style.filter`, not `boxShadow`, `box-shadow`, or a raw CSS string.
- Support exactly `blur`, `brightness`, `contrast`, `dropShadow`, `grayscale`, `hueRotate`, `invert`, `opacity`, `saturate`, and `sepia`; do not add `url()` or `backdrop-filter`.
- A filter receives the combined output of the primitive and all descendants it returns.
- One descriptor is a one-item list; an empty list is a no-op with no offscreen capability requirement.
- Lists execute in declaration order in one native filter operation; nested boundaries execute from the inside out.
- Blur values are Gaussian standard deviations; use `BLUR_EXTENT_FACTOR = (3 * Math.sqrt(2 * Math.PI)) / 4` for finite capture expansion.
- Runtime-created offscreen surfaces are upright local targets; effects run locally and the parent-facing transform is applied exactly once at composite time.
- Filter pixels never alter measurement, layout, hit testing, focus bounds, pointer coordinates, or cursor regions.
- Require browser `OffscreenCanvas` and Canvas `filter` support only for non-empty filters; provide no DOM-canvas fallback and no silent resolution reduction.
- Do not use `getImageData`, `putImageData`, JavaScript pixel loops, shrink-and-resize blur, `ImageBitmap`, or a retained display list in production filter code.
- Preserve `Group` semantics, source paint order, root-logical events, component identity, scheduled updates, render-failure teardown, and Layer cache behavior.
- Add a failing test before each production change; prefer semantic state/geometry assertions before visual assertions.
- Use Node 24.15 or newer, pnpm 11.21.0, and Playwright Chromium for final evidence.

## File and responsibility map

- `packages/core/src/lib/style/filter-types.ts`: public descriptor interfaces and `CRCFilter` union only.
- `packages/core/src/lib/style/filter.ts`: immutable normalization, validation, native-string compilation, and resolved-list access.
- `packages/core/src/lib/render-target.ts`: active local target metadata and conversion from actual paint CTM to root-logical world CTM.
- `packages/core/src/lib/filter/filter-region.ts`: reverse filter influence, transform inversion, raster density, and backing-window math.
- `packages/core/src/lib/filter/filter-surface-pool.ts`: transient source/result `OffscreenCanvas` ownership, reset, reuse, counters, and disposal.
- `packages/core/src/lib/filter/canvas-state.ts`: explicit transfer of source-paint state while excluding parent compositing state.
- `packages/core/src/lib/filter/render-filter-boundary.ts`: one capture/filter/composite transaction with complete `finally` restoration.
- `packages/core/src/lib/primitive-presentation.ts`: private Group transform and Clip metadata plus direct/deferred application.
- `packages/core/src/lib/render.ts`: resolve once and choose the unchanged direct path or filtered boundary around one primitive program.
- `packages/core/src/lib/{global-state.ts,execute-render.ts,mount-crc.ts,types.ts}`: current target/world state and instance-owned pool lifecycle.
- `packages/core/src/lib/{events/registrations.ts,util/push-clipping-path.ts,components/layer.ts}`: consume root-logical world transforms rather than assuming the active paint context is the instance surface.
- `packages/core/src/lib/components/{g.ts,clip.ts}`: publish private declarative presentation metadata while retaining the direct fast path.
- `packages/scenarios/src/learning/composition/filters.example.tsx`: approachable ordered-list and combined-silhouette lesson.
- `packages/scenarios/src/filter-lab.example.tsx` and `packages/scenarios/src/filter-lab.ts`: deterministic public-API conformance laboratory.
- `packages/core/test/filter-lab.test.ts`: semantic, pixel, interaction, and inspected visual evidence for the public laboratory.
- `packages/core/test/filter-ownership.test.ts` and `packages/core/test/filter-performance.test.ts`: exact pool lifecycle and structural-cost evidence.
- `packages/core/test/visual-baselines/first-class-filters.expected.png`: reviewed Chromium baseline for stable non-sensitive regions.
- `packages/core/src/index.ts`, package consumers, Studio declarations, contracts, guides, API reference, and library status: one consistent public surface and explanation.

---

### Task 1: Public filter model and pure compiler

**Files:**

- Create: `packages/core/src/lib/style/filter-types.ts`
- Create: `packages/core/src/lib/style/filter.ts`
- Create: `packages/core/src/lib/style/filter.test.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/style/types.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `LayoutDiagnostic`, `layoutDiagnostic`, `StyleResolutionContext`, and `SystemStyle`.
- Produces:
  - the ten `CRC*Filter` descriptor interfaces and `CRCFilter` union from the spec;
  - `ResolvedFilterList { readonly values: readonly CRCFilter[] }`;
  - `resolveFilterList(value, context): ResolvedFilterList | undefined`;
  - `compileFilterList(value, backingPixelsPerLogicalUnit): string`;
  - `getResolvedFilterList(style): ResolvedFilterList | undefined`.

- [ ] **Step 1: Write failing descriptor-normalization and compiler tests**

Create table-driven tests with this exact representative input/output and a case for every discriminator:

```ts
const resolved = resolveFilterList(
  [
    { type: "grayscale", amount: 2 },
    {
      type: "dropShadow",
      offsetX: 4,
      offsetY: -6,
      blurRadius: 3,
      color: "rgb(0 0 0 / 50%)",
    },
    { type: "hueRotate", degrees: -450 },
  ],
  context,
);

expect(resolved?.values).toEqual([
  { type: "grayscale", amount: 1 },
  {
    type: "dropShadow",
    offsetX: 4,
    offsetY: -6,
    blurRadius: 3,
    color: "rgb(0 0 0 / 50%)",
  },
  { type: "hueRotate", degrees: -450 },
]);
expect(compileFilterList(resolved!, 2)).toBe(
  "grayscale(1) drop-shadow(8px -12px 6px rgb(0 0 0 / 50%)) hue-rotate(-450deg)",
);
```

Also assert single-to-list normalization, `[] -> undefined`, default
`dropShadow.blurRadius: 0`, preserved values above one for brightness/contrast/
saturate, clamping to one for grayscale/invert/opacity/sepia, caller-array and
descriptor immutability, finite/nonnegative rules, unknown discriminators, and
property paths such as `filter[2].amount`. Reject `currentColor` case
insensitively and any `var(...)` reference as contextual rather than concrete;
leave all other color syntax to Task 5's native parser.

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/style/filter.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `filter-types.ts` and `filter.ts` do not exist.

- [ ] **Step 3: Define the public discriminated union and attach it to SystemStyle**

Use the exact interfaces from the spec in `filter-types.ts`. In `types.ts`, use
a type-only import and add:

```ts
export interface SystemStyle {
  custom?: unknown;
  filter?: CRCFilter | readonly CRCFilter[];
}
```

Re-export all eleven public type names from `packages/core/src/index.ts`.
Update `LayoutParticipationKey` in `style/types.ts` to exclude both framework
system keys:

```ts
type LayoutParticipationKey = Exclude<
  keyof BoxStyle | keyof LayoutItemStyle,
  "custom" | "filter"
>;
```

This keeps `filter` in every `ResolvedDrawingStyle` instead of accidentally
treating it as a layout-only field merely because `BoxStyle` extends
`SystemStyle`.

- [ ] **Step 4: Implement immutable numeric normalization and density-aware compilation**

Use exhaustive switching so a new discriminator cannot silently compile:

```ts
export function compileFilterList(
  resolved: ResolvedFilterList,
  density: number,
): string {
  return resolved.values
    .map((value) => {
      switch (value.type) {
        case "blur":
          return `blur(${value.radius * density}px)`;
        case "dropShadow":
          return `drop-shadow(${value.offsetX * density}px ${value.offsetY * density}px ${(value.blurRadius ?? 0) * density}px ${value.color})`;
        case "hueRotate":
          return `hue-rotate(${value.degrees}deg)`;
        case "brightness":
        case "contrast":
        case "grayscale":
        case "invert":
        case "opacity":
        case "saturate":
        case "sepia":
          return `${cssFunctionName(value.type)}(${value.amount})`;
        default:
          return assertNever(value);
      }
    })
    .join(" ");
}
```

Throw contextual `layoutDiagnostic(...)` values for invalid fields. Do not parse
colors here; native color acceptance is added when a real result context exists.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/style/filter.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: filter tests PASS and typecheck PASS.

- [ ] **Step 6: Commit the public model**

```bash
git add packages/core/src/lib/style/filter-types.ts packages/core/src/lib/style/filter.ts packages/core/src/lib/style/filter.test.ts packages/core/src/lib/types.ts packages/core/src/lib/style/types.ts packages/core/src/index.ts
git commit -m "feat(core): define typed filter styles"
```

### Task 2: Framework-owned style propagation and measurement exclusion

**Files:**

- Create: `packages/core/src/lib/style/resolve-dispatch.test.ts`
- Modify: `packages/core/src/lib/style/resolve-dispatch.ts`
- Modify: `packages/core/src/lib/layout/measure.ts`
- Modify: `packages/core/src/lib/layout/measure.test.ts`

**Interfaces:**

- Consumes: Task 1 `resolveFilterList` and existing specified/pre-normalized style paths.
- Produces:
  - `extractSystemFilter(style): CRCFilter | readonly CRCFilter[] | undefined`;
  - `withoutSystemFilter(style): Readonly<SystemStyle>`;
  - resolved primitive styles whose `filter`, when active, is the canonical readonly list from Task 1.

- [ ] **Step 1: Write failing style-pipeline tests**

Define a custom primitive whose normalizer and resolver both return fresh objects
without `filter`. Resolve an element with a single invert descriptor and assert:

```ts
expect(normalizerInput).not.toHaveProperty("filter");
expect(resolverInput).not.toHaveProperty("filter");
expect(resolved.filter).toEqual([{ type: "invert", amount: 1 }]);
```

Repeat through `setPreNormalizedStyle`, proving the placed clone takes the
filter from its authoritative pre-normalized style and does not consume it
twice. Add a failure case proving `filter[1].radius = -1` throws before the
primitive render callback counter advances.

- [ ] **Step 2: Run the resolver test and confirm the filter is currently dropped**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/style/resolve-dispatch.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because custom style callbacks currently own the complete style.

- [ ] **Step 3: Extract the system filter around custom style callbacks**

In `resolveElementStyle`, select `preNormalized?.style ?? specified` as the
authoritative filter source, remove `filter` before invoking custom normalization
or resolution, then return a fresh final object with the canonical list attached:

```ts
const systemFilter = resolveFilterList(
  extractSystemFilter(preNormalized?.style ?? specified),
  context,
);
const normalized = normalizeWithoutSystemFilter(
  definition,
  specified,
  preNormalized,
);
const resolved = resolveWithoutSystemFilter(definition, normalized, context);
return systemFilter ? { ...resolved, filter: systemFilter.values } : resolved;
```

Run `assertResolvedValue` on the final result, but stop recursive allocation
inspection when the root property is `filter`. Numeric filter validation already
ran in `resolveFilterList`, while concrete color validation waits for the native
result context in Task 5.

- [ ] **Step 4: Write the failing measurement isolation test**

In `measure.test.ts`, define a measuring primitive that records the style it
receives and returns `{ width: 12, height: 8 }`. Measure identical elements with
and without an invalid browser-only color string:

```ts
expect(measureElement(filtered, constraints, service)).toEqual({
  status: "measured",
  size: { width: 12, height: 8 },
});
expect(measureStyle).not.toHaveProperty("filter");
expect(offscreenConstructor).not.toHaveBeenCalled();
```

- [ ] **Step 5: Make measurement omit filters before normalization and measure**

Strip the new system property from the specified or pre-normalized style before
calling `normalizeStyle` and never reattach it to `MeasureInput.style`. Do not
call `resolveFilterList` from measurement.

- [ ] **Step 6: Run resolver, measurement, and layout suites**

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/style/resolve-dispatch.test.ts packages/core/src/lib/layout/measure.test.ts packages/core/src/lib/layout/absolute.test.ts packages/core/src/lib/layout/flex.test.ts packages/core/src/lib/layout/grid.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 7: Commit system-style ownership**

```bash
git add packages/core/src/lib/style/resolve-dispatch.ts packages/core/src/lib/style/resolve-dispatch.test.ts packages/core/src/lib/layout/measure.ts packages/core/src/lib/layout/measure.test.ts
git commit -m "feat(core): own filters in style dispatch"
```

### Task 3: Local render targets and root-logical world transforms

**Files:**

- Create: `packages/core/src/lib/render-target.ts`
- Create: `packages/core/src/lib/render-target.test.ts`
- Modify: `packages/core/src/lib/global-state.ts`
- Modify: `packages/core/src/lib/execute-render.ts`
- Modify: `packages/core/src/lib/events/registrations.ts`
- Modify: `packages/core/src/lib/util/push-clipping-path.ts`
- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/surface/transform.ts`

**Interfaces:**

- Consumes: `CRCSurfaceSnapshot`, active `RenderingContext2D`, and current DOMMatrix transforms.
- Produces:
  - `RenderTargetSnapshot { logicalBounds, backingWidth, backingHeight, renderTransform, inverseRenderTransform }`;
  - `rootRenderTarget(surface): RenderTargetSnapshot`;
  - `getCurrentPaintTransform(): DOMMatrix` in active-target logical units;
  - `getCurrentWorldTransform(): DOMMatrix` in owning-instance root logical units;
  - `withRenderTarget(context, target, worldBase, work): T` with exact restoration.

- [ ] **Step 1: Write failing matrix and restoration tests**

Cover a root density transform, a local target whose logical bounds start at
`(-20, 10)`, a world base with translation/rotation, and an imperative local
`ctx.scale(2, 3)`. Assert:

```ts
expect(matrixValues(getCurrentPaintTransform())).toEqual(
  matrixValues(new DOMMatrix().scale(2, 3)),
);
expect(matrixValues(getCurrentWorldTransform())).toEqual(
  matrixValues(worldBase.scale(2, 3)),
);
```

Throw inside nested `withRenderTarget` calls and assert context, target, and
world base all return to their exact previous object/matrix values.

- [ ] **Step 2: Run the focused target test and confirm missing APIs**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/render-target.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on the missing module and global fields.

- [ ] **Step 3: Add active target and world-base fields with transactional restoration**

Extend `GlobalState` with:

```ts
renderTarget: RenderTargetSnapshot | undefined;
worldBaseTransform: DOMMatrix | undefined;
```

Initialize them in `executeRender` from the prepared root/layer surface and an
identity world base. Include both in the existing previous-state snapshot,
`clearTempState`, and `finally` restoration. Implement current-world conversion
as `worldBase.multiply(target.inverseRenderTransform.multiply(ctx.getTransform()))`.

- [ ] **Step 4: Route interaction, clips, and Layer bridges through the world helper**

Replace the three direct assumptions about
`toLogicalTransform(getSurfaceSnapshot(instance), ctx.getTransform())` with
`getCurrentWorldTransform()`: target registration, clipping-stack publication,
and the parent-side `CRCInteractionLayer.transform`. Keep the child Layer root
world base as identity so its existing bridge composes it into the parent.

- [ ] **Step 5: Run transform, event, Clip, Group, and Layer regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/render-target.test.ts packages/core/src/lib/surface/transform.test.ts packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/components/event-integration.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS without filter rendering yet.

- [ ] **Step 6: Commit the render-target split**

```bash
git add packages/core/src/lib/render-target.ts packages/core/src/lib/render-target.test.ts packages/core/src/lib/global-state.ts packages/core/src/lib/execute-render.ts packages/core/src/lib/events/registrations.ts packages/core/src/lib/util/push-clipping-path.ts packages/core/src/lib/components/layer.ts packages/core/src/lib/surface/transform.ts
git commit -m "refactor(core): separate paint and world transforms"
```

### Task 4: Filter region math and instance-owned scratch surfaces

**Files:**

- Create: `packages/core/src/lib/filter/filter-region.ts`
- Create: `packages/core/src/lib/filter/filter-region.test.ts`
- Create: `packages/core/src/lib/filter/filter-surface-pool.ts`
- Create: `packages/core/src/lib/filter/filter-surface-pool.test.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/mount-crc.ts`
- Modify: `packages/core/src/lib/global-state.ts`

**Interfaces:**

- Consumes: Task 1 `ResolvedFilterList`, Task 3 `RenderTargetSnapshot`, `LayoutBox`, and `CRCInstance`.
- Produces:
  - `BLUR_EXTENT_FACTOR` with the exact spec formula;
  - `reverseFilterInfluence(output, filters): LayoutBox`;
  - `largestAffineScale(matrix): number`;
  - `resolveFilterWindow(parentTarget, parentPaintTransform, filters): FilterWindow | 'discard'`;
  - `FilterWindow { logicalBounds, density, backingWidth, backingHeight, renderTransform, inverseRenderTransform }`;
  - `FilterSurfacePool.checkout(window): FilterSurfaceLease`;
  - `FilterSurfacePool.snapshot()` and idempotent `dispose()`.

- [ ] **Step 1: Write failing reverse-influence and density tests**

Use exact rectangles to prove reverse list order:

```ts
const output = { x: 0, y: 0, width: 100, height: 50 };
const filters = resolveFilterList(
  [
    {
      type: "dropShadow",
      offsetX: 10,
      offsetY: -4,
      blurRadius: 2,
      color: "black",
    },
    { type: "blur", radius: 3 },
  ],
  context,
)!;
const required = reverseFilterInfluence(output, filters);
```

Compute the expected value in the test from
`Math.ceil(radius * BLUR_EXTENT_FACTOR)`, first expanding for the final blur,
then unioning that rectangle with the reverse-offset/expanded shadow input.
Assert color-only filters leave the rectangle unchanged. Test largest singular
scale for identity, rotation, uniform scale, nonuniform scale, skew, and a zero
determinant.

- [ ] **Step 2: Run region tests and confirm missing implementation**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/filter/filter-region.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the region module does not exist.

- [ ] **Step 3: Implement transform inversion, conservative bounds, and pixel snapping**

Project all four parent logical-bound corners through the inverse current paint
transform, take finite extrema, reverse the list influence, then use:

```ts
const backingX = Math.floor(bounds.x * density);
const backingY = Math.floor(bounds.y * density);
const backingRight = Math.ceil((bounds.x + bounds.width) * density);
const backingBottom = Math.ceil((bounds.y + bounds.height) * density);
```

Return `'discard'` for non-finite/non-invertible transforms. Reject backing
dimensions outside finite positive unsigned-long Canvas dimensions with a
component-aware error at checkout time.

- [ ] **Step 4: Write failing pool ownership tests**

Assert two simultaneous leases acquire distinct slots, released siblings reuse
slot identity, nested pairs grow capacity to four, a changed size increments
`resized`, every checkout clears pixels and resets `filter`, transform, alpha,
composite, shadow, dash, and smoothing state, double release is inert, and
dispose reports:

```ts
expect(pool.snapshot()).toEqual({
  acquired: 4,
  checkedOut: 0,
  returned: 6,
  resized: expectedResizes,
  released: 4,
  live: 0,
});
```

- [ ] **Step 5: Implement pool leases and CRCInstance ownership**

Create `OffscreenCanvas` only on first needed checkout. Store one context per
slot, mark it checked out, resize when backing dimensions differ, reset to a
known state, and return an idempotent lease:

```ts
interface FilterSurfaceLease {
  readonly canvas: OffscreenCanvas;
  readonly context: OffscreenCanvasRenderingContext2D;
  readonly target: RenderTargetSnapshot;
  release(): void;
}
```

Initialize one pool in `mountCRC`, add it to `CRCInstance`, and dispose it from
`cleanupCRCInstance` after component teardowns. Pool creation itself must not
construct an OffscreenCanvas.

- [ ] **Step 6: Run region, pool, mount, and lifecycle regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/filter/filter-region.test.ts packages/core/src/lib/filter/filter-surface-pool.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS and unfiltered mounts acquire zero surfaces.

- [ ] **Step 7: Commit capture geometry and ownership**

```bash
git add packages/core/src/lib/filter/filter-region.ts packages/core/src/lib/filter/filter-region.test.ts packages/core/src/lib/filter/filter-surface-pool.ts packages/core/src/lib/filter/filter-surface-pool.test.ts packages/core/src/lib/types.ts packages/core/src/lib/mount-crc.ts packages/core/src/lib/global-state.ts
git commit -m "feat(core): own reusable filter surfaces"
```

### Task 5: Basic combined-subtree filter boundary

**Files:**

- Create: `packages/core/src/lib/filter/canvas-state.ts`
- Create: `packages/core/src/lib/filter/canvas-state.test.ts`
- Create: `packages/core/src/lib/filter/render-filter-boundary.ts`
- Create: `packages/core/src/lib/filter/filter-rendering.test.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/style/filter.ts`

**Interfaces:**

- Consumes: Tasks 1-4 compiler, target, region, and pool APIs.
- Produces:
  - `copyFilterSourceState(parent, source): void`;
  - `assertNativeFilter(context, cssText, component): void`;
  - `renderFilterBoundary(input, renderSubtree): void`;
  - render dispatch that resolves style once and encloses the primitive callback plus all returned descendants.

- [ ] **Step 1: Write failing Canvas-state transfer tests**

Set line, text, fill/stroke, dash, and smoothing values on a parent context and
alpha/composite/filter/shadow values that must remain parent-only. After copying,
assert the source received the former set and retained defaults for:

```ts
expect(source.globalAlpha).toBe(1);
expect(source.globalCompositeOperation).toBe("source-over");
expect(source.filter).toBe("none");
expect(source.shadowColor).toBe("rgba(0, 0, 0, 0)");
```

The explicit copied list is `direction`, `fillStyle`, `font`, `fontKerning`,
`fontStretch`, `fontVariantCaps`, `imageSmoothingEnabled`,
`imageSmoothingQuality`, `letterSpacing`, `lineCap`, line dash,
`lineDashOffset`, `lineJoin`, `lineWidth`, `miterLimit`, `strokeStyle`,
`textAlign`, `textBaseline`, `textRendering`, and `wordSpacing`; guard newer
properties with `'property' in context`.

- [ ] **Step 2: Run state tests and confirm the missing helper**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/filter/canvas-state.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on the missing module.

- [ ] **Step 3: Implement explicit state copying without copying the current path**

Assign only the documented properties, clone line dash with
`source.setLineDash(parent.getLineDash())`, and leave transform installation to
the boundary. Do not attempt to copy the implicit current path or active clip.

- [ ] **Step 4: Write failing simple-boundary browser tests**

Use public `Rectangle`, `Path`, `Text`, `Image`, and one `definePrimitive`
probe. Assert all of the following in separate tests:

- one `Path` fill plus stroke produces one alpha-derived drop shadow;
- two overlapping children of a filtered container are captured as one group;
- `filter: []` creates no OffscreenCanvas and takes the existing direct path;
- a three-function list assigns one string in declaration order and performs
  exactly source-to-result plus result-to-parent `drawImage` calls;
- the primitive and each child callback execute exactly once;
- the custom primitive sees an `OffscreenCanvas` and an upright local CTM;
- production filter code never invokes `getImageData`, `putImageData`, or
  `transferToImageBitmap` (spies may read final test pixels only after render).

Representative combined-silhouette tree:

```ts
createElement(Group, {
  style: {
    filter: { type: "dropShadow", offsetX: 12, offsetY: 0, color: "black" },
  },
  children: [
    createElement(Rectangle, {
      style: { x: 10, y: 10, width: 30, height: 30, fill: "red" },
    }),
    createElement(Rectangle, {
      style: { x: 30, y: 10, width: 30, height: 30, fill: "blue" },
    }),
  ],
});
```

- [ ] **Step 5: Run the rendering test and confirm direct rendering cannot group output**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/filter/filter-rendering.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `render.ts` does not create a filter boundary.

- [ ] **Step 6: Refactor render.ts around one reusable primitive-program closure**

Resolve primitive style before invoking its callback. Keep component setup,
enhancers, hook finalization, `onAfterRender`, child materialization, and
save/restore in their current relative order. Pass a closure that performs the
single primitive callback and descendant traversal either directly or through
`renderFilterBoundary`; never call that closure twice.

- [ ] **Step 7: Implement source capture, native validation, and final composite**

Within `renderFilterBoundary`:

```ts
const source = pool.checkout(window);
const result = pool.checkout(window);
try {
  copyFilterSourceState(parent, source.context);
  source.context.setTransform(window.renderTransform);
  withRenderTarget(source.context, source.target, parentWorld, renderSubtree);

  const cssText = compileFilterList(filters, window.density);
  assertNativeFilter(result.context, cssText, component);
  result.context.drawImage(source.canvas, 0, 0);

  parent.drawImage(
    result.canvas,
    0,
    0,
    window.backingWidth,
    window.backingHeight,
    window.logicalBounds.x,
    window.logicalBounds.y,
    window.logicalBounds.width,
    window.logicalBounds.height,
  );
} finally {
  result.release();
  source.release();
}
```

For native acceptance, set `context.filter = 'none'`, assign the compiled value,
and reject when the property is absent or the readback remains `none`. Validate
each drop-shadow descriptor independently first so an invalid color reports its
exact list index and `.color` field. Include native rejection tests for
`"not-a-color"`, plus Task 1's explicit `currentColor` and `var(--shadow)`
rejections. CORS-tainted images remain supported because the production path
does no readback.

- [ ] **Step 8: Run focused filters plus representative primitive regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/filter/canvas-state.test.ts packages/core/src/lib/filter/filter-rendering.test.ts packages/core/src/lib/components/path.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/components/img.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 9: Commit the first working boundary**

```bash
git add packages/core/src/lib/filter/canvas-state.ts packages/core/src/lib/filter/canvas-state.test.ts packages/core/src/lib/filter/render-filter-boundary.ts packages/core/src/lib/filter/filter-rendering.test.ts packages/core/src/lib/render.ts packages/core/src/lib/style/filter.ts
git commit -m "feat(core): render combined subtree filters"
```

### Task 6: Deferred Group transforms, Clip order, and interaction parity

**Files:**

- Create: `packages/core/src/lib/primitive-presentation.ts`
- Create: `packages/core/src/lib/primitive-presentation.test.ts`
- Modify: `packages/core/src/lib/element/metadata.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/filter/render-filter-boundary.ts`
- Modify: `packages/core/src/lib/components/g.ts`
- Modify: `packages/core/src/lib/components/g.test.ts`
- Modify: `packages/core/src/lib/components/clip.ts`
- Modify: `packages/core/src/lib/components/clip.test.ts`
- Modify: `packages/core/src/lib/util/push-clipping-path.ts`
- Modify: `packages/core/src/lib/components/event-integration.test.ts`

**Interfaces:**

- Consumes: Task 3 world-transform helper and Task 5 boundary closure.
- Produces:
  - private `PrimitivePresentation { transform?: DOMMatrix; clip?: { path: Path2D; fillRule: CanvasFillRule } }`;
  - `setPrimitivePresentation(type, resolve)` and `getPrimitivePresentation(type, style)` WeakMap metadata;
  - `enterPrimitivePresentation(...)` returning an idempotent release function;
  - `createGroupTransform(style): DOMMatrix` shared by direct and deferred paths.

- [ ] **Step 1: Write failing private-presentation unit tests**

Prove Group's exact existing order—scale, rotation around origin, translation,
skew X, skew Y—and Clip's default `nonzero` rule. Prove direct entry applies
transform and paint clip immediately, while deferred entry leaves the source
paint CTM/clip upright but publishes `parentWorld.multiply(transform)` and the
same world-space clipping entry.

- [ ] **Step 2: Run the focused presentation test and confirm metadata is absent**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/primitive-presentation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because presentation metadata does not exist.

- [ ] **Step 3: Implement private metadata and refactor Group/Clip callbacks**

Keep `PrimitiveCapabilities` public and unchanged. Store presentation resolvers
in a separate private WeakMap keyed by the primitive component. Make Group and
Clip render callbacks return `props.children` without mutating the context;
register their transform/clip resolvers immediately after `definePrimitive`.

- [ ] **Step 4: Apply presentation directly or defer it through the filter boundary**

For an unfiltered element, enter presentation before invoking the primitive and
release after descendants/onAfterRender. For a filtered element:

- omit the receiving transform and paint clip from the source target;
- multiply the source world base by the presentation transform;
- publish the receiving logical clip during descendant registration without
  clipping source pixels;
- on the parent context, save, apply the transform, apply the local clip, draw
  the filtered bitmap, then restore.

The final Canvas sequence must represent:

```text
local subtree -> filter -> receiving clip -> receiving transform -> parent state
```

- [ ] **Step 5: Write transform, clip, and hit-parity browser tests**

Add assertions that a rotated filtered Group has a locally horizontal shadow
before rotation, a nonuniformly scaled local circular blur stretches after
filtering, and a custom child sees an upright offscreen CTM while its registered
event target receives the fully transformed world matrix. Click the original
transformed shape successfully and click a shadow-only pixel unsuccessfully.

For Clip, create three distinct trees and inspect pixels/targets:

1. filter on the Clip itself: filter first, then that Clip;
2. filter inside an ancestor Clip: completed filter output is ancestor-clipped;
3. descendant Clip inside a filtered Group: clipped descendants form the source
   silhouette before the Group filter.

- [ ] **Step 6: Run Group, Clip, interaction, and geometry matrices**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/primitive-presentation.test.ts packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/components/event-integration.test.ts packages/core/test/geometry-composition.test.ts --browser.headless --browser.ui=false
```

Expected: all existing and new direct/filtered cases PASS.

- [ ] **Step 7: Commit presentation ordering**

```bash
git add packages/core/src/lib/primitive-presentation.ts packages/core/src/lib/primitive-presentation.test.ts packages/core/src/lib/element/metadata.ts packages/core/src/lib/render.ts packages/core/src/lib/filter/render-filter-boundary.ts packages/core/src/lib/components/g.ts packages/core/src/lib/components/g.test.ts packages/core/src/lib/components/clip.ts packages/core/src/lib/components/clip.test.ts packages/core/src/lib/util/push-clipping-path.ts packages/core/src/lib/components/event-integration.test.ts
git commit -m "feat(core): filter before group presentation"
```

### Task 7: Nested boundaries, Layer caching, state, and failure recovery

**Files:**

- Create: `packages/core/src/lib/filter/filter-integration.test.ts`
- Modify: `packages/core/src/lib/filter/render-filter-boundary.ts`
- Modify: `packages/core/src/lib/filter/filter-region.ts`
- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/components/layer.test.ts`
- Modify: `packages/core/src/lib/global-state.ts`
- Modify: `packages/core/src/lib/runtime-contract.test.ts`

**Interfaces:**

- Consumes: Tasks 1-6 complete boundary and presentation system.
- Produces: correct reentrant nesting, discard handling, Layer cache reuse, and exact temporary-state restoration.

- [ ] **Step 1: Write the failing inside-out nesting test**

Render this public tree and spy on result-context filter assignments and
source/result draw order:

```tsx
<Group style={{ filter: { type: "blur", radius: 4 } }}>
  <Group
    style={{
      filter: {
        type: "dropShadow",
        offsetX: 6,
        offsetY: 3,
        blurRadius: 2,
        color: "black",
      },
    }}
  >
    <Rectangle
      style={{
        x: 20,
        y: 20,
        width: 30,
        height: 30,
        fill: "red",
        filter: { type: "grayscale", amount: 1 },
      }}
    />
  </Group>
</Group>
```

Assert assignments occur `grayscale(1)`, then `drop-shadow(...)`, then
`blur(...)`; each primitive callback runs once; pool capacity reaches six slots;
and the final visible pixels contain the blurred shadowed grayscale subject.

- [ ] **Step 2: Write the ordered-single-boundary contrast test**

Put the same three descriptors on one Rectangle. Assert one pair of leases, one
native chain in the exact chosen order, and visibly different selected pixels
after swapping `grayscale` and `dropShadow`.

- [ ] **Step 3: Run integration tests and fix reentrant target/pool restoration**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/filter/filter-integration.test.ts --browser.headless --browser.ui=false
```

Expected before fixes: FAIL on nesting order, pool depth, or active target
restoration. Keep every nested context/target/world/pool change inside `finally`
and rerun until PASS.

- [ ] **Step 4: Add Layer cache and cross-instance tests**

Use a counter inside Layer children. Render a filtered Layer, rerender with only
the outer filter amount changed, and assert the child counter remains one while
the parent performs a new filter composite. Then put a filter inside the Layer
and assert its scratch pool belongs to the child instance, parent and child
interaction transforms still hit the same root-logical point, and removal
releases the child pool recursively.

- [ ] **Step 5: Add capture-edge, density, non-invertible, and parent-state tests**

Cover:

- off-viewport source pixels whose blur or negative-offset shadow reaches the
  visible first/last pixel column;
- device density two and a rotated/nonuniform transform, asserting square local
  kernel density before final affine scaling;
- zero-scale Group, asserting subtree execution once against the discard target,
  no final composite, and no leaked lease;
- parent `globalAlpha`, `globalCompositeOperation`, native filter, and native
  shadow applying once to the completed boundary;
- descendant alpha/compositing changes remaining inside the source;
- an implicit current path not being carried into the offscreen context, while
  self-contained `Path2D` custom drawing remains correct;
- Absolute placement and layout `overflow: "clip"`, proving the filter stays
  upright before placement and the completed overflow is ancestor-clipped;
- explicit keyboard navigation bounds and focus order, proving filter pixels do
  not enlarge focus geometry;
- overlapping filtered and unfiltered targets, proving original source paint
  order still selects the topmost logical target;
- a caller-provided root `OffscreenCanvas`, proving it remains an upright root
  target with identity world base and no invented parent transform;
- primitive `style.opacity` versus an opacity filter on overlapping children,
  proving the former retains leaf-paint semantics and the latter affects the
  combined raster group.

- [ ] **Step 6: Add validation/allocation/render failure cleanup tests**

Exercise missing `OffscreenCanvas`, missing `context.filter`, rejected concrete
color, forced second-lease allocation failure, throwing primitive, throwing
descendant, and throwing final `drawImage`. For every case assert the primitive
callback count promised by the failure stage, `checkedOut: 0`, restored
temporary globals, component refs cleared under the existing render-failure
contract, and successful recovery on a fresh valid mount.

- [ ] **Step 7: Run integration, Layer, runtime, and root-surface suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/surface/root-surface.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 8: Commit nested and retained integration**

```bash
git add packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/filter/render-filter-boundary.ts packages/core/src/lib/filter/filter-region.ts packages/core/src/lib/components/layer.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/global-state.ts packages/core/src/lib/runtime-contract.test.ts
git commit -m "feat(core): compose nested and layered filters"
```

### Task 8: Public learning example and deterministic filter laboratory

**Files:**

- Create: `packages/scenarios/src/learning/composition/filters.example.tsx`
- Create: `packages/scenarios/src/filter-lab.example.tsx`
- Create: `packages/scenarios/src/filter-lab.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Create: `packages/core/test/filter-lab.test.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Create: `packages/core/test/visual-baselines/first-class-filters.expected.png`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Consumes: only public `@crc/core` imports from Tasks 1-7.
- Produces:
  - learning route `#/examples/composition/filters`;
  - lab route `#/testing/filters`;
  - actions `show-all`, `show-ordered`, `swap-order`, `show-nested`,
    `show-transformed`, `show-clipped`, and `show-layered`;
  - stable state fields `mode`, `order`, `revision`, and `lastTarget`.

- [ ] **Step 1: Add the failing catalog and public-source tests**

Create `filter-lab.test.ts` expecting the two catalog entries, exact routes,
action IDs, source markers, direct `from '@crc/core'` imports, and no internal
paths. Add the lesson slug to the composition expectations in
`learning-examples.test.ts`.

- [ ] **Step 2: Run catalog and learning tests and confirm missing entries**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/filter-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the sources and catalog entries do not exist.

- [ ] **Step 3: Build the focused learning example**

Use one filtered Group containing overlapping Rectangle, Circle, and Text
children. A click cycles among these exact chains:

```ts
const CHAINS = [
  [
    {
      type: "dropShadow",
      offsetX: 12,
      offsetY: 10,
      blurRadius: 5,
      color: "rgb(17 24 39 / 55%)",
    },
  ],
  [
    { type: "grayscale", amount: 1 },
    {
      type: "dropShadow",
      offsetX: 12,
      offsetY: 10,
      blurRadius: 5,
      color: "rgb(17 24 39 / 55%)",
    },
  ],
  [
    {
      type: "dropShadow",
      offsetX: 12,
      offsetY: 10,
      blurRadius: 5,
      color: "rgb(17 24 39 / 55%)",
    },
    { type: "grayscale", amount: 1 },
  ],
] satisfies readonly (readonly CRCFilter[])[];
```

Explain in the metadata that the Group creates one combined silhouette and list
order changes which pixels the next function receives.

- [ ] **Step 4: Build the deterministic laboratory modes**

`show-all` renders labeled, fixed-size swatches for all ten functions.
`show-ordered` and `swap-order` use the same geometry with reversed chains.
`show-nested` renders grayscale inside drop shadow inside blur. The remaining
modes use a rotated/nonuniform Group, same/ancestor/descendant clips, and a
cached Layer with a public click target. Keep Canvas at 480 by 240, use data
image sources only, and expose selected probe coordinates from `filter-lab.ts`.

- [ ] **Step 5: Add semantic, interaction, and selected-pixel assertions**

For every action assert `mode` and `revision`, then inspect stable opaque centers
and transparent/shadow boundaries. For `show-nested`, also spy on the three
native filter strings in inside-out order. For `show-layered`, click the original
geometry and assert `lastTarget`, then click a shadow-only coordinate and assert
it remains unchanged.

- [ ] **Step 6: Generate the scenario index and run public tests**

```bash
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/filter-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: catalogs/index validate and tests PASS.

- [ ] **Step 7: Capture and inspect the visual baseline**

First run the lab test without the expected file and retain its actual artifact.
Inspect the expected candidate, actual, and any diff; confirm only Chromium
filter-rasterized halos require a documented mask. Copy the reviewed candidate
to `packages/core/test/visual-baselines/first-class-filters.expected.png`, configure
`expectVisualMatch` with narrow halo regions only, then rerun twice.

Run:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/filter-lab.test.ts --browser.headless --browser.ui=false
```

Expected: two consecutive PASS runs against the inspected baseline.

- [ ] **Step 8: Commit public scenario evidence**

```bash
git add packages/scenarios/src/learning/composition/filters.example.tsx packages/scenarios/src/filter-lab.example.tsx packages/scenarios/src/filter-lab.ts packages/scenarios/src/learning-catalog.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts packages/core/test/filter-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/visual-baselines/first-class-filters.expected.png docs/scenario-index.md
git commit -m "test(core): prove filters through public scenarios"
```

### Task 9: Lifecycle and structural-performance evidence

**Files:**

- Create: `packages/core/test/filter-ownership.test.ts`
- Create: `packages/core/test/filter-performance.test.ts`
- Modify: `package.json`
- Modify: `packages/core/src/lib/filter/filter-surface-pool.ts`
- Modify: `packages/core/src/lib/filter/render-filter-boundary.ts`
- Modify: `docs/testing/trust-gate.md`

**Interfaces:**

- Consumes: Task 4 pool snapshots and Task 8 public laboratory.
- Produces: deterministic lifecycle and cost checks included in the named trust sub-gates.

- [ ] **Step 1: Write failing ownership stress tests**

Mount a root with three nested filters and 100 filtered siblings. Record pool
snapshots after first render, 1,000 unchanged scheduled rerenders, replacement
with an unfiltered root, forced failure, controller disposal, and a fresh remount.
Assert siblings reuse two slots, nesting peaks at six, every frame ends with
`checkedOut: 0`, replacement retains reusable capacity without component refs,
failure returns every lease, and disposal satisfies `released === acquired` and
`live === 0` without a GC oracle.

- [ ] **Step 2: Run ownership tests and close any counter gaps**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/filter-ownership.test.ts --browser.headless --browser.ui=false
```

Expected before counter exposure is complete: FAIL on snapshot fields; after
minimal diagnostic completion: PASS.

- [ ] **Step 3: Write failing structural-performance tests**

Instrument primitive executions, `OffscreenCanvas` construction, `drawImage`,
`getImageData`, `putImageData`, and `transferToImageBitmap`. Assert exact counts:

```ts
expect(singleTenFunctionList).toMatchObject({
  primitiveExecutions: 1,
  filterSurfaceCapacity: 2,
  filteredDraws: 1,
  parentCompositeDraws: 1,
  pixelReadbacks: 0,
  imageBitmapTransfers: 0,
});
expect(threeNestedBoundaries.filterSurfaceCapacity).toBe(6);
expect(oneHundredSiblingBoundaries.filterSurfaceCapacity).toBe(2);
```

Add a cached Layer case proving filter-only parent updates do not increment its
child execution counter. Do not make wall-clock timing a default assertion.

- [ ] **Step 4: Run performance tests and preserve event-performance baselines**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/filter-performance.test.ts packages/core/test/event-performance.test.ts --browser.headless --browser.ui=false
```

Expected: structural filter assertions PASS and existing event-performance
assertions remain unchanged.

- [ ] **Step 5: Add focused suites to trust scripts without overwriting user changes**

Edit only the command values: append `packages/core/test/filter-ownership.test.ts`
to `test:lifecycle` and `packages/core/test/filter-performance.test.ts` to
`test:performance`. Preserve every unrelated `package.json` edit already in the
working tree. Update `docs/testing/trust-gate.md` to name both deterministic
filter checks and state that browser halo timing/pixels are not lifecycle or
performance oracles.

- [ ] **Step 6: Run lifecycle and performance sub-gates**

```bash
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

Expected: both sub-gates PASS with exact filter ownership and structural counts.

- [ ] **Step 7: Commit trust evidence**

```bash
git add packages/core/test/filter-ownership.test.ts packages/core/test/filter-performance.test.ts packages/core/src/lib/filter/filter-surface-pool.ts packages/core/src/lib/filter/render-filter-boundary.ts package.json docs/testing/trust-gate.md
git commit -m "test(core): lock filter ownership and cost"
```

### Task 10: Package surface, Studio declarations, and implemented contracts

**Files:**

- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/canvas-surface-contract.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `docs/api-reference.md`
- Modify: `docs/guides/components-props-and-style.md`
- Modify: `docs/guides/custom-components-and-primitives.md`
- Modify: `docs/guides/layout-groups-clips-and-layers.md`
- Modify: `docs/library-status.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-08-first-class-filters-design.md`

**Interfaces:**

- Consumes: completed public/runtime behavior from Tasks 1-9.
- Produces: matching source, built, packed, NodeNext, Bundler, and Studio type surfaces plus current implemented contracts.

- [ ] **Step 1: Add failing package-consumer type assertions**

Import all eleven new type names from `@crc/core`. Add compile-time examples for
single and readonly-list filters on Rectangle, Group, a layout primitive, and a
custom `definePrimitive`. Include these deliberate failures:

```ts
// @ts-expect-error raw CSS strings are not CRC filters
const raw: SystemStyle = { filter: "blur(4px)" };
// @ts-expect-error boxShadow is not a CRC system style property
const box: SystemStyle = { boxShadow: { offsetX: 1 } };
// @ts-expect-error url filters are excluded
const url: CRCFilter = { type: "url", value: "#filter" };
```

- [ ] **Step 2: Run source consumer and Studio checks and confirm stale declarations**

```bash
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 test:package-consumer
node tooling/verify-studio-types.mjs
```

Expected before declaration updates: Studio type-manifest failure naming the new
exports; package source compilation may already pass.

- [ ] **Step 3: Update Studio declarations and exact type manifest**

Regenerate/copy the built declaration content into the three marked modules in
`playground/src/crc-editor-types.txt` using the repository's existing manual
bundle format. Add these exact names to `publicTypeExports` in
`verify-studio-types.mjs`:

```text
CRCBlurFilter
CRCBrightnessFilter
CRCContrastFilter
CRCDropShadowFilter
CRCFilter
CRCGrayscaleFilter
CRCHueRotateFilter
CRCInvertFilter
CRCOpacityFilter
CRCSaturateFilter
CRCSepiaFilter
```

Add a Studio consumer signature asserting
`SystemStyle['filter']` equals `CRCFilter | readonly CRCFilter[] | undefined`.

- [ ] **Step 4: Update current contracts and guides with exact behavior**

Document the complete API table and numeric rules in the style contract/API
reference; combined subtree/list/nesting/Group/Clip/Layer order in the drawing
contract and layout/composition guide; upright local targets and density in the
surface contract; pool ownership/failure rows in runtime ownership; custom
primitive local-context/current-path boundary in the custom guide; and shipped
status/evidence links in library status and `AGENTS.md`.

Change the design document status line to:

```text
> **Historical status: IMPLEMENTED DESIGN RECORD.** Original approved wording below is preserved; current behavior lives in the linked design contracts and API reference.
```

Preserve its approved body below that banner.

- [ ] **Step 5: Run documentation, package, and Studio checks**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

Expected: all seven checks PASS. If `docs:check` reports unrelated untracked
discovery Markdown, record that separately and do not add or delete those files;
the feature documents themselves must have no reported drift.

- [ ] **Step 6: Commit the public surface and contracts**

```bash
git add playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/src/crc-editor-types.txt tooling/verify-studio-types.mjs docs/design/style-system-contract.md docs/design/drawing-components-contract.md docs/design/canvas-surface-contract.md docs/design/runtime-resource-ownership.md docs/api-reference.md docs/guides/components-props-and-style.md docs/guides/custom-components-and-primitives.md docs/guides/layout-groups-clips-and-layers.md docs/library-status.md AGENTS.md docs/superpowers/specs/2026-09-08-first-class-filters-design.md
git commit -m "docs: record first-class filter contracts"
```

### Task 11: Full trust gate and implementation record

**Files:**

- Modify: `docs/superpowers/plans/2026-09-08-first-class-filters-implementation.md`
- Create: `docs/testing/field-notes/2026-09-08-first-class-filters.md`

**Interfaces:**

- Consumes: every prior task and the repository trust contract.
- Produces: fresh, dated verification evidence and a completed historical plan.

- [ ] **Step 1: Review the complete diff before final verification**

Run:

```bash
git status --short
git diff --check
git diff --stat adde72c..HEAD
```

Confirm unrelated pre-existing files remain unstaged, no raw filter-string or
box-shadow API slipped in, no production pixel-readback call exists under
`packages/core/src/lib/filter`, and every public change has a scenario/test/doc
counterpart.

- [ ] **Step 2: Run the complete aggregate gate**

```bash
node --version
corepack pnpm@11.21.0 --version
corepack pnpm@11.21.0 trust
```

Expected: Node reports 24.15 or newer, pnpm reports 11.21.0, and the aggregate
gate exits zero across static, packed-package, browser/visual, built smoke,
lifecycle, and performance checks.

- [ ] **Step 3: Diagnose any failure without weakening evidence**

For a failure, rerun only its named focused command, inspect expected/actual/diff
for visual failures, and fix the implementation or assertion. Never rewrite a
baseline solely to obtain green output, never widen a mask beyond browser-owned
filter halos, and never remove a lifecycle/structural assertion. Repeat Step 2
after focused recovery.

- [ ] **Step 4: Record fresh field evidence**

Create the field note with date, exact Node/pnpm/Chromium environment, aggregate
command, exit result, focused filter suites, inspected visual artifacts, pool
peak/release counts, and any unrelated working-tree condition that prevented a
nominal docs check. Do not copy historical test totals.

- [ ] **Step 5: Mark the plan as implemented and commit evidence**

Insert this line immediately below the plan title:

```text
> **Historical status: IMPLEMENTED PLAN.**
```

Then commit only the plan and field note:

```bash
git add docs/superpowers/plans/2026-09-08-first-class-filters-implementation.md docs/testing/field-notes/2026-09-08-first-class-filters.md
git commit -m "test: close first-class filter evidence"
```

- [ ] **Step 6: Request final code review**

Invoke `superpowers:requesting-code-review` against the complete implementation
range beginning after design commit `adde72c`. Resolve correctness findings with
focused tests, rerun the aggregate gate if production or evidence files change,
and report the final commit range plus fresh verification result.
