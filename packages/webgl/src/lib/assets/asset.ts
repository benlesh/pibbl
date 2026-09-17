import type {
  CRCWebGLAsset,
  CRCWebGLPBRMetallicRoughnessMaterial,
  CRCWebGLTexture,
  CRCWebGLVector3,
} from '../types.js';
import { acquireInternalWebGLTexture } from '../texture/texture.js';
import type {
  CRCWebGLAssetData,
  CRCWebGLAssetPrimitiveRecord,
  CRCWebGLBounds3,
} from './types.js';

interface InternalWebGLAssetRecord {
  readonly data: CRCWebGLAssetData;
  readonly releaseDependencies: readonly (() => void)[];
  leases: number;
  producerActive: boolean;
}

const assetRecords = new WeakMap<CRCWebGLAsset, InternalWebGLAssetRecord>();

/** Publishes one immutable asset and its initial producer lease. */
export function createInternalWebGLAsset(
  input: CRCWebGLAssetData,
  dependencies: readonly CRCWebGLTexture[],
): CRCWebGLAsset {
  const bounds = snapshotBounds(input.bounds);
  const primitives = Object.freeze(input.primitives
    .map(snapshotPrimitive)
    .sort((left, right) => left.sourceOrder - right.sourceOrder));
  const data = Object.freeze({ primitives, bounds });
  const uniqueDependencies = new Set(dependencies);
  for (const primitive of primitives) {
    const texture = primitive.material.baseColorTexture?.texture;
    if (texture) uniqueDependencies.add(texture);
  }

  const releases: Array<() => void> = [];
  try {
    for (const dependency of uniqueDependencies) {
      releases.push(acquireInternalWebGLTexture(dependency));
    }
  } catch (error) {
    releaseAll(releases);
    throw error;
  }

  const asset = Object.freeze({ bounds }) as CRCWebGLAsset;
  assetRecords.set(asset, {
    data,
    releaseDependencies: Object.freeze(releases.slice()),
    leases: 1,
    producerActive: true,
  });
  return asset;
}

/** Reads the immutable private scene payload while the asset has a live lease. */
export function getInternalWebGLAssetData(
  asset: CRCWebGLAsset,
): CRCWebGLAssetData {
  return requireAssetRecord(asset).data;
}

/** Acquires one consumer lease and returns an idempotent release. */
export function acquireInternalWebGLAsset(asset: CRCWebGLAsset): () => void {
  const record = requireAssetRecord(asset);
  record.leases += 1;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    releaseAssetLease(asset);
  };
}

/** Releases the constructor's initial producer lease exactly once. */
export function releaseInternalWebGLAsset(asset: CRCWebGLAsset): void {
  const record = assetRecords.get(asset);
  if (!record?.producerActive) return;
  record.producerActive = false;
  releaseAssetLease(asset);
}

function requireAssetRecord(asset: CRCWebGLAsset): InternalWebGLAssetRecord {
  const record = assetRecords.get(asset);
  if (!record) throw new Error('WebGL asset descriptor is invalid or released.');
  return record;
}

function releaseAssetLease(asset: CRCWebGLAsset): void {
  const record = assetRecords.get(asset);
  if (!record) return;
  record.leases -= 1;
  if (record.leases !== 0) return;
  assetRecords.delete(asset);
  releaseAll(record.releaseDependencies);
}

function releaseAll(releases: readonly (() => void)[]): void {
  let firstError: unknown;
  for (let index = releases.length - 1; index >= 0; index -= 1) {
    try {
      releases[index]!();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError !== undefined) throw firstError;
}

function snapshotPrimitive(
  primitive: CRCWebGLAssetPrimitiveRecord,
): CRCWebGLAssetPrimitiveRecord {
  if (primitive.modelMatrix.length !== 16) {
    throw new TypeError('WebGL asset primitive modelMatrix must contain 16 values.');
  }
  const modelMatrix = new Float32Array(16);
  for (let index = 0; index < 16; index += 1) {
    const value = primitive.modelMatrix[index];
    if (!Number.isFinite(value)) {
      throw new TypeError(
        `WebGL asset primitive modelMatrix[${index}] must be finite.`,
      );
    }
    modelMatrix[index] = value!;
  }
  if (!Number.isSafeInteger(primitive.sourceOrder) || primitive.sourceOrder < 0) {
    throw new TypeError(
      'WebGL asset primitive sourceOrder must be a nonnegative safe integer.',
    );
  }
  return Object.freeze({
    geometry: primitive.geometry,
    material: snapshotMaterial(primitive.material),
    modelMatrix,
    sourceOrder: primitive.sourceOrder,
  });
}

function snapshotMaterial(
  material: CRCWebGLPBRMetallicRoughnessMaterial,
): CRCWebGLPBRMetallicRoughnessMaterial {
  return Object.freeze({
    type: material.type,
    baseColorFactor: Object.freeze([...material.baseColorFactor]) as
      readonly [number, number, number, number],
    ...(material.baseColorTexture === undefined ? {} : {
      baseColorTexture: Object.freeze({ ...material.baseColorTexture }),
    }),
    metallicFactor: material.metallicFactor,
    roughnessFactor: material.roughnessFactor,
  });
}

function snapshotBounds(bounds: CRCWebGLBounds3): CRCWebGLBounds3 {
  return Object.freeze({
    min: snapshotVector(bounds.min, 'min'),
    max: snapshotVector(bounds.max, 'max'),
  });
}

function snapshotVector(
  vector: CRCWebGLVector3,
  field: 'min' | 'max',
): CRCWebGLVector3 {
  if (vector.length !== 3 || vector.some(value => !Number.isFinite(value))) {
    throw new TypeError(`WebGL asset bounds.${field} must contain three finite values.`);
  }
  return Object.freeze([...vector]) as CRCWebGLVector3;
}
