import type { CRCHitTestOutput } from '@crc/core/internal';
import { getWebGLGeometryData } from './geometry/geometry.js';
import {
  invertMatrix4,
  transformPointMatrix4,
} from './math/matrix4.js';
import {
  createRayFromNDC,
  intersectRayTriangle,
} from './math/ray.js';
import {
  snapshotWebGLPickCamera,
  type CRCWebGLCustomPickRecord,
  type CRCWebGLGeometryPickRecord,
  type CRCWebGLPickLedger,
} from './pick-ledger.js';
import type {
  CRCWebGLCameraSnapshot,
  CRCWebGLPrimitiveHitInput,
  CRCWebGLVector3,
} from './types.js';

const HIT_MISS = 0;
const HIT_TARGET = 2;

interface ScenePickerScratch {
  readonly worldOrigin: Float32Array;
  readonly worldDirection: Float32Array;
  readonly inverseModel: Float32Array;
  readonly localOrigin: Float32Array;
  readonly localDirection: Float32Array;
  readonly first: Float32Array;
  readonly second: Float32Array;
  readonly third: Float32Array;
  readonly worldHit: Float32Array;
  readonly projectedHit: Float32Array;
}

interface ScenePickerScratchPool {
  depth: number;
  readonly slots: ScenePickerScratch[];
}

const scratchPools = new WeakMap<CRCWebGLPickLedger, ScenePickerScratchPool>();

/** Resolves one committed WebGL scene into core's caller-owned hit output. */
export function pickScene(
  ledger: CRCWebGLPickLedger,
  camera: CRCWebGLCameraSnapshot,
  localX: number,
  localY: number,
  output: CRCHitTestOutput,
): CRCHitTestOutput {
  resetOutput(output);
  const { width, height } = ledger.logicalViewport;
  if (
    !Number.isFinite(localX) ||
    !Number.isFinite(localY) ||
    localX < 0 ||
    localY < 0 ||
    localX > width ||
    localY > height
  ) {
    return output;
  }

  const pool = getScratchPool(ledger);
  const slot = pool.depth++;
  const scratch = pool.slots[slot] ??= createScratch();
  try {
    const ndcX = localX / width * 2 - 1;
    const ndcY = 1 - localY / height * 2;
    createRayFromNDC(
      scratch.worldOrigin,
      scratch.worldDirection,
      camera.inverseProjectionViewMatrix,
      ndcX,
      ndcY,
    );

    let winningDepth = Number.POSITIVE_INFINITY;
    let winningSourceOrder = -1;
    let winningTarget = null as typeof output.target;
    for (const entry of ledger.entries) {
      const distance = entry.kind === 'geometry' ?
        intersectGeometry(entry, scratch) :
        resolveCustom(entry, localX, localY, ndcX, ndcY, scratch);
      if (distance === undefined) continue;
      const depth = projectDistanceToDepth(distance, camera, scratch);
      if (depth === undefined) continue;
      if (
        depth < winningDepth ||
        (depth === winningDepth && entry.sourceOrder > winningSourceOrder)
      ) {
        winningDepth = depth;
        winningSourceOrder = entry.sourceOrder;
        winningTarget = entry.target;
      }
    }

    if (winningTarget) {
      output.disposition = HIT_TARGET;
      output.target = winningTarget;
    }
    return output;
  } finally {
    pool.depth -= 1;
  }
}

function intersectGeometry(
  entry: CRCWebGLGeometryPickRecord,
  scratch: ScenePickerScratch,
): number | undefined {
  if (invertMatrix4(scratch.inverseModel, entry.model) === undefined) {
    return undefined;
  }
  transformPointMatrix4(
    scratch.localOrigin,
    scratch.inverseModel,
    scratch.worldOrigin as unknown as CRCWebGLVector3,
  );
  transformDirection(
    scratch.localDirection,
    scratch.inverseModel,
    scratch.worldDirection,
  );
  const { positions, indices } = getWebGLGeometryData(entry.geometry);
  let nearest = Number.POSITIVE_INFINITY;
  const elementCount = indices?.length ?? positions.length / 3;
  for (let offset = 0; offset < elementCount; offset += 3) {
    const firstIndex = indices?.[offset] ?? offset;
    const secondIndex = indices?.[offset + 1] ?? offset + 1;
    const thirdIndex = indices?.[offset + 2] ?? offset + 2;
    readPosition(scratch.first, positions, firstIndex);
    readPosition(scratch.second, positions, secondIndex);
    readPosition(scratch.third, positions, thirdIndex);
    const distance = intersectRayTriangle(
      scratch.localOrigin as unknown as CRCWebGLVector3,
      scratch.localDirection as unknown as CRCWebGLVector3,
      scratch.first as unknown as CRCWebGLVector3,
      scratch.second as unknown as CRCWebGLVector3,
      scratch.third as unknown as CRCWebGLVector3,
    );
    if (distance !== undefined && distance < nearest) nearest = distance;
  }
  return Number.isFinite(nearest) ? nearest : undefined;
}

