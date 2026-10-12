import { afterEach, expect, it, vi } from "vitest";
import {
  pibbl,
  Rectangle,
  useTexture,
  type Texture,
  type TextureRecipe,
} from "@pibbl/core";
import * as textures from "@pibbl/core/textures";
import type { InkMessage } from "@pibbl/core/textures";
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
for (const name of ["schnakenberg", "barkley", "brusselator"] as const) {
  it(`${name} exposes deterministic periodic fields, wrapped painting, motion, pause and reset`, () => {
    expect(typeof textures[name]).toBe("function");
    const driver = new ManualSchedulerDriver(),
      restore = installSchedulerDriverForTest(driver);
    const uploads = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      "putImageData",
    );
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 41;
    document.body.append(canvas);
    let handle: Texture<InkMessage>;
    function Scene({ input }: { input: TextureRecipe<InkMessage> }) {
      handle = useTexture(input, {
        resolution: { width: 41, height: 41 },
        palette: ["#000000", "#ffffff"],
      });
      return <Rectangle style={{ width: 41, height: 41, fill: handle }} />;
    }
    const recipe = textures[name]({ seed: 42, warmupSteps: 0, paused: true });
    const controller = pibbl(canvas, <Scene input={recipe} />);
    let time = 0;
    const flush = () => {
      for (let i = 0; i < 3 && driver.pendingHostFrames; i++)
        driver.flush((time += 16));
    };
    const pixels = () => uploads.mock.calls.at(-1)![0].data.slice();
    const seams = () => {
      const p = pixels();
      for (let i = 0; i < 41; i++) {
        expect(p.slice(i * 41 * 4, i * 41 * 4 + 4)).toEqual(
          p.slice((i * 41 + 40) * 4, (i * 41 + 40) * 4 + 4),
        );
        expect(p.slice(i * 4, i * 4 + 4)).toEqual(
          p.slice((40 * 41 + i) * 4, (40 * 41 + i) * 4 + 4),
        );
      }
    };
    try {
      flush();
      const initial = pixels();
      seams();
      expect(driver.pendingHostFrames).toBe(0);
      handle!.send({ type: "paint", u: 0, v: 0.5, radius: 5, strength: 1 });
      flush();
      seams();
      expect(pixels()).not.toEqual(initial);
      const p = pixels();
      expect(p[(20 * 41 + 1) * 4]).toBeGreaterThan(initial[(20 * 41 + 1) * 4]!);
      expect(p[(20 * 41 + 39) * 4]).toBeGreaterThan(
        initial[(20 * 41 + 39) * 4]!,
      );
      const painted = pixels();
      handle!.send({ type: "stir", u: 0, v: 0.5, du: 0.1, dv: 0, radius: 8 });
      flush();
      seams();
      expect(pixels()).not.toEqual(painted);
      handle!.send({ type: "reset" });
      flush();
      expect(pixels()).toEqual(initial);
      handle!.send({ type: "pause", paused: false });
      flush();
      const moving = pixels();
      flush();
      expect(pixels()).not.toEqual(moving);
      seams();
      handle!.send({ type: "pause", paused: true });
      flush();
      expect(driver.pendingHostFrames).toBe(0);
      pibbl(
        canvas,
        <Scene
          input={textures[name]({ seed: 43, warmupSteps: 0, paused: true })}
        />,
      );
      flush();
      expect(pixels()).not.toEqual(initial);
      const beforeSpeed = pixels();
      pibbl(
        canvas,
        <Scene
          input={textures[name]({
            seed: 43,
            warmupSteps: 0,
            paused: false,
            speed: 0,
          })}
        />,
      );
      flush();
      expect(pixels()).toEqual(beforeSpeed);
      expect(driver.pendingHostFrames).toBe(0);
    } finally {
      controller.dispose();
      restore();
    }
  });
}
