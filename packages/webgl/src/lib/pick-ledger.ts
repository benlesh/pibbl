import type {
  CRCEventTargetRegistration,
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
import { multiplyMatrix4 } from './math/matrix4.js';

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
    input.camera === undefined ? undefined : projectGeometryBounds(
      input.geometry,
      model,
      input.camera,
      ledger.logicalViewport,
    ) : snapshotNavigationBounds(input.keyboardNavigationBounds);
  ledger.entries.push(Object.freeze({
    kind: 'geometry',
    componentName: input.componentName,
    target: input.target,
    geometry: input.geometry,
    model,
    keyboardNavigationBounds,
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

/** Publishes one committed frame's layer-local focus rectangles. */
export function applyWebGLFocusMetadata(
  ledger: CRCWebGLPickLedger,
): void {
  for (const entry of ledger.entries) {
    entry.target.keyboardNavigationBounds = entry.keyboardNavigationBounds;
  }
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

function projectGeometryBounds(
  geometry: CRCWebGLGeometry,
  model: Readonly<Float32Array>,
  camera: CRCWebGLCameraSnapshot,
  viewport: Readonly<{ width: number; height: number }>,
): CRCEventTargetRegistration['keyboardNavigationBounds'] {
  const { positions } = getWebGLGeometryData(geometry);
  let minimumX = Number.POSITIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset]!;
    const y = positions[offset + 1]!;
    const z = positions[offset + 2]!;
    minimumX = Math.min(minimumX, x);
    minimumY = Math.min(minimumY, y);
    minimumZ = Math.min(minimumZ, z);
    maximumX = Math.max(maximumX, x);
    maximumY = Math.max(maximumY, y);
    maximumZ = Math.max(maximumZ, z);
  }

  const projectionModel = new Float32Array(16);
  multiplyMatrix4(
    projectionModel,
    camera.projectionViewMatrix,
    model,
  );
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const x of [minimumX, maximumX]) {
    for (const y of [minimumY, maximumY]) {
      for (const z of [minimumZ, maximumZ]) {
        const w = projectionModel[3]! * x +
          projectionModel[7]! * y +
          projectionModel[11]! * z +
          projectionModel[15]!;
        const ndcX = (
          projectionModel[0]! * x +
          projectionModel[4]! * y +
          projectionModel[8]! * z +
          projectionModel[12]!
        ) / w;
        const ndcY = (
          projectionModel[1]! * x +
          projectionModel[5]! * y +
          projectionModel[9]! * z +
          projectionModel[13]!
        ) / w;
        const layerX = (ndcX + 1) * viewport.width * 0.5;
        const layerY = (1 - ndcY) * viewport.height * 0.5;
        if (!Number.isFinite(layerX) || !Number.isFinite(layerY)) {
          return undefined;
        }
        left = Math.min(left, layerX);
        top = Math.min(top, layerY);
        right = Math.max(right, layerX);
        bottom = Math.max(bottom, layerY);
      }
    }
  }
  return Object.freeze({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
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
