import type {
  CRCWebGLPerspectiveCamera,
  CRCWebGLVector3,
} from '../types.js';
import {
  invertMatrix4,
  multiplyMatrix4,
  setLookAtMatrix4,
  setPerspectiveMatrix4,
} from './matrix4.js';

export interface ResolvedWebGLCamera {
  readonly descriptor: CRCWebGLPerspectiveCamera;
  readonly aspect: number;
  readonly viewMatrix: Readonly<Float32Array>;
  readonly projectionMatrix: Readonly<Float32Array>;
  readonly projectionViewMatrix: Readonly<Float32Array>;
  readonly inverseProjectionViewMatrix: Readonly<Float32Array>;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly generationValues: readonly number[];
}

const DEFAULT_CAMERA: CRCWebGLPerspectiveCamera = Object.freeze({
  type: 'perspective',
  position: Object.freeze([0, 0, 5]) as CRCWebGLVector3,
  lookAt: Object.freeze([0, 0, 0]) as CRCWebGLVector3,
  up: Object.freeze([0, 1, 0]) as CRCWebGLVector3,
  fieldOfViewDegrees: 50,
  near: 0.1,
  far: 1000,
});

const copyVector = (value: CRCWebGLVector3, field: string): CRCWebGLVector3 => {
  if (value === null || typeof value !== 'object' || value.length !== 3) {
    throw new TypeError(`WebGLLayer camera.${field} must contain exactly three finite numbers.`);
  }
  const x = value[0];
  const y = value[1];
  const z = value[2];
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new TypeError(`WebGLLayer camera.${field} must contain exactly three finite numbers.`);
  }
  return Object.freeze([x, y, z]) as CRCWebGLVector3;
};

const assertFinite = (value: number, field: string): void => {
  if (!Number.isFinite(value)) {
    throw new TypeError(`WebGLLayer camera.${field} must be finite.`);
  }
};

const assertViewportDimension = (value: number, field: 'width' | 'height'): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`WebGLLayer ${field} must be finite and positive.`);
  }
};

const assertFiniteMatrix = (matrix: Float32Array, field: string): void => {
  for (const value of matrix) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`WebGLLayer camera.${field} must produce finite matrix values.`);
    }
  }
};

const assertProjectionRepresentability = (
  descriptor: CRCWebGLPerspectiveCamera,
  projectionMatrix: Float32Array,
): void => {
  const verticalScale = projectionMatrix[5]!;
  if (!Number.isFinite(verticalScale) || verticalScale === 0) {
    throw new RangeError(
      'WebGLLayer camera.fieldOfViewDegrees must produce a finite nonzero Float32 projection scale.',
    );
  }

  const minimumDepthOffset = Math.fround(2 * descriptor.near);
  if (!Number.isFinite(minimumDepthOffset) || minimumDepthOffset === 0) {
    throw new RangeError(
      'WebGLLayer camera.near must produce a finite nonzero Float32 projection depth.',
    );
  }

  const floatFar = Math.fround(descriptor.far);
  if (!Number.isFinite(floatFar)) {
    throw new RangeError(
      'WebGLLayer camera.far must be representable as a finite Float32 projection distance.',
    );
  }
  if (
    !Number.isFinite(projectionMatrix[10]) ||
    !Number.isFinite(projectionMatrix[14]) ||
    projectionMatrix[14] === 0
  ) {
    throw new RangeError(
      'WebGLLayer camera.far must remain sufficiently separated from camera.near for a finite Float32 projection.',
    );
  }
};

