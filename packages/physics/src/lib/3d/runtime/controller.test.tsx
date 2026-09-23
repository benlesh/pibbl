/** @jsxImportSource @crc/core */
import {
  crc,
  signal,
  type CRCController,
  type CRCNode,
  type WritableSignal,
} from "@crc/core";
import {
  crcInternalCurrentSimulationOwner,
  crcInternalRegisterSimulationAdvance,
  useInternalHookSlot,
} from "@crc/core/internal";
import { Group3D, WebGLLayer } from "@crc/webgl";
import {
  PhysicsWorld3D,
  collider3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  dynamicBody3D,
  kinematicBody3D,
  queryPoint3D,
  staticBody3D,
  type CRCPhysicsWorldHandle3D,
} from "../../../3d.js";
import { boxShape3D, sphereShape3D } from "../../../3d-geometry.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BODY_ENABLED_3D, BODY_TYPE_KINEMATIC_3D } from "../world/storage.js";
import {
  installPhysicsWorld3DFailureInjectorForTest,
  PhysicsWorld3DKernel,
  type PhysicsTopologyRecord3D,
} from "../world/world.js";
import {
  PhysicsWorld3DController,
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "./controller.js";
import {
  physicsBodyHandleBinding3D,
  snapshotPhysicsBodyHandle3DForTest,
} from "./body-handle.js";
import {
  MountedPhysicsAttachment3D,
  requirePhysicsAttachment3DDescriptor,
} from "./descriptors.js";
import { snapshotRealmScheduler } from "../../../../../core/src/lib/scheduler/testing.js";

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

describe("PhysicsWorld3D controller scheduling and topology", () => {
  it("publishes only the latest draft when one transaction renders the world twice", () => {
    const finishRender = vi.spyOn(
      PhysicsWorld3DController.prototype as unknown as {
        finishRender(success: boolean): void;
      },
      "finishRender",
    );
    const proposeTopology = vi.spyOn(
      PhysicsWorld3DKernel.prototype,
      "proposeTopology",
    );
    let world!: CRCPhysicsWorldHandle3D;
    let firstHandle!: ReturnType<typeof crcPhysicsBody3D>;
    let latestHandle!: ReturnType<typeof crcPhysicsBody3D>;
    let latestBodyId = -1;
    let renders = 0;
    let useLatestConfiguration = false;

    const Probe = () => {
      world = crcPhysicsWorld3D();
      firstHandle = crcPhysicsBody3D();
      latestHandle = crcPhysicsBody3D();
      const controller = requirePhysicsWorld3DController(world);
      const slot = useInternalHookSlot(
        "superseded3DRenderDraft",
        (teardowns) => {
          const firstValue = dynamicBody3D({
            handle: firstHandle,
            mass: 1,
            collider: false,
          });
          const latestValue = dynamicBody3D({
            handle: latestHandle,
            mass: 1,
            collider: false,
          });
          const firstAttachment = new MountedPhysicsAttachment3D(firstValue);
          const latestAttachment = new MountedPhysicsAttachment3D(latestValue);
          teardowns.add(() => firstAttachment.dispose());
          teardowns.add(() => latestAttachment.dispose());
          return {
            firstAttachment,
            firstDescriptor: requirePhysicsAttachment3DDescriptor(firstValue),
            latestAttachment,
            latestDescriptor: requirePhysicsAttachment3DDescriptor(latestValue),
          };
        },
      ).value;

      if (renders++ === 0) {
        controller.collectBody(
          slot.firstAttachment,
          controller.bodyIdFor(slot.firstAttachment),
          slot.firstDescriptor as never,
          { position: [0, 99, 0], orientation: [0, 0, 0, 1] },
        );
        controller.beginRender({
          gravity: [0, 0, 0],
          fixedStepMilliseconds: 10,
          sleeping: false,
        });
        useLatestConfiguration = true;
      }
      latestBodyId = controller.bodyIdFor(slot.latestAttachment);
      controller.collectBody(
        slot.latestAttachment,
        latestBodyId,
        slot.latestDescriptor as never,
        { position: [0, 4, 0], orientation: [0, 0, 0, 1] },
      );
      return undefined;
    };
    const Scene = () => (
      <PhysicsWorld3D
        gravity={useLatestConfiguration ? [0, 0, 0] : [0, -50, 0]}
        fixedStepMilliseconds={10}
        sleeping={false}
      >
        <Probe />
      </PhysicsWorld3D>
    );
    mountWebGL(<Scene />);

    frames.flush(0);
    expect(finishRender).toHaveBeenCalledOnce();
    expect(snapshot(world)).toMatchObject({
      bodyIds: [latestBodyId],
      kernel: { bodyCount: 0 },
      advanceRegistered: true,
    });
    expect(snapshotPhysicsBodyHandle3DForTest(firstHandle)).toMatchObject({
      bound: false,
      bindingGeneration: 0,
    });
    expect(snapshotPhysicsBodyHandle3DForTest(latestHandle)).toMatchObject({
      bound: true,
      bindingGeneration: 1,
    });
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 1,
      queuedBeginCommands: 1,
      queuedFrameCompletions: 0,
    });

    frames.flush(10);
    expect(finishRender).toHaveBeenCalledOnce();
    expect(proposeTopology).toHaveBeenCalledOnce();
    expect(snapshot(world).kernel).toMatchObject({
      bodyCount: 1,
      eventCount: 0,
    });
    expect(snapshot(world).kernel.bodies[0]).toMatchObject({
      id: latestBodyId,
      positionY: 4,
    });

    frames.flush(20);
    expect(finishRender).toHaveBeenCalledTimes(2);
    expect(proposeTopology).toHaveBeenCalledOnce();
    expect(snapshot(world).kernel.bodies[0]!.positionY).toBe(4);
  });

  it("adopts neither draft when traversal fails after supersession", () => {
    const proposeTopology = vi.spyOn(
      PhysicsWorld3DKernel.prototype,
      "proposeTopology",
    );
    const failure = new Error("superseded traversal failed");
    let firstHandle!: ReturnType<typeof crcPhysicsBody3D>;
    let latestHandle!: ReturnType<typeof crcPhysicsBody3D>;
    const Probe = () => {
      const world = crcPhysicsWorld3D();
      firstHandle = crcPhysicsBody3D();
      latestHandle = crcPhysicsBody3D();
      const controller = requirePhysicsWorld3DController(world);
      const firstValue = dynamicBody3D({
        handle: firstHandle,
        mass: 1,
        collider: false,
      });
      const latestValue = dynamicBody3D({
        handle: latestHandle,
        mass: 1,
        collider: false,
      });
      const firstAttachment = new MountedPhysicsAttachment3D(firstValue);
      const latestAttachment = new MountedPhysicsAttachment3D(latestValue);
      controller.collectBody(
        firstAttachment,
        controller.bodyIdFor(firstAttachment),
        requirePhysicsAttachment3DDescriptor(firstValue) as never,
      );
      controller.beginRender({ gravity: [0, 0, 0] });
      controller.collectBody(
        latestAttachment,
        controller.bodyIdFor(latestAttachment),
        requirePhysicsAttachment3DDescriptor(latestValue) as never,
      );
      throw failure;
    };
    const failed = mountWebGL(
      <PhysicsWorld3D gravity={[0, -50, 0]}>
        <Probe />
      </PhysicsWorld3D>,
    );

    expect(() => frames.flush(0)).toThrow(failure);
    expect(proposeTopology).not.toHaveBeenCalled();
    expect(physicsBodyHandleBinding3D(firstHandle)).toBeUndefined();
    expect(physicsBodyHandleBinding3D(latestHandle)).toBeUndefined();
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredAdvanceParticipants: 0,
      queuedBeginCommands: 0,
      queuedFrameCompletions: 0,
    });
    failed.dispose();
  });

  it("interpolates one accepted kinematic target across every catch-up tick", () => {
    // Production break caught: forwarding one final target pose to every fixed
    // tick jumps to the target on tick one instead of traversing the accepted
    // previous-to-current sample over the frame's four ticks.
    const world = new PhysicsWorld3DKernel({
      gravity: [0, 0, 0],
      fixedStepMilliseconds: 10,
      maxCatchUpSteps: 4,
      sleeping: false,
    });
    world.proposeTopology([kinematicBody(1)]);
    const mounted = world.advance({
      frameId: 1,
      logicalTime: 0,
      stagedKinematicTargets: new Map([
        [
          1,
          {
            position: [4, 0, 0],
            orientation: [0, 0, 0, 1],
          },
        ],
      ]),
    });
    world.adopt(mounted);

    const positionsAfterTicks: number[] = [];
    const restore = installPhysicsWorld3DFailureInjectorForTest((stage) => {
      if (stage === "broad-phase") {
        positionsAfterTicks.push(world.snapshot().bodies[0]!.positionX);
      }
    });
    try {
      const candidate = world.advance({
        frameId: 2,
        logicalTime: 40,
        stagedKinematicTargets: new Map([
          [
            1,
            {
              position: [4, 0, 0],
              orientation: [0, 0, 0, 1],
            },
          ],
        ]),
      });
      world.adopt(candidate);
    } finally {
      restore();
      world.dispose();
    }

    expect(positionsAfterTicks).toEqual([1, 2, 3, 4]);
  });

  it("owns one world registration for multiple bodies and rolls failed traversal back", () => {
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const failure = new Error("topology traversal failed");
    const Throw = () => {
      throw failure;
    };
    const failed = mountWebGL(
      <PhysicsWorld3D>
        <Capture />
        <Group3D physics={dynamicBody3D({ mass: 1, collider: false })} />
        <Throw />
      </PhysicsWorld3D>,
    );
    expect(() => frames.flush(0)).toThrow(failure);
    expect(() => requirePhysicsWorld3DController(world).snapshot()).toThrow(
      /disposed/i,
    );
    failed.dispose();

    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Capture />
        <Group3D physics={dynamicBody3D({ mass: 1, collider: false })} />
        <Group3D physics={dynamicBody3D({ mass: 1, collider: false })} />
      </PhysicsWorld3D>,
    );
    frames.flush(1);
    expect(snapshot(world)).toMatchObject({
      advanceRegistered: true,
      bodyIds: [0, 1],
    });
    frames.flush(1);
    expect(snapshot(world).kernel.bodyCount).toBe(2);
  });

  it("composes sparse position and orientation targets from committed pose", () => {
    const position = signal<readonly [number, number, number]>([0, 0, 0]);
    const orientation = signal<readonly [number, number, number, number]>([
      0, 0, 0, 1,
    ]);
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    mountWebGL(
      <PhysicsWorld3D
        gravity={[0, 0, 0]}
        fixedStepMilliseconds={10}
        sleeping={false}
      >
        <Capture />
        <Group3D
          physics={kinematicBody3D({ target: { position }, collider: false })}
        />
        <Group3D
          physics={kinematicBody3D({
            target: { orientation },
            collider: false,
          })}
        />
        <Group3D physics={dynamicBody3D({ mass: 1, collider: false })} />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    position.set([2, 3, 4]);
    orientation.set([0, 0, 1, 0]);
    frames.flush(10);
    expect(snapshot(world).advanceRegistered).toBe(true);
    frames.flush(20);

    const bodies = snapshot(world).kernel.bodies;
    expect(bodies[0]).toMatchObject({
      positionX: 2,
      positionY: 3,
      positionZ: 4,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      orientationW: 1,
    });
    expect(bodies[1]).toMatchObject({
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 1,
      orientationW: 0,
    });
  });

  it("retains committed sparse kinematic poses when topology options change", () => {
    // Production break caught: rebuilding from the last accepted topology
    // definition snaps moved kinematics back to their original pose before
    // the next fixed tick can run.
    const position = signal<readonly [number, number, number]>([2, 3, 4]);
    const orientation = signal<readonly [number, number, number, number]>([
      0,
      0,
      Math.SQRT1_2,
      Math.SQRT1_2,
    ]);
    const allowSleep = signal(true);
    let world!: CRCPhysicsWorldHandle3D;
    const Scene = () => {
      world = crcPhysicsWorld3D();
      const sleeping = allowSleep.get();
      return [
        <Group3D
          key="position"
          physics={kinematicBody3D({
            allowSleep: sleeping,
            target: { position },
            collider: false,
          })}
        />,
        <Group3D
          key="orientation"
          physics={kinematicBody3D({
            allowSleep: sleeping,
            target: { orientation },
            collider: false,
          })}
        />,
      ];
    };
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} fixedStepMilliseconds={10}>
        <Scene />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(10);
    const accepted = snapshot(world).kernel.bodies;
    expect(accepted[0]).toMatchObject({
      positionX: 2,
      positionY: 3,
      positionZ: 4,
    });
    expect(accepted[1]).toMatchObject({
      orientationX: 0,
      orientationY: 0,
      orientationZ: expect.closeTo(Math.SQRT1_2, 14),
      orientationW: expect.closeTo(Math.SQRT1_2, 14),
    });

    allowSleep.set(false);
    frames.flush(10);
    frames.flush(10);
    const retained = snapshot(world).kernel.bodies;
    expect(retained[0]).toMatchObject({
      positionX: 2,
      positionY: 3,
      positionZ: 4,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      orientationW: 1,
    });
    expect(retained[1]).toMatchObject({
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: expect.closeTo(Math.SQRT1_2, 14),
      orientationW: expect.closeTo(Math.SQRT1_2, 14),
    });
  });

  it("reuses an explicit transformed collider across recreated descriptors", () => {
    // Production break caught: caching by normalized options object identity
    // regenerates a nominal transformed shape and churns topology on every
    // physics-requested render.
    const version = signal(0);
    const shape = sphereShape3D({ radius: 1 });
    let world!: CRCPhysicsWorldHandle3D;
    const Scene = () => {
      version.get();
      world = crcPhysicsWorld3D();
      return (
        <Group3D
          physics={staticBody3D({
            collider: {
              shape,
              offset: [2, 0, 0],
              orientation: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
            },
          })}
        />
      );
    };
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Scene />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    const first = queryPoint3D(world, [2, 0, 0]);
    expect(first).not.toBeNull();
    const counters = snapshot(world).kernel.counters;

    version.set(1);
    frames.flush(1);
    const pendingAfterRender = frames.pending;
    if (pendingAfterRender > 0) frames.flush(1);
    const second = queryPoint3D(world, [2, 0, 0]);
    expect(second).not.toBeNull();
    expect(second!.collider).toBe(first!.collider);
    expect(second!.colliderGeneration).toBe(first!.colliderGeneration);
    expect(snapshot(world).kernel.counters.colliderAllocations).toBe(
      counters.colliderAllocations,
    );
    expect(snapshot(world).kernel.counters.colliderReleases).toBe(
      counters.colliderReleases,
    );
    expect(pendingAfterRender).toBe(0);
  });

  it("keeps mounted compound topology, mass, contacts, and ownership stable across 10,000 unchanged renders", () => {
    // Production breaks caught: private shape-cache calls miss descriptor,
    // topology, aggregate-mass, contact-cache, and ownership churn; rebuilding
    // every compound leaf also loses stable sibling order on one-child edits.
    const version = signal(0);
    const leftX = signal(-1);
    const sphere = sphereShape3D({ radius: 1 });
    const floor = boxShape3D({ width: 10, height: 2, depth: 10 });
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const Compound = () => {
      version.get();
      return (
        <Group3D
          physics={dynamicBody3D({
            mass: "auto",
            lockTranslation: { x: true, y: true, z: true },
            lockRotation: { x: true, y: true, z: true },
            collider: false,
          })}
          style={{ translateY: 1 }}
        >
          <Group3D
            key="left"
            physics={collider3D({ shape: sphere, tag: "left" })}
            style={{ translateX: leftX.get() }}
          />
          <Group3D
            key="right"
            physics={collider3D({ shape: sphere, tag: "right" })}
            style={{ translateX: 1 }}
          />
        </Group3D>
      );
    };
    mountWebGL(
      <PhysicsWorld3D
        gravity={[0, 0, 0]}
        fixedStepMilliseconds={10}
        sleeping={false}
      >
        <Capture />
        <Group3D
          physics={staticBody3D({ collider: { shape: floor, tag: "floor" } })}
          style={{ translateY: -1 }}
        />
        <Compound />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(10);
    frames.flush(20);

    const initial = snapshot(world);
    const instrumentation = initial as typeof initial & {
      readonly shapeBakeCount: number;
      readonly massPropertyDerivations: number;
    };
    expect(instrumentation.shapeBakeCount).toBe(3);
    expect(instrumentation.massPropertyDerivations).toBe(1);
    expect(initial.kernel.contactCount).toBe(2);
    expect(initial.contactPairs).toHaveLength(2);
    const [floorId, leftId, rightId] = initial.colliderIds;
    expect(
      initial.contactPairs.map((pair) => [
        pair.firstColliderId,
        pair.secondColliderId,
      ]),
    ).toEqual([
      [floorId, leftId],
      [floorId, rightId],
    ]);
    const stableRightPair = initial.contactPairs[1]!;
    const counters = initial.kernel.counters;
    const body = initial.kernel.bodies[1]!;
    const left = queryPoint3D(world, [-1, 1, 0]);
    const right = queryPoint3D(world, [1, 1, 0]);
    expect(left?.tag).toBe("left");
    expect(right?.tag).toBe("right");

    for (let render = 1; render <= 10_000; render += 1) {
      version.set(render);
      frames.flush(20 + render / 1_000);
    }
    const unchanged = snapshot(world);
    expect(unchanged.shapeBakeCount).toBe(instrumentation.shapeBakeCount);
    expect(unchanged.massPropertyDerivations).toBe(
      instrumentation.massPropertyDerivations,
    );
    expect(unchanged.kernel.bodies[1]).toMatchObject({
      generation: body.generation,
      inverseMass: body.inverseMass,
      localInverseInertiaXX: body.localInverseInertiaXX,
      localInverseInertiaYY: body.localInverseInertiaYY,
      localInverseInertiaZZ: body.localInverseInertiaZZ,
    });
    expect(unchanged.kernel.contactCount).toBe(2);
    for (const name of [
      "bodyAllocations",
      "bodyReleases",
      "colliderAllocations",
      "colliderReleases",
      "proxyAllocations",
      "proxyReleases",
      "contactAllocations",
      "contactReleases",
      "liveBodies",
      "liveColliders",
      "liveProxies",
      "liveContacts",
      "bodyCapacityGrowths",
      "colliderCapacityGrowths",
      "proxyCapacityGrowths",
      "contactCapacityGrowths",
    ] as const) {
      expect(unchanged.kernel.counters[name], name).toBe(counters[name]);
    }
    expect(queryPoint3D(world, [-1, 1, 0])?.collider).toBe(left?.collider);
    const changedRight = queryPoint3D(world, [1, 1, 0]);
    expect(changedRight?.tag).toBe("right");
    expect(changedRight?.colliderGeneration).toBe(right?.colliderGeneration);
    expect(changedRight?.collider).toBe(right?.collider);

    leftX.set(-2);
    frames.flush(31);
    frames.flush(41);
    const changed = snapshot(world);
    expect(changed.shapeBakeCount).toBe(unchanged.shapeBakeCount + 1);
    expect(changed.massPropertyDerivations).toBe(
      unchanged.massPropertyDerivations + 1,
    );
    const rebuiltRight = queryPoint3D(world, [1, 1, 0]);
    const rebuiltLeft = queryPoint3D(world, [-2, 1, 0]);
    expect(rebuiltLeft?.tag).toBe("left");
    expect(rebuiltLeft?.colliderGeneration).toBe(
      (left?.colliderGeneration ?? 0) + 1,
    );
    expect(rebuiltRight?.tag).toBe("right");
    expect(rebuiltRight?.colliderGeneration).toBe(right?.colliderGeneration);
    expect(rebuiltRight?.collider).toBe(right?.collider);
    expect(changed.kernel.counters.colliderAllocations).toBe(
      unchanged.kernel.counters.colliderAllocations + 1,
    );
    expect(changed.kernel.counters.colliderReleases).toBe(
      unchanged.kernel.counters.colliderReleases + 1,
    );
    expect(changed.kernel.counters.proxyAllocations).toBe(
      unchanged.kernel.counters.proxyAllocations + 1,
    );
    expect(changed.kernel.counters.proxyReleases).toBe(
      unchanged.kernel.counters.proxyReleases + 1,
    );
    expect(changed.contactPairs).toHaveLength(2);
    expect(
      changed.contactPairs.map((pair) => [
        pair.firstColliderId,
        pair.secondColliderId,
      ]),
    ).toEqual([
      [floorId, leftId],
      [floorId, rightId],
    ]);
    expect(changed.contactPairs[1]).toEqual(stableRightPair);
    expect(changed.kernel.bodies[1]!.inverseMass).toBe(body.inverseMass);
    expect(changed.kernel.bodies[1]!.localInverseInertiaYY).not.toBe(
      body.localInverseInertiaYY,
    );
  }, 60_000);

  it("keeps one registration while a kinematic target binding can produce a later sample", () => {
    // Production break caught: releasing the participant when the current
    // target is reached leaves a later write to the same unobserved binding
    // with no frame or descriptor change capable of waking physics.
    const position = signal<readonly [number, number, number]>([1, 0, 0]);
    let world!: CRCPhysicsWorldHandle3D;
    const Body = () => {
      world = crcPhysicsWorld3D();
      return (
        <Group3D
          physics={kinematicBody3D({
            target: { position },
            collider: false,
          })}
        />
      );
    };
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} fixedStepMilliseconds={10}>
        <Body />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(10);
    frames.flush(20);
    expect(snapshot(world).kernel.bodies[0]!.positionX).toBe(1);
    expect(snapshot(world).advanceRegistered).toBe(true);

    position.set([5, 0, 0]);
    frames.flush(30);
    expect(snapshot(world).kernel.bodies[0]!.positionX).toBe(1);
    expect(snapshot(world).advanceRegistered).toBe(true);
    frames.flush(40);
    expect(snapshot(world).kernel.bodies[0]!.positionX).toBe(5);
  });

  it("reads animation-lane target staging in the same frame and publishes only at Commit", () => {
    // Production break caught: reading the committed signal before the
    // animation lane stages it delays a 3D kinematic target by one frame;
    // publishing revision early exposes a candidate before shared Commit.
    const target = signal<readonly [number, number, number]>([0, 0, 0]);
    let world!: CRCPhysicsWorldHandle3D;
    const revisions: number[] = [];
    const Capture = () => {
      world = crcPhysicsWorld3D();
      revisions.push(world.revision.get());
      return undefined;
    };
    const Animate = () => {
      const owner = crcInternalCurrentSimulationOwner();
      useInternalHookSlot("task6AnimationProbe3D", (teardowns) => {
        const release = crcInternalRegisterSimulationAdvance(
          owner,
          "animation",
          (_frame, batch) => {
            batch.stage(
              target as WritableSignal<readonly [number, number, number]>,
              [12, 34, 56],
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
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} fixedStepMilliseconds={100}>
        <Animate />
        <Capture />
        <Group3D
          physics={kinematicBody3D({
            collider: false,
            target: { position: target },
          })}
        />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(100);

    expect(target.get()).toEqual([12, 34, 56]);
    expect(snapshot(world).kernel.anchored).toBe(true);
    expect(snapshot(world).advanceRegistered).toBe(true);
    expect(world.revision.get()).toBe(1);
    expect(revisions).toEqual([0, 1]);

    frames.flush(200);
    expect(snapshot(world).kernel.bodies[0]).toMatchObject({
      positionX: 12,
      positionY: 34,
      positionZ: 56,
    });
  });

  it("removing a target restores authored pose authority and clears target-derived velocity", () => {
    const position = signal<readonly [number, number, number]>([1, 0, 0]);
    const bound = signal(true);
    let world!: CRCPhysicsWorldHandle3D;
    const Body = () => {
      world = crcPhysicsWorld3D();
      return (
        <Group3D
          physics={kinematicBody3D({
            target: bound.get() ? { position } : {},
            collider: false,
          })}
        />
      );
    };
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} fixedStepMilliseconds={10}>
        <Body />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(10);
    frames.flush(20);
    expect(snapshot(world).kernel.bodies[0]!.positionX).toBe(1);
    bound.set(false);
    frames.flush(30);
    frames.flush(40);
    const authored = snapshot(world).kernel.bodies[0]!;
    expect(authored.positionX).toBe(0);
    expect(authored.linearVelocityX).toBe(0);
    expect(authored.linearVelocityY).toBe(0);
    expect(authored.linearVelocityZ).toBe(0);
    expect(snapshot(world).advanceRegistered).toBe(false);
    position.set([8, 0, 0]);
    frames.flush(50);
    expect(frames.pending).toBe(0);
    expect(snapshot(world).kernel.bodies[0]!.positionX).toBe(0);

    bound.set(true);
    frames.flush(60);
    expect(snapshot(world).advanceRegistered).toBe(true);
    frames.flush(70);
    frames.flush(80);
    expect(snapshot(world).kernel.bodies[0]!.positionX).toBe(8);
  });

  it("routes public queries through the mandatory committed-read guard", () => {
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    mountWebGL(
      <PhysicsWorld3D>
        <Capture />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    const guard = vi.spyOn(
      PhysicsWorld3DKernel.prototype,
      "assertCommittedReadable",
    );
    expect(queryPoint3D(world, [0, 0, 0])).toBeNull();
    expect(guard).toHaveBeenCalledOnce();
  });

  it("materializes immutable committed query handles without scheduling and rejects stale identities", () => {
    // Production break caught: bypassing the runtime facade can expose private
    // records, schedule work on reads, or let a reused slot revive old handles.
    const shown = signal(true);
    const shape = sphereShape3D({ radius: 1 });
    let world!: CRCPhysicsWorldHandle3D;
    const Scene = () => {
      world = crcPhysicsWorld3D();
      return shown.get() ? (
        <Group3D
          physics={staticBody3D({
            collider: { shape, sensor: true },
          })}
        />
      ) : undefined;
    };
    const mount = mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Scene />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    const pendingBefore = frames.pending;
    const first = queryPoint3D(world, [0, 0, 0], { sensors: "only" });
    expect(first).not.toBeNull();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first!.body)).toBe(true);
    expect(Object.isFrozen(first!.collider)).toBe(true);
    expect(queryPoint3D(world, [0, 0, 0], { sensors: "exclude" })).toBeNull();
    expect(frames.pending).toBe(pendingBefore);
    expect(snapshot(world)).toMatchObject({
      materializedBodyHandles: 1,
      materializedColliderHandles: 1,
    });

    shown.set(false);
    frames.flush(1);
    frames.flush(1);
    shown.set(true);
    frames.flush(2);
    frames.flush(2);
    expect(
      queryPoint3D(world, [0, 0, 0], {
        sensors: "only",
        excludeCollider: first!.collider,
      }),
    ).toBeNull();
    const replacement = queryPoint3D(world, [0, 0, 0], {
      sensors: "only",
    });
    expect(replacement).not.toBeNull();
    expect(replacement!.collider).not.toBe(first!.collider);
    expect(replacement!.colliderGeneration).toBeGreaterThan(
      first!.colliderGeneration,
    );

    mount.dispose();
    expect(() => queryPoint3D(world, [0, 0, 0])).toThrow(/live.*world/i);
  });

  it("scales the authoritative compound inertia tensor for explicit mass", () => {
    // Production break caught: reimplementing compound mass math in the
    // controller can diverge from the Task 5 tensor and parallel-axis rules.
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Capture />
        <Group3D
          physics={dynamicBody3D({
            mass: 2,
            collider: { shape: sphereShape3D({ radius: 1 }) },
          })}
        />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    const body = snapshot(world).kernel.bodies[0]!;
    expect(body.inverseMass).toBe(0.5);
    expect(body.localInverseInertiaXX).toBeCloseTo(1.25, 12);
    expect(body.localInverseInertiaYY).toBeCloseTo(1.25, 12);
    expect(body.localInverseInertiaZZ).toBeCloseTo(1.25, 12);
    expect(body.localInverseInertiaXY).toBe(0);
    expect(body.localInverseInertiaXZ).toBe(0);
    expect(body.localInverseInertiaYZ).toBe(0);
  });

  it("isolates one failed world candidate from a sibling world in the realm", () => {
    // Production break caught: a failed physics participant must roll itself
    // back without preventing a later sibling participant from adopting.
    let failedWorld!: CRCPhysicsWorldHandle3D;
    let healthyWorld!: CRCPhysicsWorldHandle3D;
    const errors: unknown[] = [];
    const FailedCapture = () => {
      failedWorld = crcPhysicsWorld3D();
      return undefined;
    };
    const HealthyCapture = () => {
      healthyWorld = crcPhysicsWorld3D();
      return undefined;
    };
    mountWebGL(
      <PhysicsWorld3D
        gravity={[0, 0, 0]}
        sleeping={false}
        onError={(error) => errors.push(error)}
      >
        <FailedCapture />
        <Group3D physics={dynamicBody3D({ mass: 1, collider: false })} />
      </PhysicsWorld3D>,
    );
    mountWebGL(
      <PhysicsWorld3D gravity={[0, 0, 0]} sleeping={false}>
        <HealthyCapture />
        <Group3D physics={dynamicBody3D({ mass: 1, collider: false })} />
      </PhysicsWorld3D>,
    );
    frames.flush(0);
    frames.flush(0);
    frames.flush(10);
    const failedRevision = snapshot(failedWorld).revision;
    const healthyRevision = snapshot(healthyWorld).revision;
    const failure = new Error("failed sibling world");
    let injected = false;
    const restore = installPhysicsWorld3DFailureInjectorForTest((stage) => {
      if (!injected && stage === "broad-phase") {
        injected = true;
        throw failure;
      }
    });
    try {
      expect(() => frames.flush(20)).toThrow(failure);
    } finally {
      restore();
    }

    expect(errors).toEqual([failure]);
    expect(snapshot(failedWorld).revision).toBe(failedRevision);
    expect(snapshot(healthyWorld).revision).toBe(healthyRevision + 1);
  });
});

function kinematicBody(id: number): PhysicsTopologyRecord3D {
  return {
    kind: "body",
    id,
    definition: {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      orientationW: 1,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      angularVelocityX: 0,
      angularVelocityY: 0,
      angularVelocityZ: 0,
      forceX: 0,
      forceY: 0,
      forceZ: 0,
      torqueX: 0,
      torqueY: 0,
      torqueZ: 0,
      inverseMass: 0,
      localInverseInertiaXX: 0,
      localInverseInertiaYY: 0,
      localInverseInertiaZZ: 0,
      localInverseInertiaXY: 0,
      localInverseInertiaXZ: 0,
      localInverseInertiaYZ: 0,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 0,
      sleepTime: 0,
      translationLocks: 0,
      rotationLocks: 0,
      flags: BODY_ENABLED_3D | BODY_TYPE_KINEMATIC_3D,
      owner: null,
    },
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
