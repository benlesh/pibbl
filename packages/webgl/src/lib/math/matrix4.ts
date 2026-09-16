import type { CRCWebGLTransformStyle, CRCWebGLVector3 } from '../types.js';

type WritableNumbers = { [index: number]: number };

const DEGREES_TO_RADIANS = Math.PI / 180;

export function setIdentityMatrix4<T extends WritableNumbers>(destination: T): T {
  destination[0] = 1;
  destination[1] = 0;
  destination[2] = 0;
  destination[3] = 0;
  destination[4] = 0;
  destination[5] = 1;
  destination[6] = 0;
  destination[7] = 0;
  destination[8] = 0;
  destination[9] = 0;
  destination[10] = 1;
  destination[11] = 0;
  destination[12] = 0;
  destination[13] = 0;
  destination[14] = 0;
  destination[15] = 1;
  return destination;
}

export function multiplyMatrix4<T extends WritableNumbers>(
  destination: T,
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): T {
  const a00 = left[0]!;
  const a01 = left[1]!;
  const a02 = left[2]!;
  const a03 = left[3]!;
  const a10 = left[4]!;
  const a11 = left[5]!;
  const a12 = left[6]!;
  const a13 = left[7]!;
  const a20 = left[8]!;
  const a21 = left[9]!;
  const a22 = left[10]!;
  const a23 = left[11]!;
  const a30 = left[12]!;
  const a31 = left[13]!;
  const a32 = left[14]!;
  const a33 = left[15]!;
  const b00 = right[0]!;
  const b01 = right[1]!;
  const b02 = right[2]!;
  const b03 = right[3]!;
  const b10 = right[4]!;
  const b11 = right[5]!;
  const b12 = right[6]!;
  const b13 = right[7]!;
  const b20 = right[8]!;
  const b21 = right[9]!;
  const b22 = right[10]!;
  const b23 = right[11]!;
  const b30 = right[12]!;
  const b31 = right[13]!;
  const b32 = right[14]!;
  const b33 = right[15]!;

  destination[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
  destination[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
  destination[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
  destination[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;
  destination[4] = a00 * b10 + a10 * b11 + a20 * b12 + a30 * b13;
  destination[5] = a01 * b10 + a11 * b11 + a21 * b12 + a31 * b13;
  destination[6] = a02 * b10 + a12 * b11 + a22 * b12 + a32 * b13;
  destination[7] = a03 * b10 + a13 * b11 + a23 * b12 + a33 * b13;
  destination[8] = a00 * b20 + a10 * b21 + a20 * b22 + a30 * b23;
  destination[9] = a01 * b20 + a11 * b21 + a21 * b22 + a31 * b23;
  destination[10] = a02 * b20 + a12 * b21 + a22 * b22 + a32 * b23;
  destination[11] = a03 * b20 + a13 * b21 + a23 * b22 + a33 * b23;
  destination[12] = a00 * b30 + a10 * b31 + a20 * b32 + a30 * b33;
  destination[13] = a01 * b30 + a11 * b31 + a21 * b32 + a31 * b33;
  destination[14] = a02 * b30 + a12 * b31 + a22 * b32 + a32 * b33;
  destination[15] = a03 * b30 + a13 * b31 + a23 * b32 + a33 * b33;
  return destination;
}

export function invertMatrix4<T extends WritableNumbers>(
  destination: T,
  matrix: ArrayLike<number>,
): T | undefined {
  const a00 = matrix[0]!;
  const a01 = matrix[1]!;
  const a02 = matrix[2]!;
  const a03 = matrix[3]!;
  const a10 = matrix[4]!;
  const a11 = matrix[5]!;
  const a12 = matrix[6]!;
  const a13 = matrix[7]!;
  const a20 = matrix[8]!;
  const a21 = matrix[9]!;
  const a22 = matrix[10]!;
  const a23 = matrix[11]!;
  const a30 = matrix[12]!;
  const a31 = matrix[13]!;
  const a32 = matrix[14]!;
  const a33 = matrix[15]!;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const determinant =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!Number.isFinite(determinant) || determinant === 0) {
    return undefined;
  }
  const reciprocal = 1 / determinant;
  destination[0] = (a11 * b11 - a12 * b10 + a13 * b09) * reciprocal;
  destination[1] = (a02 * b10 - a01 * b11 - a03 * b09) * reciprocal;
  destination[2] = (a31 * b05 - a32 * b04 + a33 * b03) * reciprocal;
  destination[3] = (a22 * b04 - a21 * b05 - a23 * b03) * reciprocal;
  destination[4] = (a12 * b08 - a10 * b11 - a13 * b07) * reciprocal;
  destination[5] = (a00 * b11 - a02 * b08 + a03 * b07) * reciprocal;
  destination[6] = (a32 * b02 - a30 * b05 - a33 * b01) * reciprocal;
  destination[7] = (a20 * b05 - a22 * b02 + a23 * b01) * reciprocal;
  destination[8] = (a10 * b10 - a11 * b08 + a13 * b06) * reciprocal;
  destination[9] = (a01 * b08 - a00 * b10 - a03 * b06) * reciprocal;
  destination[10] = (a30 * b04 - a31 * b02 + a33 * b00) * reciprocal;
  destination[11] = (a21 * b02 - a20 * b04 - a23 * b00) * reciprocal;
  destination[12] = (a11 * b07 - a10 * b09 - a12 * b06) * reciprocal;
  destination[13] = (a00 * b09 - a01 * b07 + a02 * b06) * reciprocal;
  destination[14] = (a31 * b01 - a30 * b03 - a32 * b00) * reciprocal;
  destination[15] = (a20 * b03 - a21 * b01 + a22 * b00) * reciprocal;
  return destination;
}

export function setPerspectiveMatrix4<T extends WritableNumbers>(
  destination: T,
  fieldOfViewRadians: number,
  aspect: number,
  near: number,
  far: number,
): T {
  const focalLength = 1 / Math.tan(fieldOfViewRadians / 2);
  const depth = 1 / (near - far);
  destination[0] = focalLength / aspect;
  destination[1] = 0;
  destination[2] = 0;
  destination[3] = 0;
  destination[4] = 0;
  destination[5] = focalLength;
  destination[6] = 0;
  destination[7] = 0;
  destination[8] = 0;
  destination[9] = 0;
  destination[10] = (far + near) * depth;
  destination[11] = -1;
  destination[12] = 0;
  destination[13] = 0;
  destination[14] = 2 * far * near * depth;
  destination[15] = 0;
  return destination;
}

export function setOrthographicMatrix4<T extends WritableNumbers>(
  destination: T,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
): T {
  const width = right - left;
  const height = top - bottom;
  const depth = far - near;
  destination[0] = 2 / width;
  destination[1] = 0;
  destination[2] = 0;
  destination[3] = 0;
  destination[4] = 0;
  destination[5] = 2 / height;
  destination[6] = 0;
  destination[7] = 0;
  destination[8] = 0;
  destination[9] = 0;
  destination[10] = -2 / depth;
  destination[11] = 0;
  destination[12] = -(right + left) / width;
  destination[13] = -(top + bottom) / height;
  destination[14] = -(far + near) / depth;
  destination[15] = 1;
  return destination;
}

export function setLookAtMatrix4<T extends WritableNumbers>(
  destination: T,
  position: CRCWebGLVector3,
  target: CRCWebGLVector3,
  up: CRCWebGLVector3,
): T {
  let z0 = position[0] - target[0];
  let z1 = position[1] - target[1];
  let z2 = position[2] - target[2];
  const zLength = Math.hypot(z0, z1, z2);
  z0 /= zLength;
  z1 /= zLength;
  z2 /= zLength;
  let x0 = up[1] * z2 - up[2] * z1;
  let x1 = up[2] * z0 - up[0] * z2;
  let x2 = up[0] * z1 - up[1] * z0;
  const xLength = Math.hypot(x0, x1, x2);
  x0 /= xLength;
  x1 /= xLength;
  x2 /= xLength;
  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;

  destination[0] = x0;
  destination[1] = y0;
  destination[2] = z0;
  destination[3] = 0;
  destination[4] = x1;
  destination[5] = y1;
  destination[6] = z1;
  destination[7] = 0;
  destination[8] = x2;
  destination[9] = y2;
  destination[10] = z2;
  destination[11] = 0;
  destination[12] = -(x0 * position[0] + x1 * position[1] + x2 * position[2]);
  destination[13] = -(y0 * position[0] + y1 * position[1] + y2 * position[2]);
  destination[14] = -(z0 * position[0] + z1 * position[1] + z2 * position[2]);
  destination[15] = 1;
  return destination;
}

const getFiniteTransform = (
  style: CRCWebGLTransformStyle,
  field: keyof CRCWebGLTransformStyle,
  fallback: number,
): number => {
  const value = style[field] ?? fallback;
  if (!Number.isFinite(value)) {
    throw new TypeError(`WebGL transform.${field} must be finite.`);
  }
  if (field.startsWith('scale') && value === 0) {
    throw new RangeError(`WebGL transform.${field} must be nonzero.`);
  }
  return value;
};

export function composeModelMatrix4<T extends WritableNumbers>(
  destination: T,
  style: CRCWebGLTransformStyle = {},
): T {
  const translateX = getFiniteTransform(style, 'translateX', 0);
  const translateY = getFiniteTransform(style, 'translateY', 0);
  const translateZ = getFiniteTransform(style, 'translateZ', 0);
  const rotationX = getFiniteTransform(style, 'rotationXDegrees', 0) * DEGREES_TO_RADIANS;
  const rotationY = getFiniteTransform(style, 'rotationYDegrees', 0) * DEGREES_TO_RADIANS;
  const rotationZ = getFiniteTransform(style, 'rotationZDegrees', 0) * DEGREES_TO_RADIANS;
  const scaleX = getFiniteTransform(style, 'scaleX', 1);
  const scaleY = getFiniteTransform(style, 'scaleY', 1);
  const scaleZ = getFiniteTransform(style, 'scaleZ', 1);
  const sinX = Math.sin(rotationX);
  const cosX = Math.cos(rotationX);
  const sinY = Math.sin(rotationY);
  const cosY = Math.cos(rotationY);
  const sinZ = Math.sin(rotationZ);
  const cosZ = Math.cos(rotationZ);

  destination[0] = cosZ * cosY * scaleX;
  destination[1] = sinZ * cosY * scaleX;
  destination[2] = -sinY * scaleX;
  destination[3] = 0;
  destination[4] = (cosZ * sinY * sinX - sinZ * cosX) * scaleY;
  destination[5] = (sinZ * sinY * sinX + cosZ * cosX) * scaleY;
  destination[6] = cosY * sinX * scaleY;
  destination[7] = 0;
  destination[8] = (cosZ * sinY * cosX + sinZ * sinX) * scaleZ;
  destination[9] = (sinZ * sinY * cosX - cosZ * sinX) * scaleZ;
  destination[10] = cosY * cosX * scaleZ;
  destination[11] = 0;
  destination[12] = translateX;
  destination[13] = translateY;
  destination[14] = translateZ;
  destination[15] = 1;
  return destination;
}

export function transformPointMatrix4<T extends WritableNumbers>(
  destination: T,
  matrix: ArrayLike<number>,
  point: CRCWebGLVector3,
): T {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;
  destination[0] =
    (matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!) / w;
  destination[1] =
    (matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!) / w;
  destination[2] =
    (matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!) / w;
  return destination;
}

/** Transforms the local origin through an affine matrix with w = 1. */
export function transformOriginMatrix4<T extends WritableNumbers>(
  destination: T,
  matrix: ArrayLike<number>,
): T {
  destination[0] = matrix[12]!;
  destination[1] = matrix[13]!;
  destination[2] = matrix[14]!;
  return destination;
}

/** Transforms a direction through only an affine matrix's linear part (w = 0). */
export function transformDirectionMatrix4<T extends WritableNumbers>(
  destination: T,
  matrix: ArrayLike<number>,
  direction: CRCWebGLVector3,
): T {
  const x = direction[0];
  const y = direction[1];
  const z = direction[2];
  destination[0] = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z;
  destination[1] = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z;
  destination[2] = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z;
  return destination;
}

export interface Matrix4Bounds {
  readonly minimumX: number;
  readonly minimumY: number;
  readonly minimumZ: number;
  readonly maximumX: number;
  readonly maximumY: number;
  readonly maximumZ: number;
}

/** Computes an affine AABB from all eight source corners. */
export function transformBoundsMatrix4(
  matrix: ArrayLike<number>,
  bounds: Matrix4Bounds,
): Matrix4Bounds {
  let minimumX = Infinity;
  let minimumY = Infinity;
  let minimumZ = Infinity;
  let maximumX = -Infinity;
  let maximumY = -Infinity;
  let maximumZ = -Infinity;
  const transformed = new Float64Array(3);
  for (const x of [bounds.minimumX, bounds.maximumX]) {
    for (const y of [bounds.minimumY, bounds.maximumY]) {
      for (const z of [bounds.minimumZ, bounds.maximumZ]) {
        transformPointMatrix4(transformed, matrix, [x, y, z]);
        minimumX = Math.min(minimumX, transformed[0]!);
        minimumY = Math.min(minimumY, transformed[1]!);
        minimumZ = Math.min(minimumZ, transformed[2]!);
        maximumX = Math.max(maximumX, transformed[0]!);
        maximumY = Math.max(maximumY, transformed[1]!);
        maximumZ = Math.max(maximumZ, transformed[2]!);
      }
    }
  }
  if (![minimumX, minimumY, minimumZ, maximumX, maximumY, maximumZ]
    .every(Number.isFinite)) {
    throw new RangeError('WebGL transformed bounds must be finite.');
  }
  return Object.freeze({
    minimumX,
    minimumY,
    minimumZ,
    maximumX,
    maximumY,
    maximumZ,
  });
}