const snapshotDescriptor = (
  camera: CRCWebGLPerspectiveCamera | undefined,
): CRCWebGLPerspectiveCamera => {
  if (camera === undefined) {
    return DEFAULT_CAMERA;
  }
  if (camera.type !== 'perspective') {
    throw new TypeError('WebGLLayer camera.type must be "perspective".');
  }
  const position = copyVector(camera.position, 'position');
  const lookAt = copyVector(camera.lookAt, 'lookAt');
  const up = copyVector(camera.up, 'up');
  assertFinite(camera.fieldOfViewDegrees, 'fieldOfViewDegrees');
  assertFinite(camera.near, 'near');
  assertFinite(camera.far, 'far');
  if (camera.fieldOfViewDegrees <= 0 || camera.fieldOfViewDegrees >= 180) {
    throw new RangeError('WebGLLayer camera.fieldOfViewDegrees must be greater than 0 and less than 180.');
  }
  if (camera.near <= 0) {
    throw new RangeError('WebGLLayer camera.near must be positive.');
  }
  if (camera.far <= camera.near) {
    throw new RangeError('WebGLLayer camera.far must be greater than camera.near.');
  }

  const viewX = lookAt[0] - position[0];
  const viewY = lookAt[1] - position[1];
  const viewZ = lookAt[2] - position[2];
  const viewLength = Math.hypot(viewX, viewY, viewZ);
  if (viewLength === 0 || !Number.isFinite(viewLength)) {
    throw new RangeError('WebGLLayer camera.lookAt must differ from camera.position by a finite direction.');
  }
  const upLength = Math.hypot(up[0], up[1], up[2]);
  if (upLength === 0 || !Number.isFinite(upLength)) {
    throw new RangeError('WebGLLayer camera.up must be nonzero.');
  }
  const normalizedDot = Math.abs(
    (viewX * up[0] + viewY * up[1] + viewZ * up[2]) / (viewLength * upLength),
  );
  if (!Number.isFinite(normalizedDot) || 1 - normalizedDot <= 1e-12) {
    throw new RangeError('WebGLLayer camera.up must not be collinear with the view direction.');
  }

  return Object.freeze({
    type: 'perspective',
    position,
    lookAt,
    up,
    fieldOfViewDegrees: camera.fieldOfViewDegrees,
    near: camera.near,
    far: camera.far,
  });
};

export function resolveCamera(
  camera: CRCWebGLPerspectiveCamera | undefined,
  width: number,
  height: number,
): ResolvedWebGLCamera {
  assertViewportDimension(width, 'width');
  assertViewportDimension(height, 'height');
  const descriptor = snapshotDescriptor(camera);
  const aspect = width / height;
  const viewMatrix = new Float32Array(16);
  const projectionMatrix = new Float32Array(16);
  const projectionViewMatrix = new Float32Array(16);
  const inverseProjectionViewMatrix = new Float32Array(16);
  setLookAtMatrix4(viewMatrix, descriptor.position, descriptor.lookAt, descriptor.up);
  setPerspectiveMatrix4(
    projectionMatrix,
    (descriptor.fieldOfViewDegrees * Math.PI) / 180,
    aspect,
    descriptor.near,
    descriptor.far,
  );
  assertProjectionRepresentability(descriptor, projectionMatrix);
  multiplyMatrix4(projectionViewMatrix, projectionMatrix, viewMatrix);
  if (invertMatrix4(inverseProjectionViewMatrix, projectionViewMatrix) === undefined) {
    throw new RangeError('WebGLLayer camera must produce an invertible projection-view matrix.');
  }
  assertFiniteMatrix(viewMatrix, 'viewMatrix');
  assertFiniteMatrix(projectionMatrix, 'projectionMatrix');
  assertFiniteMatrix(projectionViewMatrix, 'projectionViewMatrix');
  assertFiniteMatrix(inverseProjectionViewMatrix, 'inverseProjectionViewMatrix');

  const viewport = Object.freeze({ width, height });
  const generationValues = Object.freeze([
    ...descriptor.position,
    ...descriptor.lookAt,
    ...descriptor.up,
    descriptor.fieldOfViewDegrees,
    descriptor.near,
    descriptor.far,
    width,
    height,
  ]);
  return Object.freeze({
    descriptor,
    aspect,
    viewMatrix,
    projectionMatrix,
    projectionViewMatrix,
    inverseProjectionViewMatrix,
    viewport,
    generationValues,
  });
}
