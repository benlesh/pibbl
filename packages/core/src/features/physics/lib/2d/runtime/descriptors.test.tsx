import { signal } from "@crc/core";
import { circleShape2D } from "../../../2d-geometry.js";
/** @jsxImportSource @crc/core */
import {
  collider2D,
  dynamicBody2D,
  kinematicBody2D,
  requirePhysicsAttachment2DDescriptor,
  staticBody2D,
} from "./descriptors.js";
import { describe, expect, it, vi } from "vitest";

describe("2D physics attachment descriptors", () => {
  it("copies caller arrays, freezes normalized records, and preserves opaque identities", () => {
    const velocity: [number, number] = [3, 4];
    const offset: [number, number] = [5, 6];
    const position = signal<readonly [number, number]>([7, 8]);
    const rotationDegrees = signal(9);
    const handle = Object.freeze({ marker: "handle" });
    const tag = { marker: "tag" };
    const onCollisionStart = vi.fn();
    const shape = circleShape2D({ radius: 2 });

    const dynamic = dynamicBody2D({
      handle: handle as never,
      linearVelocity: velocity,
      collider: {
        shape,
        offset,
        tag,
        onCollisionStart,
      },
    });
    const kinematic = kinematicBody2D({
      target: { position, rotationDegrees },
    });
    velocity[0] = 30;
    offset[0] = 50;

    const dynamicRecord = requirePhysicsAttachment2DDescriptor(dynamic);
    expect(dynamicRecord).toMatchObject({
      kind: "body",
      bodyType: "dynamic",
      options: {
        enabled: true,
        handle,
        linearVelocity: [3, 4],
        angularVelocityDegreesPerSecond: 0,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 1,
        mass: "auto",
        fixedRotation: false,
        allowSleep: true,
        ccd: false,
        reenableVelocity: "zero",
        collider: {
          shape,
          offset: [5, 6],
          rotationDegrees: 0,
          density: 1,
          friction: 0.5,
          restitution: 0,
          sensor: false,
          contributesToMass: true,
          collisionFilter: { category: 1, mask: 0xffff_ffff, group: 0 },
          tag,
          handlers: { onCollisionStart },
        },
      },
    });
    expect(Object.isFrozen(dynamic)).toBe(true);
    expect(Object.isFrozen(dynamicRecord)).toBe(true);
    expect(Object.isFrozen(dynamicRecord.options)).toBe(true);
    expect(Object.isFrozen(dynamicRecord.options.linearVelocity)).toBe(true);
    expect(Object.isFrozen(dynamicRecord.options.collider)).toBe(true);
    expect(dynamicRecord.options.handle).toBe(handle);
    expect(dynamicRecord.options.collider.tag).toBe(tag);
    expect(dynamicRecord.options.collider.handlers.onCollisionStart).toBe(
      onCollisionStart,
    );

    const kinematicRecord = requirePhysicsAttachment2DDescriptor(kinematic);
    expect(kinematicRecord.options.target).toEqual({
      position,
      rotationDegrees,
    });
    expect(kinematicRecord.options.target.position).toBe(position);
    expect(kinematicRecord.options.target.rotationDegrees).toBe(
      rotationDegrees,
    );
    expect(Object.isFrozen(kinematicRecord.options.target)).toBe(true);
  });

  it("normalizes every factory and sensor mass participation", () => {
    expect(requirePhysicsAttachment2DDescriptor(staticBody2D())).toMatchObject({
      kind: "body",
      bodyType: "static",
      options: { enabled: true, collider: { shape: "self" } },
    });
    expect(
      requirePhysicsAttachment2DDescriptor(kinematicBody2D()),
    ).toMatchObject({
      kind: "body",
      bodyType: "kinematic",
      options: {
        enabled: true,
        target: {},
        allowSleep: true,
        collider: { shape: "self" },
      },
    });
    expect(
      requirePhysicsAttachment2DDescriptor(collider2D({ sensor: true })),
    ).toMatchObject({
      kind: "collider",
      options: { sensor: true, contributesToMass: false },
    });
    expect(
      requirePhysicsAttachment2DDescriptor(
        collider2D({
          sensor: true,
          contributesToMass: true,
        }),
      ),
    ).toMatchObject({
      options: { sensor: true, contributesToMass: true },
    });
  });

  it.each([
    ["density", () => collider2D({ density: 0 })],
    ["friction", () => collider2D({ friction: -1 })],
    ["restitution", () => collider2D({ restitution: 1.01 })],
    ["rotationDegrees", () => collider2D({ rotationDegrees: Number.NaN })],
    [
      "collisionFilter.category",
      () => collider2D({ collisionFilter: { category: -1 } }),
    ],
    [
      "collisionFilter.mask",
      () => collider2D({ collisionFilter: { mask: 0x1_0000_0000 } }),
    ],
    [
      "collisionFilter.group",
      () => collider2D({ collisionFilter: { group: 2_147_483_648 } }),
    ],
    ["mass", () => dynamicBody2D({ mass: 0 })],
    ["linearDamping", () => dynamicBody2D({ linearDamping: -1 })],
    ["angularDamping", () => dynamicBody2D({ angularDamping: Number.NaN })],
    [
      "gravityScale",
      () => dynamicBody2D({ gravityScale: Number.POSITIVE_INFINITY }),
    ],
    [
      "linearVelocity",
      () => dynamicBody2D({ linearVelocity: [0, Number.NaN] }),
    ],
    [
      "angularVelocityDegreesPerSecond",
      () =>
        dynamicBody2D({
          angularVelocityDegreesPerSecond: Number.NEGATIVE_INFINITY,
        }),
    ],
  ])(
    "rejects invalid %s values before creating an attachment",
    (path, create) => {
      expect(create).toThrow(new RegExp(path.replace(".", ".*"), "i"));
    },
  );

  it("rejects hand-authored lookalikes at its private recognition boundary", () => {
    expect(() =>
      requirePhysicsAttachment2DDescriptor(
        Object.freeze({
          kind: "body",
          bodyType: "dynamic",
          options: {},
        }) as never,
      ),
    ).toThrow(/registered CRC physics 2D attachment/i);
  });
});