function resolveCustom(
  entry: CRCWebGLCustomPickRecord,
  layerX: number,
  layerY: number,
  ndcX: number,
  ndcY: number,
  scratch: ScenePickerScratch,
): number | undefined {
  const input = Object.freeze({
    props: entry.props,
    style: entry.style,
    layerX,
    layerY,
    ndcX,
    ndcY,
    rayOrigin: Object.freeze([
      scratch.worldOrigin[0]!,
      scratch.worldOrigin[1]!,
      scratch.worldOrigin[2]!,
    ]) as CRCWebGLVector3,
    rayDirection: Object.freeze([
      scratch.worldDirection[0]!,
      scratch.worldDirection[1]!,
      scratch.worldDirection[2]!,
    ]) as CRCWebGLVector3,
    modelMatrix: new Float32Array(entry.model),
    camera: snapshotWebGLPickCamera(entry.camera),
  }) satisfies CRCWebGLPrimitiveHitInput<
    Readonly<Record<PropertyKey, unknown>>,
    Readonly<Record<PropertyKey, unknown>>
  >;
  const distance = entry.resolve(input);
  if (distance === null) return undefined;
  if (!Number.isFinite(distance) || distance < 0) {
    throw new TypeError(
      `${entry.componentName} custom hit resolver must return null or a ` +
      'finite nonnegative ray distance.',
    );
  }
  return distance;
}

function projectDistanceToDepth(
  distance: number,
  camera: CRCWebGLCameraSnapshot,
  scratch: ScenePickerScratch,
): number | undefined {
  scratch.worldHit[0] = scratch.worldOrigin[0]! +
    scratch.worldDirection[0]! * distance;
  scratch.worldHit[1] = scratch.worldOrigin[1]! +
    scratch.worldDirection[1]! * distance;
  scratch.worldHit[2] = scratch.worldOrigin[2]! +
    scratch.worldDirection[2]! * distance;
  transformPointMatrix4(
    scratch.projectedHit,
    camera.projectionViewMatrix,
    scratch.worldHit as unknown as CRCWebGLVector3,
  );
  const normalizedDepth = scratch.projectedHit[2]!;
  if (
    !Number.isFinite(normalizedDepth) ||
    normalizedDepth < -1 ||
    normalizedDepth > 1
  ) {
    return undefined;
  }
  return normalizedDepth * 0.5 + 0.5;
}

function transformDirection(
  destination: Float32Array,
  matrix: Readonly<Float32Array>,
  direction: Readonly<Float32Array>,
): void {
  const x = direction[0]!;
  const y = direction[1]!;
  const z = direction[2]!;
  destination[0] = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z;
  destination[1] = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z;
  destination[2] = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z;
}

function readPosition(
  destination: Float32Array,
  positions: Float32Array,
  index: number,
): void {
  const offset = index * 3;
  destination[0] = positions[offset]!;
  destination[1] = positions[offset + 1]!;
  destination[2] = positions[offset + 2]!;
}

function resetOutput(output: CRCHitTestOutput): void {
  output.disposition = HIT_MISS;
  output.target = null;
}

function getScratchPool(ledger: CRCWebGLPickLedger): ScenePickerScratchPool {
  let pool = scratchPools.get(ledger);
  if (!pool) {
    pool = { depth: 0, slots: [] };
    scratchPools.set(ledger, pool);
  }
  return pool;
}

function createScratch(): ScenePickerScratch {
  return {
    worldOrigin: new Float32Array(3),
    worldDirection: new Float32Array(3),
    inverseModel: new Float32Array(16),
    localOrigin: new Float32Array(3),
    localDirection: new Float32Array(3),
    first: new Float32Array(3),
    second: new Float32Array(3),
    third: new Float32Array(3),
    worldHit: new Float32Array(3),
    projectedHit: new Float32Array(3),
  };
}
