import { describe, expect, test } from 'vitest';
import type { CRCBackendFrameInput } from '@crc/core/internal';
import type { ResolvedWebGLCamera } from '../math/camera.js';
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
    const keyboardNavigationBounds = { x: 1, y: 2, width: 3, height: 4 };
    submitWebGLMesh(scene, { componentName: 'Mesh', geometry, localModel: local, color, keyboardNavigationBounds });
    local[12] = 99;
    keyboardNavigationBounds.x = 99;
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
    expect(draft.meshes[0]!.keyboardNavigationBounds).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.meshes)).toBe(true);
    expect(Object.isFrozen(draft.meshes[0])).toBe(true);
  });

  test('owns caller inputs and never invokes an ignored GL-like value', () => {
    const mutableFrame = { ...frame };
    const camera = resolveCamera(undefined, 100, 50);
    const fakeGl = new Proxy({}, { get: () => () => { throw new Error('GL must not be called'); } });
    const scene = createWebGLSceneComposer({ frame: mutableFrame, camera, contextGeneration: 4, gl: fakeGl } as unknown as { frame: CRCBackendFrameInput; camera: ResolvedWebGLCamera; contextGeneration: number });
    const color = [0.2, 0.3, 0.4, 0.5] as [number, number, number, number];
    submitWebGLMesh(scene, { componentName: 'Mesh', geometry, localModel: identity(), color });
    mutableFrame.logicalWidth = 999;
    mutableFrame.renderTimestamp = 999;
    mutateCallerOwnedMatrix(camera.projectionMatrix, 0, 999);
    color[0] = 999;
    const draft = closeWebGLSceneComposer(scene);
    expect(draft.logicalViewport).toEqual({ width: 100, height: 50 });
    expect(draft.timestamp).toBe(123.5);
    expect(draft.camera.projectionMatrix[0]).not.toBe(999);
    expect(draft.meshes[0]!.color).toEqual([0.2, 0.3, 0.4, 0.5]);
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

function mutateCallerOwnedMatrix(
  matrix: Readonly<Float32Array>,
  index: number,
  value: number,
): void {
  (matrix as Float32Array)[index] = value;
}
