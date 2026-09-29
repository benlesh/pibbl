/** @jsxImportSource @crc/core */
import { Circle, Group, Rectangle, crc, signal } from "@crc/core";
import {
  PhysicsWorld2D,
  inspectPhysics2D,
  crcPhysicsWorld2D,
  kinematicBody2D,
  collider2D,
  crcPhysicsBody2D,
  dynamicBody2D,
  staticBody2D,
  type CRCPhysicsWorldHandle2D,
  type CRCPhysicsBodyHandle2D,
} from "@crc/physics/2d";
import {
  loadScenario,
  physics2DLabScenarioEntry,
  type Physics2DLabState,
  type ScenarioController,
} from "@crc/scenarios";
import { createPhysicsTestHarness2D } from "@crc/physics/2d/testing";
import { describe, it, expect } from "vitest";
import {
  ManualSchedulerDriver,
  installSchedulerDriverForTest,
} from "../src/lib/scheduler/testing.js";

describe("public physics simulation quality", () => {
  it("keeps the untouched mixed-shape lab above the floor and naturally sleeps", async () => {
    const driver = new ManualSchedulerDriver();
    const restore = installSchedulerDriverForTest(driver);
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 240;
    document.body.append(canvas);
    let controller: ScenarioController<Physics2DLabState> | undefined;
    try {
      controller = await (
        await loadScenario(physics2DLabScenarioEntry)
      ).mount({ canvas });
      for (let frame = 0; frame <= 600; frame++)
        if (driver.pendingHostFrames) driver.flush(frame * 50);

      const bodies = controller.getState().bodies;
      expect(bodies.circle.position[1]).toBeLessThanOrEqual(204.5);
      for (const id of [
        "circle",
        "box",
        "ellipse",
        "capsule",
        "polygon",
        "star",
        "handoff",
      ] as const) {
        expect(bodies[id].position[1], id).toBeLessThan(216);
        expect(bodies[id].sleeping, id).toBe(true);
      }
    } finally {
      await controller?.dispose();
      restore();
      canvas.remove();
    }
  });
  for (const fixedStepMilliseconds of [50, 1000 / 60])
    it(`naturally rests a pixel-scale circle at ${fixedStepMilliseconds} ms`, () => {
      const driver = new ManualSchedulerDriver();
      const restore = installSchedulerDriverForTest(driver);
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 240;
      document.body.append(canvas);
      let body!: CRCPhysicsBodyHandle2D;
      function Ball() {
        body = crcPhysicsBody2D();
        return (
          <Group
            style={{ translateX: 64, translateY: 202 }}
            physics={dynamicBody2D({
              handle: body,
              collider: false,
              mass: 1,
              linearDamping: 0.15,
            })}
          >
            <Circle
              physics={collider2D({ restitution: 0.1 })}
              style={{ radius: 12 }}
            />
          </Group>
        );
      }
      const mount = crc(
        canvas,
        <PhysicsWorld2D
          gravity={[0, 600]}
          fixedStepMilliseconds={fixedStepMilliseconds}
        >
          <Rectangle
            physics={staticBody2D()}
            style={{ x: 12, y: 216, width: 456, height: 20 }}
          />
          <Ball />
        </PhysicsWorld2D>,
      );
      try {
        for (
          let frame = 0;
          frame <= Math.ceil(5000 / fixedStepMilliseconds);
          frame++
        )
          if (driver.pendingHostFrames)
            driver.flush(frame * fixedStepMilliseconds);
        expect(body.position.get()[1]).toBeCloseTo(204, 1);
        expect(body.sleeping.get()).toBe(true);
        expect(body.linearVelocity.get()).toEqual([0, 0]);
      } finally {
        mount.dispose();
        restore();
        canvas.remove();
      }
    });
});

it("naturally settles a 100-box pile without keeping the world clock alive", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1000;
  document.body.append(canvas);
  const handles: CRCPhysicsBodyHandle2D[] = [];
  function Box({ index }: { index: number }) {
    const body = crcPhysicsBody2D();
    handles[index] = body;
    return (
      <Group
        physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
        style={{
          translateX: 60 + (index % 20) * 42,
          translateY: 900 - (Math.floor(index / 20) + 0.5) * 42,
        }}
      >
        <Rectangle
          physics={collider2D({ friction: 0.6 })}
          style={{ x: -20, y: -20, width: 40, height: 40 }}
        />
      </Group>
    );
  }
  const mount = crc(
    canvas,
    <PhysicsWorld2D gravity={[0, 600]}>
      <Rectangle
        physics={staticBody2D({ collider: { friction: 0.6 } })}
        style={{ x: 0, y: 950, width: 1000, height: 100 }}
      />
      {Array.from({ length: 100 }, (_, index) => (
        <Box key={index} index={index} />
      ))}
    </PhysicsWorld2D>,
  );
  try {
    for (let i = 0; i <= 1200; i++)
      if (driver.pendingHostFrames) driver.flush((i * 1000) / 60);
    expect(handles.filter((body) => body.sleeping.get()).length).toBe(100);
    for (const body of handles)
      expect(body.position.get()[1]).toBeLessThanOrEqual(930.5);
    expect(driver.pendingHostFrames).toBe(0);
  } finally {
    mount.dispose();
    restore();
    canvas.remove();
  }
});

