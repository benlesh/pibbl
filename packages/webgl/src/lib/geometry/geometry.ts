import type { CRCWebGLGeometry, CRCWebGLGeometryInput } from '../types.js';

export interface WebGLGeometryData {
  readonly positions: Float32Array;
  readonly normals: Float32Array | undefined;
  readonly indices: Uint32Array | undefined;
  readonly bounds: Readonly<{
    minimumX: number;
    minimumY: number;
    minimumZ: number;
    maximumX: number;
    maximumY: number;
    maximumZ: number;
  }>;
}

export interface WebGLGeometrySnapshot {
  readonly positions: readonly number[];
  readonly indices: readonly number[] | undefined;
  readonly bounds: WebGLGeometryData['bounds'];
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
  let minimumX = Number.POSITIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;
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
    switch (index % 3) {
      case 0:
        minimumX = Math.min(minimumX, copiedValue);
        maximumX = Math.max(maximumX, copiedValue);
        break;
      case 1:
        minimumY = Math.min(minimumY, copiedValue);
        maximumY = Math.max(maximumY, copiedValue);
        break;
      case 2:
        minimumZ = Math.min(minimumZ, copiedValue);
        maximumZ = Math.max(maximumZ, copiedValue);
        break;
    }
  }
  const bounds = Object.freeze({
    minimumX,
    minimumY,
    minimumZ,
    maximumX,
    maximumY,
    maximumZ,
  });

  const vertexCount = positionLength / 3;
  let normals: Float32Array | undefined;
  if (input.normals !== undefined) {
    const normalLength = getLength(input.normals, 'normals');
    if (normalLength !== positionLength) {
      throw new TypeError('createWebGLGeometry normals length must match positions.length.');
    }
    normals = new Float32Array(normalLength);
    for (let index = 0; index < normalLength; index += 1) {
      const value = input.normals[index];
      if (!Number.isFinite(value)) {
        throw new TypeError(`createWebGLGeometry normals[${index}] must be finite.`);
      }
      const copiedValue = Math.fround(value!);
      if (!Number.isFinite(copiedValue)) {
        throw new RangeError(
          `createWebGLGeometry normals[${index}] must be representable as a finite Float32.`,
        );
      }
      normals[index] = copiedValue;
    }
    for (let index = 0; index < normalLength; index += 3) {
      const maximumComponent = Math.max(
        Math.abs(normals[index]!),
        Math.abs(normals[index + 1]!),
        Math.abs(normals[index + 2]!),
      );
      if (maximumComponent === 0) {
        throw new TypeError(`createWebGLGeometry normals[${index}..${index + 2}] must be nonzero.`);
      }
      const scaledX = normals[index]! / maximumComponent;
      const scaledY = normals[index + 1]! / maximumComponent;
      const scaledZ = normals[index + 2]! / maximumComponent;
      const scaledLengthSquared = scaledX * scaledX + scaledY * scaledY + scaledZ * scaledZ;
      if (!Number.isFinite(scaledLengthSquared) || scaledLengthSquared === 0) {
        throw new TypeError(`createWebGLGeometry normals[${index}..${index + 2}] must be nonzero.`);
      }
    }
  }

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
  geometryData.set(geometry, { positions, normals, indices, bounds });
  return geometry;
}

export function getWebGLGeometryData(geometry: CRCWebGLGeometry): WebGLGeometryData {
  const data = geometryData.get(geometry);
  if (data === undefined) {
    throw new TypeError('Expected geometry created by createWebGLGeometry.');
  }
  return data;
}

/** Returns an ownership-isolated immutable CPU snapshot for official friends. */
export function getWebGLGeometrySnapshot(
  geometry: CRCWebGLGeometry,
): WebGLGeometrySnapshot {
  const data = getWebGLGeometryData(geometry);
  return Object.freeze({
    positions: Object.freeze(Array.from(data.positions)),
    indices: data.indices === undefined ?
      undefined : Object.freeze(Array.from(data.indices)),
    bounds: Object.freeze({ ...data.bounds }),
  });
}
