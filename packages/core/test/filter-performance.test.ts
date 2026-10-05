import { peekNativeFilterPool } from '../src/lib/filter/render-filter-boundary';
import { grayscale, blur, brightness, contrast, dropShadow, hueRotate, invert, opacity, saturate, sepia } from '@pibbl/core/filters';
import {
  Group,
  Layer,
  createElement,
  definePrimitive,
  type PibblController,
  type PibblFilter,
  type PibblNode,
  type SystemStyle,
} from "@pibbl/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeRender } from "../src/lib/execute-render";
import * as filterRegion from "../src/lib/filter/filter-region";
import type { FilterWindows } from "../src/lib/filter/filter-region";
import {
  FilterSurfacePool,
  type FilterSurface,
} from "../src/lib/filter/filter-surface-pool";
import { clearSharedState, getPibblInstance } from "../src/lib/global-state";
import { mountPibbl } from "../src/lib/mount-pibbl";
import * as filterStyle from "../src/lib/style/filter";
import * as nativeOperations from "../src/filters/native-operations";

vi.mock("../src/lib/filter/filter-region", { spy: true });
vi.mock("../src/lib/style/filter", { spy: true });
vi.mock("../src/filters/native-operations", { spy: true });

const controllers = new Set<PibblController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("filter structural performance", () => {
  it("walks one ten-function list once and uses one pair without pixel copies", () => {
    const ledger = new FilterWorkLedger();
    let primitiveExecutions = 0;
    const Probe = definePrimitive<{}, SystemStyle>(
      (_props, _style, context) => {
        primitiveExecutions += 1;
        context.fillRect(4, 4, 8, 8);
      },
    );
    const canvas = renderScene(
      createElement(Probe, {
        style: { filter: TEN_FUNCTION_FILTER_LIST },
      }),
    );

    const pool = peekNativeFilterPool(getPibblInstance(canvas))!;
    const singleTenFunctionList = ledger.snapshot(pool, primitiveExecutions);
    expect(singleTenFunctionList).toMatchObject({
      primitiveExecutions: 1,
      filterSurfaceSlots: 2,
      peakActivePairs: 1,
      pairCheckouts: 1,
      filterListWalks: { normalize: 1, reverse: 1, compile: 1 },
      offscreenConstructions: 2,
      filteredDraws: 1,
      parentCompositeDraws: 1,
      drawImageInputPixelArea: 1_870,
      pixelReadbacks: 0,
      pixelWrites: 0,
      imageBitmapTransfers: 0,
    });
    const [sourceSurface, resultSurface] = poolSurfaces(pool);
    const parentContext = canvas.getContext("2d");
    expect(sourceSurface).toBeDefined();
    expect(resultSurface).toBeDefined();
    expect(parentContext).not.toBeNull();
    expect(sourceSurface!.canvas).toMatchObject({ width: 38, height: 29 });
    expect(resultSurface!.canvas).toMatchObject({ width: 32, height: 24 });
    expect(singleTenFunctionList.drawCalls).toHaveLength(2);
    const [filteredDraw, parentCompositeDraw] = singleTenFunctionList.drawCalls;
    expect(filteredDraw).toMatchObject({
      callOrder: 1,
      inputPixelArea: 1_102,
      destinationClass: "offscreen",
    });
    expect(filteredDraw!.sourceCanvas).toBe(sourceSurface!.canvas);
    expect(filteredDraw!.destinationContext).toBe(resultSurface!.context);
    expect(filteredDraw!.destinationCanvas).toBe(resultSurface!.canvas);
    expect(parentCompositeDraw).toMatchObject({
      callOrder: 2,
      inputPixelArea: 768,
      destinationClass: "parent",
    });
    expect(parentCompositeDraw!.sourceCanvas).toBe(resultSurface!.canvas);
    expect(parentCompositeDraw!.destinationContext).toBe(parentContext);
    expect(parentCompositeDraw!.destinationCanvas).toBe(canvas);
  });

  it("bounds slots by nesting depth rather than sibling count", () => {
    const nestedCanvas = renderScene(threeNestedFilters(undefined));
    const threeNestedBoundaries =
      peekNativeFilterPool(getPibblInstance(nestedCanvas))!.snapshot();
    expect(threeNestedBoundaries).toMatchObject({
      surfaceSlots: 6,
      peakActivePairs: 3,
      pairCheckouts: 3,
      pairReturns: 3,
      activePairs: 0,
    });

    const siblingCanvas = renderScene(oneHundredSiblingFilters());
    const oneHundredSiblingBoundaries =
      peekNativeFilterPool(getPibblInstance(siblingCanvas))!.snapshot();
    expect(oneHundredSiblingBoundaries).toMatchObject({
      surfaceSlots: 2,
      peakActivePairs: 1,
      pairCheckouts: 100,
      pairReturns: 100,
      activePairs: 0,
      resized: 0,
    });
  });

  it("reuses two slots for alternating windows and counts only dimension changes", () => {
    const resolveFilterWindows = vi.mocked(filterRegion.resolveFilterWindows);
    resolveFilterWindows.mockClear();
    const callbacks = Array.from({ length: 100 }, () => vi.fn());
    const Counted = ({ index }: { index: number }) => {
      callbacks[index]!();
    };
    const canvas = renderScene(
      createElement(Group, {
        children: callbacks.map((_callback, index) =>
          createElement(Group, {
            key: `alternating-filter-${index}`,
            style: {
              rotationDegrees: index % 2 === 0 ? 0 : 90,
              filter: COLOR_FILTER,
            },
            children: createElement(Counted, { index }),
          }),
        ),
      }),
    );
    const pool = peekNativeFilterPool(getPibblInstance(canvas))!;

    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      createdSurfaceSlots: 2,
      peakActivePairs: 1,
      pairCheckouts: 100,
      pairReturns: 100,
      activePairs: 0,
      resized: 198,
    });
    expect(resolveFilterWindows).toHaveBeenCalledTimes(100);
    for (const [index, result] of resolveFilterWindows.mock.results.entries()) {
      expect(result.type).toBe("return");
      const windows = result.value as FilterWindows | "discard";
      expect(windows).not.toBe("discard");
      if (windows === "discard") return;
      const [width, height] = index % 2 === 0 ? [32, 24] : [24, 32];
      expect(windows.source).toMatchObject({
        backingWidth: width,
        backingHeight: height,
      });
      expect(windows.output).toMatchObject({
        backingWidth: width,
        backingHeight: height,
      });
    }
    for (const callback of callbacks) expect(callback).toHaveBeenCalledOnce();
  });

  it("skips clears for fresh and resized slots and clears exact same-size areas", () => {
    const ledger = new FilterWorkLedger();
    const pool = new FilterSurfacePool();

    pool.checkoutPair(createWindows(32, 24)).release();
    expect(ledger.clearSnapshot()).toEqual({ calls: 0, pixelArea: 0 });

    ledger.resetCalls();
    pool.checkoutPair(createWindows(16, 12)).release();
    expect(ledger.clearSnapshot()).toEqual({ calls: 0, pixelArea: 0 });
    expect(pool.snapshot().resized).toBe(2);

    ledger.resetCalls();
    pool.checkoutPair(createWindows(16, 12)).release();
    expect(ledger.clearSnapshot()).toEqual({ calls: 2, pixelArea: 384 });
    expect(ledger.clearCalls).toEqual([
      [0, 0, 16, 12],
      [0, 0, 16, 12],
    ]);
    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      pairCheckouts: 3,
      pairReturns: 3,
      resized: 2,
    });
    pool.dispose();
  });

  it("does not rerun a cached Layer child for a parent filter-only update", () => {
    let childExecutions = 0;
    const Child = definePrimitive<{}>((_props, _style, context) => {
      childExecutions += 1;
      context.fillRect(2, 2, 4, 4);
    });
    const retainedChild = createElement(Child, {});
    const canvas = createCanvas();
    const controller = mountPibbl(canvas, filteredLayer(1, retainedChild), {
      pixelRatio: 1,
    });
    controllers.add(controller);

    executeRender(canvas, 0);
    expect(childExecutions).toBe(1);
    executeRender(canvas, 1, filteredLayer(0.5, retainedChild));

    expect(childExecutions).toBe(1);
    expect(peekNativeFilterPool(getPibblInstance(canvas))!.snapshot()).toMatchObject({
      surfaceSlots: 2,
      pairCheckouts: 2,
      pairReturns: 2,
      activePairs: 0,
    });
  });
});

