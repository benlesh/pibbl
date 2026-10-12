import { userEvent } from "vitest/browser";
import { afterEach, expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/texture-explorer.example";
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
it("drives the exact public Texture Explorer: recolor, retile, animate, change geometry and chemistry", async () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 880;
  canvas.height = 820;
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
    expect(labels.mock.calls.some((call) => call[0] === "Tile 40px")).toBe(
      true,
    );
    const straight = pixels();
    await click(210, 470);
    expect(pixels()).not.toEqual(straight);
    const wood = pixels(584);
    await click(640, 470);
    expect(pixels(584)).not.toEqual(wood);
    const knotted = pixels(584);
    await click(780, 470);
    expect(pixels(584)).not.toEqual(knotted);
    expect(labels.mock.calls.some((call) => call[0] === "Knots 0")).toBe(true);
    await click(340, 104);
    const moving = pixels();
    flush();
    expect(pixels()).not.toEqual(moving);
    await click(340, 104);
    await click(640, 525);
    flush();
    expect(driver.pendingHostFrames).toBe(0);
    const coral = pixels(200, 554, 656, 160);
    await click(80, 750);
    expect(pixels(200, 554, 656, 160)).not.toEqual(coral);
    expect(
      labels.mock.calls.some((call) => call[0] === "Living Gray–Scott / spots"),
    ).toBe(true);
    expect(driver.pendingHostFrames).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
});
