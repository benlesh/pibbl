import { describe, expect, it } from "vitest";
import {
  boxShape3D,
  sphereShape3D,
  type CRCPhysicsPose3D,
} from "../../../3d-geometry.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { installPhysicsWorld3DTraceCollectorForTest } from "../runtime/trace.js";
import { BODY_CCD_3D } from "./ccd.js";
import { BODY_SLEEPING_3D } from "./solver.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  COLLIDER_CONTRIBUTES_TO_MASS_3D,
  COLLIDER_ENABLED_3D,
} from "./storage.js";
import {
  installPhysicsWorld3DFailureInjectorForTest,
  normalizePhysicsWorld3DConfiguration,
  PhysicsWorld3DKernel,
  type PhysicsCommand3D,
  type PhysicsTopologyRecord3D,
  type PhysicsWorld3DCandidate,
  type PhysicsWorld3DFailureStage,
} from "./world.js";

const dynamicFlags = BODY_TYPE_DYNAMIC_3D | BODY_ENABLED_3D;

function quaternionZ(degrees: number): readonly [number, number, number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [0, 0, Math.sin(radians / 2), Math.cos(radians / 2)];
}

function body(
  id: number,
  options: Readonly<{
    x?: number;
    y?: number;
    z?: number;
    velocityX?: number;
    velocityY?: number;
    velocityZ?: number;
    rotationZDegrees?: number;
    angularVelocityZDegrees?: number;
    localCenterX?: number;
    type?: "dynamic" | "static" | "kinematic";
    ccd?: boolean;
  }> = {},
): PhysicsTopologyRecord3D {
  const type = options.type ?? "dynamic";
  const orientation = quaternionZ(options.rotationZDegrees ?? 0);
  const localCenterX = options.localCenterX ?? 0;
  const rotatedCenterX =
    localCenterX * Math.cos(((options.rotationZDegrees ?? 0) * Math.PI) / 180);
  const rotatedCenterY =
    localCenterX * Math.sin(((options.rotationZDegrees ?? 0) * Math.PI) / 180);
  const dynamic = type === "dynamic";
  const flags =
    BODY_ENABLED_3D |
    (dynamic
      ? BODY_TYPE_DYNAMIC_3D
      : type === "kinematic"
        ? BODY_TYPE_KINEMATIC_3D
        : 0) |
    (options.ccd === true ? BODY_CCD_3D : 0);
  return {
    kind: "body",
    id,
    definition: {
      positionX: (options.x ?? 0) + rotatedCenterX,
      positionY: (options.y ?? 0) + rotatedCenterY,
      positionZ: options.z ?? 0,
      orientationX: orientation[0],
      orientationY: orientation[1],
      orientationZ: orientation[2],
      orientationW: orientation[3],
      localCenterX,
      localCenterY: 0,
      localCenterZ: 0,
      linearVelocityX: options.velocityX ?? 0,
      linearVelocityY: options.velocityY ?? 0,
      linearVelocityZ: options.velocityZ ?? 0,
      angularVelocityX: 0,
      angularVelocityY: 0,
      angularVelocityZ:
        ((options.angularVelocityZDegrees ?? 0) * Math.PI) / 180,
      forceX: 0,
      forceY: 0,
      forceZ: 0,
      torqueX: 0,
      torqueY: 0,
      torqueZ: 0,
      inverseMass: dynamic ? 1 : 0,
      localInverseInertiaXX: dynamic ? 1 : 0,
      localInverseInertiaYY: dynamic ? 1 : 0,
      localInverseInertiaZZ: dynamic ? 1 : 0,
      localInverseInertiaXY: 0,
      localInverseInertiaXZ: 0,
      localInverseInertiaYZ: 0,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: dynamic ? 1 : 0,
      sleepTime: 0,
      translationLocks: 0,
      rotationLocks: 0,
      flags,
      owner: null,
    },
  };
}

function collider(
  id: number,
  bodyId: number,
  shape = sphereShape3D({ radius: 1 }),
): PhysicsTopologyRecord3D {
  return {
    kind: "collider",
    id,
    bodyId,
    definition: {
      shape: requireShapeRecord3D(shape),
      localPositionX: 0,
      localPositionY: 0,
      localPositionZ: 0,
      localOrientationX: 0,
      localOrientationY: 0,
      localOrientationZ: 0,
      localOrientationW: 1,
      density: 1,
      friction: 0.5,
      restitution: 0,
      collisionCategory: 1,
      collisionMask: 0xffff_ffff,
      collisionGroup: 0,
      tag: null,
      handlers: null,
      owner: null,
      flags: COLLIDER_ENABLED_3D | COLLIDER_CONTRIBUTES_TO_MASS_3D,
    },
  };
}

