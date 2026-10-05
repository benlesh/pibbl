import { describe, expect, it } from "vitest";
import { boxShape2D, circleShape2D } from "../../../2d-geometry.js";
import { requireShapeRecord2D } from "../shape-records.js";
import { RapierSimulation2D, liveRapierWorldsForTest } from "./rapier.js";
import {
  PhysicsWorld2DKernel,
  installPhysicsWorld2DFailureInjectorForTest,
  type PhysicsTopologyRecord2D,
} from "./world.js";

function ball(
  id: number,
  x: number,
  velocity: number,
): PhysicsTopologyRecord2D[] {
  return [
    {
      kind: "body",
      id,
      definition: {
        positionX: x,
        positionY: 0,
        rotationRadians: 0,
        linearVelocityX: velocity,
        linearVelocityY: 0,
        angularVelocity: 0,
        forceX: 0,
        forceY: 0,
        torque: 0,
        inverseMass: 1,
        inverseInertia: 0.08,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 1,
        sleepTime: 0,
        flags: 1 | 32,
        owner: null,
      },
    },
    {
      kind: "collider",
      id: id + 10,
      bodyId: id,
      definition: {
        shape: requireShapeRecord2D(circleShape2D({ radius: 5 })),
        material: { friction: 0, restitution: 1 },
        filter: null,
        tag: null,
        handlers: null,
        owner: null,
        flags: 0,
      },
    },
  ];
}
function world(records: PhysicsTopologyRecord2D[]) {
  const world = new PhysicsWorld2DKernel(
    { gravity: [0, 0], fixedStepMilliseconds: 1000 / 60 },
    new RapierSimulation2D(),
  );
  world.proposeTopology(records);
  tick(world, 0);
  return world;
}
function tick(world: PhysicsWorld2DKernel, index: number) {
  const candidate = world.advance({
    frameId: index,
    logicalTime: (index * 1000) / 60,
    stagedKinematicTargets: new Map(),
  });
  world.adopt(candidate!);
}

describe("Rapier integration contracts", () => {
  it("restores the engine and Pibbl state when an advanced candidate fails, then replays exactly", () => {
    const baseline = world(ball(1, 0, 100)),
      replayed = world(ball(1, 0, 100));
    try {
      tick(baseline, 1);
      const before = replayed.snapshot();
      const release = installPhysicsWorld2DFailureInjectorForTest((stage) => {
        if (stage === "position-solve") throw new Error("injected");
      });
      try {
        expect(() => tick(replayed, 1)).toThrow("injected");
      } finally {
        release();
      }
      expect(replayed.snapshot()).toEqual(before);
      tick(replayed, 1);
      expect(replayed.snapshot().bodies).toEqual(baseline.snapshot().bodies);
      for (let i = 2; i <= 10; i++) {
        tick(baseline, i);
        tick(replayed, i);
      }
      expect(replayed.snapshot().bodies).toEqual(baseline.snapshot().bodies);
    } finally {
      baseline.dispose();
      replayed.dispose();
    }
  });
  it("resolves two opposing fast dynamic bodies without letting them exchange sides", () => {
    const simulation = world([...ball(1, -20, 5000), ...ball(2, 20, -5000)]);
    try {
      tick(simulation, 1);
      tick(simulation, 2);
      const [a, b] = simulation.snapshot().bodies;
      expect(a!.positionX).toBeLessThan(b!.positionX);
      expect(a!.linearVelocityX).toBeLessThan(0);
      expect(b!.linearVelocityX).toBeGreaterThan(0);
    } finally {
      simulation.dispose();
    }
  });
  it("converts force and torque without changing the public logical units", () => {
    const simulation = world(ball(1, 0, 0));
    try {
      simulation.applyBegin([
        { kind: "apply-force", bodyId: 1, forceX: 60, forceY: 0 },
        { kind: "apply-torque", bodyId: 1, torque: 30 },
      ]);
      tick(simulation, 1);
      const body = simulation.snapshot().bodies[0]!;
      expect(body.linearVelocityX).toBeCloseTo(1, 5);
      expect(body.angularVelocity).toBeCloseTo(0.04, 5);
    } finally {
      simulation.dispose();
    }
  });
});

it("rolls back excessive CCD work instead of silently tunneling or hanging", () => {
  const simulation = world(ball(1, 0, 100000));
  try {
    const before = simulation.snapshot();
    expect(() => tick(simulation, 1)).toThrow(/CCD requires/);
    expect(simulation.snapshot()).toEqual(before);
  } finally {
    simulation.dispose();
  }
});

