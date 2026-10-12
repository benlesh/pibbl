import { afterEach, expect, it } from "vitest";
import { pibbl, Rectangle, useTexture } from "@pibbl/core";
import { borrowTextureRaster } from "@pibbl/core/internal";
import { waterSurface } from "@pibbl/core/textures";
import { clearSharedState } from "../../../src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../../src/lib/scheduler/testing.js";

afterEach(() => {
  clearSharedState();
  document.body.innerHTML = "";
});

it("reflects a bounded WASM ripple at a solid rectangle, leaves solids transparent, and idles at speed zero", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let blocked!: ReturnType<typeof useTexture<any>>;
  let open!: ReturnType<typeof useTexture<any>>;
  const blockedFrames: Uint8ClampedArray[] = [];
  const openFrames: Uint8ClampedArray[] = [];
  function Scene() {
    blocked = useTexture(
      waterSurface({
        seed: 7,
        speed: 0,
        obstacles: [{ x: 0.48, y: 0.25, width: 0.08, height: 0.5 }],
      }),
      { resolution: { width: 48, height: 24 } },
    );
    open = useTexture(waterSurface({ seed: 7, speed: 0 }), {
      resolution: { width: 48, height: 24 },
    });
    borrowTextureRaster(blocked, (raster) =>
      blockedFrames.push(
        raster.source.getContext("2d")!.getImageData(0, 0, 48, 24).data,
      ),
    );
    borrowTextureRaster(open, (raster) =>
      openFrames.push(
        raster.source.getContext("2d")!.getImageData(0, 0, 48, 24).data,
      ),
    );
    return (
      <>
        <Rectangle style={{ width: 48, height: 24, fill: blocked }} />
        <Rectangle style={{ width: 48, height: 24, fill: open }} />
      </>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 48;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    expect(driver.pendingHostFrames).toBe(0);
    const baseline = blockedFrames.at(-1)!;
    // The center of the obstacle is not a displacement sample.
    expect(baseline[(12 * 48 + 25) * 4 + 3]).toBe(0);
    blocked.send({ type: "ripple", x: 0.3, y: 0.5 });
    open.send({ type: "ripple", x: 0.3, y: 0.5 });
    driver.flush(16);
    driver.flush(80);
    driver.flush(160);
    driver.flush(240);
    driver.flush(480);
    driver.flush(800);
    const afterImpact = blockedFrames.at(-1)!;
    // Once it has met the rectangle, the returning field differs from open water.
    const openAfterImpact = openFrames.at(-1)!;
    let returnedDifference = false;
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 23; x++) {
        const offset = (y * 48 + x) * 4;
        if (
          afterImpact[offset + 3] === 255 &&
          (afterImpact[offset] !== openAfterImpact[offset] ||
            afterImpact[offset + 1] !== openAfterImpact[offset + 1])
        )
          returnedDifference = true;
      }
    expect(returnedDifference).toBe(true);
    expect(afterImpact[(12 * 48 + 25) * 4 + 3]).toBe(0);
  } finally {
    controller.dispose();
    restore();
  }
});

it("honors pause/reset and discards paused elapsed time without reviving a settled zero-speed surface", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let texture!: ReturnType<typeof useTexture<any>>;
  const frames: number[][] = [];
  function Scene() {
    texture = useTexture(waterSurface({ speed: 0, rippleStrength: 1 }), {
      resolution: { width: 24, height: 16 },
    });
    borrowTextureRaster(texture, (raster) =>
      frames.push(
        Array.from(
          raster.source.getContext("2d")!.getImageData(0, 0, 24, 16).data,
        ),
      ),
    );
    return <Rectangle style={{ width: 24, height: 16, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 32;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    const baseline = frames.at(-1)!;
    texture.send({ type: "ripple", x: 0.2, y: 0.5 });
    driver.flush(16);
    driver.flush(48);
    texture.send({ type: "pause", paused: true });
    driver.flush(64);
    const paused = frames.at(-1)!;
    driver.flush(10_000);
    texture.send({ type: "pause", paused: false });
    driver.flush(10_016);
    expect(frames.at(-1)).toEqual(paused);
    texture.send({ type: "reset" });
    driver.flush(10_032);
    expect(frames.at(-1)).toEqual(baseline);
  } finally {
    controller.dispose();
    restore();
  }
});

it("rejects invalid normalized obstacles", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const controller = pibbl(canvas, <Probe />);
  try {
    expect(() => driver.flush(0)).toThrow("Water surface obstacles");
  } finally {
    controller.dispose();
    restore();
  }
  function Probe() {
    useTexture(
      waterSurface({ obstacles: [{ x: 0.9, y: 0, width: 0.2, height: 1 }] }),
    );
    return null;
  }
});