const COLOR_FILTER = grayscale({ amount: 1 });

const TEN_FUNCTION_FILTER_LIST: readonly PibblFilter[] = [
  blur({ radius: 1 }),
  brightness({ amount: 1 }),
  contrast({ amount: 1 }),
  dropShadow({ offsetX: 2, offsetY: 1, blurRadius: 0, color: "contrast-color(red)" }),
  grayscale({ amount: 1 }),
  hueRotate({ degrees: 0 }),
  invert({ amount: 0 }),
  opacity({ amount: 1 }),
  saturate({ amount: 1 }),
  sepia({ amount: 0 }),
];

class FilterWorkLedger {
  readonly clearCalls: Array<[number, number, number, number]> = [];
  readonly drawCalls: DrawCall[] = [];
  private nextDrawCallOrder = 1;
  private readonly resolveFilterList = vi.mocked(filterStyle.resolveFilterList);
  private readonly resolveFilterWindows = vi.mocked(
    filterRegion.resolveFilterWindows,
  );
  private readonly compileFilterList = vi.mocked(nativeOperations.compileNativeFilters);
  private readonly offscreenConstructor: ReturnType<typeof vi.fn>;
  private readonly offscreenGetImageData = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "getImageData",
  );
  private readonly htmlGetImageData = vi.spyOn(
    CanvasRenderingContext2D.prototype,
    "getImageData",
  );
  private readonly offscreenPutImageData = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "putImageData",
  );
  private readonly htmlPutImageData = vi.spyOn(
    CanvasRenderingContext2D.prototype,
    "putImageData",
  );
  private readonly imageBitmapTransfers = vi.spyOn(
    OffscreenCanvas.prototype,
    "transferToImageBitmap",
  );

  constructor() {
    const ledger = this;
    const NativeOffscreenCanvas = globalThis.OffscreenCanvas;
    this.offscreenConstructor = vi.fn(function (width: number, height: number) {
      return new NativeOffscreenCanvas(width, height);
    });
    vi.stubGlobal("OffscreenCanvas", this.offscreenConstructor);

    const nativeClearRect =
      OffscreenCanvasRenderingContext2D.prototype.clearRect;
    vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      "clearRect",
    ).mockImplementation(function (
      this: OffscreenCanvasRenderingContext2D,
      ...args: [number, number, number, number]
    ) {
      ledger.clearCalls.push(args);
      return nativeClearRect.apply(this, args);
    });

    const nativeOffscreenDrawImage =
      OffscreenCanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      "drawImage",
    ).mockImplementation(function (
      this: OffscreenCanvasRenderingContext2D,
      ...args: Parameters<OffscreenCanvasRenderingContext2D["drawImage"]>
    ) {
      ledger.drawCalls.push({
        callOrder: ledger.nextDrawCallOrder++,
        sourceCanvas: args[0],
        destinationContext: this,
        destinationCanvas: this.canvas,
        destinationClass: "offscreen",
        filterAtCall: this.filter,
        inputPixelArea: imageInputArea(args[0]),
      });
      return nativeOffscreenDrawImage.apply(this, args);
    });

    const nativeParentDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    ).mockImplementation(function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["drawImage"]>
    ) {
      ledger.drawCalls.push({
        callOrder: ledger.nextDrawCallOrder++,
        sourceCanvas: args[0],
        destinationContext: this,
        destinationCanvas: this.canvas,
        destinationClass: "parent",
        filterAtCall: this.filter,
        inputPixelArea: imageInputArea(args[0]),
      });
      return nativeParentDrawImage.apply(this, args);
    });
  }

  resetCalls(): void {
    this.clearCalls.length = 0;
  }

  clearSnapshot(): { calls: number; pixelArea: number } {
    return {
      calls: this.clearCalls.length,
      pixelArea: this.clearCalls.reduce(
        (total, [, , width, height]) => total + width * height,
        0,
      ),
    };
  }

  snapshot(pool: FilterSurfacePool, primitiveExecutions: number) {
    const ownership = pool.snapshot();
    return {
      primitiveExecutions,
      filterSurfaceSlots: ownership.surfaceSlots,
      peakActivePairs: ownership.peakActivePairs,
      pairCheckouts: ownership.pairCheckouts,
      filterListWalks: {
        normalize: this.resolveFilterList.mock.calls.length,
        reverse: this.resolveFilterWindows.mock.calls.length,
        compile: this.compileFilterList.mock.calls.length,
      },
      offscreenConstructions: this.offscreenConstructor.mock.calls.length,
      filteredDraws: this.drawCalls.filter(
        (call) =>
          call.destinationClass === "offscreen" && call.filterAtCall !== "none",
      ).length,
      parentCompositeDraws: this.drawCalls.filter(
        (call) => call.destinationClass === "parent",
      ).length,
      drawImageInputPixelArea: this.drawCalls.reduce(
        (total, call) => total + call.inputPixelArea,
        0,
      ),
      drawCalls: this.drawCalls,
      pixelReadbacks:
        this.offscreenGetImageData.mock.calls.length +
        this.htmlGetImageData.mock.calls.length,
      pixelWrites:
        this.offscreenPutImageData.mock.calls.length +
        this.htmlPutImageData.mock.calls.length,
      imageBitmapTransfers: this.imageBitmapTransfers.mock.calls.length,
    };
  }
}

