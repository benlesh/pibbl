import { withSignalWriteForbidden } from '../signals/graph.js';
import { easing } from './easing.js';
import {
  createSpringRecord,
  resolveSpringStart,
  sampleSpring,
  type SpringDefinitionRecord,
} from './spring.js';
import type {
  CRCAnimationDefinition,
  CRCAnimationOptions,
  CRCAnimationSampleInput,
  CRCEasing,
  CRCInterpolator,
  CRCKeyframesOptions,
  CRCSpringOptions,
  CRCStepperOptions,
  CRCTweenOptions,
} from './types.js';

declare const seekableDefinitionActivationBrand: unique symbol;

interface BaseDefinitionRecord {
  readonly duration: number;
  readonly debugName: string | undefined;
}

interface TweenDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'tween';
  readonly hasFrom: boolean;
  readonly from: T | undefined;
  readonly to: T;
  readonly easing: CRCEasing;
  readonly interpolate: CRCInterpolator<T> | undefined;
}

interface KeyframesDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'keyframes';
  readonly values: readonly T[];
  readonly offsets: readonly number[];
  readonly easings: readonly CRCEasing[];
  readonly interpolate: CRCInterpolator<T> | undefined;
}

interface CustomDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'custom';
  readonly sample: (input: CRCAnimationSampleInput<T>) => T;
}

export interface StepperDefinitionRecord<T> extends BaseDefinitionRecord {
  readonly kind: 'stepper';
  readonly stepMilliseconds: number;
  readonly maxElapsedMilliseconds: number;
  readonly initial: (currentValue: T) => unknown;
  readonly step: (state: unknown, deltaMilliseconds: number) => unknown;
  readonly read: (state: unknown) => T;
  readonly done: ((state: unknown) => boolean) | undefined;
}

export type DefinitionRecord<T> =
  | TweenDefinitionRecord<T>
  | KeyframesDefinitionRecord<T>
  | CustomDefinitionRecord<T>
  | StepperDefinitionRecord<T>
  | SpringDefinitionRecord;

/** @internal Opaque activation-time state for one seekable track instance. */
export interface SeekableDefinitionActivation<T> {
  readonly [seekableDefinitionActivationBrand]: T;
  readonly duration: number;
  readonly initialValue: T;
}

/** @internal Callback-free knowledge about a seekable definition boundary. */
export type SeekableDefinitionBoundaryValue<T> =
  | { readonly kind: 'known'; readonly value: T }
  | { readonly kind: 'unknown' };

interface SeekableDefinitionActivationRecord<T> {
  readonly definition: CRCAnimationDefinition<T>;
  readonly definitionRecord: Exclude<DefinitionRecord<T>, StepperDefinitionRecord<T>>;
  readonly initialValue: T;
}

const definitionRecords = new WeakMap<
  CRCAnimationDefinition<unknown>,
  DefinitionRecord<unknown>
>();
const seekableActivationRecords = new WeakMap<
  SeekableDefinitionActivation<unknown>,
  SeekableDefinitionActivationRecord<unknown>
>();
let keyframeDefinitions = 0;
let keyframeStorageArrayAllocations = 0;
let keyframeSamples = 0;
let keyframeSampleArrayAllocations = 0;
let keyframeSampleDepth = 0;

export interface AnimationDefinitionPerformanceSnapshot {
  readonly keyframeDefinitions: number;
  readonly keyframeStorageArrayAllocations: number;
  readonly keyframeSamples: number;
  readonly keyframeSampleArrayAllocations: number;
}

/** @internal Deterministic structural counters for normalized keyframe sampling. */
export function animationDefinitionPerformanceSnapshot():
AnimationDefinitionPerformanceSnapshot {
  return Object.freeze({
    keyframeDefinitions,
    keyframeStorageArrayAllocations,
    keyframeSamples,
    keyframeSampleArrayAllocations,
  });
}

function definitionLabel(debugName: string | undefined): string {
  return debugName === undefined ? 'CRC animation definition' :
    `CRC animation definition "${debugName}"`;
}

function assertDuration(duration: number, debugName: string | undefined): void {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError(`${definitionLabel(debugName)} duration must be finite and nonnegative.`);
  }
}

