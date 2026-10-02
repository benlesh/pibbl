import { afterEach, expect, it } from "vitest";
import { crc, Rectangle, useTexture } from "@crc/core";
import { borrowTextureRaster } from "@crc/core/internal";
import { waterWaves } from "@crc/textures";
import { clearSharedState } from "../../core/src/lib/global-state.js";
import { ManualSchedulerDriver, installSchedulerDriverForTest } from "../../core/src/lib/scheduler/testing.js";

afterEach(() => { clearSharedState(); document.body.innerHTML = ""; });

it("is deterministic, advances only when active, and resets through messages", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const frames: number[][] = [];
  let texture: ReturnType<typeof useTexture<any>>;
  function Scene() {
    texture = useTexture(waterWaves({ seed: 7, speed: 1, scale: 4 }), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => frames.push(Array.from(raster.source.getContext("2d")!.getImageData(0, 0, 8, 8).data)));
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0); driver.flush(1000);
    expect(frames[1]).not.toEqual(frames[0]);
    texture!.send({ type: "pause", paused: true }); driver.flush(1016);
    expect(driver.pendingHostFrames).toBe(0);
    texture!.send({ type: "reset" }); driver.flush(1032);
    expect(frames.at(-1)).toEqual(frames[0]);
  } finally { controller.dispose(); restore(); }
});

it("rejects palettes for numeric displacement data", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = crc(canvas, <Probe />);
  try { expect(() => driver.flush(0)).toThrow("does not accept a palette"); }
  finally { controller.dispose(); restore(); }
  function Probe() { useTexture(waterWaves(), { palette: ["#000000", "#ffffff"] }); return null; }
});

it("keeps a zero-speed map static and makes its tile edges exact", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let texture: ReturnType<typeof useTexture<any>>;
  let pixels: Uint8ClampedArray | undefined;
  function Scene() {
    texture = useTexture(waterWaves({ seed: 9, speed: 0 }), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => { pixels = raster.source.getContext("2d")!.getImageData(0, 0, 8, 8).data; });
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(driver.pendingHostFrames).toBe(0);
    for (let y = 0; y < 8; y++) expect(Array.from(pixels!.slice(y * 32, y * 32 + 4))).toEqual(Array.from(pixels!.slice(y * 32 + 28, y * 32 + 32)));
    for (let x = 0; x < 8; x++) expect(Array.from(pixels!.slice(x * 4, x * 4 + 4))).toEqual(Array.from(pixels!.slice(224 + x * 4, 228 + x * 4)));
  } finally { controller.dispose(); restore(); }
});

it("discards paused elapsed debt and preserves message pause across equal authoring", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const frames: number[][] = [];
  let texture: ReturnType<typeof useTexture<any>>;
  const scene = () => <Scene />;
  function Scene() {
    texture = useTexture(waterWaves({ seed: 3, speed: 1 }), { resolution: { width: 8, height: 8 } });
    borrowTextureRaster(texture, raster => frames.push(Array.from(raster.source.getContext("2d")!.getImageData(0, 0, 8, 8).data)));
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = crc(canvas, scene());
  try {
    driver.flush(0); texture!.send({ type: "pause", paused: true }); driver.flush(16);
    crc(canvas, scene()); driver.flush(10_000);
    expect(driver.pendingHostFrames).toBe(0);
    texture!.send({ type: "pause", paused: false }); driver.flush(10_016);
    expect(frames.at(-1)).toEqual(frames[0]);
    driver.flush(11_032);
    expect(driver.pendingHostFrames).toBe(1);
  } finally { controller.dispose(); restore(); }
});
