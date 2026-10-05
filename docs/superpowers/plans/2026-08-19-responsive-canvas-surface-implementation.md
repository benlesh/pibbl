# Responsive High-Density Canvas Surface Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** Agent instructions and unchecked-looking task syntax below are preserved as dated evidence, not active work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pibbl own logical viewport, CSS sizing, backing density, fit projection, mouse conversion, and layer density so Canvas output is crisp by default.

**Architecture:** A focused surface subsystem resolves immutable logical/display/backing geometry and owns root DOM observation. Rendering installs one surface transform while interaction capture normalizes it away, keeping paint and hit testing in logical coordinates. Layers use derived density-only surfaces.

**Tech Stack:** TypeScript, Canvas 2D, DOMMatrix, ResizeObserver, matchMedia, OffscreenCanvas, Vitest Browser Mode, Playwright Chromium, pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-08-19-responsive-canvas-surface-design.md`

## Global Constraints

- Node 24.15.0 or newer and pnpm 11.21.0 through Corepack.
- Default mounts capture the initial positive Canvas attributes, use centered `contain`, and use device density.
- Responsive logical units equal CSS content-box pixels.
- Surface changes preserve identity and use the existing animation-frame scheduler.
- Paint, hit testing, clipping, layout, and layers use one surface revision.
- Preserve unrelated changes; inspect every visual diff before changing a baseline.
- Write a failing test before each behavior change.

## File structure

- `packages/core/src/lib/surface/types.ts`: public config and internal records.
- `packages/core/src/lib/surface/resolve-surface.ts`: pure fit/backing/matrix math.
- `packages/core/src/lib/surface/root-surface.ts`: measurement, observers, intrinsic stabilization, and invalidation.
- `packages/core/src/lib/surface/transform.ts`: logical transform normalization.
- Existing mount, render, interaction, and layer files consume these units.
- `packages/scenarios/src/canvas-surface.example.ts`: deterministic public proof.

---

### Task 1: Pure surface contract and public types

**Files:**

- Create: `packages/core/src/lib/surface/types.ts`
- Create: `packages/core/src/lib/surface/resolve-surface.ts`
- Test: `packages/core/src/lib/surface/resolve-surface.test.ts`
- Modify: `packages/core/src/lib/pibbl.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/lib/runtime-contract.test.ts`

**Interfaces:**

- Produces the public `PibblConfig`, fit, ratio, fixed, and responsive types.
- Produces `validateSurfaceConfig`, `resolveSurface`, and `createLayerSurface`.

- [ ] **Step 1: Write failing projection tests**

Cover every fit, responsive allocation, fractional display size, backing rounding, inverse mapping, invalid values, and forbidden responsive `fit`.

```ts
const surface = resolveSurface(
  { mode: "fixed", width: 720, height: 420, fit: "contain", pixelRatio: 2 },
  { width: 873, height: 509.25 },
  2,
)!;
expect(surface.backingWidth).toBe(1746);
expect(surface.backingHeight).toBe(1019);
expect(surface.logicalWidth).toBe(720);
expect(surface.renderTransform.a).toBeCloseTo(2.425);
```

- [ ] **Step 2: Run RED**

```bash
corepack pnpm@11.21.0 vitest run packages/core/src/lib/surface/resolve-surface.test.ts --browser.headless --browser.ui=false
```

Expected: missing surface modules.

- [ ] **Step 3: Implement types, validation, and pure resolution**

```ts
export type ResolvedSurfaceConfig =
  | {
      mode: "fixed";
      width: number;
      height: number;
      fit: PibblFit;
      pixelRatio: PibblPixelRatio;
    }
  | { mode: "responsive"; pixelRatio: PibblPixelRatio };

