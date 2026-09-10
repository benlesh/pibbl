import {
  isBackendEventTargetLive,
  type CRCEventTargetRegistration,
} from '@crc/core/internal';
import type {
  CRCWebGLCameraSnapshot,
  CRCWebGLGeometry,
  CRCWebGLHitCapability,
} from './types.js';
import {
  getWebGLGeometryData,
  isWebGLGeometry,
} from './geometry/geometry.js';
import {
  invertMatrix4,
  multiplyMatrix4,
} from './math/matrix4.js';

const arrayBufferByteLength = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'byteLength',
)!.get!;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayBuffer = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'buffer',
)!.get!;
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'byteOffset',
)!.get!;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'byteLength',
)!.get!;
const dataViewBuffer = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'buffer',
)!.get!;
const dataViewByteOffset = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'byteOffset',
)!.get!;
const dataViewByteLength = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'byteLength',
)!.get!;

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

export interface CRCWebGLCustomPickRecord {
  readonly kind: 'custom';
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly resolve: Extract<
    CRCWebGLHitCapability<any, any>,
    { readonly kind: 'custom' }
  >['resolve'];
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  readonly model: Readonly<Float32Array>;
  readonly keyboardNavigationBounds:
    CRCEventTargetRegistration['keyboardNavigationBounds'];
  readonly keyboardNavigationPoints:
    CRCEventTargetRegistration['keyboardNavigationPoints'];
  readonly camera: CRCWebGLCameraSnapshot;
  readonly sourceOrder: number;
  readonly depthMode: 'less-equal';
}

export type CRCWebGLPickRecord =
  | CRCWebGLGeometryPickRecord
  | CRCWebGLCustomPickRecord;

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
  readonly camera?: CRCWebGLCameraSnapshot;
  readonly keyboardNavigationBounds?:
    CRCEventTargetRegistration['keyboardNavigationBounds'];
  readonly sourceOrder: number;
  readonly depthMode: 'less-equal';
}

interface CustomPickInput {
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly resolve: CRCWebGLCustomPickRecord['resolve'];
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  readonly model: Readonly<Float32Array>;
  readonly keyboardNavigationBounds?:
    CRCEventTargetRegistration['keyboardNavigationBounds'];
  readonly camera: CRCWebGLCameraSnapshot;
  readonly sourceOrder: number;
  readonly depthMode: 'less-equal';
}

