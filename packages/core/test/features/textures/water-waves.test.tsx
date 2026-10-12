import { afterEach, expect, it } from "vitest";
import { pibbl, Rectangle, useTexture } from "@pibbl/core";
import { borrowTextureRaster } from "@pibbl/core/internal";
import { waterWaves } from "@pibbl/core/textures";
import { clearSharedState } from "../../../src/lib/global-state.js";
import { ManualSchedulerDriver, installSchedulerDriverForTest } from "../../../src/lib/scheduler/testing.js";

afterEach(() => { clearSharedState(); document.body.innerHTML = ""; });

it("changes only active ripple displacement when rippleStrength is updated", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const frames: number[][] = [];
  let texture: ReturnType<typeof useTexture<any>>;
  let rippleStrength = 1;
  function Scene() {
    texture = useTexture(waterWaves({ seed: 5, speed: 0, rippleStrength }), { resolution: { width: 16, height: 8 } });
    borrowTextureRaster(texture, raster => frames.push(Array.from(raster.source.getContext("2d")!.getImageData(0, 0, 16, 8).data)));
    return <Rectangle style={{ width: 16, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  const capture = (time: number) => { pibbl(canvas, <Scene />); driver.flush(time); return frames.at(-1)!; };
  try {
    driver.flush(0);
    const base = frames.at(-1)!;
    texture!.send({ type: "ripple", x: 0.25, y: 0.5 }); driver.flush(16);
    texture!.send({ type: "pause", paused: true }); driver.flush(32);
    const active = frames.at(-1)!;
    expect(active).not.toEqual(base);
    rippleStrength = 0; pibbl(canvas, <Scene />); driver.flush(48);
    expect(capture(48)).toEqual(base);
    rippleStrength = 1; pibbl(canvas, <Scene />); driver.flush(64);
    expect(capture(64)).toEqual(active);
  } finally { controller.dispose(); restore(); }
});

it("adds bounded click ripples, freezes them while paused, and idles after their lifetime", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const frames: number[][] = [];
  let texture: ReturnType<typeof useTexture<any>>;
  function Scene() {
    texture = useTexture(waterWaves({ seed: 4, speed: 0 }), { resolution: { width: 16, height: 8 } });
    borrowTextureRaster(texture, raster => frames.push(Array.from(raster.source.getContext("2d")!.getImageData(0, 0, 16, 8).data)));
    return <Rectangle style={{ width: 16, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  const capture = (time: number) => { pibbl(canvas, <Scene />); driver.flush(time); return frames.at(-1)!; };
  try {
    driver.flush(0);
    const baseline = frames.at(-1)!;
    texture!.send({ type: "ripple", x: 0.25, y: 0.5 }); driver.flush(16);
    const started = capture(16);
    expect(started).not.toEqual(baseline);
    driver.flush(616);
    expect(capture(616)).not.toEqual(started);
    texture!.send({ type: "pause", paused: true }); driver.flush(632);
    const paused = capture(632);
    expect(driver.pendingHostFrames).toBe(0);
    expect(frames.at(-1)).toEqual(paused);
    texture!.send({ type: "pause", paused: false }); driver.flush(1_648);
    expect(capture(1_648)).toEqual(paused);
    driver.flush(4_100);
    expect(driver.pendingHostFrames).toBe(0);
    texture!.send({ type: "ripple", x: 0.75, y: 0.5 }); driver.flush(10_000);
    expect(frames.at(-1)).not.toEqual(baseline);
    driver.flush(10_016);
    expect(frames.at(-1)).not.toEqual(baseline);
    texture!.send({ type: "reset" }); driver.flush(10_032);
    expect(frames.at(-1)).toEqual(baseline);
  } finally { controller.dispose(); restore(); }
});

it("rejects non-finite normalized ripple coordinates", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let texture: ReturnType<typeof useTexture<any>>;
  function Scene() { texture = useTexture(waterWaves({ speed: 0 })); return <Rectangle style={{ width: 1, height: 1, fill: texture }} />; }
  const canvas = document.createElement("canvas"); document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    texture!.send({ type: "ripple", x: Infinity, y: 0 });
    expect(() => driver.flush(16)).toThrow("must be finite");
  } finally { controller.dispose(); restore(); }
});

it("rejects an invalid rippleStrength", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas"); document.body.append(canvas);
  const controller = pibbl(canvas, <Probe />);
  try { expect(() => driver.flush(0)).toThrow("Water ripple strength must be finite and nonnegative"); }
  finally { controller.dispose(); restore(); }
  function Probe() { useTexture(waterWaves({ rippleStrength: -1 })); return null; }
});

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
  const controller = pibbl(canvas, <Scene />);
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
  const controller = pibbl(canvas, <Probe />);
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
  const controller = pibbl(canvas, <Scene />);
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
  const controller = pibbl(canvas, scene());
  try {
    driver.flush(0); texture!.send({ type: "pause", paused: true }); driver.flush(16);
    pibbl(canvas, scene()); driver.flush(10_000);
    expect(driver.pendingHostFrames).toBe(0);
    texture!.send({ type: "pause", paused: false }); driver.flush(10_016);
    expect(frames.at(-1)).toEqual(frames[0]);
    driver.flush(11_032);
    expect(driver.pendingHostFrames).toBe(1);
  } finally { controller.dispose(); restore(); }
});

it("preserves a message pause when authored speed changes", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let texture: ReturnType<typeof useTexture<any>>;
  let speed = 1;
  function Scene() {
    texture = useTexture(waterWaves({ seed: 3, speed }), { resolution: { width: 8, height: 8 } });
    return <Rectangle style={{ width: 8, height: 8, fill: texture }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    texture!.send({ type: "pause", paused: true }); driver.flush(16);
    expect(driver.pendingHostFrames).toBe(0);
    speed = 2;
    pibbl(canvas, <Scene />); driver.flush(1000);
    expect(driver.pendingHostFrames).toBe(0);
    texture!.send({ type: "pause", paused: false }); driver.flush(1016);
    expect(driver.pendingHostFrames).toBe(1);
  } finally { controller.dispose(); restore(); }
});
