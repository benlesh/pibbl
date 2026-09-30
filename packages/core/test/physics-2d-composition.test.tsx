/** @jsxImportSource @crc/core */
import { Circle, Group, crc, signal, definePrimitive } from "@crc/core";
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  dynamicBody2D,
  type CRCPhysicsBodyHandle2D,
} from "@crc/physics/2d";
import { expect, it } from "vitest";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";

it("keeps a local simulation stable while its parent panel moves and scales", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 300;
  document.body.append(canvas);
  const offset = signal(20),
    scale = signal(1);
  let body!: CRCPhysicsBodyHandle2D;
  let painted: DOMMatrix | undefined;
  const Paint = definePrimitive((_props, _style, context) => {
    painted = context.getTransform();
  });
  function Ball() {
    body = crcPhysicsBody2D();
    return (
      <Group
        physics={dynamicBody2D({
          handle: body,
          collider: false,
          mass: 1,
          linearVelocity: [10, 0],
        })}
        style={{ translateX: 10, translateY: 10 }}
      >
        <Circle physics={collider2D()} style={{ radius: 5 }} />
        <Paint />
      </Group>
    );
  }
  const mount = crc(
    canvas,
    <Group style={{ translateX: offset, scaleX: scale, scaleY: scale }}>
      <PhysicsWorld2D
        space="local"
        gravity={[0, 0]}
        fixedStepMilliseconds={100}
      >
        <Ball />
      </PhysicsWorld2D>
    </Group>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    driver.flush(100);
    const generation = body.generation.get();
    const before = body.position.get();
    offset.set(60);
    scale.set(2);
    driver.flush(150);
    expect(body.position.get()).toEqual(before);
    expect(body.generation.get()).toBe(generation);
    expect(body.linearVelocity.get()[0]).toBeCloseTo(10, 5);
    expect(painted!.a).toBeCloseTo(2);
    expect(painted!.e).toBeGreaterThan(120);
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});
