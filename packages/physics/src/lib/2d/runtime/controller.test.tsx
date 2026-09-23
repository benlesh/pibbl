import {
  Circle,
  Fragment,
  Group,
  crc,
  usePlayback,
  signal,
  track,
  tween,
  type CRCController,
  type CRCPlayback,
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
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
  kinematicBody2D,
  setAngularVelocity2D,
  sleepBody2D,
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

  it("derives a density-weighted center and parallel-axis inertia for compound bodies", () => {
    let world!: CRCPhysicsWorldHandle2D;
    const Capture = () => {
      world = crcPhysicsWorld2D();
      return undefined;
    };
    mountCRC(
      <PhysicsWorld2D>
        <Capture />
        <Group
          physics={dynamicBody2D({
            collider: false,
            mass: 8 * Math.PI,
          })}
        >
          <Circle
            physics={collider2D({ density: 1 })}
            style={{ cx: 0, cy: 0, radius: 1 }}
          />
          <Circle
            physics={collider2D({ density: 3 })}
            style={{ cx: 4, cy: 0, radius: 1 }}
          />
        </Group>
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(0);

    const body = snapshot(world).kernel.bodies[0]!;
    expect(body.positionX).toBeCloseTo(3, 12);
    expect(body.positionY).toBe(0);
    expect(body.inverseMass).toBeCloseTo(1 / (8 * Math.PI), 12);
    expect(body.inverseInertia).toBeCloseTo(1 / (28 * Math.PI), 12);
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

  it("reaches an animation target in the terminal frame when a target-bound kinematic Group renders from that signal after dynamics sleep", () => {
    const position = signal<readonly [number, number]>([220, 142]);
    let playback!: CRCPlayback;
    let body!: CRCPhysicsBodyHandle2D;
    let sleeper!: CRCPhysicsBodyHandle2D;
    const AnimationOwner = () => {
      playback = usePlayback(
        track(
          position,
          tween({
            to: [310, 142] as const,
            duration: 600,
            interpolate: (from, to, progress) =>
              [
                from[0] + (to[0] - from[0]) * progress,
                from[1] + (to[1] - from[1]) * progress,
              ] as const,
          }),
        ),
      );
      return undefined;
    };
    const SettledBody = () => {
      sleeper = crcPhysicsBody2D();
      return (
        <Circle
          physics={dynamicBody2D({ handle: sleeper, mass: 1 })}
          style={{ cx: 40, cy: 40, radius: 4 }}
        />
      );
    };
    const Platform = () => {
      body = crcPhysicsBody2D();
      const authoredPosition = position.get();
      return (
        <Group
          physics={kinematicBody2D({
            handle: body,
            collider: false,
            target: { position },
          })}
          style={{
            translateX: authoredPosition[0],
            translateY: authoredPosition[1],
          }}
        >
          <Circle physics={collider2D()} style={{ radius: 4 }} />
        </Group>
      );
    };
    const PresentationProbe = () => {
      body.position.get();
      sleeper.position.get();
      return undefined;
    };

    mountCRC(
      <PhysicsWorld2D fixedStepMilliseconds={50} maxCatchUpSteps={3}>
        <AnimationOwner />
        <SettledBody />
        <Platform />
        <PresentationProbe />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(50);
    sleepBody2D(sleeper);
    for (const time of [100, 150, 200, 250, 300]) frames.flush(time);
    expect(sleeper.sleeping.get()).toBe(true);

    playback.play();
    frames.flush(300);
    frames.flush(600);
    expect(body.position.get()).toEqual([265, 142]);
    frames.flush(900);

    expect(playback.currentTime.get()).toBe(600);
    expect(body.position.get()).toEqual([310, 142]);
  });

  it("keeps a rotating dynamic descendant Circle's local mass and collider allocation stable across presentation renders", () => {
    let world!: CRCPhysicsWorldHandle2D;
    let body!: CRCPhysicsBodyHandle2D;
    const Capture = () => {
      world = crcPhysicsWorld2D();
      world.revision.get();
      return undefined;
    };
    const Ball = () => {
      body = crcPhysicsBody2D();
      return (
        <Group
          physics={dynamicBody2D({
            handle: body,
            collider: false,
            mass: 1,
            allowSleep: false,
          })}
          style={{ translateX: 720, translateY: 360 }}
        >
          <Circle physics={collider2D()} style={{ radius: 12 }} />
        </Group>
      );
    };

    mountCRC(
      <PhysicsWorld2D fixedStepMilliseconds={50} sleeping={false}>
        <Capture />
        <Ball />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(50);
    const initial = snapshot(world).kernel;
    const initialBody = initial.bodies.find((candidate) => candidate.id === 0);
    if (!initialBody) throw new Error("missing rotating body");

    setAngularVelocity2D(body, 90);
    for (const time of [100, 150, 200, 250, 300]) frames.flush(time);

    const current = snapshot(world).kernel;
    const currentBody = current.bodies.find((candidate) => candidate.id === 0);
    if (!currentBody) throw new Error("missing rotating body");
    expect(currentBody.inverseInertia).toBeCloseTo(
      initialBody.inverseInertia,
      12,
    );
    expect(current.counters).toMatchObject({
      bodyAllocations: 1,
      bodyReleases: 0,
      colliderAllocations: 1,
      colliderReleases: 0,
    });
    expect(current.tick - initial.tick).toBe(5);
  });

  it("stabilizes a rotating dynamic nested collider's roundoff without hiding a meaningful authored transform", () => {
    let world!: CRCPhysicsWorldHandle2D;
    let body!: CRCPhysicsBodyHandle2D;
    const scaleX = signal(1);
    const translateX = signal(0);
    const Capture = () => {
      world = crcPhysicsWorld2D();
      world.revision.get();
      return undefined;
    };
    const Ball = () => {
      body = crcPhysicsBody2D();
      return (
        <Group
          physics={dynamicBody2D({
            handle: body,
            collider: false,
            mass: 1,
            allowSleep: false,
          })}
          style={{ translateX: 720, translateY: 360 }}
        >
          <Group
            style={{
              translateX: 0.0000001 + translateX.get(),
              rotationDegrees: 17,
              scaleX: scaleX.get(),
              scaleY: 0.8,
              filter: { type: "opacity", amount: 1 },
            }}
          >
            <Circle physics={collider2D()} style={{ cx: 4, cy: -3, radius: 12 }} />
          </Group>
        </Group>
      );
    };

    mountCRC(
      <PhysicsWorld2D fixedStepMilliseconds={50} sleeping={false}>
        <Capture />
        <Ball />
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(50);
    const initial = snapshot(world).kernel;
    const initialBody = initial.bodies.find((candidate) => candidate.id === 0);
    if (!initialBody) throw new Error("missing rotating nested body");

    setAngularVelocity2D(body, 90);
    for (const time of [100, 150, 200, 250, 300]) frames.flush(time);

    const stable = snapshot(world).kernel;
    const stableBody = stable.bodies.find((candidate) => candidate.id === 0);
    if (!stableBody) throw new Error("missing rotating nested body");
    expect(stableBody.inverseInertia).toBeCloseTo(initialBody.inverseInertia, 12);
    expect(stable.counters).toMatchObject({
      bodyAllocations: 1,
      bodyReleases: 0,
      colliderAllocations: 1,
      colliderReleases: 0,
    });
    expect(stable.tick - initial.tick).toBe(5);

    translateX.set(0.0000001);
    frames.flush(350);
    frames.flush(400);

    const tinyChange = snapshot(world).kernel;
    expect(tinyChange.counters).toMatchObject({
      bodyAllocations: 1,
      bodyReleases: 0,
      colliderAllocations: 2,
      colliderReleases: 1,
    });

    scaleX.set(1.0000001);
    frames.flush(450);
    frames.flush(500);

    const scaleChange = snapshot(world).kernel;
    expect(scaleChange.counters).toMatchObject({
      bodyAllocations: 1,
      bodyReleases: 0,
      colliderAllocations: 3,
      colliderReleases: 2,
    });
  });

  it("retains the target-bound kinematic origin without a sub-step reset when its unbound rotation changes", () => {
    const position = signal<readonly [number, number]>([30, 20]);
    let authoredRotation = 0;
    let body!: CRCPhysicsBodyHandle2D;
    const Platform = () => {
      body = crcPhysicsBody2D();
      const authoredPosition = position.get();
      return (
        <Group
          physics={kinematicBody2D({
            handle: body,
            collider: false,
            target: { position },
          })}
          style={{
            translateX: authoredPosition[0],
            translateY: authoredPosition[1],
            rotationDegrees: authoredRotation,
          }}
        >
          <Circle
            physics={collider2D()}
            style={{ cx: 12, cy: -5, radius: 4 }}
          />
        </Group>
      );
    };
    const root = () => (
      <PhysicsWorld2D fixedStepMilliseconds={50}>
        <Platform />
      </PhysicsWorld2D>
    );
    const mount = mountCRC(root());
    frames.flush(0);
    frames.flush(50);

    authoredRotation = 45;
    crc(canvasOf(mount), root());
    frames.flush(75);

    expect(body.position.get()[0]).toBeCloseTo(30, 12);
    expect(body.position.get()[1]).toBeCloseTo(20, 12);
    expect(body.rotationDegrees.get()).toBeCloseTo(0, 12);
    frames.flush(100);
    expect(body.position.get()[0]).toBeCloseTo(30, 12);
    expect(body.position.get()[1]).toBeCloseTo(20, 12);
    expect(body.rotationDegrees.get()).toBeCloseTo(45, 12);
  });

  it("retains the target-bound kinematic rotation without a sub-step reset when its unbound origin changes", () => {
    const rotationDegrees = signal(0);
    let authoredPosition: readonly [number, number] = [30, 20];
    let body!: CRCPhysicsBodyHandle2D;
    const Platform = () => {
      body = crcPhysicsBody2D();
      return (
        <Group
          physics={kinematicBody2D({
            handle: body,
            collider: false,
            target: { rotationDegrees },
          })}
          style={{
            translateX: authoredPosition[0],
            translateY: authoredPosition[1],
            rotationDegrees: rotationDegrees.get(),
          }}
        >
          <Circle
            physics={collider2D()}
            style={{ cx: 12, cy: -5, radius: 4 }}
          />
        </Group>
      );
    };
    const root = () => (
      <PhysicsWorld2D fixedStepMilliseconds={50}>
        <Platform />
      </PhysicsWorld2D>
    );
    const mount = mountCRC(root());
    frames.flush(0);
    frames.flush(50);

    authoredPosition = [90, 60];
    crc(canvasOf(mount), root());
    frames.flush(75);

    expect(body.position.get()).toEqual([30, 20]);
    expect(body.rotationDegrees.get()).toBeCloseTo(0, 12);
    frames.flush(100);
    expect(body.position.get()).toEqual([90, 60]);
    expect(body.rotationDegrees.get()).toBeCloseTo(0, 12);
  });

  it("preserves an intentional tiny descendant translation in a dynamic body's canonical collider shape", () => {
    let world!: CRCPhysicsWorldHandle2D;
    const Capture = () => {
      world = crcPhysicsWorld2D();
      world.revision.get();
      return undefined;
    };
    mountCRC(
      <PhysicsWorld2D fixedStepMilliseconds={50} sleeping={false}>
        <Capture />
        <Group
          physics={dynamicBody2D({
            collider: false,
            mass: 1,
            allowSleep: false,
          })}
        >
          <Group style={{ translateX: 0.0000001 }}>
            <Circle physics={collider2D()} style={{ radius: 12 }} />
          </Group>
        </Group>
      </PhysicsWorld2D>,
    );
    frames.flush(0);
    frames.flush(50);

    const kernel = snapshot(world).kernel;
    const body = kernel.bodies.find((candidate) => candidate.id === 0);
    if (!body) throw new Error("missing tiny-transform body");
    expect(body.localCenterX).toBeCloseTo(0.0000001, 12);
    expect(body.localCenterY).toBeCloseTo(0, 12);
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
