import type {
  CRCWebGLTexture,
  CRCWebGLTextureSampler,
} from '../types.js';

export interface InternalWebGLTextureData {
  readonly width: number;
  readonly height: number;
  readonly bitmap: ImageBitmap;
  readonly sampler: CRCWebGLTextureSampler;
}

export interface InternalWebGLTextureProducer {
  readonly texture: CRCWebGLTexture;
  readonly release: () => void;
}

interface InternalWebGLTextureRecord {
  readonly data: InternalWebGLTextureData;
  leases: number;
}

const textureRecords = new WeakMap<CRCWebGLTexture, InternalWebGLTextureRecord>();

/** Creates one internal decoded texture and its initial producer lease. */
export function createInternalWebGLTexture(
  bitmap: ImageBitmap,
  sampler: Partial<CRCWebGLTextureSampler> = {},
): InternalWebGLTextureProducer {
  const texture = Object.freeze({}) as CRCWebGLTexture;
  const normalizedSampler = Object.freeze({
    wrapS: sampler.wrapS ?? 'repeat',
    wrapT: sampler.wrapT ?? 'repeat',
    minFilter: sampler.minFilter ?? 'linear',
    magFilter: sampler.magFilter ?? 'linear',
  });
  const data = Object.freeze({
    width: bitmap.width,
    height: bitmap.height,
    bitmap,
    sampler: normalizedSampler,
  });
  textureRecords.set(texture, { data, leases: 1 });
  let active = true;
  return Object.freeze({
    texture,
    release: () => {
      if (!active) return;
      active = false;
      releaseTextureLease(texture);
    },
  });
}

/** Reads immutable decoded data for an internal texture. */
export function getInternalWebGLTextureData(
  texture: CRCWebGLTexture,
): InternalWebGLTextureData {
  const record = textureRecords.get(texture);
  if (!record) throw new Error('WebGL texture descriptor is invalid or released.');
  return record.data;
}

/** Acquires one dependency lease and returns its idempotent release. */
export function acquireInternalWebGLTexture(
  texture: CRCWebGLTexture,
): () => void {
  const record = textureRecords.get(texture);
  if (!record) throw new Error('WebGL texture descriptor is invalid or released.');
  record.leases += 1;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    releaseTextureLease(texture);
  };
}

function releaseTextureLease(texture: CRCWebGLTexture): void {
  const record = textureRecords.get(texture);
  if (!record) return;
  record.leases -= 1;
  if (record.leases !== 0) return;
  textureRecords.delete(texture);
  record.data.bitmap.close();
}