function assertFiniteNumber(value: number, message: string): void {
  if (!Number.isFinite(value)) throw new RangeError(message);
}

const MUTATING_MAP_METHODS = new Set<PropertyKey>(['set', 'delete', 'clear']);
const MUTATING_SET_METHODS = new Set<PropertyKey>(['add', 'delete', 'clear']);
const MUTATING_DATE_METHODS = new Set<PropertyKey>([
  'setDate', 'setFullYear', 'setHours', 'setMilliseconds', 'setMinutes',
  'setMonth', 'setSeconds', 'setTime', 'setUTCDate', 'setUTCFullYear',
  'setUTCHours', 'setUTCMilliseconds', 'setUTCMinutes', 'setUTCMonth',
  'setUTCSeconds', 'setYear',
]);

function immutableBuiltin<T extends object>(
  target: T,
  mutatingMethods: ReadonlySet<PropertyKey>,
): T {
  return new Proxy(target, {
    get(current, key) {
      if (mutatingMethods.has(key)) {
        return (): never => {
          throw new TypeError('Cannot mutate an animation definition snapshot.');
        };
      }
      const member = Reflect.get(current, key, current);
      return typeof member === 'function' && key !== 'constructor' ?
        member.bind(current) : member;
    },
    set(): false {
      return false;
    },
    defineProperty(): false {
      return false;
    },
    deleteProperty(): false {
      return false;
    },
  });
}

function rememberIdentity<T extends object>(
  value: T,
  seen: WeakMap<object, unknown>,
): T {
  seen.set(value, value);
  return value;
}

function hasOwnProperties(value: object, allowed: ReadonlySet<PropertyKey>): boolean {
  return Reflect.ownKeys(value).some(key => !allowed.has(key));
}

function hasOnlyDataProperties(value: object, allowed: ReadonlySet<PropertyKey>): boolean {
  return Reflect.ownKeys(value).every(key => {
    if (allowed.has(key)) return true;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor;
  });
}

const ARRAY_OWN_KEYS = new Set<PropertyKey>(['length']);
const REGEXP_OWN_KEYS = new Set<PropertyKey>(['lastIndex']);
const snapshotsRequiringIsolation = new WeakSet<object>();

function requiresIsolation(value: unknown): value is object {
  return (typeof value === 'object' && value !== null || typeof value === 'function') &&
    snapshotsRequiringIsolation.has(value as object);
}

function propagateIsolation(snapshot: object, value: unknown): void {
  if (requiresIsolation(value)) snapshotsRequiringIsolation.add(snapshot);
}

function isArrayIndex(key: PropertyKey): boolean {
  return typeof key === 'string' && /^(?:0|[1-9]\d*)$/u.test(key);
}

function cloneTypedArray(value: ArrayBufferView): ArrayBufferView {
  if (value instanceof DataView) {
    const bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    return new DataView(bytes);
  }
  const TypedArray = value.constructor as unknown as {
    new (source: ArrayBufferView): ArrayBufferView;
  };
  return new TypedArray(value);
}

/**
 * Definitions retain values after their caller has moved on. The context is
 * shared across one definition so aliases and cycles remain aliases and cycles
 * in its immutable snapshot. Only categories with stable, inspectable cloning
 * semantics are copied. Reconstructable values that cannot themselves be
 * frozen are marked so only the containing paths are rematerialized before a
 * callback or terminal return. Functions, classes, accessors, and opaque host
 * values (notably WeakMap, WeakSet, Promise, and host handles) remain usable
 * identity values because cloning them can manufacture an invalid receiver or
 * change their behavior; an absolute snapshot guarantee for those values
 * requires an explicit public clone contract that CRC does not currently
 * provide.
 */
