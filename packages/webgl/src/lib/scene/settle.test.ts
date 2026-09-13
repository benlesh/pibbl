import { describe, expect, test } from 'vitest';
import type { CRCBackendFrameInput, CRCEventTargetRegistration } from '@crc/core/internal';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { resolveCamera } from '../math/camera.js';
import { createWebGLSceneComposer, submitWebGLMesh } from './composer.js';
import { settleWebGLScene } from './settle.js';

const frame = {
  canvas: {} as HTMLCanvasElement,
  logicalWidth: 100,
  logicalHeight: 100,
  backingWidth: 200,
  backingHeight: 200,
  renderTimestamp: 123.5,
} as CRCBackendFrameInput;

const identity = () => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);
const translatedZ = (z: number) => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, z, 1,
]);
const geometry = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
});

describe('settled WebGL scene', () => {
  test('classifies final alpha, sorts transparent bounds centers, and derives shared pick data', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const composer = createWebGLSceneComposer({ frame, camera, contextGeneration: 7 });
    const opaqueFirst = fakeTarget();
    const opaqueSecond = fakeTarget();
    const transparentFar = fakeTarget();
    const transparentTieFirst = fakeTarget();
    const transparentTieLater = fakeTarget();
    const transparentZero = fakeTarget();
    const explicitBounds = { x: 1, y: 2, width: 3, height: 4 };
    const models = [identity(), translatedZ(1), translatedZ(-3), translatedZ(-2), translatedZ(-2), translatedZ(2)];
    const colors = [1, 1, 0.75, 0.25, 0.25, 0] as const;
    const targets = [opaqueFirst, opaqueSecond, transparentFar, transparentTieFirst, transparentTieLater, transparentZero];
    for (let index = 0; index < models.length; index += 1) {
      submitWebGLMesh(composer, {
        componentName: `Mesh${index}`,
        geometry,
        localModel: models[index]!,
        color: [1, 0.5, 0.25, colors[index]!] as const,
        target: targets[index]!,
        keyboardNavigationBounds: index === 1 ? explicitBounds : undefined,
      });
    }

    models.forEach(model => { model[14] = 99; });
    explicitBounds.x = 99;
    camera.projectionMatrix[0] = 99;
    const settled = settleWebGLScene(composer);

    expect(settled.meshes.map(mesh => mesh.sourceIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(settled.opaque.map(mesh => mesh.sourceIndex)).toEqual([0, 1]);
    expect(settled.transparent.map(mesh => mesh.sourceIndex)).toEqual([2, 3, 4]);
    expect(settled.transparent.map(mesh => mesh.viewDepth)).toEqual([8, 7, 7]);
    expect(settled.pickEntries).toHaveLength(6);
    expect(settled.pickEntries.map(entry => entry.sourceOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(settled.pickEntries.every(entry => entry.kind === 'geometry' && entry.depthMode === 'less-equal')).toBe(true);
    expect(settled.pickEntries.map(entry => entry.geometry)).toEqual([geometry, geometry, geometry, geometry, geometry, geometry]);
    expect(settled.pickEntries.map(entry => Array.from(entry.model)[14])).toEqual([0, 1, -3, -2, -2, 2]);
    expect(settled.pickEntries.every(entry => entry.kind === 'geometry' && entry.camera?.projectionMatrix[0] !== 99)).toBe(true);
    expect(settled.pickEntries[1]!.keyboardNavigationBounds).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(settled.pickEntries[0]!.keyboardNavigationPoints).toBeDefined();
    expect(Object.isFrozen(settled)).toBe(true);
    expect(Object.isFrozen(settled.meshes)).toBe(true);
    expect(Object.isFrozen(settled.opaque)).toBe(true);
    expect(Object.isFrozen(settled.transparent)).toBe(true);
    expect(Object.isFrozen(settled.pickEntries)).toBe(true);
  });
});

function fakeTarget(): CRCEventTargetRegistration {
  return { kind: 'target', live: true } as CRCEventTargetRegistration;
}
