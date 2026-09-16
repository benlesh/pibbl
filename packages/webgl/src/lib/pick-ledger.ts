import {
  isBackendEventTargetLive,
  releaseBackendEventTarget,
  type CRCEventTargetRegistration,
} from '@crc/core/internal';
import type { CRCWebGLGeometry } from './types.js';
import { getWebGLGeometryData } from './geometry/geometry.js';
import type { ResolvedWebGLCamera } from './math/camera.js';
import {
  invertMatrix4,
  multiplyMatrix4,
  type Matrix4Bounds,
} from './math/matrix4.js';

export interface CRCWebGLGeometryPickRecord {
  readonly kind: 'geometry';
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly geometry: CRCWebGLGeometry;
  readonly model: Readonly<Float32Array>;
  readonly keyboardNavigationBounds:
    CRCEventTargetRegistration['keyboardNavigationBounds'];
  readonly keyboardNavigationPoints:
    CRCEventTargetRegistration['keyboardNavigationPoints'];
  readonly sourceOrder: number;
  readonly depthMode: 'less-equal';
}

export interface CRCWebGLBoundsPickRecord {
  readonly kind: 'bounds';
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly bounds: Matrix4Bounds;
  readonly model: Readonly<Float32Array>;
  readonly keyboardNavigationBounds: undefined;
  readonly keyboardNavigationPoints:
    CRCEventTargetRegistration['keyboardNavigationPoints'];
  readonly sourceOrder: number;
  readonly depthMode: 'less-equal';
}

export type CRCWebGLPickRecord =
  | CRCWebGLGeometryPickRecord
  | CRCWebGLBoundsPickRecord;

export interface CRCWebGLPickLedger {
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly entries: readonly CRCWebGLPickRecord[];
}

export interface MutableCRCWebGLPickLedger {
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly entries: CRCWebGLPickRecord[];
  committed: boolean;
}

interface GeometryPickInput {
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly geometry: CRCWebGLGeometry;
  readonly model: Readonly<Float32Array>;
  readonly camera?: ResolvedWebGLCamera;
  readonly keyboardNavigationBounds?:
    CRCEventTargetRegistration['keyboardNavigationBounds'];
  readonly sourceOrder: number;
  readonly depthMode: 'less-equal';
}

interface BoundsPickInput {
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly bounds: Matrix4Bounds;
  readonly model: Readonly<Float32Array>;
  readonly camera: ResolvedWebGLCamera;
  readonly sourceOrder: number;
  readonly depthMode: 'less-equal';
}

/** Creates a transient ledger for one renderer-owned frame. */
export function createWebGLPickLedger(
  width: number,
  height: number,
): MutableCRCWebGLPickLedger {
  assertViewportDimension(width, 'width');
  assertViewportDimension(height, 'height');
  return {
    logicalViewport: Object.freeze({ width, height }),
    entries: [],
    committed: false,
  };
}

/** Records immutable geometry plus the exact model used by one successful draw. */
export function recordGeometryWebGLPick(
  ledger: MutableCRCWebGLPickLedger,
  input: GeometryPickInput,
): void {
  assertMutable(ledger);
  const model = new Float32Array(input.model);
  const keyboardNavigationBounds = input.keyboardNavigationBounds === undefined ?
    undefined : snapshotNavigationBounds(input.keyboardNavigationBounds);
  const keyboardNavigationPoints = input.keyboardNavigationBounds !== undefined ||
      input.camera === undefined ? undefined : projectWebGLBoundsPoints(
      getWebGLGeometryData(input.geometry).bounds,
      model,
      input.camera,
      ledger.logicalViewport,
    );
  ledger.entries.push(Object.freeze({
    kind: 'geometry',
    componentName: input.componentName,
    target: input.target,
    geometry: input.geometry,
    model,
    keyboardNavigationBounds,
    keyboardNavigationPoints,
    sourceOrder: input.sourceOrder,
    depthMode: input.depthMode,
  }));
}

