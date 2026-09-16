import { describe, expect, it } from "vitest";
import {
  boxShape3D,
  ellipsoidShape3D,
  massProperties3D,
  sphereShape3D,
} from "../../../3d-geometry.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import {
  AXIS_LOCK_X_3D,
  AXIS_LOCK_Y_3D,
  AXIS_LOCK_Z_3D,
  applyForceAtPointToCandidateBody3D,
  applyImpulseAtPointToCandidateBody3D,
  applyTorqueToCandidateBody3D,
  deriveCompoundMassProperties3D,
  integrateCandidateBodies3D,
  writeWorldInverseInertia3D,
} from "./integrator.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  BodyStore3D,
  type BodyDefinition3D,
} from "./storage.js";

function createBody(overrides: Partial<BodyDefinition3D> = {}): {
  bodies: BodyStore3D;
  index: number;
  generation: number;
} {
  const bodies = new BodyStore3D(createPhysicsOwnershipCounters3D());
  const index = bodies.allocate({
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    orientationX: 0,
    orientationY: 0,
    orientationZ: 0,
    orientationW: 1,
    localCenterX: 0,
    localCenterY: 0,
    localCenterZ: 0,
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
    inverseMass: 1,
    localInverseInertiaXX: 1,
    localInverseInertiaYY: 1,
    localInverseInertiaZZ: 1,
    localInverseInertiaXY: 0,
    localInverseInertiaXZ: 0,
    localInverseInertiaYZ: 0,
    linearDamping: 0,
    angularDamping: 0,
    gravityScale: 1,
    sleepTime: 0,
    translationLocks: 0,
    rotationLocks: 0,
    flags: BODY_ENABLED_3D | BODY_TYPE_DYNAMIC_3D,
    owner: {},
    ...overrides,
  });
  return { bodies, index, generation: bodies.generations[index]! };
}

function integrateOne(
  bodies: BodyStore3D,
  index: number,
  gravityX: number,
  gravityY: number,
  gravityZ: number,
  dt: number,
): void {
  integrateCandidateBodies3D(
    bodies,
    new Int32Array([index]),
    1,
    gravityX,
    gravityY,
    gravityZ,
    dt,
  );
}

