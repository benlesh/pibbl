import type {
  CRCEventHandlers,
  CRCEventParticipationOptions,
  CRCEventTargetOptions,
} from '@crc/core';

export type CRCWebGLVector3 = readonly [x: number, y: number, z: number];

export type CRCWebGLShadowQuality = false | 'low' | 'medium' | 'high';

export interface CRCWebGLPerspectiveCamera {
  type: 'perspective';
  position: CRCWebGLVector3;
  lookAt: CRCWebGLVector3;
  up: CRCWebGLVector3;
  fieldOfViewDegrees: number;
  near: number;
  far: number;
}

export interface CRCWebGLTransformStyle {
  /** Canvas filters apply to WebGLLayer, never an inner WebGL primitive. */
  filter?: never;
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

export interface CRCWebGLLambertMaterial {
  readonly type: 'lambert';
  readonly emissiveColor?: string;
  readonly emissiveIntensity?: number;
}

export type CRCWebGLMaterial = CRCWebGLLambertMaterial;

/** Shared logical-target props for geometry-backed WebGL built-ins. */
export interface CRCWebGLTargetProps
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly keyboardFocusable?: CRCEventTargetOptions['keyboardFocusable'];
  readonly keyboardNavigationBounds?:
    CRCEventTargetOptions['keyboardNavigationBounds'];
}

export interface CRCWebGLGeometryInput {
  readonly positions: ArrayLike<number>;
  readonly normals?: ArrayLike<number>;
  readonly tangents?: ArrayLike<number>;
  readonly textureCoordinates0?: ArrayLike<number>;
  readonly indices?: ArrayLike<number>;
}

declare const crcWebGLGeometryBrand: unique symbol;

export interface CRCWebGLGeometry {
  readonly [crcWebGLGeometryBrand]: true;
  readonly vertexCount: number;
  readonly triangleCount: number;
}
