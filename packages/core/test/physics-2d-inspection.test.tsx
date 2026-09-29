/** @jsxImportSource @crc/core */
import { Circle, Group, crc, signal } from "@crc/core";
import {
  PhysicsDebug2D,
  PhysicsWorld2D,
  collider2D,
  circleShape2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  staticBody2D,
  crcPhysicsBody2D,
  disableBody2D,
  inspectPhysics2D,
  setLinearVelocity2D,
  toPhysicsPoint2D,
  fromPhysicsPoint2D,
  type CRCPhysicsBodyHandle2D,
  type CRCPhysicsWorldHandle2D,
} from "@crc/physics/2d";
import { expect, it } from "vitest";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";

it("exposes immutable JSON-safe simulation observations without advancing or scheduling the world", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  let world!: CRCPhysicsWorldHandle2D;
  function Ball() {
    world = crcPhysicsWorld2D();
    return (
      <Group
        physics={dynamicBody2D({ mass: 1, collider: false })}
        style={{ translateX: 10, translateY: 15 }}
      >
        <Circle physics={collider2D({ tag: "ball" })} style={{ radius: 5 }} />
      </Group>
    );
  }
  const mount = crc(
    canvas,
    <Group style={{ translateX: 50 }}>
      <Group style={{ scaleX: 2, scaleY: 2 }}>
        <PhysicsWorld2D space="local" gravity={[0, 0]}>
          <Ball />
        </PhysicsWorld2D>
      </Group>
    </Group>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    const pending = driver.pendingHostFrames;
    const first = inspectPhysics2D(world);
    expect(first.bodies).toHaveLength(1);
    expect(first.bodies[0]!.pose.position).toEqual([10, 15]);
    expect(first.colliders[0]!.bounds).toEqual({ min: [5, 10], max: [15, 20] });
    expect(first.colliders[0]!.label).toBe("ball");
    expect(first.engine).toBe("rapier-2d@0.21.0");
    expect(Object.isFrozen(first.bodies)).toBe(true);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(inspectPhysics2D(world)).toEqual(first);
    expect(driver.pendingHostFrames).toBe(pending);
    expect(toPhysicsPoint2D(world, [70, 30])).toEqual([10, 15]);
    expect(fromPhysicsPoint2D(world, [10, 15])).toEqual([70, 30]);
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});

it("retains declared body type in observations while disabled", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  let world!: CRCPhysicsWorldHandle2D;
  let body!: CRCPhysicsBodyHandle2D;
  function Ball() {
    world = crcPhysicsWorld2D();
    body = crcPhysicsBody2D();
    return (
      <Circle physics={dynamicBody2D({ handle: body })} style={{ radius: 5 }} />
    );
  }
  const mount = crc(
    canvas,
    <PhysicsWorld2D>
      <Ball />
    </PhysicsWorld2D>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    disableBody2D(body);
    driver.flush(16);
    expect(inspectPhysics2D(world).bodies[0]).toMatchObject({
      type: "dynamic",
      enabled: false,
    });
    expect(inspectPhysics2D(body)).toMatchObject({
      type: "dynamic",
      enabled: false,
    });
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});

