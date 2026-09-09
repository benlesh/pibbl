import {
  Group,
  Rectangle,
  crc,
  createElement,
  definePrimitive,
  type CRCController,
  type CRCNode,
} from "@crc/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSharedState, getCRCInstance } from "../src/lib/global-state";
import type { FilterSurfacePool } from "../src/lib/filter/filter-surface-pool";

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("filter surface ownership", () => {
  it("keeps exact ownership through stress, replacement, failure, disposal, and remount", () => {
    const frames = controlFrames();
    const canvas = createCanvas();
    const siblings = oneHundredFilteredSiblings();
    const controller = crc(canvas, siblings, { pixelRatio: 1 });
    controllers.add(controller);
    frames.runNext();

    const instance = getCRCInstance(canvas);
    const firstPool = instance.filterSurfacePool;
    expect(firstPool.snapshot()).toEqual({
      surfaceSlots: 2,
      createdSurfaceSlots: 2,
      activePairs: 0,
      peakActivePairs: 1,
      pairCheckouts: 100,
      pairReturns: 100,
      resized: 0,
      releasedSurfaceSlots: 0,
    });

    for (let frame = 0; frame < 1_000; frame += 1) {
      crc(canvas, siblings);
      frames.runNext(frame + 1);
      expect(firstPool.snapshot().activePairs, `frame ${frame + 1}`).toBe(0);
    }
    expect(firstPool.snapshot()).toEqual({
      surfaceSlots: 2,
      createdSurfaceSlots: 2,
      activePairs: 0,
      peakActivePairs: 1,
      pairCheckouts: 100_100,
      pairReturns: 100_100,
      resized: 0,
      releasedSurfaceSlots: 0,
    });

    crc(canvas, undefined);
    frames.runNext(1_001);
    expect(instance.refs.size).toBe(0);
    expect(firstPool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      activePairs: 0,
      pairCheckouts: 100_100,
      pairReturns: 100_100,
      releasedSurfaceSlots: 0,
    });

    crc(canvas, threeNestedFilters(createElement(ThrowingPrimitive, {})));
    expect(() => frames.runNext(1_002)).toThrowError("forced filter failure");
    expect(instance.refs.size).toBe(0);
    expect(firstPool.snapshot()).toEqual({
      surfaceSlots: 6,
      createdSurfaceSlots: 6,
      activePairs: 0,
      peakActivePairs: 3,
      pairCheckouts: 100_103,
      pairReturns: 100_103,
      resized: 1,
      releasedSurfaceSlots: 0,
    });

    controller.dispose();
    expectReleased(firstPool, 6, 100_103, 1);

    const freshController = crc(
      canvas,
      threeNestedFilters(
        createElement(Rectangle, {
          style: { x: 4, y: 4, width: 8, height: 8, fill: "blue" },
        }),
      ),
      { pixelRatio: 1 },
    );
    controllers.add(freshController);
    frames.runNext(1_003);
    const freshPool = getCRCInstance(canvas).filterSurfacePool;
    expect(freshPool).not.toBe(firstPool);
    expect(freshPool.snapshot()).toEqual({
      surfaceSlots: 6,
      createdSurfaceSlots: 6,
      activePairs: 0,
      peakActivePairs: 3,
      pairCheckouts: 3,
      pairReturns: 3,
      resized: 0,
      releasedSurfaceSlots: 0,
    });

    freshController.dispose();
    expectReleased(freshPool, 6, 3);
  });
});

const ThrowingPrimitive = definePrimitive<{}>(() => {
  throw new Error("forced filter failure");
});

function oneHundredFilteredSiblings(): CRCNode {
  return createElement(Group, {
    children: Array.from({ length: 100 }, (_, index) =>
      createElement(Rectangle, {
        key: `filtered-sibling-${index}`,
        style: {
          x: index % 10,
          y: Math.floor(index / 10),
          width: 1,
          height: 1,
          fill: "red",
          filter: { type: "grayscale", amount: 1 },
        },
      }),
    ),
  });
}

function threeNestedFilters(child: CRCNode): CRCNode {
  return createElement(Group, {
    style: { filter: { type: "blur", radius: 1 } },
    children: createElement(Group, {
      style: { filter: { type: "grayscale", amount: 1 } },
      children: createElement(Group, {
        style: { filter: { type: "opacity", amount: 0.75 } },
        children: child,
      }),
    }),
  });
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 24;
  canvas.style.cssText = "display:block;width:32px;height:24px";
  document.body.appendChild(canvas);
  return canvas;
}

function controlFrames(): { runNext(timestamp?: number): void } {
  const frames: FrameRequestCallback[] = [];
  let frameId = 0;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      frames.push(callback);
      return ++frameId;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  return {
    runNext(timestamp = frameId): void {
      const callback = frames.shift();
      if (!callback) throw new Error("No controlled render frame is pending.");
      callback(timestamp);
    },
  };
}

function expectReleased(
  pool: FilterSurfacePool,
  createdSurfaceSlots: number,
  pairCount: number,
  resized = 0,
): void {
  expect(pool.snapshot()).toEqual({
    surfaceSlots: 0,
    createdSurfaceSlots,
    activePairs: 0,
    peakActivePairs: createdSurfaceSlots / 2,
    pairCheckouts: pairCount,
    pairReturns: pairCount,
    resized,
    releasedSurfaceSlots: createdSurfaceSlots,
  });
}
