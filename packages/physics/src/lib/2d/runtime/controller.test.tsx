import {
  Circle,
  Fragment,
  Group,
  crc,
  signal,
  type CRCController,
  type WritableSignal,
} from "@crc/core";
import {
  crcInternalCurrentSimulationOwner,
  crcInternalRegisterSimulationAdvance,
  useInternalHookSlot,
} from "@crc/core/internal";
import {
  PhysicsWorld2D,
  collider2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  kinematicBody2D,
  staticBody2D,
  type CRCPhysicsBodyHandle2D,
  type CRCPhysicsWorldHandle2D,
} from "../../../2d.js";
import { circleShape2D, segmentShape2D } from "../../../2d-geometry.js";
import {
  requirePhysicsWorld2DController,
  snapshotPhysicsWorld2DControllerForTest,
} from "./controller.js";
import { installPhysicsWorld2DFailureInjectorForTest } from "../world/world.js";
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

describe("PhysicsWorld2D controller scheduling and topology", () => {
  it("rejects zero-area automatic mass before admitting topology while preserving explicit and non-dynamic mass authority", () => {
    const circle = circleShape2D({ radius: 2 });
    const segment = segmentShape2D({ start: [0, 0], end: [4, 0] });
    let rejectedWorld!: CRCPhysicsWorldHandle2D;
    const CaptureRejected = () => {
      rejectedWorld = crcPhysicsWorld2D();
      return undefined;
    };
    mountCRC(
      <PhysicsWorld2D>
        <CaptureRejected />
        <Group physics={dynamicBody2D({ collider: false })}>
          <Circle
            physics={collider2D({ shape: segment })}
            style={{ radius: 1 }}
          />
          <Circle
            physics={collider2D({ shape: circle, sensor: true })}
            style={{ radius: 2 }}
          />
          <Circle
            physics={collider2D({
              shape: circle,
              contributesToMass: false,
            })}
            style={{ radius: 2 }}
          />
        </Group>
      </PhysicsWorld2D>,
    );

    expect(() => frames.flush(0)).toThrow(
      /dynamic body with automatic mass requires positive derived area/i,
    );
    expect(snapshot(rejectedWorld).kernel).toMatchObject({
      bodyCount: 0,
      colliderCount: 0,
      counters: { bodyAllocations: 0, colliderAllocations: 0 },
    });

    let acceptedWorld!: CRCPhysicsWorldHandle2D;
    const CaptureAccepted = () => {
      acceptedWorld = crcPhysicsWorld2D();
      return undefined;
    };
    mountCRC(
      <PhysicsWorld2D>
        <CaptureAccepted />
        <Group physics={dynamicBody2D({ collider: false, mass: 2 })}>
          <Circle
            physics={collider2D({ shape: segment })}
            style={{ radius: 1 }}
          />
        </Group>
        <Group physics={staticBody2D({ collider: false })}>
          <Circle
            physics={collider2D({ shape: segment })}
            style={{ radius: 1 }}
          />
        </Group>
        <Group physics={kinematicBody2D({ collider: false })}>
          <Circle
            physics={collider2D({ shape: segment })}
            style={{ radius: 1 }}
          />
        </Group>
      </PhysicsWorld2D>,
    );
    frames.flush(1);
    frames.flush(2);
    expect(snapshot(acceptedWorld).kernel).toMatchObject({
      bodyCount: 3,
      colliderCount: 3,
    });
  });

  it("preserves or zeros velocity explicitly when a dynamic body is re-enabled", () => {
    const shape = circleShape2D({ radius: 2 });
    let world!: CRCPhysicsWorldHandle2D;
    let enabled = true;
    let reenableVelocity: "zero" | "preserve" = "preserve";
    const Capture = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    const root = () => (
      <PhysicsWorld2D gravity={[0, 0]}>
        <Capture />
        <Circle
          physics={dynamicBody2D({
            collider: shape,
            enabled,
            linearVelocity: [3, 4],
            reenableVelocity,
          })}
          style={{ radius: 2 }}
        />
      </PhysicsWorld2D>
    );
    const mount = mountCRC(root());
    frames.flush(0);
    frames.flush(0);
    const controller = requirePhysicsWorld2DController(world);
    const bodyId = snapshot(world).bodyIds[0]!;
    controller.queueCommands([
      {
        kind: "set-velocity",
        bodyId,
        linearVelocityX: 7,
        linearVelocityY: 8,
        angularVelocityDegrees: 30,
      },
    ]);
    frames.flush(0);

    enabled = false;
    crc(canvasOf(mount), root());
    frames.flush(0);
    frames.flush(0);
    enabled = true;
    crc(canvasOf(mount), root());
    frames.flush(0);
    frames.flush(0);
    expect(snapshot(world).kernel.bodies[0]).toMatchObject({
      linearVelocityX: 7,
      linearVelocityY: 8,
      angularVelocity: Math.PI / 6,
    });

    enabled = false;
    crc(canvasOf(mount), root());
    frames.flush(0);
    frames.flush(0);
    enabled = true;
    reenableVelocity = "zero";
    crc(canvasOf(mount), root());
    frames.flush(0);
    frames.flush(0);
    expect(snapshot(world).kernel.bodies[0]).toMatchObject({
      linearVelocityX: 0,
      linearVelocityY: 0,
      angularVelocity: 0,
    });
  });

  it("renders authored content first, applies complete topology at next Begin, and retains IDs for equivalent descriptors", () => {
    const shape = circleShape2D({ radius: 3 });
    let world!: CRCPhysicsWorldHandle2D;
    const observed: number[] = [];
    const Capture = () => {
      world = crcPhysicsWorld2D();
      observed.push(world.revision.get());
      return undefined;
    };
    const root = () => (
      <PhysicsWorld2D>
        <Capture />
        <Group physics={staticBody2D({ collider: false })}>
          <Circle physics={collider2D({ shape })} style={{ radius: 3 }} />
        </Group>
      </PhysicsWorld2D>
    );

    const mount = mountCRC(root());
    frames.flush(0);
    expect(snapshot(world)).toMatchObject({
      revision: 0,
      advanceRegistered: true,
      kernel: { bodyCount: 0, colliderCount: 0 },
    });

    frames.flush(1);
    const first = snapshot(world);
    expect(first).toMatchObject({
      revision: 1,
      advanceRegistered: false,
      kernel: { bodyCount: 1, colliderCount: 1 },
    });
    expect(observed).toEqual([0, 1]);
    frames.flush(2);
    expect(observed).toEqual([0, 1, 1]);
    expect(frames.pending).toBe(0);

    crc(canvasOf(mount), root());
    frames.flush(3);
    expect(frames.pending).toBe(0);
    const equivalent = snapshot(world);
    expect(equivalent.bodyIds).toEqual(first.bodyIds);
    expect(equivalent.colliderIds).toEqual(first.colliderIds);
    expect(equivalent.kernel.counters).toMatchObject({
      bodyAllocations: 1,
      colliderAllocations: 1,
      bodyReleases: 0,
      colliderReleases: 0,
    });
  });

  it("updates changed options once and releases removed descendants before their body", () => {
    const shape = circleShape2D({ radius: 2 });
    let world!: CRCPhysicsWorldHandle2D;
    let friction = 0.25;
    let include = true;
    const Capture = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    const root = () => (
      <PhysicsWorld2D>
        <Capture />
        {include ? (
          <Group physics={staticBody2D({ collider: false })}>
            <Circle
              physics={collider2D({ shape, friction })}
              style={{ radius: 2 }}
            />
          </Group>
        ) : undefined}
      </PhysicsWorld2D>
    );
    const mount = mountCRC(root());
    frames.flush(0);
    frames.flush(1);

    friction = 0.75;
    crc(canvasOf(mount), root());
    frames.flush(2);
    frames.flush(3);
    expect(snapshot(world).kernel.counters).toMatchObject({
      bodyAllocations: 1,
      colliderAllocations: 2,
      colliderReleases: 1,
      bodyReleases: 0,
    });

    include = false;
    crc(canvasOf(mount), root());
    frames.flush(4);
    frames.flush(5);
    expect(snapshot(world).kernel).toMatchObject({
      bodyCount: 0,
      colliderCount: 0,
      counters: {
        colliderReleases: 2,
        bodyReleases: 1,
      },
    });
  });

  it("reads staged kinematic targets after animation-lane writes and publishes revision only at Commit", () => {
    const target = signal<readonly [number, number]>([0, 0]);
    let world!: CRCPhysicsWorldHandle2D;
    const revisions: number[] = [];
    const Capture = () => {
      world = crcPhysicsWorld2D();
      revisions.push(world.revision.get());
      return undefined;
    };
    const Animate = () => {
      const owner = crcInternalCurrentSimulationOwner();
      useInternalHookSlot("task11AnimationProbe", (teardowns) => {
        const release = crcInternalRegisterSimulationAdvance(
          owner,
          "animation",
          (_frame, batch) => {
            batch.stage(
              target as WritableSignal<readonly [number, number]>,
              [12, 34],
              owner,
            );
            release();
          },
        );
        teardowns.add(release);
        return undefined;
      });
      return undefined;
    };
    const root = (
      <PhysicsWorld2D fixedStepMilliseconds={100}>
        <Animate />
        <Capture />
        <Group
          physics={kinematicBody2D({
            collider: false,
            target: { position: target },
          })}
        />
      </PhysicsWorld2D>
    );
    const mount = mountCRC(root);
    frames.flush(0);
    frames.flush(100);

    expect(target.get()).toEqual([12, 34]);
    expect(world.revision.get()).toBe(1);
    expect(revisions).toEqual([0, 1]);
  });

  it("releases its sole Advance registration after sleep and a queued command wakes it", () => {
    let world!: CRCPhysicsWorldHandle2D;
    const Capture = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    mountCRC(
      <PhysicsWorld2D fixedStepMilliseconds={100}>
        <Capture />
        <Group physics={dynamicBody2D({ collider: false, mass: 1 })} />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    for (const time of [0, 100, 200, 300, 400, 500]) {
      frames.flush(time);
    }
    expect(snapshot(world).advanceRegistered).toBe(false);
    frames.flush(501);
    expect(frames.pending).toBe(0);

    const controller = requirePhysicsWorld2DController(world);
    const bodyId = snapshot(world).bodyIds[0]!;
    controller.queueCommands([{ kind: "wake", bodyId }]);
    frames.flush(600);
    expect(snapshot(world).advanceRegistered).toBe(true);
    expect(world.revision.get()).toBeGreaterThan(1);
  });

  it("delivers immutable sleep events in the adopting frame Complete phase", () => {
    const body = {
      position: signal<readonly [number, number]>([0, 0]),
      rotationDegrees: signal(0),
      linearVelocity: signal<readonly [number, number]>([0, 0]),
      angularVelocityDegreesPerSecond: signal(0),
      sleeping: signal(false),
      enabled: signal(true),
      generation: signal(0),
    } as unknown as CRCPhysicsBodyHandle2D;
    let world!: CRCPhysicsWorldHandle2D;
    const events: unknown[] = [];
    const Capture = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    mountCRC(
      <PhysicsWorld2D
        fixedStepMilliseconds={100}
        onSleep={(event) => {
          expect(world.revision.get()).toBeGreaterThan(0);
          expect(body.sleeping.get()).toBe(true);
          events.push(event);
        }}
      >
        <Capture />
        <Group
          physics={dynamicBody2D({ handle: body, collider: false, mass: 1 })}
        />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    for (const time of [0, 100, 200, 300, 400, 500]) frames.flush(time);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ body, sleeping: true, tick: 5 });
    expect(Object.isFrozen(events[0])).toBe(true);
  });

  it("isolates a failed world candidate from a sibling world in the same host frame", () => {
    const error = new Error("first world failed");
    const onError = vi.fn();
    const handles: CRCPhysicsWorldHandle2D[] = [];
    const Capture = () => {
      const world = crcPhysicsWorld2D();
      if (!handles.includes(world)) handles.push(world);
      return undefined;
    };
    mountCRC(
      <Fragment>
        <PhysicsWorld2D onError={onError}>
          <Capture />
          <Group physics={dynamicBody2D({ collider: false, mass: 1 })} />
        </PhysicsWorld2D>
        <PhysicsWorld2D>
          <Capture />
          <Group physics={dynamicBody2D({ collider: false, mass: 1 })} />
        </PhysicsWorld2D>
      </Fragment>,
    );
    frames.flush(0);
    let first = true;
    const restoreFailure = installPhysicsWorld2DFailureInjectorForTest(() => {
      if (!first) return;
      first = false;
      restoreFailure();
      throw error;
    });

    try {
      expect(() => frames.flush(1)).toThrow(error);
    } finally {
      restoreFailure();
    }
    expect(handles[0]!.revision.get()).toBe(0);
    expect(handles[1]!.revision.get()).toBe(1);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });
});

function snapshot(world: CRCPhysicsWorldHandle2D) {
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
