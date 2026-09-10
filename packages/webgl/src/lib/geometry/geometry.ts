import type { CRCWebGLGeometry, CRCWebGLGeometryInput } from '../types.js';

export interface WebGLGeometryData {
  readonly positions: Float32Array;
  readonly indices: Uint32Array | undefined;
}

const geometryBrand = Symbol('CRCWebGLGeometry');
const geometryData = new WeakMap<CRCWebGLGeometry, WebGLGeometryData>();

/** Identifies the package's immutable opaque geometry descriptors. */
export function isWebGLGeometry(value: unknown): value is CRCWebGLGeometry {
  return typeof value === 'object' &&
    value !== null &&
    geometryData.has(value as CRCWebGLGeometry);
}

const getLength = (values: ArrayLike<number>, field: string): number => {
  const { length } = values;
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new TypeError(`createWebGLGeometry ${field} length must be a nonnegative safe integer.`);
  }
  return length;
};

export function createWebGLGeometry(input: CRCWebGLGeometryInput): CRCWebGLGeometry {
  const positionLength = getLength(input.positions, 'positions');
  if (positionLength === 0) {
    throw new TypeError('createWebGLGeometry positions must be nonempty.');
  }
  if (positionLength % 3 !== 0) {
    throw new TypeError('createWebGLGeometry positions length must be divisible by 3.');
  }

  const positions = new Float32Array(positionLength);
  for (let index = 0; index < positionLength; index += 1) {
    const value = input.positions[index];
    if (!Number.isFinite(value)) {
      throw new TypeError(`createWebGLGeometry positions[${index}] must be finite.`);
    }
    const copiedValue = Math.fround(value!);
    if (!Number.isFinite(copiedValue)) {
      throw new RangeError(
        `createWebGLGeometry positions[${index}] must be representable as a finite Float32.`,
      );
    }
    positions[index] = copiedValue;
  }

  const vertexCount = positionLength / 3;
  let indices: Uint32Array | undefined;
  let triangleCount: number;

  if (input.indices === undefined) {
    if (vertexCount % 3 !== 0) {
      throw new TypeError(
        'createWebGLGeometry non-indexed vertex count must be divisible by 3.',
      );
    }
    triangleCount = vertexCount / 3;
  } else {
    const indexLength = getLength(input.indices, 'indices');
    if (indexLength % 3 !== 0) {
      throw new TypeError('createWebGLGeometry indices length must be divisible by 3.');
    }
    indices = new Uint32Array(indexLength);
    for (let index = 0; index < indexLength; index += 1) {
      const value = input.indices[index];
      if (!Number.isSafeInteger(value) || value! < 0) {
        throw new TypeError(
          `createWebGLGeometry indices[${index}] must be a nonnegative integer.`,
        );
      }
      if (value! >= vertexCount) {
        throw new RangeError(
          `createWebGLGeometry indices[${index}] must be less than vertexCount ${vertexCount}.`,
        );
      }
      indices[index] = value!;
    }
    triangleCount = indexLength / 3;
  }

  const geometry = Object.freeze({
    [geometryBrand]: true,
    vertexCount,
    triangleCount,
  }) as unknown as CRCWebGLGeometry;
  geometryData.set(geometry, { positions, indices });
  return geometry;
}

export function getWebGLGeometryData(geometry: CRCWebGLGeometry): WebGLGeometryData {
  const data = geometryData.get(geometry);
  if (data === undefined) {
    throw new TypeError('Expected geometry created by createWebGLGeometry.');
  }
  return data;
}
