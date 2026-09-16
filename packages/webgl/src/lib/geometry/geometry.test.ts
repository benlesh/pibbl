import { describe, expect, test } from 'vitest';
import { createWebGLGeometry } from '@crc/webgl';
import type { CRCEventTargetRegistration } from '@crc/core/internal';
import { getWebGLGeometryData } from './geometry.js';
import { resolveCamera } from '../math/camera.js';
import {
  createWebGLPickLedger,
  recordGeometryWebGLPick,
} from '../pick-ledger.js';

describe('createWebGLGeometry', () => {
  test('copies indexed triangle data into a frozen opaque descriptor', () => {
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1];
    const indices = [0, 1, 2];

    const geometry = createWebGLGeometry({ positions, normals, indices });
    positions[0] = 99;
    normals[2] = 0;
    indices[0] = 2;

    expect(geometry.vertexCount).toBe(3);
    expect(geometry.triangleCount).toBe(1);
    expect(Object.isFrozen(geometry)).toBe(true);
    expect('positions' in geometry).toBe(false);
    expect('normals' in geometry).toBe(false);
    expect('indices' in geometry).toBe(false);
    expect(getWebGLGeometryData(geometry)).toEqual({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2]),
      bounds: {
        minimumX: 0,
        minimumY: 0,
        minimumZ: 0,
        maximumX: 1,
        maximumY: 1,
        maximumZ: 0,
      },
    });
  });

  test('copies valid normals into descriptor-owned Float32 data', () => {
    const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0];
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals,
    });
    normals[1] = 0;

    expect(Array.from(getWebGLGeometryData(geometry).normals ?? [])).toEqual([
      0, 1, 0, 0, 1, 0, 0, 1, 0,
    ]);
  });

  test('accepts non-indexed triangles and derives their counts', () => {
    const geometry = createWebGLGeometry({
      positions: new Float64Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
        1, 0, 1,
        0, 1, 1,
      ]),
    });

    expect(geometry.vertexCount).toBe(6);
    expect(geometry.triangleCount).toBe(2);
    expect(getWebGLGeometryData(geometry).normals).toBeUndefined();
    expect(getWebGLGeometryData(geometry).indices).toBeUndefined();
  });

  test('caches one finite local AABB without rereading vertices per frame', () => {
    const geometry = createWebGLGeometry({
      positions: [
        -4, 2, -1,
        3, -5, 7,
        1, 6, -2,
      ],
    });
    const data = getWebGLGeometryData(geometry);
    const cachedBounds = (data as unknown as {
      readonly bounds: unknown;
    }).bounds;
    let coordinateReads = 0;
    const positions = new Proxy(data.positions, {
      get(target, property) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          coordinateReads += 1;
        }
        return Reflect.get(target, property, target);
      },
    });
    (data as unknown as { positions: Float32Array }).positions = positions;
    const camera = resolveCamera(undefined, 100, 100);
    const target = { kind: 'target', live: true } as
      CRCEventTargetRegistration;

    for (let frame = 0; frame < 2; frame += 1) {
      const ledger = createWebGLPickLedger(100, 100);
      recordGeometryWebGLPick(ledger, {
        camera,
        componentName: 'CachedBounds',
        depthMode: 'less-equal',
        geometry,
        model: identityMatrix(),
        sourceOrder: 0,
        target,
      });
    }

    expect(cachedBounds).toEqual({
      minimumX: -4,
      minimumY: -5,
      minimumZ: -2,
      maximumX: 3,
      maximumY: 6,
      maximumZ: 7,
    });
    expect(Object.isFrozen(cachedBounds)).toBe(true);
    expect(coordinateReads).toBe(0);
    expect((getWebGLGeometryData(geometry) as unknown as {
      readonly bounds: unknown;
    }).bounds).toBe(cachedBounds);
  });

  test.each([
    [{ positions: [] }, /createWebGLGeometry positions must be nonempty/],
    [{ positions: [0, 0] }, /createWebGLGeometry positions length must be divisible by 3/],
    [{ positions: [0, 0, Number.NaN] }, /createWebGLGeometry positions\[2\] must be finite/],
    [
      { positions: [Number.MAX_VALUE, 0, 0], indices: [0, 0, 0] },
      /createWebGLGeometry positions\[0\] must be representable as a finite Float32/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0] },
      /createWebGLGeometry non-indexed vertex count must be divisible by 3/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1] },
      /createWebGLGeometry indices length must be divisible by 3/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1.5, 2] },
      /createWebGLGeometry indices\[1\] must be a nonnegative integer/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 3] },
      /createWebGLGeometry indices\[2\] must be less than vertexCount 3/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 1, 0] },
      /createWebGLGeometry normals length must match positions.length/,
    ],
    [
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 1, 0, 0, Number.NaN, 0, 0, 1, 0],
      },
      /createWebGLGeometry normals\[4\] must be finite/,
    ],
    [
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, Number.MAX_VALUE, 0, 0, 1, 0, 0, 1, 0],
      },
      /createWebGLGeometry normals\[1\] must be representable as a finite Float32/,
    ],
    [
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 0, 0, 0, 1, 0, 0, 1, 0],
      },
      /createWebGLGeometry normals\[0\.\.2\] must be nonzero/,
    ],
  ])('rejects malformed triangle input %#', (input, message) => {
    expect(() => createWebGLGeometry(input)).toThrow(message);
  });
});

function identityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}