function collidingTopology(): readonly PhysicsTopologyRecord3D[] {
  return [
    body(1, { x: 0, velocityX: 0.25 }),
    body(2, { x: 1.5, velocityX: -0.25 }),
    collider(10, 1),
    collider(20, 2),
  ];
}

function advance(
  world: PhysicsWorld3DKernel,
  frameId: number,
  logicalTime: number,
  stagedKinematicTargets: ReadonlyMap<number, CRCPhysicsPose3D> = new Map(),
): PhysicsWorld3DCandidate {
  const candidate = world.advance({
    frameId,
    logicalTime,
    stagedKinematicTargets,
  });
  world.adopt(candidate);
  return candidate;
}

interface CapturedProperty {
  readonly key: PropertyKey;
  readonly reference: unknown;
  readonly contents: unknown;
}

function captureOwner(owner: object): readonly CapturedProperty[] {
  return Reflect.ownKeys(owner).map((key) => {
    const value = Reflect.get(owner, key) as unknown;
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      return {
        key,
        reference: value,
        contents: Array.from(value as unknown as ArrayLike<number>),
      };
    }
    if (Array.isArray(value)) {
      return { key, reference: value, contents: [...value] };
    }
    if (value instanceof Map) {
      return { key, reference: value, contents: [...value.entries()] };
    }
    return { key, reference: value, contents: value };
  });
}

function expectOwnerRestored(
  owner: object,
  captured: readonly CapturedProperty[],
): void {
  for (const property of captured) {
    const current = Reflect.get(owner, property.key) as unknown;
    if (
      ArrayBuffer.isView(property.reference) &&
      !(property.reference instanceof DataView)
    ) {
      expect(current).toBe(property.reference);
      expect(Array.from(current as ArrayLike<number>)).toEqual(
        property.contents,
      );
    } else if (Array.isArray(property.reference)) {
      expect(current).toBe(property.reference);
      expect(current).toEqual(property.contents);
    } else if (property.reference instanceof Map) {
      expect(current).toBe(property.reference);
      expect([...(current as Map<unknown, unknown>).entries()]).toEqual(
        property.contents,
      );
    } else {
      expect(current).toBe(property.reference);
    }
  }
}

