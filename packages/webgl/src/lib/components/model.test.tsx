import { crc, type CRCNode } from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from '@crc/core/internal';
import { afterEach, describe, expect, it } from 'vitest';
import { Model } from '../../index.js';
import {
  createInternalWebGLAsset,
  getInternalWebGLAssetData,
  releaseInternalWebGLAsset,
} from '../assets/asset.js';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { resolveCamera } from '../math/camera.js';
import { applyWebGLFocusMetadata } from '../pick-ledger.js';
import { pickScene } from '../scene-picker.js';
import { createWebGLSceneComposer, discardWebGLSceneComposer } from '../scene/composer.js';
import { settleWebGLScene, type SettledWebGLScene } from '../scene/settle.js';
import type { WebGLSceneComposer } from '../scene/types.js';

const disposals: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
});

describe('Model', () => {
  it('submits stable asset order with composed transforms and instance overrides', () => {
    const first = triangle(-0.5);
    const second = triangle(0.5);
    const asset = createInternalWebGLAsset({
      primitives: [
        primitive(first, translation(-2, 0, 0), 10),
        primitive(second, translation(3, 0, 0), 20),
      ],
      bounds: { min: [-2.5, -0.5, 0], max: [3.5, 0.5, 0] },
    }, []);
    const root = (
      <Model
        asset={asset}
        onClick={() => undefined}
        keyboardFocusable
        style={{
          translateY: 4,
          scaleX: 2,
          color: 'rgba(128, 64, 32, 0.5)',
          opacity: 0.5,
          castShadow: false,
          receiveShadow: false,
          cursor: 'pointer',
        }}
      />
    );
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 1);
    const scene = mounted.driver.takeScene();

    expect(scene.meshes.map(mesh => mesh.geometry)).toEqual([first, second]);
    expect(scene.meshes.map(mesh => mesh.sourceIndex)).toEqual([0, 1]);
    expect(Array.from(scene.meshes[0]!.model)).toEqual([
      2, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      -4, 4, 0, 1,
    ]);
    expect(Array.from(scene.meshes[1]!.model)).toEqual([
      2, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      6, 4, 0, 1,
    ]);
    expect(scene.meshes.map(mesh => mesh.color)).toEqual([
      [128 / 255, 64 / 255, 32 / 255, (128 / 255) * 0.5],
      [128 / 255, 64 / 255, 32 / 255, (128 / 255) * 0.5],
    ]);
    expect(scene.meshes.every(mesh => mesh.castShadow === false)).toBe(true);
    expect(scene.meshes.every(mesh => mesh.receiveShadow === false)).toBe(true);
    expect(scene.meshes[0]!.material).toMatchObject({
      type: 'pbr-metallic-roughness',
      metallicFactor: 0.25,
      roughnessFactor: 0.75,
    });
    expect(scene.pickEntries).toHaveLength(2);
    expect(scene.pickEntries[0]!.target).toBe(scene.pickEntries[1]!.target);
    expect(scene.meshes[0]!.identity).not.toBe(scene.meshes[1]!.identity);

    releaseInternalWebGLAsset(asset);
  });

  it('shares asset data but keeps instance targets, transforms, and identities independent', () => {
    const geometry = triangle(0);
    const asset = createInternalWebGLAsset({
      primitives: [primitive(geometry, translation(0, 0, 0), 0)],
      bounds: { min: [-0.5, -0.5, 0], max: [0.5, 0.5, 0] },
    }, []);
    const root = [
      <Model key="left" asset={asset} style={{ translateX: -1 }} />,
      <Model key="right" asset={asset} style={{ translateX: 1 }} />,
    ];
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 1);
    const scene = mounted.driver.takeScene();
    releaseInternalWebGLAsset(asset);

    expect(scene.meshes.map(mesh => mesh.geometry)).toEqual([geometry, geometry]);
    expect(scene.meshes[0]!.identity).not.toBe(scene.meshes[1]!.identity);
    expect(scene.pickEntries[0]!.target).not.toBe(scene.pickEntries[1]!.target);
    expect(scene.meshes.map(mesh => mesh.model[12])).toEqual([-1, 1]);
    expect(scene.meshes.every(mesh => mesh.castShadow)).toBe(true);
    expect(scene.meshes.every(mesh => mesh.receiveShadow)).toBe(true);
    expect(getInternalWebGLAssetData(asset).primitives[0]!.geometry).toBe(geometry);

    executeBackendCRC(mounted.mount, <Model asset={asset} />, 2);
    mounted.driver.takeScene();
    expect(getInternalWebGLAssetData(asset).primitives).toHaveLength(1);

    executeBackendCRC(mounted.mount, undefined, 3);
    mounted.driver.takeScene();
    expect(() => getInternalWebGLAssetData(asset))
      .toThrow('WebGL asset descriptor is invalid or released.');
  });

  it('uses one target for nearest-triangle picking and projected focus union', () => {
    const asset = createInternalWebGLAsset({
      primitives: [
        primitive(triangle(0), translation(-1, 0, 0), 0),
        primitive(triangle(0), translation(1, 0, -1), 1),
      ],
      bounds: { min: [-1.5, -0.5, -1], max: [1.5, 0.5, 0] },
    }, []);
    const root = <Model asset={asset} onClick={() => undefined} keyboardFocusable />;
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 1);
    const scene = mounted.driver.takeScene();
    const target = scene.pickEntries[0]!.target;
    const expectedPoints = scene.pickEntries.flatMap(
      entry => entry.keyboardNavigationPoints ?? [],
    );

    expect(scene.pickEntries).toHaveLength(2);
    expect(scene.pickEntries.every(entry => entry.target === target)).toBe(true);
    applyWebGLFocusMetadata({
      logicalViewport: { width: 100, height: 100 },
      entries: scene.pickEntries,
    });
    expect(target.keyboardNavigationPoints).toEqual(expectedPoints);

    const hit = pickScene(
      { logicalViewport: { width: 100, height: 100 }, entries: scene.pickEntries },
      resolveCamera(undefined, 100, 100),
      28,
      50,
      { disposition: 0, target: null },
    );
    expect(hit).toEqual({ disposition: 2, target });

    releaseInternalWebGLAsset(asset);
  });

  it('opts the whole model out of picking and diagnoses expired assets', () => {
    const asset = createInternalWebGLAsset({
      primitives: [primitive(triangle(0), translation(0, 0, 0), 0)],
      bounds: { min: [-0.5, -0.5, 0], max: [0.5, 0.5, 0] },
    }, []);
    const mounted = mountScene(<Model asset={asset} pointerEvents="none" />);

    executeBackendCRC(
      mounted.mount,
      <Model asset={asset} pointerEvents="none" />,
      1,
    );
    expect(mounted.driver.takeScene().pickEntries).toEqual([]);
    releaseInternalWebGLAsset(asset);
    mounted.dispose();

    const expired = createInternalWebGLAsset({
      primitives: [],
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    }, []);
    releaseInternalWebGLAsset(expired);
    const invalid = mountScene(<Model asset={expired} />);
    expect(() => executeBackendCRC(invalid.mount, <Model asset={expired} />, 2))
      .toThrow('Model asset is invalid or released.');
  });
});