/** Records one component-level AABB without retaining any particle geometry. */
export function recordBoundsWebGLPick(
  ledger: MutableCRCWebGLPickLedger,
  input: BoundsPickInput,
): void {
  assertMutable(ledger);
  const model = new Float32Array(input.model);
  const bounds = snapshotBounds(input.bounds);
  ledger.entries.push(Object.freeze({
    kind: 'bounds',
    componentName: input.componentName,
    target: input.target,
    bounds,
    model,
    keyboardNavigationBounds: undefined,
    keyboardNavigationPoints: projectWebGLBoundsPoints(
      bounds,
      model,
      input.camera,
      ledger.logicalViewport,
    ),
    sourceOrder: input.sourceOrder,
    depthMode: input.depthMode,
  }));
}

/** Closes a successful frame ledger against further draw-time mutation. */
export function commitWebGLPickLedger(
  ledger: MutableCRCWebGLPickLedger,
): CRCWebGLPickLedger {
  assertMutable(ledger);
  ledger.committed = true;
  return commitWebGLPickEntries(
    ledger.logicalViewport.width,
    ledger.logicalViewport.height,
    ledger.entries,
  );
}

/** Commits the backend's successful transient entry snapshot for one viewport. */
export function commitWebGLPickEntries(
  width: number,
  height: number,
  entries: readonly CRCWebGLPickRecord[],
): CRCWebGLPickLedger {
  assertViewportDimension(width, 'width');
  assertViewportDimension(height, 'height');
  return Object.freeze({
    logicalViewport: Object.freeze({ width, height }),
    entries: Object.freeze(entries.slice()),
  });
}

/** Publishes one committed frame's focus geometry to still-current targets. */
export function applyWebGLFocusMetadata(
  ledger: CRCWebGLPickLedger,
): CRCEventTargetRegistration | undefined {
  const eventRoot = ledger.entries[0]?.target.owner.eventRoot;
  let firstApplied: CRCEventTargetRegistration | undefined;
  for (const entry of ledger.entries) {
    if (
      entry.target.owner.eventRoot !== eventRoot ||
      !isBackendEventTargetLive(entry.target)
    ) continue;
    entry.target.keyboardNavigationBounds = entry.keyboardNavigationBounds;
    entry.target.keyboardNavigationPoints = entry.keyboardNavigationPoints;
    firstApplied ??= entry.target;
  }
  return firstApplied;
}

/** Releases unique frame-local target participation; safe to repeat. */
export function releaseWebGLPickParticipation(
  entries: readonly CRCWebGLPickRecord[],
): void {
  const targets = new Set<CRCEventTargetRegistration>();
  for (const entry of entries) targets.add(entry.target);
  for (const target of targets) runRelease(() => releaseBackendEventTarget(target));
}

