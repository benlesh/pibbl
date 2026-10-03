import { Circle, Group, crc, signal, type CRCController } from "@crc/core";
/** @jsxImportSource @crc/core */
import {
  PhysicsWorld2D,
  applyForce2D,
  applyImpulse2D,
  applyTorque2D,
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  disableBody2D,
  dynamicBody2D,
  enableBody2D,
  overlapShape2D,
  queryAabb2D,
  queryPoint2D,
  raycast2D,
  setAngularVelocity2D,
  setLinearVelocity2D,
  sleepBody2D,
  shapeCast2D,
  staticBody2D,
  teleportBody2D,
  wakeBody2D,
  type CRCPhysicsBodyHandle2D,
  type CRCPhysicsWorldHandle2D,
} from "../../../2d.js";
import { circleShape2D } from "../../../2d-geometry.js";
import { snapshotPhysicsBodyHandle2DForTest } from "./body-handle.js";
import {
  requirePhysicsWorld2DController,
  snapshotPhysicsWorld2DControllerForTest,
} from "./controller.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("2D physics body handles", () => {
  it("resolves signal-valued world configuration without unwrapping exact body handles", () => {
    const gravity = signal<readonly [number, number]>([0, 0]);
    const solver = signal({ velocityIterations: 5, positionIterations: 2 });
    let body!: CRCPhysicsBodyHandle2D;
    let world!: CRCPhysicsWorldHandle2D;
    const Capture = () => {
      world = crcPhysicsWorld2D();
      body = crcPhysicsBody2D();
      return (
        <Group
          physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
        />
      );
    };
    const root = (
      <PhysicsWorld2D gravity={gravity} solver={solver}>
        <Capture />
      </PhysicsWorld2D>
    );
    const mount = mountCRC(root);
    frames.flush(0);

    expect(snapshotPhysicsBodyHandle2DForTest(body).bound).toBe(true);
    const firstRevision = snapshotWorld(world).revision;

    gravity.set([0, 10]);
    frames.flush(1);
    expect(snapshotWorld(world).revision).toBeGreaterThan(firstRevision);
    expect(snapshotPhysicsBodyHandle2DForTest(body).bound).toBe(true);

    mount.dispose();
  });

  it("keeps one hook-slot shell stable and materializes readonly signals lazily", () => {
    const seen: CRCPhysicsBodyHandle2D[] = [];
    const Ball = () => {
      const body = crcPhysicsBody2D();
      seen.push(body);
      return (
        <Group
          physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
        />
      );
    };
    const root = (
      <PhysicsWorld2D gravity={[0, 0]}>
        <Ball />
      </PhysicsWorld2D>
    );
    const mount = mountCRC(root);

    frames.flush(0);
    expect(seen).toHaveLength(1);
    expect(Object.isFrozen(seen[0])).toBe(true);
    expect(snapshotPhysicsBodyHandle2DForTest(seen[0]!)).toMatchObject({
      bound: true,
      materializedFields: [],
    });

    expect(seen[0]!.position.get()).toEqual([0, 0]);
    expect(snapshotPhysicsBodyHandle2DForTest(seen[0]!)).toMatchObject({
      materializedFields: ["position"],
    });

    crc(canvasOf(mount), root);
    frames.flush(1);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]);
  });

  it("materializes the world revision signal only when accessed", () => {
    let world!: CRCPhysicsWorldHandle2D;
    const Capture = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    mountCRC(
      <PhysicsWorld2D>
        <Capture />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    expect(snapshotWorld(world)).toMatchObject({
      revision: 0,
      revisionMaterialized: false,
    });
    expect(world.revision.get()).toBe(0);
    expect(snapshotWorld(world).revisionMaterialized).toBe(true);
  });

  it("copies command data immediately and applies named Begin commands in invocation order", () => {
    let body!: CRCPhysicsBodyHandle2D;
    let world!: CRCPhysicsWorldHandle2D;
    const Capture = () => {
      body = crcPhysicsBody2D();
      return (
        <Group
          physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
        />
      );
    };
    const CaptureWorld = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    const root = (
      <PhysicsWorld2D gravity={[0, 0]} fixedStepMilliseconds={100}>
        <CaptureWorld />
        <Capture />
      </PhysicsWorld2D>
    );
    mountCRC(root);
    frames.flush(0);
    frames.flush(0);
    body.position.get();
    body.rotationDegrees.get();
    body.linearVelocity.get();
    body.angularVelocityDegreesPerSecond.get();
    body.sleeping.get();
    body.enabled.get();
    body.generation.get();

    const velocity: [number, number] = [2, 3];
    const pose = { position: [4, 5] as [number, number], rotationDegrees: 30 };
    setLinearVelocity2D(body, [1, 1]);
    setLinearVelocity2D(body, velocity);
    setAngularVelocity2D(body, 45);
    teleportBody2D(body, pose);
    velocity[0] = 200;
    pose.position[0] = 400;
    pose.rotationDegrees = 300;
    frames.flush(0);

    expect(snapshotWorld(world).kernel.bodies[0]).toMatchObject({
      positionX: 4,
      positionY: 5,
      rotationRadians: Math.PI / 6,
      linearVelocityX: 2,
      linearVelocityY: 3,
      angularVelocity: Math.PI / 4,
    });
    expect({
      position: body.position.get(),
      linearVelocity: body.linearVelocity.get(),
      angularVelocityDegreesPerSecond:
        body.angularVelocityDegreesPerSecond.get(),
      sleeping: body.sleeping.get(),
      enabled: body.enabled.get(),
      generation: body.generation.get(),
    }).toEqual({
      position: [4, 5],
      linearVelocity: [2, 3],
      angularVelocityDegreesPerSecond: 45,
      sleeping: false,
      enabled: true,
      generation: 1,
    });
    expect(body.rotationDegrees.get()).toBeCloseTo(30);

    const force: [number, number] = [10, 0];
    const forcePoint: [number, number] = [4, 6];
    applyForce2D(body, force, { at: forcePoint });
    applyTorque2D(body, 5);
    applyImpulse2D(body, [2, 0]);
    force[0] = 1_000;
    forcePoint[1] = 100;
    frames.flush(100);

    expect(snapshotWorld(world).kernel.bodies[0]!.linearVelocityX).toBeCloseTo(
      5,
      5,
    );
    expect(snapshotWorld(world).kernel.bodies[0]!.linearVelocityY).toBeCloseTo(
      3,
      5,
    );
  });

  it("makes removed generations inert and increments the same handle on re-add", () => {
    const staleTrace = vi.spyOn(console, "warn").mockImplementation(() => {});
    let include = true;
    let body!: CRCPhysicsBodyHandle2D;
    let world!: CRCPhysicsWorldHandle2D;
    const Ball = () => {
      body = crcPhysicsBody2D();
      body.generation.get();
      return include ? (
        <Group
          physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
        />
      ) : undefined;
    };
    const Root = () => (
      <PhysicsWorld2D gravity={[0, 0]}>
        <WorldCapture capture={(value) => (world = value)} />
        <Ball />
      </PhysicsWorld2D>
    );
    const mount = mountCRC(<Root />);
    frames.flush(0);
    frames.flush(1);
    const firstGeneration = body.generation.get();

    include = false;
    crc(canvasOf(mount), <Root />);
    frames.flush(2);
    expect(snapshotPhysicsBodyHandle2DForTest(body).bound).toBe(false);
    setLinearVelocity2D(body, [99, 99]);
    frames.flush(3);
    expect(snapshotWorld(world).kernel.bodyCount).toBe(0);
    expect(staleTrace).toHaveBeenCalledWith(
      expect.stringMatching(/Ignored stale set-linear-velocity command/),
    );

    include = true;
    crc(canvasOf(mount), <Root />);
    frames.flush(4);
    frames.flush(5);
    expect(snapshotPhysicsBodyHandle2DForTest(body)).toMatchObject({
      bound: true,
      bindingGeneration: 2,
    });
    expect(body.generation.get()).toBeGreaterThan(firstGeneration);
  });

  it("rejects binding one handle to two bodies", () => {
    const Duplicate = () => {
      const body = crcPhysicsBody2D();
      return (
        <>
          <Group
            physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
          />
          <Group
            physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
          />
        </>
      );
    };
    mountCRC(
      <PhysicsWorld2D>
        <Duplicate />
      </PhysicsWorld2D>,
    );
    expect(() => frames.flush(0)).toThrow(/at most one live body/i);
  });

  it("supports explicit sleep, wake, disable, and enabled-state restoration", () => {
    let body!: CRCPhysicsBodyHandle2D;
    let world!: CRCPhysicsWorldHandle2D;
    const Ball = () => {
      body = crcPhysicsBody2D();
      body.sleeping.get();
      body.enabled.get();
      return (
        <Group
          physics={dynamicBody2D({
            handle: body,
            collider: false,
            mass: 1,
            linearVelocity: [3, 4],
          })}
        />
      );
    };
    mountCRC(
      <PhysicsWorld2D gravity={[0, 0]}>
        <WorldCapture capture={(value) => (world = value)} />
        <Ball />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(1);

    sleepBody2D(body);
    frames.flush(2);
    expect(body.sleeping.get()).toBe(true);
    wakeBody2D(body);
    frames.flush(3);
    expect(body.sleeping.get()).toBe(false);
    setLinearVelocity2D(body, [3, 4]);
    frames.flush(4);

    disableBody2D(body);
    frames.flush(5);
    expect(body.enabled.get()).toBe(false);
    expect(snapshotWorld(world).kernel.bodyCount).toBe(1);
    enableBody2D(body, { velocity: "preserve" });
    frames.flush(6);
    expect(body.enabled.get()).toBe(true);
    expect(snapshotWorld(world).kernel.bodies[0]).toMatchObject({
      linearVelocityX: 3,
      linearVelocityY: 4,
    });
  });

  it("exposes committed public queries without requesting a frame", () => {
    const shape = circleShape2D({ radius: 2 });
    const tag = { name: "query target" };
    let world!: CRCPhysicsWorldHandle2D;
    const mount = mountCRC(
      <PhysicsWorld2D>
        <WorldCapture capture={(value) => (world = value)} />
        <Circle
          physics={staticBody2D({ collider: { shape, tag } })}
          style={{ radius: 2 }}
        />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(1);
    frames.flush(2);
    expect(frames.pending).toBe(0);

    const hit = raycast2D(world, {
      origin: [-5, 0],
      direction: [1, 0],
      maxDistance: 10,
    });
    expect(hit).toMatchObject({
      point: [-2, 0],
      distance: 3,
      tag,
    });
    expect(Object.isFrozen(hit)).toBe(true);
    expect(hit!.body.enabled.get()).toBe(true);
    expect(hit!.body.generation.get()).toBe(hit!.bodyGeneration);
    expect(frames.pending).toBe(0);
    expect(
      shapeCast2D(
        world,
        shape,
        { position: [-5, 0], rotationDegrees: 0 },
        [10, 0],
      ),
    ).toMatchObject({ tag });
    expect(
      overlapShape2D(
        world,
        shape,
        { position: [0, 0], rotationDegrees: 0 },
        { mode: "all" },
      ),
    ).toHaveLength(1);
    expect(
      queryAabb2D(world, { min: [-1, -1], max: [1, 1] }, { mode: "any" }),
    ).toBe(true);
    expect(queryPoint2D(world, [0, 0], { mode: "any" })).toBe(true);
    expect(
      queryPoint2D(world, [0, 0], {
        mode: "all",
        excludeBody: hit!.body,
      }),
    ).toEqual([]);
    expect(frames.pending).toBe(0);

    disableBody2D(hit!.body);
    expect(frames.pending).toBe(1);
    frames.flush(3);
    expect(hit!.body.enabled.get()).toBe(false);
    expect(queryPoint2D(world, [0, 0], { mode: "any" })).toBe(false);

    mount.dispose();
    expect(snapshotPhysicsBodyHandle2DForTest(hit!.body).bound).toBe(false);
    expect(() => queryPoint2D(world, [0, 0])).toThrow(/live.*world handle/i);
  });

  it("evicts retired query handles while preserving live query identity", () => {
    const shape = circleShape2D({ radius: 2 });
    let count = 1_000;
    let world!: CRCPhysicsWorldHandle2D;
    const Root = () => (
      <PhysicsWorld2D gravity={[0, 0]}>
        <WorldCapture capture={(value) => (world = value)} />
        {Array.from({ length: count }, (_, index) => (
          <Circle
            key={index}
            physics={staticBody2D({ collider: { shape } })}
            style={{ radius: 2 }}
          />
        ))}
      </PhysicsWorld2D>
    );
    const mount = mountCRC(<Root />);
    frames.flush(0);
    frames.flush(1);
    const first = queryPoint2D(world, [0, 0], { mode: "all" });
    expect(first).toHaveLength(1_000);
    expect(snapshotWorld(world)).toMatchObject({
      materializedBodyHandles: 1_000,
      materializedColliderHandles: 1_000,
    });

    count = 0;
    crc(canvasOf(mount), <Root />);
    frames.flush(2);
    frames.flush(3);
    expect(queryPoint2D(world, [0, 0], { mode: "all" })).toEqual([]);
    expect(snapshotWorld(world)).toMatchObject({
      materializedBodyHandles: 0,
      materializedColliderHandles: 0,
    });

    count = 1_000;
    crc(canvasOf(mount), <Root />);
    frames.flush(4);
    frames.flush(5);
    const replacement = queryPoint2D(world, [0, 0], { mode: "all" });
    expect(replacement).toHaveLength(1_000);
    expect(replacement[0]!.body).not.toBe(first[0]!.body);
    expect(replacement[0]!.collider).not.toBe(first[0]!.collider);
    disableBody2D(first[0]!.body);
    frames.flush(6);
    expect(replacement[0]!.body.enabled.get()).toBe(true);
    expect(snapshotWorld(world)).toMatchObject({
      materializedBodyHandles: 1_000,
      materializedColliderHandles: 1_000,
    });

    mount.dispose();
    expect(snapshotWorld(world)).toMatchObject({
      materializedBodyHandles: 0,
      materializedColliderHandles: 0,
    });
  });
});

function WorldCapture({
  capture,
}: {
  capture: (world: CRCPhysicsWorldHandle2D) => void;
}) {
  capture(crcPhysicsWorld2D());
  return undefined;
}

function snapshotWorld(world: CRCPhysicsWorldHandle2D) {
  return snapshotPhysicsWorld2DControllerForTest(
    requirePhysicsWorld2DController(world),
  );
}

function mountCRC(root: Parameters<typeof crc>[1]): CRCController {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = "display:block;width:100px;height:100px";
  document.body.appendChild(canvas);
  const mount = crc(canvas, root);
  Object.assign(mount, { __canvas: canvas });
  mounts.push(mount);
  return mount;
}

function canvasOf(mount: CRCController): HTMLCanvasElement {
  return (mount as CRCController & { __canvas: HTMLCanvasElement }).__canvas;
}

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  get pending(): number {
    return this.callbacks.size;
  }

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
