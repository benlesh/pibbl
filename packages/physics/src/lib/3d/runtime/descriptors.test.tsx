import { signal } from "@crc/core";
import { sphereShape3D } from "../../../3d-geometry.js";
import { describe, expect, it, vi } from "vitest";
/** @jsxImportSource @crc/core */
import {
  collider3D,
  dynamicBody3D,
  kinematicBody3D,
  requirePhysicsAttachment3DDescriptor,
  staticBody3D,
} from "./descriptors.js";

describe("3D physics attachment descriptors", () => {
  it("copies caller arrays and freezes normalized 3D records", () => {
    // Production break caught: retaining mutable velocity, offset,
    // orientation, lock, or handler containers lets callers mutate topology
    // after descriptor creation.
    const velocity: [number, number, number] = [1, 2, 3];
    const angular: [number, number, number] = [4, 5, 6];
    const offset: [number, number, number] = [7, 8, 9];
    const orientation: [number, number, number, number] = [0, 0, 0, 2];
    const lockTranslation = { x: true };
    const onCollisionStart = vi.fn();
    const shape = sphereShape3D({ radius: 2 });

    const attachment = dynamicBody3D({
      linearVelocity: velocity,
      angularVelocityDegreesPerSecond: angular,
      lockTranslation,
      collider: { shape, offset, orientation, onCollisionStart },
    });
    velocity[0] = 100;
    angular[0] = 100;
    offset[0] = 100;
    orientation[3] = 1;
    lockTranslation.x = false;

    const descriptor = requirePhysicsAttachment3DDescriptor(attachment);
    expect(descriptor).toMatchObject({
      kind: "body",
      bodyType: "dynamic",
      options: {
        enabled: true,
        linearVelocity: [1, 2, 3],
        angularVelocityDegreesPerSecond: [4, 5, 6],
        lockTranslation: { x: true, y: false, z: false },
        lockRotation: { x: false, y: false, z: false },
        mass: "auto",
        collider: {
          shape,
          offset: [7, 8, 9],
          orientation: [0, 0, 0, 1],
          handlers: { onCollisionStart },
        },
      },
    });
    expect(Object.isFrozen(attachment)).toBe(true);
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.options)).toBe(true);
    expect(Object.isFrozen(descriptor.options.collider)).toBe(true);
  });

  it("normalizes self, collider false, sensor mass, and sparse targets", () => {
    // Production break caught: eager geometry inference or target defaulting
    // would erase the Task 7 self sentinel or make sparse bindings impossible.
    const position = signal<readonly [number, number, number]>([1, 2, 3]);
    const orientation = signal<readonly [number, number, number, number]>([
      0, 0, 0, 1,
    ]);
    expect(requirePhysicsAttachment3DDescriptor(staticBody3D())).toMatchObject({
      options: { collider: { shape: "self" } },
    });
    expect(
      requirePhysicsAttachment3DDescriptor(staticBody3D({ collider: false })),
    ).toMatchObject({ options: { collider: false } });
    expect(
      requirePhysicsAttachment3DDescriptor(collider3D({ sensor: true })),
    ).toMatchObject({
      options: { sensor: true, contributesToMass: false },
    });
    expect(
      requirePhysicsAttachment3DDescriptor(
        kinematicBody3D({ target: { position } }),
      ),
    ).toMatchObject({ options: { target: { position } } });
    expect(
      requirePhysicsAttachment3DDescriptor(
        kinematicBody3D({ target: { orientation } }),
      ),
    ).toMatchObject({ options: { target: { orientation } } });
  });

  it.each([
    ["mass", () => dynamicBody3D({ mass: 0 })],
    ["linearVelocity", () => dynamicBody3D({ linearVelocity: [0, NaN, 0] })],
    [
      "angularVelocityDegreesPerSecond",
      () =>
        dynamicBody3D({
          angularVelocityDegreesPerSecond: [0, Infinity, 0],
        }),
    ],
    ["density", () => collider3D({ density: 0 })],
    ["friction", () => collider3D({ friction: -1 })],
    ["restitution", () => collider3D({ restitution: 1.01 })],
    ["orientation", () => collider3D({ orientation: [0, 0, 0, 0] })],
    [
      "collisionFilter.category",
      () => collider3D({ collisionFilter: { category: -1 } }),
    ],
  ])("rejects invalid %s before creating an attachment", (path, create) => {
    // Production break caught: validation after attachment creation can acquire
    // mounted lifecycle resources for invalid user input.
    expect(create).toThrow(new RegExp(path.replace(".", ".*"), "i"));
  });

  it("rejects hand-authored lookalikes at the nominal boundary", () => {
    expect(() =>
      requirePhysicsAttachment3DDescriptor({ kind: "body" } as never),
    ).toThrow(/registered CRC physics 3D attachment/i);
  });
});
