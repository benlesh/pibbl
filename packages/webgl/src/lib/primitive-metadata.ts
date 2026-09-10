import type { SystemStyle } from '@crc/core';
import type { CRCWebGLHitCapability } from './types.js';

const primitiveHitMetadata = new WeakMap<object, unknown>();

/** Retains validated hit metadata without adding fields to core primitives. */
export function registerWebGLPrimitiveHitMetadata<P, S extends SystemStyle>(
  program: object,
  hit: CRCWebGLHitCapability<P, S>,
): void {
  primitiveHitMetadata.set(program, snapshotHitCapability(hit));
}

/** Package-private lookup used by the WebGL backend and future pick ledger. */
export function getWebGLPrimitiveHitMetadata(
  program: object,
): CRCWebGLHitCapability<unknown, SystemStyle> | undefined {
  return primitiveHitMetadata.get(program) as
    | CRCWebGLHitCapability<unknown, SystemStyle>
    | undefined;
}

function snapshotHitCapability<P, S>(
  hit: CRCWebGLHitCapability<P, S>,
): CRCWebGLHitCapability<P, S> {
  switch (hit.kind) {
    case 'geometry':
      return Object.freeze({ kind: 'geometry', geometry: hit.geometry });
    case 'custom':
      return Object.freeze({ kind: 'custom', resolve: hit.resolve });
    case 'none':
      return Object.freeze({ kind: 'none' });
  }
}
