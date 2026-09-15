import {
  signal,
  type CRCEventHandlers,
  type CRCPointerEvent,
  type CRCWheelEvent,
  type WritableSignal,
} from '@crc/core';
import * as coreInternal from '@crc/core/internal';
import type { CRCWebGLVector3 } from '../types.js';

export interface CRCOrbitCameraOptions {
  readonly orbitPoint: CRCWebGLVector3;
  readonly initialPosition: CRCWebGLVector3;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly rotateSpeed?: number;
  readonly zoomSpeed?: number;
}

export type CRCOrbitCameraHandlers = Required<Pick<
  CRCEventHandlers,
  | 'onPointerDown'
  | 'onPointerMove'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onLostPointerCapture'
  | 'onWheel'
>>;

export interface CRCOrbitCameraResult {
  readonly position: CRCWebGLVector3;
  readonly lookAt: CRCWebGLVector3;
  readonly handlers: CRCOrbitCameraHandlers;
}

interface ResolvedOrbitCameraOptions {
  readonly orbitPoint: CRCWebGLVector3;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly rotateSpeed: number;
  readonly zoomSpeed: number;
  readonly pageHeight: number;
}

interface ActiveOrbitPointer {
  readonly pointerId: number;
  x: number;
  y: number;
}

interface OrbitCameraSlot {
  active: boolean;
  azimuth: number;
  polar: number;
  distance: number;
  activePointer: ActiveOrbitPointer | undefined;
  options: ResolvedOrbitCameraOptions;
  revision: WritableSignal<number>;
  handlers: CRCOrbitCameraHandlers;
  position: CRCWebGLVector3 | undefined;
  lookAt: CRCWebGLVector3 | undefined;
  result: CRCOrbitCameraResult | undefined;
}

const MIN_POLAR = 0.001;
const MAX_POLAR = Math.PI - MIN_POLAR;

/** Owns one mounted spherical pose and stable ordinary CRC input handlers. */
export function crcOrbitCamera(
  options: CRCOrbitCameraOptions,
): CRCOrbitCameraResult {
  const candidate = resolveOptions(options);
  const initial = resolveInitialSpherical(options, candidate);
  const slot = coreInternal.useInternalHookSlot<OrbitCameraSlot>(
    'webglOrbitCamera',
    teardowns => {
      const state = {} as OrbitCameraSlot;
      state.active = true;
      state.azimuth = initial.azimuth;
      state.polar = initial.polar;
      state.distance = initial.distance;
      state.activePointer = undefined;
      state.options = candidate;
      state.revision = signal(0, { debugName: 'crcOrbitCamera revision' });
      state.handlers = createHandlers(state);
      state.position = undefined;
      state.lookAt = undefined;
      state.result = undefined;
      teardowns.add(() => {
        state.active = false;
        state.activePointer = undefined;
      });
      return state;
    },
  );
  const state = slot.value;
  state.revision.get();
  const candidateDistance = clampDistance(state.distance, candidate);
  const lookAt = reuseVector(state.lookAt, candidate.orbitPoint);
  const position = reuseVector(
    state.position,
    sphericalPosition(
      candidate.orbitPoint,
      state.azimuth,
      state.polar,
      candidateDistance,
    ),
  );
  const result = !state.result ||
      state.result.position !== position ||
      state.result.lookAt !== lookAt ?
    Object.freeze({ position, lookAt, handlers: state.handlers }) :
    state.result;
  internalOnCurrentRenderFinish((success: boolean) => {
    if (!success || !state.active) return;
    state.options = candidate;
    state.distance = candidateDistance;
    state.lookAt = lookAt;
    state.position = position;
    state.result = result;
  });
  return result;
}

function createHandlers(state: OrbitCameraSlot): CRCOrbitCameraHandlers {
  const finishPointer = (event: CRCPointerEvent): void => {
    if (state.activePointer?.pointerId === event.pointerId) {
      state.activePointer = undefined;
    }
  };
  return Object.freeze({
    onPointerDown(event) {
      if (!state.active || !event.isPrimary || state.activePointer) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      state.activePointer = {
        pointerId: event.pointerId,
        x: event.x,
        y: event.y,
      };
    },
    onPointerMove(event) {
      const pointer = state.activePointer;
      if (!state.active || pointer?.pointerId !== event.pointerId) return;
      const deltaX = event.x - pointer.x;
      const deltaY = event.y - pointer.y;
      pointer.x = event.x;
      pointer.y = event.y;
      const nextAzimuth = state.azimuth -
        deltaX * 0.01 * state.options.rotateSpeed;
      const nextPolar = clamp(
        state.polar + deltaY * 0.01 * state.options.rotateSpeed,
        MIN_POLAR,
        MAX_POLAR,
      );
      if (nextAzimuth === state.azimuth && nextPolar === state.polar) return;
      state.azimuth = nextAzimuth;
      state.polar = nextPolar;
      publishRevision(state);
    },
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onLostPointerCapture: finishPointer,
    onWheel(event) {
      if (!state.active || state.options.zoomSpeed === 0) return;
      const normalizedDelta = normalizeWheelDelta(
        event,
        state.options.pageHeight,
      );
      if (!Number.isFinite(normalizedDelta) || normalizedDelta === 0) return;
      const exponent = normalizedDelta * 0.001 * state.options.zoomSpeed;
      const maximum = Number.isFinite(state.options.maxDistance) ?
        state.options.maxDistance : Number.MAX_VALUE;
      const nextDistance = clamp(
        state.distance * Math.exp(exponent),
        state.options.minDistance,
        maximum,
      );
      if (nextDistance === state.distance) return;
      state.distance = nextDistance;
      event.preventDefault();
      publishRevision(state);
    },
  });
}

