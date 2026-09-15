import { describe, expect, it } from "vitest";
import { circleShape2D } from "../../../2d-geometry.js";
import { requireShapeRecord2D } from "../shape-records.js";
import { installPhysicsWorld2DTraceCollectorForTest } from "../runtime/trace.js";
import {
  installPhysicsWorld2DFailureInjectorForTest,
  normalizePhysicsWorld2DConfiguration,
  PhysicsWorld2DKernel,
  type PhysicsWorld2DFailureStage,
  type PhysicsTopologyRecord2D,
  type PhysicsWorld2DCandidate,
} from "./world.js";

function movingBody(
  id: number,
  options: Readonly<{
    x?: number;
    velocityX?: number;
    rotationDegrees?: number;
    angularVelocityDegrees?: number;
    localCenterX?: number;
    localCenterY?: number;
  }> = {},
): PhysicsTopologyRecord2D {
  const rotationRadians = ((options.rotationDegrees ?? 0) * Math.PI) / 180;
  const localCenterX = options.localCenterX ?? 0;
  const localCenterY = options.localCenterY ?? 0;
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  return {
    kind: "body",
    id,
    definition: {
      positionX:
        (options.x ?? 0) + cosine * localCenterX - sine * localCenterY,
      positionY: sine * localCenterX + cosine * localCenterY,
      rotationRadians,
      localCenterX,
      localCenterY,
      linearVelocityX: options.velocityX ?? 0,
      linearVelocityY: 0,
      angularVelocity: ((options.angularVelocityDegrees ?? 0) * Math.PI) / 180,
      forceX: 0,
      forceY: 0,
      torque: 0,
      inverseMass: 1,
      inverseInertia: 1,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 0,
      sleepTime: 0,
      flags: 1,
      owner: null,
    },
  };
}

function advance(
  world: PhysicsWorld2DKernel,
  frameId: number,
  logicalTime: number,
): PhysicsWorld2DCandidate {
  const candidate = world.advance({
    frameId,
    logicalTime,
    stagedKinematicTargets: new Map(),
  });
  expect(candidate).toBeDefined();
  world.adopt(candidate!);
  return candidate!;
}

function collider(
  id: number,
  bodyId: number,
  radius = 1,
): PhysicsTopologyRecord2D {
  return {
    kind: "collider",
    id,
    bodyId,
    definition: {
      shape: requireShapeRecord2D(circleShape2D({ radius })),
      material: { friction: 0.5, restitution: 0 },
      filter: null,
      tag: null,
      handlers: null,
      owner: null,
      flags: 0,
    },
  };
}

function collidingTopology(): readonly PhysicsTopologyRecord2D[] {
  return [
    movingBody(1, { x: 0, velocityX: 0.25 }),
    movingBody(2, { x: 1.5, velocityX: -0.25 }),
    collider(10, 1),
    collider(20, 2),
  ];
}