function snapshotNavigationBounds(
  bounds: NonNullable<CRCEventTargetRegistration['keyboardNavigationBounds']>,
): NonNullable<CRCEventTargetRegistration['keyboardNavigationBounds']> {
  return Object.freeze({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
}

interface HomogeneousPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

interface LocalPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const BOX_EDGES = Object.freeze([
  [0, 1], [0, 2], [0, 4],
  [1, 3], [1, 5],
  [2, 3], [2, 6],
  [3, 7],
  [4, 5], [4, 6],
  [5, 7],
  [6, 7],
] as const);
const CLIP_SPACE_BOUNDS = Object.freeze({
  minimumX: -1,
  minimumY: -1,
  minimumZ: -1,
  maximumX: 1,
  maximumY: 1,
  maximumZ: 1,
});

export function projectWebGLBoundsPoints(
  bounds: Matrix4Bounds,
  model: Readonly<Float32Array>,
  camera: ResolvedWebGLCamera,
  viewport: Readonly<{ width: number; height: number }>,
): CRCEventTargetRegistration['keyboardNavigationPoints'] {
  const localCorners = boxCorners(bounds);
  const projectionModel = new Float32Array(16);
  multiplyMatrix4(projectionModel, camera.projectionViewMatrix, model);
  const clipCorners = localCorners.map(point =>
    transformPoint4(projectionModel, point)
  );
  const clipPoints: HomogeneousPoint[] = [];

  for (const [startIndex, endIndex] of BOX_EDGES) {
    const clipped = clipHomogeneousSegment(
      clipCorners[startIndex]!,
      clipCorners[endIndex]!,
    );
    if (clipped) clipPoints.push(...clipped);
  }

  // A large box may surround the view volume without one of its own edges
  // entering it. Clip the inverse-projected frustum edges against the local
  // AABB as the complementary constant-size intersection case.
  const inverseProjectionModel = new Float32Array(16);
  if (invertMatrix4(inverseProjectionModel, projectionModel)) {
    const frustumCorners = boxCorners(CLIP_SPACE_BOUNDS).map(point =>
      homogeneousToLocal(transformPoint4(inverseProjectionModel, point))
    );
    for (const [startIndex, endIndex] of BOX_EDGES) {
      const start = frustumCorners[startIndex];
      const end = frustumCorners[endIndex];
      if (!start || !end) continue;
      const clipped = clipLocalSegment(start, end, bounds);
      if (!clipped) continue;
      clipPoints.push(
        transformPoint4(projectionModel, clipped[0]),
        transformPoint4(projectionModel, clipped[1]),
      );
    }
  }

  const points: Array<Readonly<{ x: number; y: number }>> = [];
  for (const point of clipPoints) {
    const projected = clipPointToLayer(point, viewport);
    if (!projected || points.some(existing =>
      Math.abs(existing.x - projected.x) <= 1e-9 &&
      Math.abs(existing.y - projected.y) <= 1e-9
    )) continue;
    points.push(projected);
  }
  return points.length === 0 ? undefined : Object.freeze(points);
}

function boxCorners(bounds: Matrix4Bounds): LocalPoint[] {
  const corners: LocalPoint[] = [];
  for (const x of [bounds.minimumX, bounds.maximumX]) {
    for (const y of [bounds.minimumY, bounds.maximumY]) {
      for (const z of [bounds.minimumZ, bounds.maximumZ]) {
        corners.push({ x, y, z });
      }
    }
  }
  return corners;
}

function transformPoint4(
  matrix: Readonly<Float32Array>,
  point: LocalPoint,
): HomogeneousPoint {
  const { x, y, z } = point;
  return {
    x: matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
    y: matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
    z: matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!,
    w: matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!,
  };
}

function clipHomogeneousSegment(
  start: HomogeneousPoint,
  end: HomogeneousPoint,
): readonly [HomogeneousPoint, HomogeneousPoint] | undefined {
  if (!isFinitePoint4(start) || !isFinitePoint4(end)) return undefined;
  const startPlanes = frustumPlaneValues(start);
  const endPlanes = frustumPlaneValues(end);
  let minimum = 0;
  let maximum = 1;
  for (let plane = 0; plane < startPlanes.length; plane += 1) {
    const startValue = startPlanes[plane]!;
    const endValue = endPlanes[plane]!;
    if (startValue < 0 && endValue < 0) return undefined;
    if ((startValue < 0) !== (endValue < 0)) {
      const crossing = startValue / (startValue - endValue);
      if (!Number.isFinite(crossing)) return undefined;
      if (startValue < 0) minimum = Math.max(minimum, crossing);
      else maximum = Math.min(maximum, crossing);
      if (minimum > maximum) return undefined;
    }
  }
  return [lerpPoint4(start, end, minimum), lerpPoint4(start, end, maximum)];
}

function frustumPlaneValues(point: HomogeneousPoint): readonly number[] {
  return [
    point.x + point.w,
    point.w - point.x,
    point.y + point.w,
    point.w - point.y,
    point.z + point.w,
    point.w - point.z,
  ];
}

function lerpPoint4(
  start: HomogeneousPoint,
  end: HomogeneousPoint,
  amount: number,
): HomogeneousPoint {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    z: start.z + (end.z - start.z) * amount,
    w: start.w + (end.w - start.w) * amount,
  };
}

function homogeneousToLocal(point: HomogeneousPoint): LocalPoint | undefined {
  if (!isFinitePoint4(point) || point.w === 0) return undefined;
  const x = point.x / point.w;
  const y = point.y / point.w;
  const z = point.z / point.w;
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ?
    { x, y, z } : undefined;
}

function clipLocalSegment(
  start: LocalPoint,
  end: LocalPoint,
  bounds: Matrix4Bounds,
): readonly [LocalPoint, LocalPoint] | undefined {
  let minimum = 0;
  let maximum = 1;
  const axes = [
    [start.x, end.x, bounds.minimumX, bounds.maximumX],
    [start.y, end.y, bounds.minimumY, bounds.maximumY],
    [start.z, end.z, bounds.minimumZ, bounds.maximumZ],
  ] as const;
  for (const [startValue, endValue, axisMinimum, axisMaximum] of axes) {
    const delta = endValue - startValue;
    if (delta === 0) {
      if (startValue < axisMinimum || startValue > axisMaximum) return undefined;
      continue;
    }
    const first = (axisMinimum - startValue) / delta;
    const second = (axisMaximum - startValue) / delta;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return undefined;
  }
  return [
    lerpLocalPoint(start, end, minimum),
    lerpLocalPoint(start, end, maximum),
  ];
}

function snapshotBounds(bounds: Matrix4Bounds): Matrix4Bounds {
  return Object.freeze({
    minimumX: bounds.minimumX,
    minimumY: bounds.minimumY,
    minimumZ: bounds.minimumZ,
    maximumX: bounds.maximumX,
    maximumY: bounds.maximumY,
    maximumZ: bounds.maximumZ,
  });
}

function lerpLocalPoint(
  start: LocalPoint,
  end: LocalPoint,
  amount: number,
): LocalPoint {
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    z: start.z + (end.z - start.z) * amount,
  };
}