function snapshotAnimationValue<T>(
  value: T,
  seen: WeakMap<object, unknown>,
  isolateStoredValue = false,
): T {
  if (value === null || typeof value === 'function' || typeof value !== 'object') {
    return value;
  }
  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;
  if (isolateStoredValue && !requiresIsolation(value)) {
    seen.set(value, value);
    return value;
  }

  if (value instanceof Date) {
    if (hasOwnProperties(value, new Set())) return rememberIdentity(value, seen) as T;
    const snapshot = immutableBuiltin(new Date(value.getTime()), MUTATING_DATE_METHODS);
    seen.set(value, snapshot);
    return snapshot as T;
  }
  if (value instanceof Map) {
    if (hasOwnProperties(value, new Set())) return rememberIdentity(value, seen) as T;
    const target = new Map();
    const snapshot = immutableBuiltin(target, MUTATING_MAP_METHODS);
    seen.set(value, snapshot);
    for (const [key, entry] of value) {
      const keySnapshot = snapshotAnimationValue(key, seen, isolateStoredValue);
      const entrySnapshot = snapshotAnimationValue(entry, seen, isolateStoredValue);
      target.set(keySnapshot, entrySnapshot);
      propagateIsolation(snapshot, keySnapshot);
      propagateIsolation(snapshot, entrySnapshot);
    }
    return snapshot as T;
  }
  if (value instanceof Set) {
    if (hasOwnProperties(value, new Set())) return rememberIdentity(value, seen) as T;
    const target = new Set();
    const snapshot = immutableBuiltin(target, MUTATING_SET_METHODS);
    seen.set(value, snapshot);
    for (const entry of value) {
      const entrySnapshot = snapshotAnimationValue(entry, seen, isolateStoredValue);
      target.add(entrySnapshot);
      propagateIsolation(snapshot, entrySnapshot);
    }
    return snapshot as T;
  }
  if (Array.isArray(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (Object.getPrototypeOf(value) !== Array.prototype ||
      ownKeys.some(key => !ARRAY_OWN_KEYS.has(key) && !isArrayIndex(key)) ||
      !hasOnlyDataProperties(value, ARRAY_OWN_KEYS)) {
      return rememberIdentity(value, seen) as T;
    }
    const snapshot: unknown[] = new Array(value.length);
    if (keyframeSampleDepth > 0) keyframeSampleArrayAllocations++;
    seen.set(value, snapshot);
    for (const key of ownKeys) {
      if (ARRAY_OWN_KEYS.has(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !('value' in descriptor)) continue;
      const itemSnapshot = snapshotAnimationValue(
        descriptor.value,
        seen,
        isolateStoredValue,
      );
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: descriptor.enumerable,
        writable: false,
        value: itemSnapshot,
      });
      propagateIsolation(snapshot, itemSnapshot);
    }
    return Object.freeze(snapshot) as T;
  }

  if (value instanceof RegExp) {
    if (hasOwnProperties(value, REGEXP_OWN_KEYS)) return rememberIdentity(value, seen) as T;
    const snapshot = new RegExp(value.source, value.flags);
    snapshot.lastIndex = value.lastIndex;
    seen.set(value, snapshot);
    snapshotsRequiringIsolation.add(snapshot);
    return snapshot as T;
  }

  if (ArrayBuffer.isView(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(key => !isArrayIndex(key))) return rememberIdentity(value, seen) as T;
    const snapshot = cloneTypedArray(value);
    seen.set(value, snapshot);
    snapshotsRequiringIsolation.add(snapshot);
    return snapshot as T;
  }

  if (value instanceof ArrayBuffer) {
    const snapshot = value.slice(0);
    seen.set(value, snapshot);
    snapshotsRequiringIsolation.add(snapshot);
    return snapshot as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null ||
    !hasOnlyDataProperties(value, new Set())) {
    return rememberIdentity(value, seen) as T;
  }
  const snapshot = Object.create(prototype) as Record<PropertyKey, unknown>;
  seen.set(value, snapshot);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    const propertySnapshot = snapshotAnimationValue(
      descriptor.value,
      seen,
      isolateStoredValue,
    );
    Object.defineProperty(snapshot, key, {
      configurable: false,
      enumerable: descriptor.enumerable,
      writable: false,
      value: propertySnapshot,
    });
    propagateIsolation(snapshot, propertySnapshot);
  }
  return Object.freeze(snapshot) as T;
}

function isolateStoredAnimationValue<T>(
  value: T,
  seen: WeakMap<object, unknown>,
): T {
  return snapshotAnimationValue(value, seen, true);
}

