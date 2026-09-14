import { crc, createElement, type CRCNode } from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from '@crc/core/internal';
import { describe, expect, it } from 'vitest';
import {
  Cube,
  Mesh,
  Sphere,
  createWebGLGeometry,
  type CRCWebGLLambertMaterial,
} from '../../index.js';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { resolveCamera } from '../math/camera.js';
import {
  closeWebGLSceneComposer,
  createWebGLSceneComposer,
  discardWebGLSceneComposer,
} from '../scene/composer.js';
import type { WebGLSceneComposer } from '../scene/types.js';
import { resolveWebGLMaterial } from './material.js';

describe('Lambert mesh materials', () => {
  it('submits default lit Lambert data without issuing GL work', () => {
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });

    const scene = compose(createElement(Mesh, { geometry }));

    expect(scene.meshes[0]).toMatchObject({
      lit: true,
      material: {
        type: 'lambert',
        emissiveColor: [0, 0, 0, 1],
        emissiveIntensity: 1,
      },
    });
  });

  it('resolves an immutable concrete emissive material while preserving final base alpha', () => {
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const descriptor = {
      type: 'lambert' as const,
      emissiveColor: 'rgba(255, 128, 0, 0.5)',
      emissiveIntensity: 2,
    };
    const material: CRCWebGLLambertMaterial = descriptor;

    const scene = compose(createElement(Mesh, {
      geometry,
      style: { color: 'rgba(0, 255, 0, 0.25)', opacity: 0.5, material },
    }));

    expect(scene.meshes[0]).toMatchObject({
      lit: true,
      color: [0, 1, 0, (64 / 255) * 0.5],
      material: {
        type: 'lambert',
        emissiveColor: [1, 128 / 255, 0, 128 / 255],
        emissiveIntensity: 2,
      },
    });
    expect(Object.isFrozen(scene.meshes[0]!.material)).toBe(true);
    expect(Object.isFrozen(scene.meshes[0]!.material.emissiveColor)).toBe(true);
    descriptor.emissiveIntensity = 9;
    expect(scene.meshes[0]!.material.emissiveIntensity).toBe(2);
  });

  it('allows built-ins to opt out of lighting and reports field-specific validation', () => {
    expect(compose(createElement(Cube, { style: { lit: false } })).meshes[0]?.lit)
      .toBe(false);
    expect(() => compose(
      createElement(Sphere, {
        style: { material: { type: 'lambert', emissiveIntensity: -1 } },
      }),
    )).toThrow('Sphere style.material.emissiveIntensity must be nonnegative');
    expect(() => compose(
      createElement(Mesh, {
        geometry: createWebGLGeometry({
          positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        }),
        style: { lit: 'yes' as unknown as boolean },
      }),
    )).toThrow('Mesh style.lit must be a boolean');
  });

  it.each([
    [{ type: 'phong' }, /Mesh style\.material\.type must be "lambert"/],
    [{ type: 'lambert', roughness: 0.5 }, /Mesh style\.material\.roughness is not supported/],
  ])('rejects closed untyped material input %#', (material, message) => {
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    expect(() => compose(
      createElement(Mesh, { geometry, style: { material } as never }),
    )).toThrow(message);
  });

  it('rejects nonfinite emissive intensity before a mesh is submitted', () => {
    expect(() => resolveWebGLMaterial('Mesh', {
      type: 'lambert',
      emissiveIntensity: Number.NaN,
    })).toThrow('Mesh style.material.emissiveIntensity must be finite');
  });

  it('requires an own Lambert type and rejects explicit nonnumeric intensity', () => {
    expect(() => resolveWebGLMaterial(
      'Mesh',
      Object.create({ type: 'lambert' }) as CRCWebGLLambertMaterial,
    )).toThrow('Mesh style.material.type must be "lambert"');
    expect(() => resolveWebGLMaterial('Mesh', {
      type: 'lambert',
      emissiveIntensity: null as unknown as number,
    })).toThrow('Mesh style.material.emissiveIntensity must be finite');
  });
});

function compose(root: CRCNode) {
  let completed: ReturnType<typeof closeWebGLSceneComposer> | undefined;
  const driver: CRCBackendDriver<WebGLSceneComposer> = {
    token: WEBGL_BACKEND_TOKEN,
    name: 'webgl-test-composer',
    beginFrame(frame) {
      return {
        environment: createWebGLSceneComposer({
          frame,
          camera: resolveCamera(undefined, frame.logicalWidth, frame.logicalHeight),
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
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const mount = mountBackendCRC(new OffscreenCanvas(16, 16), root, {
    parent: parentCanvas,
    logicalWidth: 16,
    logicalHeight: 16,
    driver,
  });

  try {
    executeBackendCRC(mount, root, 1);
    if (!completed) throw new Error('test composer did not complete');
    return completed;
  } finally {
    mount.dispose();
    parent.dispose();
  }
}