describe("candidate 3D tensor integration", () => {
  it("uses semi-implicit gravity at dt 0.1 and clears accepted force and torque", () => {
    const { bodies, index, generation } = createBody();
    expect(
      applyForceAtPointToCandidateBody3D(
        bodies,
        index,
        generation,
        20,
        0,
        0,
        0,
        0,
        0,
      ),
    ).toBe(true);
    expect(
      applyTorqueToCandidateBody3D(bodies, index, generation, 0, 0, 2),
    ).toBe(true);

    integrateOne(bodies, index, 0, -10, 0, 0.1);

    expect(bodies.linearVelocityX[index]).toBeCloseTo(2, 12);
    expect(bodies.linearVelocityY[index]).toBeCloseTo(-1, 12);
    expect(bodies.positionX[index]).toBeCloseTo(0.2, 12);
    expect(bodies.positionY[index]).toBeCloseTo(-0.1, 12);
    expect(bodies.angularVelocityZ[index]).toBeCloseTo(0.2, 12);
    expect(bodies.forceX[index]).toBe(0);
    expect(bodies.forceY[index]).toBe(0);
    expect(bodies.forceZ[index]).toBe(0);
    expect(bodies.torqueX[index]).toBe(0);
    expect(bodies.torqueY[index]).toBe(0);
    expect(bodies.torqueZ[index]).toBe(0);

    integrateOne(bodies, index, 0, -10, 0, 0.1);
    expect(bodies.linearVelocityX[index]).toBeCloseTo(2, 12);
    expect(bodies.linearVelocityY[index]).toBeCloseTo(-2, 12);
  });

  it("applies center and off-center impulses with the full world tensor", () => {
    const { bodies, index, generation } = createBody({
      inverseMass: 0.5,
      localInverseInertiaXX: 0.25,
      localInverseInertiaYY: 0.25,
      localInverseInertiaZZ: 0.25,
    });

    expect(
      applyImpulseAtPointToCandidateBody3D(
        bodies,
        index,
        generation,
        4,
        0,
        0,
        0,
        0,
        0,
      ),
    ).toBe(true);
    expect(bodies.linearVelocityX[index]).toBe(2);
    expect(bodies.angularVelocityZ[index]).toBe(0);

    expect(
      applyImpulseAtPointToCandidateBody3D(
        bodies,
        index,
        generation,
        0,
        8,
        0,
        2,
        0,
        0,
      ),
    ).toBe(true);
    expect(bodies.linearVelocityY[index]).toBe(4);
    expect(bodies.angularVelocityZ[index]).toBe(4);
  });

  it("rotates local inverse inertia into world space for world torque", () => {
    const sine = Math.SQRT1_2;
    const { bodies, index, generation } = createBody({
      orientationZ: sine,
      orientationW: sine,
      localInverseInertiaXX: 1,
      localInverseInertiaYY: 2,
      localInverseInertiaZZ: 3,
    });
    const tensor = new Float64Array(9);
    writeWorldInverseInertia3D(bodies, index, tensor, 0);
    expect(tensor[0]).toBeCloseTo(2, 14);
    expect(tensor[4]).toBeCloseTo(1, 14);
    expect(tensor[8]).toBeCloseTo(3, 14);
    for (const offset of [1, 2, 3, 5, 6, 7]) {
      expect(tensor[offset]).toBeCloseTo(0, 14);
    }

    applyTorqueToCandidateBody3D(bodies, index, generation, 2, 0, 0);
    integrateOne(bodies, index, 0, 0, 0, 0.5);
    expect(bodies.angularVelocityX[index]).toBeCloseTo(2, 12);
    expect(bodies.angularVelocityY[index]).toBeCloseTo(0, 12);
  });

  it("normalizes and canonicalizes quaternion integration after angular damping", () => {
    const { bodies, index } = createBody({
      angularVelocityZ: 6,
      angularDamping: 4,
    });

    integrateOne(bodies, index, 0, 0, 0, 0.25);

    expect(bodies.angularVelocityZ[index]).toBeCloseTo(3, 12);
    const length = Math.hypot(
      bodies.orientationX[index]!,
      bodies.orientationY[index]!,
      bodies.orientationZ[index]!,
      bodies.orientationW[index]!,
    );
    expect(length).toBeCloseTo(1, 14);
    expect(bodies.orientationZ[index]).toBeGreaterThan(0);
    expect(bodies.orientationW[index]).toBeGreaterThan(0);
  });

  it("enforces translation and local rotation locks for forces, impulses, and integration", () => {
    const { bodies, index, generation } = createBody({
      linearVelocityX: 3,
      linearVelocityY: 4,
      linearVelocityZ: 5,
      angularVelocityY: 7,
      translationLocks: AXIS_LOCK_X_3D | AXIS_LOCK_Z_3D,
      rotationLocks: AXIS_LOCK_Y_3D,
    });
    applyForceAtPointToCandidateBody3D(
      bodies,
      index,
      generation,
      10,
      10,
      10,
      0,
      0,
      0,
    );
    applyTorqueToCandidateBody3D(bodies, index, generation, 0, 20, 0);
    applyImpulseAtPointToCandidateBody3D(
      bodies,
      index,
      generation,
      5,
      0,
      5,
      0,
      0,
      0,
    );
    integrateOne(bodies, index, 10, 0, 10, 0.1);

    expect(bodies.linearVelocityX[index]).toBe(0);
    expect(bodies.linearVelocityY[index]).toBeCloseTo(5, 12);
    expect(bodies.linearVelocityZ[index]).toBe(0);
    expect(bodies.positionX[index]).toBe(0);
    expect(bodies.positionY[index]).toBeCloseTo(0.5, 12);
    expect(bodies.positionZ[index]).toBe(0);
    expect(bodies.angularVelocityY[index]).toBeCloseTo(0, 12);
  });

  it("keeps static bodies fixed and kinematic bodies immune to dynamic response", () => {
    const staticBody = createBody({
      linearVelocityX: 5,
      inverseMass: 9,
      flags: BODY_ENABLED_3D,
    });
    const kinematic = createBody({
      linearVelocityX: 5,
      angularVelocityZ: 2,
      inverseMass: 9,
      flags: BODY_ENABLED_3D | BODY_TYPE_KINEMATIC_3D,
    });
    for (const body of [staticBody, kinematic]) {
      applyForceAtPointToCandidateBody3D(
        body.bodies,
        body.index,
        body.generation,
        100,
        100,
        100,
        1,
        0,
        0,
      );
      applyImpulseAtPointToCandidateBody3D(
        body.bodies,
        body.index,
        body.generation,
        10,
        10,
        10,
        1,
        0,
        0,
      );
      integrateOne(body.bodies, body.index, 0, -10, 0, 0.1);
    }

    expect(staticBody.bodies.positionX[staticBody.index]).toBe(0);
    expect(staticBody.bodies.inverseMass[staticBody.index]).toBe(0);
    expect(kinematic.bodies.positionX[kinematic.index]).toBeCloseTo(0.5, 12);
    expect(kinematic.bodies.linearVelocityX[kinematic.index]).toBe(5);
    expect(kinematic.bodies.inverseMass[kinematic.index]).toBe(0);
    expect(kinematic.bodies.orientationZ[kinematic.index]).not.toBe(0);
  });
});

