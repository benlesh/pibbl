import { afterEach, expect, it } from "vitest";
import { crc, Rectangle } from "@crc/core";
import { ReactionDiffusion, type TextureRenderer } from "@crc/core/textures";
import { clearSharedState } from "../../../src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  document.body.innerHTML = "";
});
it("reuses the same generated source for a repeating fill and an alpha mask under ordinary CRC content", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 80;
  document.body.append(canvas);
  let draws = 0;
  const render: TextureRenderer = (ctx, texture) => {
    draws++;
    ctx.fillStyle = ctx.createPattern(texture.source, "repeat")!;
    ctx.fillRect(0, 0, texture.width, texture.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(texture.mask, 0, 0, texture.width, texture.height);
  };
  const controller = crc(
    canvas,
    <>
      <ReactionDiffusion
        paused
        render={render}
        resolution={{ width: 64, height: 40 }}
        style={{ width: 128, height: 80 }}
      />
      <Rectangle style={{ width: 5, height: 5, fill: "#ff0000" }} />
    </>,
  );
  try {
    driver.flush(0);
    expect(draws).toBe(1);
    expect(driver.pendingHostFrames).toBe(0);
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, 128, 80).data;
    expect(Array.from(pixels.slice(0, 4))).toEqual([255, 0, 0, 255]);
    const alpha = Array.from(pixels).filter((_, i) => i % 4 === 3);
    expect(Math.min(...alpha)).toBe(0);
    expect(Math.max(...alpha)).toBe(255);
  } finally {
    controller.dispose();
    restore();
  }
});

it("keeps the alpha mask unchanged when only the palette changes", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 80;
  document.body.append(canvas);
  const masks: number[][] = [];
  const render: TextureRenderer = (ctx, t) => {
    const copy = new OffscreenCanvas(t.textureWidth, t.textureHeight);
    const c = copy.getContext("2d")!;
    c.drawImage(t.mask, 0, 0);
    masks.push(Array.from(c.getImageData(0, 0, copy.width, copy.height).data));
    ctx.drawImage(t.source, 0, 0, t.width, t.height);
    copy.width = copy.height = 0;
  };
  const scene = (palette: readonly string[]) => (
    <ReactionDiffusion
      paused
      palette={palette}
      render={render}
      resolution={{ width: 64, height: 40 }}
      style={{ width: 128, height: 80 }}
    />
  );
  const controller = crc(canvas, scene(["#000000", "#ffffff"]));
  try {
    driver.flush(0);
    crc(canvas, scene(["#661144", "#ffdd88"]));
    driver.flush(16);
    expect(masks).toHaveLength(2);
    expect(masks[1]).toEqual(masks[0]);
  } finally {
    controller.dispose();
    restore();
  }
});