it("includes acceleration in the CCD work bound", () => {
  const simulation = world(ball(1, 0, 0));
  try {
    simulation.applyBegin([
      { kind: "apply-force", bodyId: 1, forceX: 6000000, forceY: 0 },
    ]);
    const before = simulation.snapshot();
    expect(() => tick(simulation, 1)).toThrow(/CCD requires/);
    expect(simulation.snapshot()).toEqual(before);
  } finally {
    simulation.dispose();
  }
});

it("includes the body center of mass in the CCD angular-work bound", () => {
  const records = ball(1, 0, 0);
  const body = records[0] as Extract<
    PhysicsTopologyRecord2D,
    { kind: "body" }
  >;
  const collider = records[1] as Extract<
    PhysicsTopologyRecord2D,
    { kind: "collider" }
  >;
  body.definition = {
    ...body.definition,
    localCenterX: 100,
    localCenterY: -100,
    angularVelocity: 10,
  };
  collider.definition = {
    ...collider.definition,
    shape: requireShapeRecord2D(boxShape2D({ width: 1, height: 1 })),
  };
  const simulation = world(records);
  try {
    const before = simulation.snapshot();
    expect(() => tick(simulation, 1)).toThrow(/CCD requires/);
    expect(simulation.snapshot()).toEqual(before);
  } finally {
    simulation.dispose();
  }
});

it.each([false, true])(
  "keeps bodies awake when sleeping is disabled (world=%s)",
  (worldSetting) => {
    const records = ball(1, 0, 0);
    if (!worldSetting)
      (
        records[0] as Extract<PhysicsTopologyRecord2D, { kind: "body" }>
      ).definition.flags |= 8 | 16;
    const simulation = new PhysicsWorld2DKernel(
      { gravity: [0, 0], sleeping: !worldSetting },
      new RapierSimulation2D(),
    );
    try {
      simulation.proposeTopology(records);
      tick(simulation, 0);
      for (let i = 1; i <= 300; i++) tick(simulation, i);
      expect(simulation.snapshot().bodies[0]!.flags & 16).toBe(0);
    } finally {
      simulation.dispose();
    }
  },
);

it("rejects nonrepresentable engine coordinates and restores the transaction", () => {
  const simulation = world(ball(1, 0, 0));
  try {
    simulation.applyBegin([
      {
        kind: "set-pose",
        bodyId: 1,
        pose: { position: [1e100, 0], rotationDegrees: 0 },
      },
    ]);
    const before = simulation.snapshot();
    expect(() => tick(simulation, 1)).toThrow(/cannot be represented/);
    expect(simulation.snapshot()).toEqual(before);
  } finally {
    simulation.dispose();
  }
});

it("spreads a kinematic frame target over all accepted catch-up ticks", () => {
  const records = ball(1, 0, 0);
  (
    records[0] as Extract<PhysicsTopologyRecord2D, { kind: "body" }>
  ).definition.flags = 2;
  const simulation = world(records);
  const velocities: number[] = [];
  const release = installPhysicsWorld2DFailureInjectorForTest((stage) => {
    if (stage === "position-solve")
      velocities.push(simulation.snapshot().bodies[0]!.linearVelocityX);
  });
  try {
    simulation.adopt(
      simulation.advance({
        frameId: 1,
        logicalTime: 1000 / 30,
        stagedKinematicTargets: new Map([
          [1, { position: [10, 0], rotationDegrees: 0 }],
        ]),
      })!,
    );
    expect(velocities).toHaveLength(2);
    for (const velocity of velocities) expect(velocity).toBeCloseTo(300, 4);
  } finally {
    release();
    simulation.dispose();
  }
});

it("publishes a fast impact even when bodies separate again within the fixed tick", () => {
  const simulation = world([...ball(1, -20, 5000), ...ball(2, 20, -5000)]);
  try {
    tick(simulation, 1);
    expect(simulation.contacts.contactCount).toBe(1);
    expect(simulation.contacts.pointNormalImpulses[0]).toBeGreaterThan(0);
    tick(simulation, 2);
    expect(simulation.contacts.contactCount).toBe(0);
  } finally {
    simulation.dispose();
  }
});

it("releases every owned engine world after repeated rollback and disposal", () => {
  const before = liveRapierWorldsForTest();
  for (let i = 0; i < 25; i++) {
    const simulation = world(ball(1, 0, 100));
    tick(simulation, 1);
    const release = installPhysicsWorld2DFailureInjectorForTest((stage) => {
      if (stage === "position-solve") throw new Error("rollback");
    });
    try {
      expect(() => tick(simulation, 2)).toThrow("rollback");
    } finally {
      release();
      simulation.dispose();
      simulation.dispose();
    }
  }
  expect(liveRapierWorldsForTest()).toBe(before);
});