describe("transactional fixed-tick 2D world cadence", () => {
  it("runs zero, one, and three complete ticks while retaining a presentation remainder", () => {
    const world = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    world.proposeTopology([movingBody(7, { velocityX: 1 })]);

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

  it("produces identical authoritative state for equivalent accepted ticks grouped into different frames", () => {
    const grouped = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      maxCatchUpSteps: 4,
      sleeping: false,
    });
    const split = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      maxCatchUpSteps: 4,
      sleeping: false,
    });
    grouped.proposeTopology([movingBody(1, { velocityX: 3 })]);
    split.proposeTopology([movingBody(1, { velocityX: 3 })]);

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

  it("runs exactly four ticks for a long stall, traces discarded time once, and retains no backlog", () => {
    const traces: unknown[] = [];
    const restore = installPhysicsWorld2DTraceCollectorForTest((record) => {
      traces.push(record);
    });
    try {
      const world = new PhysicsWorld2DKernel({
        fixedStepMilliseconds: 100,
        maxCatchUpSteps: 4,
        sleeping: false,
      });
      world.proposeTopology([movingBody(1, { velocityX: 1 })]);
      advance(world, 1, 0);

      expect(advance(world, 2, 1_000)).toMatchObject({
        stepCount: 4,
        tick: 4,
        accumulatorMilliseconds: 0,
      });
      expect(world.authoritativePose(1).position[0]).toBeCloseTo(0.4, 12);
      expect(
        traces.filter(
          (record) => (record as { kind?: string }).kind === "physics-2d-clamp",
        ),
      ).toEqual([
        {
          kind: "physics-2d-clamp",
          frameId: 2,
          logicalTime: 1_000,
          acceptedElapsedMilliseconds: 400,
          discardedElapsedMilliseconds: 600,
        },
      ]);

      expect(advance(world, 3, 1_000)).toMatchObject({
        stepCount: 0,
        tick: 4,
        accumulatorMilliseconds: 0,
      });
      expect(world.authoritativePose(1).position[0]).toBeCloseTo(0.4, 12);
    } finally {
      restore();
    }
  });

  it("interpolates the shortest degree path and chooses positive rotation for an exact 180-degree tie", () => {
    const shortest = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 1_000,
      sleeping: false,
    });
    shortest.proposeTopology([
      movingBody(1, {
        rotationDegrees: 170,
        angularVelocityDegrees: 20,
      }),
    ]);
    advance(shortest, 1, 0);
    advance(shortest, 2, 1_500);
    expect(shortest.authoritativePose(1).rotationDegrees).toBeCloseTo(190, 12);
    expect(shortest.presentationPose(1).rotationDegrees).toBeCloseTo(180, 12);

    const tie = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 1_000,
      sleeping: false,
    });
    tie.proposeTopology([
      movingBody(1, {
        angularVelocityDegrees: -180,
      }),
    ]);
    advance(tie, 1, 0);
    advance(tie, 2, 1_500);
    expect(tie.authoritativePose(1).rotationDegrees).toBeCloseTo(-180, 12);
    expect(tie.presentationPose(1).rotationDegrees).toBeCloseTo(90, 12);
  });

  it("projects interpolation and teleports through an off-origin center of mass", () => {
    const world = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 1_000,
      sleeping: false,
    });
    world.proposeTopology([
      movingBody(1, {
        angularVelocityDegrees: 90,
        localCenterX: 2,
      }),
    ]);
    advance(world, 1, 0);
    advance(world, 2, 1_500);

    const authoritative = world.authoritativePose(1);
    expect(authoritative.position[0]).toBeCloseTo(2, 12);
    expect(authoritative.position[1]).toBeCloseTo(-2, 12);
    expect(authoritative.rotationDegrees).toBeCloseTo(90, 12);
    const interpolated = world.presentationPose(1);
    expect(interpolated.position[0]).toBeCloseTo(2 - Math.SQRT2, 12);
    expect(interpolated.position[1]).toBeCloseTo(-Math.SQRT2, 12);
    expect(interpolated.rotationDegrees).toBeCloseTo(45, 12);

    world.applyBegin([
      {
        kind: "set-pose",
        bodyId: 1,
        pose: { position: [7, 8], rotationDegrees: 90 },
      },
    ]);
    advance(world, 3, 1_500);
    const teleported = world.authoritativePose(1);
    expect(teleported.position[0]).toBeCloseTo(7, 12);
    expect(teleported.position[1]).toBeCloseTo(8, 12);
    expect(teleported.rotationDegrees).toBeCloseTo(90, 12);
  });

  it('returns the current authoritative pose when interpolation is "none"', () => {
    const world = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      interpolation: "none",
      sleeping: false,
    });
    world.proposeTopology([movingBody(1, { velocityX: 1 })]);
    advance(world, 1, 0);
    advance(world, 2, 150);

    expect(world.presentationPose(1)).toEqual(world.authoritativePose(1));
  });
});

