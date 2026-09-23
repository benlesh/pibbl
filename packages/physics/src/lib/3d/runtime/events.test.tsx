import { crc, type CRCController, type CRCNode } from "@crc/core";
import { Group3D, WebGLLayer } from "@crc/webgl";
/** @jsxImportSource @crc/core */
import {
  PhysicsWorld3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  disableBody3D,
  dynamicBody3D,
  type CRCPhysicsBodyHandle3D,
  type CRCPhysicsCollisionEvent3D,
  type CRCPhysicsWorldHandle3D,
} from "../../../3d.js";
import { sphereShape3D } from "../../../3d-geometry.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "./controller.js";
import {
  createPhysicsColliderHandle3D,
  materializePhysicsContactEvent3D,
  sortPhysicsEventDeliveries3D,
  type PhysicsContactEventDelivery3D,
} from "./events.js";

let frames: ManualFrames;
const mounts: CRCController[] = [];

beforeEach(() => {
  document.body.innerHTML = "";
  frames = new ManualFrames();
  frames.install();
});

afterEach(() => {
  for (const mount of mounts.splice(0)) mount.dispose();
  vi.restoreAllMocks();
});

describe("ordered 3D physics events", () => {
  it("orders by tick, semantic ordinal, pair identity, then receiver identity", () => {
    // Production break caught: relying on broad-phase or callback insertion
    // order makes Complete delivery nondeterministic.
    const base = contactDelivery();
    const deliveries = [
      { ...base, tick: 2, kind: 2 as const },
      { ...base, tick: 1, kind: 7 as const },
      { ...base, tick: 1, kind: 1 as const, receiver: "second" as const },
      { ...base, tick: 1, kind: 1 as const, receiver: "first" as const },
    ];
    expect(sortPhysicsEventDeliveries3D(deliveries).map((event) => [
      event.tick,
      event.kind,
      "receiver" in event ? event.receiver : "body",
    ])).toEqual([
      [1, 1, "first"],
      [1, 1, "second"],
      [1, 7, "first"],
      [2, 2, "first"],
    ]);
  });

  it("materializes immutable four-point 3D contact records", () => {
    // Production break caught: truncating the Task 5 four-point manifold or
    // returning mutable point/vector records corrupts Complete observers.
    const fact = contactDelivery({
      points: [0, 1, 2, 3].map((value) => ({
        firstX: value,
        firstY: value + 1,
        firstZ: value + 2,
        secondX: value + 3,
        secondY: value + 4,
        secondZ: value + 5,
        separation: -value,
      })),
    });
    const event = materializePhysicsContactEvent3D(fact, {
      body: (index, generation) => ({ index, generation }) as never,
      collider: (index, generation) => ({ index, generation }) as never,
    });
    expect("points" in event && event.points).toHaveLength(4);
    expect(Object.isFrozen(event)).toBe(true);
    if ("points" in event) {
      expect(Object.isFrozen(event.points)).toBe(true);
      expect(Object.isFrozen(event.points[0])).toBe(true);
      expect(Object.isFrozen(event.points[0]!.pointOnFirst)).toBe(true);
    }
  });

  it("binds collider handles to controller, index, and generation", () => {
    // Production break caught: index-only identities revive stale handles
    // after a released slot is reused.
    const controller = {} as never;
    const first = createPhysicsColliderHandle3D(controller, 1, 2);
    const second = createPhysicsColliderHandle3D(controller, 1, 3);
    expect(first).not.toBe(second);
  });

  it("delivers immutable events in Complete, isolates failures, and defers callback commands", () => {
    const shape = sphereShape3D({ radius: 1 });
    const order: string[] = [];
    const failure = new Error("first callback failed");
    let firstBody!: CRCPhysicsBodyHandle3D;
    let secondBody!: CRCPhysicsBodyHandle3D;
    let world!: CRCPhysicsWorldHandle3D;
    const firstHandler = (event: CRCPhysicsCollisionEvent3D) => {
      order.push(`first:${String(world.revision.get())}`);
      expect(Object.isFrozen(event)).toBe(true);
      disableBody3D(firstBody);
      throw failure;
    };
    const secondHandler = () => {
      order.push(`second:${String(world.revision.get())}`);
    };
    const First = () => {
      firstBody = crcPhysicsBody3D();
      world = crcPhysicsWorld3D();
      return <Group3D physics={dynamicBody3D({
        handle: firstBody,
        collider: {
          shape,
          onCollisionStart: firstHandler,
        },
      })} />;
    };
    const Second = () => {
      secondBody = crcPhysicsBody3D();
      return <Group3D physics={dynamicBody3D({
        handle: secondBody,
        collider: {
          shape,
          offset: [1.5, 0, 0],
          onCollisionStart: secondHandler,
        },
      })} />;
    };
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} fixedStepMilliseconds={10}>
        <First />
        <Second />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    expect(() => frames.flush(10)).toThrow(failure);
    expect(order).toEqual(["first:2", "second:2"]);
    expect(snapshot(world).kernel.bodies[0]!.flags).not.toBe(0);

    frames.flush(20);
    expect(snapshot(world).kernel.bodies[0]!.flags).toBe(0);
  });

  it("delivers sensor overlap start without collision or hit callbacks", () => {
    // Production break caught: treating sensors as solid contacts can emit
    // collision/hit facts or omit their distinct overlap lifecycle.
    const shape = sphereShape3D({ radius: 1 });
    const events: string[] = [];
    const overlap = () => events.push("overlap");
    const collision = () => events.push("collision");
    const hit = () => events.push("hit");
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} fixedStepMilliseconds={10}>
        <Group3D physics={dynamicBody3D({
          mass: 1,
          collider: {
            shape,
            sensor: true,
            onOverlapStart: overlap,
            onCollisionStart: collision,
            onHit: hit,
          },
        })} />
        <Group3D physics={dynamicBody3D({
          mass: 1,
          collider: { shape, offset: [1.5, 0, 0] },
        })} />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(10);

    expect(events).toEqual(["overlap"]);
  });
});

function contactDelivery(
  overrides: Partial<PhysicsContactEventDelivery3D> = {},
): PhysicsContactEventDelivery3D {
  return {
    kind: 1,
    tick: 1,
    firstColliderIndex: 1,
    firstColliderGeneration: 1,
    secondColliderIndex: 2,
    secondColliderGeneration: 1,
    firstBodyIndex: 3,
    firstBodyGeneration: 1,
    secondBodyIndex: 4,
    secondBodyGeneration: 1,
    receiver: "first",
    receiverColliderId: 10,
    receiverBodyId: 20,
    handler() {},
    selfTag: "self",
    otherTag: "other",
    normalX: 0,
    normalY: 1,
    normalZ: 0,
    points: [],
    totalNormalImpulse: 0,
    ...overrides,
  };
}

function snapshot(world: CRCPhysicsWorldHandle3D) {
  return snapshotPhysicsWorld3DControllerForTest(
    requirePhysicsWorld3DController(world),
  );
}

function mountWebGL(children: CRCNode): CRCController {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = "display:block;width:100px;height:100px";
  document.body.appendChild(canvas);
  const mount = crc(
    canvas,
    <WebGLLayer style={{ width: 100, height: 100 }}>{children}</WebGLLayer>,
  );
  mounts.push(mount);
  return mount;
}

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  install(): void {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      const id = ++this.nextId;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      this.callbacks.delete(id);
    });
  }

  flush(time: number): void {
    const entry = this.callbacks.entries().next().value as
      | readonly [number, FrameRequestCallback]
      | undefined;
    if (!entry) throw new Error("No CRC host frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
