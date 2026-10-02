import { expect, it } from "vitest";
import {
  crc,
  defineTexture,
  Rectangle,
  useTexture,
  type Texture,
} from "@crc/core";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";

it("replaces transparent pixels and alpha when reusing texture publication canvases", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const recipe = defineTexture<{}, { x: number }, number>({
    create: () => ({ x: 0 }),
    receive(state, x, context) {
      state.x = x;
      context.invalidate();
    },
    rasterize(state, context) {
      const ctx = context.canvas.getContext("2d")!;
      ctx.fillStyle = "rgba(180,30,255,0.5)";
      ctx.fillRect(state.x, 0, 2, 8);
    },
  });
  let texture!: Texture<number>;
  function Scene() {
    texture = useTexture(recipe({}), { resolution: { width: 8, height: 8 } });
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 8;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    const ctx = canvas.getContext("2d")!;
    for (let frame = 1; frame <= 100; frame++) {
      const x = (frame % 4) * 2;
      texture.send(x);
      driver.flush(frame * 16);
      for (let pixel = 0; pixel < 8; pixel++) {
        const alpha = ctx.getImageData(pixel, 4, 1, 1).data[3];
        if (pixel >= x && pixel < x + 2) expect(alpha).toBeCloseTo(128, 0);
        else expect(alpha).toBe(0);
      }
    }
  } finally {
    controller.dispose();
    restore();
    canvas.remove();
  }
});