describe("automatic 3D compound mass properties", () => {
  it("uses the same authoritative tensor as standalone geometry", () => {
    const shape = ellipsoidShape3D({
      radii: [2, 3, 4],
      orientation: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)],
    });
    const expected = massProperties3D(shape, { density: 2 });
    const actual = deriveCompoundMassProperties3D(
      [
        {
          shape: requireShapeRecord3D(shape),
          position: [0, 0, 0],
          orientation: [0, 0, 0, 1],
          density: 2,
          contributesToMass: true,
        },
      ],
      "dynamic",
    );
    expect(actual.mass).toBeCloseTo(expected.mass, 12);
    const tensor = [
      actual.inertiaXX,
      actual.inertiaXY,
      actual.inertiaXZ,
      actual.inertiaXY,
      actual.inertiaYY,
      actual.inertiaYZ,
      actual.inertiaXZ,
      actual.inertiaYZ,
      actual.inertiaZZ,
    ];
    tensor.forEach((value, index) =>
      expect(value).toBeCloseTo(expected.inertiaTensor[index]!, 12),
    );
  });

  it("uses density, local rigid poses, and the full parallel-axis tensor", () => {
    const box = requireShapeRecord3D(
      boxShape3D({ width: 2, height: 4, depth: 6 }),
    );
    const ignored = requireShapeRecord3D(sphereShape3D({ radius: 10 }));
    const sine = Math.sin(Math.PI / 8);
    const cosine = Math.cos(Math.PI / 8);
    const mass = deriveCompoundMassProperties3D(
      [
        {
          shape: box,
          position: [0, 0, 0],
          orientation: [0, 0, 0, 1],
          density: 1,
          contributesToMass: true,
        },
        {
          shape: box,
          position: [2, 0, 0],
          orientation: [0, 0, sine, cosine],
          density: 1,
          contributesToMass: true,
        },
        {
          shape: ignored,
          position: [100, 100, 100],
          orientation: [0, 0, 0, 1],
          density: 100,
          contributesToMass: false,
        },
      ],
      "dynamic",
    );

    expect(mass.mass).toBe(96);
    expect([mass.centerX, mass.centerY, mass.centerZ]).toEqual([1, 0, 0]);
    expect(mass.inertiaXX).toBeCloseTo(392, 10);
    expect(mass.inertiaYY).toBeCloseTo(440, 10);
    expect(mass.inertiaZZ).toBeCloseTo(256, 10);
    expect(mass.inertiaXY).toBeCloseTo(24, 10);
    expect(mass.inertiaXZ).toBeCloseTo(0, 10);
    expect(mass.inertiaYZ).toBeCloseTo(0, 10);
    expect(mass.inverseMass).toBeCloseTo(1 / 96, 14);
    expect(mass.inverseInertiaXX).toBeCloseTo(440 / 171_904, 14);
    expect(mass.inverseInertiaYY).toBeCloseTo(392 / 171_904, 14);
    expect(mass.inverseInertiaXY).toBeCloseTo(-24 / 171_904, 14);
    expect(mass.inverseInertiaZZ).toBeCloseTo(1 / 256, 14);
  });

  it("rejects zero-mass dynamics and zeros static or kinematic inverse response", () => {
    expect(() => deriveCompoundMassProperties3D([], "dynamic")).toThrow(
      /positive mass/i,
    );
    for (const bodyType of ["static", "kinematic"] as const) {
      const result = deriveCompoundMassProperties3D([], bodyType);
      expect(result.inverseMass).toBe(0);
      expect(result.inverseInertiaXX).toBe(0);
      expect(result.inverseInertiaYY).toBe(0);
      expect(result.inverseInertiaZZ).toBe(0);
      expect(result.inverseInertiaXY).toBe(0);
      expect(result.inverseInertiaXZ).toBe(0);
      expect(result.inverseInertiaYZ).toBe(0);
    }
  });
});
