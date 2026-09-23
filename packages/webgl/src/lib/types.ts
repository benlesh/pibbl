import type {
  CRCEventHandlers,
  CRCEventParticipationOptions,
  CRCEventTargetOptions,
} from '@crc/core';

export type CRCWebGLVector3 = readonly [x: number, y: number, z: number];

declare const crcWebGLAssetBrand: unique symbol;

/** Opaque immutable scene asset produced by official import adapters. */
export interface CRCWebGLAsset {
  readonly [crcWebGLAssetBrand]: true;
  readonly bounds: Readonly<{
    readonly min: CRCWebGLVector3;
    readonly max: CRCWebGLVector3;
  }>;
}

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

/**
 * Declaration-merging hook reserved for the matching official 3D physics
 * package. It deliberately contributes no runtime value.
 */
export interface CRCPhysics3DPropExtension {}

export interface CRCWebGLTextureSampler {
  readonly wrapS: 'repeat' | 'clamp-to-edge' | 'mirrored-repeat';
  readonly wrapT: 'repeat' | 'clamp-to-edge' | 'mirrored-repeat';
  readonly minFilter:
    | 'nearest'
    | 'linear'
    | 'nearest-mipmap-nearest'
    | 'linear-mipmap-nearest'
    | 'nearest-mipmap-linear'
    | 'linear-mipmap-linear';
  readonly magFilter: 'nearest' | 'linear';
}

declare const crcWebGLTextureBrand: unique symbol;

/** Opaque decoded texture identity used by official import adapters. */
export interface CRCWebGLTexture {
  readonly [crcWebGLTextureBrand]: true;
}

export interface CRCWebGLTextureBinding {
  readonly texture: CRCWebGLTexture;
  readonly textureCoordinate: 0;
}

/** Closed imported-material subset. It is not part of the root package API. */
export interface CRCWebGLPBRMetallicRoughnessMaterial {
  readonly type: 'pbr-metallic-roughness';
  readonly baseColorFactor: readonly [number, number, number, number];
  readonly baseColorTexture?: CRCWebGLTextureBinding;
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
}

/** Shared logical-target props for geometry-backed WebGL built-ins. */
export interface CRCWebGLTargetProps
  extends CRCEventHandlers,
    CRCEventParticipationOptions,
    CRCPhysics3DPropExtension {
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
