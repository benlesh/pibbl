import { afterEach, expect, it, vi } from "vitest";
import {
  crc,
  defineTexture,
  useTexture,
  Rectangle,
  Text,
  Layer,
} from "@crc/core";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";
import { clearSharedState } from "../src/lib/global-state.js";

afterEach(() => {
  clearSharedState();
  document.body.innerHTML = "";
});
it("shares a mount-owned texture across shape and text, updates cached consumers through send, and releases it once", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const create = vi.fn(() => ({ color: "#ff0000" }));
  const dispose = vi.fn();
  const rasterize = vi.fn((state: { color: string }, context: any) => {
    const ctx = context.canvas.getContext("2d")!;
    ctx.fillStyle = state.color;
    ctx.fillRect(0, 0, context.canvas.width, context.canvas.height);
  });
  const solid = defineTexture<{}, { color: string }, { color: string }>({
    create,
    rasterize,
    dispose,
    receive(state, message, context) {
      state.color = message.color;
      context.invalidate();
    },
  });
  let texture: ReturnType<typeof useTexture<{ color: string }>>;
  function Scene() {
    texture = useTexture(solid({}), { resolution: { width: 8, height: 8 } });
    return (
      <>
        <Layer style={{ width: 64, height: 64 }}>
          <Rectangle style={{ width: 32, height: 32, fill: texture }} />
        </Layer>
        <Text style={{ x: 35, y: 40, font: "20px Arial", fill: texture }}>
          Ink
        </Text>
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect([
      ...canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data,
    ]).toEqual([255, 0, 0, 255]);
    texture!.send({ color: "#00ff00" });
    driver.flush(16);
    expect(rasterize).toHaveBeenCalledTimes(2);
    expect([
      ...canvas.getContext("2d")!.getImageData(10, 10, 1, 1).data,
    ]).toEqual([0, 255, 0, 255]);
  } finally {
    controller.dispose();
    controller.dispose();
    restore();
  }
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(driver.pendingHostFrames).toBe(0);
});