function publishRevision(state: OrbitCameraSlot): void {
  state.revision.update(revision => revision + 1);
}

function normalizeWheelDelta(event: CRCWheelEvent, pageHeight: number): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * pageHeight;
  return event.deltaY;
}

const internalGetCurrentLogicalViewport = (
  coreInternal as typeof coreInternal & {
    getCurrentLogicalViewport(): Readonly<{ width: number; height: number }>;
  }
).getCurrentLogicalViewport;

const internalOnCurrentRenderFinish = (
  coreInternal as typeof coreInternal & {
    onCurrentRenderFinish(callback: (success: boolean) => void): void;
  }
).onCurrentRenderFinish;

function resolveOptions(
  options: CRCOrbitCameraOptions,
): ResolvedOrbitCameraOptions {
  const orbitPoint = resolveVector(options.orbitPoint, 'orbitPoint');
  resolveVector(options.initialPosition, 'initialPosition');
  const minDistance = resolvePositive(
    options.minDistance ?? 0.1,
    'minDistance',
  );
  const maxDistance = options.maxDistance === undefined ? Infinity :
    resolvePositive(options.maxDistance, 'maxDistance');
  if (maxDistance < minDistance) {
    throw new RangeError(
      'crcOrbitCamera maxDistance must not be below minDistance.',
    );
  }
  return Object.freeze({
    orbitPoint,
    minDistance,
    maxDistance,
    rotateSpeed: resolveSpeed(options.rotateSpeed ?? 1, 'rotateSpeed'),
    zoomSpeed: resolveSpeed(options.zoomSpeed ?? 1, 'zoomSpeed'),
    pageHeight: internalGetCurrentLogicalViewport().height,
  });
}

function resolveInitialSpherical(
  options: CRCOrbitCameraOptions,
  resolved: ResolvedOrbitCameraOptions,
): Readonly<{ azimuth: number; polar: number; distance: number }> {
  const initialPosition = resolveVector(
    options.initialPosition,
    'initialPosition',
  );
  const x = initialPosition[0] - resolved.orbitPoint[0];
  const y = initialPosition[1] - resolved.orbitPoint[1];
  const z = initialPosition[2] - resolved.orbitPoint[2];
  const rawDistance = Math.hypot(x, y, z);
  if (rawDistance === 0) {
    throw new RangeError(
      'crcOrbitCamera initialPosition must differ from orbitPoint.',
    );
  }
  return Object.freeze({
    azimuth: Math.atan2(x, z),
    polar: clamp(Math.acos(clamp(y / rawDistance, -1, 1)), MIN_POLAR, MAX_POLAR),
    distance: clampDistance(rawDistance, resolved),
  });
}

function sphericalPosition(
  orbitPoint: CRCWebGLVector3,
  azimuth: number,
  polar: number,
  distance: number,
): CRCWebGLVector3 {
  const horizontal = Math.sin(polar) * distance;
  return Object.freeze([
    orbitPoint[0] + snapNearZero(Math.sin(azimuth) * horizontal),
    orbitPoint[1] + snapNearZero(Math.cos(polar) * distance),
    orbitPoint[2] + snapNearZero(Math.cos(azimuth) * horizontal),
  ]);
}

function snapNearZero(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

function reuseVector(
  previous: CRCWebGLVector3 | undefined,
  next: CRCWebGLVector3,
): CRCWebGLVector3 {
  return previous && previous[0] === next[0] && previous[1] === next[1] &&
      previous[2] === next[2] ? previous : next;
}

function resolveVector(
  value: CRCWebGLVector3,
  field: 'orbitPoint' | 'initialPosition',
): CRCWebGLVector3 {
  if (!Array.isArray(value) || value.length !== 3 ||
    !value.every(component => typeof component === 'number' &&
      Number.isFinite(component))) {
    throw new TypeError(`crcOrbitCamera ${field} must contain three finite numbers.`);
  }
  return Object.freeze([value[0], value[1], value[2]]);
}

function resolvePositive(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`crcOrbitCamera ${field} must be finite.`);
  }
  if (value <= 0) {
    throw new RangeError(`crcOrbitCamera ${field} must be positive.`);
  }
  return value;
}

function resolveSpeed(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`crcOrbitCamera ${field} must be finite.`);
  }
  if (value < 0) {
    throw new RangeError(`crcOrbitCamera ${field} must be nonnegative.`);
  }
  return value;
}

function clampDistance(
  value: number,
  options: Pick<ResolvedOrbitCameraOptions, 'minDistance' | 'maxDistance'>,
): number {
  return clamp(value, options.minDistance, options.maxDistance);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