function mountScene(root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const driver = createRecordingDriver();
  const mount = mountBackendCRC(new OffscreenCanvas(100, 100), root, {
    parent: parentCanvas,
    logicalWidth: 100,
    logicalHeight: 100,
    driver,
  });
  const dispose = () => {
    mount.dispose();
    parent.dispose();
  };
  disposals.push(dispose);
  return { driver, mount, dispose };
}

function createRecordingDriver(): CRCBackendDriver<WebGLSceneComposer> & {
  takeScene(): SettledWebGLScene;
} {
  let scene: SettledWebGLScene | undefined;
  return {
    token: WEBGL_BACKEND_TOKEN,
    name: 'recording-webgl2',
    beginFrame(frame) {
      return { environment: createWebGLSceneComposer({
        frame,
        camera: resolveCamera(undefined, 100, 100),
        contextGeneration: 1,
        shadowQuality: false,
      }) };
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
      if (success) scene = settleWebGLScene(frame.environment);
      else discardWebGLSceneComposer(frame.environment);
    },
    dispose() {},
    takeScene() {
      if (!scene) throw new Error('No completed recording scene.');
      const value = scene;
      scene = undefined;
      return value;
    },
  };
}

function triangle(offset: number) {
  return createWebGLGeometry({
    positions: [
      -0.5 + offset, -0.5, 0,
      0.5 + offset, -0.5, 0,
      offset, 0.5, 0,
    ],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
  });
}

function primitive(
  geometry: ReturnType<typeof triangle>,
  modelMatrix: Float32Array,
  sourceOrder: number,
) {
  return {
    geometry,
    material: {
      type: 'pbr-metallic-roughness' as const,
      baseColorFactor: [1, 1, 1, 1] as const,
      metallicFactor: 0.25,
      roughnessFactor: 0.75,
    },
    modelMatrix,
    sourceOrder,
  };
}

function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}