interface DrawCall {
  readonly callOrder: number;
  readonly sourceCanvas: CanvasImageSource;
  readonly destinationContext:
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  readonly destinationCanvas: HTMLCanvasElement | OffscreenCanvas;
  readonly destinationClass: "offscreen" | "parent";
  readonly filterAtCall: string;
  readonly inputPixelArea: number;
}

function imageInputArea(input: CanvasImageSource): number {
  if (
    typeof input === "object" &&
    input !== null &&
    "width" in input &&
    "height" in input &&
    typeof input.width === "number" &&
    typeof input.height === "number"
  ) {
    return input.width * input.height;
  }
  throw new Error("Expected filter composition to draw a Canvas surface.");
}

function poolSurfaces(pool: FilterSurfacePool): FilterSurface[] {
  const slots = (
    pool as unknown as {
      readonly slots: ReadonlyArray<FilterSurface | undefined>;
    }
  ).slots;
  return slots.flatMap((slot) => (slot ? [slot] : []));
}

function renderScene(root: PibblNode): HTMLCanvasElement {
  const canvas = createCanvas();
  const controller = mountPibbl(canvas, root, { pixelRatio: 1 });
  controllers.add(controller);
  executeRender(canvas, 0);
  return canvas;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 24;
  canvas.style.cssText = "display:block;width:32px;height:24px";
  document.body.appendChild(canvas);
  return canvas;
}