/** Creates the frame-local ledger populated during primitive traversal. */
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
      input.camera === undefined ? undefined : projectGeometryPoints(
      input.geometry,
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

/** Records one custom resolver with only committed, non-environment snapshots. */
export function recordCustomWebGLPick(
  ledger: MutableCRCWebGLPickLedger,
  input: CustomPickInput,
): void {
  assertMutable(ledger);
  const props = snapshotCustomHitRecord(
    input.props,
    input.componentName,
    'props',
  );
  const style = snapshotCustomHitRecord(
    input.style,
    input.componentName,
    'style',
  );
  ledger.entries.push(Object.freeze({
    kind: 'custom',
    componentName: input.componentName,
    target: input.target,
    resolve: input.resolve,
    props,
    style,
    model: new Float32Array(input.model),
    keyboardNavigationBounds: input.keyboardNavigationBounds === undefined ?
      undefined : snapshotNavigationBounds(input.keyboardNavigationBounds),
    keyboardNavigationPoints: undefined,
    camera: snapshotWebGLPickCamera(input.camera),
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

type GeometryBounds = ReturnType<typeof getWebGLGeometryData>['bounds'];

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

function projectGeometryPoints(
  geometry: CRCWebGLGeometry,
  model: Readonly<Float32Array>,
  camera: CRCWebGLCameraSnapshot,
  viewport: Readonly<{ width: number; height: number }>,
): CRCEventTargetRegistration['keyboardNavigationPoints'] {
  const bounds = getWebGLGeometryData(geometry).bounds;
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

function boxCorners(bounds: GeometryBounds): LocalPoint[] {
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
  bounds: GeometryBounds,
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

/** Gives a resolver a defensive clone without exposing committed mutable views. */
export function cloneCustomHitRecord(
  value: Readonly<Record<PropertyKey, unknown>>,
  componentName: string,
  path: 'props' | 'style',
): Readonly<Record<PropertyKey, unknown>> {
  return snapshotCustomHitRecord(value, componentName, path);
}

function snapshotCustomHitRecord(
  value: Readonly<Record<PropertyKey, unknown>>,
  componentName: string,
  path: string,
): Readonly<Record<PropertyKey, unknown>> {
  return snapshotCustomHitValue(
    value,
    componentName,
    path,
    new WeakMap(),
    new WeakMap(),
  ) as Readonly<Record<PropertyKey, unknown>>;
}

function snapshotCustomHitValue(
  value: unknown,
  componentName: string,
  path: string,
  clones: WeakMap<object, unknown>,
  activePaths: WeakMap<object, string>,
): unknown {
  if (
    value === null ||
    typeof value === 'undefined' ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    typeof value === 'function'
  ) return value;
  if (isWebGLGeometry(value)) return value;
  if (typeof value !== 'object') return value;

  const activePath = activePaths.get(value);
  if (activePath) {
    throw customSnapshotError(
      componentName,
      path,
      `is cyclic and references ${activePath}`,
    );
  }
  const existing = clones.get(value);
  if (existing !== undefined) return existing;

  if (value instanceof ArrayBuffer) {
    if (Object.getPrototypeOf(value) !== ArrayBuffer.prototype) {
      throw customSnapshotError(
        componentName,
        path,
        `contains unsupported mutable ${objectName(value)}`,
      );
    }
    const clone = copyArrayBuffer(value);
    clones.set(value, clone);
    return clone;
  }
  if (ArrayBuffer.isView(value)) {
    const clone = copyArrayBufferView(value);
    if (!clone) {
      throw customSnapshotError(
        componentName,
        path,
        `contains unsupported mutable ${objectName(value)}`,
      );
    }
    clones.set(value, clone);
    return clone;
  }
  if (typeof Path2D !== 'undefined' && value instanceof Path2D) {
    const clone = new Path2D(value);
    clones.set(value, clone);
    return clone;
  }

  const prototype = Object.getPrototypeOf(value);
  const plain = prototype === Object.prototype || prototype === null;
  if (!plain && !Array.isArray(value)) {
    throw customSnapshotError(
      componentName,
      path,
      `contains unsupported mutable ${objectName(value)}`,
    );
  }

  const clone: Record<PropertyKey, unknown> | unknown[] =
    Array.isArray(value) ? new Array(value.length) : Object.create(prototype);
  clones.set(value, clone);
  activePaths.set(value, path);
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (key === 'length' && Array.isArray(value)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable) continue;
      const childPath = appendSnapshotPath(path, key, Array.isArray(value));
      if (!('value' in descriptor)) {
        throw customSnapshotError(
          componentName,
          childPath,
          'contains an unsupported accessor property',
        );
      }
      const child = snapshotCustomHitValue(
        descriptor.value,
        componentName,
        childPath,
        clones,
        activePaths,
      );
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: child,
        writable: true,
      });
    }
  } finally {
    activePaths.delete(value);
  }
  return Object.freeze(clone);
}

function copyArrayBuffer(value: ArrayBuffer): ArrayBuffer {
  const byteLength = arrayBufferByteLength.call(value) as number;
  const clone = new ArrayBuffer(byteLength);
  new Uint8Array(clone).set(new Uint8Array(value, 0, byteLength));
  return clone;
}

function copyArrayBufferView(value: ArrayBufferView): ArrayBufferView | undefined {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === DataView.prototype) {
    return new DataView(copyViewBytes(value, true));
  }
  if (!isSupportedTypedArrayPrototype(prototype)) return undefined;
  const buffer = copyViewBytes(value, false);
  if (prototype === Int8Array.prototype) return new Int8Array(buffer);
  if (prototype === Uint8Array.prototype) return new Uint8Array(buffer);
  if (prototype === Uint8ClampedArray.prototype) {
    return new Uint8ClampedArray(buffer);
  }
  if (prototype === Int16Array.prototype) return new Int16Array(buffer);
  if (prototype === Uint16Array.prototype) return new Uint16Array(buffer);
  if (prototype === Int32Array.prototype) return new Int32Array(buffer);
  if (prototype === Uint32Array.prototype) return new Uint32Array(buffer);
  if (prototype === Float16Array.prototype) return new Float16Array(buffer);
  if (prototype === Float32Array.prototype) return new Float32Array(buffer);
  if (prototype === Float64Array.prototype) return new Float64Array(buffer);
  if (prototype === BigInt64Array.prototype) return new BigInt64Array(buffer);
  return new BigUint64Array(buffer);
}

function copyViewBytes(
  value: ArrayBufferView,
  dataView: boolean,
): ArrayBuffer {
  const getBuffer = dataView ? dataViewBuffer : typedArrayBuffer;
  const getByteOffset = dataView ? dataViewByteOffset : typedArrayByteOffset;
  const getByteLength = dataView ? dataViewByteLength : typedArrayByteLength;
  const source = getBuffer.call(value) as ArrayBufferLike;
  const byteOffset = getByteOffset.call(value) as number;
  const byteLength = getByteLength.call(value) as number;
  const clone = new ArrayBuffer(byteLength);
  new Uint8Array(clone).set(new Uint8Array(source, byteOffset, byteLength));
  return clone;
}

function isSupportedTypedArrayPrototype(prototype: object): boolean {
  return prototype === Int8Array.prototype ||
    prototype === Uint8Array.prototype ||
    prototype === Uint8ClampedArray.prototype ||
    prototype === Int16Array.prototype ||
    prototype === Uint16Array.prototype ||
    prototype === Int32Array.prototype ||
    prototype === Uint32Array.prototype ||
    prototype === Float16Array.prototype ||
    prototype === Float32Array.prototype ||
    prototype === Float64Array.prototype ||
    prototype === BigInt64Array.prototype ||
    prototype === BigUint64Array.prototype;
}

function appendSnapshotPath(
  parent: string,
  key: PropertyKey,
  array: boolean,
): string {
  if (typeof key === 'symbol') return `${parent}[${String(key)}]`;
  const text = String(key);
  if (array && /^(0|[1-9]\d*)$/.test(text)) return `${parent}[${text}]`;
  if (/^[A-Za-z_$][\w$]*$/.test(text)) return `${parent}.${text}`;
  return `${parent}[${JSON.stringify(text)}]`;
}

function objectName(value: object): string {
  const prototype = Object.getPrototypeOf(value) as object | null;
  const descriptor = prototype &&
    Object.getOwnPropertyDescriptor(prototype, 'constructor');
  const name = descriptor && 'value' in descriptor &&
    typeof descriptor.value === 'function' ? descriptor.value.name : undefined;
  return typeof name === 'string' && name ? name : 'object';
}

function customSnapshotError(
  componentName: string,
  path: string,
  reason: string,
): TypeError {
  return new TypeError(
    `${componentName} custom hit snapshot ${path} ${reason}.`,
  );
}

export function snapshotWebGLPickCamera(
  camera: CRCWebGLCameraSnapshot,
): CRCWebGLCameraSnapshot {
  const descriptor = Object.freeze({
    type: 'perspective' as const,
    position: Object.freeze([...camera.descriptor.position]) as
      CRCWebGLCameraSnapshot['descriptor']['position'],
    lookAt: Object.freeze([...camera.descriptor.lookAt]) as
      CRCWebGLCameraSnapshot['descriptor']['lookAt'],
    up: Object.freeze([...camera.descriptor.up]) as
      CRCWebGLCameraSnapshot['descriptor']['up'],
    fieldOfViewDegrees: camera.descriptor.fieldOfViewDegrees,
    near: camera.descriptor.near,
    far: camera.descriptor.far,
  });
  return Object.freeze({
    descriptor,
    aspect: camera.aspect,
    viewMatrix: new Float32Array(camera.viewMatrix),
    projectionMatrix: new Float32Array(camera.projectionMatrix),
    projectionViewMatrix: new Float32Array(camera.projectionViewMatrix),
    inverseProjectionViewMatrix: new Float32Array(
      camera.inverseProjectionViewMatrix,
    ),
  });
}