describe("transactional fixed-tick 3D world cadence", () => {
  it("normalizes the fixed documented defaults and nested solver options", () => {
    expect(normalizePhysicsWorld3DConfiguration({})).toEqual({
      gravityX: 0,
      gravityY: 0,
      gravityZ: 0,
      fixedStepMilliseconds: 1000 / 60,
      maxCatchUpSteps: 4,
      interpolation: "linear",
      sleeping: true,
      velocityIterations: 8,
      positionIterations: 3,
    });
    const configured = normalizePhysicsWorld3DConfiguration({
      gravity: [1, 2, 3],
      solver: { velocityIterations: 12, positionIterations: 5 },
    });
    expect(configured).toMatchObject({
      gravityX: 1,
      gravityY: 2,
      gravityZ: 3,
      velocityIterations: 12,
      positionIterations: 5,
    });
    expect(Object.isFrozen(configured)).toBe(true);
  });

  it.each([
    { fixedStepMilliseconds: 0 },
    { fixedStepMilliseconds: Number.NaN },
    { maxCatchUpSteps: 0 },
    { maxCatchUpSteps: 17 },
    { solver: { velocityIterations: 0 } },
    { solver: { positionIterations: 33 } },
  ])("rejects invalid world configuration %#", (configuration) => {
    expect(() => normalizePhysicsWorld3DConfiguration(configuration)).toThrow(
      RangeError,
    );
  });

  it("rejects nonfinite collider topology before it can enter a candidate", () => {
    const world = new PhysicsWorld3DKernel();
    const invalid = collider(10, 1);
    expect(() =>
      world.proposeTopology([
        body(1),
        {
          ...invalid,
          definition: { ...invalid.definition, restitution: Number.NaN },
        },
      ]),
    ).toThrow(/collider restitution must be finite/);
    expect(world.snapshot()).toMatchObject({ bodyCount: 0, colliderCount: 0 });
  });

  it("runs zero, one, and three complete ticks while retaining a presentation remainder", () => {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    world.proposeTopology([body(7, { velocityX: 1 })]);

    expect(advance(world, 1, 1_000)).toMatchObject({
      stepCount: 0,
      tick: 0,
      accumulatorMilliseconds: 0,
    });
    expect(advance(world, 2, 1_050)).toMatchObject({
      stepCount: 0,
      tick: 0,
      accumulatorMilliseconds: 50,
    });
    expect(advance(world, 3, 1_150)).toMatchObject({
      stepCount: 1,
      tick: 1,
      accumulatorMilliseconds: 50,
    });
    expect(world.authoritativePose(7).position[0]).toBeCloseTo(0.1, 12);
    expect(world.presentationPose(7).position[0]).toBeCloseTo(0.05, 12);

    expect(advance(world, 4, 1_450)).toMatchObject({
      stepCount: 3,
      tick: 4,
      accumulatorMilliseconds: 50,
    });
    expect(world.authoritativePose(7).position[0]).toBeCloseTo(0.4, 12);
    expect(world.presentationPose(7).position[0]).toBeCloseTo(0.35, 12);
  });

  it("is independent of host-frame grouping for equivalent accepted ticks", () => {
    const grouped = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    const split = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    grouped.proposeTopology([body(1, { velocityX: 3 })]);
    split.proposeTopology([body(1, { velocityX: 3 })]);
    advance(grouped, 1, 0);
    advance(grouped, 2, 350);
    advance(split, 1, 0);
    advance(split, 2, 100);
    advance(split, 3, 200);
    advance(split, 4, 300);
    advance(split, 5, 350);

    expect(grouped.authoritativePose(1)).toEqual(split.authoritativePose(1));
    expect(grouped.snapshot()).toMatchObject({
      tick: 3,
      accumulatorMilliseconds: 50,
    });
    expect(split.snapshot()).toMatchObject({
      tick: 3,
      accumulatorMilliseconds: 50,
    });
  });

  it("runs exactly four ticks after a stall, discards excess time, and traces the clamp", () => {
    const traces: unknown[] = [];
    const restore = installPhysicsWorld3DTraceCollectorForTest((record) => {
      traces.push(record);
    });
    try {
      const world = new PhysicsWorld3DKernel({
        fixedStepMilliseconds: 100,
        maxCatchUpSteps: 4,
        sleeping: false,
      });
      world.proposeTopology([body(1, { velocityX: 1 })]);
      advance(world, 1, 0);
      expect(advance(world, 2, 1_000)).toMatchObject({
        stepCount: 4,
        tick: 4,
        accumulatorMilliseconds: 0,
      });
      expect(world.authoritativePose(1).position[0]).toBeCloseTo(0.4, 12);
      expect(
        traces.filter(
          (record) => (record as { kind?: string }).kind === "physics-3d-clamp",
        ),
      ).toEqual([
        {
          kind: "physics-3d-clamp",
          frameId: 2,
          logicalTime: 1_000,
          acceptedElapsedMilliseconds: 400,
          discardedElapsedMilliseconds: 600,
        },
      ]);
      expect(advance(world, 3, 1_000).stepCount).toBe(0);
    } finally {
      restore();
    }
  });

  it("linearly interpolates centers and normalized shortest-path quaternions", () => {
    const simple = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 1_000,
      sleeping: false,
    });
    simple.proposeTopology([
      body(1, { velocityX: 2, angularVelocityZDegrees: 90 }),
    ]);
    advance(simple, 1, 0);
    advance(simple, 2, 1_500);
    const pose = simple.presentationPose(1);
    const authoritative = simple.authoritativePose(1);
    const authoritativeAngle =
      2 * Math.atan2(authoritative.orientation[2], authoritative.orientation[3]);
    expect(pose.position[0]).toBeCloseTo(1, 12);
    expect(pose.orientation[2]).toBeCloseTo(
      Math.sin(authoritativeAngle / 4),
      12,
    );
    expect(pose.orientation[3]).toBeCloseTo(
      Math.cos(authoritativeAngle / 4),
      12,
    );
    expect(Math.hypot(...pose.orientation)).toBeCloseTo(1, 14);

    const seam = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 1_000,
      sleeping: false,
    });
    seam.proposeTopology([
      body(2, {
        rotationZDegrees: 170,
        angularVelocityZDegrees: 20,
      }),
    ]);
    advance(seam, 1, 0);
    advance(seam, 2, 1_500);
    const midpoint = seam.presentationPose(2).orientation;
    const seamAuthoritative = seam.authoritativePose(2).orientation;
    let endAngle =
      2 * Math.atan2(seamAuthoritative[2], seamAuthoritative[3]);
    if (endAngle < (170 * Math.PI) / 180 - Math.PI) endAngle += 2 * Math.PI;
    const expectedMidpoint = ((170 * Math.PI) / 180 + endAngle) / 2;
    expect(Math.abs(midpoint[2])).toBeCloseTo(
      Math.abs(Math.sin(expectedMidpoint / 2)),
      12,
    );
    expect(Math.abs(midpoint[3])).toBeCloseTo(
      Math.abs(Math.cos(expectedMidpoint / 2)),
      12,
    );

    const stationary = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 1_000,
      sleeping: false,
    });
    stationary.proposeTopology([body(3)]);
    advance(stationary, 1, 0);
    advance(stationary, 2, 1_500);
    expect(stationary.presentationPose(3).orientation).toEqual([0, 0, 0, 1]);
  });

  it("returns authoritative state for interpolation none and projects an off-origin center of mass", () => {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 1_000,
      interpolation: "none",
      sleeping: false,
    });
    world.proposeTopology([
      body(1, {
        localCenterX: 2,
        angularVelocityZDegrees: 90,
      }),
    ]);
    advance(world, 1, 0);
    advance(world, 2, 1_500);
    expect(world.presentationPose(1)).toEqual(world.authoritativePose(1));
    const authoritative = world.authoritativePose(1);
    const q = authoritative.orientation;
    const cosine = 1 - 2 * q[2] * q[2];
    const sine = 2 * q[2] * q[3];
    expect(authoritative.position[0]).toBeCloseTo(2 - 2 * cosine, 12);
    expect(authoritative.position[1]).toBeCloseTo(-2 * sine, 12);
  });

  it("anchors newly active and explicitly woken worlds at current logical time", () => {
    const world = new PhysicsWorld3DKernel({ fixedStepMilliseconds: 100 });
    world.proposeTopology([body(1)]);
    expect(advance(world, 1, 5_000).stepCount).toBe(0);
    advance(world, 2, 5_400);
    advance(world, 3, 5_500);
    expect(world.snapshot().bodies[0]!.flags & BODY_SLEEPING_3D).not.toBe(0);

    world.applyBegin([{ kind: "wake", bodyId: 1 }]);
    const resumed = advance(world, 4, 9_000);
    expect(resumed.stepCount).toBe(0);
    expect(resumed.accumulatorMilliseconds).toBe(0);
    expect(world.snapshot().bodies[0]!.flags & BODY_SLEEPING_3D).toBe(0);
  });

  it("wakes a complete sleeping island in identity order when solid topology is removed", () => {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: true,
    });
    const topology = collidingTopology();
    world.proposeTopology(topology);
    advance(world, 1, 0);
    advance(world, 2, 100);
    const first = world.bodyIdentity(1)!.index;
    const second = world.bodyIdentity(2)!.index;
    world.bodies.flags[first] |= BODY_SLEEPING_3D;
    world.bodies.flags[second] |= BODY_SLEEPING_3D;
    world.bodies.sleepTime[first] = 0.5;
    world.bodies.sleepTime[second] = 0.5;

    world.proposeTopology(
      topology.filter((record) => record.kind !== "collider" || record.id !== 20),
    );
    advance(world, 3, 100);

    expect(world.bodies.flags[first]! & BODY_SLEEPING_3D).toBe(0);
    expect(world.bodies.flags[second]! & BODY_SLEEPING_3D).toBe(0);
    expect(world.bodies.sleepTime[first]).toBe(0);
    expect(world.bodies.sleepTime[second]).toBe(0);
  });

  it("wakes sleeping dynamics when contacted static body topology moves", () => {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: true,
    });
    const dynamicBody = body(1);
    const staticBody = body(2, { x: 1.5, type: "static" });
    const dynamicCollider = collider(10, 1);
    const staticCollider = collider(20, 2);
    world.proposeTopology([
      dynamicBody,
      staticBody,
      dynamicCollider,
      staticCollider,
    ]);
    advance(world, 1, 0);
    advance(world, 2, 100);
    const dynamic = world.bodyIdentity(1)!.index;
    world.bodies.flags[dynamic] |= BODY_SLEEPING_3D;
    world.bodies.sleepTime[dynamic] = 0.5;

    world.proposeTopology([
      dynamicBody,
      body(2, { x: 2, type: "static" }),
      dynamicCollider,
      staticCollider,
    ]);
    advance(world, 3, 100);

    expect(world.bodies.flags[dynamic]! & BODY_SLEEPING_3D).toBe(0);
    expect(world.bodies.sleepTime[dynamic]).toBe(0);
  });

  it("wakes sleeping dynamics when new solid static topology overlaps them", () => {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: true,
    });
    const dynamicBody = body(1);
    const staticBody = body(2, { type: "static" });
    const dynamicCollider = collider(10, 1);
    const staticCollider = collider(20, 2);
    world.proposeTopology([dynamicBody, staticBody, dynamicCollider]);
    advance(world, 1, 0);
    advance(world, 2, 100);
    const dynamic = world.bodyIdentity(1)!.index;
    world.bodies.flags[dynamic] |= BODY_SLEEPING_3D;
    world.bodies.sleepTime[dynamic] = 0.5;

    world.proposeTopology([
      dynamicBody,
      staticBody,
      dynamicCollider,
      staticCollider,
    ]);
    advance(world, 3, 100);

    expect(world.bodies.flags[dynamic]! & BODY_SLEEPING_3D).toBe(0);
    expect(world.bodies.sleepTime[dynamic]).toBe(0);
  });

  it("routes force, impulse, and teleport wakeups through the complete solid island", () => {
    const commands = [
      {
        kind: "apply-force",
        bodyId: 2,
        forceX: 1,
        forceY: 0,
        forceZ: 0,
      },
      {
        kind: "apply-impulse",
        bodyId: 2,
        impulseX: 1,
        impulseY: 0,
        impulseZ: 0,
      },
      {
        kind: "set-pose",
        bodyId: 2,
        pose: {
          position: [1.5, 0, 0],
          orientation: [0, 0, 0, 1],
        },
      },
    ] as const satisfies readonly PhysicsCommand3D[];

    for (const command of commands) {
      const world = new PhysicsWorld3DKernel({
        fixedStepMilliseconds: 100,
        sleeping: true,
      });
      world.proposeTopology(collidingTopology());
      advance(world, 1, 0);
      advance(world, 2, 100);
      const first = world.bodyIdentity(1)!.index;
      const second = world.bodyIdentity(2)!.index;
      world.bodies.flags[first] |= BODY_SLEEPING_3D;
      world.bodies.flags[second] |= BODY_SLEEPING_3D;
      world.bodies.sleepTime[first] = 0.5;
      world.bodies.sleepTime[second] = 0.5;

      world.applyBegin([command]);
      advance(world, 3, 100);

      expect(world.bodies.flags[first]! & BODY_SLEEPING_3D).toBe(0);
      expect(world.bodies.flags[second]! & BODY_SLEEPING_3D).toBe(0);
      expect(world.bodies.sleepTime[first]).toBe(0);
      expect(world.bodies.sleepTime[second]).toBe(0);
    }
  });
});