export interface PibblSurfaceSnapshot {
  logicalWidth: number;
  logicalHeight: number;
  displayWidth: number;
  displayHeight: number;
  backingWidth: number;
  backingHeight: number;
  backingPixelsPerCssPixelX: number;
  backingPixelsPerCssPixelY: number;
  backingPixelsPerLogicalUnitX: number;
  backingPixelsPerLogicalUnitY: number;
  renderTransform: DOMMatrix;
  inverseRenderTransform: DOMMatrix;
}
```

Return `undefined` for a zero display axis before constructing an inverse.

- [ ] **Step 4: Run GREEN, typecheck, and commit**

```bash
corepack pnpm@11.21.0 vitest run packages/core/src/lib/surface/resolve-surface.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
git add packages/core/src/lib/surface packages/core/src/lib/pibbl.ts packages/core/src/lib/types.ts packages/core/src/index.ts packages/core/src/lib/runtime-contract.test.ts
git commit -m "feat(surface): define logical canvas projection"
```

---

### Task 2: Root lifecycle and rendering

**Files:**

- Create: `packages/core/src/lib/surface/root-surface.ts`
- Test: `packages/core/src/lib/surface/root-surface.test.ts`
- Modify: `packages/core/src/lib/mount-pibbl.ts`
- Modify: `packages/core/src/lib/execute-render.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/update.ts`
- Test: `packages/core/src/lib/runtime-contract.test.ts`
- Test: `packages/core/test/lifecycle-ownership.test.ts`

**Interfaces:**

- Consumes `ResolvedSurfaceConfig`, `PibblSurfaceSnapshot`, and `resolveSurface`.
- Produces `RootSurfaceState`, `mountRootSurface`, and `prepareRootSurface`.

- [ ] **Step 1: Write failing lifecycle tests**

Control ResizeObserver, matchMedia, DPR, content-box measurements, and RAF. Prove backing size, logical allocation, identity-space clear, transform, coalescing, responsive state retention, zero-size recovery, intrinsic stabilization, and teardown.

```ts
expect(canvas.width).toBe(1746);
expect(canvas.height).toBe(1019);
expect(rootAllocations.at(-1)).toEqual({ x: 0, y: 0, width: 720, height: 420 });
expect(clearCalls.at(-1)).toEqual([0, 0, 1746, 1019]);
```

- [ ] **Step 2: Run RED**

```bash
corepack pnpm@11.21.0 vitest run packages/core/src/lib/surface/root-surface.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement observation and exact ownership**

```ts
resizeObserver = new ResizeObserver((entries) => {
  const size = readObservedContentBox(entries.at(-1), canvas);
  if (setLatestDisplaySize(state, size)) update(canvas);
});
```

Own observer, media-query, resize fallback, and inline-style restoration through `mainTeardowns`. Numeric ratios install no density listeners.

- [ ] **Step 4: Implement backing preparation**

```ts
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.clearRect(0, 0, surface.backingWidth, surface.backingHeight);
ctx.setTransform(surface.renderTransform);
instance.rootLayoutBox = Object.freeze({
  x: 0,
  y: 0,
  width: surface.logicalWidth,
  height: surface.logicalHeight,
});
```

Reset identity in `finally`; defer zero-size traversal without disposing refs. Stabilize only intrinsic CSS axes and restore only still-owned values.

- [ ] **Step 5: Run GREEN and commit**

```bash
corepack pnpm@11.21.0 vitest run packages/core/src/lib/surface/root-surface.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
git add packages/core/src/lib/surface/root-surface.ts packages/core/src/lib/surface/root-surface.test.ts packages/core/src/lib/mount-pibbl.ts packages/core/src/lib/execute-render.ts packages/core/src/lib/types.ts packages/core/src/lib/update.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/lifecycle-ownership.test.ts
git commit -m "feat(surface): own canvas density and resize lifecycle"
```

---

### Task 3: Logical interaction geometry

**Files:**

- Create: `packages/core/src/lib/surface/transform.ts`
- Test: `packages/core/src/lib/surface/transform.test.ts`
- Modify: `packages/core/src/lib/util/get-mouse-coordinates.ts`
- Modify: `packages/core/src/lib/interaction-dispatch.ts`
- Modify: `packages/core/src/lib/util/is-hit.ts`
- Modify: `packages/core/src/lib/hooks/use-region.ts`
- Modify: `packages/core/src/lib/util/push-clipping-path.ts`
- Test: `packages/core/test/mouse-contract.test.ts`
- Test: `packages/core/test/geometry-composition.test.ts`

