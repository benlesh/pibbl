import { afterEach, expect, it } from "vitest";
import { crc, Group } from "@crc/core";
import { ReactionDiffusion } from "@crc/textures";
import { clearSharedState } from "../../core/src/lib/global-state.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../../core/src/lib/scheduler/testing.js";
import {
  pointerDownLogicalPoint,
  pointerMoveLogicalPoint,
  pointerUpLogicalPoint,
} from "../../core/test/support/user-input.js";

afterEach(() => {
  clearSharedState();
  document.body.innerHTML = "";
});

it("paints through routed input while paused and preserves the field across reevaluation and display resize", async () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 240;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const scene = (width: number, resetRevision = 0) => (
    <Group style={{ translateX: 20, translateY: 20, scaleX: 2, scaleY: 2 }}>
      <ReactionDiffusion
        paused
        seed={42}
        resolution={{ width: 64, height: 40 }}
        resetRevision={resetRevision}
        palette={["#000000", "#ffffff"]}
        brush={{ radius: 3, strength: 1 }}
        style={{ width, height: 80 }}
      />
    </Group>
  );
  const sample = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[0];
  const controller = crc(canvas, scene(128));
  try {
    driver.flush(0);
    const before = sample(52, 60);
    await pointerDownLogicalPoint(canvas, { x: 52, y: 60 });
    await pointerMoveLogicalPoint(canvas, { x: 116, y: 60 });
    await pointerUpLogicalPoint(canvas, { x: 116, y: 60 });
    driver.flush(16);
    expect(sample(52, 60)).toBeGreaterThan(before);
    expect(sample(84, 60)).toBeGreaterThan(220);
    expect(driver.pendingHostFrames).toBe(0);
    crc(canvas, scene(160));
    driver.flush(32);
    expect(sample(60, 60)).toBeGreaterThan(220);
    crc(canvas, scene(128, 1));
    driver.flush(48);
    expect(sample(52, 60)).toBe(before);
  } finally {
    controller.dispose();
    restore();
  }
  expect(driver.pendingHostFrames).toBe(0);
});

it("keeps pointer-planted ink visible after two seconds of simulation", async () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvases = [
    document.createElement("canvas"),
    document.createElement("canvas"),
  ];
  for (const canvas of canvases) {
    canvas.width = 128;
    canvas.height = 80;
    document.body.append(canvas);
  }
  const snapshots: Uint8ClampedArray[] = [];
  const scene = (index: number, paused: boolean) => (
    <ReactionDiffusion
      paused={paused}
      seed={42}
      resolution={{ width: 128, height: 80 }}
      brush={{ radius: 6, strength: 0.8 }}
      style={{ width: 128, height: 80 }}
      render={(context, texture) => {
        snapshots[index] = texture.mask
          .getContext("2d")!
          .getImageData(0, 0, 128, 80).data;
        context.drawImage(texture.source, 0, 0);
      }}
    />
  );
  const controllers = canvases.map((canvas, i) => crc(canvas, scene(i, true)));
  const mass = (index: number, x: number, y: number) => {
    let total = 0;
    for (let py = y - 10; py <= y + 10; py++)
      for (let px = x - 10; px <= x + 10; px++)
        total += snapshots[index][(py * 128 + px) * 4 + 3];
    return total;
  };
  try {
    driver.flush(0);
    let point: { x: number; y: number } | undefined;
    for (let y = 12; y < 68 && !point; y++)
      for (let x = 12; x < 116 && !point; x++)
        if (mass(0, x, y) === 0) point = { x, y };
    expect(point).toBeDefined();
    await pointerDownLogicalPoint(canvases[0], point!);
    await pointerUpLogicalPoint(canvases[0], point!);
    driver.flush(16);
    expect(mass(0, point!.x, point!.y)).toBeGreaterThan(1000);
    canvases.forEach((canvas, i) => crc(canvas, scene(i, false)));
    driver.flush(32);
    for (let frame = 1; frame <= 120; frame++)
      driver.flush(32 + (frame * 1000) / 60);
    // Compare the painted colony with an identically seeded, unpainted surface.
    expect(
      mass(0, point!.x, point!.y) - mass(1, point!.x, point!.y),
    ).toBeGreaterThan(1000);
  } finally {
    controllers.forEach((controller) => controller.dispose());
    restore();
  }
  expect(driver.pendingHostFrames).toBe(0);
});