describe("normalized 2D world configuration and topology admission", () => {
  it("normalizes documented defaults and nested solver options into one frozen record", () => {
    expect(normalizePhysicsWorld2DConfiguration({})).toEqual({
      gravityX: 0,
      gravityY: 0,
      fixedStepMilliseconds: 1000 / 60,
      maxCatchUpSteps: 4,
      interpolation: "linear",
      sleeping: true,
      velocityIterations: 8,
      positionIterations: 3,
    });
    const configured = normalizePhysicsWorld2DConfiguration({
      gravity: [3, 4],
      solver: { velocityIterations: 12, positionIterations: 6 },
    });
    expect(configured).toMatchObject({
      gravityX: 3,
      gravityY: 4,
      velocityIterations: 12,
      positionIterations: 6,
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
    expect(() => normalizePhysicsWorld2DConfiguration(configuration)).toThrow(
      RangeError,
    );
  });

  it("admits topology only during advance and retains storage identities for an equivalent proposal", () => {
    const world = new PhysicsWorld2DKernel({ sleeping: false });
    const topology = [movingBody(1), collider(10, 1)] as const;
    world.proposeTopology(topology);
    expect(world.snapshot().bodyCount).toBe(0);
    advance(world, 1, 0);
    const first = world.snapshot();

    world.proposeTopology(topology);
    advance(world, 2, 0);
    const second = world.snapshot();

    expect(second.bodies[0]!.generation).toBe(first.bodies[0]!.generation);
    expect(second.counters.bodyAllocations).toBe(
      first.counters.bodyAllocations,
    );
    expect(second.counters.colliderAllocations).toBe(
      first.counters.colliderAllocations,
    );
    expect(second.counters.proxyAllocations).toBe(
      first.counters.proxyAllocations,
    );
  });

  it("preserves dynamic pose and velocity when automatic mass properties change", () => {
    const world = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    const body = (localCenterX: number): PhysicsTopologyRecord2D => ({
      kind: "body",
      id: 1,
      definition: {
        positionX: localCenterX,
        positionY: 0,
        rotationRadians: 0,
        localCenterX,
        localCenterY: 0,
        linearVelocityX: 1,
        linearVelocityY: 0,
        angularVelocity: 0,
        forceX: 0,
        forceY: 0,
        torque: 0,
        inverseMass: 1,
        inverseInertia: 1,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 0,
        sleepTime: 0,
        flags: 1,
        owner: null,
      },
    });

    world.proposeTopology([body(5)]);
    advance(world, 1, 0);
    advance(world, 2, 100);
    expect(world.authoritativePose(1).position[0]).toBeCloseTo(0.1, 12);

    world.proposeTopology([body(10)]);
    advance(world, 3, 200);

    expect(world.authoritativePose(1).position[0]).toBeCloseTo(0.2, 12);
    expect(world.snapshot().bodies[0]!.linearVelocityX).toBe(1);
  });

  it("retains imperative disablement while mass properties change", () => {
    const world = new PhysicsWorld2DKernel({ sleeping: false });
    const initial = movingBody(1, { velocityX: 3 });
    world.proposeTopology([initial, collider(10, 1, 1)]);
    advance(world, 1, 0);

    world.applyBegin([{ kind: "disable", bodyId: 1 }]);
    advance(world, 2, 0);
    expect(world.isBodyEnabled(1)).toBe(false);
    expect(world.snapshot().colliderCount).toBe(0);

    const changed = movingBody(1, {
      velocityX: 99,
      localCenterX: 2,
    });
    world.proposeTopology([changed, collider(10, 1, 2)]);
    advance(world, 3, 0);
    expect(world.isBodyEnabled(1)).toBe(false);
    expect(world.snapshot().colliderCount).toBe(0);

    world.applyBegin([
      { kind: "enable", bodyId: 1, velocity: "preserve" },
    ]);
    advance(world, 4, 0);
    expect(world.isBodyEnabled(1)).toBe(true);
    expect(world.snapshot().colliderCount).toBe(1);
    expect(world.authoritativePose(1).position[0]).toBe(0);
    expect(world.snapshot().bodies[0]!.linearVelocityX).toBe(3);
    expect(world.snapshot().bodies[0]!.localCenterX).toBe(2);
  });
});

describe("transactional fixed-tick 2D world rollback", () => {
  const stages: readonly PhysicsWorld2DFailureStage[] = [
    "topology",
    "broad-phase",
    "narrow-phase",
    "velocity-solve",
    "position-solve",
    "ccd",
    "event-staging",
  ];

  for (const stage of stages) {
    it(`restores the exact committed generation after an injected ${stage} failure`, () => {
      const world = new PhysicsWorld2DKernel({
        fixedStepMilliseconds: 100,
        sleeping: false,
      });
      const topology = collidingTopology();
      world.proposeTopology(topology);
      advance(world, 1, 0);
      advance(world, 2, 100);
      expect(world.snapshot().contactCount).toBe(1);

      const before = world.snapshot();
      const references = {
        bodyPositionX: world.bodies.positionX,
        colliderBodies: world.colliders.bodyIndices,
        proxyNodes: world.broadPhase.proxyNodes,
        treeParents: world.broadPhase.nodeParents,
        contactFirst: world.contacts.firstColliderIndices,
        contactEvents: world.contacts.eventTypes,
      };
      world.proposeTopology(topology);
      world.applyBegin([
        {
          kind: "apply-impulse",
          bodyId: 1,
          impulseX: 2,
          impulseY: 0,
          pointX: 0,
          pointY: 0,
        },
      ]);
      const restore = installPhysicsWorld2DFailureInjectorForTest((current) => {
        if (current === stage) throw new Error(`injected ${stage}`);
      });
      try {
        expect(() =>
          world.advance({
            frameId: 3,
            logicalTime: 200,
            stagedKinematicTargets: new Map(),
          }),
        ).toThrow(`injected ${stage}`);
      } finally {
        restore();
      }

      expect(world.snapshot()).toEqual(before);
      expect(world.bodies.positionX).toBe(references.bodyPositionX);
      expect(world.colliders.bodyIndices).toBe(references.colliderBodies);
      expect(world.broadPhase.proxyNodes).toBe(references.proxyNodes);
      expect(world.broadPhase.nodeParents).toBe(references.treeParents);
      expect(world.contacts.firstColliderIndices).toBe(references.contactFirst);
      expect(world.contacts.eventTypes).toBe(references.contactEvents);

      const retry = advance(world, 4, 200);
      expect(retry.tick).toBe(2);
      expect(world.snapshot().contactCount).toBe(1);
    });
  }

  it("places the velocity failure boundary before positional correction", () => {
    const world = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    world.proposeTopology(collidingTopology());
    advance(world, 1, 0);
    let velocityBoundaryPositions: readonly [number, number] | undefined;
    const restore = installPhysicsWorld2DFailureInjectorForTest((stage) => {
      if (stage !== "velocity-solve") return;
      const snapshot = world.snapshot();
      velocityBoundaryPositions = [
        snapshot.bodies[0]!.positionX,
        snapshot.bodies[1]!.positionX,
      ];
      throw new Error("stop after velocity solve");
    });
    try {
      expect(() =>
        world.advance({
          frameId: 2,
          logicalTime: 100,
          stagedKinematicTargets: new Map(),
        }),
      ).toThrow("stop after velocity solve");
    } finally {
      restore();
    }

    expect(velocityBoundaryPositions![0]).toBeCloseTo(0.025, 12);
    expect(velocityBoundaryPositions![1]).toBeCloseTo(1.475, 12);
  });

  it("adopts or discards one live candidate exactly once", () => {
    const world = new PhysicsWorld2DKernel({ sleeping: false });
    world.proposeTopology([movingBody(1)]);
    const before = world.snapshot();
    const discarded = world.advance({
      frameId: 1,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    })!;
    world.discard(discarded);
    expect(world.snapshot()).toEqual(before);
    expect(() => world.discard(discarded)).toThrow(/live candidate/);

    const adopted = world.advance({
      frameId: 2,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    })!;
    world.adopt(adopted);
    expect(world.snapshot().bodyCount).toBe(1);
    expect(() => world.adopt(adopted)).toThrow(/live candidate/);
    expect(() => world.discard(adopted)).toThrow(/live candidate/);
  });

  it("preserves later Begin commands without replaying commands already sealed by an older candidate", () => {
    const world = new PhysicsWorld2DKernel({ sleeping: false });
    world.proposeTopology([movingBody(1)]);
    advance(world, 1, 0);
    world.applyBegin([
      {
        kind: "apply-impulse",
        bodyId: 1,
        impulseX: 1,
        impulseY: 0,
        pointX: 0,
        pointY: 0,
      },
    ]);
    const first = world.advance({
      frameId: 2,
      logicalTime: 0,
      stagedKinematicTargets: new Map(),
    })!;
    world.applyBegin([
      {
        kind: "apply-impulse",
        bodyId: 1,
        impulseX: 2,
        impulseY: 0,
        pointX: 0,
        pointY: 0,
      },
    ]);
    world.adopt(first);
    advance(world, 3, 0);

    expect(world.snapshot().bodies[0]!.linearVelocityX).toBe(3);
  });

  it("carries only the newly staged numeric event range with its candidate", () => {
    const world = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    world.proposeTopology(collidingTopology());
    const anchored = advance(world, 1, 0);
    expect(anchored.eventCount).toBe(0);

    const contacted = advance(world, 2, 100);
    expect(contacted.eventCount).toBe(1);
    expect(contacted.eventKinds[contacted.eventOffset]).toBe(1);
    expect(contacted.eventTicks[contacted.eventOffset]).toBe(1);

    const steady = advance(world, 3, 200);
    expect(steady.eventCount).toBe(0);
  });

  it("wakes through Begin admission and reanchors without simulating inactive time", () => {
    const world = new PhysicsWorld2DKernel({ fixedStepMilliseconds: 100 });
    world.proposeTopology([movingBody(1)]);
    advance(world, 1, 0);
    advance(world, 2, 400);
    advance(world, 3, 500);
    expect(world.snapshot().bodies[0]!.flags & (1 << 4)).not.toBe(0);

    world.applyBegin([{ kind: "wake", bodyId: 1 }]);
    const resumed = advance(world, 4, 1_000);

    expect(resumed.stepCount).toBe(0);
    expect(resumed.accumulatorMilliseconds).toBe(0);
    expect(world.snapshot().bodies[0]!.flags & (1 << 4)).toBe(0);
  });
});

describe("source-only world tracing", () => {
  it("self-disables a throwing collector without changing simulation results", () => {
    const traced = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    const control = new PhysicsWorld2DKernel({
      fixedStepMilliseconds: 100,
      sleeping: false,
    });
    traced.proposeTopology([movingBody(1, { velocityX: 2 })]);
    control.proposeTopology([movingBody(1, { velocityX: 2 })]);
    let calls = 0;
    const restore = installPhysicsWorld2DTraceCollectorForTest(() => {
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
});