**Interfaces:**

- Produces `toLogicalTransform(surface, current): DOMMatrix`.
- Produces `getMouseCoordinates(event, instance)` in logical root units.

- [ ] **Step 1: Write failing public interaction tests**

Cover fixed letterboxing, all fits, responsive mode, border/padding, groups, clips, and handler coordinates. A 720×420 center remains `(360, 210)` with a 1746×1019 backing.

- [ ] **Step 2: Run RED**

```bash
corepack pnpm@11.21.0 vitest run packages/core/src/lib/surface/transform.test.ts packages/core/test/mouse-contract.test.ts packages/core/test/geometry-composition.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Normalize capture and input**

```ts
export function toLogicalTransform(
  surface: PibblSurfaceSnapshot,
  current: DOMMatrix,
): DOMMatrix {
  return surface.inverseRenderTransform.multiply(current);
}
```

Store logical region/clip transforms. Convert the client point to CSS content coordinates, then backing coordinates, then apply `inverseRenderTransform`. Cache by native event and root instance.

- [ ] **Step 4: Make hit state explicit**

Set the supplied logical transform unconditionally, including identity, for candidate paths and every clip.

- [ ] **Step 5: Run GREEN and commit**

```bash
corepack pnpm@11.21.0 vitest run packages/core/test/mouse-contract.test.ts packages/core/test/interaction-dispatch.test.ts packages/core/test/geometry-composition.test.ts --browser.headless --browser.ui=false
git add packages/core/src/lib/surface/transform.ts packages/core/src/lib/surface/transform.test.ts packages/core/src/lib/util/get-mouse-coordinates.ts packages/core/src/lib/interaction-dispatch.ts packages/core/src/lib/util/is-hit.ts packages/core/src/lib/hooks/use-region.ts packages/core/src/lib/util/push-clipping-path.ts packages/core/test/mouse-contract.test.ts packages/core/test/geometry-composition.test.ts
git commit -m "feat(surface): keep interaction in logical coordinates"
```

---

### Task 4: Density-aware layers

**Files:**

- Modify: `packages/core/src/lib/components/layer.ts`
- Test: `packages/core/src/lib/components/layer.test.ts`
- Modify: `packages/core/src/lib/mount-pibbl.ts`
- Modify: `packages/core/src/lib/types.ts`
- Test: `packages/core/test/geometry-composition.test.ts`
- Test: `packages/core/test/lifecycle-ownership.test.ts`

**Interfaces:**

- Consumes `createLayerSurface` and normalized transforms.
- Produces internal derived-surface support for `mountPibbl`.

- [ ] **Step 1: Write failing layer tests**

At density 2.425, a 200×100 layer uses a 485×243 backing bitmap, composites with nine-argument `drawImage`, and hits child geometry at unchanged logical coordinates. Cover nested layers, density changes, and cleanup.

- [ ] **Step 2: Run RED**

```bash
corepack pnpm@11.21.0 vitest run packages/core/src/lib/components/layer.test.ts packages/core/test/geometry-composition.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 3: Implement derived layers and composition**

```ts
ctx.drawImage(
  offscreenCanvas,
  0,
  0,
  offscreenCanvas.width,
  offscreenCanvas.height,
  0,
  0,
  width,
  height,
);
```

Recompute on logical size or root density changes, normalize the parent entry transform, and retain logical bounds.

- [ ] **Step 4: Run GREEN and commit**

```bash
corepack pnpm@11.21.0 vitest run packages/core/src/lib/components/layer.test.ts packages/core/test/geometry-composition.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
git add packages/core/src/lib/components/layer.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/mount-pibbl.ts packages/core/src/lib/types.ts packages/core/test/geometry-composition.test.ts packages/core/test/lifecycle-ownership.test.ts
git commit -m "feat(surface): render layers at root density"
```

