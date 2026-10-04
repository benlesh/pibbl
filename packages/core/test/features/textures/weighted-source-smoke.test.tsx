import { afterEach, expect, it } from "vitest";
import { crc, Rectangle, type Texture } from "@crc/core";
import { tendrils, useTexture, type TendrilsMessage } from "@crc/core/textures";
let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.innerHTML = "";
});
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

it("runs weighted texture commands and shared fills through the built public package and real CRC scheduler", async () => {
  let texture!: Texture<TendrilsMessage>;
  function Scene() {
    texture = useTexture(
      tendrils({
        count: 1,
        glow: 0,
        branching: 0,
        sources: [{ id: "corner", point: { x: 0.9, y: 0.9 }, weight: 1 }],
      }),
      { resolution: { width: 128, height: 128 } },
    );
    return (
      <>
        <Rectangle style={{ width: 128, height: 128, fill: texture }} />
        <Rectangle style={{ x: 128, width: 128, height: 128, fill: texture }} />
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  dispose = () => controller.dispose();
  await frame();
  texture.send({ type: "pause", paused: true });
  await frame();
  const ctx = canvas.getContext("2d")!,
    pixels = (x = 0) => [...ctx.getImageData(x, 0, 128, 128).data];
  const baseline = pixels();
  expect(pixels(128)).toEqual(baseline);
  texture.send({
    type: "upsert-source",
    source: { id: "manual", point: { x: 0.8, y: 0.2 }, weight: 100000 },
  });
  await frame();
  expect(pixels()).not.toEqual(baseline);
  expect(pixels(128)).toEqual(pixels());
  const paused = pixels();
  await frame();
  expect(pixels()).toEqual(paused);
  texture.send({ type: "reset" });
  await frame();
  expect(pixels()).toEqual(baseline);
  controller.dispose();
  controller.dispose();
  texture.send({
    type: "upsert-source",
    source: { id: "gone", point: { x: 0, y: 0 }, weight: 1 },
  });
  await frame();
});
