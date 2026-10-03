import { afterEach, expect, it } from "vitest";
import { crc, Rectangle, useTexture, type Texture } from "@crc/core";
import { rainDrops, type RainDropsMessage } from "@crc/textures";
import { clearSharedState } from "../../core/src/lib/global-state.js";
import { ManualSchedulerDriver, installSchedulerDriverForTest } from "../../core/src/lib/scheduler/testing.js";

afterEach(() => { clearSharedState(); document.body.innerHTML = ""; });

it("publishes seeded droplets, accepts mouse nudges while paused, resets, and resumes rain", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  let rain!: Texture<RainDropsMessage>;
  function Scene() {
    rain = useTexture(rainDrops({ seed: 7, initialDrops: 24, paused: true }), {
      resolution: { width: 128, height: 128 },
    });
    return <Rectangle style={{ width: 128, height: 128, fill: rain.paint({ mode: "stretch" }) }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  const pixels = () => Array.from(canvas.getContext("2d")!.getImageData(0, 0, 128, 128).data);
  try {
    driver.flush(0);
    const initial = pixels();
    expect(initial.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    expect(initial.some((value, index) => index % 4 === 3 && value === 0)).toBe(true);
    expect(driver.pendingHostFrames).toBe(0);
    rain.send({ type: "nudge", x: 0.5, y: 0.5, dx: 0.15, dy: 0, radius: 1 });
    driver.flush(16);
    expect(pixels()).not.toEqual(initial);
    expect(driver.pendingHostFrames).toBe(0);
    rain.send({ type: "reset" }); driver.flush(32);
    expect(pixels()).toEqual(initial);
    rain.send({ type: "pause", paused: false }); driver.flush(48);
    for (let time = 64; time <= 1040; time += 16) driver.flush(time);
    expect(pixels()).not.toEqual(initial);
    expect(driver.pendingHostFrames).toBe(1);
    controller.dispose();
    expect(driver.pendingHostFrames).toBe(0);
  } finally { controller.dispose(); restore(); }
});

it("clears condensation along a moved drop's path and restores the seeded film on reset", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let rain!: Texture<RainDropsMessage>;
  function Scene() {
    rain = useTexture(rainDrops({ seed: 7, initialDrops: 1, rainRate: 0, gravity: 0, paused: true, condensation: 1, trailPersistence: 8 }), { resolution: { width: 128, height: 128 } });
    return <Rectangle style={{ width: 128, height: 128, fill: rain.paint({ mode: "stretch" }) }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  const pixels = () => canvas.getContext("2d")!.getImageData(0, 0, 128, 128).data;
  const film = () => pixels().reduce((sum, value, index) => sum + (index % 4 === 2 ? value : 0), 0);
  try {
    driver.flush(0);
    const baseline = Array.from(pixels()), initialFilm = film();
    expect(pixels()[3]).toBe(255);
    expect(initialFilm).toBeGreaterThan(128 * 128 * 30);
    rain.send({ type: "nudge", x: 0.5, y: 0.5, dx: 0.45, dy: -0.3, radius: 2 }); driver.flush(16);
    expect(film()).toBeLessThan(initialFilm);
    const cleared = film();
    expect(driver.pendingHostFrames).toBe(0); expect(film()).toBe(cleared);
    rain.send({ type: "reset" }); driver.flush(1016);
    expect(Array.from(pixels())).toEqual(baseline);
  } finally { controller.dispose(); restore(); }
});

it("collects touched droplets into one held bead, follows the finger, and releases without losing water", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let rain!: Texture<RainDropsMessage>;
  function Scene() {
    rain = useTexture(rainDrops({ seed: 7, initialDrops: 24, rainRate: 0, paused: true }), { resolution: { width: 128, height: 128 } });
    return <Rectangle style={{ width: 128, height: 128, fill: rain }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  const pixels = () => Array.from(canvas.getContext("2d")!.getImageData(0, 0, 128, 128).data);
  try {
    driver.flush(0);
    rain.send({ type: "finger", x: 0.5, y: 0.5, radius: 2 }); driver.flush(16);
    rain.send({ type: "finger", x: 0.8, y: 0.8, radius: 0.06 }); driver.flush(32);
    const held = pixels(), wet: number[] = [];
    held.forEach((v, i) => { if (i % 4 === 3 && v > 10) wet.push((i - 3) / 4); });
    expect(wet.length).toBeGreaterThan(20);
    expect(wet.every(i => Math.hypot(i % 128 - 102, Math.floor(i / 128) - 102) < 15)).toBe(true);
    rain.send({ type: "pause", paused: false }); driver.flush(48);
    for (let time = 64; time <= 288; time += 16) driver.flush(time);
    expect(pixels()).toEqual(held);
    rain.send({ type: "pause", paused: true }); driver.flush(304);
    rain.send({ type: "release" }); driver.flush(320);
    expect(pixels()).toEqual(held);
    rain.send({ type: "pause", paused: false }); driver.flush(336);
    for (let time = 352; time <= 1360; time += 16) driver.flush(time);
    expect(pixels()).not.toEqual(held);
  } finally { controller.dispose(); restore(); }
});

it("wipes a continuous mist path between finger messages even without existing raindrops", () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let rain!: Texture<RainDropsMessage>;
  function Scene() {
    rain = useTexture(rainDrops({ initialDrops: 0, rainRate: 0, condensation: 1, paused: true }), { resolution: { width: 128, height: 128 } });
    return <Rectangle style={{ width: 128, height: 128, fill: rain }} />;
  }
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128; document.body.append(canvas);
  const controller = crc(canvas, <Scene />);
  const pixel = (x: number, y: number) => canvas.getContext("2d")!.getImageData(x, y, 1, 1).data;
  try {
    driver.flush(0);
    rain.send({ type: "finger", x: 0.2, y: 0.5, radius: 0.06 }); driver.flush(16);
    expect(pixel(26, 64)[2]).toBe(0);
    rain.send({ type: "finger", x: 0.8, y: 0.5, radius: 0.06 }); driver.flush(32);
    expect(pixel(64, 64)[2]).toBe(0);
    expect(pixel(64, 40)[2]).toBeGreaterThan(150);
    expect(driver.pendingHostFrames).toBe(0);
    rain.send({ type: "reset" }); driver.flush(48);
    expect(pixel(64, 64)[2]).toBeGreaterThan(150);
  } finally { controller.dispose(); restore(); }
});
