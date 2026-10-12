import { afterEach, expect, it, vi } from "vitest";
import { pibbl, Rectangle, useTexture, type Texture } from "@pibbl/core";
import {
  waterWaves,
  waterSurface,
  type WaterWavesMessage,
} from "@pibbl/core/textures";
import { waterWaves as referenceWaves } from "../../../../../tooling/texture-wasm-spike/reference-water/water-waves.js";
import { waterSurface as referenceSurface } from "../../../../../tooling/texture-wasm-spike/reference-water/water-surface.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";
import { clearSharedState } from "../../../src/lib/global-state.js";
afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
for (const [name, factory, reference] of [
  ["waves", waterWaves, referenceWaves],
  ["surface", waterSurface, referenceSurface],
] as const) {
  it(`${name} borrows a fixed WASM raster and preserves water behavior`, () => {
    const driver = new ManualSchedulerDriver(),
      restore = installSchedulerDriverForTest(driver);
    const NativeMemory = WebAssembly.Memory;
    const memories: WebAssembly.Memory[] = [];
    vi.spyOn(WebAssembly, "Memory").mockImplementation(function (descriptor) {
      const memory = new NativeMemory(descriptor);
      memories.push(memory);
      return memory;
    });
    const grow = vi.spyOn(NativeMemory.prototype, "grow");
    const uploads = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      "putImageData",
    );
    const handles: Texture<WaterWavesMessage>[] = [];
    function Scene({
      moved = false,
      viscosity = 0,
      seed = 4294967173,
      scale = 4,
    }: {
      moved?: boolean;
      viscosity?: number;
      seed?: number;
      scale?: number;
    }) {
      return (
        <>
          {[factory, reference].map((make, i) => {
            handles[i] = useTexture(
              make({
                seed,
                scale,
                viscosity,
                obstacles: [
                  { x: moved ? 0.55 : 0.35, y: 0.3, width: 0.12, height: 0.4 },
                ],
              }),
              { resolution: { width: 40, height: 24 } },
            );
            return (
              <Rectangle
                key={i}
                style={{ width: 40, height: 24, fill: handles[i] }}
              />
            );
          })}
        </>
      );
    }
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const controller = pibbl(canvas, <Scene />);
    const compare = () => {
      const calls = uploads.mock.calls.slice(-2);
      expect(calls).toHaveLength(2);
      expect(Array.from(calls[0][0].data)).toEqual(
        Array.from(calls[1][0].data),
      );
    };
    try {
      driver.flush(0);
      compare();
      const first = uploads.mock.calls[0][0];
      expect(first.data.buffer).toBe(memories[0]?.buffer);
      for (let frame = 1; frame <= 90; frame++) {
        if (frame === 3 || frame === 20)
          for (const handle of handles)
            handle.send({ type: "ripple", x: 0.4, y: 0.6 });
        if (frame === 30) pibbl(canvas, <Scene moved viscosity={0.7} />);
        if (frame === 50)
          pibbl(canvas, <Scene moved viscosity={1} seed={456} scale={9} />);
        if (frame === 60)
          for (const handle of handles)
            handle.send({ type: "pause", paused: true });
        if (frame === 62)
          for (const handle of handles)
            handle.send({ type: "ripple", x: 0.2, y: 0.2 });
        if (frame === 65)
          for (const handle of handles)
            handle.send({ type: "pause", paused: false });
        if (frame === 80)
          for (const handle of handles) handle.send({ type: "reset" });
        if (driver.pendingHostFrames) driver.flush(frame * 16);
        compare();
      }
      expect(uploads.mock.calls.at(-2)![0]).toBe(first);
      expect(grow).not.toHaveBeenCalled();
      expect(memories).toHaveLength(name === "surface" ? 2 : 1);
    } finally {
      controller.dispose();
      restore();
    }
    expect(driver.pendingHostFrames).toBe(0);
  });
}
