import { describe, expect, it } from "vitest";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import {
  BODY_FIXED_ROTATION_2D,
  BODY_TYPE_DYNAMIC_2D,
  BODY_TYPE_KINEMATIC_2D,
  applyForceAtPointToCandidateBody2D,
  applyImpulseAtPointToCandidateBody2D,
  applyTorqueToCandidateBody2D,
  integrateCandidateBodies2D,
} from "./integrator.js";
import { BodyStore2D, type BodyDefinition2D } from "./storage.js";

function createBody(
  overrides: Partial<BodyDefinition2D> = {},
): { bodies: BodyStore2D; index: number; generation: number } {
  const bodies = new BodyStore2D(createPhysicsOwnershipCounters2D());
  const index = bodies.allocate({
    positionX: 0,
    positionY: 0,
    rotationRadians: 0,
    linearVelocityX: 0,
    linearVelocityY: 0,
    angularVelocity: 0,
    forceX: 0,
    forceY: 0,
    torque: 0,
    inverseMass: 1,
    inverseInertia: 1,
    linearDamping: 0,
    angularDamping: 0,
    gravityScale: 1,
    sleepTime: 0,
    flags: BODY_TYPE_DYNAMIC_2D,
    owner: {},
    ...overrides,
  });
  return { bodies, index, generation: bodies.generations[index]! };
}

function integrateOne(
  bodies: BodyStore2D,
  index: number,
  gravityX: number,
  gravityY: number,
  dt: number,
): void {
  integrateCandidateBodies2D(
    bodies,
    new Int32Array([index]),
    1,
    gravityX,
    gravityY,
    dt,
  );
}

describe("candidate 2D body integration", () => {
  it("updates velocity before pose and clears accepted forces", () => {
    const { bodies, index, generation } = createBody();
    expect(
      applyForceAtPointToCandidateBody2D(
        bodies,
        index,
        generation,
        20,
        0,
        0,
        0,
      ),
    ).toBe(true);

    integrateOne(bodies, index, 0, 10, 0.1);

    expect(bodies.linearVelocityX[index]).toBeCloseTo(2, 12);
    expect(bodies.linearVelocityY[index]).toBeCloseTo(1, 12);
    expect(bodies.positionX[index]).toBeCloseTo(0.2, 12);
    expect(bodies.positionY[index]).toBeCloseTo(0.1, 12);
    expect(bodies.forceX[index]).toBe(0);
    expect(bodies.forceY[index]).toBe(0);
    expect(bodies.torque[index]).toBe(0);

    integrateOne(bodies, index, 0, 10, 0.1);
    expect(bodies.linearVelocityX[index]).toBeCloseTo(2, 12);
    expect(bodies.linearVelocityY[index]).toBeCloseTo(2, 12);
  });

  it("applies an impulse immediately and its off-center moment angularly", () => {
    const { bodies, index, generation } = createBody({
      inverseMass: 0.5,
      inverseInertia: 0.25,
    });

    expect(
      applyImpulseAtPointToCandidateBody2D(
        bodies,
        index,
        generation,
        0,
        8,
        2,
        0,
      ),
    ).toBe(true);

    expect(bodies.linearVelocityX[index]).toBe(0);
    expect(bodies.linearVelocityY[index]).toBe(4);
    expect(bodies.angularVelocity[index]).toBe(4);
    expect(bodies.positionY[index]).toBe(0);
  });

  it("uses reciprocal damping after force and torque response", () => {
    const { bodies, index, generation } = createBody({
      linearVelocityX: 10,
      angularVelocity: 6,
      linearDamping: 2,
      angularDamping: 4,
      inverseInertia: 0.5,
    });
    expect(applyTorqueToCandidateBody2D(bodies, index, generation, 8)).toBe(
      true,
    );

    integrateOne(bodies, index, 0, 0, 0.25);

    expect(bodies.linearVelocityX[index]).toBeCloseTo(10 / 1.5, 12);
    expect(bodies.angularVelocity[index]).toBeCloseTo(7 / 2, 12);
    expect(bodies.positionX[index]).toBeCloseTo(10 / 1.5 / 4, 12);
    expect(bodies.rotationRadians[index]).toBeCloseTo(7 / 2 / 4, 12);
  });

  it("prevents angular response for fixed rotation", () => {
    const { bodies, index, generation } = createBody({
      inverseInertia: 10,
      angularVelocity: 3,
      flags: BODY_TYPE_DYNAMIC_2D | BODY_FIXED_ROTATION_2D,
    });

    applyTorqueToCandidateBody2D(bodies, index, generation, 20);
    applyImpulseAtPointToCandidateBody2D(
      bodies,
      index,
      generation,
      0,
      5,
      2,
      0,
    );
    integrateOne(bodies, index, 0, 0, 0.1);

    expect(bodies.inverseInertia[index]).toBe(0);
    expect(bodies.angularVelocity[index]).toBe(0);
    expect(bodies.rotationRadians[index]).toBe(0);
  });

  it("keeps static bodies fixed and moves kinematic bodies only by velocity", () => {
    const staticBody = createBody({
      inverseMass: 0,
      inverseInertia: 0,
      linearVelocityX: 5,
      flags: 0,
    });
    const kinematic = createBody({
      inverseMass: 0,
      inverseInertia: 0,
      linearVelocityX: 5,
      angularVelocity: 2,
      flags: BODY_TYPE_KINEMATIC_2D,
    });

    applyForceAtPointToCandidateBody2D(
      staticBody.bodies,
      staticBody.index,
      staticBody.generation,
      100,
      100,
      1,
      0,
    );
    applyForceAtPointToCandidateBody2D(
      kinematic.bodies,
      kinematic.index,
      kinematic.generation,
      100,
      100,
      1,
      0,
    );
    integrateOne(staticBody.bodies, staticBody.index, 0, 10, 0.1);
    integrateOne(kinematic.bodies, kinematic.index, 0, 10, 0.1);

    expect(staticBody.bodies.positionX[staticBody.index]).toBe(0);
    expect(staticBody.bodies.positionY[staticBody.index]).toBe(0);
    expect(kinematic.bodies.positionX[kinematic.index]).toBeCloseTo(0.5, 12);
    expect(kinematic.bodies.positionY[kinematic.index]).toBe(0);
    expect(kinematic.bodies.rotationRadians[kinematic.index]).toBeCloseTo(
      0.2,
      12,
    );
    expect(kinematic.bodies.inverseMass[kinematic.index]).toBe(0);
    expect(kinematic.bodies.inverseInertia[kinematic.index]).toBe(0);
  });
});
