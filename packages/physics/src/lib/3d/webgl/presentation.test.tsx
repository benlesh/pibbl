import type {
  CRCWebGLAuthoredTransform,
  CRCWebGLPhysicsPrimitiveFacts,
} from "@crc/webgl/internal";
import { crc, signal, type CRCController } from "@crc/core";
import { Cube, Group3D, Sphere, WebGLLayer } from "@crc/webgl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CRCPhysicsPose3D } from "../../../3d-geometry.js";
import {
  PhysicsWorld3D,
  collider3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  dynamicBody3D,
  staticBody3D,
  type CRCPhysicsWorldHandle3D,
} from "../../../3d.js";
import {
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "../runtime/controller.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { inferWebGLColliderShape3D } from "./inference.js";
import {
  captureWebGLBodyPresentation3D,
  resolveWebGLBodyFrame3D,
  resolveWebGLColliderForwardMatrix3D,
  resolveWebGLDynamicPresentationMatrix3D,
} from "./presentation.js";

describe("WebGL 3D physics presentation", () => {
  it("captures body pose without scale and preserves the initial model", () => {
    const body = facts("cube", transform({
      translation: [3, 4, 5],
      scale: [2, 3, 4],
    }));
    const capture = captureWebGLBodyPresentation3D(body, "Cube");
    const frame = resolveWebGLBodyFrame3D(capture, body, "Cube", true);

    expect(capture.initialPose).toEqual({
      position: [3, 4, 5],
      orientation: [0, 0, 0, 1],
    });
    expect([...resolveWebGLDynamicPresentationMatrix3D(
      capture,
      capture.initialPose,
      frame,
      "Cube",
    )]).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });

  it("uses authoritative body pose while retaining baked visual scale", () => {
    const body = facts("cube", transform({
      translation: [3, 4, 5],
      scale: [2, 3, 4],
    }));
    const capture = captureWebGLBodyPresentation3D(body, "Cube");
    const frame = resolveWebGLBodyFrame3D(capture, body, "Cube", true);
    const presented: CRCPhysicsPose3D = {
      position: [11, 12, 13],
      orientation: [0, 0, 0, 1],
    };

    const presentation = resolveWebGLDynamicPresentationMatrix3D(
      capture,
      presented,
      frame,
      "Cube",
    );
    expect([...presentation]).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      8, 8, 8, 1,
    ]);
  });

  it("derives compound geometry from the exact forward authored suffix", () => {
    const bodyTransform = transform({
      translation: [10, 0, 0],
      scale: [2, 2, 2],
    });
    const body = facts("group", bodyTransform);
    const capture = captureWebGLBodyPresentation3D(body, "Group3D");
    const frame = resolveWebGLBodyFrame3D(capture, body, "Group3D", true);
    const collider = facts(
      "cube",
      transform({ translation: [3, 0, 0], scale: [1, 2, 3] }),
      [bodyTransform],
    );
    const matrix = resolveWebGLColliderForwardMatrix3D(
      frame,
      collider,
      "Cube",
    );
    const record = requireShapeRecord3D(
      inferWebGLColliderShape3D(collider, matrix),
    );

    expect(record).toMatchObject({ kind: "box" });
    if (record.kind !== "box") throw new Error("Expected an inferred box.");
    expect([...record.center]).toEqual([6, 0, 0]);
    expect([...record.halfExtents]).toEqual([1, 2, 3]);

    const copiedPrefix = transform({
      translation: [10, 0, 0],
      scale: [2, 2, 2],
    });
    expect(() =>
      resolveWebGLColliderForwardMatrix3D(
        frame,
        facts("cube", transform(), [copiedPrefix]),
        "Cube",
      ),
    ).toThrow(/exact authored lineage/i);
  });

  it("diagnoses a later authored pose writer while permitting scale churn", () => {
    const initial = facts("cube", transform({
      translation: [1, 2, 3],
      scale: [2, 2, 2],
    }));
    const capture = captureWebGLBodyPresentation3D(initial, "Cube");

    expect(() => resolveWebGLBodyFrame3D(
      capture,
      facts("cube", transform({
        translation: [1, 2, 3],
        scale: [4, 5, 6],
      })),
      "Cube",
      true,
    )).not.toThrow();

    expect(() => resolveWebGLBodyFrame3D(
      capture,
      facts("cube", transform({
        translation: [2, 2, 3],
        scale: [2, 2, 2],
      })),
      "Cube",
      true,
    )).toThrow(/authored pose changed.*dynamic body owns pose.*teleportBody3D/i);
  });
});

