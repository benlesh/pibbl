import {
  createElement,
  crc,
  defineRenderLayer,
  defineTexture,
  Group,
  useTexture,
} from "@crc/core";
import { displacement } from "@crc/core/filters";
import { describe, expect, it } from "vitest";
import { clickMouse } from "./support/mouse-input";

const rightMap = defineTexture({
  create: () => undefined,
  rasterize(_state: undefined, context: { canvas: OffscreenCanvas }) {
    const canvas = context.canvas.getContext("2d")!;
    canvas.fillStyle = "rgb(255 128 128)";
    canvas.fillRect(0, 0, context.canvas.width, context.canvas.height);
  },
});

describe("displacement around defineRenderLayer", () => {
  it("moves the bitmap without changing its committed target or routed local coordinates", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 40;
    document.body.append(canvas);
    const target = {};
    const settledTargets: object[] = [];
    const routedPoints: Array<{ x: number; y: number }> = [];
    let clicks = 0;
    const ExternalLayer = defineRenderLayer<
      {},
      { context: OffscreenCanvasRenderingContext2D },
      typeof target
    >({
      create(context) {
        const canvasContext = context.canvas.getContext("2d");
        if (!canvasContext) throw new Error("A Canvas 2D context is required.");
        return { context: canvasContext };
      },
      render(resources) {
        resources.context.fillStyle = "rgb(255 0 0)";
        resources.context.fillRect(0, 0, 10, 10);
      },
      interaction: {
        settle() {
          settledTargets.push(target);
          return {
            targets: [
              {
                target,
                handlers: {
                  onClick: () => {
                    clicks += 1;
                  },
                },
              },
            ],
            hitTest: (point) =>
              point.x >= 0 && point.x < 10 && point.y >= 0 && point.y < 10
                ? { kind: "target", target }
                : { kind: "miss" },
            onInput: (input) => routedPoints.push({ ...input.point }),
          };
        },
      },
    });
    function Scene() {
      const texture = useTexture(rightMap({}));
      return createElement(Group, {
        style: {
          filter: displacement({
            map: texture,
            strength: 2,
            region: { x: 0, y: 0, width: 40, height: 40 },
          }),
        },
        children: createElement(Group, {
          style: { translateX: 10, translateY: 10 },
          children: createElement(ExternalLayer, {
            style: { width: 10, height: 10 },
          }),
        }),
      });
    }
    const controller = crc(canvas, createElement(Scene, {}));
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const context = canvas.getContext("2d")!;
      expect(context.getImageData(8, 12, 1, 1).data[0]).toBeGreaterThan(200);
      expect(context.getImageData(18, 12, 1, 1).data[3]).toBe(0);
      expect(settledTargets).toEqual([target]);
      await clickMouse(canvas, { x: 8, y: 12 });
      expect(clicks).toBe(0);
      await clickMouse(canvas, { x: 18, y: 12 });
      expect(clicks).toBe(1);
      expect(routedPoints).toEqual([
        { x: 8, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 2 },
      ]);
      expect(settledTargets).toEqual([target]);
    } finally {
      controller.dispose();
      canvas.remove();
    }
  });
});
