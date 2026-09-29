/** @jsxImportSource @crc/core */
import { Circle, Group, crc, signal } from "@crc/core";
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  dynamicBody2D,
  kinematicBody2D,
  type CRCPhysicsBodyHandle2D,
} from "@crc/physics/2d";
import { expect, it, vi } from "vitest";
import { PhysicsWorld2DKernel } from "../../physics/src/lib/2d/world/world.js";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";

it("does not copy the entire world for each body presentation", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 240;
  document.body.append(canvas);
  const mount = crc(
    canvas,
    <PhysicsWorld2D>
      {Array.from({ length: 32 }, (_, i) => (
        <Circle
          key={i}
          physics={dynamicBody2D({ linearVelocity: [1, 0] })}
          style={{ cx: i * 12, cy: 10, radius: 2 }}
        />
      ))}
    </PhysicsWorld2D>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    const spy = vi.spyOn(PhysicsWorld2DKernel.prototype, "snapshot");
    driver.flush(20);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(5);
  } finally {
    vi.restoreAllMocks();
    mount.dispose();
    restore();
    canvas.remove();
  }
});

it("idles a stationary kinematic world and wakes when its target changes", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 240;
  document.body.append(canvas);
  const target = signal<readonly [number, number]>([20, 20]);
  let body!: CRCPhysicsBodyHandle2D;
  function Platform() {
    body = crcPhysicsBody2D();
    return (
      <Group
        physics={kinematicBody2D({
          handle: body,
          collider: false,
          target: { position: target },
        })}
        style={{ translateX: 20, translateY: 20 }}
      >
        <Circle physics={collider2D()} style={{ radius: 4 }} />
      </Group>
    );
  }
  const mount = crc(
    canvas,
    <PhysicsWorld2D>
      <Platform />
    </PhysicsWorld2D>,
  );
  try {
    for (let t = 0; t <= 100; t += 20)
      if (driver.pendingHostFrames) driver.flush(t);
    expect(driver.pendingHostFrames).toBe(0);
    target.set([40, 20]);
    expect(driver.pendingHostFrames).toBe(1);
    for (let t = 120; t <= 200; t += 20)
      if (driver.pendingHostFrames) driver.flush(t);
    expect(body.position.get()).toEqual([40, 20]);
    expect(driver.pendingHostFrames).toBe(0);
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});