describe("transactional 3D world candidate rollback", () => {
  const stages: readonly PhysicsWorld3DFailureStage[] = [
    "topology",
    "broad-phase",
    "narrow-phase",
    "velocity-solve",
    "position-solve",
    "ccd",
    "event-staging",
    "output",
  ];

  for (const stage of stages) {
    it(`restores exact values, references, ownership, and deterministic retry after ${stage}`, () => {
      const world = new PhysicsWorld3DKernel({
        fixedStepMilliseconds: 100,
        sleeping: false,
      });
      world.proposeTopology(collidingTopology());
      advance(world, 1, 0);
      advance(world, 2, 100);
      const expanded: PhysicsTopologyRecord3D[] = [...collidingTopology()];
      for (let index = 0; index < 12; index += 1) {
        expanded.push(body(100 + index, { x: 20 + index }));
        expanded.push(collider(200 + index, 100 + index));
      }
      const topologyBoundary = stage === "topology" || stage === "output";
      if (topologyBoundary) {
        world.proposeTopology(expanded);
      } else {
        world.proposeTopology(expanded);
        advance(world, 3, 200);
      }
      const before = world.snapshot();
      const owners = [
        world.bodies,
        world.colliders,
        world.broadPhase,
        world.contacts,
        world.solver,
        world.positionSolver,
        world.ccd,
      ] as const;
      const captured = owners.map(captureOwner);
      world.applyBegin([
        {
          kind: "apply-impulse",
          bodyId: 1,
          impulseX: 2,
          impulseY: 1,
          impulseZ: 0,
        },
      ]);
      const restore = installPhysicsWorld3DFailureInjectorForTest((current) => {
        if (current === stage) throw new Error(`injected ${stage}`);
      });
      try {
        expect(() =>
          world.advance({
            frameId: 4,
            logicalTime: topologyBoundary ? 200 : 300,
            stagedKinematicTargets: new Map(),
          }),
        ).toThrow(`injected ${stage}`);
      } finally {
        restore();
      }

      expect(world.snapshot()).toEqual(before);
      owners.forEach((owner, index) => {
        expectOwnerRestored(owner, captured[index]!);
      });

      const retry = advance(
        world,
        5,
        topologyBoundary ? 200 : 300,
      );
      expect(retry.tick).toBe(topologyBoundary ? 1 : 2);
      expect(world.snapshot()).toMatchObject({
        bodyCount: 14,
        colliderCount: 14,
      });
    });
  }

  it("adopts or discards one live candidate exactly once and exposes an explicit user-query lock while live", () => {
    const world = new PhysicsWorld3DKernel({ sleeping: false });
    world.proposeTopology([body(1)]);
    const before = world.snapshot();
    const discarded = world.advance({
      frameId: 1,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    });
    expect(world.authoritativePose(1)).toBeDefined();
    expect(world.presentationPose(1)).toBeDefined();
    expect(() => world.assertCommittedReadable()).toThrow(
      /uncommitted candidate/,
    );
    world.discard(discarded);
    expect(world.snapshot()).toEqual(before);
    expect(discarded.lifecycle).toBe("discarded");
    expect(() => world.discard(discarded)).toThrow(/live candidate/);

    const adopted = world.advance({
      frameId: 2,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    });
    world.adopt(adopted);
    expect(adopted.lifecycle).toBe("adopted");
    expect(world.snapshot().bodyCount).toBe(1);
    expect(() => world.adopt(adopted)).toThrow(/live candidate/);
    expect(() => world.discard(adopted)).toThrow(/live candidate/);
  });

  it("restores pre-candidate storage references and capacities after staged growth is discarded", () => {
    const world = new PhysicsWorld3DKernel({ sleeping: false });
    const owners = [
      world.bodies,
      world.colliders,
      world.broadPhase,
      world.contacts,
      world.solver,
      world.positionSolver,
      world.ccd,
    ] as const;
    const captured = owners.map(captureOwner);
    const topology: PhysicsTopologyRecord3D[] = [];
    for (let index = 0; index < 12; index += 1) {
      topology.push(body(index));
      topology.push(collider(100 + index, index));
    }
    world.proposeTopology(topology);

    const candidate = world.advance({
      frameId: 1,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    });
    expect(world.snapshot().bodyCount).toBe(12);
    world.discard(candidate);

    expect(world.snapshot()).toMatchObject({ bodyCount: 0, colliderCount: 0 });
    owners.forEach((owner, index) => {
      expectOwnerRestored(owner, captured[index]!);
    });
    advance(world, 2, 0);
    expect(world.snapshot()).toMatchObject({ bodyCount: 12, colliderCount: 12 });
  });

  it("preserves Begin commands staged after an older candidate without replaying sealed commands", () => {
    const world = new PhysicsWorld3DKernel({ sleeping: false });
    world.proposeTopology([body(1)]);
    advance(world, 1, 0);
    world.applyBegin([
      { kind: "apply-impulse", bodyId: 1, impulseX: 1, impulseY: 0, impulseZ: 0 },
    ]);
    const first = world.advance({
      frameId: 2,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    });
    world.applyBegin([
      { kind: "apply-impulse", bodyId: 1, impulseX: 2, impulseY: 0, impulseZ: 0 },
    ]);
    world.adopt(first);
    advance(world, 3, 0);
    expect(world.snapshot().bodies[0]!.linearVelocityX).toBe(3);
  });

  it("carries only the newly staged numeric event range on each candidate", () => {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    world.proposeTopology(collidingTopology());
    expect(advance(world, 1, 0).eventCount).toBe(0);
    const contacted = advance(world, 2, 100);
    expect(contacted.eventCount).toBe(1);
    expect(contacted.eventKinds[contacted.eventOffset]).toBe(1);
    expect(contacted.eventTicks[contacted.eventOffset]).toBe(1);
    expect(advance(world, 3, 200).eventCount).toBe(0);
  });

  it("balances all world-owned resources after discard and disposal", () => {
    const world = new PhysicsWorld3DKernel({ sleeping: false });
    world.proposeTopology(collidingTopology());
    const candidate = world.advance({
      frameId: 1,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    });
    world.discard(candidate);
    expect(world.counters.liveBodies).toBe(0);
    expect(world.counters.liveColliders).toBe(0);
    expect(world.counters.liveProxies).toBe(0);

    world.proposeTopology(collidingTopology());
    advance(world, 2, 0);
    world.dispose();
    expect(world.counters).toMatchObject({
      liveBodyStores: 0,
      liveColliderStores: 0,
      liveBroadPhases: 0,
      liveContactCaches: 0,
      liveSolvers: 0,
      liveBodies: 0,
      liveColliders: 0,
      liveProxies: 0,
      liveContacts: 0,
    });
  });
});

