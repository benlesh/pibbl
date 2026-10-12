import { userEvent } from "vitest/browser";
import { afterEach, expect, it, vi } from "vitest";
import mount from "../../../../scenarios/src/learning/composition/material-overlay.example";
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
it("composes an image with surface and pigment layers, restores it at zero strength, and isolates blend state", async () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 880;
  canvas.height = 790;
  document.body.append(canvas);
  const images = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
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
    await vi.waitFor(() => {
      flush();
      expect(
        images.mock.calls.some((call) => call[0] instanceof HTMLImageElement),
      ).toBe(true);
    });
    const original = pixels(24, 164, 396, 300);
    const lit = pixels(444, 164, 396, 300);
    await click(520, 495); // Compare height relief with unlit pigment.
    const coated = pixels(444, 164, 396, 300);
    let raised = 0,
      lowered = 0,
      aboveOriginal = 0;
    for (let i = 0; i < lit.length; i++) {
      if (i % 4 === 3) continue;
      if (lit[i]! < coated[i]!) lowered++;
      if (lit[i]! > coated[i]!) raised++;
      if (lit[i]! > original[i]! + 2) aboveOriginal++;
    }
    expect(raised).toBeGreaterThan(1000);
    expect(lowered).toBeGreaterThan(1000);
    expect(aboveOriginal).toBeGreaterThan(1000);
    expect(coated).not.toEqual(original);
    // Multiply with a gray-white texture darkens without changing hue or
    // applying the blend operation to the original image or later siblings.
    for (let i = 0; i < original.length; i++)
      if (i % 4 !== 3) expect(coated[i]).toBeLessThanOrEqual(original[i]);
    expect(ctx.globalCompositeOperation).toBe("source-over");
    await click(520, 495); // Relief on, including at zero strength.
    const upperLeft = pixels(444, 164, 396, 300);
    await click(700, 495);
    expect(pixels(444, 164, 396, 300)).not.toEqual(upperLeft);
    await click(80, 104);
    const clean = pixels(444, 164, 396, 300);
    // The same SVG drawn at another translation can differ by up to two channel
    // level because of Canvas rasterization. Compare restoration at its own
    // position exactly below, and compare the two uncoated copies here.
    const maximumDifference = clean.reduce(
      (maximum, value, index) =>
        Math.max(maximum, Math.abs(value - original[index]!)),
      0,
    );
    expect(maximumDifference).toBeLessThanOrEqual(2);
    await click(80, 104);
    const strong = pixels(444, 164, 396, 300);
    expect(strong).not.toEqual(original);
    await click(210, 104);
    expect(pixels(444, 164, 396, 300)).not.toEqual(strong);
    const woven = pixels(444, 164, 396, 300);
    await click(350, 104);
    expect(pixels(444, 164, 396, 300)).not.toEqual(woven);
    const withPigment = pixels(444, 164, 396, 300);
    await click(620, 104);
    expect(pixels(444, 164, 396, 300)).not.toEqual(withPigment);
    await click(80, 104); // 0.8 -> 0.45
    await click(80, 104); // 0.45 -> zero
    expect(pixels(444, 164, 396, 300)).toEqual(clean);
    const field = pixels(24, 560, 256, 144);
    await click(480, 104);
    expect(pixels(24, 560, 256, 144)).not.toEqual(field);
    await click(750, 104);
    const moving = pixels(24, 560, 256, 144);
    flush();
    expect(pixels(24, 560, 256, 144)).not.toEqual(moving);
    await click(750, 104);
    expect(driver.pendingHostFrames).toBe(0);
    expect(pixels(24, 164, 396, 300)).toEqual(original);
  } finally {
    controller.dispose();
    restore();
  }
});
