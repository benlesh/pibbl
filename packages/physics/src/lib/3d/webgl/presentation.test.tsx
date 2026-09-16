import type {
  CRCWebGLAuthoredTransform,
  CRCWebGLPhysicsPrimitiveFacts,
} from "@crc/webgl/internal";
import { crc, signal, type CRCController } from "@crc/core";
import { Cube, Group3D, Sphere, WebGLLayer } from "@crc/webgl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeRender } from "../../../../../core/src/lib/execute-render.js";
import {
  WebGLLayerController,
  resolveWebGLLayerSurface,
} from "../../../../../webgl/src/lib/layer-controller.js";
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
  PhysicsWorld3DController,
  requirePhysicsWorld3DController,
  snapshotPhysicsWorld3DControllerForTest,
} from "../runtime/controller.js";
import {
  MountedPhysicsAttachment3D,
  snapshotPhysicsBodyFrames3DForTest,
} from "../runtime/descriptors.js";
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

  it("diagnoses a represented large-coordinate translation while accepting q-negation", () => {
    const initialTransform = transform({ translation: [1e9, 0, 0] });
    const capture = captureWebGLBodyPresentation3D(
      facts("cube", initialTransform),
      "Cube",
    );
    const negatedOrientation = Object.freeze({
      ...initialTransform,
      orientation: Object.freeze([0, 0, 0, -1] as const),
    });

    expect(() => resolveWebGLBodyFrame3D(
      capture,
      facts("cube", negatedOrientation),
      "Cube",
      true,
    )).not.toThrow();

    const moved = transform({ translation: [1e9 + 50, 0, 0] });
    expect(moved.matrix[12]).toBe(1_000_000_064);
    expect(() => resolveWebGLBodyFrame3D(
      capture,
      facts("cube", moved),
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

  it("keeps one render, pick, and focus model for a moving Cube scaled to 1e-5", () => {
    const render = vi.spyOn(
      WebGLLayerController.prototype,
      "renderRetainedChild",
    );
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
    mounts.push(crc(canvas, (
      <WebGLLayer style={{ width: 100, height: 100 }}>
        <PhysicsWorld3D
          gravity={[0, 0, 0]}
          fixedStepMilliseconds={10}
          sleeping={false}
        >
          <Capture />
          <Cube
            keyboardFocusable
            physics={dynamicBody3D({
              mass: 1,
              linearVelocity: [1, 0, 0],
            })}
            style={{
              scaleX: 1e-5,
              scaleY: 1e-5,
              scaleZ: 1e-5,
            }}
          />
        </PhysicsWorld3D>
      </WebGLLayer>
    )));

    frames.flush(0);
    const layer = render.mock.instances[0] as WebGLLayerController;
    const uniformMatrix = vi.spyOn(layer.gl, "uniformMatrix4fv");
    frames.flush(0);
    frames.flush(10);
    frames.flush(20);

    const controller = requirePhysicsWorld3DController(world);
    const snapshot = snapshotPhysicsWorld3DControllerForTest(controller);
    const pose = controller.presentationPose(snapshot.bodyIds[0]!);
    expect(pose?.position[0]).toBeGreaterThan(0);
    const committed = (layer as unknown as {
      committed?: {
        pickLedger: {
          entries: readonly {
            componentName: string;
            model: Readonly<Float32Array>;
            keyboardNavigationPoints?: readonly Readonly<{
              x: number;
              y: number;
            }>[];
            target: {
              keyboardNavigationPoints?: readonly Readonly<{
                x: number;
                y: number;
              }>[];
            };
          }[];
        };
      };
    }).committed;
    const entry = committed?.pickLedger.entries.find(
      (candidate) => candidate.componentName === "Cube",
    );
    expect(entry).toBeDefined();
    expect(entry?.model[0]).toBeCloseTo(1e-5, 10);
    expect(entry?.model[5]).toBeCloseTo(1e-5, 10);
    expect(entry?.model[10]).toBeCloseTo(1e-5, 10);
    expect(entry?.model[12]).toBeCloseTo(pose!.position[0], 7);
    expect(entry?.keyboardNavigationPoints?.length).toBeGreaterThan(0);
    expect(entry?.keyboardNavigationPoints?.every((point) =>
      Number.isFinite(point.x) && Number.isFinite(point.y)
    )).toBe(true);
    expect(entry?.target.keyboardNavigationPoints).toBe(
      entry?.keyboardNavigationPoints,
    );
    expect(uniformMatrix.mock.calls.some((call) =>
      sameMatrix(call[2] as Float32List, entry!.model)
    )).toBe(true);
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

  it("adopts only the latest body presentation when one transaction supersedes its WebGL child draft", () => {
    const finishRender = vi.spyOn(
      PhysicsWorld3DController.prototype as unknown as {
        finishRender(success: boolean): void;
      },
      "finishRender",
    );
    const frames = new ManualFrames();
    frames.install();
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const scene = (translateX: number) => (
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Capture />
        <Cube
          physics={dynamicBody3D({ mass: 1, collider: false })}
          style={{ translateX }}
        />
      </PhysicsWorld3D>
    );
    const first = scene(1);
    const latest = scene(2);
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, undefined));
    const surface = resolveWebGLLayerSurface(100, 100, { x: 1, y: 1 });
    const layer = new WebGLLayerController(
      canvas,
      first,
      undefined,
      surface,
    );
    const RenderPair = () => {
      layer.renderUpdatedChild(first, undefined, surface, 1);
      layer.renderUpdatedChild(latest, undefined, surface, 1);
      return undefined;
    };
    const RenderLatest = () => {
      layer.renderUpdatedChild(latest, undefined, surface, 2);
      return undefined;
    };
    const RenderSuperseded = () => {
      layer.renderUpdatedChild(first, undefined, surface, 3);
      return undefined;
    };

    try {
      expect(() => executeRender(canvas, 1, <RenderPair />)).not.toThrow();
      expect(finishRender).toHaveBeenCalledOnce();
      expect(snapshotPhysicsWorld3DControllerForTest(
        requirePhysicsWorld3DController(world),
      ).bodyIds).toHaveLength(1);

      expect(() => executeRender(canvas, 2, <RenderLatest />)).not.toThrow();
      expect(finishRender).toHaveBeenCalledTimes(2);
      expect(() => executeRender(canvas, 3, <RenderSuperseded />)).toThrow(
        /authored pose changed.*dynamic body owns pose.*teleportBody3D/i,
      );
      expect(finishRender).toHaveBeenCalledTimes(2);
    } finally {
      layer.dispose();
    }
  });

  it("adopts neither body presentation when a superseded WebGL child transaction fails", () => {
    const finishRender = vi.spyOn(
      PhysicsWorld3DController.prototype as unknown as {
        finishRender(success: boolean): void;
      },
      "finishRender",
    );
    const frames = new ManualFrames();
    frames.install();
    const failure = new Error("superseded WebGL body traversal failed");
    const scene = (translateX: number) => (
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Cube
          physics={dynamicBody3D({ mass: 1, collider: false })}
          style={{ translateX }}
        />
      </PhysicsWorld3D>
    );
    const first = scene(10);
    const superseding = scene(20);
    const recovery = scene(30);
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, undefined));
    const surface = resolveWebGLLayerSurface(100, 100, { x: 1, y: 1 });
    const layer = new WebGLLayerController(
      canvas,
      first,
      undefined,
      surface,
    );
    const FailAfterPair = () => {
      layer.renderUpdatedChild(first, undefined, surface, 1);
      layer.renderUpdatedChild(superseding, undefined, surface, 1);
      throw failure;
    };
    const RenderRecovery = () => {
      layer.renderUpdatedChild(recovery, undefined, surface, 2);
      return undefined;
    };

    try {
      expect(() => executeRender(canvas, 1, <FailAfterPair />)).toThrow(
        failure,
      );
      expect(finishRender).toHaveBeenCalledOnce();
      expect(() => executeRender(canvas, 2, <RenderRecovery />)).not.toThrow();
      expect(finishRender).toHaveBeenCalledTimes(2);
    } finally {
      layer.dispose();
    }
  });

  it("clears committed body presentation state when the body is removed and disposed", () => {
    const originalDispose = MountedPhysicsAttachment3D.prototype.dispose;
    let removed: MountedPhysicsAttachment3D | undefined;
    vi.spyOn(MountedPhysicsAttachment3D.prototype, "dispose")
      .mockImplementation(function disposeAndCapture() {
        removed = this;
        originalDispose.call(this);
      });
    const frames = new ManualFrames();
    frames.install();
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const populated = (
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Capture />
        <Cube
          physics={dynamicBody3D({ mass: 1, collider: false })}
          style={{ translateX: 7 }}
        />
      </PhysicsWorld3D>
    );
    const empty = (
      <PhysicsWorld3D gravity={[0, 0, 0]}>
        <Capture />
      </PhysicsWorld3D>
    );
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    document.body.appendChild(canvas);
    mounts.push(crc(canvas, undefined));
    const surface = resolveWebGLLayerSurface(100, 100, { x: 1, y: 1 });
    const layer = new WebGLLayerController(
      canvas,
      populated,
      undefined,
      surface,
    );
    const RenderPopulated = () => {
      layer.renderUpdatedChild(populated, undefined, surface, 1);
      return undefined;
    };
    const RenderEmpty = () => {
      layer.renderUpdatedChild(empty, undefined, surface, 2);
      return undefined;
    };

    try {
      executeRender(canvas, 1, <RenderPopulated />);
      executeRender(canvas, 2, <RenderEmpty />);
      expect(snapshotPhysicsWorld3DControllerForTest(
        requirePhysicsWorld3DController(world),
      ).bodyIds).toEqual([]);
      expect(removed).toBeDefined();
      expect(removed as unknown as {
        bodyPresentation?: unknown;
        wasEnabled: boolean;
      }).toMatchObject({
        bodyPresentation: undefined,
        wasEnabled: false,
      });
    } finally {
      layer.dispose();
    }
  });

  it("returns body frame records to baseline across removal, failure, and dispose", () => {
    const frames = new ManualFrames();
    frames.install();
    const visible = signal(false);
    const fail = signal(false);
    const failure = new Error("body subtree render failed");
    let world!: CRCPhysicsWorldHandle3D;
    const Capture = () => {
      world = crcPhysicsWorld3D();
      return undefined;
    };
    const Throw = () => {
      if (fail.get()) throw failure;
      return undefined;
    };
    const MaybeBody = () => visible.get() ? (
      <Group3D physics={dynamicBody3D({ mass: 1, collider: false })}>
        <Throw />
      </Group3D>
    ) : undefined;
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    document.body.appendChild(canvas);
    const mount = crc(canvas, (
      <WebGLLayer style={{ width: 100, height: 100 }}>
        <PhysicsWorld3D gravity={[0, 0, 0]}>
          <Capture />
          <MaybeBody />
        </PhysicsWorld3D>
      </WebGLLayer>
    ));
    mounts.push(mount);
    frames.flush(0);
    const controller = requirePhysicsWorld3DController(world);
    const baseline = snapshotPhysicsBodyFrames3DForTest(controller);
    expect(baseline).toEqual({ frameCount: 0, bodyIds: [] });

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      visible.set(true);
      frames.flush(cycle * 2);
      expect(snapshotPhysicsBodyFrames3DForTest(controller)).toEqual(baseline);
      visible.set(false);
      frames.flush(cycle * 2 + 1);
      expect(snapshotPhysicsBodyFrames3DForTest(controller)).toEqual(baseline);
    }

    visible.set(true);
    fail.set(true);
    expect(() => frames.flush(10)).toThrow(failure);
    expect(snapshotPhysicsBodyFrames3DForTest(controller)).toEqual(baseline);
    mount.dispose();
    mounts.splice(mounts.indexOf(mount), 1);
    expect(snapshotPhysicsBodyFrames3DForTest(controller)).toEqual(baseline);
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
    matrix: Object.freeze(Array.from(new Float32Array([
      scale[0], 0, 0, 0,
      0, scale[1], 0, 0,
      0, 0, scale[2], 0,
      translation[0], translation[1], translation[2], 1,
    ]))),
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

function sameMatrix(
  left: Float32List,
  right: Readonly<ArrayLike<number>>,
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
