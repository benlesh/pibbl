import { crc, type CRCNode } from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, Model } from '../../index.js';
import {
  acquireInternalWebGLAsset,
  createInternalWebGLAsset,
  getInternalWebGLAssetData,
  releaseInternalWebGLAsset,
} from '../assets/asset.js';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { WebGLRendererResourceCache } from '../gpu/renderer-resources.js';
import { resolveCamera } from '../math/camera.js';
import { applyWebGLFocusMetadata } from '../pick-ledger.js';
import { pickScene } from '../scene-picker.js';
import { createWebGLSceneComposer, discardWebGLSceneComposer } from '../scene/composer.js';
import { settleWebGLScene, type SettledWebGLScene } from '../scene/settle.js';
import type { WebGLSceneComposer } from '../scene/types.js';
import {
  createInternalWebGLTexture,
  getInternalWebGLTextureData,
} from '../texture/texture.js';

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
        primitive(
          first,
          translation(-2, 0, 0),
          10,
          [0.5, 0.25, 0.75, 0.4],
        ),
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
    expect(scene.meshes[0]!.shading).toMatchObject({
      kind: 'pbr-metallic-roughness',
      linearBaseColorFactor: [
        expect.closeTo(0.1079302501, 9),
        expect.closeTo(0.0128173646, 9),
        expect.closeTo(0.0108328827, 9),
        expect.closeTo((128 / 255) * 0.5 * 0.4, 9),
      ],
    });
    expect(scene.pickEntries).toHaveLength(2);
    expect(scene.pickEntries[0]!.target).toBe(scene.pickEntries[1]!.target);
    expect(scene.meshes[0]!.identity).not.toBe(scene.meshes[1]!.identity);

    releaseInternalWebGLAsset(asset);
  });

  it('keeps the stored primitive matrix immutable across future Model renders', () => {
    const asset = createInternalWebGLAsset({
      primitives: [primitive(triangle(0), translation(2, 0, 0), 0)],
      bounds: { min: [1.5, -0.5, 0], max: [2.5, 0.5, 0] },
    }, []);
    const stored = getInternalWebGLAssetData(asset)
      .primitives[0]!.modelMatrix as { [index: number]: number };

    expect(() => {
      stored[12] = 99;
    }).toThrow(TypeError);

    const root = <Model asset={asset} style={{ translateY: 3 }} />;
    const mounted = mountScene(root);
    executeBackendCRC(mounted.mount, root, 1);
    expect(Array.from(mounted.driver.takeScene().meshes[0]!.model)).toEqual([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      2, 3, 0, 1,
    ]);
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
    const root = [
      <Model
        key="model"
        asset={asset}
        onClick={() => undefined}
        keyboardFocusable
      />,
      <Mesh
        key="far-mesh"
        geometry={triangle(0)}
        onClick={() => undefined}
        style={{ translateX: -1, translateZ: -1, lit: false }}
      />,
    ];
    const mounted = mountScene(root);

    executeBackendCRC(mounted.mount, root, 1);
    const scene = mounted.driver.takeScene();
    const target = scene.pickEntries[0]!.target;
    const modelEntries = scene.pickEntries.filter(entry => entry.target === target);
    const expectedPoints = modelEntries.flatMap(
      entry => entry.keyboardNavigationPoints ?? [],
    );

    expect(scene.pickEntries).toHaveLength(3);
    expect(modelEntries).toHaveLength(2);
    expect(scene.pickEntries[2]!.target).not.toBe(target);
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

  it('shares resources per context while independent layer consumers release exactly', () => {
    const firstContext = realWebGL2Context();
    const secondContext = realWebGL2Context();
    const textureSurface = new OffscreenCanvas(2, 2);
    textureSurface.getContext('2d');
    const bitmap = textureSurface.transferToImageBitmap();
    const textureProducer = createInternalWebGLTexture(bitmap);
    const geometry = createWebGLGeometry({
      positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      textureCoordinates0: [0, 0, 1, 0, 0.5, 1],
    });
    const asset = createInternalWebGLAsset({
      primitives: [primitive(
        geometry,
        translation(0, 0, 0),
        0,
        [1, 1, 1, 1],
        textureProducer.texture,
      )],
      bounds: { min: [-0.5, -0.5, 0], max: [0.5, 0.5, 0] },
    }, [textureProducer.texture]);
    const releaseFirstLayer = acquireInternalWebGLAsset(asset);
    const releaseSecondLayer = acquireInternalWebGLAsset(asset);
    const firstCache = new WebGLRendererResourceCache(firstContext, 1);
    const secondCache = new WebGLRendererResourceCache(secondContext, 1);
    const data = getInternalWebGLAssetData(asset);
    const primitiveData = data.primitives[0]!;

    const firstFrame = firstCache.beginRender();
    const firstGeometry = firstFrame.useGeometry(primitiveData.geometry, 'Model');
    const firstTexture = firstFrame.useTexture(
      primitiveData.material.baseColorTexture!.texture,
      'Model',
    );
    expect(firstFrame.useGeometry(primitiveData.geometry, 'Model'))
      .toBe(firstGeometry);
    expect(firstFrame.useTexture(
      primitiveData.material.baseColorTexture!.texture,
      'Model',
    )).toBe(firstTexture);
    firstFrame.commit();
    const firstReuse = firstCache.beginRender();
    expect(firstReuse.useGeometry(primitiveData.geometry, 'Model'))
      .toBe(firstGeometry);
    expect(firstReuse.useTexture(
      primitiveData.material.baseColorTexture!.texture,
      'Model',
    )).toBe(firstTexture);
    firstReuse.commit();

    const secondFrame = secondCache.beginRender();
    const secondGeometry = secondFrame.useGeometry(primitiveData.geometry, 'Model');
    const secondTexture = secondFrame.useTexture(
      primitiveData.material.baseColorTexture!.texture,
      'Model',
    );
    secondFrame.commit();
    expect(secondGeometry).not.toBe(firstGeometry);
    expect(secondTexture).not.toBe(firstTexture);

    textureProducer.release();
    releaseInternalWebGLAsset(asset);
    releaseFirstLayer();
    expect(getInternalWebGLAssetData(asset)).toBe(data);
    releaseSecondLayer();
    expect(() => getInternalWebGLAssetData(asset))
      .toThrow('WebGL asset descriptor is invalid or released.');
    expect(getInternalWebGLTextureData(textureProducer.texture).bitmap)
      .toBe(bitmap);

    firstCache.beginRender().commit();
    expect(getInternalWebGLTextureData(textureProducer.texture).bitmap)
      .toBe(bitmap);
    secondCache.beginRender().commit();
    expect(() => getInternalWebGLTextureData(textureProducer.texture))
      .toThrow('WebGL texture descriptor is invalid or released.');
    firstCache.dispose(false);
    secondCache.dispose(false);
  });

  it('holds independent leases for Model instances in separate layer mounts', () => {
    const close = vi.fn();
    const textureProducer = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close,
    } as unknown as ImageBitmap);
    const asset = createInternalWebGLAsset({
      primitives: [primitive(
        triangle(0),
        translation(0, 0, 0),
        0,
        [1, 1, 1, 1],
        textureProducer.texture,
      )],
      bounds: { min: [-0.5, -0.5, 0], max: [0.5, 0.5, 0] },
    }, [textureProducer.texture]);
    const firstLayer = mountScene(<Model asset={asset} />);
    const secondLayer = mountScene(<Model asset={asset} />);
    executeBackendCRC(firstLayer.mount, <Model asset={asset} />, 1);
    firstLayer.driver.takeScene();
    executeBackendCRC(secondLayer.mount, <Model asset={asset} />, 1);
    secondLayer.driver.takeScene();
    textureProducer.release();
    releaseInternalWebGLAsset(asset);

    executeBackendCRC(firstLayer.mount, undefined, 2);
    firstLayer.driver.takeScene();
    expect(getInternalWebGLAssetData(asset).primitives).toHaveLength(1);
    expect(close).not.toHaveBeenCalled();

    executeBackendCRC(secondLayer.mount, undefined, 2);
    secondLayer.driver.takeScene();
    expect(() => getInternalWebGLAssetData(asset))
      .toThrow('WebGL asset descriptor is invalid or released.');
    expect(close).toHaveBeenCalledOnce();
  });

  it('acquires a replacement before releasing the previous Model asset', () => {
    let nextAsset: ReturnType<typeof createInternalWebGLAsset>;
    let nextWasLiveDuringPreviousRelease = false;
    const previousTexture = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close() {
        releaseInternalWebGLAsset(nextAsset);
        nextWasLiveDuringPreviousRelease =
          getInternalWebGLAssetData(nextAsset).primitives.length === 1;
      },
    } as unknown as ImageBitmap);
    const previousAsset = createInternalWebGLAsset({
      primitives: [primitive(
        triangle(0),
        translation(-1, 0, 0),
        0,
        [1, 1, 1, 1],
        previousTexture.texture,
      )],
      bounds: { min: [-1.5, -0.5, 0], max: [-0.5, 0.5, 0] },
    }, [previousTexture.texture]);
    nextAsset = createInternalWebGLAsset({
      primitives: [primitive(triangle(0), translation(1, 0, 0), 0)],
      bounds: { min: [0.5, -0.5, 0], max: [1.5, 0.5, 0] },
    }, []);
    const mounted = mountScene(<Model asset={previousAsset} />);
    executeBackendCRC(mounted.mount, <Model asset={previousAsset} />, 1);
    mounted.driver.takeScene();
    previousTexture.release();
    releaseInternalWebGLAsset(previousAsset);

    executeBackendCRC(mounted.mount, <Model asset={nextAsset} />, 2);
    expect(mounted.driver.takeScene().meshes[0]!.model[12]).toBe(1);
    expect(nextWasLiveDuringPreviousRelease).toBe(true);
    expect(getInternalWebGLAssetData(nextAsset).primitives).toHaveLength(1);

    executeBackendCRC(mounted.mount, undefined, 3);
    mounted.driver.takeScene();
    expect(() => getInternalWebGLAssetData(nextAsset))
      .toThrow('WebGL asset descriptor is invalid or released.');
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
  baseColorFactor: readonly [number, number, number, number] = [1, 1, 1, 1],
  texture?: ReturnType<typeof createInternalWebGLTexture>['texture'],
) {
  return {
    geometry,
    material: {
      type: 'pbr-metallic-roughness' as const,
      baseColorFactor,
      ...(texture === undefined ? {} : {
        baseColorTexture: { texture, textureCoordinate: 0 as const },
      }),
      metallicFactor: 0.25,
      roughnessFactor: 0.75,
    },
    modelMatrix,
    sourceOrder,
  };
}

function realWebGL2Context(): WebGL2RenderingContext {
  const gl = new OffscreenCanvas(4, 4).getContext('webgl2', {
    alpha: true,
    depth: true,
    premultipliedAlpha: true,
  });
  if (!gl) throw new Error('WebGL2 is required by this ownership test.');
  return gl;
}

function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}