describe("mounted WebGL 3D physics integration", () => {
  const mounts: CRCController[] = [];

  afterEach(() => {
    for (const mount of mounts.splice(0)) mount.dispose();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("mounts inferred self geometry and basic Group3D compounds at authored poses", () => {
    const frames = new ManualFrames();
    frames.install();
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    document.body.appendChild(canvas);
    const Root = () => (
      <WebGLLayer style={{ width: 100, height: 100 }}>
        <PhysicsWorld3D gravity={[0, 0, 0]}>
          <Capture />
          <Cube
            physics={staticBody3D()}
            style={{
              size: 2,
              translateX: 3,
              translateY: 4,
              translateZ: 5,
              scaleX: 2,
            }}
          />
          <Group3D
            physics={dynamicBody3D({ collider: false, mass: 1 })}
            style={{ translateX: 10, scaleX: 2, scaleY: 2, scaleZ: 2 }}
          >
            <Cube
              physics={collider3D()}
              style={{ translateX: -1.5, size: 1 }}
            />
            <Sphere
              physics={collider3D()}
              style={{ translateX: 1.5, radius: 0.5 }}
            />
          </Group3D>
        </PhysicsWorld3D>
      </WebGLLayer>
    );
    mounts.push(crc(canvas, <Root />));

    frames.flush(0);
    frames.flush(0);
    const controller = requirePhysicsWorld3DController(world);
    const snapshot = snapshotPhysicsWorld3DControllerForTest(controller);
    expect(snapshot.kernel).toMatchObject({ bodyCount: 2, colliderCount: 3 });
    expect(snapshot.kernel.bodies[0]).toMatchObject({
      positionX: 3,
      positionY: 4,
      positionZ: 5,
    });
    expect(controller.presentationPose(snapshot.bodyIds[1]!)).toMatchObject({
      position: [10, 0, 0],
    });
  });

  it("keeps authoritative physics unchanged across a camera-only render", () => {
    const frames = new ManualFrames();
    frames.install();
    const cameraOffset = signal(0);
    let world!: CRCPhysicsWorldHandle3D;
    let body!: ReturnType<typeof crcPhysicsBody3D>;
    const Body = () => {
      body = crcPhysicsBody3D();
      return (
        <Cube
          physics={dynamicBody3D({
            handle: body,
            mass: 1,
            collider: false,
          })}
          style={{ translateX: 2, translateY: 3, translateZ: 4 }}
        />
      );
    };
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const Root = () => {
      const offset = cameraOffset.get();
      return (
        <WebGLLayer
          camera={{
            type: "perspective",
            position: [offset, 0, 10],
            lookAt: [0, 0, 0],
            up: [0, 1, 0],
            fieldOfViewDegrees: 45,
            near: 0.1,
            far: 100,
          }}
          style={{ width: 100, height: 100 }}
        >
          <PhysicsWorld3D
            gravity={[0, 0, 0]}
            fixedStepMilliseconds={100}
            sleeping={false}
          >
            <Capture />
            <Body />
          </PhysicsWorld3D>
        </WebGLLayer>
      );
    };
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, <Root />));
    frames.flush(0);
    frames.flush(0);
    const controller = requirePhysicsWorld3DController(world);
    const before = snapshotPhysicsWorld3DControllerForTest(controller);

    cameraOffset.set(3);
    frames.flush(0);
    const after = snapshotPhysicsWorld3DControllerForTest(controller);
    expect(after.bodyIds).toEqual(before.bodyIds);
    expect(after.colliderIds).toEqual(before.colliderIds);
    expect(after.kernel.bodies).toEqual(before.kernel.bodies);
    expect(body.position.get()).toEqual([2, 3, 4]);
  });

  it("rejects an authored pose writer after a dynamic body takes authority", () => {
    const frames = new ManualFrames();
    frames.install();
    const authoredX = signal(1);
    const Body = () => (
      <Cube
        physics={dynamicBody3D({ mass: 1, collider: false })}
        style={{ translateX: authoredX.get() }}
      />
    );
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, (
      <WebGLLayer style={{ width: 100, height: 100 }}>
        <PhysicsWorld3D gravity={[0, 0, 0]}>
          <Body />
        </PhysicsWorld3D>
      </WebGLLayer>
    )));
    frames.flush(0);
    frames.flush(0);

    authoredX.set(2);
    expect(() => frames.flush(1)).toThrow(
      /authored pose changed.*dynamic body owns pose.*teleportBody3D/i,
    );
  });
});

function facts(
  kind: "group" | "cube" | "sphere",
  localTransform: CRCWebGLAuthoredTransform,
  authoredParentLineage: readonly CRCWebGLAuthoredTransform[] = [],
): CRCWebGLPhysicsPrimitiveFacts {
  if (kind === "group") {
    return {
      kind,
      localTransform,
      authoredParentLineage: Object.freeze([...authoredParentLineage]),
    };
  }
  return {
    kind,
    localTransform,
    authoredParentLineage: Object.freeze([...authoredParentLineage]),
    geometry: Object.freeze({}) as never,
    geometrySnapshot: Object.freeze({}) as never,
  };
}

function transform(
  input: Readonly<{
    translation?: readonly [number, number, number];
    scale?: readonly [number, number, number];
  }> = {},
): CRCWebGLAuthoredTransform {
  const translation = input.translation ?? [0, 0, 0];
  const scale = input.scale ?? [1, 1, 1];
  return Object.freeze({
    translation: Object.freeze([...translation]) as never,
    orientation: Object.freeze([0, 0, 0, 1] as const),
    scale: Object.freeze([...scale]) as never,
    matrix: Object.freeze([
      scale[0], 0, 0, 0,
      0, scale[1], 0, 0,
      0, 0, scale[2], 0,
      translation[0], translation[1], translation[2], 1,
    ]),
  });
}

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

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
      | readonly [number, FrameRequestCallback]
      | undefined;
    if (!entry) throw new Error("No CRC host frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
