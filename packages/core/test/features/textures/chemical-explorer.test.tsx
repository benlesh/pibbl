import { userEvent } from "vitest/browser";
import { afterEach, expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/chemical-explorer.example";
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
it("explores all models and presets, adjusts chemistry and presentation, paints and resets while paused", async () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 880;
  canvas.height = 910;
  document.body.append(canvas);
  const uploads = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "putImageData",
  );
  const controller = mount(canvas);
  let time = 0;
  const flush = () => {
    for (let i = 0; i < 3 && driver.pendingHostFrames; i++)
      driver.flush((time += 16));
  };
  const click = async (x: number, y: number) => {
    await userEvent.click(canvas, { position: { x, y } });
    flush();
  };
  const field = () => uploads.mock.calls.at(-1)![0].data.slice();
  const pixels = (x = 320, y = 210, w = 536, h = 360) =>
    canvas.getContext("2d")!.getImageData(x, y, w, h).data.slice();
  try {
    flush();
    await click(350, 148);
    expect(driver.pendingHostFrames).toBe(0);
    for (let model = 0; model < 3; model++) {
      await click(80 + model * 190, 102);
      const first = field();
      expect(new Set(first.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(
        10,
      );
      await click(710, 102);
      const second = field();
      expect(second).not.toEqual(first);
      expect(
        new Set(second.filter((_, i) => i % 4 === 0)).size,
      ).toBeGreaterThan(10);
      expect(driver.pendingHostFrames).toBe(0);
    }
    await click(80, 102);
    const original = field();
    await click(180, 242);
    expect(field()).not.toEqual(original);
    const configured = field();
    await click(350, 350);
    expect(field()).not.toEqual(configured);
    await click(750, 148);
    expect(field()).toEqual(configured);
    const before = pixels();
    await click(80, 148);
    expect(pixels()).not.toEqual(before);
    const repeat = pixels(320, 625, 536, 220);
    await click(210, 148);
    expect(pixels(320, 625, 536, 220)).not.toEqual(repeat);
    await click(270, 102); // Use an evolving Barkley preset, rather than a uniform chemistry regime.
    const frozen = field();
    await click(350, 148);
    flush();
    expect(field()).not.toEqual(frozen);
    await click(350, 148);
    expect(driver.pendingHostFrames).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
}, 20000);
