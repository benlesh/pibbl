import { expect, it, vi } from "vitest";
import { mountProductionScene } from "../../../../../tooling/texture-wasm-spike/production-scene.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";
it("drives WASM texture parameters with animation and displaces ink continuously from Rapier movement", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 480;
  document.body.append(canvas);
  const uploads = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "putImageData",
  );
  const inkPixels = () =>
    uploads.mock.calls
      .findLast(([image]) => image.width === 256 && image.height === 128)![0]
      .data.slice();
  const scene = mountProductionScene(canvas);
  try {
    driver.flush(0);
    scene.pauseInk(true);
    const initialInk = inkPixels();
    const start = scene.observations.materialDetail;
    const before = canvas.getContext("2d")!.getImageData(0, 0, 192, 160).data;
    for (let frame = 1; frame <= 360; frame++)
      driver.flush((frame * 1000) / 60);
    expect(scene.observations.materialDetail).toBeGreaterThan(start);
    expect(scene.observations.disturbances).toBeGreaterThan(100);
    expect(inkPixels()).not.toEqual(initialInk);
    const materialBuffers = new Set(
      uploads.mock.calls
        .filter(([image]) => image.width === 96 && image.height === 96)
        .map(([image]) => image.data.buffer),
    );
    expect(materialBuffers.size).toBe(3);
    expect(
      canvas.getContext("2d")!.getImageData(0, 0, 192, 160).data,
    ).not.toEqual(before);
  } finally {
    scene.controller.dispose();
    restore();
    canvas.remove();
    uploads.mockRestore();
  }
  expect(driver.pendingHostFrames).toBe(0);
});