describe("deterministic 3D world replay and bounded long-run state", () => {
  function runReplay(ticks: number) {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 1000 / 60,
      sleeping: false,
    });
    world.proposeTopology([
      body(1, { x: -4, velocityX: 0.01, angularVelocityZDegrees: 0.25 }),
      body(2, { x: 20, type: "static" }),
      collider(10, 1, sphereShape3D({ radius: 0.5 })),
      collider(20, 2, boxShape3D({ width: 2, height: 2, depth: 2 })),
    ]);
    advance(world, 1, 0);
    for (let tick = 1; tick <= ticks; tick += 1) {
      advance(world, tick + 1, (tick * 1000) / 60);
    }
    return world.snapshot();
  }

  it("replays 10,000 sphere/box ticks with exact identities and tolerance-equal numerics", () => {
    const first = runReplay(10_000);
    const second = runReplay(10_000);
    expect(first.tick).toBe(10_000);
    expect(second.tick).toBe(10_000);
    expect(first.bodies.map(({ id, index, generation, flags }) => ({
      id,
      index,
      generation,
      flags,
    }))).toEqual(second.bodies.map(({ id, index, generation, flags }) => ({
      id,
      index,
      generation,
      flags,
    })));
    for (let index = 0; index < first.bodies.length; index += 1) {
      const a = first.bodies[index]!;
      const b = second.bodies[index]!;
      for (const key of [
        "positionX",
        "positionY",
        "positionZ",
        "orientationX",
        "orientationY",
        "orientationZ",
        "orientationW",
        "linearVelocityX",
        "linearVelocityY",
        "linearVelocityZ",
        "angularVelocityX",
        "angularVelocityY",
        "angularVelocityZ",
      ] as const) {
        expect(a[key]).toBeCloseTo(b[key], 14);
      }
    }
  }, 20_000);

  it("keeps a 100,000-tick bounded container finite with normalized quaternions and finite tensors/AABBs", () => {
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 1000 / 60,
      sleeping: false,
    });
    world.proposeTopology([
      body(1, { velocityX: 0.001, angularVelocityZDegrees: 0.01 }),
      body(2, { x: -9.5, type: "static" }),
      body(3, { x: 9.5, type: "static" }),
      body(4, { y: -9.5, type: "static" }),
      body(5, { y: 9.5, type: "static" }),
      body(6, { z: -9.5, type: "static" }),
      body(7, { z: 9.5, type: "static" }),
      collider(10, 1, sphereShape3D({ radius: 0.5 })),
      collider(20, 2, boxShape3D({ width: 1, height: 20, depth: 20 })),
      collider(30, 3, boxShape3D({ width: 1, height: 20, depth: 20 })),
      collider(40, 4, boxShape3D({ width: 20, height: 1, depth: 20 })),
      collider(50, 5, boxShape3D({ width: 20, height: 1, depth: 20 })),
      collider(60, 6, boxShape3D({ width: 20, height: 20, depth: 1 })),
      collider(70, 7, boxShape3D({ width: 20, height: 20, depth: 1 })),
    ]);
    advance(world, 1, 0);
    for (let tick = 1; tick <= 100_000; tick += 1) {
      advance(world, tick + 1, (tick * 1000) / 60);
    }

    const snapshot = world.snapshot();
    expect(snapshot.tick).toBe(100_000);
    expect(Number.isFinite(snapshot.accumulatorMilliseconds)).toBe(true);
    expect(snapshot.accumulatorMilliseconds).toBeGreaterThanOrEqual(0);
    expect(snapshot.accumulatorMilliseconds).toBeLessThan(1000 / 60);
    for (const record of snapshot.bodies) {
      const numeric = Object.values(record).filter(
        (value): value is number => typeof value === "number",
      );
      expect(numeric.every(Number.isFinite)).toBe(true);
      expect(
        Math.hypot(
          record.orientationX,
          record.orientationY,
          record.orientationZ,
          record.orientationW,
        ),
      ).toBeCloseTo(1, 12);
      expect(Math.abs(record.positionX)).toBeLessThanOrEqual(10);
      expect(Math.abs(record.positionY)).toBeLessThanOrEqual(10);
      expect(Math.abs(record.positionZ)).toBeLessThanOrEqual(10);
    }
    for (const owner of [world.bodies, world.broadPhase]) {
      for (const key of Reflect.ownKeys(owner)) {
        const value = Reflect.get(owner, key) as unknown;
        if (value instanceof Float64Array) {
          expect(Array.from(value).every(Number.isFinite)).toBe(true);
        }
      }
    }
    for (let node = 0; node < world.broadPhase.nodeCapacity; node += 1) {
      if (world.broadPhase.nodeActive[node] === 0) continue;
      for (const value of [
        world.broadPhase.nodeMinX[node]!,
        world.broadPhase.nodeMinY[node]!,
        world.broadPhase.nodeMinZ[node]!,
        world.broadPhase.nodeMaxX[node]!,
        world.broadPhase.nodeMaxY[node]!,
        world.broadPhase.nodeMaxZ[node]!,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThanOrEqual(10.2);
      }
    }
  }, 30_000);
});