it("inspects each requested body handle without selecting another dynamic body or scheduling work", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const showStale = signal(true);
  let first!: CRCPhysicsBodyHandle2D;
  let second!: CRCPhysicsBodyHandle2D;
  let stale!: CRCPhysicsBodyHandle2D;

  function First() {
    first = crcPhysicsBody2D();
    return (
      <Group
        physics={dynamicBody2D({ handle: first, collider: false, mass: 1 })}
        style={{ translateX: 40, translateY: 30 }}
      >
        <Circle style={{ radius: 5 }} />
      </Group>
    );
  }

  function Second() {
    second = crcPhysicsBody2D();
    return (
      <Group
        physics={dynamicBody2D({ handle: second, collider: false, mass: 1 })}
        style={{ translateX: 180, translateY: 90 }}
      >
        <Circle style={{ radius: 5 }} />
      </Group>
    );
  }

  function Stale() {
    stale = crcPhysicsBody2D();
    return (
      <Group
        physics={dynamicBody2D({ handle: stale, collider: false, mass: 1 })}
        style={{ translateX: 300, translateY: 150 }}
      >
        <Circle style={{ radius: 5 }} />
      </Group>
    );
  }

  function Scene() {
    return (
      <>
        <First />
        <Second />
        {showStale.get() && <Stale />}
      </>
    );
  }

  const mount = crc(
    canvas,
    <PhysicsWorld2D gravity={[0, 0]}>
      <Scene />
    </PhysicsWorld2D>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    const pending = driver.pendingHostFrames;

    expect(inspectPhysics2D(first)?.pose.position).toEqual([40, 30]);
    expect(inspectPhysics2D(second)?.pose.position).toEqual([180, 90]);
    expect(driver.pendingHostFrames).toBe(pending);

    showStale.set(false);
    driver.flush(16);
    expect(inspectPhysics2D(stale)).toBeUndefined();
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});

it("keeps Rapier collider geometry aligned after an asymmetric auto-mass density update", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 80;
  document.body.append(canvas);
  const leftDensity = signal(1);
  const leftShape = circleShape2D({ radius: 10, center: [-50, 0] });
  const rightShape = circleShape2D({ radius: 10, center: [50, 0] });
  const wallShape = circleShape2D({ radius: 10, center: [100, 0] });
  let world!: CRCPhysicsWorldHandle2D;
  let body!: CRCPhysicsBodyHandle2D;
  function Left() {
    return (
      <Circle
        physics={collider2D({ density: leftDensity.get(), shape: leftShape })}
        style={{ radius: 10 }}
      />
    );
  }
  function Body() {
    world = crcPhysicsWorld2D();
    body = crcPhysicsBody2D();
    return (
      <Group
        physics={dynamicBody2D({
          handle: body,
          collider: false,
          mass: "auto",
        })}
      >
        <Left />
        <Circle
          physics={collider2D({ density: 1, shape: rightShape })}
          style={{ radius: 10 }}
        />
      </Group>
    );
  }
  const mount = crc(
    canvas,
    <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
      <Body />
      <Group physics={staticBody2D({ collider: false })}>
        <Circle
          physics={collider2D({ shape: wallShape })}
          style={{ radius: 10 }}
        />
      </Group>
    </PhysicsWorld2D>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    // The density update moves the center of mass from 0 to -25 while retaining
    // the authored collider geometry. A later motion must still reach the wall.
    leftDensity.set(3);
    driver.flush(100);
    driver.flush(200);
    expect(inspectPhysics2D(world).bodies[0]!.centerOfMass[0]).toBeCloseTo(
      -25,
      4,
    );
    setLinearVelocity2D(body, [330, 0]);
    driver.flush(300);
    driver.flush(400);
    const inspection = inspectPhysics2D(world);
    expect(inspection.contacts.some((contact) => !contact.sensor)).toBe(true);
    expect(inspection.bodies[0]!.centerOfMass[0]).toBeGreaterThan(0);
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});

it("renders the diagnostic overlay without changing authoritative state", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  let world!: CRCPhysicsWorldHandle2D;
  const show = signal(false);
  function Scene() {
    world = crcPhysicsWorld2D();
    return (
      <>
        <Circle
          physics={staticBody2D()}
          style={{ cx: 20, cy: 30, radius: 5 }}
        />
        {show.get() && <PhysicsDebug2D world={world} />}
      </>
    );
  }
  const mount = crc(
    canvas,
    <Group style={{ translateX: 40, scaleX: 2, scaleY: 2 }}>
      <PhysicsWorld2D space="local">
        <Scene />
      </PhysicsWorld2D>
    </Group>,
  );
  try {
    driver.flush(0);
    driver.flush(0);
    const before = inspectPhysics2D(world);
    show.set(true);
    driver.flush(0);
    const after = inspectPhysics2D(world);
    expect(after.bodies).toEqual(before.bodies);
    expect(after.colliders).toEqual(before.colliders);
    expect(after.tick).toBe(before.tick);
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});