---

### Task 5: Public scenario and Studio proof

**Files:**

- Create: `packages/scenarios/src/canvas-surface.example.ts`
- Create: `packages/scenarios/src/canvas-surface.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Create: `packages/core/test/canvas-surface.test.ts`
- Modify: `packages/core/test/scenario-catalog.test.ts`
- Regenerate: `docs/scenario-index.md`

**Interfaces:**

- Produces test-lab slug `canvas-surface` with display, backing, allocation, pointer, and render-count state.

- [ ] **Step 1: Write failing catalog/browser tests**

Drive ratio 2, live CSS resize, fixed allocation, responsive reflow with stable keyed state, and a known logical marker.

```ts
expect(await canvas.getAttribute("width")).toBe("960");
expect(await canvas.getAttribute("height")).toBe("480");
expect(await pageState()).toMatchObject({
  logical: { width: 480, height: 240 },
});
```

- [ ] **Step 2: Run RED, implement, and regenerate**

```bash
corepack pnpm@11.21.0 vitest run packages/core/test/canvas-surface.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
```

- [ ] **Step 3: Run public and visual proof**

```bash
corepack pnpm@11.21.0 vitest run packages/core/test/canvas-surface.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:studio-visual
```

Inspect any diff; change no baseline without evidence.

- [ ] **Step 4: Commit**

```bash
git add packages/scenarios/src/canvas-surface.example.ts packages/scenarios/src/canvas-surface.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts packages/core/test/canvas-surface.test.ts packages/core/test/scenario-catalog.test.ts docs/scenario-index.md
git commit -m "test(surface): prove responsive high-density canvas"
```

---

### Task 6: Normative contracts and package boundaries

**Files:**

- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/mouse-interaction-contract.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/layout-system-contract.md`
- Modify: `AGENTS.md`
- Modify: the existing `playground/package-consumer` source selected by inspection.
- Verify: `playground/src/pibbl-editor-types.txt` through `tooling/verify-studio-types.mjs`.

**Interfaces:**

- Produces source, declarations, consumers, Studio editor, and normative-document agreement.

- [ ] **Step 1: Add package-consumer usage**

```ts
pibbl(canvas, scene, {
  viewport: { width: 720, height: 420 },
  fit: "cover",
  pixelRatio: 2,
});
pibbl(otherCanvas, scene, { viewport: "responsive" });
```

- [ ] **Step 2: Update normative contracts**

Document logical root coordinates, fixed/responsive percentage bases, density-aware layers, logical pixel-grid limits, mount-only config, and observer ownership. Do not present historical test totals as current.

- [ ] **Step 3: Verify every public boundary**

```bash
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

- [ ] **Step 4: Commit**

```bash
git add docs/design AGENTS.md playground/package-consumer playground/src/pibbl-editor-types.txt
git commit -m "docs(surface): publish canvas surface contract"
```

---

### Task 7: Aggregate verification and completion audit

**Files:** Modify only evidence-backed surface fixes discovered by the gate.

**Interfaces:** Produces fresh aggregate trust evidence and a requirement-by-requirement audit.

- [ ] **Step 1: Run static and safeguard checks**

```bash
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 test:visual-safeguard
```

- [ ] **Step 2: Run aggregate trust**

```bash
corepack pnpm@11.21.0 trust
```

Expected: catalog, typecheck, lint, builds, packed consumers, browser and visual suites, built smoke, lifecycle, and structural performance pass.

- [ ] **Step 3: Audit all nine spec success criteria**

For every numbered criterion, identify exact source, focused test, scenario, contract, and command evidence. Missing or indirect evidence returns to the responsible task.

- [ ] **Step 4: Inspect scope, commit gate fixes, push, and compare tips**

```bash
git status --short
git diff --check
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Confirm unrelated `.beads`, `.gitignore`, and `_bmad-output/` changes remain untouched and local/remote tips match.
