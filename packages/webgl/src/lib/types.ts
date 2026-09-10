export type CRCWebGLVector3 = readonly [x: number, y: number, z: number];

export interface CRCWebGLPerspectiveCamera {
  type: 'perspective';
  position: CRCWebGLVector3;
  lookAt: CRCWebGLVector3;
  up: CRCWebGLVector3;
  fieldOfViewDegrees: number;
  near: number;
  far: number;
}

export interface CRCWebGLCameraSnapshot {
  readonly descriptor: CRCWebGLPerspectiveCamera;
  readonly aspect: number;
  readonly viewMatrix: Readonly<Float32Array>;
  readonly projectionMatrix: Readonly<Float32Array>;
  readonly projectionViewMatrix: Readonly<Float32Array>;
  readonly inverseProjectionViewMatrix: Readonly<Float32Array>;
}

export interface CRCWebGLTransformStyle {
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  rotationXDegrees?: number;
  rotationYDegrees?: number;
  rotationZDegrees?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
}

export interface CRCWebGLGeometryInput {
  positions: ArrayLike<number>;
  indices?: ArrayLike<number>;
}

declare const crcWebGLGeometryBrand: unique symbol;

export interface CRCWebGLGeometry {
  readonly [crcWebGLGeometryBrand]: true;
  readonly vertexCount: number;
  readonly triangleCount: number;
}