describe("source-only 3D world tracing", () => {
  it("self-disables a throwing collector without changing simulation results", () => {
    const traced = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    const control = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    traced.proposeTopology([body(1, { velocityX: 2 })]);
    control.proposeTopology([body(1, { velocityX: 2 })]);
    let calls = 0;
    const restore = installPhysicsWorld3DTraceCollectorForTest(() => {
      calls += 1;
      throw new Error("trace failed");
    });
    try {
      advance(traced, 1, 0);
      advance(traced, 2, 500);
      advance(control, 1, 0);
      advance(control, 2, 500);
    } finally {
      restore();
    }
    expect(calls).toBe(1);
    expect(traced.snapshot()).toEqual(control.snapshot());
  });

  it("records the exact rollback failure phase without retaining a history", () => {
    const records: unknown[] = [];
    const restoreTrace = installPhysicsWorld3DTraceCollectorForTest((record) => {
      records.push(record);
    });
    const world = new PhysicsWorld3DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    world.proposeTopology([body(1, { velocityX: 1 })]);
    advance(world, 1, 0);
    const before = world.snapshot();
    const restoreFailure = installPhysicsWorld3DFailureInjectorForTest(
      (stage) => {
        if (stage === "ccd") throw new Error("ccd fault");
      },
    );
    try {
      expect(() =>
        world.advance({
          frameId: 2,
          logicalTime: 100,
          stagedKinematicTargets: new Map(),
        }),
      ).toThrow("ccd fault");
    } finally {
      restoreFailure();
      restoreTrace();
    }
    expect(world.snapshot()).toEqual(before);
    expect(
      records.find(
        (record) => (record as { kind?: string }).kind === "physics-3d-error",
      ),
    ).toMatchObject({ kind: "physics-3d-error", stage: "ccd" });
  });
});