/** @internal Captures a committed output value for a playback activation. */
export function snapshotAnimationActivationValue<T>(
  value: T,
  seen: WeakMap<object, unknown> = new WeakMap(),
): T {
  return snapshotAnimationValue(value, seen);
}

function validateSampledValue<T>(sampled: T, debugName: string | undefined): T {
  if (typeof sampled === 'number' && !Number.isFinite(sampled)) {
    throw new RangeError(`${definitionLabel(debugName)} sampled value must be finite.`);
  }
  return sampled;
}

function createDefinition<T>(record: DefinitionRecord<T>): CRCAnimationDefinition<T> {
  const definition = Object.freeze({}) as CRCAnimationDefinition<T>;
  definitionRecords.set(
    definition as CRCAnimationDefinition<unknown>,
    Object.freeze(record) as DefinitionRecord<unknown>,
  );
  return definition;
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function callback<T>(
  debugName: string | undefined,
  callback: () => T,
): T {
  return withSignalWriteForbidden(
    `${definitionLabel(debugName)} callbacks cannot write to signals.`,
    callback,
  );
}

function sampledProgress(duration: number, localTime: number): {
  readonly localTime: number;
  readonly progress: number;
} {
  assertFiniteNumber(localTime, 'CRC animation sample localTime must be finite.');
  if (duration === 0) return Object.freeze({ localTime: 0, progress: 1 });
  const normalizedLocalTime = Math.min(duration, Math.max(0, localTime));
  return Object.freeze({
    localTime: normalizedLocalTime,
    progress: normalizedLocalTime / duration,
  });
}

function interpolate<T>(
  from: T,
  to: T,
  progress: number,
  custom: CRCInterpolator<T> | undefined,
  debugName: string | undefined,
): T {
  if (custom === undefined && (typeof from !== 'number' || typeof to !== 'number')) {
    throw new TypeError(`${definitionLabel(debugName)} requires an explicit interpolator for nonnumeric values.`);
  }
  let sampled: T;
  if (custom === undefined) {
    sampled = ((from as unknown as number) +
      ((to as unknown as number) - (from as unknown as number)) * progress) as T;
  } else {
    const isolated = new WeakMap<object, unknown>();
    const isolatedFrom = isolateStoredAnimationValue(from, isolated);
    const isolatedTo = isolateStoredAnimationValue(to, isolated);
    sampled = callback(debugName, () => custom(isolatedFrom, isolatedTo, progress));
  }
  return validateSampledValue(sampled, debugName);
}

function easedProgress(
  ease: CRCEasing,
  progress: number,
  debugName: string | undefined,
): number {
  const eased = callback(debugName, () => ease(progress));
  if (!Number.isFinite(eased)) {
    throw new RangeError(`${definitionLabel(debugName)} easing result must be finite.`);
  }
  return eased;
}

function normalizeOffsets(
  values: readonly unknown[],
  offsets: readonly number[] | undefined,
  debugName: string | undefined,
): readonly number[] {
  if (offsets === undefined) {
    return Object.freeze(values.map((_, index) => index / (values.length - 1)));
  }
  if (offsets.length !== values.length) {
    throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must match the values length.`);
  }
  const snapshot = [...offsets];
  for (const offset of snapshot) {
    if (!Number.isFinite(offset) || offset < 0 || offset > 1) {
      throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must be finite values within [0, 1].`);
    }
  }
  if (snapshot[0] !== 0) {
    throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must start at 0.`);
  }
  if (snapshot.at(-1) !== 1) {
    throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must end at 1.`);
  }
  for (let index = 1; index < snapshot.length; index++) {
    if (snapshot[index] < snapshot[index - 1]) {
      throw new RangeError(`${definitionLabel(debugName)} keyframe offsets must be nondecreasing.`);
    }
  }
  return Object.freeze(snapshot);
}

function normalizeEasings(
  easingOption: CRCEasing | readonly CRCEasing[] | undefined,
  segmentCount: number,
  debugName: string | undefined,
): readonly CRCEasing[] {
  if (Array.isArray(easingOption)) {
    if (easingOption.length !== segmentCount) {
      throw new RangeError(`${definitionLabel(debugName)} keyframe easing list must have one entry per segment.`);
    }
    if (easingOption.some(ease => typeof ease !== 'function')) {
      throw new TypeError(`${definitionLabel(debugName)} keyframe easings must be functions.`);
    }
    return Object.freeze([...easingOption]);
  }
  const ease = easingOption ?? easing.linear;
  if (typeof ease !== 'function') {
    throw new TypeError(`${definitionLabel(debugName)} easing must be a function.`);
  }
  return Object.freeze(Array.from({ length: segmentCount }, () => ease));
}