it("starts a bounded wake when an obstacle moves from an idle surface", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let left = 0.3;
  const frames: number[][] = [];
  function Scene() {
    const water = useTexture(
      waterSurface({
        speed: 0,
        obstacles: [{ x: left, y: 0.25, width: 0.16, height: 0.5 }],
      }),
      { resolution: { width: 48, height: 24 } },
    );
    borrowTextureRaster(water, (raster) =>
      frames.push(
        Array.from(
          raster.source.getContext("2d")!.getImageData(0, 0, 48, 24).data,
        ),
      ),
    );
    return <Rectangle style={{ width: 48, height: 24, fill: water }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 48;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    const idle = frames.at(-1)!;
    left = 0.52;
    pibbl(canvas, <Scene />);
    driver.flush(16);
    driver.flush(48);
    driver.flush(80);
    const wake = frames.at(-1)!;
    // This point is fluid before and after the move, behind the old obstacle.
    expect(wake.slice((12 * 48 + 8) * 4, (12 * 48 + 12) * 4)).not.toEqual(
      idle.slice((12 * 48 + 8) * 4, (12 * 48 + 12) * 4),
    );
  } finally {
    controller.dispose();
    restore();
  }
});

it("applies rippleStrength live to an already simulated surface", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let rippleStrength = 0;
  let texture!: ReturnType<typeof useTexture<any>>;
  const frames: number[][] = [];
  function Scene() {
    texture = useTexture(waterSurface({ speed: 0, rippleStrength }), {
      resolution: { width: 24, height: 16 },
    });
    borrowTextureRaster(texture, (raster) =>
      frames.push(
        Array.from(
          raster.source.getContext("2d")!.getImageData(0, 0, 24, 16).data,
        ),
      ),
    );
    return <Rectangle style={{ width: 24, height: 16, fill: texture }} />;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 32;
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    const baseline = frames.at(-1)!;
    texture.send({ type: "ripple", x: 0.3, y: 0.5 });
    driver.flush(16);
    driver.flush(48);
    expect(frames.at(-1)).toEqual(baseline);
    rippleStrength = 1;
    pibbl(canvas, <Scene />);
    driver.flush(64);
    driver.flush(80);
    expect(frames.at(-1)).not.toEqual(baseline);
  } finally {
    controller.dispose();
    restore();
  }
});

it("viscosity keeps disturbances local", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const textures: ReturnType<typeof useTexture<any>>[] = [];
  const snapshots: number[][] = [];
  function Scene() {
    return (
      <>
        {[0, 1].map((viscosity, index) => {
          const texture = useTexture(waterSurface({ speed: 0, viscosity }), {
            resolution: { width: 48, height: 24 },
          });
          textures[index] = texture;
          borrowTextureRaster(texture, (raster) => {
            snapshots[index] = Array.from(
              raster.source.getContext("2d")!.getImageData(0, 0, 48, 24).data,
            );
          });
          return (
            <Rectangle
              key={index}
              style={{ width: 48, height: 24, fill: texture }}
            />
          );
        })}
      </>
    );
  }
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />);
  try {
    driver.flush(0);
    const baseline = snapshots.map((value) => [...value]);
    for (const texture of textures)
      texture.send({ type: "ripple", x: 0.5, y: 0.5 });
    for (let time = 16; time <= 416; time += 16) driver.flush(time);
    const outerChange = (index: number) =>
      snapshots[index].reduce((total, value, offset) => {
        const pixel = Math.floor(offset / 4),
          x = pixel % 48,
          y = Math.floor(pixel / 48);
        return offset % 4 < 2 && Math.hypot(x - 23.5, y - 11.5) > 6
          ? total + Math.abs(value - baseline[index][offset])
          : total;
      }, 0);
    expect(outerChange(0)).toBeGreaterThan(0);
    expect(outerChange(1)).toBeLessThan(outerChange(0) * 0.25);
    expect(snapshots[1]).not.toEqual(baseline[1]);
  } finally {
    controller.dispose();
    restore();
  }
});
