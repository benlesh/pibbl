import { describe, expect, test } from 'vitest';
import type { CRCWebGLPerspectiveCamera } from '../types.js';
import { resolveCamera } from './camera.js';
import { transformPointMatrix4 } from './matrix4.js';

const DEFAULT_CAMERA: CRCWebGLPerspectiveCamera = {
  type: 'perspective',
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  up: [0, 1, 0],
  fieldOfViewDegrees: 50,
  near: 0.1,
  far: 1000,
};

describe('resolveCamera', () => {
  test('resolves the exact omitted camera and logical viewport aspect', () => {
    const camera = resolveCamera(undefined, 640, 320);

    expect(camera.descriptor).toEqual(DEFAULT_CAMERA);
    expect(camera.aspect).toBe(2);
    expect(camera.viewport).toEqual({ width: 640, height: 320 });
    expect(camera.generationValues).toEqual([
      0, 0, 5,
      0, 0, 0,
      0, 1, 0,
      50, 0.1, 1000,
      640, 320,
    ]);
    expect(Object.isFrozen(camera)).toBe(true);
    expect(Object.isFrozen(camera.descriptor)).toBe(true);
    expect(Object.isFrozen(camera.descriptor.position)).toBe(true);
    expect(Object.isFrozen(camera.viewport)).toBe(true);
    expect(Object.isFrozen(camera.generationValues)).toBe(true);
  });

  test('defensively snapshots an explicit descriptor', () => {
    const position: [number, number, number] = [1, 2, 6];
    const descriptor: CRCWebGLPerspectiveCamera = {
      ...DEFAULT_CAMERA,
      position,
      fieldOfViewDegrees: 60,
    };
    const camera = resolveCamera(descriptor, 300, 200);
    position[0] = 99;

    expect(camera.descriptor.position).toEqual([1, 2, 6]);
    expect(camera.descriptor).not.toBe(descriptor);
    expect(camera.aspect).toBe(1.5);
  });

  test.each([
    [{ ...DEFAULT_CAMERA, type: 'orthographic' }, /WebGLLayer camera.type/],
    [{ ...DEFAULT_CAMERA, position: [0, 0] }, /WebGLLayer camera.position/],
    [{ ...DEFAULT_CAMERA, position: [0, 0, Number.NaN] }, /WebGLLayer camera.position/],
    [{ ...DEFAULT_CAMERA, lookAt: [0, Number.POSITIVE_INFINITY, 0] }, /WebGLLayer camera.lookAt/],
    [{ ...DEFAULT_CAMERA, up: [0, 1] }, /WebGLLayer camera.up/],
    [{ ...DEFAULT_CAMERA, fieldOfViewDegrees: Number.NaN }, /WebGLLayer camera.fieldOfViewDegrees/],
    [{ ...DEFAULT_CAMERA, fieldOfViewDegrees: 0 }, /WebGLLayer camera.fieldOfViewDegrees/],
    [{ ...DEFAULT_CAMERA, fieldOfViewDegrees: 180 }, /WebGLLayer camera.fieldOfViewDegrees/],
    [{ ...DEFAULT_CAMERA, near: Number.NaN }, /WebGLLayer camera.near/],
    [{ ...DEFAULT_CAMERA, near: 0 }, /WebGLLayer camera.near/],
    [{ ...DEFAULT_CAMERA, far: Number.POSITIVE_INFINITY }, /WebGLLayer camera.far/],
    [{ ...DEFAULT_CAMERA, far: 0.1 }, /WebGLLayer camera.far/],
    [{ ...DEFAULT_CAMERA, lookAt: [0, 0, 5] }, /WebGLLayer camera.lookAt/],
    [{ ...DEFAULT_CAMERA, up: [0, 0, 0] }, /WebGLLayer camera.up/],
    [{ ...DEFAULT_CAMERA, up: [0, 0, 2] }, /WebGLLayer camera.up/],
  ])('rejects an invalid camera rule %#', (camera, message) => {
    expect(() => resolveCamera(camera as CRCWebGLPerspectiveCamera, 100, 100)).toThrow(message);
  });

  test.each([
    [
      'fieldOfViewDegrees',
      { ...DEFAULT_CAMERA, fieldOfViewDegrees: Number.MIN_VALUE },
      /WebGLLayer camera\.fieldOfViewDegrees must produce a finite nonzero Float32 projection scale/,
    ],
    [
      'near (underflow)',
      { ...DEFAULT_CAMERA, near: Number.MIN_VALUE, far: 1 },
      /WebGLLayer camera\.near must produce a finite nonzero Float32 projection depth/,
    ],
    [
      'near (overflow)',
      { ...DEFAULT_CAMERA, near: 2e38, far: 4e38 },
      /WebGLLayer camera\.near must produce a finite nonzero Float32 projection depth/,
    ],
    [
      'far',
      { ...DEFAULT_CAMERA, near: 1e23, far: 1e23 + 2e7 },
      /WebGLLayer camera\.far must remain sufficiently separated from camera\.near for a finite Float32 projection/,
    ],
    [
      'far (overflow)',
      { ...DEFAULT_CAMERA, far: Number.MAX_VALUE },
      /WebGLLayer camera\.far must be representable as a finite Float32 projection distance/,
    ],
  ])('attributes an unrepresentable projection to camera.%s', (_field, camera, message) => {
    expect(() => resolveCamera(camera, 100, 100)).toThrow(message);
  });

  test('preserves a large finite far plane when its Float32 projection remains representable', () => {
    const camera = resolveCamera({ ...DEFAULT_CAMERA, far: 3e38 }, 100, 100);

    expect(Array.from(camera.projectionMatrix).every(Number.isFinite)).toBe(true);
    expect(camera.projectionMatrix[10]).toBeCloseTo(-1, 6);
    expect(camera.projectionMatrix[14]).toBeCloseTo(-0.2, 6);
  });

  test('preserves close large planes when their completed projection remains representable', () => {
    const camera = resolveCamera(
      { ...DEFAULT_CAMERA, near: 1e20, far: 1e20 + 1e6 },
      100,
      100,
    );

    expect(camera.projectionMatrix[10]).toBe(-200115260227584);
    expect(camera.projectionMatrix[14]).toBe(-2.0011526040135322e34);
    expect(Array.from(camera.inverseProjectionViewMatrix).every(Number.isFinite)).toBe(true);
  });

  test.each([
    [0, 100],
    [100, 0],
    [Number.NaN, 100],
    [100, Number.POSITIVE_INFINITY],
  ])('rejects an invalid logical viewport (%s, %s)', (width, height) => {
    expect(() => resolveCamera(undefined, width, height)).toThrow(/WebGLLayer (width|height)/);
  });

  test('projects every corner of a unit cube inside the default clip volume', () => {
    const camera = resolveCamera(undefined, 800, 600);
    const projected = new Float32Array(3);

    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) {
        for (const z of [-0.5, 0.5]) {
          transformPointMatrix4(projected, camera.projectionViewMatrix, [x, y, z]);
          expect(Math.abs(projected[0]!)).toBeLessThan(1);
          expect(Math.abs(projected[1]!)).toBeLessThan(1);
          expect(projected[2]).toBeGreaterThan(-1);
          expect(projected[2]).toBeLessThan(1);
        }
      }
    }
  });
});
