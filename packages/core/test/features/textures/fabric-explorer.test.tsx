import { userEvent } from "vitest/browser";
import { afterEach, expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/fabric-explorer.example";
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
it("drives public Fabric Explorer controls and stops scheduling when motion is off", async () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 880;
  canvas.height = 620;
  document.body.append(canvas);
  const labels = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
  const controller = mount(canvas);
  const ctx = canvas.getContext("2d")!;
  const pixels = (x = 24, y = 282, width = 256, height = 160) =>
    ctx.getImageData(x, y, width, height).data.slice();
  let time = 0;
  const flush = () => {
    for (let i = 0; i < 3 && driver.pendingHostFrames; i++)
      driver.flush((time += 16));
  };
  const click = async (x: number, y: number) => {
    await userEvent.click(canvas, { position: { x, y } });
    flush();
  };
  try {
    flush();
    const original = pixels();
    await click(80, 104);
    expect(pixels()).not.toEqual(original);
    const recolored = pixels();
    await click(200, 104);
    expect(pixels()).not.toEqual(recolored);
    expect(labels.mock.calls.some((call) => call[0] === "Tile 64px")).toBe(
      true,
    );
    const originalWeave = pixels();
    await click(80, 470);
    expect(pixels()).not.toEqual(originalWeave);
    expect(labels.mock.calls.some((call) => call[0] === "Threads 32")).toBe(
      true,
    );
    const dense = pixels();
    await click(210, 470);
    expect(pixels()).not.toEqual(dense);
    const wide = pixels(304);
    await click(350, 470);
    expect(pixels(304)).not.toEqual(wide);
    const shaded = pixels(584);
    await click(480, 470);
    expect(pixels(584)).not.toEqual(shaded);
    await click(340, 104);
    const moving = pixels();
    flush();
    expect(pixels()).not.toEqual(moving);
    await click(340, 104);
    expect(driver.pendingHostFrames).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
});
