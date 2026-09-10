import type {
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import type {
  CRCWebGLCameraSnapshot,
  CRCWebGLGeometry,
  CRCWebGLHitCapability,
} from './types.js';

export interface CRCWebGLGeometryPickRecord {
  readonly kind: 'geometry';
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly geometry: CRCWebGLGeometry;
  readonly model: Readonly<Float32Array>;
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
  ledger.entries.push(Object.freeze({
    kind: 'geometry',
    componentName: input.componentName,
    target: input.target,
    geometry: input.geometry,
    model: new Float32Array(input.model),
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
  ledger.entries.push(Object.freeze({
    kind: 'custom',
    componentName: input.componentName,
    target: input.target,
    resolve: input.resolve,
    props: snapshotRecord(input.props),
    style: snapshotRecord(input.style),
    model: new Float32Array(input.model),
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

function snapshotRecord(
  value: Readonly<Record<PropertyKey, unknown>>,
): Readonly<Record<PropertyKey, unknown>> {
  return Object.freeze({ ...value });
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
