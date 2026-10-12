import { afterEach, expect, it } from "vitest";
import { defineTexture, pibbl, Rectangle, useTexture } from "@pibbl/core";
import * as filters from "@pibbl/core/filters";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";
import { clearSharedState } from "../src/lib/global-state.js";

const height = defineTexture<{ flat: boolean }, { flat: boolean }>({
  create(_context, config) {
    return config;
  },
  update(state, config, context) {
    state.flat = config.flat;
    context.invalidate();
  },
  rasterize(state, context) {
    const image = new ImageData(64, 32);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const value = state.flat
          ? 128
          : Math.round(128 + 80 * Math.cos((x * Math.PI) / 8));
        image.data.set([value, value, value, 255], i);
      }
    context.canvas.getContext("2d")!.putImageData(image, 0, 0);
  },
});
afterEach(() => {
  clearSharedState();
  document.body.innerHTML = "";
});
it("lights height-map slopes, reverses light direction, preserves flat color and alpha, and bypasses zero strength", () => {
  expect(typeof filters.emboss).toBe("function");
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 32;
  document.body.append(canvas);
  function Scene({
    reverse = false,
    flat = false,
    strength = 1,
  }: {
    reverse?: boolean;
    flat?: boolean;
    strength?: number;
  }) {
    const map = useTexture(height({ flat }), {
      resolution: { width: 64, height: 32 },
    });
    return (
      <Rectangle
        style={{
          width: 64,
          height: 32,
          fill: "rgba(128,128,128,0.5)",
          filter: filters.emboss(
            map.paint({ mode: "repeat", tileWidth: 64, tileHeight: 32 }),
            {
              region: { x: 0, y: 0, width: 64, height: 32 },
              depth: 3,
              strength,
              direction: reverse ? [-1, 0] : [1, 0],
            },
          ),
        }}
      />
    );
  }
  const controller = pibbl(canvas, <Scene />);
  const read = (x: number) =>
    Array.from(canvas.getContext("2d")!.getImageData(x, 16, 1, 1).data);
  const update = (props: Parameters<typeof Scene>[0]) => {
    pibbl(canvas, <Scene {...props} />);
    for (let i = 0; i < 3 && driver.pendingHostFrames; i++)
      driver.flush(i + 10);
  };
  try {
    driver.flush(0);
    expect(read(4)[0]).toBeGreaterThan(128);
    expect(read(12)[0]).toBeLessThan(128);
    expect(read(4)[3]).toBe(128);
    expect(read(4)).toEqual(read(20));
    update({ reverse: true });
    expect(read(4)[0]).toBeLessThan(128);
    expect(read(12)[0]).toBeGreaterThan(128);
    update({ flat: true });
    expect(read(4)).toEqual([128, 128, 128, 128]);
    update({ strength: 0 });
    expect(read(4)).toEqual([128, 128, 128, 128]);
    expect(driver.pendingHostFrames).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
});
