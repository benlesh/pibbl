import type {
  CRCEventHandlers,
  CRCEventParticipationOptions,
  CRCEventTargetOptions,
  CRCNode,
  PrimitiveInput,
  StyleResolutionContext,
  SystemStyle,
} from '@crc/core';

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

export type CRCWebGLPrimitiveRender<P, S> = (
  props: Readonly<P>,
  style: Readonly<S>,
  context: CRCWebGLContext,
) => CRCNode | void;

export type CRCWebGLHitCapability<P, S> =
  | {
      readonly kind: 'geometry';
      geometry(
        props: Readonly<P>,
        style: Readonly<S>,
      ): CRCWebGLGeometry;
    }
  | {
      readonly kind: 'custom';
      resolve(input: CRCWebGLPrimitiveHitInput<P, S>): number | null;
    }
  | { readonly kind: 'none' };

export interface CRCWebGLPrimitiveCapabilities<P, S, N, R> {
  readonly normalizeStyle?: (style: Readonly<S>) => Readonly<N>;
  readonly resolveStyle?: (
    style: Readonly<N>,
    context: Readonly<StyleResolutionContext>,
  ) => Readonly<R>;
  readonly hit: CRCWebGLHitCapability<P, R>;
}

export type CRCWebGLProgramProps<
  P,
  H extends CRCWebGLHitCapability<P, any>,
> = H extends { readonly kind: 'none' }
  ? P & { readonly pointerEvents?: 'none' }
  : P & CRCEventHandlers &
    Pick<
      CRCEventTargetOptions,
      'keyboardFocusable' | 'keyboardNavigationBounds'
    > & CRCEventParticipationOptions;

export type CRCWebGLSpecifiedStyle<S extends SystemStyle> =
  Omit<S, 'filter'> & { readonly filter?: never };

export type CRCWebGLPrimitiveInput<
  P,
  S extends SystemStyle,
  H extends CRCWebGLHitCapability<P, any>,
> = PrimitiveInput<CRCWebGLProgramProps<P, H>, CRCWebGLSpecifiedStyle<S>>;

export interface CRCWebGLContext {
  readonly gl: WebGL2RenderingContext;
  readonly contextGeneration: number;
  readonly camera: CRCWebGLCameraSnapshot;
  readonly modelMatrix: Readonly<Float32Array>;
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly backingViewport: Readonly<{ width: number; height: number }>;
  readonly density: Readonly<{ x: number; y: number }>;
  readonly timestamp: number;
  readonly resources: {
    use<T>(
      create: (gl: WebGL2RenderingContext) => T,
      release: (
        value: T,
        context: Readonly<{
          gl: WebGL2RenderingContext;
          contextLost: boolean;
        }>,
      ) => void,
      deps: readonly unknown[],
    ): T;
  };
}

export interface CRCWebGLPrimitiveHitInput<P, S> {
  readonly props: Readonly<P>;
  readonly style: Readonly<S>;
  readonly layerX: number;
  readonly layerY: number;
  readonly ndcX: number;
  readonly ndcY: number;
  readonly rayOrigin: CRCWebGLVector3;
  readonly rayDirection: CRCWebGLVector3;
  readonly modelMatrix: Readonly<Float32Array>;
  readonly camera: CRCWebGLCameraSnapshot;
}