/** Returns an opaque immutable tween definition. */
export function tween<T>(options: Readonly<CRCTweenOptions<T>>): CRCAnimationDefinition<T> {
  assertDuration(options.duration, options.debugName);
  if (typeof options.easing !== 'undefined' && typeof options.easing !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} easing must be a function.`);
  }
  if (typeof options.interpolate !== 'undefined' && typeof options.interpolate !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} interpolator must be a function.`);
  }
  const hasFrom = hasOwn(options, 'from');
  const snapshots = new WeakMap<object, unknown>();
  return createDefinition({
    kind: 'tween',
    duration: options.duration,
    debugName: options.debugName,
    hasFrom,
    from: hasFrom ? snapshotAnimationValue(options.from as T, snapshots) : undefined,
    to: snapshotAnimationValue(options.to, snapshots),
    easing: options.easing ?? easing.linear,
    interpolate: options.interpolate,
  });
}

/** Returns an opaque immutable keyframe definition. */
export function keyframes<T>(
  options: Readonly<CRCKeyframesOptions<T>>,
): CRCAnimationDefinition<T> {
  assertDuration(options.duration, options.debugName);
  if (options.values.length < 2) {
    throw new RangeError(`${definitionLabel(options.debugName)} keyframes require at least two values.`);
  }
  if (typeof options.interpolate !== 'undefined' && typeof options.interpolate !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} interpolator must be a function.`);
  }
  const snapshots = new WeakMap<object, unknown>();
  const values = Object.freeze(options.values.map(value => snapshotAnimationValue(value, snapshots)));
  const offsets = normalizeOffsets(values, options.offsets, options.debugName);
  const easings = normalizeEasings(options.easing, values.length - 1, options.debugName);
  keyframeDefinitions++;
  keyframeStorageArrayAllocations += 3;
  return createDefinition({
    kind: 'keyframes',
    duration: options.duration,
    debugName: options.debugName,
    values,
    offsets,
    easings,
    interpolate: options.interpolate,
  });
}

/** Returns an opaque immutable analytic one-dimensional spring definition. */
export function spring(
  options: Readonly<CRCSpringOptions>,
): CRCAnimationDefinition<number> {
  return createDefinition(createSpringRecord(options));
}

/** Returns an opaque immutable definition from a custom seekable sampler. */
export function defineAnimation<T>(
  options: Readonly<CRCAnimationOptions<T>>,
): CRCAnimationDefinition<T> {
  assertDuration(options.duration, options.debugName);
  if (typeof options.sample !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} sample must be a function.`);
  }
  return createDefinition({
    kind: 'custom',
    duration: options.duration,
    debugName: options.debugName,
    sample: options.sample,
  });
}

/**
 * Returns an opaque immutable stepper definition. Steppers are evaluated by
 * the playback engine, not by the seekable sampler.
 */
