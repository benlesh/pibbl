/** @jsxImportSource @pibbl/core */
import { Circle, Group, pibbl, signal } from "@pibbl/core";
import {
  PhysicsWorld2D,
  collider2D,
  pibblPhysicsBody2D,
  dynamicBody2D,
  kinematicBody2D,
  type PibblPhysicsBodyHandle2D,
} from "@pibbl/core/physics/2d";
import { expect, it, vi } from "vitest";
import { PhysicsWorld2DKernel } from "../src/features/physics/lib/2d/world/world.js";
import { getSignalNode } from "../src/lib/signals/graph.js";
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
  const bodies: PibblPhysicsBodyHandle2D[] = [];
  function Ball({ index }: { index: number }) {
    const body = pibblPhysicsBody2D();
    bodies[index] = body;
    return (
      <Circle
        physics={dynamicBody2D({ handle: body, linearVelocity: [1, 0] })}
        style={{ cx: index * 12, cy: 10, radius: 2 }}
      />
    );
  }
  const mount = pibbl(
    canvas,
    <PhysicsWorld2D>
      {Array.from({ length: 32 }, (_, i) => (
        <Ball key={i} index={i} />
      ))}
    </PhysicsWorld2D>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    const spy = vi.spyOn(PhysicsWorld2DKernel.prototype, "snapshot");
    driver.flush(20);
    expect(spy).not.toHaveBeenCalled();
    expect(bodies[0]!.linearVelocity.get()).toEqual([1, 0]);
    expect(bodies[0]!.rotationDegrees.get()).toBe(0);
    expect(bodies[0]!.angularVelocityDegreesPerSecond.get()).toBe(0);
    expect(bodies[0]!.sleeping.get()).toBe(false);
    expect(bodies[0]!.enabled.get()).toBe(true);
    expect(bodies[0]!.generation.get()).toBe(1);
  } finally {
    vi.restoreAllMocks();
    mount.dispose();
    restore();
    canvas.remove();
  }
});

it("rolls back direct body signal staging when Commit rejects a physics candidate", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  document.body.append(canvas);
  let body!: PibblPhysicsBodyHandle2D;
  function Ball() {
    body = pibblPhysicsBody2D();
    return (
      <Circle
        physics={dynamicBody2D({ handle: body, linearVelocity: [1, 0] })}
        style={{ radius: 2 }}
      />
    );
  }
  const mount = pibbl(
    canvas,
    <PhysicsWorld2D>
      <Ball />
    </PhysicsWorld2D>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    const before = {
      position: body.position.get(),
      rotationDegrees: body.rotationDegrees.get(),
      linearVelocity: body.linearVelocity.get(),
      angularVelocityDegreesPerSecond:
        body.angularVelocityDegreesPerSecond.get(),
      sleeping: body.sleeping.get(),
      enabled: body.enabled.get(),
      generation: body.generation.get(),
    };
    const node = getSignalNode(body.position) as any;
    const equals = node.equals;
    node.equals = () => {
      throw new Error("physics Commit rejected");
    };
    expect(() => driver.flush(20)).toThrow("physics Commit rejected");
    node.equals = equals;
    expect({
      position: body.position.get(),
      rotationDegrees: body.rotationDegrees.get(),
      linearVelocity: body.linearVelocity.get(),
      angularVelocityDegreesPerSecond:
        body.angularVelocityDegreesPerSecond.get(),
      sleeping: body.sleeping.get(),
      enabled: body.enabled.get(),
      generation: body.generation.get(),
    }).toEqual(before);
  } finally {
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
  let body!: PibblPhysicsBodyHandle2D;
  function Platform() {
    body = pibblPhysicsBody2D();
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
  const mount = pibbl(
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
