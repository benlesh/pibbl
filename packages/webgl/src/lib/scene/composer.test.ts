import { describe, expect, test } from 'vitest';
import type { CRCBackendFrameInput } from '@crc/core/internal';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { resolveCamera } from '../math/camera.js';
import { closeWebGLSceneComposer, createWebGLSceneComposer, discardWebGLSceneComposer, pushWebGLModelMatrix, submitWebGLMesh } from './composer.js';

const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const translation = (x: number, y: number, z: number) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const frame = { canvas: {} as HTMLCanvasElement, logicalWidth: 100, logicalHeight: 50, backingWidth: 200, backingHeight: 100, renderTimestamp: 123.5 } as CRCBackendFrameInput;
const geometry = createWebGLGeometry({ positions: [-1, 0, 0, 1, 0, 0, 0, 1, 0] });
const composer = () => createWebGLSceneComposer({ frame, camera: resolveCamera(undefined, 100, 50), contextGeneration: 4 });

describe('CPU-only WebGL scene composer', () => {
  test('snapshots frame metadata and owns ordered mesh submissions', () => {
    const scene = composer();
    const local = translation(2, 3, 4);
    const color = [0.1, 0.2, 0.3, 0.4] as const;
    submitWebGLMesh(scene, { componentName: 'Mesh', geometry, localModel: local, color });
    local[12] = 99;
    const second = translation(5, 0, 0);
    submitWebGLMesh(scene, { componentName: 'Cube', geometry, localModel: second, color: [1, 0, 0, 1] });
    const draft = closeWebGLSceneComposer(scene);
    expect(draft.logicalViewport).toEqual({ width: 100, height: 50 });
    expect(draft.backingViewport).toEqual({ width: 200, height: 100 });
    expect(draft.density).toEqual({ x: 2, y: 2 });
    expect(draft.timestamp).toBe(123.5);
    expect(draft.contextGeneration).toBe(4);
    expect(draft.meshes.map((mesh) => mesh.sourceIndex)).toEqual([0, 1]);
    expect(Array.from(draft.meshes[0]!.model)).toEqual(Array.from(translation(2, 3, 4)));
    expect(draft.meshes[0]!.color).toEqual(color);
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.meshes)).toBe(true);
    expect(Object.isFrozen(draft.meshes[0])).toBe(true);
  });

  test('composes nested model scopes and requires LIFO release', () => {
    const scene = composer();
    const outer = pushWebGLModelMatrix(scene, translation(10, 0, 0));
    const inner = pushWebGLModelMatrix(scene, translation(0, 20, 0));
    submitWebGLMesh(scene, { componentName: 'Inner', geometry, localModel: identity(), color: [1, 1, 1, 1] });
    expect(() => outer()).toThrow('released in traversal order');
    inner();
    submitWebGLMesh(scene, { componentName: 'Outer', geometry, localModel: identity(), color: [1, 1, 1, 1] });
    outer();
    const draft = closeWebGLSceneComposer(scene);
    expect(Array.from(draft.meshes[0]!.model)).toEqual(Array.from(translation(10, 20, 0)));
    expect(Array.from(draft.meshes[1]!.model)).toEqual(Array.from(translation(10, 0, 0)));
  });

  test('rejects invalid lifecycle transitions and unbalanced close', () => {
    const scene = composer();
    const release = pushWebGLModelMatrix(scene, identity());
    expect(() => closeWebGLSceneComposer(scene)).toThrow('model stack');
    release();
    closeWebGLSceneComposer(scene);
    expect(() => closeWebGLSceneComposer(scene)).toThrow('already closed');
    expect(() => submitWebGLMesh(scene, { componentName: 'late', geometry, localModel: identity(), color: [1, 1, 1, 1] })).toThrow('already closed');

    const discarded = composer();
    discardWebGLSceneComposer(discarded);
    expect(() => submitWebGLMesh(discarded, { componentName: 'late', geometry, localModel: identity(), color: [1, 1, 1, 1] })).toThrow('already closed');
  });
});