function threeNestedFilters(child: PibblNode): PibblNode {
  return createElement(Group, {
    style: { filter: COLOR_FILTER },
    children: createElement(Group, {
      style: { filter: COLOR_FILTER },
      children: createElement(Group, {
        style: { filter: COLOR_FILTER },
        children: child,
      }),
    }),
  });
}

function oneHundredSiblingFilters(): PibblNode {
  return createElement(Group, {
    children: Array.from({ length: 100 }, (_, index) =>
      createElement(Group, {
        key: `sibling-filter-${index}`,
        style: { filter: COLOR_FILTER },
        children: undefined,
      }),
    ),
  });
}

function filteredLayer(amount: number, child: PibblNode): PibblNode {
  return createElement(Layer, {
    style: {
      width: 32,
      height: 24,
      filter: opacity({ amount }),
    },
    children: child,
  });
}

function createWindows(width: number, height: number): FilterWindows {
  const window = {
    logicalBounds: { x: 0, y: 0, width, height },
    backingX: 0,
    backingY: 0,
    backingWidth: width,
    backingHeight: height,
    renderTransform: new DOMMatrix(),
    inverseRenderTransform: new DOMMatrix(),
  } as const;
  return {
    source: window,
    output: window,
    density: 1,
    sourceToOutputX: 0,
    sourceToOutputY: 0,
  };
}
