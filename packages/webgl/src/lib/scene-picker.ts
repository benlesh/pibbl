import {
  isBackendEventTargetLive,
  type CRCEventTargetRegistration,
  type CRCHitTestOutput,
} from '@crc/core/internal';
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
  type CRCWebGLGeometryPickRecord,
  type CRCWebGLPickLedger,
} from './pick-ledger.js';
import type { ResolvedWebGLCamera } from './math/camera.js';
import type { CRCWebGLVector3 } from './types.js';

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
  candidateCount: number;
  readonly candidateTargets: Array<CRCEventTargetRegistration | undefined>;
  readonly candidateDepths: number[];
  readonly candidateSourceOrders: number[];
}

interface ScenePickerScratchPool {
  depth: number;
  readonly slots: ScenePickerScratch[];
}

const scratchPools = new WeakMap<CRCWebGLPickLedger, ScenePickerScratchPool>();

/** Resolves one committed WebGL scene into core's caller-owned hit output. */
export function pickScene(
  ledger: CRCWebGLPickLedger,
  camera: ResolvedWebGLCamera,
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
    const worldDirectionLength = Math.hypot(
      scratch.worldDirection[0]!,
      scratch.worldDirection[1]!,
      scratch.worldDirection[2]!,
    );
    if (
      !isFiniteVector(scratch.worldOrigin) ||
      !Number.isFinite(worldDirectionLength) ||
      worldDirectionLength === 0
    ) {
      return output;
    }
    scratch.worldDirection[0] /= worldDirectionLength;
    scratch.worldDirection[1] /= worldDirectionLength;
    scratch.worldDirection[2] /= worldDirectionLength;

    for (const entry of ledger.entries) {
      if (!isBackendEventTargetLive(entry.target)) continue;
      const distance = intersectGeometry(entry, scratch);
      if (
        distance === undefined ||
        !isBackendEventTargetLive(entry.target)
      ) continue;
      const depth = projectDistanceToDepth(distance, camera, scratch);
      if (depth === undefined) continue;
      const candidateIndex = scratch.candidateCount++;
      scratch.candidateTargets[candidateIndex] = entry.target;
      scratch.candidateDepths[candidateIndex] = depth;
      scratch.candidateSourceOrders[candidateIndex] = entry.sourceOrder;
    }

    let winningDepth = Number.POSITIVE_INFINITY;
    let winningSourceOrder = -1;
    let winningTarget = null as typeof output.target;
    for (let index = 0; index < scratch.candidateCount; index += 1) {
      const target = scratch.candidateTargets[index]!;
      if (!isBackendEventTargetLive(target)) continue;
      const depth = scratch.candidateDepths[index]!;
      const sourceOrder = scratch.candidateSourceOrders[index]!;
      if (
        depth < winningDepth ||
        (depth === winningDepth && sourceOrder > winningSourceOrder)
      ) {
        winningDepth = depth;
        winningSourceOrder = sourceOrder;
        winningTarget = target;
      }
    }

    output.disposition = winningTarget ? HIT_TARGET : HIT_MISS;
    output.target = winningTarget;
    return output;
  } catch (error) {
    resetOutput(output);
    throw error;
  } finally {
    clearCandidates(scratch);
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
  if (!isFiniteVector(scratch.localOrigin)) return undefined;
  const localDirectionLength = Math.hypot(
    scratch.localDirection[0]!,
    scratch.localDirection[1]!,
    scratch.localDirection[2]!,
  );
  if (!Number.isFinite(localDirectionLength) || localDirectionLength === 0) {
    return undefined;
  }
  scratch.localDirection[0] /= localDirectionLength;
  scratch.localDirection[1] /= localDirectionLength;
  scratch.localDirection[2] /= localDirectionLength;
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
  return Number.isFinite(nearest) ? nearest / localDirectionLength : undefined;
}

function projectDistanceToDepth(
  distance: number,
  camera: ResolvedWebGLCamera,
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

function clearCandidates(scratch: ScenePickerScratch): void {
  for (let index = 0; index < scratch.candidateCount; index += 1) {
    scratch.candidateTargets[index] = undefined;
  }
  scratch.candidateCount = 0;
}

function isFiniteVector(vector: Readonly<Float32Array>): boolean {
  return Number.isFinite(vector[0]) &&
    Number.isFinite(vector[1]) &&
    Number.isFinite(vector[2]);
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
    candidateCount: 0,
    candidateTargets: [],
    candidateDepths: [],
    candidateSourceOrders: [],
  };
}
