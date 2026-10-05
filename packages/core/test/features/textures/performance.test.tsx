import { afterEach, expect, it, vi } from "vitest";
import { pibbl } from "@pibbl/core";
import { ReactionDiffusion } from "@pibbl/core/textures";
import { clearSharedState } from "../../../src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";
import { InkSimulation } from "../../../src/features/textures/lib/simulation.js";
import { TextureRaster } from "../../../src/features/textures/lib/presentation.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
it("uploads once per changed frame and performs no pixel readback", () => {
  const d = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(d),
    canvas = document.createElement("canvas");
  canvas.width = 832;
  canvas.height = 400;
  document.body.append(canvas);
  const upload = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "putImageData",
  );
  const read = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    "getImageData",
  );
  const transfer = vi.spyOn(OffscreenCanvas.prototype, "transferToImageBitmap");
  const controller = pibbl(
    canvas,
    <ReactionDiffusion
      resolution={{ width: 256, height: 144 }}
      style={{ width: 832, height: 400 }}
    />,
  );
  try {
    d.flush(0);
    d.flush(1000 / 60);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(read).not.toHaveBeenCalled();
    expect(transfer).toHaveBeenCalledTimes(2);
  } finally {
    controller.dispose();
    restore();
  }
});
it("records solver, raster/upload, and complete Pibbl frame costs without a machine-specific pass threshold", () => {
  const d = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(d),
    canvas = document.createElement("canvas");
  canvas.width = 832;
  canvas.height = 400;
  document.body.append(canvas);
  let simulationTime = 0,
    rasterTime = 0;
  const advance = InkSimulation.prototype.advance,
    update = TextureRaster.prototype.update;
  vi.spyOn(InkSimulation.prototype, "advance").mockImplementation(function (
    this: InkSimulation,
    count,
  ) {
    const t = performance.now();
    advance.call(this, count);
    simulationTime += performance.now() - t;
  });
  vi.spyOn(TextureRaster.prototype, "update").mockImplementation(function (
    this: TextureRaster,
    ...args
  ) {
    const t = performance.now();
    update.apply(this, args);
    rasterTime += performance.now() - t;
  });
  const controller = pibbl(
    canvas,
    <ReactionDiffusion
      resolution={{ width: 256, height: 144 }}
      style={{ width: 832, height: 400 }}
    />,
  );
  try {
    d.flush(0);
    for (let i = 1; i <= 20; i++) d.flush((i * 1000) / 60);
    simulationTime = 0;
    rasterTime = 0;
    const totals = [];
    for (let i = 21; i <= 80; i++) {
      const t = performance.now();
      d.flush((i * 1000) / 60);
      totals.push(performance.now() - t);
    }
    totals.sort((a, b) => a - b);
    expect(totals).toHaveLength(60);
    expect(totals.every(Number.isFinite)).toBe(true);
    if (import.meta.env.VITE_PIBBL_REPORT_PERF === "1")
      console.warn(
        JSON.stringify({
          texture: "256x144",
          display: "832x400@1",
          frames: 60,
          solverMeanMs: simulationTime / 60,
          rasterUploadMeanMs: rasterTime / 60,
          frameMedianMs: totals[30],
          frameP95Ms: totals[57],
        }),
      );
  } finally {
    controller.dispose();
    restore();
  }
});