export function stepper<State, T>(
  options: Readonly<CRCStepperOptions<State, T>>,
): CRCAnimationDefinition<T> {
  if (typeof options.initial !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} stepper initial must be a function.`);
  }
  if (typeof options.step !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} stepper step must be a function.`);
  }
  if (typeof options.read !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} stepper read must be a function.`);
  }
  if (typeof options.done !== 'undefined' && typeof options.done !== 'function') {
    throw new TypeError(`${definitionLabel(options.debugName)} stepper done must be a function.`);
  }
  if (!Number.isFinite(options.stepMilliseconds) || options.stepMilliseconds <= 0) {
    throw new RangeError(`${definitionLabel(options.debugName)} stepper stepMilliseconds must be finite and positive.`);
  }
  const maxElapsedMilliseconds = options.maxElapsedMilliseconds ?? 100;
  if (!Number.isFinite(maxElapsedMilliseconds) || maxElapsedMilliseconds <= 0) {
    throw new RangeError(`${definitionLabel(options.debugName)} stepper maxElapsedMilliseconds must be finite and positive.`);
  }
  return createDefinition({
    kind: 'stepper',
    duration: Number.POSITIVE_INFINITY,
    debugName: options.debugName,
    stepMilliseconds: options.stepMilliseconds,
    maxElapsedMilliseconds,
    initial: options.initial as (currentValue: T) => unknown,
    step: options.step as (state: unknown, deltaMilliseconds: number) => unknown,
    read: options.read as (state: unknown) => T,
    done: options.done as ((state: unknown) => boolean) | undefined,
  });
}

/** @internal Returns the private immutable record associated with a definition. */
export function getDefinitionRecord<T>(
  definition: CRCAnimationDefinition<T>,
): DefinitionRecord<T> {
  const record = definitionRecords.get(definition as CRCAnimationDefinition<unknown>);
  if (record === undefined) throw new TypeError('Expected a CRC animation definition.');
  return record as DefinitionRecord<T>;
}

/** @internal Samples a non-stepper definition from its activation snapshot. */
export function sampleSeekableDefinition<T>(
  definition: CRCAnimationDefinition<T>,
  input: Readonly<Pick<CRCAnimationSampleInput<T>, 'initialValue' | 'localTime'>>,
): T {
  const record = getDefinitionRecord(definition);
  if (record.kind === 'stepper') {
    throw new TypeError(
      `${definitionLabel(record.debugName)} is stateful and requires the stateful program evaluator.`,
    );
  }
  if (record.kind === 'spring') {
    const resolved = resolveSpringStart(record, input.initialValue as number);
    const timing = sampledProgress(resolved.duration, input.localTime);
    return sampleSpring(resolved, timing.localTime / 1000).position as T;
  }
  const timing = sampledProgress(record.duration, input.localTime);
  if (record.kind === 'custom') {
    const sampled = callback(record.debugName, () => record.sample(Object.freeze({
      initialValue: input.initialValue,
      localTime: timing.localTime,
      progress: timing.progress,
    })));
    return validateSampledValue(sampled, record.debugName);
  }
  if (record.kind === 'tween') {
    const from = record.hasFrom ? record.from as T : input.initialValue;
    return interpolate(
      from,
      record.to,
      easedProgress(record.easing, timing.progress, record.debugName),
      record.interpolate,
      record.debugName,
    );
  }

  keyframeSamples++;
  keyframeSampleDepth++;
  try {
    return sampleKeyframe(record, timing);
  } finally {
    keyframeSampleDepth--;
  }
}

function sampleKeyframe<T>(
  record: KeyframesDefinitionRecord<T>,
  timing: { readonly progress: number },
): T {
  let segment = 0;
  for (let index = 1; index < record.offsets.length; index++) {
    if (record.offsets[index] <= timing.progress) segment = index;
    else break;
  }
  if (segment === record.values.length - 1) {
    return validateSampledValue(
      isolateStoredAnimationValue(record.values[segment], new WeakMap()),
      record.debugName,
    );
  }
  const start = record.offsets[segment];
  const end = record.offsets[segment + 1];
  return interpolate(
    record.values[segment],
    record.values[segment + 1],
    easedProgress(record.easings[segment], (timing.progress - start) / (end - start), record.debugName),
    record.interpolate,
    record.debugName,
  );
}

/**
 * @internal Resolves activation-dependent definition data exactly once for a
 * track instance. Stateful definitions use a separate playback-owned record.
 */
export function activateSeekableDefinition<T>(
  definition: CRCAnimationDefinition<T>,
  initialValue: T,
  seen: WeakMap<object, unknown> = new WeakMap(),
): SeekableDefinitionActivation<T> {
  const definitionRecord = getDefinitionRecord(definition);
  if (definitionRecord.kind === 'stepper') {
    throw new TypeError(
      'Stateful animation definitions require the stateful program evaluator.',
    );
  }
  const snapshot = snapshotAnimationActivationValue(initialValue, seen);
  const resolved = definitionRecord.kind === 'spring' ?
    resolveSpringStart(definitionRecord, snapshot as number) : definitionRecord;
  const activation = Object.freeze({
    duration: resolved.duration,
    initialValue: snapshot,
  }) as SeekableDefinitionActivation<T>;
  seekableActivationRecords.set(
    activation as SeekableDefinitionActivation<unknown>,
    Object.freeze({
      definition,
      definitionRecord: resolved,
      initialValue: snapshot,
    }) as SeekableDefinitionActivationRecord<unknown>,
  );
  return activation;
}

/** @internal Samples a definition from one retained activation record. */
export function sampleActivatedSeekableDefinition<T>(
  activation: SeekableDefinitionActivation<T>,
  localTime: number,
): T {
  const activationRecord = seekableActivationRecords.get(
    activation as SeekableDefinitionActivation<unknown>,
  ) as SeekableDefinitionActivationRecord<T> | undefined;
  if (activationRecord === undefined) {
    throw new TypeError('Expected a seekable CRC animation definition activation.');
  }
  const record = activationRecord.definitionRecord;
  if (record.kind === 'spring') {
    const timing = sampledProgress(record.duration, localTime);
    return sampleSpring(record, timing.localTime / 1000).position as T;
  }
  return sampleSeekableDefinition(activationRecord.definition, {
    initialValue: activationRecord.initialValue,
    localTime,
  });
}

/**
 * @internal Returns a boundary value only when the normalized definition makes
 * it exact without invoking user easing, interpolation, or sampling callbacks.
 */
export function getSeekableDefinitionBoundaryValue<T>(
  activation: SeekableDefinitionActivation<T>,
  boundary: 'start' | 'end',
): SeekableDefinitionBoundaryValue<T> {
  const activationRecord = seekableActivationRecords.get(
    activation as SeekableDefinitionActivation<unknown>,
  ) as SeekableDefinitionActivationRecord<T> | undefined;
  if (activationRecord === undefined) {
    throw new TypeError('Expected a seekable CRC animation definition activation.');
  }
  const record = activationRecord.definitionRecord;
  if (record.kind === 'spring') {
    return Object.freeze({
      kind: 'known' as const,
      value: (boundary === 'start' ? record.from : record.to) as T,
    });
  }
  if (record.kind === 'keyframes') {
    if (boundary === 'end') {
      return Object.freeze({ kind: 'known' as const, value: record.values.at(-1)! });
    }
    if (record.interpolate === undefined && record.easings[0] === easing.linear) {
      return Object.freeze({ kind: 'known' as const, value: record.values[0]! });
    }
    return Object.freeze({ kind: 'unknown' as const });
  }
  if (record.kind === 'tween' && record.interpolate === undefined &&
    record.easing === easing.linear) {
    return Object.freeze({
      kind: 'known' as const,
      value: boundary === 'start' ?
        (record.hasFrom ? record.from as T : activationRecord.initialValue) : record.to,
    });
  }
  return Object.freeze({ kind: 'unknown' as const });
}

/**
 * @internal Returns a callback-free boundary that does not depend on a track's
 * activation value. This lets discovery recover known terminal state after an
 * earlier opaque custom value.
 */
export function getStaticSeekableDefinitionBoundaryValue<T>(
  definition: CRCAnimationDefinition<T>,
  boundary: 'start' | 'end',
): SeekableDefinitionBoundaryValue<T> {
  const record = getDefinitionRecord(definition);
  if (record.kind === 'spring' && record.hasFrom) {
    return Object.freeze({
      kind: 'known' as const,
      value: (boundary === 'start' ? record.from : record.to) as T,
    });
  }
  if (record.kind === 'keyframes') {
    if (boundary === 'end') {
      return Object.freeze({ kind: 'known' as const, value: record.values.at(-1)! });
    }
    if (record.interpolate === undefined && record.easings[0] === easing.linear) {
      return Object.freeze({ kind: 'known' as const, value: record.values[0]! });
    }
  }
  if (record.kind === 'tween' && record.interpolate === undefined &&
    record.easing === easing.linear) {
    if (boundary === 'end') {
      return Object.freeze({ kind: 'known' as const, value: record.to });
    }
    if (record.hasFrom) {
      return Object.freeze({ kind: 'known' as const, value: record.from as T });
    }
  }
  return Object.freeze({ kind: 'unknown' as const });
}
