import { afterEach, expect, it, vi } from "vitest";
import { pibbl, Group, Rectangle } from "@pibbl/core";
import { clearSharedState } from "../src/lib/global-state.js";
import { installSchedulerDriverForTest, ManualSchedulerDriver } from "../src/lib/scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it("bounds native transform reads for positioned built-in paint", () => {
  const count = 50;
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 100;
  document.body.append(canvas);
  const reads = vi.spyOn(CanvasRenderingContext2D.prototype, "getTransform");
  const controller = pibbl(canvas, <Group>{Array.from({ length: count }, (_, index) =>
    <Rectangle key={index} style={{ left: index * 3 + 1, top: 2, width: 2, height: 2, fill: "red" }} />,
  )}</Group>, { pixelRatio: 1 });
  try {
    driver.flush(0);
    // Entry/exit paint anchors and event geometry need at most three reads per leaf.
    expect(reads.mock.calls.length).toBeLessThanOrEqual(count * 3 + 12);
    const ctx = canvas.getContext("2d")!;
    expect(Array.from(ctx.getImageData(1, 2, 1, 1).data)).toEqual([255, 0, 0, 255]);
    expect(Array.from(ctx.getImageData(148, 2, 1, 1).data)).toEqual([255, 0, 0, 255]);
  } finally {
    controller.dispose();
    restore();
  }
});
