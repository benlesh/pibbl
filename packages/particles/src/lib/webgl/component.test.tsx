import { crc, type CRCNode } from "@crc/core";
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from "@crc/core/internal";
import { Group3D } from "@crc/webgl";
import { describe, expect, it } from "vitest";
import { Particles3D, defineParticleEffect3D } from "../../webgl.js";
import { WEBGL_BACKEND_TOKEN } from "../../../../webgl/src/lib/backend.js";
import { resolveCamera } from "../../../../webgl/src/lib/math/camera.js";
import {
  closeWebGLSceneComposer,
  createWebGLSceneComposer,
  discardWebGLSceneComposer,
} from "../../../../webgl/src/lib/scene/composer.js";
import type {
  ClosedWebGLSceneDraft,
  WebGLSceneComposer,
} from "../../../../webgl/src/lib/scene/types.js";

const effect = defineParticleEffect3D({
  emitters: [
    {
      name: "embers",
      capacity: 128,
      emission: [{ type: "rate", particlesPerSecond: 20 }],
      shape: { type: "point" },
      initial: { lifetimeMilliseconds: 1_000, size: 5 },
      renderer: {
        type: "point",
        material: "emissive",
        blend: "additive",
      },
    },
  ],
});

describe("Particles3D", () => {
  it("contributes an instanced recipe through Group3D ancestry without GL work", () => {
    const scene = compose(
      <Group3D style={{ translateX: 3 }}>
        <Particles3D
          effect={effect}
          pointerEvents="none"
          style={{ translateY: 2, opacity: 0.75 }}
        />
      </Group3D>,
    );

    expect(scene.instanced).toHaveLength(1);
    expect(scene.instanced[0]).toMatchObject({
      componentName: "Particles3D(embers)",
      opacity: 0.75,
      material: { type: "emissive", blend: "additive" },
      depthTest: true,
      depthWrite: false,
      sorting: "none",
    });
    expect(Array.from(scene.instanced[0]!.model)).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      3, 2, 0, 1,
    ]);
    expect(scene.instanced[0]!.recipe.capacity).toBe(128);
    expect(scene.instanced[0]!.frameUniforms[3]).toBe(0);
    expect(scene.instanced[0]!.target).toBeUndefined();
  });

  it("requires an explicit interaction volume for default pointer participation", () => {
    expect(() => compose(<Particles3D effect={effect} />)).toThrowError(
      /Particles3D.*interactionBounds.*pointerEvents.*none/i,
    );
  });

  it("rejects unavailable CPU WebGL execution before scene submission", () => {
    expect(() =>
      compose(
        <Particles3D
          effect={effect}
          execution="cpu"
          pointerEvents="none"
        />,
      ),
    ).toThrowError(/Particles3D.*CPU WebGL execution.*not available/i);
  });
});

function compose(root: CRCNode): ClosedWebGLSceneDraft {
  let completed: ClosedWebGLSceneDraft | undefined;
  const driver: CRCBackendDriver<WebGLSceneComposer> = {
    token: WEBGL_BACKEND_TOKEN,
    name: "particles-webgl-test-composer",
    beginFrame(frame) {
      return {
        environment: createWebGLSceneComposer({
          frame,
          camera: resolveCamera(
            undefined,
            frame.logicalWidth,
            frame.logicalHeight,
          ),
          contextGeneration: 1,
        }),
      };
    },
    enterComponent() {
      return () => undefined;
    },
    runPrimitive(frame, input, runProgram) {
      const program = input.definition.program as CRCBackendPrimitiveProgram<
        Record<PropertyKey, unknown>,
        Record<PropertyKey, unknown>,
        WebGLSceneComposer
      >;
      runProgram(() => program(input.props, input.style, frame.environment));
    },
    finishFrame(frame, success) {
      if (success) completed = closeWebGLSceneComposer(frame.environment);
      else discardWebGLSceneComposer(frame.environment);
    },
    dispose() {},
  };
  const parentCanvas = document.createElement("canvas");
  const parent = crc(parentCanvas, undefined);
  const mount = mountBackendCRC(new OffscreenCanvas(64, 64), root, {
    parent: parentCanvas,
    logicalWidth: 64,
    logicalHeight: 64,
    driver,
  });
  try {
    executeBackendCRC(mount, root, 1);
    if (!completed) throw new Error("particle test composer did not complete");
    return completed;
  } finally {
    mount.dispose();
    parent.dispose();
  }
}