function clipPointToLayer(
  point: HomogeneousPoint,
  viewport: Readonly<{ width: number; height: number }>,
): Readonly<{ x: number; y: number }> | undefined {
  if (!isFinitePoint4(point) || point.w <= 0) return undefined;
  const scale = Math.max(
    1,
    Math.abs(point.x),
    Math.abs(point.y),
    Math.abs(point.z),
    Math.abs(point.w),
  );
  const tolerance = Number.EPSILON * scale * 32;
  if (frustumPlaneValues(point).some(value => value < -tolerance)) {
    return undefined;
  }
  const ndcX = Math.max(-1, Math.min(1, point.x / point.w));
  const ndcY = Math.max(-1, Math.min(1, point.y / point.w));
  const x = (ndcX + 1) * viewport.width * 0.5;
  const y = (1 - ndcY) * viewport.height * 0.5;
  return Number.isFinite(x) && Number.isFinite(y) ?
    Object.freeze({ x, y }) : undefined;
}

function isFinitePoint4(point: HomogeneousPoint): boolean {
  return Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z) &&
    Number.isFinite(point.w);
}

function assertMutable(ledger: MutableCRCWebGLPickLedger): void {
  if (ledger.committed) {
    throw new Error('A committed WebGL pick ledger cannot be modified.');
  }
}

function assertViewportDimension(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `WebGL pick ledger ${field} must be finite and positive.`,
    );
  }
}

function runRelease(release: () => void): void {
  try {
    release();
  } catch (error) {
    try {
      globalThis.reportError(error);
    } catch {
      // Reporting cannot suppress release of later frame-owned targets.
    }
  }
}
