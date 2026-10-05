import { afterEach, expect, it } from "vitest";
import { pibbl } from "@pibbl/core";
import { ProceduralTexture } from "@pibbl/core/textures";
import { clearSharedState } from "../../../src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  document.body.innerHTML = "";
});
for (const kind of ["marble", "paper", "cellular"] as const)
  it(`${kind} repeats its seed, supports new variations, and idles after generation`, () => {
    const driver = new ManualSchedulerDriver(),
      restore = installSchedulerDriverForTest(driver);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 40;
    document.body.append(canvas);
    const scene = (seed: number) => (
      <ProceduralTexture
        kind={kind}
        seed={seed}
        resolution={{ width: 64, height: 40 }}
        style={{ width: 64, height: 40 }}
      />
    );
    const bytes = () =>
      Array.from(canvas.getContext("2d")!.getImageData(0, 0, 64, 40).data);
    const controller = pibbl(canvas, scene(42));
    try {
      driver.flush(0);
      const initial = bytes();
      expect(new Set(initial).size).toBeGreaterThan(10);
      expect(driver.pendingHostFrames).toBe(0);
      pibbl(canvas, scene(43));
      driver.flush(16);
      expect(bytes()).not.toEqual(initial);
      pibbl(canvas, scene(42));
      driver.flush(32);
      expect(bytes()).toEqual(initial);
    } finally {
      controller.dispose();
      restore();
    }
  });

for (const kind of ["marble", "paper", "cellular"] as const)
  it(`${kind} joins opposite tile edges for multiple seeds and scales`, () => {
    const driver = new ManualSchedulerDriver(),
      restore = installSchedulerDriverForTest(driver);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 40;
    document.body.append(canvas);
    const scene = (seed: number, scale: number) => (
      <ProceduralTexture
        kind={kind}
        seed={seed}
        scale={scale}
        resolution={{ width: 64, height: 40 }}
        style={{ width: 64, height: 40 }}
      />
    );
    const controller = pibbl(canvas, scene(42, 6));
    try {
      let time = 0;
      for (const [seed, scale] of [
        [42, 6],
        [0, 3.5],
        [4294967295, 12],
      ]) {
        pibbl(canvas, scene(seed, scale));
        driver.flush((time += 16));
        const data = canvas.getContext("2d")!.getImageData(0, 0, 64, 40).data;
        for (let y = 0; y < 40; y++)
          expect(Array.from(data.slice(y * 64 * 4, y * 64 * 4 + 4))).toEqual(
            Array.from(data.slice((y * 64 + 63) * 4, (y * 64 + 64) * 4)),
          );
        for (let x = 0; x < 64; x++)
          expect(Array.from(data.slice(x * 4, x * 4 + 4))).toEqual(
            Array.from(data.slice((39 * 64 + x) * 4, (39 * 64 + x) * 4 + 4)),
          );
      }
    } finally {
      controller.dispose();
      restore();
    }
  });
