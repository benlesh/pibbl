import type {
  CRCWebGLGeometry,
  CRCWebGLPBRMetallicRoughnessMaterial,
  CRCWebGLVector3,
} from '../types.js';

export type CRCWebGLMatrix4 = Readonly<ArrayLike<number>>;

export interface CRCWebGLBounds3 {
  readonly min: CRCWebGLVector3;
  readonly max: CRCWebGLVector3;
}

export interface CRCWebGLAssetPrimitiveRecord {
  readonly geometry: CRCWebGLGeometry;
  readonly material: CRCWebGLPBRMetallicRoughnessMaterial;
  readonly modelMatrix: CRCWebGLMatrix4;
  readonly sourceOrder: number;
}

export interface CRCWebGLAssetData {
  readonly primitives: readonly CRCWebGLAssetPrimitiveRecord[];
  readonly bounds: CRCWebGLBounds3;
}
