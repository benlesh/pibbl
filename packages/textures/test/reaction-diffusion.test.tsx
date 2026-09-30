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