it("carries a passenger equivalently at 30 and 60 Hz host cadence", () => {
  function run(hz: number) {
    const target = signal<readonly [number, number]>([100, 150]);
    let world!: CRCPhysicsWorldHandle2D;
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 300;
    document.body.append(canvas);
    function Scene() {
      world = crcPhysicsWorld2D();
      return (
        <>
          <Group
            physics={kinematicBody2D({
              target: { position: target },
              collider: false,
            })}
            style={{ translateX: 100, translateY: 150 }}
          >
            <Rectangle
              physics={collider2D({ friction: 1 })}
              style={{ x: -60, y: 0, width: 120, height: 10 }}
            />
          </Group>
          <Group
            physics={dynamicBody2D({ mass: 1, collider: false })}
            style={{ translateX: 100, translateY: 139 }}
          >
            <Rectangle
              physics={collider2D({ friction: 1 })}
              style={{ x: -10, y: -10, width: 20, height: 20 }}
            />
          </Group>
        </>
      );
    }
    const harness = createPhysicsTestHarness2D({
      canvas,
      root: () => (
        <PhysicsWorld2D gravity={[0, 600]} interpolation="none">
          <Scene />
        </PhysicsWorld2D>
      ),
      observe: () => inspectPhysics2D(world),
    });
    try {
      harness.flush();
      harness.flush();
      harness.advanceFrames(120, 1000 / 60);
      for (let frame = 1; frame <= hz * 2; frame++) {
        target.set([100 + (frame * 30) / hz, 150]);
        harness.advanceFrames(1, 1000 / hz);
      }
      return harness.observe().bodies.find((body) => body.type === "dynamic")!;
    } finally {
      harness.dispose();
      canvas.remove();
    }
  }
  const sixty = run(60),
    thirty = run(30);
  expect(sixty.pose.position[0]).toBeGreaterThan(145);
  expect(thirty.pose.position[0]).toBeCloseTo(sixty.pose.position[0], 0);
  expect(thirty.pose.position[1]).toBeCloseTo(sixty.pose.position[1], 1);
});

it("delivers a fast CCD impact through public callbacks even after immediate separation", () => {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const starts: string[] = [],
    hits: number[] = [],
    ends: string[] = [];
  function Ball({ x, v, label }: { x: number; v: number; label: string }) {
    return (
      <Group
        physics={dynamicBody2D({
          mass: 1,
          ccd: true,
          linearVelocity: [v, 0],
          collider: false,
        })}
        style={{ translateX: x }}
      >
        <Circle
          physics={collider2D({
            restitution: 1,
            onCollisionStart: () => starts.push(label),
            onCollisionEnd: () => ends.push(label),
            onHit: (event) => hits.push(event.totalNormalImpulse),
          })}
          style={{ radius: 5 }}
        />
      </Group>
    );
  }
  const harness = createPhysicsTestHarness2D({
    canvas,
    root: () => (
      <PhysicsWorld2D>
        <Ball x={-20} v={5000} label="a" />
        <Ball x={20} v={-5000} label="b" />
      </PhysicsWorld2D>
    ),
    observe: () => ({ starts, hits, ends }),
  });
  try {
    harness.flush();
    harness.flush();
    harness.advanceFrames(1);
    expect(starts.sort()).toEqual(["a", "b"]);
    expect(hits).toHaveLength(2);
    expect(hits.every((value) => value > 0)).toBe(true);
    harness.advanceFrames(1);
    expect(ends.sort()).toEqual(["a", "b"]);
  } finally {
    harness.dispose();
    canvas.remove();
  }
});

it("lets a world sleep when collision callbacks are authored inline", () => {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  let world!: CRCPhysicsWorldHandle2D;
  function Scene() {
    world = crcPhysicsWorld2D();
    return (
      <>
        <Circle
          physics={dynamicBody2D({
            mass: 1,
            collider: { onHit: () => undefined },
          })}
          style={{ cx: 30, cy: 88, radius: 12 }}
        />
        <Rectangle
          physics={staticBody2D()}
          style={{ x: 0, y: 100, width: 200, height: 10 }}
        />
      </>
    );
  }
  const harness = createPhysicsTestHarness2D({
    canvas,
    root: () => (
      <PhysicsWorld2D gravity={[0, 600]}>
        <Scene />
      </PhysicsWorld2D>
    ),
    observe: () => inspectPhysics2D(world),
  });
  try {
    harness.flush();
    harness.flush();
    harness.advanceFrames(600);
    expect(
      harness.observe().bodies.find((body) => body.type === "dynamic")
        ?.sleeping,
    ).toBe(true);
    expect(harness.pendingFrames).toBe(0);
  } finally {
    harness.dispose();
    canvas.remove();
  }
});
