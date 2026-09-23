import { Fragment, Group, crc, type CRCController } from "@crc/core";
/** @jsxImportSource @crc/core */
import {
  PhysicsShape2D,
  PhysicsWorld2D,
  collider2D,
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  sleepBody2D,
  staticBody2D,
  teleportBody2D,
  wakeBody2D,
  type CRCPhysicsBodyHandle2D,
  type CRCPhysicsColliderConfiguration2D,
  type CRCPhysicsCollisionEvent2D,
  type CRCPhysicsOverlapEvent2D,
} from "../../../2d.js";
import { circleShape2D } from "../../../2d-geometry.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetPhysicsEventMaterializationsForTest,
  snapshotPhysicsEventMaterializationsForTest,
} from "./events.js";

const shape = circleShape2D({ radius: 1 });
let frames: ManualFrames;
const mounts: CRCController[] = [];

beforeEach(() => {
  document.body.innerHTML = "";
  frames = new ManualFrames();
  frames.install();
  resetPhysicsEventMaterializationsForTest();
});

afterEach(() => {
  for (const mount of mounts.splice(0)) mount.dispose();
  vi.restoreAllMocks();
});

describe("ordered 2D physics events", () => {
  it("delivers solid start and hit records to both sides in receiver order", () => {
    const firstTag = { name: "first" };
    const secondTag = { name: "second" };
    const delivered: Array<
      Readonly<{
        kind: "start" | "hit";
        receiver: "first" | "second";
        event: CRCPhysicsCollisionEvent2D;
      }>
    > = [];
    const firstHandlers = collisionHandlers("first", delivered);
    const secondHandlers = collisionHandlers("second", delivered);

    mountCRC(
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <Body type="static" x={0} tag={firstTag} handlers={firstHandlers} />
        <Body
          type="dynamic"
          x={1.5}
          velocity={[-1, 0]}
          tag={secondTag}
          handlers={secondHandlers}
        />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(100);

    expect(
      delivered.map(({ receiver, kind }) => `${receiver}-${kind}`),
    ).toEqual(["first-start", "second-start", "first-hit", "second-hit"]);
    const first = delivered[0]!.event;
    const second = delivered[1]!.event;
    expect(first).toMatchObject({
      selfTag: firstTag,
      otherTag: secondTag,
      tick: 1,
      normal: [-1, 0],
    });
    expect(second).toMatchObject({
      selfTag: secondTag,
      otherTag: firstTag,
      tick: 1,
      normal: [1, 0],
    });
    expect(first.selfBody).toBe(second.otherBody);
    expect(first.otherBody).toBe(second.selfBody);
    expect(first.selfCollider).toBe(second.otherCollider);
    expect(first.otherCollider).toBe(second.selfCollider);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.normal)).toBe(true);
    expect(Object.isFrozen(first.points)).toBe(true);
    expect(first.points.every(Object.isFrozen)).toBe(true);
    expect(delivered[2]!.event.totalNormalImpulse).toBeGreaterThan(0);
  });

  it("emits only overlap start/end for a sensor crossing during catch-up", () => {
    const order: string[] = [];
    const overlap = (receiver: string) => ({
      onOverlapStart: (event: CRCPhysicsOverlapEvent2D) =>
        order.push(`${String(event.tick)}-${receiver}-start`),
      onOverlapEnd: (event: CRCPhysicsOverlapEvent2D) =>
        order.push(`${String(event.tick)}-${receiver}-end`),
      onCollisionStart: () => order.push(`${receiver}-collision`),
      onHit: () => order.push(`${receiver}-hit`),
    });

    mountCRC(
      <PhysicsWorld2D
        gravity={[0, 0]}
        fixedStepMilliseconds={100}
        maxCatchUpSteps={3}
      >
        <Body
          type="static"
          x={0}
          sensor
          tag="sensor"
          handlers={overlap("first")}
        />
        <Body
          type="dynamic"
          x={-4}
          velocity={[30, 0]}
          tag="mover"
          handlers={overlap("second")}
        />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(300);

    expect(order).toEqual([
      "1-first-start",
      "1-second-start",
      "3-first-end",
      "3-second-end",
    ]);
  });

  it("isolates callback failures and defers callback commands to the next Begin", () => {
    const failure = new Error("first collision callback failed");
    const calls: string[] = [];
    let moving!: CRCPhysicsBodyHandle2D;
    const firstHandlers = {
      onCollisionStart: () => {
        calls.push("first");
        throw failure;
      },
    };
    const secondHandlers = {
      onCollisionStart: () => {
        calls.push("second");
        teleportBody2D(moving, {
          position: [10, 0],
          rotationDegrees: 0,
        });
      },
    };

    mountCRC(
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <Body type="static" x={0} handlers={firstHandlers} />
        <Body
          capture={(body) => {
            moving = body;
            body.position.get();
          }}
          type="dynamic"
          x={1.5}
          velocity={[-1, 0]}
          handlers={secondHandlers}
        />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    expect(() => frames.flush(100)).toThrow(failure);
    expect(calls).toEqual(["first", "second"]);
    expect(moving.position.get()[0]).not.toBe(10);

    frames.flush(101);
    expect(moving.position.get()).toEqual([10, 0]);
  });

  it("suppresses a candidate delivery when its subscribed colliders are removed before Complete", () => {
    const onCollisionStart = vi.fn();
    const Scene = () => {
      const revision = crcPhysicsWorld2D().revision.get();
      if (revision >= 2) return undefined;
      return (
        <Fragment>
          <Body type="static" x={0} handlers={{ onCollisionStart }} />
          <Body
            type="dynamic"
            x={1.5}
            velocity={[-1, 0]}
            handlers={{ onCollisionStart }}
          />
        </Fragment>
      );
    };
    mountCRC(
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <Scene />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(100);

    expect(onCollisionStart).not.toHaveBeenCalled();
  });

  it("suppresses candidate deliveries when the world owner is removed before Complete", () => {
    const onCollisionStart = vi.fn();
    let world: ReturnType<typeof crcPhysicsWorld2D> | undefined;
    let removed = false;
    const CaptureWorld = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    const Root = () => {
      if ((world?.revision.get() ?? 0) >= 2) {
        removed = true;
        return undefined;
      }
      return (
        <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
          <CaptureWorld />
          <Body type="static" x={0} handlers={{ onCollisionStart }} />
          <Body
            type="dynamic"
            x={1.5}
            velocity={[-1, 0]}
            handlers={{ onCollisionStart }}
          />
        </PhysicsWorld2D>
      );
    };
    mountCRC(<Root />);
    frames.flush(0);
    frames.flush(0);

    expect(() => frames.flush(100)).not.toThrow();
    expect(removed).toBe(true);
    expect(onCollisionStart).not.toHaveBeenCalled();
  });

  it("suppresses a candidate delivery when its handler is removed before Complete", () => {
    const onCollisionStart = vi.fn();
    const Scene = () => {
      const revision = crcPhysicsWorld2D().revision.get();
      const handlers = revision >= 2 ? {} : { onCollisionStart };
      return (
        <Fragment>
          <Body type="static" x={0} handlers={handlers} />
          <Body type="dynamic" x={1.5} velocity={[-1, 0]} handlers={handlers} />
        </Fragment>
      );
    };
    mountCRC(
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <Scene />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(100);

    expect(onCollisionStart).not.toHaveBeenCalled();
  });

  it("delivers solid collision end after a commanded separation", () => {
    const order: string[] = [];
    let moving!: CRCPhysicsBodyHandle2D;
    mountCRC(
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <Body
          type="static"
          x={0}
          handlers={{
            onCollisionStart: () => order.push("first-start"),
            onCollisionEnd: () => order.push("first-end"),
          }}
        />
        <Body
          capture={(body) => {
            moving = body;
          }}
          type="dynamic"
          x={1.5}
          velocity={[-1, 0]}
          handlers={{
            onCollisionStart: () => {
              order.push("second-start");
              teleportBody2D(moving, {
                position: [10, 0],
                rotationDegrees: 0,
              });
            },
            onCollisionEnd: () => order.push("second-end"),
          }}
        />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(100);
    frames.flush(200);

    expect(order).toEqual([
      "first-start",
      "second-start",
      "first-end",
      "second-end",
    ]);
  });

  it("delivers immutable sleep/wake events and defers a callback wake command", () => {
    const order: string[] = [];
    let body!: CRCPhysicsBodyHandle2D;
    mountCRC(
      <PhysicsWorld2D
        gravity={[0, 0]}
        onSleep={(event) => {
          order.push(`${String(event.tick)}-sleep`);
          expect(Object.isFrozen(event)).toBe(true);
          wakeBody2D(event.body);
        }}
        onWake={(event) => order.push(`${String(event.tick)}-wake`)}
      >
        <Body
          capture={(value) => {
            body = value;
            value.sleeping.get();
          }}
          type="dynamic"
          x={0}
        />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    sleepBody2D(body);
    frames.flush(1);
    expect(order).toEqual(["1-sleep"]);
    expect(body.sleeping.get()).toBe(true);

    frames.flush(2);
    expect(order).toEqual(["1-sleep", "1-wake"]);
    expect(body.sleeping.get()).toBe(false);
  });

  it("does not materialize public records for unobserved contacts", () => {
    mountCRC(
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <Body type="static" x={0} />
        <Body type="dynamic" x={1.5} velocity={[-1, 0]} />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(100);

    expect(snapshotPhysicsEventMaterializationsForTest()).toBe(0);
  });
});

function collisionHandlers(
  receiver: "first" | "second",
  delivered: Array<{
    kind: "start" | "hit";
    receiver: "first" | "second";
    event: CRCPhysicsCollisionEvent2D;
  }>,
): CRCPhysicsColliderConfiguration2D {
  return {
    onCollisionStart: (event) =>
      delivered.push({ kind: "start", receiver, event }),
    onHit: (event) => delivered.push({ kind: "hit", receiver, event }),
  };
}

function Body({
  type,
  x,
  velocity = [0, 0],
  sensor = false,
  tag,
  handlers = {},
  capture,
}: Readonly<{
  type: "static" | "dynamic";
  x: number;
  velocity?: readonly [number, number];
  sensor?: boolean;
  tag?: unknown;
  handlers?: CRCPhysicsColliderConfiguration2D;
  capture?: (body: CRCPhysicsBodyHandle2D) => void;
}>) {
  const body = crcPhysicsBody2D();
  capture?.(body);
  const physics =
    type === "static"
      ? staticBody2D({ handle: body, collider: false })
      : dynamicBody2D({
          handle: body,
          collider: false,
          mass: 1,
          linearVelocity: velocity,
        });
  return (
    <Group physics={physics} style={{ translateX: x }}>
      <PhysicsShape2D
        physics={collider2D({
          ...handlers,
          shape,
          sensor,
          tag,
        })}
        style={{ shape }}
      />
    </Group>
  );
}

function mountCRC(root: Parameters<typeof crc>[1]): CRCController {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = "display:block;width:100px;height:100px";
  document.body.appendChild(canvas);
  const mount = crc(canvas, root);
  mounts.push(mount);
  return mount;
}

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  install(): void {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        const id = ++this.nextId;
        this.callbacks.set(id, callback);
        return id;
      },
    );
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      this.callbacks.delete(id);
    });
  }

  flush(time: number): void {
    const entry = this.callbacks.entries().next().value as
      readonly [number, FrameRequestCallback] | undefined;
    if (!entry) throw new Error("No CRC host frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
